# Resources / Domain

## Responsabilidad

Esta capa contiene las reglas de negocio y los conceptos propios del módulo Resources, relacionado con la gestión de camas y los recursos disponibles del sistema.

Define los estados de las camas, las transiciones permitidas y los contratos necesarios para interactuar con otros componentes.

## Estados de las camas

### `estado-cama.enum.ts`

Define el enumerado `EstadoCama`, que representa los cuatro estados posibles de una cama:

- `LIBRE`: la cama está disponible.
- `OCUPADA`: la cama tiene un paciente asignado.
- `EN_LIMPIEZA`: la cama está pendiente de limpieza después de un alta médica.
- `BLOQUEADA`: la cama se encuentra fuera de servicio.

## Patrón State

La gestión de los estados se implementa mediante el patrón de diseño State.

Este patrón permite definir el comportamiento de una cama según su estado actual, evitando que se realicen operaciones no permitidas.

### `state/bed-state.ts`

Define la clase abstracta `BedState`, que establece las operaciones disponibles:

- `ocupar()`
- `darAlta()`
- `confirmarLimpieza()`
- `bloquear()`
- `desbloquear()`

Las operaciones no permitidas generan un `InvalidBedTransitionError`.

### Clases de estados

Cada estado tiene su propia implementación:

- `libre.state.ts`: permite ocupar o bloquear una cama.
- `ocupada.state.ts`: permite registrar el alta médica.
- `en-limpieza.state.ts`: permite confirmar la limpieza.
- `bloqueada.state.ts`: permite desbloquear la cama.

### `state/bed-state.factory.ts`

Contiene `BedStateFactory`, encargado de obtener la implementación correspondiente al estado actual.

Utiliza instancias compartidas para cada estado, ya que los objetos no almacenan información propia.

## Transiciones permitidas

| Estado actual | Operación | Estado resultante |
|---|---|---|
| LIBRE | Ocupar | OCUPADA |
| LIBRE | Bloquear | BLOQUEADA |
| OCUPADA | Dar alta | EN_LIMPIEZA |
| EN_LIMPIEZA | Confirmar limpieza | LIBRE |
| BLOQUEADA | Desbloquear | LIBRE |

Las operaciones que no aparecen en esta tabla no están permitidas y generan un error de dominio.

## Manejo de errores

### `invalid-bed-transition.error.ts`

Define `InvalidBedTransitionError`, que representa un intento de realizar una transición inválida.

El error conserva:

- `desde`: estado actual de la cama.
- `accion`: operación que se intentó realizar.

Esto permite identificar por qué una operación no puede ejecutarse.

## Puerto de inventario

### `ports/inventory.port.ts`

Define el contrato `InventoryPort`, que permite desacoplar el dominio de la implementación técnica del inventario.

Contiene las siguientes estructuras:

**`DescontarStockInput`**
- `insumoId`: identificador del insumo.
- `cantidad`: cantidad que se desea descontar.

**`DescontarStockResult`**
- `insumoId`: identificador del insumo.
- `cantidadDescontada`: cantidad descontada.
- `cantidadRestante`: stock disponible después de la operación.

El contrato define el método `descontarStock()`, que recibe los datos de entrada y devuelve el resultado de la operación.

## Pruebas

La capa contiene pruebas unitarias para verificar:

- La correspondencia entre cada estado y su implementación.
- Las transiciones permitidas y rechazadas.
- El comportamiento de `BedStateFactory`.
- El ciclo completo de una cama: LIBRE → OCUPADA → EN_LIMPIEZA → LIBRE.
- El desbloqueo de una cama.
- Los errores generados ante operaciones inválidas.

Archivos de prueba:

- `invalid-bed-transition.error.test.ts`
- `state/bed-state.factory.test.ts`
- `state/bed-state.test.ts`

## Criterios de arquitectura

- Domain contiene las reglas de transición de estados.
- Las reglas no dependen de TypeORM ni de la API.
- Los puertos definen contratos para comunicarse con otros componentes.
- Application utiliza estas reglas para coordinar los casos de uso.
