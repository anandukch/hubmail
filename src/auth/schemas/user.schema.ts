import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, unique: true, index: true })
  mcpUserToken!: string;

  @Prop({ default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil?: Date | null;

  // Bumped on password change or an explicit "log out everywhere" — any outstanding
  // session JWT carries the version it was issued with, so a mismatch revokes it
  // without needing a global JWT_SECRET rotation (which would log out every user).
  @Prop({ default: 0 })
  sessionVersion!: number;

  // MFA (TOTP). Secret is encrypted at rest via EncryptionService, same AES-256-GCM
  // pattern already used for Gmail refresh tokens.
  @Prop({ select: false })
  mfaSecret?: string;

  @Prop({ default: false })
  mfaEnabled!: boolean;

  @Prop({ type: [String], select: false })
  mfaRecoveryCodeHashes?: string[];

  createdAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
