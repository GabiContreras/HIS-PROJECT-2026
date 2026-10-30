import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CamasService } from '../application/camas.service.js';
import { AsignarCamaDto } from './dto/asignar-cama.dto.js';
import { CamaResponseDto } from './dto/cama-response.dto.js';
import { ErrorResponseDto } from './dto/error-response.dto.js';
import { ListarCamasQueryDto } from './dto/listar-camas-query.dto.js';

const CAMA_ID = { name: 'id', description: 'UUID de la cama', format: 'uuid' };

@Controller('camas')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Camas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sesión inválida' })
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Tu rol no permite esta operación' })
export class CamasController {
  constructor(private readonly camas: CamasService) {}

  @Get()
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Mapa de camas',
    description: 'Lista todas las camas con su estado y paciente actual. Admite filtros por estado y sector.',
  })
  @ApiOkResponse({ type: CamaResponseDto, isArray: true })
  listar(@Query() query: ListarCamasQueryDto): Promise<CamaResponseDto[]> {
    return this.camas.listar(query);
  }

  @Get(':id')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Detalle de una cama' })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'La cama no existe' })
  obtener(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.obtener(id);
  }

  @Post(':id/asignar')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Asignar un paciente a una cama',
    description:
      'Valida que la cama esté LIBRE con bloqueo pesimista dentro de una transacción, crea la internación y emite bed.assigned.',
  })
  @ApiParam(CAMA_ID)
  @ApiCreatedResponse({ type: CamaResponseDto, description: 'Cama ocupada e internación creada' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Datos inválidos o médico no indicado/habilitado' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Cama o paciente inexistente' })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'La cama ya fue ocupada, no está libre, o el paciente ya está internado',
  })
  asignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarCamaDto,
    @CurrentIdentity() identity: SessionIdentity,
  ): Promise<CamaResponseDto> {
    return this.camas.asignar(id, dto, identity);
  }

  @Post(':id/alta')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Alta médica',
    description: 'Cierra la internación activa, pasa la cama a EN_LIMPIEZA y emite bed.released.',
  })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'La cama no existe' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'La cama no está OCUPADA' })
  darAlta(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.darAlta(id);
  }

  @Post(':id/limpieza/confirmar')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Confirmar limpieza',
    description: 'EN_LIMPIEZA → LIBRE. Emite bed.cleaned.',
  })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'La cama no existe' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'La cama no está EN_LIMPIEZA' })
  confirmarLimpieza(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.confirmarLimpieza(id);
  }

  @Post(':id/bloquear')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Bloquear cama', description: 'LIBRE → BLOQUEADA (fuera de servicio).' })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'La cama no existe' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Solo se puede bloquear una cama LIBRE' })
  bloquear(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.bloquear(id);
  }

  @Post(':id/desbloquear')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Desbloquear cama', description: 'BLOQUEADA → LIBRE.' })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'La cama no existe' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'La cama no está BLOQUEADA' })
  desbloquear(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.desbloquear(id);
  }
}