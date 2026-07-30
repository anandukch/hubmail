import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { ConnectedAccount, ConnectedAccountDocument } from './schemas/connected-account.schema';
import { AppConfig } from '../config/configuration';

export interface ConnectedAccountSummary {
  alias: string;
  googleEmail: string;
  status: 'ok' | 'reauth_required';
}

const BCRYPT_ROUNDS = 12;
const SESSION_TTL = '24h';

export interface AuthResult {
  userId: string;
  email: string;
  sessionToken: string;
  mcpUserToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ConnectedAccount.name)
    private readonly connectedAccountModel: Model<ConnectedAccountDocument>,
    private readonly config: ConfigService<AppConfig, true>,
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

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash');
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(user);
  }

  async getCurrentUser(userId: string): Promise<{ email: string; mcpUserToken: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    return { email: user.email, mcpUserToken: user.mcpUserToken };
  }

  async listConnectedAccounts(userId: string): Promise<ConnectedAccountSummary[]> {
    const accounts = await this.connectedAccountModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('alias googleEmail status')
      .sort({ alias: 1 });
    return accounts.map((a) => ({ alias: a.alias, googleEmail: a.googleEmail, status: a.status }));
  }

  private buildAuthResult(user: UserDocument): AuthResult {
    const secret = this.config.get('jwtSecret', { infer: true });
    const sessionToken = jwt.sign({ userId: user._id.toString(), typ: 'session' }, secret, {
      expiresIn: SESSION_TTL,
    });

    return {
      userId: user._id.toString(),
      email: user.email,
      sessionToken,
      mcpUserToken: user.mcpUserToken,
    };
  }
}
