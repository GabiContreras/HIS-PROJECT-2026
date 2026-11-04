import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { RolUsuario } from '../../../../entities/usuario.entity.js';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class RegistroDto {
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

  @IsIn([RolUsuario.MEDICO, RolUsuario.ENFERMERO])
  rol: RolUsuario;

  @IsString()
  @Validate(PasswordPolicyValidator)
  password: string;
}
