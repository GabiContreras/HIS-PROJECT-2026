import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { RolUsuario } from '../../entities/usuario.entity.js';

export class CrearUsuarioDto {
  @IsString()
  nombre: string;

  @IsString()
  apellido: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(RolUsuario)
  rol: RolUsuario;
}