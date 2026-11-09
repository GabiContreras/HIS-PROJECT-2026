# IAM / Infrastructure

## Responsabilidad

Esta capa contiene los componentes encargados de la persistencia de los datos relacionados con la identidad y el acceso de los usuarios al sistema.

Actualmente, utiliza TypeORM para definir las entidades y su correspondencia con las tablas de la base de datos.

## Entidades de persistencia

### `usuario.entity.ts`

Define la entidad `Usuario`, asociada a la tabla `usuarios`.

Representa las cuentas de los usuarios del sistema y contiene los siguientes datos:

- `id`: identificador único UUID.
- `nombre` y `apellido`: datos personales.
- `email`: correo electrónico único.
- `passwordHash`: hash de la contraseña.
- `rol`: rol del usuario.
- `estado`: estado actual de la cuenta.
- `emailVerificado`: indica si el correo fue verificado.
- `horaInicio` y `horaFin`: horario laboral, utilizado para médicos.
- `esSuperadmin`: indica si la cuenta tiene privilegios de superadministrador.
- `dadoDeBajaEn`: fecha de baja lógica, cuando corresponde.
- `intentosFallidos`: cantidad de intentos de inicio de sesión fallidos.
- `bloqueadoHasta`: fecha hasta la que la cuenta permanece bloqueada.
- `createdAt` y `updatedAt`: fechas de creación y actualización.

También define los siguientes enumerados:

**`RolUsuario`**
- MEDICO
- ENFERMERO
- ADMINISTRATIVO

**`EstadoCuenta`**
- PENDIENTE_VERIFICACION
- PENDIENTE_HABILITACION
- ACTIVO
- DESHABILITADO
- BAJA

### `refresh-session.entity.ts`

Define la entidad `RefreshSession`, asociada a la tabla `refresh_sessions`.

Representa las sesiones utilizadas para renovar los tokens de autenticación.

Sus principales atributos son:

- `id`: identificador único UUID.
- `usuario`: relación con la entidad Usuario.
- `usuarioId`: identificador del usuario asociado.
- `familiaId`: identificador de la familia de tokens.
- `tokenHash`: hash único del refresh token.
- `expiraEn`: fecha de vencimiento de la sesión.
- `revocadoEn`: fecha de revocación, cuando corresponde.
- `createdAt`: fecha de creación.

La relación con `Usuario` utiliza `ManyToOne` y establece `CASCADE` al eliminar el usuario.

## Consideraciones de persistencia

- Las entidades utilizan decoradores de TypeORM.
- Los identificadores principales se generan como UUID.
- El correo electrónico y el hash del token tienen restricciones de unicidad.
- Las fechas se almacenan utilizando el tipo `timestamptz`.
- Las sesiones están vinculadas a los usuarios y permiten registrar su vencimiento y revocación.

## Estado actual

La capa cuenta con las entidades de persistencia `Usuario` y `RefreshSession`.

La lógica de autenticación, generación de tokens y administración de sesiones se encuentra coordinada desde la capa Application, mientras que esta capa se ocupa de representar y persistir los datos correspondientes.
