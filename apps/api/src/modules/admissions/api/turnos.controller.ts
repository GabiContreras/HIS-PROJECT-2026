import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { AgregarEsperaDto, EsperaFiltroDto } from './dto/espera.dto.js';
import { ReservarTurnoDto } from './dto/reservar-turno.dto.js';
import { TransicionTurnoDto } from './dto/transicion-turno.dto.js';
import { TurnosFiltroDto } from './dto/turnos-filtro.dto.js';
import { EntreturnoStandbyService } from '../application/entreturno-standby.service.js';
import { TurnosService } from '../application/turnos.service.js';

@Controller('turnos')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Turnos')
@ApiBearerAuth()
export class TurnosController {
  constructor(
    private readonly turnos: TurnosService,
    private readonly espera: EntreturnoStandbyService,
  ) {}

  @Get('disponibles')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  listAvailable(@Query() filters: TurnosFiltroDto) {
    return this.turnos.listAvailable(
      filters.medicoId,
      filters.desde,
      filters.hasta,
    );
  }

  @Get('agenda')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  listAgenda(
    @Query() filters: TurnosFiltroDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.listAgenda(filters, identity);
  }

  @Get('transiciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  getTransitions() {
    return this.turnos.getTransitionTable();
  }

  @Post()
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  reserve(
    @Body() dto: ReservarTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.reserve(dto, identity);
  }

  @Get('espera')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  listWaitlist(
    @Query() filters: EsperaFiltroDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.espera.list(filters, identity);
  }

  @Post('espera')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  joinWaitlist(
    @Body() dto: AgregarEsperaDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.espera.join(dto, identity);
  }

  @Delete('espera/:id')
  @HttpCode(204)
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  leaveWaitlist(
    @Param('id') id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.espera.leave(id, identity);
  }

  @Post('entreturno')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  reserveUrgent(
    @Body() dto: ReservarTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.reserveUrgent(dto, identity);
  }

  @Patch(':id/transiciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  transition(
    @Param('id') id: string,
    @Body() dto: TransicionTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.transition(id, dto.estado, identity);
  }
}
