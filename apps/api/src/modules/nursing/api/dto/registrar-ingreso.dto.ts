import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegistrarIngresoDto {
  @ApiProperty({ format: 'uuid', description: 'Identificador del ingreso/internación; reenviarlo no duplica el protocolo.' })
  @IsUUID()
  ingresoId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;

  @ApiProperty({ example: 'Cirugía programada', description: 'Motivo o diagnóstico inicial: "cirugía programada", "neumonía" o "infección respiratoria".' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  motivoIngreso: string;
}
