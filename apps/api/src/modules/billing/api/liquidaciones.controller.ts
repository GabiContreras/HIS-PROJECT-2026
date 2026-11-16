import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import type { AuthenticatedRequest } from '../../iam/api/authenticated-request.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { LiquidacionesService } from '../application/liquidaciones.service.js';
import { LIMITE_POR_DEFECTO, OFFSET_POR_DEFECTO } from '../domain/filtro-cargos.js';
import {
  CrearLiquidacionDto,
  LiquidacionDetalleDto,
  LiquidacionDto,
  LiquidacionesPaginaDto,
  LiquidacionesQueryDto,
} from './dto/liquidacion.dto.js';

@Controller('billing/liquidaciones')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRATIVO)
@ApiTags('Billing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'El usuario no está autenticado.' })
@ApiForbiddenResponse({ description: 'Solo el rol ADMINISTRATIVO puede usar las liquidaciones.' })
export class LiquidacionesController {
  constructor(private readonly liquidaciones: LiquidacionesService) {}

  @Post()
  @ApiOperation({
    summary: 'Liquidar a un financiador',
    description:
      'Agrupa los cargos PENDIENTE del financiador creados entre desde y hasta (ambos inclusive, en hora de Buenos Aires) con importe a cargo del tercero mayor a cero, que no estén en otra liquidación. Crea la liquidación con el total de esos importes y pasa los cargos a FACTURADO, todo en una transacción. Las liquidaciones no se pueden editar, borrar ni anular.',
  })
  @ApiCreatedResponse({ type: LiquidacionDto, description: 'Liquidación creada.' })
  @ApiBadRequestResponse({
    description:
      'Falta financiadorId, desde o hasta, financiadorId no es un UUID, una fecha no tiene el formato YYYY-MM-DD o no existe, o desde es posterior a hasta.',
  })
  @ApiNotFoundResponse({ description: 'El financiador no existe.' })
  @ApiConflictResponse({
    description: 'No hay cargos para liquidar de ese financiador en el período, o un pedido simultáneo ya los liquidó.',
  })
  crear(@Body() body: CrearLiquidacionDto, @Req() req: AuthenticatedRequest) {
    return this.liquidaciones.crear({ ...body, usuarioId: req.user.accountId });
  }

  @Get()
  @ApiOperation({
    summary: 'Listar liquidaciones',
    description:
      'Devuelve una página de liquidaciones, de la más reciente a la más antigua. El filtro por financiador es opcional.',
  })
  @ApiOkResponse({ type: LiquidacionesPaginaDto, description: 'Página de liquidaciones.' })
  @ApiBadRequestResponse({
    description: 'limit fuera de 1 a 100, offset negativo o no entero, o financiadorId que no es un UUID.',
  })
  list(@Query() query: LiquidacionesQueryDto) {
    return this.liquidaciones.list(
      query.financiadorId,
      query.limit ?? LIMITE_POR_DEFECTO,
      query.offset ?? OFFSET_POR_DEFECTO,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una liquidación',
    description: 'Devuelve la liquidación con los cargos que incluye, sin paginar.',
  })
  @ApiOkResponse({ type: LiquidacionDetalleDto, description: 'Liquidación con sus cargos.' })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiNotFoundResponse({ description: 'La liquidación no existe.' })
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.liquidaciones.detalle(id);
  }
}
