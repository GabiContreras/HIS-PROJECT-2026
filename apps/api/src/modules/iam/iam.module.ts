import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { Usuario } from '../../entities/usuario.entity.js';
import { RefreshSession } from '../../entities/refresh-session.entity.js';
import { AuthController } from './api/auth.controller.js';
import { UsuariosController } from './api/usuarios.controller.js';
import { AccountAdminService } from './api/account-admin.service.js';
import { AuthGuard } from './api/auth.guard.js';
import { RolesGuard } from './api/roles.guard.js';
import { SuperadminGuard } from './api/superadmin.guard.js';
import { AuthService } from './application/auth.service.js';
import { PasswordHasher } from './application/password-hasher.js';
import { PasswordPolicyValidator } from './application/password-policy.validator.js';
import { TokenService } from './application/token.service.js';


@Module({
  imports: [TypeOrmModule.forFeature([Usuario, RefreshSession])],
  controllers: [AuthController, UsuariosController],
  providers: [
    AuthService,
    AccountAdminService,
    PasswordHasher,
    PasswordPolicyValidator,
    TokenService,
    AuthGuard,
    RolesGuard,
    SuperadminGuard,
    Reflector,
  ],
  exports: [AuthService, TokenService, AuthGuard, RolesGuard, SuperadminGuard],
})
export class IamModule {}
