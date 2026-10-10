import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AccountAdminService } from './account-admin.service.js';
import { AuthService } from '../application/auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { SuperadminGuard } from './superadmin.guard.js';
import { Roles } from './roles.decorator.js';
import { RegistroDto } from './dto/registro.dto.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly accounts: AccountAdminService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  createStaff(@Body() dto: RegistroDto) {
    return this.auth.register(dto);
  }

  @Post('administrativos')
  @UseGuards(AuthGuard, SuperadminGuard)
  createAdministrator(@Body() dto: CreateAdminDto) {
    return this.accounts.createAdministrator(dto);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  list() {
    return this.accounts.list();
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  get(@Param('id') id: string) {
    return this.accounts.get(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  updateProfile(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.accounts.updateProfile(id, dto);
  }

  @Patch(':id/habilitar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  enableDoctor(@Param('id') id: string) {
    return this.accounts.enableDoctor(id);
  }

  @Patch(':id/deshabilitar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  deactivate(@Param('id') id: string) {
    return this.accounts.deactivate(id);
  }
}
