# HIS / OptiMed - Frontend

Frontend del sistema de gestión hospitalaria (HIS). Es una aplicación de página única con Vue 3 (^3.5), Composition API (`<script setup lang="ts">`), Pinia (^4.1), Vue Router (^5.4), TypeScript y Vite (^8.2). Consume la API NestJS de `apps/api`.

## Cómo correrlo

Todos los comandos se ejecutan desde la raíz del repositorio. Requiere Node `^22.18.0` o `>=24.12.0` (`engines` de `apps/web/package.json`).

```bash
npm install                              # instala API y web (workspaces)
cp apps/web/.env.example apps/web/.env   # define VITE_API_URL
npm run web:dev                          # servidor de desarrollo
```

| Comando | Efecto |
| --- | --- |
| `npm run web:dev` | Servidor de desarrollo de Vite. Puerto por defecto de Vite: 5173 (`vite.config.ts` no lo cambia). |
| `npm --prefix apps/web run build` | Verifica tipos (`vue-tsc`) y genera el build de producción en `apps/web/dist`. |
| `npm --prefix apps/web run type-check` | Solo verificación de tipos. |
| `npm --prefix apps/web run test` | Pruebas con Vitest. |
| `npm --prefix apps/web run preview` | Sirve el build generado. |

**URL de la API.** `src/shared/http.ts` la lee de la variable `VITE_API_URL`. No tiene valor por defecto: si falta, el módulo lanza el error `Falta VITE_API_URL en apps/web/.env` al cargarse. `apps/web/.env.example` define `VITE_API_URL=http://localhost:3000`.

**La API debe estar levantada** para iniciar sesión y usar las pantallas. Los pasos para levantarla (variables de entorno, migraciones, cuenta de superadmin) están en el [README raíz](../../README.md), sección 7 (Instalación y puesta en marcha); las variables, en la sección 8.

## Estructura de `src`

| Carpeta o archivo | Contenido |
| --- | --- |
| `main.ts`, `App.vue` | Arranque: crea Pinia, configura el cliente HTTP (renovación y expiración de sesión) y monta el router. |
| `app/` | `router.ts` (rutas y guardia) y `AppShell.vue` (layout con menú lateral filtrado por rol). |
| `features/` | Pantallas por módulo: `admissions`, `beds`, `billing`, `dashboard`, `ehr`, `feedback`, `iam`, `inventory`, `nursing`, `patients`, `triage`. `iam` incluye el store de sesión (`session.store.ts`), `api.ts`, `types.ts` y `useUsers.ts`; `admissions` incluye `useAppointments.ts`. |
| `stores/` | 6 stores de Pinia: `beds`, `inventory`, `medications`, `notification`, `triage`, `vitals`. Con `features/iam/session.store.ts` son 7 en total. |
| `composables/` | 8 composables: `useBeds`, `useBedsRealtime`, `useCharges`, `useClinicalHistory`, `useFeedback`, `useInventory`, `usePatients`, `useProtocols`. Con `useAppointments` y `useUsers` (dentro de sus features) son 10 en total. |
| `services/` | Funciones de acceso a la API y tipos de cada módulo (`patients`, `turnos`, `charges`, `inventory`, `medications`, `protocols`, `vitalSigns`, `clinicalHistory`, `notifications`, `users`, `reports`, `liquidations`, entre otros). |
| `shared/` | `http.ts` (cliente HTTP), `sse.ts` (lectura de streams SSE), `errors.ts`, `format.ts`, `brand.ts` y `styles/` (`tokens.css`, `base.css`). |
| `components/` | Componentes reutilizables. `components/ui/` tiene los de interfaz base (`BaseCard`, `SideDrawer`, `StatusChip`, `StatCard`, `PageHeader`, `NoticeBanner`, `RoleChip`, `AppIcon`, `BrandMark`); `components/feedback/` tiene las notificaciones, toasts y confirmaciones. |

Las pruebas están en carpetas `__tests__` junto al código que prueban.

## Rutas y roles

Definidas en `src/app/router.ts`. Las vistas se cargan de forma diferida. Roles: `MEDICO`, `ENFERMERO` y `ADMINISTRATIVO`; el indicador `esSuperadmin` de la cuenta no cambia las rutas, solo habilita acciones dentro de Usuarios (ver las cuentas dadas de baja y administrarlas).

| Ruta | Quién accede |
| --- | --- |
| `/login` | Pública. Si ya hay sesión, redirige al panel. |
| `/` (panel) | Cualquier rol autenticado; ver abajo. |
| `/pacientes`, `/camas`, `/camas/:id` | Cualquier rol autenticado |
| `/turnos` | `MEDICO`, `ADMINISTRATIVO` |
| `/triaje` | `ENFERMERO`, `MEDICO` |
| `/enfermeria` (signos vitales, medicaciones, protocolos y `protocolos/:pacienteId`) | `ENFERMERO`, `MEDICO` |
| `/historia-clinica` | `MEDICO`, `ENFERMERO` |
| `/insumos` | `ENFERMERO`, `ADMINISTRATIVO` |
| `/facturacion` | `ADMINISTRATIVO` |
| `/usuarios`, `/usuarios/:id` | `ADMINISTRATIVO` |

La guardia `beforeEach` restaura la sesión, envía a `/login` (conservando la ruta en `redirect`) si no hay sesión y, si el rol no está permitido, redirige al panel. El panel de inicio depende del rol: `MEDICO` ve `DoctorHome`, `ENFERMERO` ve `NurseHome` y `ADMINISTRATIVO` ve `AdminHome` (`features/dashboard/`). El menú lateral solo muestra los ítems permitidos para el rol.

## Conexión con la API

- **Cliente central:** `src/shared/http.ts` expone `http.get`, `post`, `patch`, `delete`, `download` y `stream`, basados en `fetch`. Los errores HTTP y de red se convierten en `ApiError` con estado y mensaje legible.
- **Autenticación:** el access token se guarda en memoria y se envía como `Authorization: Bearer`. El refresh token viaja en una cookie `HttpOnly` administrada por la API; las llamadas a rutas `/auth/` se envían con `credentials: 'include'` (las demás, con `same-origin`).
- **Renovación de sesión:** ante un `401` en una ruta que no es `/auth/`, el cliente llama a `POST /auth/refresh` (una sola renovación a la vez) y reintenta la petición. Si no se puede renovar, limpia la sesión y redirige a `/login` (`main.ts`). Al cargar la aplicación, el router intenta restaurar la sesión con la misma renovación.
- **Tiempo real de camas:** `http.stream` abre `GET /camas/eventos` con `fetch` y el mismo token y renovación de sesión que el resto de las llamadas (el `EventSource` del navegador no envía `Authorization`). `shared/sse.ts` lee el stream y `stores/beds.store.ts` aplica cada cambio a la cama indicada, reconecta con espera creciente y refresca el mapa al reconectar.
- **Descarga de archivos:** `http.download` devuelve el `Blob` y el nombre tomado de `Content-Disposition`. El servicio `services/charges.ts` lo usa en `exportCharges` y `downloadCharges` (`GET /billing/cargos/exportar`).

## Estado conocido

Verificado en el código a la fecha de este README:

- Triaje: `services/triage.ts` trabaja con datos de prueba en memoria; la pantalla de triaje no llama todavía a `/triaje`. Está previsto conectarla.
- Facturación: la acción "Exportar CSV" de `BillingView.vue` arma el CSV en el navegador (`buildChargesCsv` y `downloadCsv` de `features/billing/charge-ui.ts`) con los cargos ya cargados. `downloadCharges` y `exportCharges` (CSV generado por la API) están implementados y probados, pero hoy ninguna pantalla los invoca.
- `services/reports.ts` (reportes de facturación) y `services/liquidations.ts` (liquidaciones) tienen funciones para los endpoints de `/billing`, pero no hay pantalla que los use; `liquidations.ts` solo se importa desde su prueba.
- `services/coverageCatalog.ts` solo define los tipos de los endpoints del catálogo de financiadores y planes de Facturación (`/billing/financiadores` y `/billing/planes`) y ninguna pantalla los usa todavía. Se conserva para una mejora futura.
- Cobertura del paciente: el alta (`POST /pacientes`) y el cambio de cobertura (`PATCH /pacientes/:id/cobertura`) aceptan `tipoCobertura` y `entidadCobertura` (texto libre), pero no `financiadorId`, `planId` ni `numeroAfiliado`, aunque la entidad `Paciente` tiene esas columnas. Por eso las tarifas y el copago por financiador no se aplican desde la aplicación: Facturación, sin `financiadorId` en el paciente, usa el valor base y el copago de la prestación.

## Capturas

Imágenes en [docs/img](../../docs/img/): inicio de sesión, paneles por rol, pacientes, alta de paciente, turnos, camas, inventario y facturación. Se muestran en la sección 17 del [README raíz](../../README.md).

## Pruebas

```bash
npm --prefix apps/web run test
```

Resultado de la última corrida: 7 archivos de prueba y 48 pruebas aprobadas. Cubren sesión, composables (`useBeds`, `useCharges`, `useInventory`), servicios de cargos y liquidaciones, y la descarga del cliente HTTP.
