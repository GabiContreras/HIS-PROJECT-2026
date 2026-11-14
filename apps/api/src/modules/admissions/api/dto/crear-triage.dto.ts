import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NivelTriage {
  ROJO = 'ROJO', 
  NARANJA = 'NARANJA', 
  AMARILLO = 'AMARILLO', 
  VERDE = 'VERDE', 
  AZUL = 'AZUL', 
}

export class CrearTriageDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', format: 'uuid' })
  @IsUUID('4')
  pacienteId: string;

  @ApiProperty({ enum: NivelTriage, example: NivelTriage.ROJO })
  @IsEnum(NivelTriage)
  nivel: NivelTriage;

  @ApiProperty({ example: 'Dolor precordial agudo y dificultad respiratoria' })
  @IsString()
  @IsNotEmpty()
  motivoConsulta: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', format: 'uuid', required: false })
  @IsOptional()
  @IsUUID('4')
  medicoDestinoId?: string;
}
