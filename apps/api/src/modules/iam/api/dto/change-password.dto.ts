import { ApiProperty } from '@nestjs/swagger';
import { IsString, Validate } from 'class-validator';
import { PasswordPolicyValidator } from '../../application/password-policy.validator.js';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'ClaveAnterior123!',
    description: 'Contraseña actual del usuario.',
  })
  @IsString()
  passwordActual: string;

  @ApiProperty({
    example: 'ClaveNueva456!',
    description: 'Nueva contraseña. Debe cumplir con la política de seguridad establecida.',
  })
  @IsString()
  @Validate(PasswordPolicyValidator)
  passwordNueva: string;
}