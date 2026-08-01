import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { AppConfig } from '../config/configuration';

const SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private mcpUrl(token: string): string {
    return `${this.config.get('publicBaseUrl', { infer: true })}/mcp/${token}`;
  }

  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(dto.email, dto.password);
    this.setSessionCookie(res, result.sessionToken);
    return { email: result.email, mcpUserToken: result.mcpUserToken, mcpConnectorUrl: this.mcpUrl(result.mcpUserToken) };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    this.setSessionCookie(res, result.sessionToken);
    return { email: result.email, mcpUserToken: result.mcpUserToken, mcpConnectorUrl: this.mcpUrl(result.mcpUserToken) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('session');
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const result = await this.authService.getCurrentUser(user.userId);
    return { ...result, mcpConnectorUrl: this.mcpUrl(result.mcpUserToken) };
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  listAccounts(@CurrentUser() user: RequestUser) {
    return this.authService.listConnectedAccounts(user.userId);
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard)
  auditLogs(@CurrentUser() user: RequestUser) {
    return this.authService.getAuditLogs(user.userId);
  }

  private setSessionCookie(res: Response, token: string) {
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
  }
}
