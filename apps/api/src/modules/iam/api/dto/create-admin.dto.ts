import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class CreateAdminDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  apellido: string;

  @IsEmail()
  email: string;

  @IsString()
  @Validate(PasswordPolicyValidator)
  password: string;
}
