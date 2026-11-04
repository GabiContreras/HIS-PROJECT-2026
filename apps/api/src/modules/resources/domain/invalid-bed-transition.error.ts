import { EstadoCama } from './estado-cama.enum.js';
 
export class InvalidBedTransitionError extends Error {
  constructor(
    public readonly desde: EstadoCama,
    public readonly accion: string,
  ) {
    super(`No se puede ${accion} una cama en estado ${desde}.`);
    this.name = 'InvalidBedTransitionError';
  }
}