import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { BillingService } from '../application/billing.service.js';
import { CargoDetalleDto } from './dto/cargo-detalle.dto.js';
import { CargoEstadoDto } from './dto/cargo-estado.dto.js';

@Controller('billing/cargos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRATIVO)
@ApiTags('Billing')
@ApiBearerAuth()
export class CargosController {
  constructor(private readonly billing: BillingService) { }

  @Get()
  @ApiOperation({
    summary: 'Listar cargos de facturación',
    description: 'Obtiene los cargos registrados, incluyendo los correspondientes a consultas y farmacia. Disponible para usuarios administrativos.',
  })
  @ApiOkResponse({
    type: CargoDetalleDto,
    isArray: true,
    description: 'Listado de cargos obtenido correctamente.',
  })
  @ApiUnauthorizedResponse({
    description: 'El usuario no está autenticado.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos para consultar los cargos.',
  })
  list() {
    return this.billing.list();
  }
  @Get('resumen')
  @ApiOperation({ summary: 'Reporte: cargos agrupados por tipo de cobertura' })
  @ApiOkResponse({ description: 'Totales por cobertura.' })
  resumen() {
    return this.billing.resumen();
  }

  @Patch(':id/pagar')
  @ApiOperation({
    summary: 'Marcar un cargo como pagado',
    description: 'Permitido desde los estados PENDIENTE y FACTURADO.',
  })
  @ApiOkResponse({ type: CargoEstadoDto })
  @ApiNotFoundResponse({ description: 'El cargo no existe.' })
  @ApiConflictResponse({
    description: 'El cargo ya está pagado o anulado.',
  })
  async pagar(@Param('id', ParseUUIDPipe) id: string): Promise<CargoEstadoDto> {
    const { estado } = await this.billing.pagar(id);
    return { id, estado };
  }

  @Patch(':id/anular')
  @ApiOperation({
    summary: 'Anular un cargo',
    description: 'Permitido desde los estados PENDIENTE y FACTURADO.',
  })
  @ApiOkResponse({ type: CargoEstadoDto })
  @ApiNotFoundResponse({ description: 'El cargo no existe.' })
  @ApiConflictResponse({
    description: 'El cargo ya está pagado o anulado.',
  })
  async anular(@Param('id', ParseUUIDPipe) id: string): Promise<CargoEstadoDto> {
    const { estado } = await this.billing.anular(id);
    return { id, estado };
  }
}
