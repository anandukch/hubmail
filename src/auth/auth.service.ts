import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { ConnectedAccount, ConnectedAccountDocument } from './schemas/connected-account.schema';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { EncryptionService } from './encryption.service';
import { MfaService } from './mfa.service';
import { AppConfig } from '../config/configuration';

export interface ConnectedAccountSummary {
  alias: string;
  googleEmail: string;
  status: 'ok' | 'reauth_required';
}

export interface AuditLogEntry {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tool: string;
  alias?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

const BCRYPT_ROUNDS = 12;
const SESSION_TTL = '24h';
const MFA_PENDING_TTL = '5m';
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export interface AuthResult {
  userId: string;
  email: string;
  sessionToken: string;
  mcpUserToken: string;
}

export interface MfaRequiredResult {
  mfaRequired: true;
  mfaToken: string;
}

interface MfaPendingPayload {
  userId: string;
  typ: 'mfa_pending';
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ConnectedAccount.name)
    private readonly connectedAccountModel: Model<ConnectedAccountDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly encryption: EncryptionService,
    private readonly mfa: MfaService,
  ) {}

  async signup(email: string, password: string): Promise<AuthResult> {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const mcpUserToken = randomBytes(32).toString('base64url');

    const user = await this.userModel.create({
      email: email.toLowerCase(),
      passwordHash,
      mcpUserToken,
    });

    return this.buildAuthResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult | MfaRequiredResult> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account temporarily locked due to repeated failed attempts. Try again later.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.registerFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.userModel.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    if (user.mfaEnabled) {
      return { mfaRequired: true, mfaToken: this.signMfaPendingToken(user._id.toString()) };
    }

    return this.buildAuthResult(user);
  }

  async loginMfa(mfaToken: string, code: string): Promise<AuthResult> {
    const payload = this.verifyMfaPendingToken(mfaToken);

    const user = await this.userModel.findById(payload.userId).select('+mfaSecret +mfaRecoveryCodeHashes');
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }

    const secret = this.encryption.decrypt(user.mfaSecret);
    const isValidTotp = await this.mfa.verifyToken(secret, code);
    if (isValidTotp) {
      return this.buildAuthResult(user);
    }

    const hashes = user.mfaRecoveryCodeHashes ?? [];
    const matchIndex = await this.mfa.findMatchingRecoveryCodeIndex(hashes, code);
    if (matchIndex === -1) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    hashes.splice(matchIndex, 1);
    user.mfaRecoveryCodeHashes = hashes;
    await this.userModel.updateOne({ _id: user._id }, { $set: { mfaRecoveryCodeHashes: hashes } });

    return this.buildAuthResult(user);
  }

  async getCurrentUser(
    userId: string,
  ): Promise<{ email: string; mcpUserToken: string; mfaEnabled: boolean }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    return { email: user.email, mcpUserToken: user.mcpUserToken, mfaEnabled: user.mfaEnabled };
  }

  async regenerateMcpUserToken(userId: string): Promise<{ email: string; mcpUserToken: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    user.mcpUserToken = randomBytes(32).toString('base64url');
    await user.save();
    return { email: user.email, mcpUserToken: user.mcpUserToken };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.sessionVersion += 1;
    await user.save();

    return this.buildAuthResult(user);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
  }

  async setupMfa(userId: string): Promise<{ secret: string; qrDataUrl: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    const secret = this.mfa.generateSecret();
    const qrDataUrl = await this.mfa.buildQrDataUrl(user.email, secret);
    return { secret, qrDataUrl };
  }

  async enableMfa(userId: string, secret: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const isValid = await this.mfa.verifyToken(secret, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    const recoveryCodes = this.mfa.generateRecoveryCodes();
    const recoveryCodeHashes = await this.mfa.hashRecoveryCodes(recoveryCodes);
    const encryptedSecret = this.encryption.encrypt(secret);

    await this.userModel.updateOne(
      { _id: userId },
      { $set: { mfaSecret: encryptedSecret, mfaEnabled: true, mfaRecoveryCodeHashes: recoveryCodeHashes } },
    );

    return { recoveryCodes };
  }

  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.userModel.updateOne(
      { _id: userId },
      { $set: { mfaEnabled: false }, $unset: { mfaSecret: '', mfaRecoveryCodeHashes: '' } },
    );
  }

  async listConnectedAccounts(userId: string): Promise<ConnectedAccountSummary[]> {
    const accounts = await this.connectedAccountModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('alias googleEmail status')
      .sort({ alias: 1 });
    return accounts.map((a) => ({ alias: a.alias, googleEmail: a.googleEmail, status: a.status }));
  }

  async renameAccount(userId: string, alias: string, newAlias: string): Promise<ConnectedAccountSummary> {
    if (alias === newAlias) {
      const account = await this.connectedAccountModel.findOne({ userId: new Types.ObjectId(userId), alias });
      if (!account) throw new NotFoundException(`No account named '${alias}' is connected`);
      return { alias: account.alias, googleEmail: account.googleEmail, status: account.status };
    }

    const account = await this.connectedAccountModel.findOne({ userId: new Types.ObjectId(userId), alias });
    if (!account) {
      throw new NotFoundException(`No account named '${alias}' is connected`);
    }

    const clash = await this.connectedAccountModel.findOne({ userId: new Types.ObjectId(userId), alias: newAlias });
    if (clash) {
      throw new ConflictException(`An account named '${newAlias}' already exists`);
    }

    account.alias = newAlias;
    await account.save();

    return { alias: account.alias, googleEmail: account.googleEmail, status: account.status };
  }

  async getAuditLogs(userId: string, page: number, limit: number): Promise<PaginatedAuditLogs> {
    const filter = { userId: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<AuditLogEntry[]>()
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  private async registerFailedLogin(user: UserDocument): Promise<void> {
    const updated = await this.userModel.findOneAndUpdate(
      { _id: user._id },
      { $inc: { failedLoginAttempts: 1 } },
      { new: true },
    );
    if (!updated) return;

    if (updated.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { lockedUntil: new Date(Date.now() + LOCKOUT_WINDOW_MS) } },
      );
      await this.auditLogModel.create({
        userId: user._id,
        tool: 'auth.lockout',
        metadata: { attempts: updated.failedLoginAttempts },
      });
    }
  }

  private signMfaPendingToken(userId: string): string {
    const secret = this.config.get('jwtSecret', { infer: true });
    return jwt.sign({ userId, typ: 'mfa_pending' }, secret, { expiresIn: MFA_PENDING_TTL });
  }

  private verifyMfaPendingToken(token: string): MfaPendingPayload {
    const secret = this.config.get('jwtSecret', { infer: true });
    let payload: MfaPendingPayload;
    try {
      payload = jwt.verify(token, secret) as MfaPendingPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA session, please log in again');
    }
    if (payload.typ !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid MFA session, please log in again');
    }
    return payload;
  }

  private buildAuthResult(user: UserDocument): AuthResult {
    const secret = this.config.get('jwtSecret', { infer: true });
    const sessionToken = jwt.sign(
      { userId: user._id.toString(), typ: 'session', sv: user.sessionVersion },
      secret,
      { expiresIn: SESSION_TTL },
    );

    return {
      userId: user._id.toString(),
      email: user.email,
      sessionToken,
      mcpUserToken: user.mcpUserToken,
    };
  }
}
