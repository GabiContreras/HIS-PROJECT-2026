import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { ActualizarInsumoDto } from './dto/actualizar-insumo.dto.js';
import { CrearInsumoDto } from './dto/crear-insumo.dto.js';
import { InsumoResponseDto } from './dto/insumo-response.dto.js';
import { DescontarStockDto } from './dto/descontar-stock.dto.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';

@Controller('resources/inventory')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Resources - Inventory')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No está autenticado.' })
@ApiForbiddenResponse({ description: 'No tiene permisos para realizar esta operación.' })
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

  @Post()
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Dar de alta un insumo',
    description: 'Crea un insumo con stock disponible 0. Solo pueden realizar esta operación los usuarios con rol administrativo.',
  })
  @ApiCreatedResponse({ description: 'Insumo creado.', type: InsumoResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConflictResponse({ description: 'Ya existe un insumo con ese nombre.' })
  crear(@Body() dto: CrearInsumoDto) {
    return this.inventoryService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Editar precio, unidad de medida o stock mínimo de un insumo',
    description: 'Actualiza solo los campos enviados y no modifica el stock disponible. Solo pueden realizar esta operación los usuarios con rol administrativo.',
  })
  @ApiOkResponse({ description: 'Insumo actualizado.', type: InsumoResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o sin campos para actualizar.' })
  @ApiNotFoundResponse({ description: 'El insumo indicado no existe.' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarInsumoDto,
  ) {
    return this.inventoryService.actualizar(id, dto);
  }

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