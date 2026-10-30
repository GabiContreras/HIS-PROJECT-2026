import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

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
}