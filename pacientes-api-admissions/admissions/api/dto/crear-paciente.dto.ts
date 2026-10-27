import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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
}
