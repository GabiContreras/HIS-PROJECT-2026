import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Confirmación del restablecimiento de contraseña.',
    example: 'La contraseña fue restablecida.',
  })
  message: string;
}