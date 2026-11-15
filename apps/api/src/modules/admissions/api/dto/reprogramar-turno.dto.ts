import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReprogramarTurnoDto {
  @ApiProperty({
    example: '2026-12-01T12:00:00.000Z',
    description: 'Nueva fecha y hora del turno.',
  })
  @IsDateString()
  fechaHora: string;

  @ApiPropertyOptional({
    description: 'Nuevo médico. Si se omite, se mantiene el actual.',
  })
  @IsOptional()
  @IsUUID()
  medicoId?: string;
}