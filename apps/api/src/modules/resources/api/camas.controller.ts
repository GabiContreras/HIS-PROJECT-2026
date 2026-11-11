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
  ApiExtraModels,
  getSchemaPath,
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
@ApiExtraModels(ErrorResponseDto)
@ApiUnauthorizedResponse({
  description: 'Sesión inválida',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Sesión inválida',
      path: '/camas',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
@ApiForbiddenResponse({
  description: 'Tu rol no permite esta operación',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Tu rol no permite esta operación',
      path: '/camas',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
export class CamasController {
  constructor(private readonly camas: CamasService) {}

  @Get()
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Mapa de camas',
    description: 'Lista todas las camas con su estado y paciente actual. Admite filtros por estado y sector.',
  })
  @ApiOkResponse({ type: CamaResponseDto, isArray: true,  description: 'Listado de camas obtenido correctamente.', })
  listar(@Query() query: ListarCamasQueryDto): Promise<CamaResponseDto[]> {
    return this.camas.listar(query);
  }

  @Get(':id')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Detalle de una cama' })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto,description: 'Detalle de la cama obtenido correctamente.', })
  @ApiNotFoundResponse({
  description: 'La cama no existe',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La cama no existe',
      path: '/camas/{id}',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  obtener(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.obtener(id);
  }

  @Post(':id/asignar')
  @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Asignar un paciente a una cama',
    description:
      'Valida que la cama esté LIBRE con bloqueo pesimista dentro de una transacción, crea la internación y emite bed.assigned. Si se informa motivoIngreso, emite además patient.admitted y Enfermería genera el protocolo de atención en segundo plano.',
  })
  @ApiParam(CAMA_ID)
  @ApiCreatedResponse({ type: CamaResponseDto, description: 'Cama ocupada e internación creada' })
  @ApiBadRequestResponse({
  description: 'Datos inválidos o médico no indicado/habilitado',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Los datos enviados no son válidos.',
      path: '/camas/{id}/asignar',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  @ApiNotFoundResponse({
  description: 'Cama o paciente inexistente',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cama o paciente inexistente',
      path: '/camas/{id}/asignar',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  @ApiConflictResponse({
  description: 'La cama ya fue ocupada, no está libre, o el paciente ya está internado',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'La cama ya fue ocupada por otro operador.',
      path: '/camas/{id}/asignar',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
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
  @ApiOkResponse({ type: CamaResponseDto,description: 'Alta de la cama registrada correctamente.',})
  @ApiNotFoundResponse({
  description: 'La cama no existe',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La cama no existe',
      path: '/camas/{id}/alta',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  @ApiConflictResponse({
  description: 'La cama no está OCUPADA',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'La cama no está OCUPADA',
      path: '/camas/{id}/alta',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
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
  @ApiOkResponse({ type: CamaResponseDto,description: 'Limpieza de la cama confirmada correctamente.', })
  @ApiNotFoundResponse({
  description: 'La cama no existe',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La cama no existe',
      path: '/camas/{id}/limpieza/confirmar',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  @ApiConflictResponse({
  description: 'La cama no está EN_LIMPIEZA',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'La cama no está EN_LIMPIEZA',
      path: '/camas/{id}/limpieza/confirmar',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  confirmarLimpieza(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.confirmarLimpieza(id);
  }

  @Post(':id/bloquear')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Bloquear cama', description: 'LIBRE → BLOQUEADA (fuera de servicio).' })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto,description: 'Cama bloqueada correctamente.', })
  @ApiNotFoundResponse({
  description: 'La cama no existe',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La cama no existe',
      path: '/camas/{id}/desbloquear',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  @ApiConflictResponse({
  description: 'Solo se puede bloquear una cama LIBRE',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Solo se puede bloquear una cama LIBRE',
      path: '/camas/{id}/bloquear',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  bloquear(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.bloquear(id);
  }

  @Post(':id/desbloquear')
  @HttpCode(HttpStatus.OK)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Desbloquear cama', description: 'BLOQUEADA → LIBRE.' })
  @ApiParam(CAMA_ID)
  @ApiOkResponse({ type: CamaResponseDto,description: 'Cama desbloqueada correctamente.', })
  @ApiNotFoundResponse({
  description: 'La cama no existe',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La cama no existe',
      path: '/camas/{id}/desbloquear',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  @ApiConflictResponse({
  description: 'La cama no está BLOQUEADA',
  schema: {
    allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
    example: {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'La cama no está BLOQUEADA',
      path: '/camas/{id}/desbloquear',
      timestamp: '2026-11-07T13:30:00.000Z',
    },
  },
})
  desbloquear(@Param('id', ParseUUIDPipe) id: string): Promise<CamaResponseDto> {
    return this.camas.desbloquear(id);
  }
}