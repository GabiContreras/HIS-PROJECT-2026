import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ProtocolosFiltroDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pacienteId: string;
}
