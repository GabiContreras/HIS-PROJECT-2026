import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
