# Reglas de Proyecto - HIS / OptiMed

## Contexto
Sistema de gestión hospitalaria (HIS). Monorepo con API (NestJS) y web (Vue 3).
Idioma: explicaciones en español; código, commits y nombres en inglés.

## Estructura del repo
- `apps/api`: backend NestJS (capas `api`, `application`, `domain`, `infrastructure`).
- `apps/web`: frontend Vue 3.
- `packages/contracts`: DTOs y tipos compartidos.
- `docs/`: documentación. Consultala antes de asumir requisitos.
- `pacientes-api-admissions/`: ignorar salvo que se pida explícitamente. No importar desde acá.

## Arquitectura y Backend
- Monolito modular (NestJS en `apps/api`). Prohibido proponer microservicios.
- Hexagonal "light": la capa de dominio (`domain`) NO debe importar NestJS ni TypeORM.
- Naming convention: código en `camelCase`, base de datos en `snake_case` usando `SnakeNamingStrategy`.
- Concurrencia crítica: usar transacciones con bloqueo pesimista (`pessimistic_write` / `SELECT ... FOR UPDATE`) al reservar turnos, asignar camas o tocar inventario. Retornar error 409 ante conflicto.
- Base de datos: nunca usar `synchronize: true`. Siempre generar y aplicar migraciones versionadas.
- Patrones en uso: State (turnos, camas), Strategy (cobertura), Builder (protocolos). Seguirlos, no reemplazarlos.
- Eventos entre módulos: bus de eventos compartido en memoria. No introducir colas externas.
- Roles actuales: `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO`. No cambiarlos sin consultar.
- Entidades en `apps/api/src/entities`. Toda entidad nueva debe registrarse en `src/data-source.ts`.

## Frontend
- Vue 3 + Pinia + Vue Router en `apps/web`.
- Usar siempre Composition API (`<script setup lang="ts">`).
- Organización por features (`admissions`, `beds`, `billing`, etc.).

## Tipos Compartidos
- Usar DTOs y tipos exportados desde `packages/contracts`. No duplicar tipos en api o web.

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
- Aplicar migraciones: `npm --prefix apps/api run migration:run`

## Testing
- Framework: vitest (NO jest). Los tests deben llamarse `*.spec.ts`; vitest ignora `*.test.ts`.
- Todo cambio en dominio o servicios lleva tests unitarios.
- Los flujos con concurrencia (turnos, camas, inventario) deben testear el 409.
- Antes de dar una tarea por terminada: correr tests y lint, y reportar el resultado.
- Línea base: 306 tests pasando, 7 omitidos. No debe bajar.

## Estado del proyecto
- Completas: Admisión 1.1 y 1.2, Recursos 1.1 y 3.1, Facturación 1.1 y 2.1, Enfermería 1.1 y 1.2 (las de Enfermería, solo en la rama `feature/nursing-ehr-integracion` hasta que se mergee el PR #17).
- Casi completas: Admisión 1.3 y 2.1 (avisos solo como eventos en memoria), Recursos 2.1 (sin tiempo real), Enfermería 2.1 (nadie publica `patient.admitted`).
- Sin implementar: Admisión 3.1 Triaje (existen `triage.service.ts` y un DTO, pero no hay controlador ni registro en el módulo; la cola está en memoria).

## Pendientes priorizados
1. Triaje (Admisión 3.1): crear controlador, registrar `TriageService` en el módulo y persistir la cola.
2. Publicar el evento `patient.admitted` al ingresar un paciente (requiere el PR #17 mergeado).
3. Usar el servicio de notificaciones para los avisos de Admisión 1.3 y 2.1.
4. Subir cobertura de IAM (66 %) e incluir los `.test.ts` de estados de cama en vitest.
5. Limpieza:
   - Borrar archivos `.orig` y `.rej`.
   - Dejar un solo `enableCors` en `main.ts`.
   - Registrar `Notificacion` en `data-source.ts`.
   - Corregir el timestamp duplicado en migraciones.
   - Agregar `@ApiTags` y `@ApiOperation` al controlador de notificaciones.
   - Quitar imports de NestJS en los 2 archivos de dominio de facturación (viola la regla hexagonal).

## Cómo trabajar
- Una tarea por vez, con cambios pequeños.
- Antes de editar, leer el código existente y seguir sus patrones.
- No instalar dependencias nuevas sin avisar y justificar.
- No tocar migraciones ya aplicadas: crear una nueva.
- Nunca commitear secretos ni archivos `.env`.
- Si algo es ambiguo, preguntar antes de asumir.