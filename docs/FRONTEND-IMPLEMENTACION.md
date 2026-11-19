# Implementación frontend

Describe el frontend Vue 3 del Sistema de Información Hospitalaria tal como está en el código al 18/11/2026 (commit `140aca4` de `main`): qué pantallas consumen la API, cuáles siguen con datos locales y qué servicios existen sin pantalla que los use.

## Configuración y validación

El frontend requiere que `apps/web/.env` defina la ubicación de la API (hay un ejemplo en `apps/web/.env.example`):

```env
VITE_API_URL=http://localhost:3000
```

Desde la raíz del repositorio:

```bash
npm run web:dev                          # desarrollo (Vite, puerto 5173)
npm --prefix apps/web run type-check     # vue-tsc --build
npm --prefix apps/web run test           # vitest
npm --prefix apps/web run build          # type-check y build de producción
```

Estado de las comprobaciones: `type-check` sin errores; `test` con 48 pruebas aprobadas en 7 archivos (ver "Pruebas automatizadas").

## Sesión y autorización

- La sesión se administra con Pinia en `src/features/iam/session.store.ts`.
- El access token permanece en memoria; el refresh token usa una cookie `HttpOnly` y no se almacena en `localStorage`.
- `src/shared/http.ts` agrega el `Authorization: Bearer`, intenta un único refresco ante un `401` y entrega errores `ApiError` con mensajes legibles. Expone `get`, `post`, `patch`, `delete` y `download` (descarga de archivos con nombre tomado de `Content-Disposition`).
- `src/app/router.ts` aplica guardas de autenticación y metadatos de roles.

## Rutas y menú por rol

| Ruta | Rol requerido | Vista |
| --- | --- | --- |
| `/login` | Pública | Inicio de sesión |
| `/` | Autenticado | Panel con una variante por rol (`homes/AdminHome`, `DoctorHome`, `NurseHome`) |
| `/usuarios`, `/usuarios/:id` | `ADMINISTRATIVO` | Listado y detalle de personal |
| `/turnos` | `MEDICO`, `ADMINISTRATIVO` | Agenda, horarios disponibles, lista de espera y transiciones |
| `/pacientes` | Autenticado | Búsqueda, alta, detalle y cobertura |
| `/camas`, `/camas/:id` | Autenticado | Mapa y detalle de cama (el `id` llega como prop) |
| `/triaje` | `ENFERMERO`, `MEDICO` | Triaje de guardia |
| `/enfermeria` | `ENFERMERO`, `MEDICO` | Contenedor con vistas anidadas `signos-vitales`, `medicaciones` y `protocolos` (con `:pacienteId`) |
| `/insumos` | `ENFERMERO`, `ADMINISTRATIVO` | Stock de insumos |
| `/historia-clinica` | `MEDICO`, `ENFERMERO` | Historia clínica del paciente |
| `/facturacion` | `ADMINISTRATIVO` | Cargos |

El menú lateral (`AppShell.vue`) muestra solo las entradas permitidas para el rol de la sesión. Un `beforeEach` restaura la sesión, redirige a `/login` conservando la ruta de destino y envía al panel a quien no tiene el rol; un `afterEach` actualiza el título del documento.

## Qué consume la API y qué no

| Pantalla | Fuente de datos | Servicio |
| --- | --- | --- |
| Usuarios | API | `services/users.ts` |
| Turnos | API | `services/turnos.ts` |
| Pacientes | API | `services/patients.ts` |
| Signos vitales | API | `services/vitalSigns.ts` |
| Medicación | API | `services/medications.ts` |
| Protocolos de ingreso | API | `services/protocols.ts` |
| Historia clínica | API | `services/clinicalHistory.ts` |
| Insumos | API (solo lectura) | `services/inventory.ts` |
| Facturación (cargos) | API | `services/charges.ts` |
| Notificaciones | API | `services/notifications.ts` |
| Camas | Datos locales en memoria | `services/beds.ts` (con `TODO` hacia `/camas`) |
| Triaje | Datos locales en memoria | `services/triage.ts` (con `TODO` hacia `/triaje`) |

Servicios que existen pero ninguna pantalla usa todavía: `services/liquidations.ts` (liquidaciones), `services/reports.ts` (reportes administrativos), `services/coverageCatalog.ts` (solo tipos del catálogo de financiadores y planes, que se conservan para una mejora futura), `downloadCharges` y `exportCharges` de `services/charges.ts` (exportación CSV generada por el servidor) y `listVitalSignSeries` de `services/vitalSigns.ts`.

El frontend no tiene pantallas para la agenda médica semanal, las excepciones de agenda, las especialidades, la reprogramación ni la cancelación de turnos con motivo, las liquidaciones, los reportes, la administración del inventario (alta, edición, reposición, historial) ni los sectores y habitaciones. El stream `GET /camas/eventos` no se consume.

## Gestión de usuarios

`src/features/iam/useUsers.ts` concentra carga, alta, detalle, estados de espera y mensajes de error.

- `useUsers` expone `cargar` (`GET /usuarios`, con `incluirBajas`), `cargarPorId` (`GET /usuarios/:id`) y `crear` (`POST /usuarios`). `UserDetailView.vue` llama directamente a `services/users.ts` para editar nombre y apellido, definir el horario, habilitar, deshabilitar, dar de baja y restaurar (`PATCH` correspondientes). `PATCH /usuarios/:id/restablecer-clave` no tiene servicio ni pantalla.
- El alta general permite los roles `MEDICO` y `ENFERMERO`, conforme al contrato de `POST /usuarios`.
- La interfaz contempla carga, lista vacía, errores y reintento.
- `UsuariosForm.vue` comunica resultados con props tipadas y eventos; `UsersTable.vue` expone un slot de acciones por fila; `UserStatusChip.vue` representa el estado de cada cuenta.

## Agenda de turnos

`src/features/admissions/useAppointments.ts` encapsula el estado de la agenda. `services/turnos.ts` consume:

- `GET /turnos/agenda` y `GET /turnos/disponibles`.
- `POST /turnos` (reserva) y `POST /turnos/entreturno`.
- `PATCH /turnos/:id/transiciones` y `GET /turnos/transiciones`.
- `GET /turnos/espera`, `POST /turnos/espera` y `DELETE /turnos/espera/:id` (lista de espera de entreturnos).

Un médico gestiona su propia agenda; un administrativo selecciona un médico desde el listado de usuarios. La agenda es un tablero con una columna por estado; cada turno ofrece botones de destino según la tabla de `GET /turnos/transiciones` ("→ estado" y "Cancelar") y también se puede arrastrar entre columnas. Se pide la transición aunque el destino parezca inválido: la regla vive en el backend y el `409` se muestra al usuario. Cancelar pide una confirmación y se hace por `PATCH /turnos/:id/transiciones`, sin motivo.

La interfaz muestra estados de carga, vacío, error y reintento. La reserva toma el paciente de la búsqueda de pacientes (`NewAppointmentPanel.vue`).

## Pacientes

`PatientsView.vue` usa `composables/usePatients.ts` y `services/patients.ts` (`GET /pacientes?q=`, `GET /pacientes/:id`, `POST /pacientes` y `PATCH /pacientes/:id/cobertura`). Los formularios de alta y cobertura (`CoverageFields.vue`) envían el tipo de cobertura y la entidad como texto; no envían financiador, plan ni número de afiliado.

## Enfermería e inventario

Las pantallas de Enfermería e Insumos consumen la API real mediante `shared/http.ts`:

- **Signos vitales** (`/enfermeria/signos-vitales`, store `vitals.store.ts`): el formulario carga sistólica, diastólica, frecuencia cardíaca y temperatura de un paciente elegido con `PatientPicker` y valida rangos plausibles antes de enviar. `services/vitalSigns.ts` guarda el control completo con un único `POST /signos-vitales/controles` y arma el listado con `GET /signos-vitales/controles`, que devuelve un registro por control. La nota y el estado crítico (temperatura mayor a 39 °C) vienen del backend, que además publica la alerta. Solo el rol `ENFERMERO` ve el formulario.
- **Medicación** (`/enfermeria/medicaciones`, store `medications.store.ts`): `services/medications.ts` lista `GET /indicaciones` y muestra una fila por dosis del día. "Administrar" lo ve solo el `ENFERMERO` y llama a `POST /indicaciones/:id/administraciones`; el backend valida la ventana de ±30 min, registra al enfermero de la sesión y descuenta el insumo. Los `409` se muestran con el mensaje del servidor. Tras administrar se vuelven a consultar medicaciones e inventario.
- **Protocolos de ingreso** (`/enfermeria/protocolos`): `ProtocolsView.vue` registra un ingreso con `POST /protocolos/ingresos` (motivos "Cirugía programada" o "Infección respiratoria") y `ProtocolPatientView.vue` (`/enfermeria/protocolos/:pacienteId`) lista los protocolos del paciente con `GET /protocolos?pacienteId=` mediante `composables/useProtocols.ts`. `ProtocolChecklist.vue` marca y desmarca tareas con `PATCH /protocolos/:protocoloId/tareas/:tareaId`.
- **Inventario** (`/insumos`, store `inventory.store.ts`): lista `GET /resources/inventory` y resalta el stock bajo con un umbral fijo en el cliente (`LOW_STOCK_THRESHOLD`, 10 unidades), distinto del `stockMinimo` de cada insumo en el backend. El frontend no descuenta stock: lo hace el backend al administrar.
- **Panel por rol**: las pantallas de inicio de médico, enfermería y administrativo usan los stores anteriores, la agenda y los cargos. El rol administrativo no consulta signos vitales ni indicaciones (la API responde `403`).

Mejoras posibles (no implementadas): pantalla para que el médico cree indicaciones (`POST /indicaciones` ya existe), campo de observaciones al administrar e historial de signos por paciente.

## Historia clínica

`src/features/ehr/ClinicalHistoryView.vue` (ruta `/historia-clinica`) consume `GET /historia-clinica/:pacienteId` mediante `composables/useClinicalHistory.ts` y `services/clinicalHistory.ts`, que además tiene la consulta de `GET /historia-clinica/:pacienteId/timeline` (sin pantalla que la use).

- Buscador de paciente (`PatientPicker`); muestra la ficha demográfica y las secciones de alergias, antecedentes familiares, evoluciones médicas y estudios, con autor y fecha de cada registro, del más nuevo al más viejo.
- Solo el rol `MEDICO` ve los formularios de alta (`POST /historia-clinica/:pacienteId/{alergias,antecedentes-familiares,evoluciones,estudios}`); los errores de la API (`400`, `403`, `404`) se muestran bajo el formulario. Tras guardar se vuelve a consultar la historia.
- Estados: sin paciente elegido, cargando, error con botón Reintentar y vacío por sección.
- No hay edición ni borrado: la historia es inmutable. La pantalla no usa las rectificaciones ni los adjuntos de estudios.

## Facturación

`src/features/billing/BillingView.vue` (ruta `/facturacion`, solo `ADMINISTRATIVO`) muestra los cargos con tarjetas de resumen, tabla y panel de detalle (`ChargeDetailPanel.vue`).

- `composables/useCharges.ts` carga todos los cargos recorriendo `GET /billing/cargos` de a 100 (`listCharges`, que sigue pidiendo páginas hasta cubrir `total`).
- El filtro por período, el filtro por tipo, la búsqueda por texto y la paginación de 10 filas se aplican en el cliente sobre los cargos cargados. La pantalla no envía los filtros (`desde`, `hasta`, `estado`, `tipoAtencion`, `pacienteId`) al servidor.
- "Exportar CSV" genera el archivo en el navegador con `buildChargesCsv` (`charge-ui.ts`) a partir de los cargos filtrados; no usa `GET /billing/cargos/exportar`.
- La pantalla no permite pagar ni anular cargos, ni ver liquidaciones o reportes.
- Los tipos TypeScript de `services/charges.ts` y las etiquetas de `charge-ui.ts` (`CONCEPTO`, `TIPO_LABEL`) declaran `REGULAR`, `URGENCIA` e `INTERNACION`: los cargos de farmacia (`FARMACIA`) llegan en el listado pero no tienen etiqueta ni concepto definidos en la pantalla (`ChargeFilters.tipoAtencion` sí acepta `FARMACIA`).

## Criterios frontend demostrados

- Comunicación entre componentes mediante props tipadas, eventos y slots.
- Composables para Usuarios, Turnos, Pacientes, Cargos, Protocolos, Historia clínica e Inventario.
- Rutas anidadas, guardas por rol y rutas dinámicas (`/usuarios/:id`, `/camas/:id`, `/enfermeria/protocolos/:pacienteId`).
- Conexión a API con estados de carga, vacío, error y reintento.
- Uso de `v-model`, `v-for`, `v-if` y `v-show`.
- Panel por rol y flujos de negocio respaldados por endpoints existentes.

## Pruebas automatizadas del frontend

Pruebas unitarias con Vitest sobre stores, composables y servicios.

| Archivo | Cobertura |
| --- | --- |
| `src/features/iam/__tests__/session.store.spec.ts` | Estado de sesión, inicio y cierre de sesión, restauración y actualización de sesión |
| `src/composables/__tests__/useBeds.spec.ts` | Estado inicial, cálculo de camas ocupadas, carga y manejo de errores |
| `src/composables/__tests__/useInventory.spec.ts` | Estado inicial, carga de inventario, identificación de stock bajo y manejo de errores |
| `src/composables/__tests__/useCharges.spec.ts` | Carga y totales de cargos |
| `src/services/__tests__/charges.spec.ts` | Servicio de cargos: paginación, filtros y exportación |
| `src/services/__tests__/liquidations.spec.ts` | Servicio de liquidaciones |
| `src/shared/__tests__/http.download.spec.ts` | Descarga de archivos del cliente HTTP |

Desde la raíz: `npm --prefix apps/web run test`.

Resultado el 18/11/2026: 7 archivos de prueba y 48 pruebas aprobadas.
