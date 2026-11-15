import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { TipoIndicacion } from '../../../../entities/indicacion-medica.entity.js';

export class CrearIndicacionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio solo para una indicación MEDICACION.' })
  @ValidateIf((dto: CrearIndicacionDto) => !dto.tipo || dto.tipo === TipoIndicacion.MEDICACION)
  @IsUUID()
  insumoId?: string;

  @ApiPropertyOptional({ enum: TipoIndicacion, default: TipoIndicacion.MEDICACION })
  @IsOptional()
  @IsEnum(TipoIndicacion)
  tipo?: TipoIndicacion;

  @ApiPropertyOptional({ format: 'uuid', description: 'Internación a la que corresponde la indicación.' })
  @IsOptional()
  @IsUUID()
  internacionId?: string;

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
