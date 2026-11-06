import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NivelTriage {
  ROJO = 'ROJO', 
  NARANJA = 'NARANJA', 
  AMARILLO = 'AMARILLO', 
  VERDE = 'VERDE', 
  AZUL = 'AZUL', 
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

  @ApiProperty({ example: 'uuid-del-medico', required: false })
  @IsString()
  @IsOptional()
  medicoDestinoId?: string;
}