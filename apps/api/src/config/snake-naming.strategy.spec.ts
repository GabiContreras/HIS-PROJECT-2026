import { SnakeNamingStrategy } from './snake-naming.strategy.js';

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it('converts generated table and column names to snake_case', () => {
    expect(strategy.tableName('AdministracionMedicacion', undefined)).toBe(
      'administracion_medicacion',
    );
    expect(
      strategy.columnName('fechaHoraAdministracion', undefined, []),
    ).toBe('fecha_hora_administracion');
  });

  it('keeps explicit names compatible with the naming convention', () => {
    expect(strategy.tableName('Usuario', 'usuarios')).toBe('usuarios');
    expect(strategy.columnName('fechaHora', 'fecha_hora', [])).toBe(
      'fecha_hora',
    );
  });

  it('converts relation and join column names', () => {
    expect(strategy.relationName('registradoPor')).toBe('registrado_por');
    expect(strategy.joinColumnName('registradoPor', 'id')).toBe(
      'registrado_por_id',
    );
  });
});
