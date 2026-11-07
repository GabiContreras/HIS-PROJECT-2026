import { ApiProperty } from '@nestjs/swagger';
import { TurnoSummaryResponseDto } from './turno-summary-response.dto.js';
import { PacienteTurnoResponseDto } from './paciente-turno-response.dto.js';

export class PromocionStandbyResponseDto {
  @ApiProperty({
    type: () => TurnoSummaryResponseDto,
    description: 'Turno asignado al paciente promovido.',
  })
  turno: TurnoSummaryResponseDto;

  @ApiProperty({
    type: () => PacienteTurnoResponseDto,
    description: 'Paciente promovido desde la lista de espera.',
  })
  paciente: PacienteTurnoResponseDto;
}