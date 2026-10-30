import { IsString, Validate } from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class RestablecerClaveDto {
  @IsString()
  @Validate(PasswordPolicyValidator)
  passwordTemporal: string;
}
