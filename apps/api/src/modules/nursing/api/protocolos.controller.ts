import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { ProtocolosService } from '../application/protocolos.service.js';
import { ProtocolosFiltroDto } from './dto/protocolos-filtro.dto.js';
import { RegistrarIngresoDto } from './dto/registrar-ingreso.dto.js';

@Controller('protocolos')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Enfermería - Protocolos de ingreso')
@ApiBearerAuth()
export class ProtocolosController {
  constructor(private readonly protocolos: ProtocolosService) {}

  @Get()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO)
  @ApiOperation({ summary: 'Protocolos de ingreso de un paciente (más nuevo primero) con sus tareas' })
  list(@Query() filtro: ProtocolosFiltroDto) {
    return this.protocolos.listarPorPaciente(filtro.pacienteId);
  }

  @Post('ingresos')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Registrar un ingreso y generar su protocolo (Builder); idempotente por ingresoId',
    description: 'Punto de entrada manual equivalente al evento patient.admitted, que hoy ningún módulo publica todavía.',
  })
  async registrarIngreso(@Body() dto: RegistrarIngresoDto) {
    const { protocolo } = await this.protocolos.generarParaIngreso(dto);
    return protocolo;
  }
}
