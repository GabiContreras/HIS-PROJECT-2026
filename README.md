# OptiMed - Sistema de Información Hospitalaria (HIS)

Aplicación web para la gestión de admisión de pacientes, agenda de turnos, camas, insumos y facturación de un hospital. Está organizada como un monorepo con una API REST en NestJS y un cliente en Vue 3.

Proyecto integrador de la Tecnicatura Universitaria en Programación (UTN Facultad Regional San Francisco). Se evalúa en conjunto para Programación IV (frontend en Vue y backend en NestJS) y Metodología / Arquitectura de Software.

Las cifras de este documento (pruebas, migraciones, entidades, rutas) se midieron el 19/11/2026 sobre el commit `4c0b4e5` de `main`.

## Índice

1. [Propósito y alcance](#1-propósito-y-alcance)
2. [Estado de implementación](#2-estado-de-implementación)
3. [Tecnologías](#3-tecnologías)
4. [Arquitectura](#4-arquitectura)
5. [Estructura del repositorio](#5-estructura-del-repositorio)
6. [Requisitos previos](#6-requisitos-previos)
7. [Instalación y puesta en marcha](#7-instalación-y-puesta-en-marcha)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Base de datos y migraciones](#9-base-de-datos-y-migraciones)
10. [Backend (NestJS)](#10-backend-nestjs)
11. [Frontend (Vue 3)](#11-frontend-vue-3)
12. [Autenticación, roles y permisos](#12-autenticación-roles-y-permisos)
13. [Validaciones y manejo de errores](#13-validaciones-y-manejo-de-errores)
14. [Pruebas](#14-pruebas)
15. [Seguridad](#15-seguridad)
16. [Ejemplos de uso](#16-ejemplos-de-uso)
17. [Capturas de pantalla](#17-capturas-de-pantalla)
18. [Guía para la evaluación](#18-guía-para-la-evaluación)
19. [Limitaciones conocidas y mejoras futuras](#19-limitaciones-conocidas-y-mejoras-futuras)
20. [Documentación complementaria](#20-documentación-complementaria)

---

## 1. Propósito y alcance

El sistema resuelve el circuito operativo básico de un hospital a partir de historias de usuario organizadas en módulos:

- **Admisión y turnos**: registro de pacientes, reserva, reprogramación y cancelación de turnos con control de concurrencia, agenda médica semanal con ausencias y feriados, especialidades, entreturnos, lista de espera, triaje de guardia y notificaciones internas.
- **Atención y enfermería**: signos vitales, indicaciones médicas, administración de medicación, notas de enfermería y protocolos de ingreso.
- **Historia clínica**: registros inmutables (alergias, antecedentes, evoluciones, estudios con adjuntos y rectificaciones) y línea de tiempo del paciente.
- **Recursos y camas**: mapa de camas con máquina de estados, ABM de camas, sectores y habitaciones, asignación segura, traslados, internaciones e inventario de insumos con historial de movimientos.
- **Facturación**: cargos automáticos por consulta, farmacia e internación, nomenclador de prestaciones, cálculo según cobertura, catálogo de financiadores y planes, reportes administrativos y liquidaciones a terceros.
- **Identidad y accesos (IAM)**: autenticación, roles y administración de cuentas.

Es un proyecto académico. No está preparado para uso clínico real. El alcance real de cada módulo se detalla en la sección siguiente.

## 2. Estado de implementación

La siguiente tabla refleja el código actual del repositorio, no el alcance planificado. El registro de lo verificado contra un servidor y una base reales el 10/11/2026 está en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`: es un registro histórico y no describe el estado de este commit.

| Módulo | Backend (API) | Frontend |
| --- | --- | --- |
| IAM (login, refresh, roles, usuarios, baja lógica) | Implementado | Conectado a la API |
| Admisión: pacientes | Implementado (alta, edición, cobertura, búsqueda paginada, turnos del paciente) | Conectado a la API |
| Admisión: turnos, entreturnos, lista de espera, transiciones | Implementado, con reprogramación y cancelación con motivo; los avisos al consultorio y a recepción se guardan como notificaciones | Conectado a la API (sin pantallas de reprogramación ni de cancelación con motivo) |
| Admisión: agenda médica semanal, excepciones y especialidades | Implementado (`/agenda-medica`, `/especialidades`) | Sin pantallas |
| Admisión: triaje de guardia | Implementado (`/triaje`), con cola persistida y ordenada por nivel; al atender crea un turno urgente y su cargo | Pantalla con datos locales en memoria |
| Notificaciones | Implementado (`/notificaciones`) | Conectado a la API |
| Recursos: camas (ABM, asignación, alta, traslado, limpieza, bloqueo), sectores, habitaciones e internaciones | Implementado, con cambios de estado en tiempo real (`GET /camas/eventos`) | Mapa, detalle y acciones conectados a la API, con actualización en tiempo real |
| Recursos: inventario | Implementado: ABM de insumos, descuento atómico, reposición, historial de movimientos, stock mínimo con notificación `STOCK_BAJO` y descuento automático al administrar medicación | Solo lectura del stock, conectado a la API |
| Enfermería: signos vitales | Implementado (`/signos-vitales`), con alerta por temperatura mayor a 39 °C | Conectado a la API |
| Enfermería: indicaciones y medicación | Implementado (`/indicaciones`): ventana de ±30 minutos, omisiones, suspensión y ejecución de indicaciones no medicamentosas | Conectado a la API (medicación; sin pantalla para crear indicaciones) |
| Enfermería: notas | Implementado (`/notas-enfermeria`) | Sin pantalla |
| Enfermería: protocolos de ingreso (patrón Builder) | Implementado (`/protocolos`); se generan al asignar una cama con motivo de ingreso o por alta manual, con checklist de tareas | Conectado a la API |
| Historia clínica electrónica | Implementado (`/historia-clinica`): registros, rectificaciones, adjuntos de estudios y línea de tiempo | Conectado a la API (sin rectificaciones ni adjuntos) |
| Facturación: cargos por consulta, farmacia e internación | Implementado (`/billing/cargos`): estados, listado paginado con filtros, exportación CSV y resumen | Conectado a la API (filtros y exportación en el cliente) |
| Facturación: nomenclador, catálogo de financiadores y planes, reportes y liquidaciones | Implementado (`/billing/financiadores`, `/billing/reportes`, `/billing/liquidaciones`); valores del nomenclador provisorios | Sin pantallas |
| Eventos entre módulos | Bus en memoria y Outbox persistente para los eventos durables | No aplica |

La pantalla de triaje trabaja con datos locales en memoria y marca en el código el endpoint que debe consumir con un comentario `TODO` (`apps/web/src/services/triage.ts`). Sus datos se pierden al recargar la página. El endpoint ya existe en la API.

## 3. Tecnologías

| Capa | Tecnología | Versión declarada |
| --- | --- | --- |
| Entorno de ejecución | Node.js | `^22.18.0 \|\| >=24.12.0` (campo `engines` del frontend) |
| Backend | NestJS (`@nestjs/common`, `core`, `platform-express`, `config`, `typeorm`) | `^12.0.1` |
| ORM | TypeORM | `^1.1.1` |
| Base de datos | PostgreSQL (el entorno compartido usa Supabase), driver `pg` | `^8.23.0` |
| Validación | `class-validator`, `class-transformer` | `^0.15.1`, `^0.5.1` |
| Documentación de API | `@nestjs/swagger` | `^12.0.2` |
| Eventos internos | RxJS | `^7.8.1` |
| Pruebas backend | Vitest, Supertest, `@nestjs/testing` | `^4.1.2`, `^7.3.2`, `^12.0.1` |
| Pruebas frontend | Vitest | `^4.1.11` |
| Lint y formato (API) | oxlint, Prettier | `^1.58.0`, `^3.4.2` |
| Frontend | Vue 3, vue-router, Pinia | `^3.5.42`, `^5.4.0`, `^4.1.0` |
| Build frontend | Vite, vue-tsc | `^8.2.2`, `^3.3.11` |
| Lenguaje | TypeScript | `^6.0.2` (API), `~6.0.0` (web) |

El frontend usa la API `fetch` del navegador, sin Axios. Las versiones corresponden a las declaradas en los `package.json`; las instaladas pueden ser posteriores dentro del rango (ver `package-lock.json`).

## 4. Arquitectura

### 4.1 Monolito modular con capas hexagonales

El backend es un monolito modular. Cada módulo de dominio (`iam`, `admissions`, `ehr`, `nursing`, `resources`, `billing`, `health`) se organiza, cuando está desarrollado, en las siguientes capas:

```text
modules/<modulo>/
  domain/           reglas del dominio, estados, estrategias y puertos (interfaces)
  application/      casos de uso y servicios de aplicación
  infrastructure/   repositorios TypeORM y servicios técnicos
  api/              controladores y DTOs HTTP
  <modulo>.module.ts
```

Dependencias permitidas: `api -> application -> domain`. La capa `infrastructure` implementa los puertos definidos por el dominio. Las entidades TypeORM permanecen en `apps/api/src/entities/` y se comparten entre módulos. Mover cada entidad a la infraestructura de su módulo es una tarea pendiente (ver sección 19).

Justificación: el equipo es de seis personas y el plazo es de aproximadamente doce semanas, por lo que se eligió un monolito modular en lugar de microservicios. Se reduce la complejidad de despliegue y se conservan límites de dominio claros.

### 4.2 Patrones de diseño implementados

| Patrón | Dónde | Descripción |
| --- | --- | --- |
| State | `modules/admissions/domain/states/` | Estados del turno: `RESERVADO`, `CONFIRMADO`, `EN_SALA_DE_ESPERA`, `ATENDIDO` y `CANCELADO`. Las transiciones inválidas se rechazan con 409. |
| State | `modules/resources/domain/state/` | Estados de la cama: `LIBRE`, `OCUPADA`, `EN_LIMPIEZA`, `BLOQUEADA`. Una cama ocupada solo pasa a limpieza tras el alta. |
| State | `modules/billing/domain/estado-cargo.ts` | Estados del cargo: `PENDIENTE`, `FACTURADO`, `PAGADO` y `ANULADO`. Un cargo pagado o anulado no cambia; una transición inválida se rechaza con 409. |
| Strategy | `modules/billing/domain/` | Prestación asociada al tipo de atención (consulta regular y de urgencia) y reparto del costo según cobertura (pública, prepaga y particular). |
| Builder | `modules/nursing/domain/protocolo/` | Protocolos de ingreso: `PreOpProtocolBuilder` y `RespiratoryProtocolBuilder`, elegidos por `ProtocolDirector` según el motivo de ingreso. |
| Ports and adapters | `modules/*/domain/ports/` | Repositorios definidos como interfaces en el dominio. |
| Observer / eventos | `src/shared/events/` | Bus de eventos interno (RxJS) y Outbox persistente para los eventos que no se pueden perder. |

### 4.3 Concurrencia

La reserva y reprogramación de turnos, los cambios de estado, la asignación y el traslado de camas, la administración de medicación y los cambios de estado de cargos se ejecutan en transacciones con bloqueo pesimista (`pessimistic_write`, equivalente a `SELECT ... FOR UPDATE`). El descuento y la reposición de inventario usan una única sentencia `UPDATE` atómica (`cantidad_disponible >= cantidad` en el descuento), que nunca deja el stock en negativo. La liquidación a terceros toma y marca los cargos en una sola transacción: de dos pedidos simultáneos sobre el mismo rango, solo uno crea la liquidación. Ante un conflicto, la API responde `409` en lugar de asignar dos veces el mismo recurso. Las entidades `Turno` y `Cama` además tienen columna `@VersionColumn()`, y la base refuerza las reglas con índices únicos (una internación activa por cama y por paciente, un cargo por turno, por administración y por internación).

### 4.4 Eventos

`EventBus` (`src/shared/events`) combina dos mecanismos. Al publicar, emite el evento a los suscriptores en memoria (RxJS) y, si el tipo está en `DURABLE_EVENT_TYPES`, lo guarda además en la tabla `outbox_events` y lo entrega a los consumidores del Outbox. Los eventos se publican **después** de confirmar la transacción de negocio. Los suscriptores en memoria nunca propagan errores al bus; los registran en el log.

**Outbox.** `OutboxService` guarda cada evento durable con estado `PENDIENTE` y lo entrega de inmediato a los consumidores registrados. La entrega a cada consumidor corre en una transacción que bloquea la fila, ejecuta el manejador y anota el consumidor en `delivered_consumers`; cuando todos recibieron el evento pasa a `PROCESADO`, y un consumidor ya registrado no se vuelve a ejecutar. Si un consumidor falla, el evento reintenta con espera creciente (5 s, duplicada en cada intento, con tope de 300 s) hasta 10 intentos; después queda en `FALLIDO`. `OutboxWorker` revisa la tabla al arrancar y cada 15 segundos (hasta 50 eventos vencidos por ciclo). La fila se inserta después del commit del cambio de negocio, no dentro de la misma transacción: si el proceso cae justo entre ambos pasos, el evento se pierde. Si no se puede insertar la fila, el evento se entrega a los consumidores solo en memoria. El detalle está en `docs/ARQUITECTURA.md`.

| Evento | Lo publica | Entrega | Lo escucha | Efecto |
| --- | --- | --- | --- | --- |
| `admissions.appointment-attended` | Admisión, al pasar un turno a `ATENDIDO` o al atender un triaje | Outbox | Facturación | Crea el cargo de consulta (único por `turno_id`) |
| `medication.administered` | Enfermería, al confirmar una dosis | Outbox | Recursos y Facturación | Descuenta el insumo del inventario y crea el cargo de farmacia (único por administración) |
| `bed.released` | Recursos, en el alta | Outbox | Facturación y stream de camas | Crea el cargo de internación (único por internación) y se reenvía por `GET /camas/eventos` |
| `bed.assigned`, `bed.cleaned`, `bed.transferred`, `bed.blocked`, `bed.unblocked` | Recursos, en cada cambio de cama | Outbox | Stream de camas | Se reenvían por `GET /camas/eventos` |
| `patient.admitted` | Recursos, al asignar una cama con `motivoIngreso` | Memoria | Enfermería | Genera el protocolo de ingreso (único por internación) |
| `vital-sign.alert-raised` | Enfermería, al registrar un signo vital fuera de rango | Memoria | Admisión | Con temperatura mayor a 39 °C, notificación de alta prioridad al médico responsable de la internación (o a todos los médicos si no hay internación activa) |
| `admissions.patient-waiting` | Admisión, al pasar un turno a `EN_SALA_DE_ESPERA` | Memoria | Admisión | Notificación al médico del turno |
| `admissions.standby-promoted` | Admisión, al promover a un paciente de la lista de espera | Memoria | Admisión | Notificación a los administrativos |
| `inventory.low-stock` | Recursos, cuando un descuento deja el stock en o por debajo del mínimo | Memoria | Recursos | Notificación `STOCK_BAJO` a los administrativos |

Los eventos durables son los ocho de `DURABLE_EVENT_TYPES`; los demás se pierden si el proceso cae antes de procesarlos. `patient.registered`, `appointment.booked` y `appointment.attended` están definidos pero ningún módulo los publica ni los escucha.

**Tiempo real de camas.** `GET /camas/eventos` es un flujo Server-Sent Events (`text/event-stream`) que emite `{ tipo, camaId, numero, estado, at }` por cada cambio y un evento `ping` cada 25 segundos. El servidor lo arma leyendo la tabla `outbox_events` cada segundo, por lo que funciona con más de una instancia de la API. Solo entrega lo que ocurre con la conexión abierta, por lo que el cliente debe cargar antes el mapa con `GET /camas`. El `EventSource` del navegador no envía el header `Authorization`: hay que consumirlo con `fetch` leyendo el cuerpo. El token no se acepta por query string.

### 4.5 Decisiones técnicas y compromisos

| Decisión | Beneficio | Costo asumido |
| --- | --- | --- |
| Monolito modular | Despliegue y razonamiento simples para el equipo | Menor aislamiento entre módulos |
| Bloqueo pesimista | Simple de razonar bajo contención alta (turnos y camas) | Menor rendimiento y posible espera de bloqueos |
| Bus en memoria más Outbox para los eventos críticos | Cargos, stock y cambios de cama con reintentos y sin infraestructura adicional | Las notificaciones y el protocolo de ingreso siguen sin entrega durable; la fila del Outbox se guarda después del commit, no dentro de él |
| PostgreSQL (Supabase en el entorno compartido) | Transacciones y bloqueos reales | Dependencia de un servicio externo y de credenciales |
| Entidades compartidas en `src/entities/` | Evitó una migración física riesgosa | Aislamiento hexagonal parcial |
| Rol como enum (no tabla) | Modelo simple | Agregar roles requiere migración |
| Médico y enfermero como roles de `Usuario` | Una sola tabla de cuentas | Sin atributos propios por tipo de profesional |

## 5. Estructura del repositorio

```text
HIS-PROJECT-2026/
  apps/
    api/                    API NestJS
      src/
        main.ts             arranque, CORS y Swagger
        app.module.ts       módulos, TypeORM, pipe de validación y filtro de excepciones
        data-source.ts      DataSource para migraciones
        config/             estrategia de nombres snake_case
        entities/           entidades TypeORM (32)
        migrations/         migraciones versionadas (40)
        modules/            iam, admissions, ehr, nursing, resources, billing, health
        shared/             bus de eventos, Outbox, filtro de excepciones y utilidades
        scripts/            bootstrap-superadmin.ts
      scripts/              functional-check.mjs, check-turnos.mjs, prepare-inventory-test.mjs
      test/                 pruebas e2e, de integración y de concurrencia contra base local
    web/                    cliente Vue 3
      src/
        main.ts             creación de la app, Pinia, router y configuración de autenticación
        App.vue
        app/                router.ts y AppShell.vue (layout)
        features/           admissions, beds, billing, dashboard, ehr, feedback, iam, inventory, nursing, patients, triage
        components/         componentes reutilizables y components/ui
        composables/        useBeds, useCharges, useClinicalHistory, useFeedback, useInventory, usePatients, useProtocols
        stores/             stores Pinia
        services/           acceso a la API por recurso
        shared/             cliente HTTP, errores, formatos, marca y estilos
  packages/
    contracts/              contratos compartidos (sin contenido útil todavía)
  docs/                     documentación de arquitectura, facturación, contratos y frontend
  package.json              workspaces y atajos de ejecución
```

## 6. Requisitos previos

- Node.js `22.18.0` o superior en la rama 22, o `24.12.0` o superior (requerido por el frontend).
- npm.
- Una base PostgreSQL accesible y su cadena de conexión: un proyecto de Supabase o una instancia local (por ejemplo, PostgreSQL 16 en un contenedor Docker).
- Git.

## 7. Instalación y puesta en marcha

Todos los comandos se ejecutan desde la raíz del repositorio.

1. Clonar el repositorio e instalar dependencias. El proyecto usa npm workspaces, por lo que un único comando instala API y web:

   ```bash
   npm install
   ```

   Si alguna aplicación queda sin dependencias, instalar por separado:

   ```bash
   npm --prefix apps/api install
   npm --prefix apps/web install
   ```

2. Crear `apps/api/.env` con las variables de la sección 8. No existe un archivo `.env.example` para la API; el único disponible es `apps/web/.env.example`.

3. Crear `apps/web/.env` a partir del ejemplo:

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   Contenido esperado: `VITE_API_URL=http://localhost:3000`.

4. Aplicar las migraciones en la base de datos (sección 9). Usar una base local propia:

   ```bash
   npm --prefix apps/api run migration:run
   ```

5. Crear la cuenta de superadmin. Definir antes en `apps/api/.env` las variables `SUPERADMIN_*` y ejecutar:

   ```bash
   npm --prefix apps/api run iam:bootstrap-superadmin
   ```

6. Iniciar la API (puerto 3000 por defecto):

   ```bash
   npm run api:dev
   ```

7. Iniciar el frontend en otra terminal (puerto 5173 por defecto de Vite):

   ```bash
   npm run web:dev
   ```

8. Abrir `http://localhost:5173` e iniciar sesión con el email y la contraseña del superadmin.

La documentación interactiva de la API (Swagger) queda disponible en `http://localhost:3000/docs` (el JSON de OpenAPI, en `http://localhost:3000/docs-json`) mientras `NODE_ENV` sea distinto de `production`.

Otros comandos útiles:

| Comando | Efecto |
| --- | --- |
| `npm run api:build` | Compila la API |
| `npm run api:test` | Ejecuta las pruebas de la API |
| `npm --prefix apps/api run test:cov` | Pruebas de la API con cobertura |
| `npm --prefix apps/api run lint` | Lint con oxlint |
| `npm --prefix apps/api run start:prod` | Ejecuta la API compilada (`dist/main`) |
| `npm --prefix apps/web run test` | Pruebas del frontend |
| `npm --prefix apps/web run type-check` | Verifica tipos del frontend con `vue-tsc` |
| `npm --prefix apps/web run build` | Verifica tipos y genera el build de producción |
| `npm --prefix apps/web run preview` | Sirve el build de producción |

## 8. Variables de entorno

### API (`apps/api/.env`)

La API lee `.env`, `apps/api/.env` y `../../.env` (en ese orden de búsqueda).

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL. Es un secreto. |
| `DATABASE_SSL` | No | Con valor `false` desactiva SSL (solo para base local). Por defecto se usa SSL. |
| `JWT_SECRET` | Sí | Secreto de firma de los access tokens. Debe tener al menos 32 bytes. |
| `JWT_EXPIRES_IN` / `ACCESS_TOKEN_TTL_SECONDS` | No | Duración del access token: segundos o número con sufijo `s`, `m`, `h` o `d` (por ejemplo `15m`). Por defecto 15 minutos, que también es el máximo. |
| `REFRESH_TOKEN_TTL_SECONDS` | No | Duración del refresh token en segundos. Por defecto 604800 (7 días); el máximo es 30 días. |
| `FRONTEND_ORIGINS` | No | Orígenes permitidos separados por coma. Por defecto `http://localhost:5173`. |
| `PORT` | No | Puerto de la API. Por defecto `3000`. |
| `NODE_ENV` | No | Con `production` se desactiva Swagger y los atajos de desarrollo de IAM. |
| `EHR_STORAGE_DIR` | No | Carpeta donde se guardan los adjuntos de estudios. Por defecto `var/ehr-attachments`. |
| `SUPERADMIN_NOMBRE`, `SUPERADMIN_APELLIDO`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Solo para el bootstrap | Datos de la cuenta raíz. La contraseña debe cumplir la política de IAM. |
| `RUN_LOCAL_CONCURRENCY_TEST`, `RUN_SUPABASE_INTEGRATION`, `CHECKLIST_TEST_DATABASE_URL`, `CARGO_URGENCIA_TEST_DATABASE_URL`, `PGLOCAL_PASSWORD` | No | Habilitan las pruebas con base real (sección 14). |

Ejemplo seguro para desarrollo local (reemplazar los valores):

```dotenv
DATABASE_URL=postgresql://USUARIO:CLAVE@localhost:5432/his
DATABASE_SSL=false
JWT_SECRET=cambiar-por-una-cadena-larga-y-aleatoria
FRONTEND_ORIGINS=http://localhost:5173
PORT=3000
```

Con Supabase se omite `DATABASE_SSL` y `DATABASE_URL` se toma del panel del proyecto.

### Web (`apps/web/.env`)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `VITE_API_URL` | Sí | URL base de la API. Si falta, el cliente lanza un error al iniciar. |

Los archivos `.env` no deben subirse al repositorio.

## 9. Base de datos y migraciones

- Motor: PostgreSQL. Esquema versionado con migraciones de TypeORM en `apps/api/src/migrations/` (40 archivos). `synchronize` está desactivado en `app.module.ts` y en `data-source.ts`.
- Convención de nombres: el código usa `camelCase` y las tablas y columnas de PostgreSQL usan `snake_case` mediante `SnakeNamingStrategy`.
- Ejecutar migraciones: `npm --prefix apps/api run migration:run`. TypeORM registra las ejecutadas en la tabla `migrations`, por lo que repetir el comando es seguro. Sobre una base vacía, las 40 migraciones se aplican sin errores y una segunda ejecución informa que no hay migraciones pendientes (medido el 18/11/2026 en una base PostgreSQL 16 local). Correrlas solo contra una base local propia; la base compartida tiene el historial desincronizado (sección 19).
- Cambios de esquema: cada cambio va en una migración nueva escrita a mano e idempotente (`IF NOT EXISTS`); no se editan las ya aplicadas. No se usa la salida de `migration:generate`: la base es más estricta que las entidades (restricciones, índices y longitudes definidos en SQL) y el comando propone borrarlos.
- Carga inicial: las migraciones siembran tres prestaciones del nomenclador (`CONSULTA_REGULAR`, `CONSULTA_URGENCIA` y `DIA_CAMA`, con valores provisorios; ver `docs/BILLING-IMPLEMENTACION.md`). El resto de las tablas arranca vacía. La única cuenta inicial se crea con `iam:bootstrap-superadmin`.

### Entidades

Hay 32 entidades en `apps/api/src/entities/`.

| Entidad | Contenido |
| --- | --- |
| `Usuario` | Cuentas con rol (`MEDICO`, `ENFERMERO`, `ADMINISTRATIVO`), estado de cuenta, horario del médico e indicador de superadmin |
| `RefreshSession` | Sesiones de refresh token (almacenadas como hash) |
| `Paciente` | Datos del paciente, tipo y entidad de cobertura, y columnas de financiador, plan y número de afiliado |
| `Turno` | Turnos de agenda con estado, columna de versión y datos de cancelación |
| `EntreturnoStandby` | Cola de espera de entreturnos |
| `AgendaMedico`, `AgendaExcepcion` | Bloques semanales de atención del médico y sus ausencias o feriados |
| `Especialidad`, `MedicoEspecialidad` | Especialidades y su asignación a médicos |
| `TriajeRegistro` | Cola de triaje de guardia |
| `NotificacionEntity` | Notificaciones internas por usuario |
| `Sector`, `Habitacion`, `Cama` | Ubicación de las camas y estado de cada cama, con columna de versión |
| `Internacion` | Vínculo entre paciente, cama, médico responsable y fecha de ingreso, con el motivo de ingreso si se informó |
| `Insumo`, `MovimientoInventario` | Inventario (stock, precio y stock mínimo) y su historial de descuentos y reposiciones |
| `SignoVital` | Registros de signos vitales |
| `IndicacionMedica`, `AdministracionMedicacion` | Indicaciones médicas y administraciones u omisiones de dosis |
| `ProtocoloIngreso`, `TareaProtocolo` | Protocolo de atención de un ingreso y su checklist de tareas |
| `RegistroClinico`, `Estudio` | Historia clínica (alergias, antecedentes, evoluciones, notas de enfermería y rectificaciones) y estudios con adjuntos |
| `Cargo` | Cargos de facturación: por turno atendido, por administración de medicación o por internación |
| `Financiador`, `Plan` | Catálogo de obras sociales y prepagas, y sus planes |
| `Prestacion`, `Tarifa` | Nomenclador: prestaciones con valor base y copago, y tarifa por financiador |
| `Liquidacion` | Liquidaciones a terceros, que agrupan cargos de un financiador y período |
| `OutboxEvent` | Eventos durables y su estado de entrega |
| `Auditoria` | Registro de acciones sobre recursos (decorador `@Auditar`) |

Las relaciones son `ManyToOne` hacia `Usuario`, `Paciente`, `Turno`, `Insumo` e `IndicacionMedica` (entre otras), con reglas de borrado explícitas (`RESTRICT`, `CASCADE` o `SET NULL`) según el caso. Toda entidad nueva se registra en `src/data-source.ts`.

## 10. Backend (NestJS)

### Módulos

| Módulo | Responsabilidad |
| --- | --- |
| `iam` | Autenticación, sesiones, cuentas, roles y guards |
| `admissions` | Pacientes, agenda de turnos, agenda médica, especialidades, entreturnos, lista de espera, transiciones, triaje y notificaciones |
| `resources` | Camas con máquina de estados y tiempo real, sectores, habitaciones, internaciones e inventario |
| `billing` | Cargos automáticos, nomenclador, cobertura, reportes y liquidaciones |
| `nursing` | Signos vitales, indicaciones, administración de medicación, notas de enfermería y protocolos de ingreso |
| `ehr` | Historia clínica electrónica |
| `health` | Esqueleto de diagnóstico técnico |

### Endpoints

La API expone 120 rutas (119 sin contar `GET /`, que Swagger excluye). Todas, salvo las marcadas como públicas, requieren `Authorization: Bearer <accessToken>`. Los parámetros, las respuestas y los códigos de error de cada una están en `docs/CONTRATOS-Y-GIT.md` y en Swagger (`/docs`). Las tablas listan el acceso por rol.

**Autenticación (`/auth`) y estado**

| Método y ruta | Acceso |
| --- | --- |
| `POST /auth/login` | Origen del frontend permitido |
| `POST /auth/refresh`, `POST /auth/logout` | Cookie `his_refresh` y origen permitido |
| `GET /auth/me`, `POST /auth/change-password` | Autenticado |
| `POST /auth/forgot-password` | Público |
| `GET /health`, `GET /` | Público |

**Usuarios (`/usuarios`)**

| Método y ruta | Acceso |
| --- | --- |
| `POST /usuarios`, `GET /usuarios`, `GET /usuarios/:id`, `PATCH /usuarios/:id` | `ADMINISTRATIVO` |
| `PATCH /usuarios/:id/horario`, `/habilitar`, `/deshabilitar`, `/restablecer-clave` | `ADMINISTRATIVO` |
| `POST /usuarios/administrativos`, `PATCH /usuarios/:id/baja`, `/restaurar` | Superadmin |

**Pacientes (`/pacientes`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /pacientes`, `GET /pacientes/:id` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `GET /pacientes/:id/turnos` | `MEDICO` (solo los propios), `ADMINISTRATIVO` |
| `POST /pacientes`, `PATCH /pacientes/:id`, `PATCH /pacientes/:id/cobertura` | `ADMINISTRATIVO` |

**Turnos (`/turnos`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /turnos/disponibles`, `GET /turnos/transiciones` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `GET /turnos/agenda`, `GET /turnos/:id`, `POST /turnos`, `POST /turnos/entreturno`, `PATCH /turnos/:id/transiciones`, `PATCH /turnos/:id/reprogramar`, `POST /turnos/:id/cancelar` | `MEDICO` (su propia agenda), `ADMINISTRATIVO` |
| `GET /turnos/espera`, `POST /turnos/espera`, `DELETE /turnos/espera/:id` | `MEDICO` (su propia agenda), `ADMINISTRATIVO` |

**Agenda médica y especialidades**

| Método y ruta | Acceso |
| --- | --- |
| `GET /agenda-medica/:medicoId`, `GET /agenda-medica/excepciones` | `MEDICO` (solo la propia), `ADMINISTRATIVO` |
| `PUT /agenda-medica/:medicoId`, `POST /agenda-medica/excepciones`, `DELETE /agenda-medica/excepciones/:id` | `ADMINISTRATIVO` |
| `GET /especialidades`, `GET /especialidades/medico/:medicoId` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /especialidades`, `DELETE /especialidades/:id`, `PUT /especialidades/medico/:medicoId` | `ADMINISTRATIVO` |

**Triaje y notificaciones**

| Método y ruta | Acceso |
| --- | --- |
| `POST /triaje` | `ENFERMERO`, `MEDICO` |
| `GET /triaje` | `ENFERMERO`, `MEDICO`, `ADMINISTRATIVO` |
| `PATCH /triaje/:id/atender` | `MEDICO` |
| `GET /notificaciones`, `PATCH /notificaciones/:id/leer` | Autenticado |

**Camas, sectores e internaciones**

| Método y ruta | Acceso |
| --- | --- |
| `GET /camas`, `GET /camas/:id`, `GET /camas/eventos` (Server-Sent Events) | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /camas`, `PATCH /camas/:id`, `DELETE /camas/:id` (baja lógica de una cama libre) | `ADMINISTRATIVO` |
| `POST /camas/:id/asignar`, `/alta`, `/trasladar` | `MEDICO`, `ADMINISTRATIVO` |
| `POST /camas/:id/limpieza/confirmar` | `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /camas/:id/bloquear`, `/desbloquear` | `ADMINISTRATIVO` |
| `GET /internaciones`, `GET /sectores`, `GET /habitaciones` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /sectores`, `POST /habitaciones` | `ADMINISTRATIVO` |

`POST /camas/:id/asignar` acepta `motivoIngreso` (opcional, 3 a 200 caracteres). Si se informa, se guarda en la internación y Enfermería genera el protocolo de ingreso.

**Inventario (`/resources/inventory`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /resources/inventory` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /resources/inventory`, `PATCH /resources/inventory/:id`, `POST /resources/inventory/:id/reponer`, `GET /resources/inventory/:id/movimientos` | `ADMINISTRATIVO` |
| `POST /resources/inventory/descontar` | `MEDICO` |

**Enfermería**

| Método y ruta | Acceso |
| --- | --- |
| `GET /signos-vitales`, `/tipos`, `/controles`, `/:pacienteId/serie`; `POST /signos-vitales`, `/controles` | `ENFERMERO`, `MEDICO` |
| `POST /indicaciones`, `PATCH /indicaciones/:id/suspender` | `MEDICO` |
| `GET /indicaciones` | `ENFERMERO`, `MEDICO` |
| `POST /indicaciones/:id/administraciones`, `/omisiones`, `/ejecuciones` | `ENFERMERO` |
| `POST /notas-enfermeria` | `ENFERMERO` |
| `GET /protocolos`, `PATCH /protocolos/:protocoloId/tareas/:tareaId` | `ENFERMERO`, `MEDICO` |
| `POST /protocolos/ingresos` (alta manual de un protocolo) | `MEDICO`, `ADMINISTRATIVO` |

**Historia clínica (`/historia-clinica`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /historia-clinica/:pacienteId`, `/timeline`, `/alergias`, `/estudios`; `GET /historia-clinica/estudios/:id/adjunto` | `MEDICO`, `ENFERMERO` |
| `POST /historia-clinica/:pacienteId/alergias`, `/antecedentes-familiares`, `/evoluciones`, `/estudios`, `/estudios/adjuntos`, `/registros/:regId/rectificar` | `MEDICO` |

**Facturación (`/billing`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /billing/cargos`, `/cargos/exportar` (CSV), `/cargos/resumen` | `ADMINISTRATIVO` |
| `PATCH /billing/cargos/:id/pagar`, `/anular` | `ADMINISTRATIVO` |
| `GET /billing/financiadores`, `POST /billing/financiadores`, `PATCH /billing/financiadores/:id`, `POST /billing/financiadores/:id/planes`, `PATCH /billing/planes/:id` | `ADMINISTRATIVO` |
| `POST /billing/liquidaciones`, `GET /billing/liquidaciones`, `GET /billing/liquidaciones/:id` | `ADMINISTRATIVO` |
| `GET /billing/reportes/cargos-por-periodo`, `/cargos-por-medico`, `/cargos-por-servicio`, `/ocupacion-camas`, `/consumo-insumos` | `ADMINISTRATIVO` |

### Reglas de negocio destacadas

- La agenda usa turnos regulares de 30 minutos y turnos urgentes de 15. Los horarios libres se calculan con el horario de cada médico, su agenda semanal (`PUT /agenda-medica/:medicoId`) y sus excepciones por ausencia o feriado. Un entreturno solo puede insertarse 15 minutos después del inicio de un turno libre de 30; ese turno se reduce a 15.
- Flujo de turno: `RESERVADO -> CONFIRMADO -> EN_SALA_DE_ESPERA -> ATENDIDO`. Se puede cancelar desde `RESERVADO` o `CONFIRMADO`, con motivo si se usa `POST /turnos/:id/cancelar`; solo un turno `RESERVADO` o `CONFIRMADO` se puede reprogramar. Al cancelar, el horario liberado pasa al primero de la lista de espera.
- Triaje: un registro `ROJO` genera una notificación de alta prioridad. Al atender un triaje (`PATCH /triaje/:id/atender`) se crea un turno urgente ya atendido para el médico y se genera su cargo de urgencia.
- Flujo de cama: `LIBRE -> OCUPADA -> EN_LIMPIEZA -> LIBRE`; `BLOQUEADA` es un estado de mantenimiento. Una cama ocupada no puede pasar a `LIBRE` sin el proceso intermedio de limpieza. El traslado deja la cama de origen en limpieza y ocupa la de destino sin reiniciar la internación.
- Facturación:
  - Los importes salen del nomenclador (tabla `prestaciones`, con tarifa por financiador si existe): consulta regular y de urgencia por turno atendido y día de cama por internación. Los valores sembrados por las migraciones son provisorios (consulta regular $15.000, urgencia $25.000, día de cama $50.000, copago $3.000) hasta que el docente defina el nomenclador, y no hay endpoint para modificarlos.
  - Reparto según cobertura: pública, el paciente paga 0 y el Estado cubre el 100%; prepaga, el paciente paga el copago de la prestación y el resto va a la prepaga; particular, el paciente paga el 100%.
  - Los cargos de farmacia valen el precio del insumo por la cantidad administrada y no tienen reparto. Si el insumo tiene precio 0 (el valor por defecto al crearlo), el cargo no se genera: el Outbox reintenta y el evento queda en `FALLIDO`.
  - Los cargos de internación cuentan los días de calendario en hora de Buenos Aires entre el ingreso y el alta (cuenta el día de ingreso, no el de egreso; mínimo 1).
  - Un cargo arranca `PENDIENTE` y pasa a `PAGADO` o `ANULADO`; la liquidación a terceros lo pasa a `FACTURADO`. Un cargo liquidado no se puede anular.
  - La liquidación toma los cargos `PENDIENTE` del financiador guardado en cada cargo. `POST /pacientes` no recibe financiador, plan ni número de afiliado, por lo que los cargos de pacientes creados por la API quedan sin financiador y no se liquidan.
- Enfermería: un control con temperatura mayor a 39 °C queda marcado como crítico y genera una notificación de alta prioridad. Una dosis solo se confirma dentro de ±30 minutos de su hora programada; al confirmarla se registra al enfermero, se descuenta una unidad del inventario y se crea el cargo de farmacia.
- Inventario: el descuento es atómico y responde `409` con stock insuficiente; cada descuento y cada reposición quedan en el historial con usuario, origen y motivo. Un descuento que deja el stock en o por debajo del mínimo (mayor a 0), habiendo estado por encima, notifica a los administrativos.
- Protocolos de ingreso: "cirugía programada" genera el protocolo pre-quirúrgico y "neumonía" o "infección respiratoria" el respiratorio. Otros motivos no tienen protocolo definido: la internación se crea igual y no se genera ninguno.
- Historia clínica: los registros son inmutables (la base rechaza `UPDATE` y `DELETE`); una corrección se hace con una rectificación que referencia el registro original.
- Baja lógica de cuentas: solo el superadmin puede dar de baja y restaurar. Un médico con turnos futuros activos no puede darse de baja.

## 11. Frontend (Vue 3)

### Arranque

`main.ts` crea la aplicación, registra Pinia y vue-router, y configura el cliente HTTP con el manejo de renovación y expiración de sesión. `App.vue` es el contenedor raíz y `app/AppShell.vue` define el layout autenticado con barra lateral y barra superior.

### Rutas (`apps/web/src/app/router.ts`)

| Ruta | Roles | Vista |
| --- | --- | --- |
| `/login` | Pública | Inicio de sesión |
| `/` | Autenticado | Panel (variante por rol) |
| `/usuarios`, `/usuarios/:id` | `ADMINISTRATIVO` | Listado y detalle de usuarios |
| `/turnos` | `MEDICO`, `ADMINISTRATIVO` | Agenda |
| `/pacientes` | Autenticado | Pacientes |
| `/camas`, `/camas/:id` | Autenticado | Mapa y detalle de cama (el `id` llega como prop) |
| `/triaje` | `ENFERMERO`, `MEDICO` | Triaje de guardia |
| `/enfermeria` | `ENFERMERO`, `MEDICO` | Contenedor con vistas anidadas: `signos-vitales`, `medicaciones`, `protocolos` (y `protocolos/:pacienteId`) |
| `/insumos` | `ENFERMERO`, `ADMINISTRATIVO` | Insumos |
| `/historia-clinica` | `MEDICO`, `ENFERMERO` | Historia clínica |
| `/facturacion` | `ADMINISTRATIVO` | Cargos |

Las vistas se cargan de forma diferida. Un `beforeEach` restaura la sesión, redirige a `/login` conservando la ruta de destino en `redirect`, y bloquea el acceso por rol enviando al panel. Un `afterEach` actualiza el título del documento. El detalle de cada pantalla, qué servicio consume y cuáles no tienen pantalla está en `docs/FRONTEND-IMPLEMENTACION.md`.

### Estado y reutilización

- **Pinia** (`defineStore` con la sintaxis de composición): `session.store` (en `features/iam/`), `beds.store`, `inventory.store`, `medications.store`, `notification.store`, `triage.store` y `vitals.store`. Cada store expone estado, getters (`computed`) y acciones, con indicadores de carga y error.
- **Composables**: `useBeds`, `useCharges`, `useClinicalHistory`, `useFeedback`, `useInventory`, `usePatients` y `useProtocols` en `composables/`, y `useAppointments` y `useUsers` en las carpetas de cada feature. Separan la lógica de acceso a datos de la presentación.
- **Comunicación entre componentes**: props tipadas con `defineProps`, eventos con `defineEmits`, slots en los componentes de interfaz y stores para el estado compartido.
- **Componentes de interfaz** reutilizables en `components/ui`: `BaseCard`, `SideDrawer`, `StatusChip`, `StatCard`, `PageHeader`, `NoticeBanner`, entre otros.

### Conexión con la API (`src/shared/http.ts`)

Cliente basado en `fetch` con las siguientes características:

- Lee la URL base desde `VITE_API_URL`.
- El access token se guarda en memoria y se envía como `Bearer`. El refresh token viaja en una cookie `HttpOnly`; las rutas `/auth/` se envían con `credentials: 'include'`.
- Ante una respuesta no autorizada intenta renovar la sesión y, si falla, invoca el cierre de sesión y redirige al login.
- Convierte los errores HTTP y de red en una clase `ApiError` con estado y mensaje legible, que las stores muestran al usuario.
- `http.download` descarga archivos (usado por la exportación CSV del servicio de cargos).

### Experiencia de usuario

Cada rol (médico, enfermero, administrativo) tiene un panel propio. La interfaz incluye indicadores de carga, mensajes de error, notificaciones, paneles laterales para altas y detalles, y reglas de estilo responsive (`@media`). La marca de la aplicación se define en `src/shared/brand.ts`.

## 12. Autenticación, roles y permisos

- Access token JWT de corta duración (15 minutos por defecto) y refresh token aleatorio rotativo. Este último se guarda como hash en base de datos y se envía solo en la cookie `his_refresh`, nunca en el cuerpo de la respuesta.
- Roles: `MEDICO`, `ENFERMERO` y `ADMINISTRATIVO`. Un indicador aparte identifica al superadmin raíz, que se crea con `iam:bootstrap-superadmin` y es el único que puede crear otros administrativos y dar de baja cuentas.
- Autorización con `AuthGuard`, `RolesGuard` y `SuperadminGuard`, aplicados por controlador o por ruta.
- Equivalencia entre los roles del diseño y los del sistema:

  | Rol en el documento de diseño | Rol en el sistema | Alcance |
  | --- | --- | --- |
  | Administrador | `ADMINISTRATIVO` con indicador de superadmin (cuenta raíz) | Gestión de cuentas de personal |
  | Médico | `MEDICO` | Atención clínica |
  | Enfermero | `ENFERMERO` | Signos vitales, medicación, limpieza de camas |
  | Recepcionista | `ADMINISTRATIVO` | Pacientes, turnos, lista de espera y consulta de triaje |
  | Paciente | No existe como cuenta | Los pacientes son datos que carga el personal y no inician sesión |

  Las historias de usuario nombran además al administrativo de piso, al coordinador de agendas y al personal de admisión, que operan como `ADMINISTRATIVO`, y al personal de limpieza, cuya confirmación de higiene la registran `ENFERMERO` o `ADMINISTRATIVO`.
- Un médico recién registrado queda pendiente de habilitación por un administrativo. Las cuentas deshabilitadas no inician sesión y sus sesiones se revocan.
- Política de contraseña: mínimo 8 caracteres, una mayúscula, un dígito y sin dígitos consecutivos ascendentes ni descendentes. Las contraseñas se almacenan con `scrypt`.
- Los atajos de desarrollo (alta sin verificación por correo) están bloqueados con `NODE_ENV=production`. No hay restablecimiento por correo: un administrativo asigna una contraseña temporal con `PATCH /usuarios/:id/restablecer-clave`.

## 13. Validaciones y manejo de errores

- Backend: `ValidationPipe` global con `whitelist` y `transform`, DTOs con `class-validator` y un filtro global de excepciones (`AllExceptionsFilter`). Los conflictos de reserva, asignación, transición de estado y stock devuelven `409`.
- Las transiciones inválidas de turnos, camas y cargos se rechazan con error de negocio.
- Los listados paginados de Admisión devuelven el total en el header `X-Total-Count`; los de Facturación devuelven `{ items, total, limit, offset }`.
- Frontend: validación de formularios, errores de la API traducidos a mensajes legibles y estados de carga y error en cada store.

## 14. Pruebas

El backend usa Vitest (alternativa a Jest) y Supertest. Vitest ejecuta los archivos `*.spec.ts` y `*.test.ts`.

```bash
npm run api:test                                  # pruebas unitarias e integración sin base de datos
npm --prefix apps/api run test:cov                # con cobertura
npm --prefix apps/api run test:e2e                # e2e (requiere base de datos configurada)
```

Estado medido el 19/11/2026 (commit `4c0b4e5`):

| Verificación | Resultado |
| --- | --- |
| `npm run api:build` | Sin errores |
| `npm run api:test` | 1250 pruebas pasan y 21 se omiten (97 archivos pasan y 4 se omiten, de 101) |
| `npm --prefix apps/api run lint` | 0 errores y 11 advertencias (imports y funciones sin usar, y un escape innecesario en `BaselineSchema`) |
| `npm --prefix apps/web run test` | 123 pruebas pasan en 12 archivos |
| `npm --prefix apps/web run type-check` | Sin errores |
| `npm --prefix apps/web run build` | Sin errores |

Las pruebas del backend cubren IAM (autenticación, tokens, política de contraseñas, guards, administración de cuentas), admisión (turnos, agenda médica, especialidades, entreturnos, pacientes, estados, triaje, notificaciones), enfermería (signos vitales, medicación, protocolos), historia clínica, recursos (camas, tiempo real, inventario, movimientos), facturación (cargos, estados, nomenclador, cobertura, reportes, liquidaciones, exportación) y el Outbox (servicio, worker y almacén). No se midió la cobertura de líneas en esta actualización (`test:cov`).

Pruebas que requieren una base real, deshabilitadas por defecto (son las 21 omitidas). **Corren solo contra PostgreSQL local**; cada archivo valida el host antes de escribir y casi todos exigen además un nombre de base de pruebas:

| Archivo | Variables | Requisito |
| --- | --- | --- |
| `test/turnos-concurrency.local.spec.ts` | `RUN_LOCAL_CONCURRENCY_TEST=true`, `DATABASE_URL` | Base local migrada llamada `his_admissions_test` |
| `test/inventory-service-concurrency.spec.ts` | `PGLOCAL_PASSWORD` | Base `his_test` en `localhost:5432`; correr antes `node scripts/prepare-inventory-test.mjs` |
| `test/protocolos-checklist.local.spec.ts` | `CHECKLIST_TEST_DATABASE_URL` | Base local migrada (host `localhost` o `127.0.0.1`) con al menos 2 usuarios y 1 paciente |
| `test/cargo-urgencia.local.spec.ts` | `CARGO_URGENCIA_TEST_DATABASE_URL` | Base local migrada con el Outbox real. La guarda (`test/helpers/assert-local-database-url.ts`) exige host `localhost` o `127.0.0.1` y un nombre de base con el prefijo `his_`; crea y borra sus propios datos |
| `test/inventory-supabase.integration.spec.ts` | `RUN_SUPABASE_INTEGRATION=true`, `DATABASE_URL` | Solo acepta el host de Supabase y modifica inventario real: no correrlo sin avisar al equipo |

La prueba `cargo-urgencia.local.spec.ts` (14 de las 21 omitidas, más 7 de la guarda que sí corren) pasó completa, 21 de 21, el 16/11/2026 contra una base local vacía recién migrada. Las demás pruebas con base real no se ejecutaron en esta actualización.

Prueba funcional contra servidor y base reales: `apps/api/scripts/functional-check.mjs` recorre 29 criterios de aceptación de Enfermería, Recursos e IAM por HTTP. El resultado y la forma de repetirla están en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`, que es el registro de la verificación del 10/11/2026.

Frontend: hay 12 archivos de pruebas con Vitest (`npm --prefix apps/web run test`) y las 123 pruebas pasan. El script `type-check` (`vue-tsc --build`) verifica los tipos.

## 15. Seguridad

- `DATABASE_URL`, `JWT_SECRET` y credenciales solo existen en el backend y no se versionan.
- CORS restringido a los orígenes de `FRONTEND_ORIGINS`.
- Refresh token en cookie `HttpOnly`, rotado en cada renovación y almacenado como hash; si se reutiliza uno ya rotado se revoca la familia de sesiones.
- Bloqueo de 15 minutos tras 5 intentos de inicio de sesión fallidos.
- Auditoría: los inicios de sesión y las acciones marcadas con `@Auditar` (por ejemplo alta, habilitación y baja de cuentas y alta de pacientes) quedan registrados en la tabla `auditoria`, también los intentos fallidos con su código HTTP.
- Control de acceso por rol aplicado en el backend; las restricciones del router del frontend son solo de experiencia de usuario.
- Los adjuntos de estudios aceptan PDF, PNG y JPEG de hasta 10 MB, se guardan fuera del directorio público y se descargan con autenticación.
- Swagger se desactiva en producción.
- Los datos clínicos y de facturación no se eliminan al dar de baja una cuenta.

## 16. Ejemplos de uso

Iniciar sesión (el encabezado `Origin` debe estar en `FRONTEND_ORIGINS`):

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"admin@ejemplo.com","password":"CLAVE_DEL_SUPERADMIN"}'
```

La respuesta contiene `accessToken` y `account`. Con el token se consultan los recursos protegidos:

```bash
curl http://localhost:3000/camas \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Consultar los cargos de un período, solo los pendientes (rol `ADMINISTRATIVO`):

```bash
curl "http://localhost:3000/billing/cargos?desde=2026-11-01&hasta=2026-11-30&estado=PENDIENTE&limit=20" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## 17. Capturas de pantalla

Capturas de la aplicación en ejecución (frontend sobre una base local de pruebas, con datos ficticios). La pantalla de triaje usa datos locales del frontend (ver `apps/web/README.md`, "Estado conocido"). La captura del mapa de camas se tomó antes de conectar esa pantalla a la API.

| Pantalla | Imagen |
| --- | --- |
| Inicio de sesión | ![Inicio de sesión](docs/img/login.png) |
| Panel de administrativo | ![Panel de administrativo](docs/img/panel-administrativo.png) |
| Panel de médico | ![Panel de médico](docs/img/panel-medico.png) |
| Panel de enfermero | ![Panel de enfermero](docs/img/panel-enfermero.png) |
| Pacientes, con búsqueda aplicada | ![Pacientes](docs/img/pacientes.png) |
| Alta de paciente con cobertura | ![Alta de paciente](docs/img/alta-paciente.png) |
| Agenda de turnos | ![Agenda de turnos](docs/img/turnos.png) |
| Mapa de camas | ![Mapa de camas](docs/img/camas.png) |
| Inventario con alerta de stock bajo | ![Inventario](docs/img/inventario.png) |
| Facturación: listado de cargos | ![Facturación](docs/img/facturacion.png) |

## 18. Guía para la evaluación

Ubicación en el código de cada criterio de la rúbrica.

| Criterio | Dónde verlo |
| --- | --- |
| Estructura general | `apps/web/src/main.ts`, `App.vue`, `app/AppShell.vue`, organización por `features/` |
| Directivas y templates | Vistas y componentes en `apps/web/src/features` y `components` (`v-if`, `v-for` con `:key`, `v-show`, `v-model`, `v-bind` y `v-on` en sus formas abreviadas) |
| Comunicación entre componentes | `defineProps`, `defineEmits` y slots en `components/ui`, paneles de `features/admissions` y drawers de `features/patients` |
| Router | `apps/web/src/app/router.ts`: rutas dinámicas, vistas anidadas en `/enfermeria`, props de ruta, guardas globales, metadatos de rol |
| Composables | `composables/`, `features/admissions/useAppointments.ts` y `features/iam/useUsers.ts` |
| Pinia | `apps/web/src/stores/` y `features/iam/session.store.ts` |
| Conexión con APIs | `shared/http.ts` y `services/` |
| UX/UI | Panel por rol, notificaciones, drawers, estados de carga y error, reglas responsive |
| Documentación | Este README y `docs/` |
| Proyecto NestJS | `apps/api/src/modules` (módulos por dominio con capas) |
| Interpretación del problema | Historias de usuario de Admisión, Enfermería, Recursos y Facturación cubiertas según la sección 2; el registro de la verificación del 10/11/2026 por historia está en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md` |
| Base de datos | `apps/api/src/entities` y `apps/api/src/migrations` (PostgreSQL, relaciones y restricciones) |
| Autenticación y autorización | `apps/api/src/modules/iam` (JWT, refresh rotativo, guards por rol) |
| Test y documentación | `apps/api/src/**/*.spec.ts`, `apps/api/test`, `apps/api/scripts/functional-check.mjs`, Swagger en `/docs` |

## 19. Limitaciones conocidas y mejoras futuras

- **Outbox parcial.** Solo los ocho eventos de `DURABLE_EVENT_TYPES` (cargos, descuento de stock y cambios de cama) tienen entrega durable con reintentos. Las notificaciones (turno en sala de espera, lista de espera promovida, signos vitales, stock bajo) y la generación del protocolo de ingreso se entregan en memoria: si el proceso cae antes de procesarlos, se pierde el efecto. Además, la fila del Outbox se inserta después del commit del cambio de negocio, no en la misma transacción.
- **El protocolo de ingreso se genera en segundo plano.** `POST /camas/:id/asignar` responde antes de que exista el protocolo; un cliente que consulte en el mismo instante puede no verlo todavía.
- **Protocolos solo para dos motivos de ingreso.** Las historias de usuario definen tareas para ingreso pre-quirúrgico y para infección respiratoria. Para cualquier otro motivo no se genera protocolo.
- **Tiempo real de camas sin historial.** `GET /camas/eventos` solo entrega los cambios ocurridos con la conexión abierta, con hasta un segundo de demora. El frontend lo consume con `fetch`, reconecta con espera creciente y refresca el mapa al reconectar (`apps/web/src/stores/beds.store.ts`).
- **Frontend de triaje con datos locales.** El endpoint existe, pero la pantalla no lo consume.
- **Frontend de facturación parcial.** Las pantallas no usan las liquidaciones, los reportes ni el catálogo de coberturas; el filtrado y la exportación CSV se hacen en el navegador sobre todos los cargos descargados, y los cargos de farmacia no tienen etiqueta en la tabla. Tampoco hay pantallas para la agenda médica, las especialidades, la administración del inventario ni la reprogramación de turnos.
- **Nomenclador provisorio.** Los valores de las prestaciones y el copago ($3.000) son fijos, vienen de las migraciones y no hay endpoint para administrarlos ni para cargar tarifas por financiador. Los umbrales clínicos también son valores fijos.
- **Liquidación a terceros sin datos reales en el alta actual.** `POST /pacientes` y `PATCH /pacientes/:id/cobertura` no reciben financiador, plan ni número de afiliado, por lo que los cargos quedan sin financiador y no se liquidan. El verificador de cobertura (`COVERAGE_VERIFIER`) es simulado y ningún módulo lo invoca.
- **Historial de migraciones de la base compartida desincronizado con `main`.** El registro del 10/11/2026 documenta que una migración ya aplicada figura con un timestamp anterior y bloquea `migration:run`; el diagnóstico y el arreglo propuesto están en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`, sección 3, y no se volvieron a comprobar en esta actualización. Sobre una base vacía las 39 migraciones aplican sin errores.
- **`migration:generate` no refleja cambios reales.** La base es más estricta que las entidades (restricciones, índices y longitudes definidos a mano), por lo que el comando siempre propone cambios. Las migraciones se escriben a mano.
- **Adjuntos en disco local.** Los archivos de estudios se guardan en `EHR_STORAGE_DIR` (por defecto `var/ehr-attachments`), por lo que con más de una instancia o un sistema de archivos efímero no se comparten.
- Las entidades TypeORM siguen en `src/entities/` en lugar de la infraestructura de cada módulo.
- `packages/contracts` no contiene contratos compartidos ni tiene `package.json` en su raíz. Hoy los DTOs viven en cada módulo de la API y los tipos del frontend en `apps/web/src/services`.
- El sistema tiene tres roles (`MEDICO`, `ENFERMERO`, `ADMINISTRATIVO`) frente a los cinco del documento de diseño; la equivalencia está en la sección 12.
- Sin verificación por correo electrónico ni recuperación de contraseña por correo.

## 20. Documentación complementaria

| Archivo | Contenido |
| --- | --- |
| `docs/ARQUITECTURA.md` | Arquitectura, capas, eventos y Outbox, persistencia, IAM y agenda |
| `docs/BILLING-IMPLEMENTACION.md` | Facturación: orígenes de cargos, nomenclador, cobertura, estados, reportes y liquidaciones |
| `docs/CONTRATOS-Y-GIT.md` | Contratos de API y flujo de trabajo con Git |
| `docs/FRONTEND-IMPLEMENTACION.md` | Implementación del frontend: pantallas, servicios y pruebas |
| `docs/VALIDACION-ERRORES-IMPLEMENTACION.md` | Validación y errores |
| `docs/AUDITORIA-IAM-IMPLEMENTACION.md` | Auditoría de permisos por rol de IAM (29/10/2026) |
| `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md` | Registro de la verificación del 10/11/2026: prueba funcional contra servidor y base reales, migraciones sobre base vacía y tests de integración |
| `docs/RESUMEN-EXPOSICION.md` | Resumen para la exposición: patrones, concurrencia, eventos y límites |

## Integrantes
- ASTUDILLO AMPARO,
- CONTRERAS GABRIELA,
- GHIGO PATRICIO,
- MARI MACARENA,
- SCHNEIDER ANDRES,
- VILLA SOFIA
