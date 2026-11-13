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
- Línea base: 577 tests pasando, 7 omitidos; lint con 3 warnings. No debe empeorar.
- Los 7 omitidos necesitan una base real y solo corren contra PostgreSQL local (README, sección 14). Nunca apuntarlos a la base compartida.

## Estado del proyecto
Verificado el 10/11/2026 contra servidor y base reales (`docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`).

- Backend completo: Admisión 1.1, 1.2, 1.3, 2.1 y 3.1 (triaje con cola persistida); Enfermería 1.1, 1.2 y 2.1; Recursos 1.1, 2.1 (con tiempo real por `GET /camas/eventos`) y 3.1; Facturación 1.1 y 2.1; IAM; Historia clínica.
- Enfermería e Historia clínica están en `main`.
- `patient.admitted` lo publica Recursos al asignar una cama con `motivoIngreso`.
- Frontend: las pantallas de camas y de triaje siguen con datos locales en memoria; el resto consume la API.

## Deuda técnica
- Bus de eventos en memoria, sin entrega durable (mejora: Outbox).
- Historial de migraciones de la base compartida desincronizado con `main`: `migration:run` falla ahí hasta que se registre `AddInsumoPrice1793600000000` (detalle y arreglo en el documento de pruebas funcionales, sección 3).
- Las entidades y el esquema difieren en restricciones, índices y longitudes; por eso `migration:generate` no es confiable.
- Entidades TypeORM en `src/entities/` en lugar de la infraestructura de cada módulo.
- `packages/contracts` vacío.
- Copago de prepaga y tarifas con valores fijos provisorios.
- Protocolos de ingreso solo para los dos motivos definidos en las historias de usuario.
- Un test del frontend falla (`stores/__tests__/dashboard.store.spec.ts` importa un store inexistente).
- 3 warnings de lint: dos imports sin usar en specs y un escape innecesario en `BaselineSchema`.

## Pendientes
1. Sincronizar la tabla `migrations` de la base compartida y aplicar ahí las migraciones pendientes.
2. Conectar el frontend de camas a `/camas` y a `GET /camas/eventos` (con `fetch`, no `EventSource`), enviando `motivoIngreso` al asignar.
3. Conectar el frontend de triaje a `/triaje`.
4. Definir con el docente el nomenclador (copago de prepaga y tarifas).
5. Corregir o eliminar el test del frontend que falla.

## Cómo trabajar
- Una tarea por vez, con cambios pequeños.
- Antes de editar, leer el código existente y seguir sus patrones.
- No afirmar que algo está hecho sin verificarlo: correr build, tests y lint, y decir qué se probó y qué no.
- No correr `migration:run` ni tests de integración sin confirmación, y nunca contra la base compartida sin avisar al equipo. Probar primero en una base local.
- No instalar dependencias nuevas sin avisar y justificar.
- No tocar migraciones ya aplicadas: crear una nueva.
- Nunca commitear secretos ni archivos `.env`.
- Si algo es ambiguo, preguntar antes de asumir.
