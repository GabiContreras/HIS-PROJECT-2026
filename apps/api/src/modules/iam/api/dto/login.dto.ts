import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Correo electrónico registrado del usuario.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'ClaveSegura123!',
    description: 'Contraseña de acceso del usuario.',
  })
  @IsString()
  password: string;
}