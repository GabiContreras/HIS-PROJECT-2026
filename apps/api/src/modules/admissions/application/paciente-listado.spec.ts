import { CoverageType } from '../../../shared/events/coverage-type.js';
import { PacientesService } from './pacientes.service.js';

function build() {
  const repository = {
    searchPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  return { service: new PacientesService(repository as never), repository };
}

describe('PacientesService.list (ADM-9)', () => {
  it('sin paginación conserva el tope histórico de 50', async () => {
    const { service, repository } = build();
    await service.list({ q: ' ada ' });
    expect(repository.searchPage).toHaveBeenCalledWith(
      { term: 'ada', tipoCobertura: undefined },
      0,
      50,
    );
  });

  it('pagina con page y limit', async () => {
    const { service, repository } = build();
    await service.list({ page: 3, limit: 10 });
    expect(repository.searchPage).toHaveBeenCalledWith(
      { term: undefined, tipoCobertura: undefined },
      20,
      10,
    );
  });

  it('con solo page usa 20 por página', async () => {
    const { service, repository } = build();
    await service.list({ page: 2 });
    expect(repository.searchPage).toHaveBeenCalledWith(expect.anything(), 20, 20);
  });

  it('filtra por cobertura', async () => {
    const { service, repository } = build();
    await service.list({ tipoCobertura: CoverageType.PREPAID });
    expect(repository.searchPage).toHaveBeenCalledWith(
      { term: undefined, tipoCobertura: CoverageType.PREPAID },
      0,
      50,
    );
  });
});