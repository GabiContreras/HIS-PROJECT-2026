export class DocumentoDuplicadoError extends Error {
  constructor() {
    super('Ya existe un paciente con ese documento.');
    this.name = 'DocumentoDuplicadoError';
  }
}