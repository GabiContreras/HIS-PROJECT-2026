# Nursing / Infrastructure

## Responsabilidad

Esta capa contiene los componentes técnicos encargados de persistir la información relacionada con la administración de medicación.

Actualmente, utiliza TypeORM para definir la entidad y sus relaciones con otros módulos del sistema.

## Entidades de persistencia

### `administracion-medicacion.entity.ts`

Define la entidad `AdministracionMedicacion`, asociada a la tabla `administraciones_medicacion`.

Representa el registro de una administración de medicación realizada por un enfermero.

Sus principales atributos son:

- `id`: identificador único generado como UUID.
- `indicacion`: relación con la entidad `IndicacionMedica`.
- `enfermero`: relación con la entidad `Usuario` que realizó la administración.
- `fechaHoraAdministracion`: fecha y hora en que se registra la administración.
- `observaciones`: información adicional opcional.

## Relaciones entre entidades

La entidad establece dos relaciones principales:

- **IndicacionMedica:** utiliza una relación `ManyToOne` con eliminación `CASCADE`. Si se elimina la indicación médica, también se eliminan sus administraciones asociadas.
- **Usuario:** utiliza una relación `ManyToOne` con eliminación `RESTRICT`. Esto impide eliminar un usuario que tenga administraciones relacionadas.

Las entidades relacionadas pertenecen a los módulos EHR e IAM, respectivamente.

## Consideraciones de persistencia

- Se utiliza TypeORM para mapear la entidad con la tabla de la base de datos.
- El identificador se genera automáticamente como UUID.
- La fecha y hora de administración se registra mediante `CreateDateColumn`.
- Las observaciones son opcionales.
- Las relaciones permiten vincular cada administración con su indicación médica y el enfermero responsable.

## Estado actual

La capa cuenta con la entidad de persistencia `AdministracionMedicacion`.

Actualmente no se identifican repositorios ni adaptadores adicionales dentro de esta carpeta.

La coordinación de los casos de uso corresponde a Application, mientras que las reglas de negocio propias del proceso de enfermería deberán definirse en Domain.
