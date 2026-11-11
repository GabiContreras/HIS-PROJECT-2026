import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const texto = value.trim();
  return texto === '' ? undefined : texto;
};

export class AsignarCamaDto {
  @ApiProperty({
    description: 'ID del paciente a internar',
    example: '3f2b8c1e-5d7a-4c1b-9a62-0e8f6d2a1b34',
  })
  @IsUUID('4', { message: 'pacienteId debe ser un UUID válido.' })
  pacienteId: string;

  @ApiPropertyOptional({
    description:
      'Médico responsable. Si quien asigna es MEDICO se usa su propia cuenta; si es ADMINISTRATIVO es obligatorio.',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @IsOptional()
  @IsUUID('4', { message: 'medicoId debe ser un UUID válido.' })
  medicoId?: string;

  @ApiPropertyOptional({
    description:
      'Motivo o diagnóstico inicial del ingreso. Si se informa, se guarda en la internación y se publica patient.admitted para que Enfermería genere el protocolo de atención ("cirugía programada" o "neumonía" / "infección respiratoria").',
    example: 'Cirugía programada',
    minLength: 3,
    maxLength: 200,
  })
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString({ message: 'motivoIngreso debe ser un texto.' })
  @MinLength(3, { message: 'motivoIngreso debe tener al menos 3 caracteres.' })
  @MaxLength(200, { message: 'motivoIngreso no puede superar los 200 caracteres.' })
  motivoIngreso?: string;
}
