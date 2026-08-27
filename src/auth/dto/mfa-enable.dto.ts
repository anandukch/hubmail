import { IsString } from 'class-validator';

export class MfaEnableDto {
  // Returned by POST /auth/mfa/setup and round-tripped here — nothing is persisted
  // until the user proves possession of the authenticator by submitting a valid code,
  // so a half-finished setup never leaves a live secret in the DB.
  @IsString()
  secret!: string;

  @IsString()
  code!: string;
}
