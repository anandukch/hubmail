import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConnectedAccountDocument = HydratedDocument<ConnectedAccount>;

export type ConnectedAccountStatus = 'ok' | 'reauth_required';

@Schema({ timestamps: { createdAt: 'connectedAt', updatedAt: true } })
export class ConnectedAccount {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true, match: /^[a-z0-9-_]{1,40}$/ })
  alias!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  googleEmail!: string;

  @Prop({ required: true, select: false })
  encryptedRefreshToken!: string;

  @Prop({ type: [String], required: true })
  scopes!: string[];

  @Prop()
  lastError?: string;

  @Prop({ type: String, enum: ['ok', 'reauth_required'], default: 'ok' })
  status!: ConnectedAccountStatus;

  @Prop({ select: false })
  cachedAccessToken?: string;

  @Prop()
  cachedAccessTokenExpiresAt?: Date;

  connectedAt?: Date;
}

export const ConnectedAccountSchema = SchemaFactory.createForClass(ConnectedAccount);

ConnectedAccountSchema.index({ userId: 1, alias: 1 }, { unique: true });
ConnectedAccountSchema.index({ googleEmail: 1 });
