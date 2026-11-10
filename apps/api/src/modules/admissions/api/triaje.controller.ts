import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { TriageService } from '../application/triage.service.js';
import { CrearTriageDto } from './dto/crear-triage.dto.js';
import { TriageResponseDto } from './dto/triage-response.dto.js';

@Controller('triaje')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Triaje')
@ApiBearerAuth()
export class TriajeController {
  constructor(private readonly triage: TriageService) {}

  @Post()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO)
  @ApiOperation({
    summary: 'Registrar un triaje',
    description:
      'Ingresa al paciente en la cola de espera de la guardia. El nivel ROJO alerta al médico destino o, si no se indica, a los médicos activos.',
  })
  @ApiCreatedResponse({ type: TriageResponseDto, description: 'Triaje registrado.' })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El rol no puede registrar triajes.' })
  @ApiNotFoundResponse({ description: 'El paciente o el médico destino no existen.' })
  registrar(@Body() dto: CrearTriageDto, @CurrentIdentity() identity: SessionIdentity) {
    return this.triage.registrarTriage(dto, identity.accountId);
  }

  @Get()
  @Roles(RolUsuario.ENFERMERO, RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Consultar la cola de espera',
    description: 'Pacientes en espera ordenados por nivel (ROJO primero) y, dentro del nivel, por orden de llegada.',
  })
  @ApiOkResponse({ type: TriageResponseDto, isArray: true, description: 'Cola de espera.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El rol no puede consultar la cola.' })
  cola() {
    return this.triage.obtenerCola();
  }

  @Patch(':id/atender')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({
    summary: 'Marcar un triaje como atendido',
    description: 'Saca al paciente de la cola de espera.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Identificador del triaje.' })
  @ApiOkResponse({ type: TriageResponseDto, description: 'Triaje marcado como atendido.' })
  @ApiBadRequestResponse({ description: 'El identificador no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'Solo el médico puede marcar un triaje como atendido.' })
  @ApiNotFoundResponse({ description: 'El triaje no existe.' })
  @ApiConflictResponse({ description: 'El triaje ya estaba atendido.' })
  atender(@Param('id', ParseUUIDPipe) id: string) {
    return this.triage.atender(id);
  }
}
