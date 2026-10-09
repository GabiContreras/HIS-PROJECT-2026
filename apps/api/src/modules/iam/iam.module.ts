import { Module } from '@nestjs/common';
import { UsuariosModule } from '../../usuarios/usuarios.module.js';

@Module({ imports: [UsuariosModule], exports: [UsuariosModule] })
export class IamModule {}
