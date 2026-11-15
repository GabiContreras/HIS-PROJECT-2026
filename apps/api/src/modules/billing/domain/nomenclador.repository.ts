import { PrestacionData, TarifaData } from './nomenclador.js';

export interface NomencladorRepository {
  findPrestacionActiva(codigo: string): Promise<PrestacionData | null>;
  findTarifaActiva(
    financiadorId: string,
    prestacionId: string,
  ): Promise<TarifaData | null>;
}

export const NOMENCLADOR_REPOSITORY = Symbol('NOMENCLADOR_REPOSITORY');
