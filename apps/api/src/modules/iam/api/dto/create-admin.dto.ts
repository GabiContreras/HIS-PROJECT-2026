import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class CreateAdminDto {
  @ApiProperty({
    example: 'María',
    description: 'Nombre del administrador.',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @ApiProperty({
    example: 'González',
    description: 'Apellido del administrador.',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  apellido: string;

  @ApiProperty({
    example: 'maria.gonzalez@ejemplo.com',
    description: 'Correo electrónico del administrador.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'ClaveSegura135!',
    description: 'Contraseña que debe cumplir con la política de seguridad establecida.',
  })
  @IsString()
  @Validate(PasswordPolicyValidator)
  password: string;
}