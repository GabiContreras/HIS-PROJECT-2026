import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  async crear(dto: CrearUsuarioDto): Promise<Usuario> {
    const usuario = this.usuariosRepo.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      passwordHash: dto.password, // ⚠️ ver nota abajo
      rol: dto.rol,
    });
    return this.usuariosRepo.save(usuario);
  }

  async listarTodos(): Promise<Usuario[]> {
    return this.usuariosRepo.find({ order: { createdAt: 'DESC' } });
  }
}