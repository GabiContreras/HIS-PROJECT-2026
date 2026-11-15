import { cargoStateFor, EstadoCargo, InvalidCargoTransitionError } from './estado-cargo.js';

export interface CargoParaLiquidar {
  financiadorId: string | null;
  estado: EstadoCargo;
  importeTerceroPesos: number | null;
  createdAt: Date;
  liquidacionId: string | null;
}

export interface VentanaLiquidacion {
  inicio: Date;
  finExclusivo: Date;
}

export function estadosFacturables(): EstadoCargo[] {
  return Object.values(EstadoCargo).filter((estado) => {
    try {
      cargoStateFor(estado).facturar();
      return true;
    } catch (error) {
      if (error instanceof InvalidCargoTransitionError) {
        return false;
      }
      throw error;
    }
  });
}

export const ESTADO_FACTURADO: EstadoCargo = cargoStateFor(EstadoCargo.PENDIENTE).facturar().estado;

export function esCargoLiquidable(
  cargo: CargoParaLiquidar,
  financiadorId: string,
  ventana: VentanaLiquidacion,
): boolean {
  return (
    cargo.financiadorId === financiadorId &&
    estadosFacturables().includes(cargo.estado) &&
    (cargo.importeTerceroPesos ?? 0) > 0 &&
    cargo.liquidacionId === null &&
    cargo.createdAt >= ventana.inicio &&
    cargo.createdAt < ventana.finExclusivo
  );
}

export function totalTerceroPesos(cargos: { importeTerceroPesos: number | null }[]): number {
  const total = cargos.reduce((suma, cargo) => suma + (cargo.importeTerceroPesos ?? 0), 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error('El total de la liquidación no es válido.');
  }
  return total;
}
