import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Información sobre el estado de la recuperación.',
    example:
      'La recuperación por correo está temporalmente deshabilitada. En desarrollo, restablecé la contraseña mediante /auth/reset-password.',
  })
  message: string;
}