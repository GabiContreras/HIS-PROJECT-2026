import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoverageType } from '../../../../shared/events/coverage-type.js';
import { FechaNoFutura } from './fecha-no-futura.validator.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPacienteDto {
  @ApiProperty({ example: 'Ada', description: 'Nombre del paciente' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'Lovelace', description: 'Apellido del paciente' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ example: '12345678', description: 'Documento único del paciente (7 a 9 dígitos)' })
  @Transform(trim)
  @Matches(/^\d{7,9}$/, {
    message: 'El documento debe tener entre 7 y 9 dígitos.',
  })
  documento: string;

  @ApiProperty({ example: '1990-12-10', description: 'Fecha de nacimiento en formato YYYY-MM-DD' })
  @IsDateString()
  @FechaNoFutura()
  fechaNacimiento: string;

  @ApiPropertyOptional({ example: '3564123456', description: 'Teléfono de contacto' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^[0-9+\-\s()]{6,20}$/, {
    message: 'El teléfono solo admite números, espacios, +, - y paréntesis.',
  })
  telefono?: string;

  @ApiProperty({ enum: CoverageType, description: 'Tipo de cobertura del paciente' })
  @IsEnum(CoverageType, {
    message: 'La cobertura debe ser OBRA_SOCIAL_PUBLICA, MEDICINA_PREPAGA o PARTICULAR.',
  })
  tipoCobertura: CoverageType;

  @ApiPropertyOptional({ description: 'Prepaga u obra social. Obligatoria en prepaga.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  entidadCobertura?: string;
}

export class ActualizarCoberturaDto {
  @ApiProperty({ enum: CoverageType, description: 'Tipo de cobertura del paciente' })
  @IsEnum(CoverageType, {
    message: 'La cobertura debe ser OBRA_SOCIAL_PUBLICA, MEDICINA_PREPAGA o PARTICULAR.',
  })
  tipoCobertura: CoverageType;

  @ApiPropertyOptional({ description: 'Prepaga u obra social. Obligatoria en prepaga.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  entidadCobertura?: string;
}