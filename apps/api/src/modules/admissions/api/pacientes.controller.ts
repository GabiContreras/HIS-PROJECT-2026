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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { PacientesService } from '../application/pacientes.service.js';
import { ActualizarCoberturaDto, CrearPacienteDto } from './dto/crear-paciente.dto.js';
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
  @ApiOperation({ summary: 'Registrar un paciente' })
  @ApiCreatedResponse({ description: 'Paciente registrado correctamente.' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiConflictResponse({ description: 'Ya existe un paciente con ese documento.' })
  create(@Body() dto: CrearPacienteDto) {
    return this.pacientes.create(dto);
  }

  @Patch(':id/cobertura')
  @Roles(RolUsuario.ADMINISTRATIVO)
  updateCoverage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCoberturaDto,
  ) {
    return this.pacientes.updateCoverage(id, dto);
  }
}