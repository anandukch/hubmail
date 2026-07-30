import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { AppConfig } from '../config/configuration';

export interface OAuthStatePayload {
  userId: string;
  alias: string;
  typ: 'oauth_state';
}

const STATE_TTL = '5m';

@Injectable()
export class OauthStateService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  sign(userId: string, alias: string): string {
    const secret = this.config.get('jwtSecret', { infer: true });
    return jwt.sign(
      { userId, alias, typ: 'oauth_state', nonce: randomBytes(8).toString('hex') },
      secret,
      { expiresIn: STATE_TTL },
    );
  }

  verify(state: string): OAuthStatePayload {
    const secret = this.config.get('jwtSecret', { infer: true });
    const payload = jwt.verify(state, secret) as OAuthStatePayload;
    if (payload.typ !== 'oauth_state') {
      throw new Error('Invalid state token type');
    }
    return payload;
  }
}
