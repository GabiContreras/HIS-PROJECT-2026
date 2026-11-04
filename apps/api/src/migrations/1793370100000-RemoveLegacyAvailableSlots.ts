import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La disponibilidad ahora se calcula desde el horario del médico.
 * Las filas DISPONIBLE (franjas manuales) quedan obsoletas y chocarían con el
 * índice único uq_turnos_medico_fecha_activo al reservar el mismo horario.
 * Solo se eliminan filas libres (sin paciente): no se pierde ningún dato clínico.
 */
export class RemoveLegacyAvailableSlots1793370100000
  implements MigrationInterface
{
  name = 'RemoveLegacyAvailableSlots1793370100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM turnos WHERE estado = 'DISPONIBLE' AND paciente_id IS NULL`,
    );
  }

  public async down(): Promise<void> {
    // Irreversible: las franjas libres se regeneran solas desde el horario del médico.
  }
}
