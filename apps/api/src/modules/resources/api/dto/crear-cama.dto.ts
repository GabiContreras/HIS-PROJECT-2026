import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CrearCamaDto {
  @ApiProperty({ example: 'A-12', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  numero: string;

  @ApiProperty({ format: 'uuid', description: 'Habitación a la que pertenece la cama.' })
  @IsUUID()
  habitacionId: string;
}
