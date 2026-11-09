import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../iam/infrastructure/persistence/entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { BillingService } from '../application/billing.service.js';
import { CargoDetalleDto } from './dto/cargo-detalle.dto.js';

@Controller('billing/cargos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRATIVO)
@ApiTags('Billing')
@ApiBearerAuth()
export class CargosController {
  constructor(private readonly billing: BillingService) {}

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
}