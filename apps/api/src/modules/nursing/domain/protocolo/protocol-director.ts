import { PreOpProtocolBuilder } from './pre-op-protocol-builder.js';
import type { ProtocolBuilder } from './protocol-builder.js';
import { type Protocolo, TipoIngreso } from './protocolo.js';
import { RespiratoryProtocolBuilder } from './respiratory-protocol-builder.js';

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

export class ProtocolDirector {
  private readonly builders: Readonly<Record<TipoIngreso, () => ProtocolBuilder>> = {
    [TipoIngreso.PRE_QUIRURGICO]: () => new PreOpProtocolBuilder(),
    [TipoIngreso.RESPIRATORIO]: () => new RespiratoryProtocolBuilder(),
  };

  resolverTipo(motivoIngreso: string): TipoIngreso | null {
    const texto = normalizar(motivoIngreso);
    return MOTIVOS.find((m) => m.patron.test(texto))?.tipo ?? null;
  }

  construir(tipo: TipoIngreso): Protocolo {
    return this.builders[tipo]().agregarTareasBase().construir();
  }

  construirPorMotivo(motivoIngreso: string): Protocolo | null {
    const tipo = this.resolverTipo(motivoIngreso);
    return tipo === null ? null : this.construir(tipo);
  }
}
