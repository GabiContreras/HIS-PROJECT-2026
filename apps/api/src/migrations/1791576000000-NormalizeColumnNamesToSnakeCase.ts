import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeColumnNamesToSnakeCase1791576000000
  implements MigrationInterface
{
  name = 'NormalizeColumnNamesToSnakeCase1791576000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      'usuarios',
      'passwordHash',
      'password_hash',
    );
    await queryRunner.renameColumn('usuarios', 'createdAt', 'created_at');
    await queryRunner.renameColumn(
      'pacientes',
      'fechaNacimiento',
      'fecha_nacimiento',
    );
    await queryRunner.renameColumn('turnos', 'fechaHora', 'fecha_hora');
    await queryRunner.renameColumn('turnos', 'pacienteId', 'paciente_id');
    await queryRunner.renameColumn('turnos', 'medicoId', 'medico_id');
    await queryRunner.renameColumn(
      'camas',
      'pacienteActualId',
      'paciente_actual_id',
    );
    await queryRunner.renameColumn(
      'insumos',
      'unidadMedida',
      'unidad_medida',
    );
    await queryRunner.renameColumn(
      'insumos',
      'cantidadDisponible',
      'cantidad_disponible',
    );
    await queryRunner.renameColumn(
      'signos_vitales',
      'fechaHora',
      'fecha_hora',
    );
    await queryRunner.renameColumn(
      'signos_vitales',
      'pacienteId',
      'paciente_id',
    );
    await queryRunner.renameColumn(
      'signos_vitales',
      'registradoPorId',
      'registrado_por_id',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'fechaInicio',
      'fecha_inicio',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'fechaFin',
      'fecha_fin',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'pacienteId',
      'paciente_id',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'medicoId',
      'medico_id',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'insumoId',
      'insumo_id',
    );
    await queryRunner.renameColumn(
      'administraciones_medicacion',
      'fechaHoraAdministracion',
      'fecha_hora_administracion',
    );
    await queryRunner.renameColumn(
      'administraciones_medicacion',
      'indicacionId',
      'indicacion_id',
    );
    await queryRunner.renameColumn(
      'administraciones_medicacion',
      'enfermeroId',
      'enfermero_id',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      'administraciones_medicacion',
      'enfermero_id',
      'enfermeroId',
    );
    await queryRunner.renameColumn(
      'administraciones_medicacion',
      'indicacion_id',
      'indicacionId',
    );
    await queryRunner.renameColumn(
      'administraciones_medicacion',
      'fecha_hora_administracion',
      'fechaHoraAdministracion',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'insumo_id',
      'insumoId',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'medico_id',
      'medicoId',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'paciente_id',
      'pacienteId',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'fecha_fin',
      'fechaFin',
    );
    await queryRunner.renameColumn(
      'indicaciones_medicas',
      'fecha_inicio',
      'fechaInicio',
    );
    await queryRunner.renameColumn(
      'signos_vitales',
      'registrado_por_id',
      'registradoPorId',
    );
    await queryRunner.renameColumn(
      'signos_vitales',
      'paciente_id',
      'pacienteId',
    );
    await queryRunner.renameColumn(
      'signos_vitales',
      'fecha_hora',
      'fechaHora',
    );
    await queryRunner.renameColumn(
      'insumos',
      'cantidad_disponible',
      'cantidadDisponible',
    );
    await queryRunner.renameColumn(
      'insumos',
      'unidad_medida',
      'unidadMedida',
    );
    await queryRunner.renameColumn(
      'camas',
      'paciente_actual_id',
      'pacienteActualId',
    );
    await queryRunner.renameColumn('turnos', 'medico_id', 'medicoId');
    await queryRunner.renameColumn('turnos', 'paciente_id', 'pacienteId');
    await queryRunner.renameColumn('turnos', 'fecha_hora', 'fechaHora');
    await queryRunner.renameColumn(
      'pacientes',
      'fecha_nacimiento',
      'fechaNacimiento',
    );
    await queryRunner.renameColumn('usuarios', 'created_at', 'createdAt');
    await queryRunner.renameColumn(
      'usuarios',
      'password_hash',
      'passwordHash',
    );
  }
}
