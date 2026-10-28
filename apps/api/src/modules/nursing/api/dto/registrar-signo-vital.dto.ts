import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsUUID } from 'class-validator';
import { TipoSignoVital } from '../../domain/vital-sign-rules.js';

export class RegistrarSignoVitalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;

  @ApiProperty({ enum: TipoSignoVital, example: TipoSignoVital.TEMPERATURA })
  @IsEnum(TipoSignoVital)
  tipo: TipoSignoVital;

  @ApiProperty({ example: 38.2, description: 'Valor numérico en la unidad del tipo (ver GET /signos-vitales/tipos).' })
  @IsNumber({ maxDecimalPlaces: 2 })
  valor: number;
}
