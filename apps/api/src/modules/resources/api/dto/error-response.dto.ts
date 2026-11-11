import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código HTTP de la respuesta.',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Código identificador del error.',
    example: 'BAD_REQUEST',
  })
  code: string;

  @ApiProperty({
    description: 'Descripción del error.',
    example: 'Los datos enviados no son válidos.',
  })
  message: string | string[];

  @ApiProperty({
    description: 'Ruta donde ocurrió el error.',
    example: '/camas',
  })
  path: string;

  @ApiProperty({
    description: 'Fecha y hora en que ocurrió el error.',
    example: '2026-11-07T13:30:00.000Z',
  })
  timestamp: string;
}