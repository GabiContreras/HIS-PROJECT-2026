import { describe, expect, it, vi } from 'vitest';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { CoverageCheckInput } from '../domain/ports/coverage-verifier.port.js';
import { SimulatedCoverageVerifier } from './simulated-coverage-verifier.js';

function buildVerifier() {
  const financiadores = { findOne: vi.fn() };
  const planes = { findOne: vi.fn() };
  const verifier = new SimulatedCoverageVerifier(
    financiadores as never,
    planes as never,
  );
  return { verifier, financiadores, planes };
}

function affiliation(
  overrides: Partial<CoverageCheckInput> = {},
): CoverageCheckInput {
  return {
    tipoCobertura: CoverageType.PREPAID,
    financiadorId: 'f1',
    planId: 'p1',
    numeroAfiliado: '12345',
    ...overrides,
  };
}

function givenActiveCatalog(
  mocks: ReturnType<typeof buildVerifier>,
  plan: { activo?: boolean; financiadorId?: string } = {},
) {
  mocks.financiadores.findOne.mockResolvedValue({ id: 'f1', activo: true });
  mocks.planes.findOne.mockResolvedValue({
    id: 'p1',
    activo: true,
    financiadorId: 'f1',
    ...plan,
  });
}

describe('SimulatedCoverageVerifier', () => {
  it('cubre al paciente particular sin consultar el catálogo', async () => {
    const { verifier, financiadores, planes } = buildVerifier();

    await expect(
      verifier.verify(
        affiliation({
          tipoCobertura: CoverageType.SELF_PAY,
          financiadorId: null,
          planId: null,
          numeroAfiliado: null,
        }),
      ),
    ).resolves.toEqual({ cubierta: true });
    expect(financiadores.findOne).not.toHaveBeenCalled();
    expect(planes.findOne).not.toHaveBeenCalled();
  });

  it.each([
    ['financiadorId nulo', { financiadorId: null }],
    ['planId nulo', { planId: null }],
    ['numeroAfiliado nulo', { numeroAfiliado: null }],
    ['numeroAfiliado vacío', { numeroAfiliado: '   ' }],
    ['financiadorId vacío', { financiadorId: '' }],
    ['planId vacío', { planId: '' }],
  ])(
    'rechaza con afiliación incompleta si hay %s',
    async (_name, overrides) => {
      const { verifier, financiadores } = buildVerifier();

      await expect(verifier.verify(affiliation(overrides))).resolves.toEqual({
        cubierta: false,
        motivo: 'AFILIACION_INCOMPLETA',
      });
      expect(financiadores.findOne).not.toHaveBeenCalled();
    },
  );

  it('rechaza un financiador inexistente', async () => {
    const { verifier, financiadores, planes } = buildVerifier();
    financiadores.findOne.mockResolvedValue(null);

    await expect(verifier.verify(affiliation())).resolves.toEqual({
      cubierta: false,
      motivo: 'FINANCIADOR_INEXISTENTE',
    });
    expect(planes.findOne).not.toHaveBeenCalled();
  });

  it('rechaza un financiador inactivo', async () => {
    const { verifier, financiadores, planes } = buildVerifier();
    financiadores.findOne.mockResolvedValue({ id: 'f1', activo: false });

    await expect(verifier.verify(affiliation())).resolves.toEqual({
      cubierta: false,
      motivo: 'FINANCIADOR_INACTIVO',
    });
    expect(planes.findOne).not.toHaveBeenCalled();
  });

  it('rechaza un plan inexistente', async () => {
    const mocks = buildVerifier();
    givenActiveCatalog(mocks);
    mocks.planes.findOne.mockResolvedValue(null);

    await expect(mocks.verifier.verify(affiliation())).resolves.toEqual({
      cubierta: false,
      motivo: 'PLAN_INEXISTENTE',
    });
  });

  it('rechaza un plan inactivo', async () => {
    const mocks = buildVerifier();
    givenActiveCatalog(mocks, { activo: false });

    await expect(mocks.verifier.verify(affiliation())).resolves.toEqual({
      cubierta: false,
      motivo: 'PLAN_INACTIVO',
    });
  });

  it('rechaza un plan de otro financiador', async () => {
    const mocks = buildVerifier();
    givenActiveCatalog(mocks, { financiadorId: 'f2' });

    await expect(mocks.verifier.verify(affiliation())).resolves.toEqual({
      cubierta: false,
      motivo: 'PLAN_NO_PERTENECE_AL_FINANCIADOR',
    });
  });

  it.each([
    ['obra social pública', CoverageType.PUBLIC_INSURANCE],
    ['prepaga', CoverageType.PREPAID],
  ])('cubre una afiliación vigente de %s', async (_name, tipoCobertura) => {
    const mocks = buildVerifier();
    givenActiveCatalog(mocks);

    await expect(
      mocks.verifier.verify(affiliation({ tipoCobertura })),
    ).resolves.toEqual({ cubierta: true });
    expect(mocks.financiadores.findOne).toHaveBeenCalledTimes(1);
    expect(mocks.planes.findOne).toHaveBeenCalledTimes(1);
  });

  it('no depende de la prestación en esta versión', async () => {
    const mocks = buildVerifier();
    givenActiveCatalog(mocks);

    const sinPrestacion = await mocks.verifier.verify(affiliation());
    const conPrestacion = await mocks.verifier.verify(
      affiliation({ prestacion: 'CONSULTA_CARDIOLOGIA' }),
    );

    expect(conPrestacion).toEqual(sinPrestacion);
    expect(conPrestacion).toEqual({ cubierta: true });
  });
});
