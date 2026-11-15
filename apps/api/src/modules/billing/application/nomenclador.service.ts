import { Inject, Injectable } from '@nestjs/common';

import {
  ImporteResuelto,
  PrestacionCodigo,
  PrestacionNoEncontradaError,
  resolverImporte,
} from '../domain/nomenclador.js';
import {
  NOMENCLADOR_REPOSITORY,
  type NomencladorRepository,
} from '../domain/nomenclador.repository.js';

@Injectable()
export class NomencladorService {
  constructor(
    @Inject(NOMENCLADOR_REPOSITORY)
    private readonly nomenclador: NomencladorRepository,
  ) {}

  async resolve(
    codigo: PrestacionCodigo,
    financiadorId: string | null,
  ): Promise<ImporteResuelto> {
    const prestacion = await this.nomenclador.findPrestacionActiva(codigo);
    if (!prestacion) {
      throw new PrestacionNoEncontradaError(codigo);
    }

    const tarifa = financiadorId
      ? await this.nomenclador.findTarifaActiva(financiadorId, prestacion.id)
      : null;

    return resolverImporte(prestacion, tarifa);
  }
}
