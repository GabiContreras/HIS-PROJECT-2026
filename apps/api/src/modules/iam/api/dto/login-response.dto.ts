import { ApiProperty } from '@nestjs/swagger';
import { AccountResponseDto } from './account-response.dto.js';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Token de acceso para autenticar las solicitudes.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Datos públicos de la cuenta autenticada.',
    type: AccountResponseDto,
  })
  account: AccountResponseDto;
}