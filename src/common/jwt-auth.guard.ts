import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppConfig } from '../config/configuration';
import { SessionService } from '../auth/session.service';

interface SessionJwtPayload {
  userId: string;
  typ: 'session';
  sv: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    let payload: SessionJwtPayload;
    try {
      const secret = this.config.get('jwtSecret', { infer: true });
      payload = jwt.verify(token, secret) as SessionJwtPayload;
      if (payload.typ !== 'session') {
        throw new UnauthorizedException('Invalid session token');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const currentVersion = await this.sessionService.getSessionVersion(payload.userId);
    if (currentVersion === null || currentVersion !== payload.sv) {
      throw new UnauthorizedException('Session has been revoked, please log in again');
    }

    (request as Request & { user: { userId: string } }).user = { userId: payload.userId };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const cookieToken = request.cookies?.session;
    if (cookieToken) return cookieToken;

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }
    return undefined;
  }
}
