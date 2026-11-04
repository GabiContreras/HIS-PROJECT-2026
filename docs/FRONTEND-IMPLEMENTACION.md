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
| `MEDICO` | Panel, agenda de Turnos, Enfermería e Historia clínica (lectura y alta) |
| `ENFERMERO` | Panel, Enfermería, Insumos e Historia clínica (solo lectura); la pantalla de turnos disponibles queda pendiente |

## Rutas

| Ruta | Rol requerido | Descripción |
|---|---|---|
| `/login` | Pública | Inicio de sesión |
| `/` | Autenticado | Panel con accesos por rol |
| `/usuarios` | `ADMINISTRATIVO` | Listado y alta de personal médico/enfermero |
| `/usuarios/:id` | `ADMINISTRATIVO` | Detalle de usuario |
| `/turnos` | `MEDICO`, `ADMINISTRATIVO` | Agenda, creación de franjas y transiciones |
| `/historia-clinica` | `MEDICO`, `ENFERMERO` | Historia clínica del paciente: ficha, alergias, antecedentes familiares, evoluciones y estudios |

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

## Enfermería e inventario (Módulo 1)

Las pantallas de Enfermería e Insumos consumen la API real mediante `shared/http.ts`:

- **Signos vitales** (`/enfermeria/signos-vitales`, store `vitals.store.ts`): el formulario carga sistólica, diastólica, frecuencia cardíaca y temperatura de un paciente elegido con `PatientPicker` y valida rangos plausibles antes de enviar. `services/vitalSigns.ts` guarda el control completo con un único `POST /signos-vitales/controles` y arma el listado con un único `GET /signos-vitales/controles`, que devuelve un registro por control. La nota y el estado crítico (temperatura mayor a 39 °C) vienen del backend, que además publica la alerta. Los registros sueltos creados con el endpoint viejo (`POST /signos-vitales`, un valor por vez) no aparecen en la lista. Solo el rol ENFERMERO ve el formulario.
- **Medicación** (`/enfermeria/medicaciones`, store `medications.store.ts`): `services/medications.ts` lista `GET /indicaciones` y muestra una fila por dosis del día. "Administrar" lo ve solo el ENFERMERO y llama a `POST /indicaciones/:id/administraciones`; el backend valida la ventana de ±30 min, registra al enfermero de la sesión y descuenta el insumo. Los `409` se muestran con el mensaje del servidor. Tras administrar se vuelven a consultar medicaciones e inventario.
- **Inventario** (`/insumos`, store `inventory.store.ts`): `GET /resources/inventory`; el frontend ya no descuenta stock, lo hace el backend al administrar.
- **Protocolos de ingreso** (`/enfermeria/protocolos`): la pantalla `ProtocolsView.vue` sigue generando el plan de cuidados en el cliente. `services/protocols.ts` incluye además `listProtocols` y `useProtocols` (`GET /protocolos?pacienteId=`) para mostrar los protocolos que el backend genera al admitir al paciente (Patrón Builder); todavía no se usan en ninguna pantalla.
- **Dashboard por rol**: las pantallas de inicio de médico y enfermería usan los stores anteriores; el rol administrativo no consulta signos vitales ni indicaciones (la API responde `403`) y sí el inventario.

Mejoras posibles (no implementadas): pantalla para que el médico cree indicaciones (`POST /indicaciones` ya existe), campo de observaciones al administrar, historial de signos por paciente y mostrar en pantalla los protocolos generados por el backend.

## Historia clínica (Módulo 1)

`src/features/ehr/ClinicalHistoryView.vue` (ruta `/historia-clinica`, entrada de menú "Historia clínica" para médico y enfermero) consume `GET /historia-clinica/:pacienteId` mediante `useClinicalHistory` (`composables/`) y `services/clinicalHistory.ts`.

- Buscador de paciente (`PatientPicker`); muestra la ficha demográfica y cuatro tarjetas (alergias, antecedentes familiares, evoluciones médicas y estudios) con autor y fecha de cada registro, del más nuevo al más viejo.
- Solo el rol `MEDICO` ve los formularios de alta (`POST /historia-clinica/:pacienteId/{alergias,antecedentes-familiares,evoluciones,estudios}`); el botón se habilita con el texto mínimo y los errores de la API (`400`, `403`, `404`) se muestran bajo el formulario. Tras guardar se vuelve a consultar la historia.
- Estados: sin paciente elegido, cargando, error con botón Reintentar, y vacío por sección (por ejemplo "No hay alergias registradas.").
- No hay edición ni borrado: la historia es inmutable.

## Criterios frontend demostrados

- Comunicación entre componentes mediante props tipadas, eventos y slots.
- Composables para Usuarios y Turnos.
- Rutas anidadas, guardas por rol y ruta dinámica `/usuarios/:id`.
- Conexión a API con estados de carga, vacío, error y reintento.
- Uso de `v-model`, `v-for`, `v-if` y `v-show`.
- Panel por rol y flujos de negocio respaldados por endpoints existentes.
