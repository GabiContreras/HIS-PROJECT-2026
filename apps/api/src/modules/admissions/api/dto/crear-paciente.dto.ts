import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CoverageType } from '../../../../shared/events/coverage-type.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPacienteDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellido: string;

  @Transform(trim)
  @Matches(/^\d{7,9}$/, {
    message: 'El documento debe tener entre 7 y 9 dígitos.',
  })
  documento: string;

  @IsDateString()
  fechaNacimiento: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^[0-9+\-\s()]{6,20}$/, {
    message: 'El teléfono solo admite números, espacios, +, - y paréntesis.',
  })
  telefono?: string;

  @IsEnum(CoverageType, {
    message: 'La cobertura debe ser OBRA_SOCIAL_PUBLICA, MEDICINA_PREPAGA o PARTICULAR.',
  })
  tipoCobertura: CoverageType;

  /** Prepaga u obra social. Obligatoria en prepaga; se ignora en particular. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  entidadCobertura?: string;
}

export class ActualizarCoberturaDto {
  @IsEnum(CoverageType, {
    message: 'La cobertura debe ser OBRA_SOCIAL_PUBLICA, MEDICINA_PREPAGA o PARTICULAR.',
  })
  tipoCobertura: CoverageType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  entidadCobertura?: string;
}
