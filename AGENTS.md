# Reglas de Proyecto - HIS / OptiMed

## Contexto
Sistema de gestión hospitalaria (HIS). Monorepo con API (NestJS) y web (Vue 3).
Idioma: explicaciones en español; código, commits y nombres en inglés.

## Estructura del repo
- `apps/api`: backend NestJS (capas `api`, `application`, `domain`, `infrastructure`).
- `apps/web`: frontend Vue 3.
- `packages/contracts`: reservado para DTOs y tipos compartidos; hoy está vacío (ver "Tipos compartidos").
- `docs/`: documentación. Consultala antes de asumir requisitos.
- `pacientes-api-admissions/`: ignorar salvo que se pida explícitamente. No importar desde acá.

## Arquitectura y Backend
- Monolito modular (NestJS en `apps/api`). Prohibido proponer microservicios.
- Hexagonal "light": la capa de dominio (`domain`) NO debe importar NestJS ni TypeORM.
- Naming convention: código en `camelCase`, base de datos en `snake_case` usando `SnakeNamingStrategy`.
- Concurrencia crítica: usar transacciones con bloqueo pesimista (`pessimistic_write` / `SELECT ... FOR UPDATE`) al reservar turnos, asignar camas o administrar medicación. El inventario usa un `UPDATE` condicional atómico. Retornar error 409 ante conflicto.
- Base de datos: nunca usar `synchronize: true`. Todo cambio de esquema va en una migración versionada, escrita a mano e idempotente (`IF NOT EXISTS`). No usar la salida de `migration:generate`: la base es más estricta que las entidades y el comando siempre propone borrar restricciones e índices.
- Patrones en uso: State (turnos, camas), Strategy (cobertura), Builder (protocolos). Seguirlos, no reemplazarlos.
- Eventos entre módulos: bus de eventos compartido en memoria. No introducir colas externas. Publicar siempre después del commit; los suscriptores no propagan errores y deben ser idempotentes. La tabla de quién publica y quién escucha está en `docs/ARQUITECTURA.md`.
- Roles actuales: `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` (más el indicador de superadmin). No cambiarlos sin consultar. La equivalencia con los cinco roles del documento de diseño está en el README, sección 12.
- Entidades en `apps/api/src/entities`. Toda entidad nueva debe registrarse en `src/data-source.ts`.

## Frontend
- Vue 3 + Pinia + Vue Router en `apps/web`.
- Usar siempre Composition API (`<script setup lang="ts">`).
- Organización por features (`admissions`, `beds`, `billing`, etc.).

## Tipos compartidos
- `packages/contracts` no contiene contratos. Hoy los DTOs viven en `apps/api/src/modules/<módulo>/api/dto` y los tipos del frontend en `apps/web/src/services`.
- Al cambiar un contrato de la API, actualizar el tipo correspondiente del frontend y `docs/CONTRATOS-Y-GIT.md`.

## Comandos (desde la raíz)
- Instalar: `npm install`
- API en desarrollo: `npm run api:dev`
- API build: `npm run api:build`
- Web en desarrollo: `npm run web:dev`
- Tests API: `npm run api:test` (vitest)
- Tests API con cobertura: `npm --prefix apps/api run test:cov`
- Lint API: `npm --prefix apps/api run lint` (oxlint)
- Tests web: `npm --prefix apps/web run test`
- Type-check web: `npm --prefix apps/web run type-check`
- Generar migración: `npm --prefix apps/api run migration:generate -- <ruta/NombreMigracion>`
- Aplicar migraciones: `npm --prefix apps/api run migration:run` (solo contra una base local; ver "Cómo trabajar")
- Prueba funcional contra servidor y base locales: `node scripts/functional-check.mjs` desde `apps/api` (ver `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`)

## Testing
- Framework: vitest (NO jest). Vitest ejecuta `*.spec.ts` y `*.test.ts` (`include: **/*.{spec,test}.ts`). Para tests nuevos usar `*.spec.ts`.
- Todo cambio en dominio o servicios lleva tests unitarios.
- Los flujos con concurrencia (turnos, camas, inventario, medicación) deben testear el 409.
- Antes de dar una tarea por terminada: correr build, tests y lint, y reportar el resultado.
- Línea base (19/11/2026, `main` en `4c0b4e5`): API con 1250 tests pasando y 21 omitidos, lint con 11 warnings; frontend con 123 tests pasando en 12 archivos. No debe empeorar.
- Los 21 omitidos necesitan una base real y solo corren contra PostgreSQL local (README, sección 14). Nunca apuntarlos a la base compartida.

## Estado del proyecto
Verificado el 19/11/2026 sobre `main` (commit `4c0b4e5`). Las cifras y el detalle están en el README y en `docs/`. La verificación contra servidor y base reales del 10/11/2026 está en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`.

- Backend completo: Admisión (turnos, agenda médica, especialidades, cancelación y reprogramación, triaje con cola persistida); Enfermería; Recursos (camas con tiempo real por `GET /camas/eventos`, inventario con historial de movimientos y alerta de stock bajo); Facturación (cargos con estados, nomenclador, coberturas, listado paginado con exportación CSV, reportes y liquidaciones a terceros); IAM con auditoría; Historia clínica.
- Outbox persistente para los eventos durables (cargos, descuento de stock y cambios de cama); ver `docs/ARQUITECTURA.md`.
- `patient.admitted` lo publica Recursos al asignar una cama con `motivoIngreso`.
- Frontend: consume la API en todas las pantallas salvo triaje, que sigue con datos locales en memoria. Camas usa `/camas` y `GET /camas/eventos` (con `fetch`, no `EventSource`).

## Deuda técnica
- Outbox parcial: solo los ocho tipos de `DURABLE_EVENT_TYPES` tienen entrega durable; las notificaciones, el protocolo de ingreso y el stock bajo se entregan en memoria y sin reintento (README, sección 19).
- Historial de migraciones de la base compartida desincronizado con `main`: `migration:run` falla ahí hasta que se registre `AddInsumoPrice1793600000000` (detalle y arreglo en el documento de pruebas funcionales, sección 3).
- Las entidades y el esquema difieren en restricciones, índices y longitudes; por eso `migration:generate` no es confiable.
- Entidades TypeORM en `src/entities/` en lugar de la infraestructura de cada módulo.
- `packages/contracts` vacío.
- Nomenclador provisorio: valores y copago fijos en las migraciones, sin endpoint para administrarlos ni para cargar tarifas por financiador.
- El alta y el cambio de cobertura del paciente no reciben financiador, plan ni número de afiliado; los cargos quedan sin financiador y no se liquidan con datos reales.
- Protocolos de ingreso solo para los dos motivos definidos en las historias de usuario.
- Dos errores 500 por validación (verificados el 18/11/2026): `GET` y `PATCH` de `/usuarios/:id` con un id que no es UUID, y `POST /camas` con un `numero` de más de 10 caracteres (el DTO admite 50 y la columna 10).
- 11 warnings de lint (línea base).

## Pendientes
1. Sincronizar la tabla `migrations` de la base compartida y aplicar ahí las migraciones pendientes.
2. Conectar el frontend de triaje a `/triaje`.
3. Permitir financiador, plan y número de afiliado en el alta y en el cambio de cobertura, con su selector en el frontend (los tipos del catálogo están en `apps/web/src/services/coverageCatalog.ts`).
4. Definir con el docente el nomenclador (copago de prepaga y tarifas por financiador).
5. Corregir los dos errores 500 por validación.

## Cómo trabajar
- Una tarea por vez, con cambios pequeños.
- Antes de editar, leer el código existente y seguir sus patrones.
- No afirmar que algo está hecho sin verificarlo: correr build, tests y lint, y decir qué se probó y qué no.
- No correr `migration:run` ni tests de integración sin confirmación, y nunca contra la base compartida sin avisar al equipo. Probar primero en una base local.
- No instalar dependencias nuevas sin avisar y justificar.
- No tocar migraciones ya aplicadas: crear una nueva.
- Nunca commitear secretos ni archivos `.env`.
- Si algo es ambiguo, preguntar antes de asumir.
