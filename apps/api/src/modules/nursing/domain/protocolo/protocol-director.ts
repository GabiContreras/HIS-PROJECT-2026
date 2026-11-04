import { PreOpProtocolBuilder } from './pre-op-protocol-builder.js';
import type { ProtocolBuilder } from './protocol-builder.js';
import { type Protocolo, TipoIngreso } from './protocolo.js';
import { RespiratoryProtocolBuilder } from './respiratory-protocol-builder.js';

/**
 * Mapeo simple motivo de ingreso (texto libre, sin tildes ni mayúsculas) -> tipo de ingreso.
 * Para agregar un tipo nuevo: un Builder concreto + una entrada acá + una en `builders`.
 */
const MOTIVOS: ReadonlyArray<{ tipo: TipoIngreso; patron: RegExp }> = [
  { tipo: TipoIngreso.PRE_QUIRURGICO, patron: /cirugia programada|pre[- ]?quirurgic/ },
  { tipo: TipoIngreso.RESPIRATORIO, patron: /neumonia|infeccion respiratoria/ },
];

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Director del patrón Builder: decide qué Builder usar según el tipo de ingreso
 * y dirige la secuencia de ensamblado; el cliente no conoce los Builders concretos.
 */
export class ProtocolDirector {
  private readonly builders: Readonly<Record<TipoIngreso, () => ProtocolBuilder>> = {
    [TipoIngreso.PRE_QUIRURGICO]: () => new PreOpProtocolBuilder(),
    [TipoIngreso.RESPIRATORIO]: () => new RespiratoryProtocolBuilder(),
  };

  /** Devuelve el tipo de ingreso que corresponde al motivo/diagnóstico, o null si no tiene protocolo. */
  resolverTipo(motivoIngreso: string): TipoIngreso | null {
    const texto = normalizar(motivoIngreso);
    return MOTIVOS.find((m) => m.patron.test(texto))?.tipo ?? null;
  }

  construir(tipo: TipoIngreso): Protocolo {
    return this.builders[tipo]().agregarTareasBase().construir();
  }

  /** Atajo: resuelve el tipo por el motivo y arma el protocolo; null si el motivo no tiene protocolo. */
  construirPorMotivo(motivoIngreso: string): Protocolo | null {
    const tipo = this.resolverTipo(motivoIngreso);
    return tipo === null ? null : this.construir(tipo);
  }
}
