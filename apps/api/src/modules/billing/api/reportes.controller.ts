import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { ReportesService } from '../application/reportes.service.js';
import { CargosPorPeriodoQueryDto, PeriodoQueryDto } from './dto/reportes-query.dto.js';
import {
  OcupacionCamasDto,
  ReporteCargosPorMedicoDto,
  ReporteCargosPorPeriodoDto,
  ReporteCargosPorServicioDto,
  ReporteConsumoInsumosDto,
} from './dto/reportes-response.dto.js';

const PERIODO_INVALIDO =
  'Falta desde o hasta, no tienen el formato YYYY-MM-DD, la fecha no existe o desde es posterior a hasta.';

@Controller('billing/reportes')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRATIVO)
@ApiTags('Billing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'El usuario no está autenticado.' })
@ApiForbiddenResponse({ description: 'Solo el rol ADMINISTRATIVO puede consultar los reportes.' })
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('cargos-por-periodo')
  @ApiOperation({
    summary: 'Reporte: cargos por día o por mes',
    description:
      'Cantidad e importes de los cargos creados entre desde y hasta (ambos inclusive, en hora de Buenos Aires), agrupados por día o por mes. Los cargos ANULADO no suman en los totales y se informan aparte en anulados. Los períodos sin cargos no aparecen.',
  })
  @ApiQuery({ name: 'desde', example: '2026-03-01', description: 'YYYY-MM-DD, inclusive.' })
  @ApiQuery({ name: 'hasta', example: '2026-03-31', description: 'YYYY-MM-DD, inclusive.' })
  @ApiQuery({ name: 'agrupacion', required: false, enum: ['dia', 'mes'], description: 'Por defecto, dia.' })
  @ApiOkResponse({ type: ReporteCargosPorPeriodoDto })
  @ApiBadRequestResponse({ description: `${PERIODO_INVALIDO} También si agrupacion no es dia ni mes.` })
  cargosPorPeriodo(@Query() query: CargosPorPeriodoQueryDto) {
    return this.reportes.cargosPorPeriodo(query.desde, query.hasta, query.agrupacion);
  }

  @Get('cargos-por-medico')
  @ApiOperation({
    summary: 'Reporte: cargos por médico',
    description:
      'Cantidad e importes por médico del turno que originó el cargo. Los cargos sin turno (farmacia e internación) se agrupan en la fila "Sin médico asignado" con medicoId null. Los cargos ANULADO no suman y se informan aparte en anulados.',
  })
  @ApiQuery({ name: 'desde', example: '2026-03-01', description: 'YYYY-MM-DD, inclusive.' })
  @ApiQuery({ name: 'hasta', example: '2026-03-31', description: 'YYYY-MM-DD, inclusive.' })
  @ApiOkResponse({ type: ReporteCargosPorMedicoDto })
  @ApiBadRequestResponse({ description: PERIODO_INVALIDO })
  cargosPorMedico(@Query() query: PeriodoQueryDto) {
    return this.reportes.cargosPorMedico(query.desde, query.hasta);
  }

  @Get('cargos-por-servicio')
  @ApiOperation({
    summary: 'Reporte: cargos por servicio',
    description:
      'Cantidad e importes por tipo de atención del cargo (REGULAR, URGENCIA, FARMACIA, INTERNACION). Solo aparecen los tipos con cargos. Los cargos ANULADO no suman y se informan aparte en anulados.',
  })
  @ApiQuery({ name: 'desde', example: '2026-03-01', description: 'YYYY-MM-DD, inclusive.' })
  @ApiQuery({ name: 'hasta', example: '2026-03-31', description: 'YYYY-MM-DD, inclusive.' })
  @ApiOkResponse({ type: ReporteCargosPorServicioDto })
  @ApiBadRequestResponse({ description: PERIODO_INVALIDO })
  cargosPorServicio(@Query() query: PeriodoQueryDto) {
    return this.reportes.cargosPorServicio(query.desde, query.hasta);
  }

  @Get('ocupacion-camas')
  @ApiOperation({
    summary: 'Reporte: ocupación de camas',
    description:
      'Foto del momento de la consulta: el sistema no guarda historial de ocupación, por lo que no admite período.',
  })
  @ApiOkResponse({ type: OcupacionCamasDto })
  ocupacionCamas() {
    return this.reportes.ocupacionCamas();
  }

  @Get('consumo-insumos')
  @ApiOperation({
    summary: 'Reporte: consumo de insumos',
    description:
      'Unidades descontadas por insumo entre desde y hasta (ambos inclusive, en hora de Buenos Aires), con el desglose entre descuentos manuales y administración de medicación. Las reposiciones no cuentan y los insumos sin consumo no aparecen. No informa valores en pesos.',
  })
  @ApiQuery({ name: 'desde', example: '2026-03-01', description: 'YYYY-MM-DD, inclusive.' })
  @ApiQuery({ name: 'hasta', example: '2026-03-31', description: 'YYYY-MM-DD, inclusive.' })
  @ApiOkResponse({ type: ReporteConsumoInsumosDto })
  @ApiBadRequestResponse({ description: PERIODO_INVALIDO })
  consumoInsumos(@Query() query: PeriodoQueryDto) {
    return this.reportes.consumoInsumos(query.desde, query.hasta);
  }
}
