import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BloquearCamaDto {
  @ApiProperty({ example: 'Mantenimiento preventivo', minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo: string;
}
