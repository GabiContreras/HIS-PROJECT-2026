
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AccountAdminService } from './account-admin.service.js';
import { AuthService } from '../application/auth.service.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { CurrentIdentity } from './auth.decorator.js';
import { AuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { SuperadminGuard } from './superadmin.guard.js';
import { Roles } from './roles.decorator.js';
import { RegistroDto } from './dto/registro.dto.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { HorarioMedicoDto } from './dto/horario-medico.dto.js';
import { AccountResponseDto } from './dto/account-response.dto.js';
import { MessageResponseDto } from './dto/message-response.dto.js';

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
  @ApiOperation({
    summary: 'Crear cuenta de personal',
    description: 'Registra una cuenta de personal desde el área administrativa.',
  })
  @ApiCreatedResponse({ description: 'Cuenta creada correctamente.',type: MessageResponseDto, })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol administrativo.' })
  @ApiConflictResponse({ description: 'Ya existe una cuenta con ese correo.' })
  createStaff(@Body() dto: RegistroDto) {
    return this.auth.register(dto);
  }

  @Post('administrativos')
  @UseGuards(AuthGuard, SuperadminGuard)
  @ApiOperation({
    summary: 'Crear cuenta administrativa',
    description: 'Permite al superadministrador crear otra cuenta administrativa.',
  })
  @ApiCreatedResponse({
   description: 'Cuenta administrativa creada correctamente.',
   type: AccountResponseDto,
 })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'Se requiere una cuenta superadministradora.' })
  @ApiConflictResponse({ description: 'Ya existe una cuenta con ese correo.' })
  createAdministrator(@Body() dto: CreateAdminDto) {
    return this.accounts.createAdministrator(dto);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Obtiene las cuentas registradas. La inclusión de cuentas dadas de baja está restringida al superadministrador.',
  })
  @ApiQuery({
    name: 'incluirBajas',
    required: false,
    example: 'true',
    description: 'Indica si se deben incluir las cuentas dadas de baja.',
  })
  @ApiOkResponse({
   description: 'Listado de usuarios obtenido correctamente.',
   type: AccountResponseDto,
   isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  list(
    @CurrentIdentity() identity: SessionIdentity,
    @Query('incluirBajas') incluirBajas?: string,
  ) {
    return this.accounts.list(identity, incluirBajas === 'true');
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Consultar usuario',
    description: 'Obtiene los datos públicos de una cuenta por su identificador.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta.' })
  @ApiOkResponse({ description: 'Usuario obtenido correctamente.',type: AccountResponseDto,})
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no tiene permisos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  get(@Param('id') id: string) {
    return this.accounts.get(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Actualizar perfil de usuario',
    description: 'Modifica el nombre o apellido de una cuenta.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta.' })
  @ApiOkResponse({description: 'Perfil actualizado correctamente.',type: AccountResponseDto,})
  @ApiBadRequestResponse({ description: 'No se indicaron datos válidos para actualizar.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede modificar ese perfil.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  @ApiConflictResponse({ description: 'La modificación no está permitida.' })
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.updateProfile(id, dto, identity);
  }

  @Patch(':id/horario')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Actualizar horario médico',
    description: 'Define el horario de atención de un médico.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta médica.' })
  @ApiOkResponse({description: 'Horario actualizado correctamente.',type: AccountResponseDto,})
  @ApiBadRequestResponse({ description: 'El horario indicado no es válido.' })
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede modificar esa cuenta.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  @ApiConflictResponse({ description: 'La cuenta no corresponde a un médico.' })
  updateSchedule(
    @Param('id') id: string,
    @Body() dto: HorarioMedicoDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.updateSchedule(id, dto, identity);
  }

  @Patch(':id/habilitar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Habilitar usuario',
    description: 'Activa una cuenta verificada pendiente de habilitación o deshabilitada.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta.' })
  @ApiOkResponse({description: 'Cuenta habilitada correctamente.',type: AccountResponseDto,})
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa cuenta.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  @ApiConflictResponse({ description: 'La cuenta no puede habilitarse en su estado actual.' })
  enableDoctor(
    @Param('id') id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.enableDoctor(id, identity);
  }

  @Patch(':id/deshabilitar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({
    summary: 'Deshabilitar usuario',
    description: 'Deshabilita una cuenta y revoca sus sesiones activas.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta.' })
  @ApiOkResponse({description: 'Cuenta deshabilitada correctamente.',type: AccountResponseDto,})
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no puede gestionar esa cuenta.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  @ApiConflictResponse({ description: 'No está permitido deshabilitar esa cuenta.' })
  deactivate(
    @Param('id') id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.deactivate(id, identity);
  }

  @Patch(':id/baja')
  @UseGuards(AuthGuard, SuperadminGuard)
  @ApiOperation({
    summary: 'Dar de baja una cuenta',
    description:
      'Realiza una baja lógica. Conserva el historial y requiere resolver los turnos futuros activos de un médico.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta.' })
  @ApiOkResponse({description: 'Cuenta dada de baja correctamente.',type: AccountResponseDto,})
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'Se requiere una cuenta superadministradora.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  @ApiConflictResponse({
    description: 'La cuenta no puede darse de baja en su estado actual o tiene turnos pendientes.',
  })
  dispose(
    @Param('id') id: string,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.accounts.dispose(id, identity);
  }

  @Patch(':id/restaurar')
  @UseGuards(AuthGuard, SuperadminGuard)
  @ApiOperation({
    summary: 'Restaurar cuenta dada de baja',
    description: 'Restaura la cuenta en estado deshabilitado para su posterior habilitación.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta.' })
  @ApiOkResponse({description: 'Cuenta restaurada correctamente.',type: AccountResponseDto,})
  @ApiUnauthorizedResponse({ description: 'Autenticación no válida.' })
  @ApiForbiddenResponse({ description: 'Se requiere una cuenta superadministradora.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  @ApiConflictResponse({ description: 'La cuenta no se encuentra dada de baja.' })
  restore(@Param('id') id: string) {
    return this.accounts.restore(id);
  }
}
