import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
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
}
