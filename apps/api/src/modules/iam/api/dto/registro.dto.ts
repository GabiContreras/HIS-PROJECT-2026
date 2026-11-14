import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario.',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del usuario.',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  apellido: string;

  @ApiProperty({
    example: 'juan.perez@ejemplo.com',
    description: 'Correo electrónico del usuario.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: [RolUsuario.MEDICO, RolUsuario.ENFERMERO],
    example: RolUsuario.MEDICO,
    description: 'Rol que tendrá el usuario dentro del sistema.',
  })
  @IsIn([RolUsuario.MEDICO, RolUsuario.ENFERMERO])
  rol: RolUsuario;

  @ApiProperty({
    example: 'ClaveSegura135!',
    description: 'Contraseña que debe cumplir con la política de seguridad establecida.',
  })
  @IsString()
  @Validate(PasswordPolicyValidator)
  password: string;
}