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
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import {
  CoverageCatalogService,
  type FinanciadorConPlanes,
} from '../application/coverage-catalog.service.js';
import {
  ActualizarFinanciadorDto,
  ActualizarPlanDto,
  CrearFinanciadorDto,
  CrearPlanDto,
  FinanciadorConPlanesDto,
  FinanciadorResponseDto,
  PlanResponseDto,
} from './dto/financiador.dto.js';
import type { Financiador } from '../../../entities/financiador.entity.js';
import type { Plan } from '../../../entities/plan.entity.js';

@Controller('billing')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRATIVO)
@ApiTags('Billing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'El usuario no está autenticado.' })
@ApiForbiddenResponse({ description: 'Solo el rol ADMINISTRATIVO gestiona el catálogo.' })
export class CoverageCatalogController {
  constructor(private readonly catalog: CoverageCatalogService) {}

  @Get('financiadores')
  @ApiOperation({
    summary: 'Listar financiadores con sus planes',
    description: 'Incluye los dados de baja (activo=false) para poder reactivarlos.',
  })
  @ApiOkResponse({ type: FinanciadorConPlanesDto, isArray: true })
  list(): Promise<FinanciadorConPlanes[]> {
    return this.catalog.listFinanciadoresWithPlanes();
  }

  @Post('financiadores')
  @ApiOperation({ summary: 'Crear un financiador (obra social o prepaga)' })
  @ApiCreatedResponse({ type: FinanciadorResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConflictResponse({ description: 'Ya existe un financiador con ese nombre.' })
  createFinanciador(@Body() dto: CrearFinanciadorDto): Promise<Financiador> {
    return this.catalog.createFinanciador(dto);
  }

  @Patch('financiadores/:id')
  @ApiOperation({ summary: 'Editar un financiador o darlo de baja (activo=false)' })
  @ApiOkResponse({ type: FinanciadorResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'El financiador no existe.' })
  @ApiConflictResponse({ description: 'Ya existe un financiador con ese nombre.' })
  updateFinanciador(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarFinanciadorDto,
  ): Promise<Financiador> {
    return this.catalog.updateFinanciador(id, dto);
  }

  @Post('financiadores/:id/planes')
  @ApiOperation({ summary: 'Crear un plan de un financiador' })
  @ApiCreatedResponse({ type: PlanResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'El financiador no existe.' })
  @ApiConflictResponse({ description: 'El financiador ya tiene un plan con ese nombre.' })
  createPlan(
    @Param('id', ParseUUIDPipe) financiadorId: string,
    @Body() dto: CrearPlanDto,
  ): Promise<Plan> {
    return this.catalog.createPlan(financiadorId, dto);
  }

  @Patch('planes/:id')
  @ApiOperation({ summary: 'Editar un plan o darlo de baja (activo=false)' })
  @ApiOkResponse({ type: PlanResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'El plan no existe.' })
  @ApiConflictResponse({ description: 'El financiador ya tiene un plan con ese nombre.' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlanDto,
  ): Promise<Plan> {
    return this.catalog.updatePlan(id, dto);
  }
}
