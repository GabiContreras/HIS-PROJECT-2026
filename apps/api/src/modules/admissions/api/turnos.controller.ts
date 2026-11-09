
import {Body,Controller,Delete,Get,HttpCode,Param,Patch,Post,Query,UseGuards,} from '@nestjs/common';
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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../iam/infrastructure/persistence/entities/usuario.entity.js';
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
import { SlotDisponibleResponseDto } from './dto/slot-disponible-response.dto.js';
import { TurnoAgendaResponseDto } from './dto/turno-agenda-response.dto.js';
import { TurnoSummaryResponseDto } from './dto/turno-summary-response.dto.js';
import { TurnoTransitionResponseDto } from './dto/turno-transition-response.dto.js';
import { EsperaSummaryResponseDto } from './dto/espera-summary-response.dto.js';

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
  @ApiOperation({
    summary: 'Consultar horarios disponibles',
    description:
      'Obtiene los horarios libres de los médicos activos dentro del período indicado.',
  })
  @ApiOkResponse({type: SlotDisponibleResponseDto,isArray: true,description: 'Listado de horarios disponibles.' })
  @ApiBadRequestResponse({ description: 'El rango de fechas no es válido.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  listAvailable(@Query() filters: TurnosFiltroDto) {
    return this.turnos.listAvailable(
      filters.medicoId,
      filters.desde,
      filters.hasta,
    );
  }

  @Get('agenda')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Consultar agenda de turnos',
    description:
      'Obtiene los turnos del período solicitado. Los médicos solo pueden consultar su propia agenda.',
  })
  @ApiOkResponse({type: TurnoAgendaResponseDto,isArray: true,description: 'Agenda obtenida correctamente.' })
  @ApiBadRequestResponse({ description: 'El rango de fechas no es válido.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({
    description: 'El médico intenta consultar la agenda de otro médico.',
  })
  listAgenda(
    @Query() filters: TurnosFiltroDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.listAgenda(filters, identity);
  }

  @Get('transiciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Consultar transiciones permitidas',
    description:
      'Devuelve los estados a los que puede avanzar un turno según su estado actual.',
  })
  @ApiOkResponse({
   schema: {
     type: 'object',
     description: 'Tabla que indica los estados a los que puede avanzar cada estado actual del turno.',
     additionalProperties: {
       type: 'array',
       items: {
         type: 'string',
         enum: ['DISPONIBLE', 'RESERVADO', 'CONFIRMADO', 'EN_SALA_DE_ESPERA', 'ATENDIDO', 'CANCELADO'],
       },
      },
     example: {
       RESERVADO: ['CONFIRMADO', 'CANCELADO'],
       CONFIRMADO: ['EN_SALA_DE_ESPERA', 'CANCELADO'],
      },
    },
   description: 'Tabla de transiciones permitidas obtenida correctamente.',
})  
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  getTransitions() {
    return this.turnos.getTransitionTable();
  }

  @Post()
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Reservar un turno',
    description: 'Reserva un horario regular para un paciente y un médico.',
  })
  @ApiCreatedResponse({ type: TurnoSummaryResponseDto,description: 'Turno reservado correctamente.' })
  @ApiBadRequestResponse({ description: 'La fecha o el horario no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa agenda.' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  @ApiConflictResponse({ description: 'El horario ya está ocupado.' })
  reserve(
    @Body() dto: ReservarTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.reserve(dto, identity);
  }

  @Get('espera')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Consultar lista de espera',
    description:
      'Obtiene las personas en espera del día indicado. Si no se especifica una fecha, consulta el día actual.',
  })
  @ApiOkResponse({ type: EsperaSummaryResponseDto,isArray: true,description: 'Lista de espera obtenida correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({
    description: 'El médico intenta consultar la lista de otro médico.',
  })
  listWaitlist(
    @Query() filters: EsperaFiltroDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.espera.list(filters, identity);
  }

  @Post('espera')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Agregar paciente a la lista de espera',
    description:
      'Incorpora un paciente a la cola de espera de un médico para una fecha determinada.',
  })
  @ApiCreatedResponse({ type: EsperaSummaryResponseDto,description: 'Paciente agregado a la lista de espera.' })
  @ApiBadRequestResponse({ description: 'La fecha indicada ya pasó.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa agenda.' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  @ApiConflictResponse({
    description:
      'El médico tiene horarios disponibles o el paciente ya está en la lista.',
  })
  joinWaitlist(
    @Body() dto: AgregarEsperaDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.espera.join(dto, identity);
  }

  @Delete('espera/:id')
  @HttpCode(204)
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Retirar paciente de la lista de espera',
    description: 'Retira una inscripción activa de la lista de espera.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la inscripción.' })
  @ApiNoContentResponse({ description: 'Paciente eliminado de la lista de espera correctamente.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa agenda.' })
  @ApiNotFoundResponse({ description: 'No se encontró la inscripción activa.' })
  leaveWaitlist(
    @Param('id') id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.espera.leave(id, identity);
  }

  @Post('entreturno')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Reservar un entreturno',
    description:
      'Reserva un horario urgente de 15 minutos en los minutos :15 o :45.',
  })
  @ApiCreatedResponse({ type: TurnoSummaryResponseDto,description: 'Entreturno reservado correctamente.' })
  @ApiBadRequestResponse({ description: 'La fecha o el horario no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa agenda.' })
  @ApiNotFoundResponse({ description: 'No se encontró el paciente.' })
  @ApiConflictResponse({
    description: 'No existe disponibilidad para reservar el entreturno.',
  })
  reserveUrgent(
    @Body() dto: ReservarTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.reserveUrgent(dto, identity);
  }

  @Patch(':id/transiciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Cambiar estado de un turno',
    description:
      'Realiza una transición válida del estado del turno. Al cancelar, puede promover a una persona de la lista de espera.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del turno.' })
  @ApiOkResponse({ type: TurnoTransitionResponseDto,description: 'Transición de estado del turno realizada correctamente.', })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa agenda.' })
  @ApiNotFoundResponse({ description: 'No se encontró el turno.' })
  @ApiConflictResponse({ description: 'La transición de estado no está permitida.' })
  transition(
    @Param('id') id: string,
    @Body() dto: TransicionTurnoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.turnos.transition(id, dto.estado, identity);
  }
}
