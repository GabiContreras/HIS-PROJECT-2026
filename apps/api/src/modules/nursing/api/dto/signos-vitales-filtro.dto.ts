import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TipoSignoVital } from '../../domain/vital-sign-rules.js';

export class SignosVitalesFiltroDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  internacionId?: string;

  @ApiPropertyOptional({ enum: TipoSignoVital })
  @IsOptional()
  @IsEnum(TipoSignoVital)
  tipo?: TipoSignoVital;
}
