import { PreOpProtocolBuilder } from './pre-op-protocol-builder.js';
import { ProtocolDirector } from './protocol-director.js';
import { Protocolo, TipoIngreso } from './protocolo.js';
import { RespiratoryProtocolBuilder } from './respiratory-protocol-builder.js';

describe('PreOpProtocolBuilder', () => {
  it('arma las tareas exactas de la HU 2.1 (escenario 1)', () => {
    const protocolo = new PreOpProtocolBuilder().agregarTareasBase().construir();
    expect(protocolo.tipo).toBe(TipoIngreso.PRE_QUIRURGICO);
    expect(protocolo.tareas.map((t) => t.descripcion)).toEqual([
      'Verificar ayuno de 8 horas',
      'Colocar vía intravenosa periférica',
      'Realizar control de signos vitales cada 2 horas',
    ]);
    expect(protocolo.tareas.map((t) => t.orden)).toEqual([1, 2, 3]);
    expect(protocolo.tareas[2]?.frecuenciaHoras).toBe(2);
    expect(protocolo.tareas[0]?.frecuenciaHoras).toBeNull();
  });

  it('permite agregar tareas extra y se reinicia tras construir()', () => {
    const builder = new PreOpProtocolBuilder();
    const extendido = builder.agregarTareasBase().agregarTarea('Tarea extra', 4).construir();
    expect(extendido.tareas).toHaveLength(4);
    expect(builder.agregarTareasBase().construir().tareas).toHaveLength(3);
  });

  it('rechaza descripción vacía y frecuencia inválida', () => {
    const builder = new PreOpProtocolBuilder();
    expect(() => builder.agregarTarea('  ')).toThrow();
    expect(() => builder.agregarTarea('x', 0)).toThrow();
    expect(() => builder.agregarTarea('x', 1.5)).toThrow();
  });

  it('no permite construir un protocolo sin tareas', () => {
    expect(() => new PreOpProtocolBuilder().construir()).toThrow();
  });
});

describe('RespiratoryProtocolBuilder', () => {
  it('arma las tareas de la HU 2.1 (escenario 2)', () => {
    const protocolo = new RespiratoryProtocolBuilder().agregarTareasBase().construir();
    expect(protocolo.tipo).toBe(TipoIngreso.RESPIRATORIO);
    expect(protocolo.tareas.map((t) => t.descripcion)).toEqual([
      'Monitoreo de saturación de oxígeno continuo',
      'Indicación de aislamiento de contacto y gotas',
    ]);
  });
});

describe('Protocolo', () => {
  it('es inmutable', () => {
    const protocolo = new PreOpProtocolBuilder().agregarTareasBase().construir();
    expect(Object.isFrozen(protocolo)).toBe(true);
    expect(Object.isFrozen(protocolo.tareas)).toBe(true);
    expect(Object.isFrozen(protocolo.tareas[0])).toBe(true);
    expect(protocolo).toBeInstanceOf(Protocolo);
  });
});

describe('ProtocolDirector', () => {
  const director = new ProtocolDirector();

  it.each([
    ['Cirugía programada', TipoIngreso.PRE_QUIRURGICO],
    ['cirugia programada de rodilla', TipoIngreso.PRE_QUIRURGICO],
    ['Pre-quirúrgico', TipoIngreso.PRE_QUIRURGICO],
    ['Neumonía', TipoIngreso.RESPIRATORIO],
    ['NEUMONIA bilateral', TipoIngreso.RESPIRATORIO],
    ['Infección respiratoria aguda', TipoIngreso.RESPIRATORIO],
  ])('resuelve "%s" como %s', (motivo, tipo) => {
    expect(director.resolverTipo(motivo)).toBe(tipo);
  });

  it('devuelve null para motivos sin protocolo', () => {
    expect(director.resolverTipo('Fractura de fémur')).toBeNull();
    expect(director.resolverTipo('')).toBeNull();
    expect(director.construirPorMotivo('Fractura de fémur')).toBeNull();
  });

  it('construye el protocolo con el builder que corresponde', () => {
    expect(director.construir(TipoIngreso.PRE_QUIRURGICO).tareas).toHaveLength(3);
    expect(director.construirPorMotivo('neumonía')?.tipo).toBe(TipoIngreso.RESPIRATORIO);
  });
});
