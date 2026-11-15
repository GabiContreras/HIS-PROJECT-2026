import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TrasladarCamaDto {
  @ApiProperty({ format: 'uuid', description: 'Cama libre de destino.' })
  @IsUUID()
  camaDestinoId: string;
}
