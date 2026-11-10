import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { HistoriaClinicaService } from '../application/historia-clinica.service.js';
import {
  RegistrarAlergiaDto,
  RegistrarAntecedenteFamiliarDto,
  RegistrarEstudioDto,
  RegistrarEvolucionDto,
} from './dto/registros-clinicos.dto.js';

@Controller('historia-clinica')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('HCE - Historia clínica')
@ApiBearerAuth()
export class HistoriaClinicaController {
  constructor(private readonly historia: HistoriaClinicaService) {}

  @Get(':pacienteId')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO)
  @ApiOperation({
    summary: 'Historia clínica del paciente: ficha demográfica, alergias, antecedentes familiares, evoluciones y estudios',
    description: 'Cada sección viene ordenada del registro más nuevo al más viejo.',
  })
  @ApiResponse({ status: 400, description: 'pacienteId inválido' })
  @ApiResponse({ status: 403, description: 'Solo médicos y enfermeros' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  get(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.historia.obtener(pacienteId);
  }

  @Post(':pacienteId/alergias')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra una alergia del paciente (inmutable)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  alergia(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarAlergiaDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarAlergia(pacienteId, dto.sustancia, dto.reaccion, identity);
  }

  @Post(':pacienteId/antecedentes-familiares')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra un antecedente familiar del paciente (inmutable)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  antecedente(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarAntecedenteFamiliarDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarAntecedenteFamiliar(pacienteId, dto.parentesco, dto.descripcion, identity);
  }

  @Post(':pacienteId/evoluciones')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra una evolución médica (inmutable, con autor y fecha del servidor)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  evolucion(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarEvolucionDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarEvolucion(pacienteId, dto.nota, identity);
  }

  @Post(':pacienteId/estudios')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra el resultado de un estudio para visualizarlo en la historia (inmutable)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  estudio(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarEstudioDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarEstudio(pacienteId, dto.tipo, dto.resultado, identity);
  }
}
