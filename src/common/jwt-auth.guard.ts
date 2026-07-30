import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppConfig } from '../config/configuration';

interface SessionJwtPayload {
  userId: string;
  typ: 'session';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const secret = this.config.get('jwtSecret', { infer: true });
      const payload = jwt.verify(token, secret) as SessionJwtPayload;
      if (payload.typ !== 'session') {
        throw new UnauthorizedException('Invalid session token');
      }
      (request as Request & { user: { userId: string } }).user = { userId: payload.userId };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
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
