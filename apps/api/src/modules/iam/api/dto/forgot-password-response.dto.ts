import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Información sobre el estado de la recuperación.',
    example:
      'La recuperación por correo no está disponible. Pedile a un administrativo que restablezca tu contraseña.',
  })
  message: string;
}