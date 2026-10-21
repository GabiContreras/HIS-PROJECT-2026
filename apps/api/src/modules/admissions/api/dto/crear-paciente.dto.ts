
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FechaNoFutura } from './fecha-no-futura.validator.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CrearPacienteDto {
  @ApiProperty({ example: 'Ada', description: 'Nombre del paciente' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El nombre no puede contener solo espacios.' })
  @MaxLength(100)
  nombre: string;


  @ApiProperty({ example: 'Lovelace', description: 'Apellido del paciente' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El apellido no puede contener solo espacios.' })
  @MaxLength(100)
  apellido: string;

  @ApiProperty({ example: '12345678', description: 'Documento único del paciente' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S(?:.*\S)?$/, {
    message: 'El documento no puede tener espacios al principio o al final.',
  })
  @MinLength(1)
  @MaxLength(20)
  documento: string;

  @ApiProperty({ example: '1990-12-10', description: 'Fecha de nacimiento en formato YYYY-MM-DD' })
  @IsDateString()
  @FechaNoFutura()
  fechaNacimiento: string;

  @ApiPropertyOptional({ example: '3564123456', description: 'Teléfono de contacto' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}
