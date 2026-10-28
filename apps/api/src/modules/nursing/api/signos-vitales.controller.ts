import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { SignosVitalesService } from '../application/signos-vitales.service.js';
import { RegistrarSignoVitalDto } from './dto/registrar-signo-vital.dto.js';
import { SignosVitalesFiltroDto } from './dto/signos-vitales-filtro.dto.js';

@Controller('signos-vitales')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Enfermería - Signos vitales')
@ApiBearerAuth()
export class SignosVitalesController {
  constructor(private readonly signos: SignosVitalesService) {}

  @Get('tipos')
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO)
  @ApiOperation({ summary: 'Tipos de signo vital con unidad y rangos' })
  tipos() {
    return this.signos.tipos();
  }

  @Get()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO)
  @ApiOperation({ summary: 'Últimos registros (100 máx.), opcionalmente de un paciente' })
  list(@Query() filtro: SignosVitalesFiltroDto) {
    return this.signos.listar(filtro.pacienteId);
  }

  @Post()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO)
  @ApiOperation({ summary: 'Registrar un signo vital; marca fuera de rango y emite alerta' })
  register(@Body() dto: RegistrarSignoVitalDto, @CurrentIdentity() identity: SessionIdentity) {
    return this.signos.registrar(dto, identity);
  }
}
