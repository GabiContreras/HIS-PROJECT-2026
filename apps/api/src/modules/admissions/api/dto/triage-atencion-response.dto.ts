import { ApiProperty } from '@nestjs/swagger';
import { TriageResponseDto } from './triage-response.dto.js';

export class TriageAtencionResponseDto extends TriageResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Turno urgente generado para registrar la atención.',
  })
  turnoId: string;
}