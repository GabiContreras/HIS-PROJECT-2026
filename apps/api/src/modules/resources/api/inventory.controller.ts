
import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  @Post('descontar')
  @Roles(RolUsuario.MEDICO)
  descontarStock(@Body() dto: DescontarStockDto) {
    return this.inventoryService.descontarStock({
      insumoId: dto.insumoId,
      cantidad: dto.cantidad,
    });
  }
}
