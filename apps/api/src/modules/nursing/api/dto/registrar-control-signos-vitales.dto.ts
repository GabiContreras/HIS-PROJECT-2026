import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID } from 'class-validator';

export class RegistrarControlSignosVitalesDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;

  @ApiProperty({ example: 120, description: 'Presión sistólica en mmHg.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  sistolica: number;

  @ApiProperty({ example: 80, description: 'Presión diastólica en mmHg.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  diastolica: number;

  @ApiProperty({ example: 76, description: 'Frecuencia cardíaca en latidos por minuto.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  frecuenciaCardiaca: number;

  @ApiProperty({ example: 36.8, description: 'Temperatura en °C. Más de 39 °C marca el control como crítico.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  temperatura: number;
}
