import { RolUsuario } from '../../../entities/usuario.entity.js';


export const PERSONAL_ADMISION: readonly RolUsuario[] = [
  RolUsuario.ADMINISTRATIVO,
  RolUsuario.RECEPCIONISTA,
];


export const TODO_EL_PERSONAL: readonly RolUsuario[] = Object.values(RolUsuario);