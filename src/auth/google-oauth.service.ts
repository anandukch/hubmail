import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import { Types } from 'mongoose';
import { AppConfig } from '../config/configuration';
import { EncryptionService } from './encryption.service';
import { ConnectedAccount, ConnectedAccountDocument } from './schemas/connected-account.schema';
import { AppLoggerService } from '../common/app-logger.service';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_MODIFY_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
// gmail.modify covers messages/labels but NOT filters — users.settings.filters.create needs
// its own scope, or create_mail_filter 403s even with modify granted.
const GMAIL_SETTINGS_SCOPE = 'https://www.googleapis.com/auth/gmail.settings.basic';
// Requested together so Google's consent screen lets the user deselect gmail.modify/settings
// and keep only gmail.readonly — write access (delete/draft/filters) becomes opt-in per account.
const SCOPES = [GMAIL_READONLY_SCOPE, GMAIL_MODIFY_SCOPE, GMAIL_SETTINGS_SCOPE, 'openid', 'email'];

export class NoRefreshTokenError extends Error {
  constructor() {
    super('Google did not return a refresh token');
    this.name = 'NoRefreshTokenError';
  }
}

interface GoogleIdTokenClaims {
  email?: string;
}

@Injectable()
export class GoogleOauthService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly encryption: EncryptionService,
    private readonly logger: AppLoggerService,
    @InjectModel(ConnectedAccount.name)
    private readonly connectedAccountModel: Model<ConnectedAccountDocument>,
  ) {}

  private buildClient() {
    const google_ = this.config.get('google', { infer: true });
    return new google.auth.OAuth2(google_.clientId, google_.clientSecret, google_.callbackUrl);
  }

  buildConsentUrl(state: string): string {
    const client = this.buildClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
    });
  }

  async handleCallback(userId: string, alias: string, code: string): Promise<void> {
    const client = this.buildClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      throw new NoRefreshTokenError();
    }

    const googleEmail = this.extractEmail(tokens.id_token);
    const encryptedRefreshToken = this.encryption.encrypt(tokens.refresh_token);

    await this.connectedAccountModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), alias },
      {
        userId: new Types.ObjectId(userId),
        alias,
        googleEmail,
        encryptedRefreshToken,
        scopes: tokens.scope ? tokens.scope.split(' ') : [GMAIL_READONLY_SCOPE],
        status: 'ok',
        lastError: undefined,
        cachedAccessToken: tokens.access_token ?? undefined,
        cachedAccessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
      { upsert: true, new: true },
    );

    this.logger.log('Connected Gmail account', { userId, alias });
  }

  private extractEmail(idToken: string | null | undefined): string {
    if (!idToken) {
      throw new Error('Google did not return an id_token');
    }
    const payloadSegment = idToken.split('.')[1];
    const claims = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as GoogleIdTokenClaims;
    if (!claims.email) {
      throw new Error('id_token did not contain an email claim');
    }
    return claims.email;
  }
}
