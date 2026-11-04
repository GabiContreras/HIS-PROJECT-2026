import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoCama } from '../../domain/estado-cama.enum.js';

export class ListarCamasQueryDto {
  @ApiPropertyOptional({ enum: EstadoCama, description: 'Filtrar por estado' })
  @IsOptional()
  @IsEnum(EstadoCama)
  estado?: EstadoCama;

  @ApiPropertyOptional({ example: 'UTI', description: 'Filtrar por sector' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sector?: string;
}