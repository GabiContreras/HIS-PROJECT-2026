import { ApiProperty } from '@nestjs/swagger';
import { TurnoSummaryResponseDto } from './turno-summary-response.dto.js';
import { PacienteTurnoResponseDto } from './paciente-turno-response.dto.js';

export class TurnoAgendaResponseDto extends TurnoSummaryResponseDto {
  @ApiProperty({
    type: () => PacienteTurnoResponseDto,
    nullable: true,
    description: 'Paciente asociado al turno. Puede ser nulo si todavía no está asignado.',
    example: null,
  })
  paciente: PacienteTurnoResponseDto | null;
}