import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { NotificacionesService } from '../application/notificaciones.service.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';

@UseGuards(AuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  async listarMisNotificaciones(@Req() req: any) {
    const usuarioId = req.user?.id || req.user?.sub;
    return await this.notificacionesService.obtenerPorUsuario(usuarioId);
  }

  @Patch(':id/leer')
  async marcarLeida(@Param('id') id: string) {
    return await this.notificacionesService.marcarComoLeida(id);
  }
}