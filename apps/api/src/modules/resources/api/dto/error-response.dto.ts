import { ApiProperty } from '@nestjs/swagger';

/** Forma que produce AllExceptionsFilter para todos los errores. */
export class ErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({ example: 'CONFLICT' })
  code: string;

  @ApiProperty({ example: 'La cama A-12 ya fue ocupada por otro operador.' })
  message: string;

  @ApiProperty({ example: '/camas/9b1d4c7e-2f3a-4e8b-8c55-1a2b3c4d5e6f/asignar' })
  path: string;

  @ApiProperty({ example: '2026-10-28T22:10:00.000Z' })
  timestamp: string;
}