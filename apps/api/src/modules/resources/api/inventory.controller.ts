import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { DescontarStockDto } from './dto/descontar-stock.dto.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolUsuario } from '../../iam/infrastructure/persistence/entities/usuario.entity.js';

@Controller('resources/inventory')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Resources - Inventory')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No está autenticado.' })
@ApiForbiddenResponse({ description: 'No tiene permisos para realizar esta operación.' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('descontar')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({
    summary: 'Descontar stock de un insumo',
    description: 'Descuenta una cantidad del stock disponible. Solo pueden realizar esta operación los usuarios con rol médico.',
  })
  @ApiCreatedResponse({
    description: 'Stock descontado correctamente.',
    schema: {
      example: {
        insumoId: '550e8400-e29b-41d4-a716-446655440000',
        cantidadDescontada: 3,
        cantidadRestante: 7,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'La cantidad debe ser un entero positivo.',
  })
  @ApiNotFoundResponse({
    description: 'El insumo indicado no existe.',
  })
  @ApiConflictResponse({
    description: 'No hay stock suficiente para realizar el descuento.',
  })
  descontarStock(@Body() dto: DescontarStockDto) {
    return this.inventoryService.descontarStock({
      insumoId: dto.insumoId,
      cantidad: dto.cantidad,
    });
  }
}