import { BadRequestException, ConflictException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Response } from 'express';
import { GoogleOauthService, NoRefreshTokenError } from './google-oauth.service';
import { OauthStateService } from './oauth-state.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { AppLoggerService } from '../common/app-logger.service';
import { AppConfig } from '../config/configuration';
import { ConnectedAccount, ConnectedAccountDocument } from './schemas/connected-account.schema';

const ALIAS_PATTERN = /^[a-z0-9-_]{1,40}$/;

@Controller('oauth/google')
@UseGuards(ThrottlerGuard)
export class GoogleOauthController {
  constructor(
    private readonly googleOauthService: GoogleOauthService,
    private readonly oauthStateService: OauthStateService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly logger: AppLoggerService,
    @InjectModel(ConnectedAccount.name)
    private readonly connectedAccountModel: Model<ConnectedAccountDocument>,
  ) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  async connect(
    @Query('alias') alias: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    if (!alias || !ALIAS_PATTERN.test(alias)) {
      throw new BadRequestException('alias must be 1-40 characters: a-z, 0-9, - or _');
    }

    const existing = await this.connectedAccountModel.findOne({
      userId: new Types.ObjectId(user.userId),
      alias,
    });
    if (existing) {
      throw new ConflictException(`Alias '${alias}' is already connected`);
    }

    const state = this.oauthStateService.sign(user.userId, alias);
    const consentUrl = this.googleOauthService.buildConsentUrl(state);
    res.redirect(consentUrl);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const dashboardUrl = this.config.get('publicBaseUrl', { infer: true }) + '/dashboard';

    if (error) {
      let alias: string | undefined;
      try {
        alias = state ? this.oauthStateService.verify(state).alias : undefined;
      } catch {
        alias = undefined;
      }
      return res.redirect(`${dashboardUrl}?error=access_denied${alias ? `&alias=${alias}` : ''}`);
    }

    if (!code || !state) {
      return res.redirect(`${dashboardUrl}?error=oauth_failed`);
    }

    let payload: { userId: string; alias: string };
    try {
      payload = this.oauthStateService.verify(state);
    } catch {
      this.logger.warn('OAuth callback received invalid or expired state');
      return res.redirect(`${dashboardUrl}?error=invalid_state`);
    }

    try {
      await this.googleOauthService.handleCallback(payload.userId, payload.alias, code);
      return res.redirect(`${dashboardUrl}?connected=${payload.alias}`);
    } catch (err) {
      const errorCode = err instanceof NoRefreshTokenError ? 'no_refresh_token' : 'oauth_failed';
      this.logger.error('OAuth callback failed', {
        userId: payload.userId,
        alias: payload.alias,
        errorCode,
        message: err instanceof Error ? err.message : String(err),
      });
      return res.redirect(`${dashboardUrl}?error=${errorCode}&alias=${payload.alias}`);
    }
  }
}
