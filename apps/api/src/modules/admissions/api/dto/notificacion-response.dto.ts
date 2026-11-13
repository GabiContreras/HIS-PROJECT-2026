import { ApiProperty } from '@nestjs/swagger';

export class NotificacionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Cuenta que recibe la notificación' })
  destinatarioId: string;

  @ApiProperty({ example: 'SIGNOS_VITALES_ALERTA' })
  tipo: string;

  @ApiProperty({ example: 'ALTA', description: 'Prioridad de la notificación (por defecto MEDIA)' })
  prioridad: string;

  @ApiProperty()
  mensaje: string;

  @ApiProperty()
  leida: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
