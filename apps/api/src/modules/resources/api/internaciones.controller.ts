import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { CamasService } from '../application/camas.service.js';
import { InternacionesFiltroDto } from './dto/internaciones-filtro.dto.js';

@Controller('internaciones')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Internaciones')
@ApiBearerAuth()
export class InternacionesController {
  constructor(private readonly camas: CamasService) {}

  @Get()
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Historial de internaciones filtrable por paciente o cama' })
  listar(@Query() filtro: InternacionesFiltroDto) {
    return this.camas.listarInternaciones(filtro);
  }
}
