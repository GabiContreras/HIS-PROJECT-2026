import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmarAdministracionDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'Paciente refiere dolor leve.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
