import {
  BOM_UTF8,
  cabeceraCsvCargos,
  CargoParaCsv,
  COLUMNAS_CSV_CARGOS,
  escaparCampoCsv,
  filaCsv,
  filaCsvCargo,
  nombreArchivoCargos,
} from './csv-cargos.js';

const cargo = (cambios: Partial<CargoParaCsv> = {}): CargoParaCsv => ({
  id: 'c1',
  createdAt: new Date('2026-03-10T15:30:00.000Z'),
  tipoAtencion: 'REGULAR',
  estado: 'PENDIENTE',
  concepto: null,
  importePesos: 15000,
  cobertura: { tipo: 'MEDICINA_PREPAGA', pacientePesos: 3000, terceroPesos: 12000 },
  paciente: { nombre: 'Ana', apellido: 'Rojas' },
  turno: {
    medico: { nombre: 'Ada', apellido: 'Lovelace' },
  },
  ...cambios,
});

describe('escaparCampoCsv', () => {
  it('deja intacto el texto simple y los numeros', () => {
    expect(escaparCampoCsv('hola')).toBe('hola');
    expect(escaparCampoCsv(15000)).toBe('15000');
    expect(escaparCampoCsv(0)).toBe('0');
  });

  it('deja vacios null y undefined', () => {
    expect(escaparCampoCsv(null)).toBe('');
    expect(escaparCampoCsv(undefined)).toBe('');
  });

  it('entrecomilla los campos con comas', () => {
    expect(escaparCampoCsv('Perez, Juan')).toBe('"Perez, Juan"');
  });

  it('entrecomilla y duplica las comillas dobles', () => {
    expect(escaparCampoCsv('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it('entrecomilla los saltos de linea LF y CR', () => {
    expect(escaparCampoCsv('a\nb')).toBe('"a\nb"');
    expect(escaparCampoCsv('a\r\nb')).toBe('"a\r\nb"');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd'])(
    'prefija con comilla simple el texto que empieza con una formula: %j',
    (valor) => {
      expect(escaparCampoCsv(valor)).toBe(`'${valor}`);
    },
  );

  it('no prefija cuando el signo no esta al inicio', () => {
    expect(escaparCampoCsv('a=1')).toBe('a=1');
    expect(escaparCampoCsv('3-1')).toBe('3-1');
  });

  it('combina proteccion de formula y escape de comillas', () => {
    expect(escaparCampoCsv('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  it('no altera un numero negativo', () => {
    expect(escaparCampoCsv(-5)).toBe('-5');
  });
});

describe('filaCsv', () => {
  it('separa con comas y termina en CRLF', () => {
    expect(filaCsv(['a', 1, null, 'b,c'])).toBe('a,1,,"b,c"\r\n');
  });
});

describe('cabeceraCsvCargos', () => {
  it('empieza con BOM UTF-8 y lista las columnas en el orden pedido', () => {
    const cabecera = cabeceraCsvCargos();

    expect(cabecera.startsWith(BOM_UTF8)).toBe(true);
    expect(cabecera).toBe(
      '﻿id,fecha,tipoAtencion,estado,concepto,importePesos,pacientePesos,terceroPesos,cobertura,paciente,medico\r\n',
    );
    expect(COLUMNAS_CSV_CARGOS).toHaveLength(11);
  });
});

describe('filaCsvCargo', () => {
  it('arma la fila de una consulta con paciente, medico y cobertura', () => {
    expect(filaCsvCargo(cargo())).toBe(
      'c1,2026-03-10T15:30:00.000Z,REGULAR,PENDIENTE,,15000,3000,12000,MEDICINA_PREPAGA,Ana Rojas,Ada Lovelace\r\n',
    );
  });

  it('muestra el paciente en un cargo de internacion sin turno', () => {
    const fila = filaCsvCargo(
      cargo({ tipoAtencion: 'INTERNACION', concepto: 'Internacion: 2 dias de cama', turno: null }),
    );

    expect(fila.endsWith(',MEDICINA_PREPAGA,Ana Rojas,\r\n')).toBe(true);
  });

  it('deja vacios paciente y medico cuando no se pudieron resolver', () => {
    const fila = filaCsvCargo(cargo({ paciente: null, turno: null, cobertura: null }));

    expect(fila.endsWith(',15000,,,,,\r\n')).toBe(true);
  });

  it('muestra el paciente y deja vacios cobertura y medico en un cargo de farmacia', () => {
    const fila = filaCsvCargo(
      cargo({
        tipoAtencion: 'FARMACIA',
        concepto: 'Insumos de Farmacia',
        cobertura: null,
        turno: null,
      }),
    );

    expect(fila).toBe(
      'c1,2026-03-10T15:30:00.000Z,FARMACIA,PENDIENTE,Insumos de Farmacia,15000,,,,Ana Rojas,\r\n',
    );
  });

  it('deja vacio el paciente cuando el turno no lo tiene', () => {
    const fila = filaCsvCargo(
      cargo({ paciente: null }),
    );

    expect(fila.endsWith(',MEDICINA_PREPAGA,,Ada Lovelace\r\n')).toBe(true);
  });

  it('escapa comas, comillas y formulas en concepto, paciente y medico', () => {
    const fila = filaCsvCargo(
      cargo({
        concepto: '=cmd|"x", y',
        paciente: { nombre: '-Ana', apellido: 'Rojas\nGomez' },
        turno: {
          medico: { nombre: '@Dr', apellido: 'O"Neil' },
        },
      }),
    );

    expect(fila).toContain(`"'=cmd|""x"", y"`);
    expect(fila).toContain(`"'-Ana Rojas\nGomez"`);
    expect(fila).toContain(`"'@Dr O""Neil"`);
  });
});

describe('nombreArchivoCargos', () => {
  it('usa la fecha local de Buenos Aires', () => {
    expect(nombreArchivoCargos(new Date('2026-11-15T15:00:00.000Z'))).toBe('cargos-2026-11-15.csv');
  });

  it('a las 01:00 UTC todavia es el dia anterior en Buenos Aires', () => {
    expect(nombreArchivoCargos(new Date('2026-11-16T01:00:00.000Z'))).toBe('cargos-2026-11-15.csv');
  });
});
