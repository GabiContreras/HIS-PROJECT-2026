import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class TurnosFiltroDto {
  @IsOptional()
  @IsUUID()
  medicoId?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
