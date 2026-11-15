import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const Trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class RegistrarNotaEnfermeriaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;

  @ApiProperty({ example: 'Valoración de turno' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  titulo: string;

  @ApiProperty({ example: 'Paciente refiere dolor leve en sitio de punción.' })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  detalle: string;
}
