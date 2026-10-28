import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CrearIndicacionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;

  @ApiProperty({ format: 'uuid', description: 'Insumo (medicamento) del inventario.' })
  @IsUUID()
  insumoId: string;

  @ApiProperty({ example: '400 mg', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosis: string;

  @ApiProperty({ example: 8, minimum: 1, maximum: 168, description: 'Cada cuántas horas se administra.' })
  @IsInt()
  @Min(1)
  @Max(168)
  frecuenciaHoras: number;

  @ApiPropertyOptional({
    example: '2030-01-05T12:00:00.000Z',
    description: 'Fin del tratamiento (ISO 8601). Si se omite, la indicación no vence.',
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
