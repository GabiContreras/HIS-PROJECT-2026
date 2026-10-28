
import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { DescontarStockDto } from './dto/descontar-stock.dto.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';

@Controller('resources/inventory')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Resources - Inventory')
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Lista los insumos con su stock disponible (orden alfabético)' })
  @ApiResponse({ status: 200, description: 'Arreglo de { id, nombre, unidadMedida, cantidadDisponible }' })
  @ApiResponse({ status: 401, description: 'Sin sesión válida' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso' })
  listar() {
    return this.inventoryService.listar();
  }

  @Post('descontar')
  @Roles(RolUsuario.MEDICO)
  descontarStock(@Body() dto: DescontarStockDto) {
    return this.inventoryService.descontarStock({
      insumoId: dto.insumoId,
      cantidad: dto.cantidad,
    });
  }
}
