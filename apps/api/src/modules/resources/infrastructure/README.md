# Infrastructure – Resources

Esta capa contiene los componentes encargados de la persistencia de los recursos del sistema. Incluye las entidades de TypeORM y el adaptador que permite descontar insumos del inventario.

## 1. Entidades de persistencia

Las entidades se encuentran en `persistence/entities/`.

### Cama

Archivo: `persistence/entities/cama.entity.ts`

Representa una cama dentro del sistema.

Se persiste en la tabla `camas` y contiene:

- `id`: identificador UUID.
- `numero`: número de cama, único.
- `sector`: sector al que pertenece; puede ser nulo.
- `estado`: estado actual de la cama, definido mediante el enum `EstadoCama`.
- `pacienteActual`: paciente asociado actualmente; puede ser nulo.
- `version`: versión de la entidad, utilizada para el control de concurrencia mediante TypeORM.

La relación con `Paciente` utiliza `ManyToOne`. Si se elimina el paciente relacionado, la referencia se establece en `NULL` (`onDelete: SET NULL`).

### Insumo

Archivo: `persistence/entities/insumo.entity.ts`

Representa un insumo disponible en el inventario.

Se persiste en la tabla `insumos` y contiene:

- `id`: identificador UUID.
- `nombre`: nombre del insumo, único.
- `unidadMedida`: unidad en la que se registra.
- `cantidadDisponible`: cantidad disponible, con valor inicial 0.
- `precioPesos`: precio expresado en pesos, con valor inicial 0.

### Internacion

Archivo: `persistence/entities/internacion.entity.ts`

Representa un registro de internación.

Se persiste en la tabla `internaciones` y contiene:

- `id`: identificador UUID.
- `pacienteId`: identificador del paciente.
- `camaId`: identificador de la cama.
- `medicoId`: identificador del médico responsable.
- `fechaIngreso`: fecha y hora de ingreso, generada automáticamente al insertar.
- `fechaEgreso`: fecha y hora de egreso; puede ser nula.
- `createdAt`: fecha y hora de creación del registro.

La fecha de egreso nula representa una internación que todavía no tiene registrado su egreso.

## 2. Servicio de inventario

Archivo: `inventory.service.ts`

`InventoryService` implementa el puerto `InventoryPort`, definido en la capa Domain.

Utiliza un repositorio de TypeORM para acceder a la entidad `Insumo` y realizar el descuento de stock.

El método `descontarStock`:

1. Recibe el identificador del insumo y la cantidad a descontar.
2. Valida que la cantidad sea un número entero positivo.
3. Actualiza el stock directamente en la base de datos, siempre que exista cantidad suficiente.
4. Si el insumo no existe, genera un error `NotFoundException`.
5. Si no hay stock suficiente, genera un error `ConflictException`.
6. Devuelve el identificador del insumo, la cantidad descontada y la cantidad restante.

La actualización condicionada permite evitar que el stock quede por debajo de cero cuando se realizan descuentos.

## 3. Pruebas

Archivo: `inventory.service.spec.ts`

Contiene las pruebas correspondientes al servicio de inventario.

## 4. Responsabilidad de la capa

Infrastructure se encarga de implementar los mecanismos técnicos necesarios para persistir y consultar los recursos del sistema.

En este módulo, sus responsabilidades principales son:

- Definir las entidades que representan camas, insumos e internaciones.
- Mapear esas entidades a sus respectivas tablas mediante TypeORM.
- Implementar el acceso al inventario.
- Ejecutar el descuento de stock respetando la disponibilidad existente.

La lógica de estados de las camas y el contrato para descontar stock se encuentran definidos en la capa Domain.
