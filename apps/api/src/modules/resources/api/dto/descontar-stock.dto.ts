import { IsInt, IsUUID,Min } from 'class-validator';

export class DescontarStockDto {
 @IsUUID('all', { message: 'El ID del insumo debe ser un UUID válido.' })
  insumoId: string;  
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero.' })
  cantidad: number;
}