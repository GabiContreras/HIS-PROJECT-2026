import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AccountAdminService } from './account-admin.service.js';
import { AuthService } from '../application/auth.service.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentIdentity } from './auth.decorator.js';
import { RolesGuard } from './roles.guard.js';
import { SuperadminGuard } from './superadmin.guard.js';
import { Roles } from './roles.decorator.js';
import { RegistroDto } from './dto/registro.dto.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { RestablecerClaveDto } from './dto/restablecer-clave.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Controller('usuarios')
@ApiTags('Usuarios')
@ApiBearerAuth()
export class UsuariosController {
  constructor(
    private readonly accounts: AccountAdminService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  createStaff(@Body() dto: RegistroDto) {
    return this.auth.createStaff(dto);
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
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.get(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.updateProfile(id, dto, identity);
  }

  @Patch(':id/habilitar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  enableDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.enableDoctor(id, identity);
  }

  @Patch(':id/deshabilitar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.deactivate(id, identity);
  }

  @Patch(':id/restablecer-clave')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestablecerClaveDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.resetPassword(id, dto, identity);
  }
}
