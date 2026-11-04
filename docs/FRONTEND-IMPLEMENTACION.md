# Implementación frontend

Este documento describe los flujos funcionales incorporados al frontend Vue 3 del Sistema de Información Hospitalaria.

## Configuración y validación

El frontend requiere que `apps/web/.env` defina la ubicación de la API:

```env
VITE_API_URL=http://localhost:3000
```

Desde `apps/web`, los comandos de validación son:

```bash
npm run type-check
npm run build
```

## Sesión y autorización

- La sesión se administra con Pinia en `src/features/iam/session.store.ts`.
- El access token permanece en memoria.
- El refresh token usa una cookie HTTP y no se almacena en `localStorage`.
- `src/shared/http.ts` agrega la autorización, intenta un único refresco ante un `401` y entrega errores `ApiError` para mostrar mensajes explícitos.
- `src/app/router.ts` aplica guardas de autenticación y metadatos de roles.

| Rol | Accesos actuales |
|---|---|
| `ADMINISTRATIVO` | Panel, Usuarios y Turnos |
| `MEDICO` | Panel y agenda de Turnos |
| `ENFERMERO` | Panel; la pantalla de turnos disponibles queda pendiente |

## Rutas

| Ruta | Rol requerido | Descripción |
|---|---|---|
| `/login` | Pública | Inicio de sesión |
| `/` | Autenticado | Panel con accesos por rol |
| `/usuarios` | `ADMINISTRATIVO` | Listado y alta de personal médico/enfermero |
| `/usuarios/:id` | `ADMINISTRATIVO` | Detalle de usuario |
| `/turnos` | `MEDICO`, `ADMINISTRATIVO` | Agenda, creación de franjas y transiciones |

## Gestión de usuarios

`src/features/iam/useUsers.ts` concentra carga, alta, detalle, estados de espera y mensajes de error.

- Consume `GET /usuarios`, `POST /usuarios` y `GET /usuarios/:id`.
- El alta general permite los roles `MEDICO` y `ENFERMERO`, conforme al contrato de `POST /usuarios`.
- La interfaz contempla carga, lista vacía, errores y reintento.
- `UsuariosForm.vue` comunica resultados con props tipadas y eventos.
- `UsersTable.vue` expone un slot de acciones por fila.
- `UserStatusChip.vue` representa el estado de cada cuenta.

## Agenda de turnos

`src/features/admissions/useAppointments.ts` encapsula el estado de la agenda y consume:

- `GET /turnos/agenda`
- `POST /turnos`
- `PATCH /turnos/:id/transiciones`

Un médico crea franjas para su propia agenda. Un administrativo selecciona un médico desde el listado de usuarios. Las acciones expuestas respetan las transiciones habilitadas por el backend:

| Estado actual | Acciones disponibles |
|---|---|
| `RESERVADO` | Confirmar, Cancelar |
| `CONFIRMADO` | Marcar atendido, Cancelar |

La interfaz muestra estados de carga, vacío, error y reintento.

### Límites actuales

- No se expone la reserva de turnos: requiere seleccionar un paciente, pero la API no publica un endpoint para listar o buscar pacientes.
- Camas e internaciones no se integran todavía porque el backend no publica controladores HTTP para esos dominios.

## Criterios frontend demostrados

- Comunicación entre componentes mediante props tipadas, eventos y slots.
- Composables para Usuarios y Turnos.
- Rutas anidadas, guardas por rol y ruta dinámica `/usuarios/:id`.
- Conexión a API con estados de carga, vacío, error y reintento.
- Uso de `v-model`, `v-for`, `v-if` y `v-show`.
- Panel por rol y flujos de negocio respaldados por endpoints existentes.
