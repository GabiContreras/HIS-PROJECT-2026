import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PacientesFiltroDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}
