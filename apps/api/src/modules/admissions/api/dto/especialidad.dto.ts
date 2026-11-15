import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearEspecialidadDto {
  @ApiProperty({ example: 'Cardiología', description: 'Nombre de la especialidad' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}

export class AsignarEspecialidadesDto {
  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Especialidades del médico. Reemplazan a las actuales.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  especialidadIds: string[];
}