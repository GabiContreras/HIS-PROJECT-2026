import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoExcepcion } from '../../../../entities/agenda-excepcion.entity.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const HORA_EN_BLOQUES = /^([01]\d|2[0-3]):(00|30)$/;

export class BloqueAgendaDto {
  @ApiProperty({ example: 1, description: 'Día de la semana: 0 domingo a 6 sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @ApiProperty({ example: '09:00', description: 'Hora de inicio en bloques de 30 minutos' })
  @Matches(HORA_EN_BLOQUES, { message: 'La hora debe tener formato HH:MM en bloques de 30 minutos.' })
  horaInicio: string;

  @ApiProperty({ example: '13:00', description: 'Hora de fin en bloques de 30 minutos' })
  @Matches(HORA_EN_BLOQUES, { message: 'La hora debe tener formato HH:MM en bloques de 30 minutos.' })
  horaFin: string;
}

export class ActualizarAgendaDto {
  @ApiProperty({ type: BloqueAgendaDto, isArray: true, description: 'Bloques de atención semanales. Reemplazan a los actuales.' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BloqueAgendaDto)
  bloques: BloqueAgendaDto[];
}

export class CrearExcepcionDto {
  @ApiProperty({ example: '2026-12-25', description: 'Fecha en formato YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({ enum: TipoExcepcion, description: 'Tipo de excepción' })
  @IsEnum(TipoExcepcion)
  tipo: TipoExcepcion;

  @ApiPropertyOptional({ description: 'Médico afectado. Si se omite, aplica a toda la clínica.' })
  @IsOptional()
  @IsUUID()
  medicoId?: string;

  @ApiPropertyOptional({ example: 'Congreso médico', description: 'Motivo de la excepción' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  motivo?: string;
}