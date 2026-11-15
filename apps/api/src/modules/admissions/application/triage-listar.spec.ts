import { EstadoTriaje } from '../../../entities/triaje.entity.js';
import { TriageService } from './triage.service.js';

function build(rows: object[], total: number) {
  const query = {
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([rows, total]),
  };
  const triajeRepo = { createQueryBuilder: vi.fn().mockReturnValue(query) };
  const service = new TriageService(
    triajeRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, query };
}

const registro = {
  id: 't-1',
  pacienteId: 'p-1',
  paciente: { apellido: 'Lovelace', nombre: 'Ada' },
  nivel: 'ROJO',
  motivoConsulta: 'Dolor',
  estado: EstadoTriaje.EN_COLA,
  llegadaAt: new Date('2030-01-01T10:00:00Z'),
};

describe('TriageService.listar (ADM-9)', () => {
  it('por defecto lista la cola sin paginar', async () => {
    const { service, query } = build([registro], 1);
    const result = await service.listar({});
    expect(query.where).toHaveBeenCalledWith('t.estado = :estado', {
      estado: EstadoTriaje.EN_COLA,
    });
    expect(query.limit).not.toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: 't-1', paciente: 'Lovelace, Ada' });
  });

  it('filtra por nivel y estado y pagina', async () => {
    const { service, query } = build([], 0);
    await service.listar({
      nivel: 'ROJO' as never,
      estado: EstadoTriaje.ATENDIDO,
      page: 2,
      limit: 5,
    });
    expect(query.where).toHaveBeenCalledWith('t.estado = :estado', {
      estado: EstadoTriaje.ATENDIDO,
    });
    expect(query.andWhere).toHaveBeenCalledWith('t.nivel = :nivel', {
      nivel: 'ROJO',
    });
    expect(query.offset).toHaveBeenCalledWith(5);
    expect(query.limit).toHaveBeenCalledWith(5);
  });
});