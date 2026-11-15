import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoTriaje } from '../../../../entities/triaje.entity.js';
import { NivelTriage } from './crear-triage.dto.js';
import { PaginacionDto } from './paginacion.dto.js';

export class TriageFiltroDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: NivelTriage, description: 'Filtra por nivel de triaje.' })
  @IsOptional()
  @IsEnum(NivelTriage)
  nivel?: NivelTriage;

  @ApiPropertyOptional({ enum: EstadoTriaje, description: 'Por defecto EN_COLA.' })
  @IsOptional()
  @IsEnum(EstadoTriaje)
  estado?: EstadoTriaje;
}