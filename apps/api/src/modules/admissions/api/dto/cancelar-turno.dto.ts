import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelarTurnoDto {
  @ApiProperty({
    example: 'El paciente avisó que no puede asistir',
    description: 'Motivo de la cancelación.',
    minLength: 3,
    maxLength: 200,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  motivo: string;
}