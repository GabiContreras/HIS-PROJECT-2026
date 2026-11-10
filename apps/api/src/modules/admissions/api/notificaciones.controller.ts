import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificacionesService } from '../application/notificaciones.service.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import type { AuthenticatedRequest } from '../../iam/api/authenticated-request.js';

@UseGuards(AuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  async listarMisNotificaciones(@Req() req: AuthenticatedRequest) {
    // El AuthGuard deja la identidad en req.user con el id de la cuenta en `accountId`.
    return await this.notificacionesService.obtenerPorUsuario(req.user.accountId);
  }

  @Patch(':id/leer')
  async marcarLeida(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return await this.notificacionesService.marcarComoLeida(id, req.user.accountId);
  }
}
