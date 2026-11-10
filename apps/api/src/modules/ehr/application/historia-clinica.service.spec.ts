import { NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { NuevoRegistroClinico } from '../domain/ports/historia-clinica.repository.js';
import { CategoriaRegistro } from '../domain/registro-clinico.js';
import { HistoriaClinicaService } from './historia-clinica.service.js';

describe('HistoriaClinicaService', () => {
  const identity: SessionIdentity = {
    accountId: 'doctor-1',
    sessionId: 'session-1',
    rol: RolUsuario.MEDICO,
    esSuperadmin: false,
  };
  const fecha = new Date('2030-01-01T10:00:00.000Z');
  const paciente = {
    id: 'patient-1',
    nombre: 'Carlos',
    apellido: 'López',
    documento: '30111222',
    fechaNacimiento: '1980-05-10',
    telefono: null,
  };

  function build(options: { patientExists?: boolean } = {}) {
    const repository = {
      create: vi.fn(async (data: NuevoRegistroClinico) => ({
        id: 'registro-1',
        categoria: data.categoria,
        titulo: data.titulo,
        detalle: data.detalle,
        registradoPor: 'Silva, Ana',
        fechaHora: fecha,
      })),
      listByPaciente: vi.fn(async () => [
        { id: 'e1', categoria: 'EVOLUCION', titulo: null, detalle: 'Estable', registradoPor: 'Silva, Ana', fechaHora: fecha },
        { id: 'a1', categoria: 'ALERGIA', titulo: 'Penicilina', detalle: 'Urticaria', registradoPor: 'Silva, Ana', fechaHora: fecha },
      ]),
    };
    const pacientes = {
      get: vi.fn(async () => {
        if (options.patientExists === false) throw new NotFoundException();
        return paciente;
      }),
    };
    const service = new HistoriaClinicaService(repository as never, pacientes as never);
    return { service, repository, pacientes };
  }

  it('arma la historia con la ficha demográfica y las secciones por categoría', async () => {
    const { service, repository } = build();

    const result = await service.obtener('patient-1');

    expect(repository.listByPaciente).toHaveBeenCalledWith('patient-1');
    expect(result.paciente).toEqual(paciente);
    expect(result.evoluciones).toHaveLength(1);
    expect(result.alergias[0]).toMatchObject({ titulo: 'Penicilina', detalle: 'Urticaria', fechaHora: fecha.toISOString() });
    expect(result.antecedentesFamiliares).toEqual([]);
    expect(result.estudios).toEqual([]);
  });

  it('propaga el 404 si el paciente no existe, sin consultar registros', async () => {
    const { service, repository } = build({ patientExists: false });

    await expect(service.obtener('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.listByPaciente).not.toHaveBeenCalled();
  });

  it('registra una evolución con el médico autenticado y sin título', async () => {
    const { service, repository } = build();

    const result = await service.registrarEvolucion('patient-1', '  Paciente afebril.  ', identity);

    expect(repository.create).toHaveBeenCalledWith({
      pacienteId: 'patient-1',
      registradoPorId: 'doctor-1',
      categoria: CategoriaRegistro.EVOLUCION,
      titulo: null,
      detalle: 'Paciente afebril.',
    });
    expect(result).toMatchObject({ categoria: 'EVOLUCION', titulo: null, registradoPor: 'Silva, Ana' });
  });

  it('registra alergia, antecedente y estudio con su título y detalle', async () => {
    const { service, repository } = build();

    await service.registrarAlergia('patient-1', 'Penicilina', 'Urticaria', identity);
    await service.registrarAntecedenteFamiliar('patient-1', 'Madre', 'Diabetes tipo 2', identity);
    await service.registrarEstudio('patient-1', 'Radiografía de tórax', 'Sin hallazgos', identity);

    expect(repository.create.mock.calls.map(([data]) => [data.categoria, data.titulo, data.detalle])).toEqual([
      ['ALERGIA', 'Penicilina', 'Urticaria'],
      ['ANTECEDENTE_FAMILIAR', 'Madre', 'Diabetes tipo 2'],
      ['ESTUDIO', 'Radiografía de tórax', 'Sin hallazgos'],
    ]);
  });

  it('no guarda nada si el paciente no existe', async () => {
    const { service, repository } = build({ patientExists: false });

    await expect(service.registrarEvolucion('missing', 'Nota', identity)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('no expone operaciones de modificación ni borrado (inmutabilidad)', () => {
    const { service } = build();
    const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(metodos.filter((m) => /actualizar|modificar|editar|eliminar|borrar|update|delete/i.test(m))).toEqual([]);
  });
});
