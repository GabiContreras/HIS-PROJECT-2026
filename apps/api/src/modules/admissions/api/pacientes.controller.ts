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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../iam/infrastructure/persistence/entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { PacientesService } from '../application/pacientes.service.js';
import {
  ActualizarCoberturaDto,
  CrearPacienteDto,
} from './dto/crear-paciente.dto.js';
import { PacientesFiltroDto } from './dto/pacientes-filtro.dto.js';
import { PacienteResponseDto } from './dto/paciente-response.dto.js';

@Controller('pacientes')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Pacientes')
@ApiBearerAuth()
export class PacientesController {
  constructor(private readonly pacientes: PacientesService) {}

  @Get()
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Buscar pacientes',
    description: 'Busca pacientes por nombre, apellido o documento.',
  })
  @ApiOkResponse({ type: PacienteResponseDto,isArray: true,description: 'Listado de pacientes obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  list(@Query() filters: PacientesFiltroDto) {
    return this.pacientes.search(filters.q);
  }

  @Get(':id')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Obtener un paciente',
    description: 'Obtiene los datos de un paciente mediante su identificador.',
  })
  @ApiOkResponse({type: PacienteResponseDto,description: 'Paciente obtenido correctamente.' })
  @ApiBadRequestResponse({ description: 'El identificador no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientes.get(id);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Registrar un paciente',
    description: 'Registra un nuevo paciente con sus datos y cobertura médica.',
  })
  @ApiCreatedResponse({ type: PacienteResponseDto,description: 'Paciente registrado correctamente.' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiConflictResponse({ description: 'Ya existe un paciente con ese documento.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  create(@Body() dto: CrearPacienteDto) {
    return this.pacientes.create(dto);
  }

  @Patch(':id/cobertura')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Actualizar la cobertura de un paciente',
    description: 'Modifica el tipo y la entidad de cobertura médica del paciente.',
  })
  @ApiOkResponse({ type: PacienteResponseDto,description: 'Cobertura actualizada correctamente.' })
  @ApiBadRequestResponse({ description: 'Los datos o el identificador no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  updateCoverage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCoberturaDto,
  ) {
    return this.pacientes.updateCoverage(id, dto);
  }
}