import { ApiProperty } from '@nestjs/swagger';
import { EstadoCuenta, RolUsuario } from '../../../../entities/usuario.entity.js';

export class AccountResponseDto {
  @ApiProperty({
    description: 'Identificador único de la cuenta.',
    example: 'a1b2c3d4-e5f6-7890-abcd-123456789012',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del usuario.',
    example: 'María',
  })
  nombre: string;

  @ApiProperty({
    description: 'Apellido del usuario.',
    example: 'Gómez',
  })
  apellido: string;

  @ApiProperty({
    description: 'Correo electrónico de la cuenta.',
    example: 'maria.gomez@hospital.com',
  })
  email: string;

  @ApiProperty({
    description: 'Rol asignado a la cuenta.',
    enum: RolUsuario,
    example: RolUsuario.MEDICO,
  })
  rol: RolUsuario;

  @ApiProperty({
    description: 'Estado actual de la cuenta.',
    enum: EstadoCuenta,
    example: EstadoCuenta.ACTIVO,
  })
  estado: EstadoCuenta;

  @ApiProperty({
    description: 'Indica si la cuenta tiene permisos de superadministrador.',
    example: false,
  })
  esSuperadmin: boolean;

    @ApiProperty({
    description: 'Hora de inicio de atención del médico.',
    example: '08:00',
    required: false,
  })
  horaInicio?: string;

  @ApiProperty({
    description: 'Hora de finalización de atención del médico.',
    example: '16:00',
    required: false,
  })
  horaFin?: string;

    @ApiProperty({
    description: 'Fecha y hora en que se dio de baja la cuenta.',
    example: '2026-11-07T13:30:00.000Z',
    required: false,
    nullable: true,
  })
  dadoDeBajaEn?: string | null;
}