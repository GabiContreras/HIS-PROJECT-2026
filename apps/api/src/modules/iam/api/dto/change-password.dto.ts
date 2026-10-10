import { IsString, Validate } from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class ChangePasswordDto {
  @IsString()
  passwordActual: string;

  @IsString()
  @Validate(PasswordPolicyValidator)
  passwordNueva: string;
}
