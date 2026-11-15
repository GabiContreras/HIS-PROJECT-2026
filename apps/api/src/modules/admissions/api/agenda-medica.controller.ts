import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { AgendaService } from '../application/agenda.service.js';
import {
  ActualizarAgendaDto,
  CrearExcepcionDto,
} from './dto/agenda-medica.dto.js';

@Controller('agenda-medica')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Agenda médica')
@ApiBearerAuth()
export class AgendaMedicaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get('excepciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Listar excepciones de agenda',
    description: 'Ausencias y feriados. Con medicoId incluye también los feriados de toda la clínica.',
  })
  @ApiQuery({ name: 'medicoId', required: false })
  @ApiOkResponse({ description: 'Excepciones obtenidas correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  listarExcepciones(
    @Query('medicoId') medicoId: string | undefined,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    const filtro =
      identity.rol === RolUsuario.MEDICO ? identity.accountId : medicoId;
    return this.agenda.listarExcepciones(filtro);
  }

  @Post('excepciones')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Crear una excepción de agenda',
    description: 'Registra una ausencia de un médico o un feriado de toda la clínica.',
  })
  @ApiCreatedResponse({ description: 'Excepción creada correctamente.' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el médico.' })
  @ApiConflictResponse({ description: 'Ya existe una excepción para esa fecha.' })
  crearExcepcion(@Body() dto: CrearExcepcionDto) {
    return this.agenda.crearExcepcion(dto);
  }

  @Delete('excepciones/:id')
  @HttpCode(204)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Eliminar una excepción de agenda' })
  @ApiNoContentResponse({ description: 'Excepción eliminada correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la excepción.' })
  eliminarExcepcion(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenda.eliminarExcepcion(id);
  }

  @Get(':medicoId')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Consultar la agenda semanal de un médico',
    description: 'Los médicos solo pueden consultar la propia.',
  })
  @ApiOkResponse({ description: 'Agenda obtenida correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El médico intenta consultar la agenda de otro.' })
  @ApiNotFoundResponse({ description: 'No se encontró el médico.' })
  obtener(
    @Param('medicoId', ParseUUIDPipe) medicoId: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    if (identity.rol === RolUsuario.MEDICO && identity.accountId !== medicoId) {
      throw new ForbiddenException('Solo podés consultar tu propia agenda.');
    }
    return this.agenda.obtener(medicoId);
  }

  @Put(':medicoId')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Definir la agenda semanal de un médico',
    description: 'Reemplaza los bloques de atención. Sin bloques, rige su horario general todos los días.',
  })
  @ApiOkResponse({ description: 'Agenda actualizada correctamente.' })
  @ApiBadRequestResponse({ description: 'Los bloques no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el médico.' })
  reemplazar(
    @Param('medicoId', ParseUUIDPipe) medicoId: string,
    @Body() dto: ActualizarAgendaDto,
  ) {
    return this.agenda.reemplazar(medicoId, dto.bloques);
  }
}