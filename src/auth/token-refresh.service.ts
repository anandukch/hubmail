import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { google } from 'googleapis';
import { AppConfig } from '../config/configuration';
import { EncryptionService } from './encryption.service';
import { ConnectedAccount, ConnectedAccountDocument } from './schemas/connected-account.schema';
import { AccountReauthRequiredError } from '../common/errors/account-reauth-required.error';
import { AccountNotFoundError } from '../common/errors/account-not-found.error';
import { AppLoggerService } from '../common/app-logger.service';

// Refresh a bit before actual expiry to avoid using a token that expires mid-request.
const EXPIRY_SKEW_MS = 60_000;

@Injectable()
export class TokenRefreshService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly encryption: EncryptionService,
    private readonly logger: AppLoggerService,
    @InjectModel(ConnectedAccount.name)
    private readonly connectedAccountModel: Model<ConnectedAccountDocument>,
  ) {}

  async getValidAccessToken(userId: string, alias: string): Promise<string> {
    const account = await this.connectedAccountModel
      .findOne({ userId: new Types.ObjectId(userId), alias })
      .select('+encryptedRefreshToken +cachedAccessToken +cachedAccessTokenExpiresAt');

    if (!account) {
      throw new AccountNotFoundError(alias);
    }

    if (this.isCacheValid(account)) {
      return account.cachedAccessToken as string;
    }

    return this.refresh(account);
  }

  private isCacheValid(account: ConnectedAccountDocument): boolean {
    if (!account.cachedAccessToken || !account.cachedAccessTokenExpiresAt) {
      return false;
    }
    return account.cachedAccessTokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
  }

  private async refresh(account: ConnectedAccountDocument): Promise<string> {
    const google_ = this.config.get('google', { infer: true });
    const client = new google.auth.OAuth2(google_.clientId, google_.clientSecret);
    const refreshToken = this.encryption.decrypt(account.encryptedRefreshToken);
    client.setCredentials({ refresh_token: refreshToken });

    try {
      const { token, res } = await client.getAccessToken();
      if (!token) {
        throw new Error('Google did not return an access token');
      }

      const expiryDate = (res?.data?.expiry_date as number | undefined) ?? Date.now() + 55 * 60_000;

      await this.connectedAccountModel.updateOne(
        { _id: account._id },
        {
          cachedAccessToken: token,
          cachedAccessTokenExpiresAt: new Date(expiryDate),
          status: 'ok',
          $unset: { lastError: '' },
        },
      );

      return token;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn('Gmail token refresh failed', { userId: account.userId.toString(), alias: account.alias });

      await this.connectedAccountModel.updateOne(
        { _id: account._id },
        { status: 'reauth_required', lastError: message },
      );

      throw new AccountReauthRequiredError(account.alias);
    }
  }
}
