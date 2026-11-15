import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { IndicacionesService } from '../application/indicaciones.service.js';
import { ConfirmarAdministracionDto } from './dto/confirmar-administracion.dto.js';
import { CrearIndicacionDto } from './dto/crear-indicacion.dto.js';
import { IndicacionesFiltroDto } from './dto/indicaciones-filtro.dto.js';
import { CambiarIndicacionDto } from './dto/cambiar-indicacion.dto.js';
import { OmitirDosisDto } from './dto/omitir-dosis.dto.js';
import { RegistrarEjecucionDto } from './dto/registrar-ejecucion.dto.js';

@Controller('indicaciones')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Enfermería - Indicaciones y medicación')
@ApiBearerAuth()
export class IndicacionesController {
  constructor(private readonly indicaciones: IndicacionesService) {}

  @Post()
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico crea una indicación de medicación (frecuencia en horas)' })
  @ApiResponse({ status: 400, description: 'Validación o fecha de fin pasada' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente o insumo inexistente' })
  create(@Body() dto: CrearIndicacionDto, @CurrentIdentity() identity: SessionIdentity) {
    return this.indicaciones.crear(dto, identity);
  }

  @Patch(':id/suspender')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'Suspender o finalizar una indicación con motivo y trazabilidad del médico' })
  @ApiResponse({ status: 400, description: 'Motivo inválido' })
  @ApiResponse({ status: 404, description: 'Indicación inexistente' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarIndicacionDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.indicaciones.cambiarEstado(id, dto, identity);
  }

  @Get()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO)
  @ApiOperation({ summary: 'Indicaciones activas con las dosis programadas de hoy y cuáles ya se administraron' })
  list(@Query() filtro: IndicacionesFiltroDto) {
    return this.indicaciones.listar(filtro.pacienteId);
  }

  @Post(':id/administraciones')
  @Roles(RolUsuario.ENFERMERO)
  @ApiOperation({
    summary: 'El enfermero confirma la dosis vigente (±30 min de la hora programada) y publica medication.administered',
  })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo enfermeros' })
  @ApiResponse({ status: 404, description: 'Indicación inexistente' })
  @ApiResponse({
    status: 409,
    description: 'Dosis ya administrada, fuera de ventana, indicación vencida/no iniciada o sin frecuencia estructurada',
  })
  administer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarAdministracionDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.indicaciones.administrar(id, dto, identity);
  }

  @Post(':id/omisiones')
  @Roles(RolUsuario.ENFERMERO)
  @ApiOperation({ summary: 'Registrar una dosis no administrada con motivo obligatorio' })
  @ApiResponse({ status: 409, description: 'Dosis fuera de ventana, duplicada o indicación inactiva' })
  omitirDosis(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OmitirDosisDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.indicaciones.omitirDosis(id, dto, identity);
  }

  @Post(':id/ejecuciones')
  @Roles(RolUsuario.ENFERMERO)
  @ApiOperation({
    summary: 'Registrar la ejecución u omisión de una indicación no medicamentosa',
    description: 'No publica medication.administered ni descuenta insumos.',
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo cuando el resultado es OMITIDA' })
  @ApiResponse({ status: 409, description: 'La indicación es medicamentosa o no está activa' })
  ejecutar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarEjecucionDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.indicaciones.registrarEjecucion(id, dto, identity);
  }
}
