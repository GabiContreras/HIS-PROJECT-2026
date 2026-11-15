import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EstadoEstudio } from '../../../../entities/estudio.entity.js';

export class CrearEstudioDto {
  @ApiProperty({ maxLength: 120, example: 'Radiografía de tórax' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tipo: string;

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  informe: string;

  @ApiPropertyOptional({ enum: EstadoEstudio, default: EstadoEstudio.INFORMADO })
  @IsOptional()
  @IsEnum(EstadoEstudio)
  estado?: EstadoEstudio;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  fecha?: string;
}
