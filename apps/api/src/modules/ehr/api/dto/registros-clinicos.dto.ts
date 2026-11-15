import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Quita espacios de los extremos antes de validar, para que "   " no cuente como texto. */
const Trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class RegistrarAlergiaDto {
  @ApiProperty({ example: 'Penicilina', description: 'Sustancia a la que el paciente es alérgico.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  sustancia: string;

  @ApiProperty({ example: 'Urticaria y dificultad respiratoria', description: 'Reacción que produce.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reaccion: string;
}

export class RegistrarAntecedenteFamiliarDto {
  @ApiProperty({ example: 'Madre', description: 'Parentesco del familiar.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  parentesco: string;

  @ApiProperty({ example: 'Diabetes tipo 2', description: 'Antecedente o patología del familiar.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  descripcion: string;
}

export class RegistrarEvolucionDto {
  @ApiProperty({ example: 'Paciente afebril, buena tolerancia oral. Se continúa el tratamiento.', description: 'Nota de evolución médica.' })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  nota: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Turno relacionado con la evolución.' })
  @IsOptional()
  @IsUUID()
  turnoId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Internación relacionada con la evolución.' })
  @IsOptional()
  @IsUUID()
  internacionId?: string;
}

export class RectificarRegistroDto {
  @ApiProperty({ example: 'Se corrige la dosis consignada; la dosis correcta es 250 mg.', maxLength: 4000 })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  motivo: string;
}

export class RegistrarEstudioDto {
  @ApiProperty({ example: 'Radiografía de tórax', description: 'Tipo de estudio realizado.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tipo: string;

  @ApiProperty({ example: 'Sin infiltrados. Silueta cardíaca normal.', description: 'Resultado o informe del estudio.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  resultado: string;
}
