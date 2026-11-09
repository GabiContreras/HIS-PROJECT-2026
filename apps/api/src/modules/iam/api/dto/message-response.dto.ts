import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    description: 'Mensaje que informa el resultado de la operación.',
    example: 'Cuenta creada correctamente.',
  })
  message: string;
}