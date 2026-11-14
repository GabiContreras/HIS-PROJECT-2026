import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class MarcarTareaDto {
  @ApiProperty({ example: true, description: 'true marca la tarea como hecha; false la desmarca.' })
  @IsBoolean()
  hecha: boolean;
}
