import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { NotificacionesService } from '../application/notificaciones.service.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import type { AuthenticatedRequest } from '../../iam/api/authenticated-request.js';
import { NotificacionResponseDto } from './dto/notificacion-response.dto.js';

@UseGuards(AuthGuard)
@Controller('notificaciones')
@ApiTags('Notificaciones')
@ApiBearerAuth()
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las notificaciones del usuario autenticado, de la más reciente a la más antigua' })
  @ApiQuery({ name: 'soloNoLeidas', required: false, type: Boolean, description: 'Si es true, devuelve solo las notificaciones no leídas' })
  @ApiOkResponse({ type: NotificacionResponseDto, isArray: true })
  async listarMisNotificaciones(@Req() req: AuthenticatedRequest, @Query('soloNoLeidas') soloNoLeidas?: string) {
    // El AuthGuard deja la identidad en req.user con el id de la cuenta en `accountId`.
    return await this.notificacionesService.obtenerPorUsuario(req.user.accountId, soloNoLeidas === 'true');
  }

  @Patch(':id/leer')
  @ApiOperation({ summary: 'Marcar como leída una notificación propia' })
  @ApiOkResponse({ type: NotificacionResponseDto })
  @ApiNotFoundResponse({ description: 'La notificación no existe o pertenece a otro usuario' })
  async marcarLeida(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return await this.notificacionesService.marcarComoLeida(id, req.user.accountId);
  }
}
