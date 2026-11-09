# Resources / API

## Responsabilidad

Esta capa expone las operaciones HTTP relacionadas con la gestión de camas y el inventario de recursos del sistema.

Recibe las solicitudes, valida los datos mediante DTOs y delega las operaciones a los servicios correspondientes.

## Controladores

### `camas.controller.ts`

Contiene `CamasController`, encargado de exponer las operaciones relacionadas con la gestión de camas.

Ruta base: `/camas`.

Endpoints disponibles:

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/camas` | Lista las camas y permite filtrar por estado y sector. |
| GET | `/camas/:id` | Obtiene el detalle de una cama. |
| POST | `/camas/:id/asignar` | Asigna un paciente a una cama. |
| POST | `/camas/:id/alta` | Registra el alta médica. |
| POST | `/camas/:id/limpieza/confirmar` | Confirma la limpieza de una cama. |
| POST | `/camas/:id/bloquear` | Bloquea una cama. |
| POST | `/camas/:id/desbloquear` | Desbloquea una cama. |

Las operaciones requieren autenticación y autorización mediante `AuthGuard` y `RolesGuard`.

Los permisos se distribuyen según el rol:

- Médicos, enfermeros y administrativos pueden consultar las camas.
- Médicos y administrativos pueden asignar pacientes y registrar altas médicas.
- Enfermeros y administrativos pueden confirmar limpiezas.
- Solamente los administrativos pueden bloquear y desbloquear camas.

La asignación recibe la identidad del usuario autenticado y utiliza `CamasService` para ejecutar la operación.

### `inventory.controller.ts`

Contiene `InventoryController`, encargado de las operaciones de inventario.

Ruta base: `/resources/inventory`.

Endpoint disponible:

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/resources/inventory/descontar` | Descuenta una cantidad del stock disponible de un insumo. |

Esta operación requiere autenticación y autorización. Solamente los usuarios con rol `MEDICO` pueden realizarla.

El controlador delega la operación a `InventoryService`.

## DTOs

Los DTOs definen y validan los datos de entrada y las respuestas de la API.

### `asignar-cama.dto.ts`

Define `AsignarCamaDto`:

- `pacienteId`: UUID obligatorio del paciente.
- `medicoId`: UUID opcional del médico responsable. Es obligatorio cuando quien asigna es un administrativo; si quien asigna es médico, se utiliza su propia cuenta.

### `cama-response.dto.ts`

Define la respuesta de una cama mediante `CamaResponseDto`:

- `id`: identificador de la cama.
- `numero`: número o código de identificación.
- `sector`: sector al que pertenece.
- `estado`: estado actual de la cama.
- `paciente`: resumen del paciente asignado, cuando corresponde.
- `version`: versión de la fila, que se incrementa con cada cambio.

También contiene `PacienteResumenDto`, con los datos básicos del paciente: identificador, nombre, apellido y documento.

### `descontar-stock.dto.ts`

Define `DescontarStockDto`:

- `insumoId`: identificador UUID del insumo.
- `cantidad`: cantidad entera mayor que cero que se desea descontar.

### `listar-camas-query.dto.ts`

Define `ListarCamasQueryDto`, que permite filtrar las camas por:

- `estado`: estado de la cama.
- `sector`: sector, con una longitud máxima de 50 caracteres.

Ambos filtros son opcionales.

### `error-response.dto.ts`

Define `ErrorResponseDto`, utilizado para documentar el formato general de los errores HTTP:

- `statusCode`: código HTTP.
- `code`: código identificador del error.
- `message`: descripción del error.
- `path`: ruta donde ocurrió el error.
- `timestamp`: fecha y hora del error.

## Pruebas

La carpeta contiene `inventory.controller.integration.spec.ts`, que permite verificar la integración del controlador de inventario.

## Documentación y seguridad

Los controladores utilizan decoradores de Swagger para documentar operaciones, parámetros y respuestas.

Las rutas protegidas requieren autenticación mediante Bearer Token y aplican restricciones de acceso según el rol del usuario.

## Criterios de arquitectura

- Los controladores se encargan de la comunicación HTTP.
- Los DTOs validan los datos de entrada y documentan las respuestas.
- La lógica de los casos de uso se delega a las capas correspondientes.
- La API utiliza los mecanismos de autenticación y autorización del módulo IAM.
