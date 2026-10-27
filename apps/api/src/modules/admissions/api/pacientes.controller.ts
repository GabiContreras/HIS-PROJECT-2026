import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { PacientesService } from '../application/pacientes.service.js';
import { CrearPacienteDto } from './dto/crear-paciente.dto.js';
import { PacientesFiltroDto } from './dto/pacientes-filtro.dto.js';

@Controller('pacientes')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Pacientes')
@ApiBearerAuth()
export class PacientesController {
  constructor(private readonly pacientes: PacientesService) {}

  @Get()
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  list(@Query() filters: PacientesFiltroDto) {
    return this.pacientes.search(filters.q);
  }

  @Get(':id')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientes.get(id);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRATIVO)
  create(@Body() dto: CrearPacienteDto) {
    return this.pacientes.create(dto);
  }
}
