import { IsString } from 'class-validator';

export class LoginMfaDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  code!: string;
}
