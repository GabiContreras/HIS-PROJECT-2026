# Correcciones de la auditoría de permisos por rol (IAM)

## Alcance

Este documento registra los hallazgos de la auditoría de permisos por rol del
módulo IAM (29 de octubre de 2026), las decisiones tomadas para cada uno, las
correcciones aplicadas y lo que queda pendiente.

La auditoría se hizo sobre la rama `feature/nursing-signos-vitales`. Las
correcciones se desarrollaron y probaron en la rama
`feature/iam-auditoria-correccion-seguridad`.

## Hallazgos y correcciones

### Crítico: cambio de contraseña de cualquier cuenta sin sesión

`POST /auth/reset-password` no tenía guard y solo se bloqueaba cuando
`NODE_ENV === 'production'`. Cualquier persona sin sesión podía cambiar la
contraseña de una cuenta no deshabilitada, incluida la del superadmin, e iniciar
sesión con ella.

**Decisión**

Eliminar la ruta. Sin servicio de correo no hay forma segura de verificar la
identidad de quien pide el cambio, y construirlo es una funcionalidad nueva.

**Corrección**

- Se eliminó la ruta `POST /auth/reset-password`, su DTO (`reset-password.dto.ts`)
  y el método `AuthService.resetPassword`.
- Se agregó `PATCH /usuarios/:id/restablecer-clave` (solo administrativo) para
  quien olvidó su contraseña: asigna una contraseña temporal, reinicia el
  bloqueo por intentos fallidos y revoca todas las sesiones de la cuenta.
  Valida la contraseña con la misma política que el resto de IAM.
- `POST /auth/forgot-password` ahora indica que debe pedirse el restablecimiento
  a un administrativo.

### Alto: alta anónima de una cuenta de enfermero activa

`POST /auth/register` no tenía guard y solo se bloqueaba en producción. Un
anónimo podía crear una cuenta de enfermero activa con acceso a historias
clínicas, signos vitales y medicación.

**Decisión**

Eliminar la ruta. El alta de personal ya existe en `POST /usuarios`, que exige un
administrativo.

**Corrección**

- Se eliminó la ruta `POST /auth/register`.
- `AuthService.register` pasó a llamarse `AuthService.createStaff` y se le quitó
  el bloqueo por `NODE_ENV`. Ese bloqueo hacía que, en producción, tampoco
  funcionara `POST /usuarios`, porque lo usa internamente. La barrera real es el
  guard de la ruta (`AuthGuard` + `RolesGuard` con rol administrativo).

### Medio: un administrativo podía gestionar a otros administrativos

`updateProfile`, `enableDoctor` y `deactivate` solo comprobaban `esSuperadmin`
del objetivo. Cualquier administrativo podía modificar o deshabilitar a otros
administrativos y a sí mismo.

**Decisión**

Solo el superadmin gestiona cuentas administrativas, y nadie puede
deshabilitarse a sí mismo.

**Corrección**

- `AccountAdminService` aplica `assertCanManage`: si la cuenta objetivo es
  administrativa y quien llama no es superadmin, responde `403`. Rige para
  `PATCH /usuarios/:id`, `/habilitar`, `/deshabilitar` y `/restablecer-clave`.
- `deactivate` responde `409` si la cuenta objetivo es la de quien llama.
- Consecuencia: un administrativo que no es superadmin tampoco puede editar su
  propio perfil por `PATCH /usuarios/:id`.
- `restablecer-clave` responde `409` sobre la propia cuenta (para cambiarla se
  usa `change-password`, que exige la clave actual) y sobre el superadmin raíz.

### Bajo: `:id` que no son UUID respondían 500

`GET /usuarios/abc`, habilitar, deshabilitar y los `:id` de turnos respondían
`500` porque llegaba un valor inválido a PostgreSQL.

**Corrección**

Se agregó `ParseUUIDPipe` a todos los `:id` de `usuarios.controller.ts` y de
`turnos.controller.ts` (`reservar` y `transiciones`). Ahora responden `400`.
`pacientes.controller.ts` ya lo tenía.

## Tests

| Archivo | Cobertura |
| --- | --- |
| `auth.controller.integration.spec.ts` | `POST /auth/register` y `POST /auth/reset-password` responden `404` y no invocan al servicio. |
| `auth.staff-accounts.spec.ts` (antes `auth.development-flows.spec.ts`) | `createStaff` funciona con cualquier `NODE_ENV`; `setTemporaryPassword` actualiza el hash, limpia el bloqueo, revoca sesiones y responde `404` si la cuenta no existe. |
| `account-admin.service.spec.ts` (nuevo) | Un no superadmin recibe `403` sobre cuentas administrativas en las cuatro operaciones; el superadmin puede; autodeshabilitación bloqueada; superadmin raíz protegido; reglas de `resetPassword`. |

## Validaciones realizadas

### Tests automáticos

Se ejecutó `npm run test` en `apps/api`: 50 tests pasaron en 12 archivos, entre
ellos los de IAM, admisiones, inventario y cargos. El archivo
`test/inventory-service-concurrency.spec.ts` no se ejecutó porque necesita un
PostgreSQL local y la variable `PGLOCAL_PASSWORD`; no está relacionado con IAM.

`npm run build` se ejecutó sin errores.

### Pruebas manuales contra la API

| Prueba | Resultado esperado | Resultado |
| --- | --- | --- |
| `POST /auth/register` | `404` | Correcto |
| `POST /auth/reset-password` | `404` | Correcto |
| `GET /usuarios/abc` con token de administrativo | `400` | Correcto |
| `POST /usuarios` (alta de enfermero) | `201` | Correcto |
| `PATCH /usuarios/:id/restablecer-clave` | `200` | Correcto |
| Login con la contraseña temporal | `200` | Correcto |
| Login con la contraseña anterior | `401` | Correcto |
| Administrativo no superadmin sobre otro administrativo (deshabilitar, restablecer clave, editar perfil) | `403` | Correcto |
| Administrativo no superadmin deshabilitando a un enfermero | `200` | Correcto |
| Superadmin deshabilitando a otro administrativo | `200` | Correcto |

### Otros cambios necesarios para levantar la API

`ResourcesModule` no importaba `IamModule`, y la API no arrancaba
(`UnknownDependenciesException` de `AuthGuard`). No estaba relacionado con la
auditoría. Se corrigió en un commit aparte.

## Pendiente

- **Login con contraseña en texto plano (no figuraba en la auditoría).** En
  `auth.service.ts`, `login` acepta contraseñas legacy sin hash `scrypt$` cuando
  `NODE_ENV !== 'production'`. Se decidió quitarlo solo si la base compartida no
  tiene cuentas legacy. Verificación a cargo del equipo; no se modificó.
- **Límite de intentos de login por IP (bajo).** Fuera de este alcance. Sigue
  vigente el bloqueo de 15 minutos tras 5 intentos fallidos por correo, que
  permite bloquear una cuenta ajena.
- **`turnos.paciente_id` NOT NULL en `BaselineSchema.ts` (bajo).** Sin resolver:
  falta conocer el estado real de la columna en la base compartida.
- **Contraseña temporal sin cambio obligatorio.** `restablecer-clave` no fuerza
  el cambio en el siguiente login porque requeriría una columna nueva y una
  migración. La persona debe cambiarla con `POST /auth/change-password`.
- **`POST /protocolos/ingresos` admite médico y administrativo** y las historias
  de usuario solo respaldan al administrativo. Es un hallazgo conocido y no se
  tocó; el módulo de protocolos no está en este árbol.
- **Rutas de `/camas`.** Las rutas del frontend no tienen backend, así que sus
  permisos no se evaluaron.

## Estado actual

Con estas correcciones, ninguna ruta de IAM depende de `NODE_ENV` para su
autorización. Las altas de personal y los restablecimientos de contraseña pasan
por rutas que exigen un administrativo autenticado.
