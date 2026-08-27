import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { LoginMfaDto } from './dto/login-mfa.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MfaEnableDto } from './dto/mfa-enable.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { RenameAccountDto } from './dto/rename-account.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { AppConfig } from '../config/configuration';

const SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

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
  @Throttle(AUTH_THROTTLE)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(dto.email, dto.password);
    this.setSessionCookie(res, result.sessionToken);
    return { email: result.email, mcpUserToken: result.mcpUserToken, mcpConnectorUrl: this.mcpUrl(result.mcpUserToken) };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);

    if ('mfaRequired' in result) {
      return result;
    }

    this.setSessionCookie(res, result.sessionToken);
    return { email: result.email, mcpUserToken: result.mcpUserToken, mcpConnectorUrl: this.mcpUrl(result.mcpUserToken) };
  }

  @Post('login/mfa')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async loginMfa(@Body() dto: LoginMfaDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginMfa(dto.mfaToken, dto.code);
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

  @Post('mcp-token/regenerate')
  @UseGuards(JwtAuthGuard)
  async regenerateMcpToken(@CurrentUser() user: RequestUser) {
    const result = await this.authService.regenerateMcpUserToken(user.userId);
    return { ...result, mcpConnectorUrl: this.mcpUrl(result.mcpUserToken) };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle(AUTH_THROTTLE)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    this.setSessionCookie(res, result.sessionToken);
    return { ok: true };
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.revokeAllSessions(user.userId);
    res.clearCookie('session');
    return { ok: true };
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: RequestUser) {
    return this.authService.setupMfa(user.userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  enableMfa(@CurrentUser() user: RequestUser, @Body() dto: MfaEnableDto) {
    return this.authService.enableMfa(user.userId, dto.secret, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  async disableMfa(@CurrentUser() user: RequestUser, @Body() dto: MfaDisableDto) {
    await this.authService.disableMfa(user.userId, dto.password);
    return { ok: true };
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  listAccounts(@CurrentUser() user: RequestUser) {
    return this.authService.listConnectedAccounts(user.userId);
  }

  @Patch('accounts/:alias')
  @UseGuards(JwtAuthGuard)
  renameAccount(
    @CurrentUser() user: RequestUser,
    @Param('alias') alias: string,
    @Body() dto: RenameAccountDto,
  ) {
    return this.authService.renameAccount(user.userId, alias.toLowerCase(), dto.newAlias);
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
