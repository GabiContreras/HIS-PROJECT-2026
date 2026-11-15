import { PrestacionCodigo } from './nomenclador.js';
import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';

export interface BillingStrategy {
  readonly tipoAtencion: TipoAtencionFacturable;
  readonly prestacion: PrestacionCodigo;
}
