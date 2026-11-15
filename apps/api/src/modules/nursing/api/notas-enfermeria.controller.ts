import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { NotasEnfermeriaService } from '../application/notas-enfermeria.service.js';
import { RegistrarNotaEnfermeriaDto } from './dto/registrar-nota-enfermeria.dto.js';

@Controller('notas-enfermeria')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Enfermería - Notas')
@ApiBearerAuth()
export class NotasEnfermeriaController {
  constructor(private readonly notas: NotasEnfermeriaService) {}

  @Post()
  @Roles(RolUsuario.ENFERMERO)
  @ApiOperation({ summary: 'Registrar una nota de enfermería inmutable en la historia clínica del paciente' })
  @ApiResponse({ status: 400, description: 'Validación fallida' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  registrar(@Body() dto: RegistrarNotaEnfermeriaDto, @CurrentIdentity() identity: SessionIdentity) {
    return this.notas.registrar(dto, identity);
  }
}
