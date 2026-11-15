import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { EstadoIndicacion } from '../../../../entities/indicacion-medica.entity.js';

export class CambiarIndicacionDto {
  @ApiProperty({ enum: [EstadoIndicacion.SUSPENDIDA, EstadoIndicacion.FINALIZADA] })
  @IsIn([EstadoIndicacion.SUSPENDIDA, EstadoIndicacion.FINALIZADA])
  estado: EstadoIndicacion.SUSPENDIDA | EstadoIndicacion.FINALIZADA;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo: string;
}
