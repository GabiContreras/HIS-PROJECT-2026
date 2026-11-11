import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Validate } from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Correo electrónico de la cuenta cuya contraseña se desea restablecer.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'ClaveNueva246!',
    description: 'Nueva contraseña que debe cumplir con la política de seguridad establecida.',
  })
  @IsString()
  @Validate(PasswordPolicyValidator)
  password: string;
}