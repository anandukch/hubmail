import { IsString, MinLength } from 'class-validator';
import { IsPasswordByteLengthValid, PASSWORD_MIN_LENGTH } from './password.validators';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
  @IsPasswordByteLengthValid()
  newPassword!: string;
}
