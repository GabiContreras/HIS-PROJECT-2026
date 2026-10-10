import { IsEmail, IsString, Validate } from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Validate(PasswordPolicyValidator)
  password: string;
}
