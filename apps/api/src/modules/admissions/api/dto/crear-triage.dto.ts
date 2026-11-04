import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NivelTriage {
  ROJO = 'ROJO',       // Riesgo vital inmediato
  NARANJA = 'NARANJA', // Muy urgente
  AMARILLO = 'AMARILLO',// Urgente
  VERDE = 'VERDE',     // Menos urgente
  AZUL = 'AZUL',       // No urgente
}

export class CrearTriageDto {
  @ApiProperty({ example: 'uuid-del-paciente' })
  @IsString()
  @IsNotEmpty()
  pacienteId: string;

  @ApiProperty({ enum: NivelTriage, example: NivelTriage.ROJO })
  @IsEnum(NivelTriage)
  nivel: NivelTriage;

  @ApiProperty({ example: 'Dolor precordial agudo y dificultad respiratoria' })
  @IsString()
  @IsNotEmpty()
  motivoConsulta: string;
}