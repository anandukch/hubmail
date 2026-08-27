import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsPasswordByteLengthValid, PASSWORD_MIN_LENGTH } from './password.validators';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
  @IsPasswordByteLengthValid()
  password!: string;
}
