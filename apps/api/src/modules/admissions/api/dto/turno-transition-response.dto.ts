import { ApiProperty } from '@nestjs/swagger';
import { TurnoSummaryResponseDto } from './turno-summary-response.dto.js';
import { PromocionStandbyResponseDto } from './promocion-standby-response.dto.js';

export class TurnoTransitionResponseDto extends TurnoSummaryResponseDto {
  @ApiProperty({
    type: () => PromocionStandbyResponseDto,
    nullable: true,
    description: 'Información del paciente promovido desde la lista de espera. Es nulo si no hubo promoción.',
    example: null,
  })
  promovido: PromocionStandbyResponseDto | null;
}