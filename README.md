# OptiMed - Sistema de Información Hospitalaria (HIS)

Aplicación web para la gestión de admisión de pacientes, agenda de turnos, camas, insumos y facturación de un hospital. Está organizada como un monorepo con una API REST en NestJS y un cliente en Vue 3.

Proyecto integrador de la Tecnicatura Universitaria en Programación (UTN Facultad Regional San Francisco). Se evalúa en conjunto para Programación IV (frontend en Vue y backend en NestJS) y Metodología / Arquitectura de Software.

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

- **Admisión y turnos**: registro de pacientes, reserva de turnos con control de concurrencia, entreturnos, lista de espera y transiciones de estado de la atención.
- **Atención y enfermería**: registro de signos vitales, administración de medicación y protocolos de ingreso.
- **Recursos y camas**: mapa de camas con máquina de estados, asignación segura e inventario de insumos.
- **Facturación**: generación automática de cargos por atención y cálculo según cobertura.
- **Identidad y accesos (IAM)**: autenticación, roles y administración de cuentas.

Es un proyecto académico. No está preparado para uso clínico real. El alcance real de cada módulo se detalla en la sección siguiente.

## 2. Estado de implementación

La siguiente tabla refleja el código actual del repositorio, no el alcance planificado. El detalle de lo verificado contra un servidor y una base reales está en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`.

| Módulo | Backend (API) | Frontend |
| --- | --- | --- |
| IAM (login, refresh, roles, usuarios) | Implementado | Conectado a la API |
| Admisión: pacientes | Implementado | Conectado a la API |
| Admisión: turnos, entreturnos, lista de espera, transiciones de estado | Implementado; los avisos al consultorio y a recepción se guardan como notificaciones | Conectado a la API |
| Admisión: triaje de guardia | Implementado (`/triaje`), con cola persistida y ordenada por nivel | Pantalla con datos locales en memoria |
| Notificaciones | Implementado (`/notificaciones`) | Conectado a la API |
| Recursos: camas (asignación, alta, limpieza, bloqueo) | Implementado, con cambios de estado en tiempo real (`GET /camas/eventos`) | Pantalla con datos locales en memoria |
| Recursos: inventario | Implementado: listado, descuento manual y descuento automático al administrar medicación | Conectado a la API |
| Enfermería: signos vitales | Implementado (`/signos-vitales`), con alerta por temperatura mayor a 39 °C | Conectado a la API |
| Enfermería: medicación | Implementado (`/indicaciones`), con ventana de ±30 minutos | Conectado a la API |
| Enfermería: protocolos de ingreso (patrón Builder) | Implementado (`/protocolos`); se generan solos al asignar una cama con motivo de ingreso | Conectado a la API |
| Historia clínica electrónica | Implementado (`/historia-clinica`) | Conectado a la API |
| Facturación: cargos por turno atendido y por medicación administrada | Implementado (`GET /billing/cargos`) | Conectado a la API |

Las dos pantallas con datos locales en memoria (camas y triaje) marcan en el código el endpoint que deben consumir con comentarios `TODO` (`apps/web/src/services/beds.ts` y `triage.ts`). Sus datos se pierden al recargar la página. Los endpoints ya existen en la API.

## 3. Tecnologías

| Capa | Tecnología | Versión declarada |
| --- | --- | --- |
| Entorno de ejecución | Node.js | `^22.18.0 \|\| >=24.12.0` (campo `engines` del frontend) |
| Backend | NestJS (`@nestjs/common`, `core`, `platform-express`) | `^12.0.1` |
| ORM | TypeORM | `^1.1.1` |
| Base de datos | PostgreSQL (alojado en Supabase), driver `pg` | `^8.23.0` |
| Validación | `class-validator`, `class-transformer` | `^0.15.1`, `^0.5.1` |
| Documentación de API | `@nestjs/swagger` | `^12.0.2` |
| Eventos internos | RxJS | `^7.8.1` |
| Pruebas backend | Vitest, Supertest, `@nestjs/testing` | `^4.1.2`, `^7.0.0` |
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
| Strategy | `modules/billing/domain/` | Importe por tipo de atención (regular y urgencia) y reparto del costo según cobertura (pública, prepaga y particular). |
| Builder | `modules/nursing/domain/protocolo/` | Protocolos de ingreso: `PreOpProtocolBuilder` y `RespiratoryProtocolBuilder`, elegidos por `ProtocolDirector` según el motivo de ingreso. |
| Ports and adapters | `modules/*/domain/ports/` | Repositorios definidos como interfaces en el dominio. |
| Observer / eventos | `src/shared/events/` | Bus de eventos interno en memoria (RxJS). |

### 4.3 Concurrencia

La reserva de turnos, los cambios de estado, la asignación de camas y la administración de medicación se ejecutan en transacciones con bloqueo pesimista (`pessimistic_write`, equivalente a `SELECT ... FOR UPDATE`). El descuento de inventario usa una única sentencia `UPDATE` condicional (`cantidad_disponible >= cantidad`), que es atómica y nunca deja el stock en negativo. Ante un conflicto, la API responde `409` en lugar de asignar dos veces el mismo recurso. Las entidades `Turno` y `Cama` además tienen columna `@VersionColumn()`, y la base refuerza las reglas con índices únicos (una internación activa por cama y por paciente, un cargo por turno y por administración).

### 4.4 Eventos

`src/shared/events/EventBus` es un bus en memoria (RxJS). Los eventos se publican **después** de confirmar la transacción y no tienen garantía de entrega: si el proceso se cae entre el commit y el procesamiento, el evento se pierde. Los suscriptores nunca propagan errores al bus; los registran en el log.

| Evento | Lo publica | Lo escucha | Efecto |
| --- | --- | --- | --- |
| `admissions.appointment-attended` | Admisión, al pasar un turno a `ATENDIDO` | Facturación | Crea el cargo del turno (único por `turno_id`) |
| `admissions.patient-waiting` | Admisión, al pasar un turno a `EN_SALA_DE_ESPERA` | Admisión | Notificación al médico del turno |
| `admissions.standby-promoted` | Admisión, al promover a un paciente de la lista de espera | Admisión | Notificación a los administrativos |
| `vital-sign.alert-raised` | Enfermería, al registrar un signo vital fuera de rango | Admisión | Con temperatura mayor a 39 °C, notificación de alta prioridad al médico responsable de la internación (o a todos los médicos si no hay internación activa) |
| `medication.administered` | Enfermería, al confirmar una dosis | Recursos y Facturación | Descuenta el insumo del inventario y crea el cargo de farmacia (único por administración) |
| `patient.admitted` | Recursos, al asignar una cama con `motivoIngreso` | Enfermería | Genera el protocolo de ingreso (único por internación) |
| `bed.assigned`, `bed.released`, `bed.cleaned` | Recursos, en cada cambio de estado de cama | Recursos | Se reenvían por `GET /camas/eventos` |
| `bed.blocked`, `bed.unblocked` | Recursos, al bloquear o desbloquear una cama | Recursos | Se reenvían por `GET /camas/eventos` |

**Tiempo real de camas.** `GET /camas/eventos` es un flujo Server-Sent Events (`text/event-stream`) que emite `{ tipo, camaId, numero, estado, at }` por cada cambio y un evento `ping` cada 25 segundos. Solo entrega lo que ocurre con la conexión abierta, por lo que el cliente debe cargar antes el mapa con `GET /camas`. El `EventSource` del navegador no envía el header `Authorization`: hay que consumirlo con `fetch` leyendo el cuerpo. El token no se acepta por query string.

### 4.5 Decisiones técnicas y compromisos

| Decisión | Beneficio | Costo asumido |
| --- | --- | --- |
| Monolito modular | Despliegue y razonamiento simples para el equipo | Menor aislamiento entre módulos |
| Bloqueo pesimista | Simple de razonar bajo contención alta (turnos y camas) | Menor rendimiento y posible espera de bloqueos |
| Eventos en memoria | Sin infraestructura adicional | Sin garantía de entrega; no apto como única garantía para facturación o inventario |
| PostgreSQL en Supabase | Transacciones y bloqueos reales | Dependencia de un servicio externo y de credenciales |
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
        entities/           entidades TypeORM
        migrations/         migraciones versionadas
        modules/            iam, admissions, ehr, nursing, resources, billing, health
        shared/             bus de eventos, filtro de excepciones y utilidades
        scripts/            bootstrap-superadmin.ts
      test/                 pruebas e2e, de integración y de concurrencia
    web/                    cliente Vue 3
      src/
        main.ts             creación de la app, Pinia, router y configuración de autenticación
        App.vue
        app/                router.ts y AppShell.vue (layout)
        features/           admissions, beds, billing, dashboard, iam, inventory, nursing, patients, triage
        components/         componentes reutilizables y components/ui
        composables/        useCharges, usePatients
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
- Una base PostgreSQL accesible y su cadena de conexión: un proyecto de Supabase o una instancia local.
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

4. Aplicar las migraciones en la base de datos (sección 9):

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

La documentación interactiva de la API (Swagger) queda disponible en `http://localhost:3000/docs` mientras `NODE_ENV` sea distinto de `production`.

Otros comandos útiles:

| Comando | Efecto |
| --- | --- |
| `npm run api:build` | Compila la API |
| `npm run api:test` | Ejecuta las pruebas de la API |
| `npm --prefix apps/api run lint` | Lint con oxlint |
| `npm --prefix apps/api run start:prod` | Ejecuta la API compilada (`dist/main`) |
| `npm --prefix apps/web run build` | Verifica tipos con `vue-tsc` y genera el build de producción |
| `npm --prefix apps/web run preview` | Sirve el build de producción |

## 8. Variables de entorno

### API (`apps/api/.env`)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL. Es un secreto. |
| `DATABASE_SSL` | No | Con valor `false` desactiva SSL (solo para base local). Por defecto se usa SSL. |
| `JWT_SECRET` | Sí | Secreto de firma de los access tokens. |
| `JWT_EXPIRES_IN` / `ACCESS_TOKEN_TTL_SECONDS` | No | Duración del access token. Según la documentación, 15 minutos por defecto. |
| `REFRESH_TOKEN_TTL_SECONDS` | No | Duración del refresh token. |
| `FRONTEND_ORIGINS` | No | Orígenes permitidos separados por coma. Por defecto `http://localhost:5173`. |
| `PORT` | No | Puerto de la API. Por defecto `3000`. |
| `NODE_ENV` | No | Con `production` se desactiva Swagger y los atajos de desarrollo de IAM. |
| `SUPERADMIN_NOMBRE`, `SUPERADMIN_APELLIDO`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Solo para el bootstrap | Datos de la cuenta raíz. La contraseña debe cumplir la política de IAM. |
| `RUN_LOCAL_CONCURRENCY_TEST`, `RUN_SUPABASE_INTEGRATION` | No | Con valor `true` habilitan pruebas de integración opcionales (sección 14). |
| `PGLOCAL_PASSWORD` | No | Leída por el código de pruebas con base local. |

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

- Motor: PostgreSQL. Esquema versionado con migraciones de TypeORM en `apps/api/src/migrations/`. `synchronize` está desactivado en `app.module.ts` y en `data-source.ts`.
- Convención de nombres: el código usa `camelCase` y las tablas y columnas de PostgreSQL usan `snake_case` mediante `SnakeNamingStrategy`.
- Ejecutar migraciones: `npm --prefix apps/api run migration:run`. TypeORM registra las ejecutadas en la tabla `migrations`, por lo que repetir el comando es seguro.
- Generar una migración nueva a partir de cambios en entidades: `npm --prefix apps/api run migration:generate -- src/migrations/NombreDeLaMigracion`.
- Carga inicial: no hay datos semilla. La única cuenta inicial se crea con `iam:bootstrap-superadmin`.

### Entidades

| Entidad | Contenido |
| --- | --- |
| `Usuario` | Cuentas con rol (`MEDICO`, `ENFERMERO`, `ADMINISTRATIVO`), estado de cuenta e indicador de superadmin |
| `RefreshSession` | Sesiones de refresh token (almacenadas como hash) |
| `Paciente` | Datos del paciente y tipo de cobertura |
| `Turno` | Turnos de agenda con estado y columna de versión |
| `EntreturnoStandby` | Cola de espera de entreturnos |
| `Cama` | Camas con estado y columna de versión |
| `Internacion` | Vínculo entre paciente, cama, médico responsable y fecha de ingreso, con el motivo de ingreso si se informó |
| `Insumo` | Inventario de insumos médicos |
| `SignoVital` | Registros de signos vitales |
| `IndicacionMedica` | Indicaciones médicas |
| `AdministracionMedicacion` | Administraciones de medicación |
| `Cargo` | Cargos de facturación: uno por turno atendido o uno por administración de medicación |
| `NotificacionEntity` | Notificaciones internas por usuario |
| `ProtocoloIngreso`, `TareaProtocolo` | Protocolo de atención de un ingreso y su checklist de tareas |
| `RegistroClinico` | Historia clínica: alergias, antecedentes, evoluciones, estudios y notas de enfermería |
| `TriajeRegistro` | Cola de triaje de guardia |

Las relaciones son `ManyToOne` hacia `Usuario`, `Paciente`, `Turno`, `Insumo` e `IndicacionMedica`, con reglas de borrado explícitas (`RESTRICT`, `CASCADE` o `SET NULL`) según el caso.

## 10. Backend (NestJS)

### Módulos

| Módulo | Responsabilidad |
| --- | --- |
| `iam` | Autenticación, sesiones, cuentas, roles y guards |
| `admissions` | Pacientes, agenda de turnos, entreturnos, lista de espera, transiciones, triaje y notificaciones |
| `resources` | Camas con máquina de estados y tiempo real, internaciones e inventario |
| `billing` | Cargos automáticos y estrategias de cálculo |
| `nursing` | Signos vitales, indicaciones y administración de medicación, protocolos de ingreso |
| `ehr` | Historia clínica electrónica |
| `health` | Esqueleto de diagnóstico técnico |

### Endpoints

Todos los endpoints, salvo los marcados como públicos, requieren `Authorization: Bearer <accessToken>`. La referencia completa y actualizada está en Swagger (`/docs`).

**Autenticación (`/auth`)**

| Método y ruta | Acceso |
| --- | --- |
| `POST /auth/register` | Público (alta de médico o enfermero; solo desarrollo) |
| `POST /auth/login` | Origen del frontend permitido |
| `POST /auth/refresh` | Cookie `his_refresh` y origen permitido |
| `POST /auth/logout` | Cookie `his_refresh` y origen permitido |
| `GET /auth/me` | Autenticado |
| `POST /auth/forgot-password` | Público |
| `POST /auth/reset-password` | Público, solo fuera de producción |
| `POST /auth/change-password` | Autenticado |

**Usuarios (`/usuarios`)**

| Método y ruta | Acceso |
| --- | --- |
| `POST /usuarios`, `GET /usuarios`, `GET /usuarios/:id`, `PATCH /usuarios/:id` | `ADMINISTRATIVO` |
| `PATCH /usuarios/:id/horario`, `/habilitar`, `/deshabilitar` | `ADMINISTRATIVO` |
| `POST /usuarios/administrativos`, `PATCH /usuarios/:id/baja`, `/restaurar` | Superadmin |

**Pacientes (`/pacientes`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /pacientes`, `GET /pacientes/:id` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /pacientes`, `PATCH /pacientes/:id/cobertura` | `ADMINISTRATIVO` |

**Turnos (`/turnos`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /turnos/disponibles`, `GET /turnos/transiciones` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `GET /turnos/agenda`, `POST /turnos`, `GET /turnos/espera`, `POST /turnos/espera`, `DELETE /turnos/espera/:id`, `POST /turnos/entreturno`, `PATCH /turnos/:id/transiciones` | `MEDICO`, `ADMINISTRATIVO` |

**Camas (`/camas`)**

| Método y ruta | Acceso |
| --- | --- |
| `GET /camas`, `GET /camas/:id` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /camas/:id/asignar`, `POST /camas/:id/alta` | `MEDICO`, `ADMINISTRATIVO` |
| `POST /camas/:id/limpieza/confirmar` | `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /camas/:id/bloquear`, `POST /camas/:id/desbloquear` | `ADMINISTRATIVO` |
| `GET /camas/eventos` (Server-Sent Events) | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |

`POST /camas/:id/asignar` acepta `motivoIngreso` (opcional, 3 a 200 caracteres). Si se informa, se guarda en la internación y Enfermería genera el protocolo de ingreso.

**Enfermería**

| Método y ruta | Acceso |
| --- | --- |
| `GET /signos-vitales`, `GET /signos-vitales/tipos`, `GET /signos-vitales/controles`, `POST /signos-vitales`, `POST /signos-vitales/controles` | `ENFERMERO`, `MEDICO` |
| `POST /indicaciones` | `MEDICO` |
| `GET /indicaciones` | `ENFERMERO`, `MEDICO` |
| `POST /indicaciones/:id/administraciones` | `ENFERMERO` |
| `GET /protocolos`, `PATCH /protocolos/:protocoloId/tareas/:tareaId` | `ENFERMERO`, `MEDICO` |
| `POST /protocolos/ingresos` (alta manual de un protocolo) | `MEDICO`, `ADMINISTRATIVO` |

**Historia clínica y triaje**

| Método y ruta | Acceso |
| --- | --- |
| `GET /historia-clinica/:pacienteId` | `MEDICO`, `ENFERMERO` |
| `POST /historia-clinica/:pacienteId/alergias`, `/antecedentes-familiares`, `/evoluciones`, `/estudios` | `MEDICO` |
| `POST /triaje` | `ENFERMERO`, `MEDICO` |
| `GET /triaje` | `ENFERMERO`, `MEDICO`, `ADMINISTRATIVO` |
| `PATCH /triaje/:id/atender` | `MEDICO` |

**Otros**

| Método y ruta | Acceso |
| --- | --- |
| `GET /resources/inventory` | `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO` |
| `POST /resources/inventory/descontar` | `MEDICO` |
| `GET /billing/cargos` | `ADMINISTRATIVO` |
| `GET /notificaciones`, `PATCH /notificaciones/:id/leer` | Autenticado |

### Reglas de negocio destacadas

- La agenda usa turnos regulares de 30 minutos y turnos urgentes de 15. Un entreturno solo puede insertarse 15 minutos después del inicio de un turno libre de 30; ese turno se reduce a 15 en la misma transacción.
- Flujo de turno: `RESERVADO -> CONFIRMADO -> EN_SALA_DE_ESPERA -> ATENDIDO`. Se puede cancelar desde `RESERVADO` o `CONFIRMADO`.
- Flujo de cama: `LIBRE -> OCUPADA -> EN_LIMPIEZA -> LIBRE`; `BLOQUEADA` es un estado de mantenimiento. Una cama ocupada no puede pasar a `LIBRE` sin el proceso intermedio de limpieza.
- Facturación: al atender un turno se crea un cargo de 15.000 ARS (consulta regular) o 25.000 ARS (urgencia). El reparto según cobertura es: pública, el paciente paga 0 y el Estado cubre el 100%; prepaga, copago fijo de 3.000 ARS y el resto a la prepaga; particular, el paciente paga el 100%. El copago de prepaga es un valor único provisorio, pendiente del nomenclador real.
- Enfermería: un control con temperatura mayor a 39 °C queda marcado como crítico y genera una notificación de alta prioridad. Una dosis solo se confirma dentro de ±30 minutos de su hora programada; al confirmarla se registra al enfermero, se descuenta una unidad del inventario y se crea el cargo de farmacia.
- Protocolos de ingreso: "cirugía programada" genera el protocolo pre-quirúrgico y "neumonía" o "infección respiratoria" el respiratorio. Otros motivos no tienen protocolo definido: la internación se crea igual y no se genera ninguno.
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
| `/enfermeria` | `ENFERMERO`, `MEDICO` | Contenedor con vistas anidadas: `signos-vitales`, `medicaciones`, `protocolos` |
| `/insumos` | `ENFERMERO`, `ADMINISTRATIVO` | Insumos |
| `/facturacion` | `ADMINISTRATIVO` | Cargos |

Las vistas se cargan de forma diferida. Un `beforeEach` restaura la sesión, redirige a `/login` conservando la ruta de destino en `redirect`, y bloquea el acceso por rol enviando al panel. Un `afterEach` actualiza el título del documento.

### Estado y reutilización

- **Pinia** (`defineStore` con la sintaxis de composición): `session.store` (en `features/iam/`), `beds.store`, `inventory.store`, `medications.store`, `notifications.store`, `triage.store` y `vitals.store`. Cada store expone estado, getters (`computed`) y acciones, con indicadores de carga y error.
- **Composables**: `useCharges`, `usePatients`, `useAppointments` y `useUsers`, que separan la lógica de acceso a datos de la presentación.
- **Comunicación entre componentes**: props tipadas con `defineProps`, eventos con `defineEmits`, slots en los componentes de interfaz y stores para el estado compartido.
- **Componentes de interfaz** reutilizables en `components/ui`: `BaseCard`, `DataTable`, `SideDrawer`, `StatusChip`, `StatCard`, `PageHeader`, `NoticeBanner`, entre otros.

### Conexión con la API (`src/shared/http.ts`)

Cliente basado en `fetch` con las siguientes características:

- Lee la URL base desde `VITE_API_URL`.
- El access token se guarda en memoria y se envía como `Bearer`. El refresh token viaja en una cookie `HttpOnly`; las rutas `/auth/` se envían con `credentials: 'include'`.
- Ante una respuesta no autorizada intenta renovar la sesión y, si falla, invoca el cierre de sesión y redirige al login.
- Convierte los errores HTTP y de red en una clase `ApiError` con estado y mensaje legible, que las stores muestran al usuario.

### Experiencia de usuario

Cada rol (médico, enfermero, administrativo) tiene un panel propio. La interfaz incluye indicadores de carga, mensajes de error, notificaciones, paneles laterales para altas y detalles, y reglas de estilo responsive (`@media`). La marca de la aplicación se define en `src/shared/brand.ts`.

## 12. Autenticación, roles y permisos

- Access token JWT de corta duración (15 minutos por defecto) y refresh token aleatorio rotativo. Este último se guarda como hash en base de datos y se envía solo en la cookie `his_refresh`, nunca en el cuerpo de la respuesta.
- Roles: `MEDICO`, `ENFERMERO` y `ADMINISTRATIVO`. Un indicador aparte identifica al superadmin raíz, que se crea con `iam:bootstrap-superadmin` y es el único que puede crear otros administrativos y dar de baja cuentas.
- Autorización con `AuthGuard`, `RolesGuard` y `SuperadminGuard`, aplicados por controlador o por ruta.
- Equivalencia entre los roles del diseño y los del sistema:

  | Rol en el documento de diseño | Rol en el sistema | Alcance |
  | --- | --- |
  | Administrador | `ADMINISTRATIVO` con indicador de superadmin (cuenta raíz) |
  | Médico | `MEDICO` | atencion clinica
  | Enfermero | `ENFERMERO` | signos vitales, medicacion, limpieza de camas
  | Recepcionista | `ADMINISTRATIVO` | pacientes, turnos, lista de espera consulta de triaje 
  | Paciente | No existe como cuenta: los pacientes son datos que carga el personal y no inician sesión |

  Las historias de usuario nombran además al administrativo de piso, al coordinador de agendas y al personal de admisión, que operan como `ADMINISTRATIVO`, y al personal de limpieza, cuya confirmación de higiene la registran `ENFERMERO` o `ADMINISTRATIVO`.
- Un médico recién registrado queda pendiente de habilitación por un administrativo. Las cuentas deshabilitadas no inician sesión y sus sesiones se revocan.
- Política de contraseña: mínimo 8 caracteres, una mayúscula, un dígito y sin dígitos consecutivos ascendentes ni descendentes. Las contraseñas se almacenan con `scrypt`.
- Los atajos de desarrollo (alta sin verificación por correo y restablecimiento sin código) están bloqueados con `NODE_ENV=production`.

## 13. Validaciones y manejo de errores

- Backend: `ValidationPipe` global con `whitelist` y `transform`, DTOs con `class-validator` y un filtro global de excepciones (`AllExceptionsFilter`). Los conflictos de reserva y de asignación devuelven error de conflicto.
- Las transiciones inválidas de turnos y camas se rechazan con error de negocio.
- Frontend: validación de formularios, errores de la API traducidos a mensajes legibles y estados de carga y error en cada store.

## 14. Pruebas

El backend usa Vitest (alternativa a Jest) y Supertest. Vitest ejecuta los archivos `*.spec.ts` y `*.test.ts`.

```bash
npm run api:test                                  # pruebas unitarias e integración sin base de datos
npm --prefix apps/api run test:cov                # con cobertura
npm --prefix apps/api run test:e2e                # e2e (requiere base de datos configurada)
```

Estado actual: **577 pruebas pasan y 7 se omiten** (las que necesitan una base real). Cubren IAM (autenticación, tokens, política de contraseñas, guards, administración de cuentas y autorización de `/usuarios`), admisión (turnos, entreturnos, pacientes, estados, triaje, notificaciones), enfermería (signos vitales, medicación, protocolos), recursos (camas, tiempo real, inventario), facturación e historia clínica. La cobertura de líneas de `modules/iam` es 94,68 %.

Pruebas que requieren una base real, deshabilitadas por defecto. **Corren solo contra PostgreSQL local**; cada archivo valida el host y el nombre de la base antes de escribir:

| Archivo | Variables | Requisito |
| --- | --- | --- |
| `test/turnos-concurrency.local.spec.ts` | `RUN_LOCAL_CONCURRENCY_TEST=true`, `DATABASE_URL` | Base local migrada llamada `his_admissions_test` |
| `test/inventory-service-concurrency.spec.ts` | `PGLOCAL_PASSWORD` | Base `his_test` en `localhost:5432`; correr antes `node scripts/prepare-inventory-test.mjs` |
| `test/protocolos-checklist.local.spec.ts` | `CHECKLIST_TEST_DATABASE_URL` | Base local migrada con al menos 2 usuarios y 1 paciente |
| `test/inventory-supabase.integration.spec.ts` | `RUN_SUPABASE_INTEGRATION=true`, `DATABASE_URL` | Solo acepta el host de Supabase y modifica inventario real: no correrlo sin avisar al equipo |

Con las tres bases locales configuradas pasan 583 pruebas y queda 1 omitida (la de Supabase).

Prueba funcional contra servidor y base reales: `apps/api/scripts/functional-check.mjs` recorre 29 criterios de aceptación de Enfermería, Recursos e IAM por HTTP. El resultado y la forma de repetirla están en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`.

Frontend: hay 4 archivos de pruebas con Vitest (`npm --prefix apps/web run test`). Pasan 3; `stores/__tests__/dashboard.store.spec.ts` falla porque importa un store que no existe. El script `type-check` (`vue-tsc --build`) verifica los tipos.

## 15. Seguridad

- `DATABASE_URL`, `JWT_SECRET` y credenciales solo existen en el backend y no se versionan.
- CORS restringido a los orígenes de `FRONTEND_ORIGINS`.
- Refresh token en cookie `HttpOnly`, rotado en cada renovación y almacenado como hash.
- Control de acceso por rol aplicado en el backend; las restricciones del router del frontend son solo de experiencia de usuario.
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

## 17. Capturas de pantalla

Pendiente. Para completar este apartado se deben agregar imágenes en `docs/img/` y referenciarlas desde esta sección. Pantallas sugeridas: inicio de sesión, panel por rol, agenda de turnos, mapa de camas, alta de paciente y facturación.

## 18. Guía para la evaluación

Ubicación en el código de cada criterio de la rúbrica.

| Criterio | Dónde verlo |
| --- | --- |
| Estructura general | `apps/web/src/main.ts`, `App.vue`, `app/AppShell.vue`, organización por `features/` |
| Directivas y templates | Vistas y componentes en `apps/web/src/features` y `components` (`v-if`, `v-for` con `:key`, `v-show`, `v-model`, `v-bind` y `v-on` en sus formas abreviadas) |
| Comunicación entre componentes | `defineProps`, `defineEmits` y slots en `components/ui`, paneles de `features/admissions` y drawers de `features/patients` |
| Router | `apps/web/src/app/router.ts`: rutas dinámicas, vistas anidadas en `/enfermeria`, props de ruta, guardas globales, metadatos de rol |
| Composables | `composables/` y `useAppointments.ts`, `useUsers.ts` en `features/` |
| Pinia | `apps/web/src/stores/` y `features/iam/session.store.ts` |
| Conexión con APIs | `shared/http.ts` y `services/` |
| UX/UI | Panel por rol, notificaciones, drawers, estados de carga y error, reglas responsive |
| Documentación | Este README y `docs/` |
| Proyecto NestJS | `apps/api/src/modules` (módulos por dominio con capas) |
| Interpretación del problema | Historias de usuario de Admisión, Enfermería, Recursos y Facturación cubiertas según la sección 2; verificación por historia en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md` |
| Base de datos | `apps/api/src/entities` y `apps/api/src/migrations` (PostgreSQL, relaciones y restricciones) |
| Autenticación y autorización | `apps/api/src/modules/iam` (JWT, refresh rotativo, guards por rol) |
| Test y documentación | `apps/api/src/**/*.spec.ts`, `apps/api/test`, `apps/api/scripts/functional-check.mjs`, Swagger en `/docs` |

## 19. Limitaciones conocidas y mejoras futuras

- **Eventos en memoria, sin entrega durable.** Si el servidor se cae entre la confirmación de la transacción y el procesamiento del evento, se pierde el efecto asociado: el descuento de inventario, el cargo de farmacia, el protocolo de ingreso o la notificación. La mejora es el patrón Outbox con idempotencia. Los suscriptores ya son idempotentes por clave (turno, administración, internación).
- **El protocolo de ingreso se genera en segundo plano.** `POST /camas/:id/asignar` responde antes de que exista el protocolo; un cliente que consulte en el mismo instante puede no verlo todavía.
- **Protocolos solo para dos motivos de ingreso.** Las historias de usuario definen tareas para ingreso pre-quirúrgico y para infección respiratoria. Para cualquier otro motivo no se genera protocolo.
- **Tiempo real de camas sin historial.** `GET /camas/eventos` solo entrega los cambios ocurridos con la conexión abierta, y con más de una instancia de la API cada cliente vería solo los eventos de la instancia a la que está conectado. El frontend todavía no lo consume.
- **Frontend de camas y de triaje con datos locales.** Los endpoints existen, pero esas dos pantallas no los consumen.
- **Copago de prepaga provisorio.** Es un valor único (3.000 ARS) hasta contar con el nomenclador real. Las tarifas y los umbrales clínicos también son valores fijos.
- **Historial de migraciones de la base compartida desincronizado con `main`.** Una migración ya aplicada figura con un timestamp anterior y bloquea `migration:run`. El diagnóstico y el arreglo propuesto están en `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`, sección 3. Sobre una base vacía las 26 migraciones aplican sin errores.
- **`migration:generate` no refleja cambios reales.** La base es más estricta que las entidades (restricciones, índices y longitudes definidos a mano), por lo que el comando siempre propone cambios. Las migraciones se escriben a mano.
- Las entidades TypeORM siguen en `src/entities/` en lugar de la infraestructura de cada módulo.
- `packages/contracts` no contiene contratos compartidos ni tiene `package.json` en su raíz. Hoy los DTOs viven en cada módulo de la API y los tipos del frontend en `apps/web/src/services`.
- El sistema tiene tres roles (`MEDICO`, `ENFERMERO`, `ADMINISTRATIVO`) frente a los cinco del documento de diseño; la equivalencia está en la sección 12.
- Sin verificación por correo electrónico ni recuperación de contraseña por correo.
- Una prueba del frontend falla (sección 14).

## 20. Documentación complementaria

| Archivo | Contenido |
| --- | --- |
| `docs/ARQUITECTURA.md` | Arquitectura, capas, eventos, persistencia, IAM y agenda |
| `docs/BILLING-IMPLEMENTACION.md` | Facturación: flujo, estrategias y persistencia |
| `docs/CONTRATOS-Y-GIT.md` | Contratos de API y flujo de trabajo con Git |
| `docs/FRONTEND-IMPLEMENTACION.md` | Implementación del frontend |
| `docs/VALIDACION-ERRORES-IMPLEMENTACION.md` | Validación y errores |
| `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md` | Prueba funcional contra servidor y base reales, migraciones sobre base vacía y tests de integración |
| `docs/RESUMEN-EXPOSICION.md` | Resumen para la exposición: patrones, concurrencia, eventos y límites |

## Integrantes
- ASTUDILLO AMPARO,
- CONTRERAS GABRIELA,
- GHIGO PATRICIO,
- MARI MACARENA,
- SCHNEIDER ANDRES,
- VILLA SOFIA