import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ResultadoAdministracion } from '../../../../entities/administracion-medicacion.entity.js';

export class RegistrarEjecucionDto {
  @ApiProperty({ enum: ResultadoAdministracion })
  @IsEnum(ResultadoAdministracion)
  resultado: ResultadoAdministracion;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @ApiPropertyOptional({ minLength: 3, maxLength: 500, description: 'Obligatorio si resultado es OMITIDA.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivoOmision?: string;
}
