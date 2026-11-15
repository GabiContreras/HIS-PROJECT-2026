import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { EspecialidadesService } from '../application/especialidades.service.js';
import {
  AsignarEspecialidadesDto,
  CrearEspecialidadDto,
} from './dto/especialidad.dto.js';

@Controller('especialidades')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Especialidades')
@ApiBearerAuth()
export class EspecialidadesController {
  constructor(private readonly especialidades: EspecialidadesService) {}

  @Get()
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Listar especialidades' })
  @ApiOkResponse({ description: 'Especialidades obtenidas correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  list() {
    return this.especialidades.list();
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Crear una especialidad' })
  @ApiCreatedResponse({ description: 'Especialidad creada correctamente.' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiConflictResponse({ description: 'Ya existe una especialidad con ese nombre.' })
  create(@Body() dto: CrearEspecialidadDto) {
    return this.especialidades.create(dto.nombre);
  }

  @Get('medico/:medicoId')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Consultar las especialidades de un médico' })
  @ApiOkResponse({ description: 'Especialidades obtenidas correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el médico.' })
  delMedico(@Param('medicoId', ParseUUIDPipe) medicoId: string) {
    return this.especialidades.delMedico(medicoId);
  }

  @Put('medico/:medicoId')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Asignar especialidades a un médico',
    description: 'Reemplaza las especialidades actuales del médico.',
  })
  @ApiOkResponse({ description: 'Especialidades actualizadas correctamente.' })
  @ApiBadRequestResponse({ description: 'Alguna especialidad no existe.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el médico.' })
  asignar(
    @Param('medicoId', ParseUUIDPipe) medicoId: string,
    @Body() dto: AsignarEspecialidadesDto,
  ) {
    return this.especialidades.asignar(medicoId, dto.especialidadIds);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Eliminar una especialidad sin médicos asignados' })
  @ApiNoContentResponse({ description: 'Especialidad eliminada correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la especialidad.' })
  @ApiConflictResponse({ description: 'La especialidad está asignada a médicos.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.especialidades.remove(id);
  }
}