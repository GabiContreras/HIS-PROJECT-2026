# Resources / Application

## Responsabilidad

Esta capa contiene la lógica de aplicación relacionada con la gestión de camas y las internaciones.

Actualmente, está implementada mediante el servicio `CamasService`, que coordina las operaciones y utiliza las reglas de la capa Domain junto con los componentes de persistencia.

## Servicios

### `camas.service.ts`

Contiene `CamasService`, responsable de coordinar las operaciones relacionadas con las camas.

Sus principales responsabilidades son:

- Listar camas y aplicar filtros por estado y sector.
- Obtener el detalle de una cama.
- Asignar pacientes a camas.
- Registrar altas médicas.
- Confirmar la limpieza de camas.
- Bloquear y desbloquear camas.
- Gestionar las internaciones asociadas a cada cama.
- Publicar eventos relacionados con los cambios de estado.

## Asignación de camas e internaciones

Durante la asignación de una cama, el servicio:

1. Determina el médico responsable según la identidad del usuario y los datos recibidos.
2. Comprueba que la cama esté disponible.
3. Verifica que el médico exista, tenga el rol correspondiente y esté activo.
4. Comprueba que el paciente exista y no tenga otra internación activa.
5. Actualiza el estado de la cama.
6. Registra la internación correspondiente.

Estas operaciones se realizan dentro de una transacción.

## Gestión de estados

El servicio utiliza `BedStateFactory` y `BedState` de la capa Domain para aplicar las transiciones permitidas.

Las operaciones contemplan los siguientes cambios:

- Asignación: la cama pasa a `OCUPADA`.
- Alta médica: la cama pasa a `EN_LIMPIEZA`.
- Confirmación de limpieza: la cama pasa a `LIBRE`.
- Bloqueo: la cama pasa a `BLOQUEADA`.
- Desbloqueo: la cama vuelve a `LIBRE`.

Los errores de transición se traducen en respuestas de conflicto HTTP.

## Transacciones y concurrencia

Para evitar inconsistencias cuando varios usuarios modifican una cama simultáneamente, el servicio utiliza:

- Transacciones mediante `DataSource`.
- Bloqueos pesimistas de filas.
- Un tiempo límite para la adquisición de bloqueos.
- Manejo de errores de base de datos y restricciones de unicidad.

## Eventos del sistema

Después de completar las operaciones correspondientes, el servicio publica eventos mediante `EventBus`:

- `BedAssigned`: cuando se asigna un paciente a una cama.
- `BedReleased`: cuando se registra el alta médica.
- `BedCleaned`: cuando se confirma la limpieza.

Estos eventos permiten comunicar los cambios a otros componentes del sistema.

## Conversión de respuestas

El método `toDto` transforma las entidades de cama en `CamaResponseDto`, incluyendo los datos básicos del paciente actual cuando existe una asignación.

## Estado actual

Actualmente, la capa cuenta con `CamasService`.

No se identifican otros servicios ni casos de uso implementados dentro de esta carpeta. Las operaciones de inventario son coordinadas por `InventoryService`, ubicado actualmente en Infrastructure.

## Criterios de arquitectura

- Application coordina los casos de uso.
- Las reglas de transición de estados se encuentran en Domain.
- La persistencia se realiza mediante los repositorios y transacciones correspondientes.
- Los eventos permiten comunicar cambios con otros módulos sin acoplar directamente sus implementaciones.
