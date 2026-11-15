import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoTurno } from '../../../../entities/turno.entity.js';
import { PaginacionDto } from './paginacion.dto.js';
import { TurnosFiltroDto } from './turnos-filtro.dto.js';

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class AgendaFiltroDto extends IntersectionType(TurnosFiltroDto, PaginacionDto) {
  @ApiPropertyOptional({ enum: EstadoTurno, description: 'Filtra por estado del turno.' })
  @IsOptional()
  @IsEnum(EstadoTurno)
  estado?: EstadoTurno;

  @ApiPropertyOptional({ description: 'Filtra por paciente.' })
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @ApiPropertyOptional({ example: false, description: 'Solo entreturnos (true) o solo turnos regulares (false).' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  urgente?: boolean;
}