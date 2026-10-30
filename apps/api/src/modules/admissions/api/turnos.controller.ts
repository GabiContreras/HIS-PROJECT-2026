import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CrearTurnoDto } from './dto/crear-turno.dto.js';
import { ReservarTurnoDto } from './dto/reservar-turno.dto.js';
import { TransicionTurnoDto } from './dto/transicion-turno.dto.js';
import { TurnosFiltroDto } from './dto/turnos-filtro.dto.js';
import { TurnosService } from '../application/turnos.service.js';

@Controller('turnos')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Turnos')
@ApiBearerAuth()
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

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

  @Post()
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  createSlot(
    @Body() dto: CrearTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.createSlot(dto, identity);
  }

  @Post('urgencia')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  createUrgentSlot(
    @Body() dto: CrearTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.createUrgentSlot(dto, identity);
  }

  @Patch(':id/reservar')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservarTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.reserve(id, dto, identity);
  }

  @Patch(':id/transiciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransicionTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.transition(id, dto.estado, identity);
  }
}
