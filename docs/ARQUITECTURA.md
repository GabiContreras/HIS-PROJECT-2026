# Arquitectura del HIS

## Objetivo

Adaptar el monorepo a la arquitectura de referencia UTN sin cambiar Vue 3, Vite, NestJS, TypeORM ni PostgreSQL. La organización es un **monolito modular** con límites de dominio, capas hexagonales y eventos internos para reducir acoplamiento.

Estado verificado el 16/11/2026 sobre el commit `f404552` de `main`.

## Módulos de dominio

- `iam`: usuarios, autenticación, roles y permisos.
- `admissions`: pacientes, turnos, agenda médica semanal con excepciones, especialidades, lista de espera de entreturnos, triaje y notificaciones.
- `ehr`: historia clínica inmutable (alergias, antecedentes, evoluciones, estudios con adjuntos, rectificaciones) y línea de tiempo.
- `nursing`: signos vitales, indicaciones, administración de medicación, notas de enfermería y protocolos de ingreso.
- `resources`: camas, sectores, habitaciones, internaciones e inventario con historial de movimientos.
- `billing`: cargos, nomenclador, cobertura, reportes y liquidaciones (ver `docs/BILLING-IMPLEMENTACION.md`).
- `health`: endpoint de estado técnico (`GET /health`).

## Capas por módulo

Cada módulo funcional sigue esta estructura:

```text
modules/<modulo>/
  domain/           # entidades/reglas del dominio y puertos (interfaces)
  application/      # casos de uso
  infrastructure/   # TypeORM, repositorios y servicios técnicos
  api/              # controladores NestJS y DTOs HTTP
  <modulo>.module.ts
```

Dependencias permitidas: `api -> application -> domain`; `infrastructure` implementa los puertos definidos por `domain`. El dominio no debe importar NestJS, TypeORM ni detalles HTTP.

## Estado de esta adaptación

Los seis módulos funcionales (`iam`, `admissions`, `ehr`, `nursing`, `resources`, `billing`) tienen casos de uso, controladores y migraciones; `health` es un esqueleto de diagnóstico. La adaptación es parcial en dos puntos:

- Las entidades TypeORM permanecen en `apps/api/src/entities/` (32 archivos) en lugar de la infraestructura de cada módulo.
- Algunos servicios de aplicación usan TypeORM directamente en lugar de un puerto de repositorio (por ejemplo, `billing`).

## Eventos

`src/shared/events` ofrece dos mecanismos que se combinan en `EventBus.publish`:

1. **Bus en memoria** (RxJS, `EventBus`): `publish` emite el evento a los suscriptores del mismo proceso (`ofType`). No hay entrega durable.
2. **Outbox** (`outbox_events`): si el tipo está en `DURABLE_EVENT_TYPES` (`shared/events/outbox/outbox.config.ts`), `publish` además guarda el evento en la base y lo entrega a los consumidores registrados en `OutboxService`.

Reglas que sigue el código:

- El evento se publica **después** de confirmar la transacción de negocio, nunca adentro.
- Los suscriptores en memoria no propagan errores al bus: los registran en el log.
- Cada efecto es idempotente por una clave de negocio respaldada por un índice único en la base, o por el registro de entregas del Outbox.
- Nombres de eventos en pasado, estables y sin datos clínicos innecesarios en el payload.

Contrato de un evento (`DomainEvent`):

```ts
{
  type: 'admissions.appointment-attended',
  occurredAt: new Date().toISOString(),
  payload: { appointmentId: '...', urgente: false, tipoAtencion: 'REGULAR' },
  correlationId?: string
}
```

### Cómo funciona el Outbox

| Pieza | Archivo | Función |
| --- | --- | --- |
| Tabla `outbox_events` | `entities/outbox-event.entity.ts`, migración `1797000000000-CreateOutboxEvents` | Evento, estado (`PENDIENTE`, `PROCESADO`, `FALLIDO`), consumidores que ya lo recibieron (`delivered_consumers`), intentos, último error y próximo intento |
| `OutboxService` | `outbox/outbox.service.ts` | Guarda el evento (`enqueue`), lo entrega a los consumidores registrados (`registerConsumer`) y registra los fallos |
| `OutboxWorker` | `outbox/outbox.worker.ts` | Al arrancar y cada 15 segundos toma hasta 50 eventos `PENDIENTE` vencidos, del más antiguo al más nuevo, y los vuelve a entregar |
| `TypeOrmOutboxStore` | `outbox/typeorm-outbox.store.ts` | Persistencia; la entrega bloquea la fila (`pessimistic_write`) |

Funcionamiento:

1. `publish` guarda la fila con `next_attempt_at` a 30 segundos (período de gracia) y entrega de inmediato a cada consumidor registrado para ese tipo.
2. La entrega a un consumidor corre en una transacción: bloquea la fila, ejecuta el manejador con el mismo `EntityManager`, agrega el nombre del consumidor a `delivered_consumers` y, si ya recibieron todos los consumidores esperados, pasa el evento a `PROCESADO`. Si el consumidor ya figuraba en `delivered_consumers`, no se vuelve a ejecutar.
3. Si un consumidor falla, se suma un intento, se guarda el error y el próximo intento se difiere `5 s × 2^(intentos-1)` con tope de 300 s. Al llegar a 10 intentos el evento queda en `FALLIDO` y el worker deja de tomarlo.
4. Un consumidor puede devolver una función que se ejecuta después del commit de la entrega (se usa para publicar `inventory.low-stock`).
5. Si no se puede guardar la fila, el evento se entrega a los consumidores solo en memoria y se registra el error.

Alcance y límites:

- La fila del Outbox se inserta **después** del commit del cambio de negocio, no en la misma transacción. Si el proceso cae entre ambos pasos, el evento se pierde. La garantía vale desde que la fila existe.
- Los eventos durables sin consumidor registrado (`bed.assigned`, `bed.cleaned`, `bed.transferred`, `bed.blocked` y `bed.unblocked`) quedan en `PENDIENTE`. Su lector es el stream de camas (ver más abajo).
- Los suscriptores de Admisión (notificaciones), el de Enfermería (protocolo de ingreso) y el de Recursos (stock bajo) siguen en memoria y no tienen reintento.

### Eventos entre módulos

| Evento (`type`) | Publica | Cuándo | Entrega | Escucha | Efecto | Clave de idempotencia |
| --- | --- | --- | --- | --- | --- | --- |
| `admissions.appointment-attended` | Admisión (`TurnosService`, `TriageService`) | Un turno pasa a `ATENDIDO`, o un médico atiende un triaje | Outbox | Facturación, consumidor `billing.appointment-attended` | Crea el cargo de consulta | `turno_id` único en `cargos` |
| `medication.administered` | Enfermería (`IndicacionesService`) | Se confirma una dosis nueva | Outbox | Recursos, consumidor `resources.medication-administered` | Descuenta una unidad del insumo y registra el movimiento | Registro de entregas del Outbox (una vez por consumidor, en la misma transacción) |
| `medication.administered` | Enfermería (`IndicacionesService`) | Ídem | Outbox | Facturación, consumidor `billing.medication-administered` | Crea el cargo "Insumos de Farmacia" | `administration_id` único en `cargos` |
| `bed.released` | Recursos (`CamasService`) | Alta: `OCUPADA` a `EN_LIMPIEZA` | Outbox | Facturación, consumidor `billing.bed-released`; stream de camas | Crea el cargo de internación; el stream lo reenvía | `internacion_id` único en `cargos` |
| `bed.assigned` | Recursos (`CamasService`) | `LIBRE` a `OCUPADA` | Outbox | Stream de camas | Se reenvía por `GET /camas/eventos` | No aplica |
| `bed.cleaned` | Recursos (`CamasService`) | `EN_LIMPIEZA` a `LIBRE` | Outbox | Stream de camas | Ídem | No aplica |
| `bed.transferred` | Recursos (`CamasService`) | Traslado entre camas | Outbox | Stream de camas | Ídem (emite un mensaje por cada cama) | No aplica |
| `bed.blocked`, `bed.unblocked` | Recursos (`CamasService`) | `LIBRE` a `BLOQUEADA` y a la inversa | Outbox | Stream de camas | Ídem | No aplica |
| `patient.admitted` | Recursos (`CamasService.asignar`) | Se asigna una cama informando `motivoIngreso` | Memoria | Enfermería (`PatientAdmittedSubscriber`) | Genera el protocolo de ingreso (Builder) | `ingreso_id` único en `protocolos_ingreso` |
| `vital-sign.alert-raised` | Enfermería (`SignosVitalesService`) | Se guarda un signo vital fuera de rango | Memoria | Admisión (`VitalSignAlertSubscriber`) | Con temperatura mayor a 39 °C, notificación `ALTA` al médico responsable de la internación activa, o a todos los médicos activos si no hay | No tiene |
| `admissions.patient-waiting` | Admisión (`TurnosService`) | Un turno pasa a `EN_SALA_DE_ESPERA` | Memoria | Admisión (`PatientWaitingSubscriber`) | Notificación al médico del turno | No tiene |
| `admissions.standby-promoted` | Admisión (`TurnosService`) | Una cancelación promueve a un paciente de la lista de espera | Memoria | Admisión (`StandbyPromotedSubscriber`) | Notificación a los administrativos | No tiene |
| `inventory.low-stock` | Recursos (`InventoryService`) | Un descuento deja el insumo en o por debajo de su `stockMinimo` (mayor a 0) habiendo estado por encima; no se repite mientras siga bajo el mínimo | Memoria | Recursos (`LowStockNotificationSubscriber`) | Notificación `STOCK_BAJO` (prioridad `MEDIA`) a los administrativos activos | No tiene |

`patient.registered`, `appointment.booked` y `appointment.attended` están definidos en `shared/events` (`integration-event-names.ts`), pero ningún módulo los publica ni los escucha.

`bed.blocked` y `bed.unblocked` son propios de Recursos: sus constantes están en `modules/resources/domain/bed-events.ts` y no en `shared/events`.

Durabilidad: son durables los 8 tipos de `DURABLE_EVENT_TYPES` (`admissions.appointment-attended`, `medication.administered` y los seis `bed.*`). `patient.admitted`, `vital-sign.alert-raised`, `admissions.patient-waiting`, `admissions.standby-promoted` e `inventory.low-stock` siguen solo en memoria: si el proceso cae antes de procesarlos, se pierde el efecto (el protocolo de ingreso o la notificación).

### Stream de camas en tiempo real

`GET /camas/eventos` (roles `MEDICO`, `ENFERMERO`, `ADMINISTRATIVO`) expone los eventos de cama como Server-Sent Events. Responde a la historia de usuario 2.1 de Recursos, que pide publicar eventos para actualizar en tiempo real los monitores.

- **Formato.** Cada cambio llega como un mensaje `data: {"tipo","camaId","numero","estado","at"}`, donde `estado` es el estado en que queda la cama. Cada 25 segundos se envía un evento `ping` para que proxies y navegadores no cierren la conexión.
- **Origen de los datos.** `BedEventsStreamService.stream()` consulta cada segundo la tabla `outbox_events` (tipos `bed.*`) desde el momento de la conexión, con un cursor por fecha de creación e id, y traduce cada fila a un mensaje. Por eso los clientes conectados a distintas instancias de la API reciben los mismos eventos. Sin conexión a base de datos (pruebas unitarias) usa el bus en memoria.
- **Latencia.** Hasta aproximadamente un segundo, por la consulta periódica, y depende de que la fila del Outbox se haya podido guardar.
- **Ruta.** Está declarada antes de `GET /camas/:id` para que `eventos` no se interprete como un id.
- **Autenticación.** Usa el mismo `AuthGuard` con token Bearer. El `EventSource` del navegador no puede enviar el header `Authorization`, por lo que el cliente debe consumirlo con `fetch` leyendo el cuerpo. El token no se acepta por query string.
- **Límites.** No hay historial: solo se entregan los cambios ocurridos con la conexión abierta, así que el cliente carga primero el mapa con `GET /camas`.

## Persistencia

- PostgreSQL (el entorno compartido usa Supabase); no se adopta SQLite de la referencia.
- `synchronize: false`; el esquema se modifica con migraciones versionadas en `apps/api/src/migrations/` (39 archivos al 16/11/2026), escritas a mano e idempotentes (`IF NOT EXISTS`). No se usa la salida de `migration:generate`: la base es más estricta que las entidades (restricciones, índices y longitudes definidos en SQL) y el comando propone borrarlas.
- El código TypeScript usa `camelCase`; los nombres de tablas y columnas en PostgreSQL usan `snake_case`, mediante `SnakeNamingStrategy`, configurada tanto en `app.module.ts` como en `data-source.ts`.
- Las migraciones de nomenclador siembran las prestaciones iniciales de Facturación (ver `docs/BILLING-IMPLEMENTACION.md`); el resto de las tablas arranca vacía.
- `DATABASE_URL` es secreto y solo se usa en backend.
- `DATABASE_SSL=false` permite desactivar SSL solo en entornos locales que lo requieran; por defecto se utiliza SSL.

## API REST

- Controladores delgados: traducen HTTP a casos de uso.
- DTOs con `class-validator`; `ValidationPipe` global con `whitelist` y `transform`.
- Errores consistentes (`AllExceptionsFilter`); `409 Conflict` ante reservas, asignaciones o transiciones incompatibles.
- Los listados paginados de Admisión (`GET /pacientes`, `GET /turnos/agenda`, `GET /triaje`) devuelven el total en el header `X-Total-Count`, expuesto por CORS; los de Facturación devuelven `{ items, total, limit, offset }`.
- Endpoints documentados en Swagger (`/docs`, desactivado con `NODE_ENV=production`).
- Guards y autorización protegen las rutas antes de exponer datos sensibles.

## IAM y Admisión implementados

- IAM autentica con JWT de acceso (15 minutos por defecto) y refresh tokens aleatorios rotatorios almacenados como hash; el refresh viaja en cookie HttpOnly, SameSite=Strict localmente y SameSite=None/Secure en producción.
- Los roles son `MEDICO`, `ENFERMERO` y `ADMINISTRATIVO`. Un indicador separado identifica al superadmin raíz, que se provisiona con el comando `iam:bootstrap-superadmin`; solo esa cuenta crea otros administrativos.
- Durante desarrollo, el alta de médicos y enfermeros no envía códigos por correo. Enfermería queda activa y el médico requiere habilitación administrativa. La verificación por correo se pospone hasta configurar el servicio de correo; estos atajos quedan bloqueados en `NODE_ENV=production`.
- No hay restablecimiento por correo: `PATCH /usuarios/:id/restablecer-clave` (administrativo) asigna una contraseña temporal y revoca las sesiones de la cuenta.
- Las cuentas deshabilitadas no pueden iniciar sesión y sus sesiones se revocan.
- Baja lógica: solo el superadmin puede dar de baja (estado `BAJA`) y restaurar cuentas. Una cuenta dada de baja no inicia sesión ni aparece en listados, pero se conservan sus turnos y su historial (los datos clínicos y de facturación no se borran). Un médico con turnos futuros activos no se da de baja hasta resolverlos. Los administrativos comunes no pueden gestionar a otros administrativos.
- La contraseña requiere 8 caracteres, una mayúscula, un dígito y no permite dígitos consecutivos ascendentes ni descendentes.
- La agenda usa turnos regulares de 30 minutos y turnos urgentes (entreturnos) de 15. Los horarios libres se **calculan**: no hay filas de turnos disponibles. Dependen del horario del médico (`PATCH /usuarios/:id/horario`), de su agenda semanal por bloques (`PUT /agenda-medica/:medicoId`, que reemplaza la jornada general) y de las excepciones por ausencia o feriado (`/agenda-medica/excepciones`). El horario de la clínica es de 08:00 a 20:00.
- Un entreturno solo puede comenzar 15 minutos después del inicio de un horario libre de 30 minutos; ocupa la segunda mitad y el horario anterior queda en 15 minutos.
- Reserva, reprogramación, creación de entreturnos y cambios de estado bloquean la fila del médico y la del turno en una transacción; un índice único evita dos turnos activos en el mismo horario. Las transiciones válidas son `RESERVADO -> CONFIRMADO -> EN_SALA_DE_ESPERA -> ATENDIDO`, con cancelación desde `RESERVADO` o `CONFIRMADO` (Patrón State). Un turno se puede reprogramar solo en esos dos estados y cancelar con motivo (`POST /turnos/:id/cancelar`), que registra quién canceló y cuándo. Al cancelar, el horario liberado pasa en la misma transacción al primero de la lista de espera de ese médico y día.
- Al atender un triaje (`PATCH /triaje/:id/atender`) se crea un turno urgente ya `ATENDIDO` para el médico que atiende y se publica `admissions.appointment-attended`, lo que genera el cargo de urgencia.
- Las rutas de EHR, Nursing, Resources y Billing están implementadas; sus contratos están en `docs/CONTRATOS-Y-GIT.md`.

## Criterios para integrar Pull Requests

- Compila y pasan las pruebas pertinentes.
- No agrega secretos ni `.env`.
- Incluye migraciones (nuevas, escritas a mano e idempotentes) si cambia el esquema; no se editan las ya aplicadas.
- Respeta los límites de módulo y contratos acordados.
- Las reglas críticas se validan en backend/base de datos, no solo en frontend.

## Patrón reutilizable de historia vertical

### Objetivo

Implementar una funcionalidad completa de extremo a extremo antes de replicar el enfoque en otros módulos del HIS.

### Pasos de implementación

1. **Contrato:** definir criterios de aceptación, DTO, endpoint, permisos y errores esperados.
2. **Validación:** validar los datos de entrada en la API; no depender únicamente de la interfaz.
3. **Caso de uso:** implementar las reglas de negocio en la capa de aplicación.
4. **Persistencia:** utilizar repositorios y transacciones cuando la operación requiera atomicidad.
5. **Interfaz:** conectar la acción de Vue con la API y mostrar estados de éxito y error cuando corresponda.
6. **Pruebas:** cubrir reglas de negocio, errores, integración con PostgreSQL y concurrencia cuando corresponda.
7. **Entrega:** ejecutar las pruebas y la compilación, revisar Git y documentar las decisiones relevantes.

### Aplicación al alta de pacientes

El endpoint `POST /pacientes` recibe los datos definidos por `CrearPacienteDto`. La API valida nombre, apellido, documento, fecha de nacimiento, teléfono opcional y cobertura. Un documento duplicado produce un conflicto HTTP `409`; los datos inválidos, un error HTTP `400`.

### Aplicación a la reserva de turnos

El endpoint `POST /turnos` requiere autenticación y autorización según el controlador. La solicitud incluye `medicoId`, `fechaHora` y `pacienteId`.

La reserva se protege en el backend mediante una transacción y bloqueo pesimista en PostgreSQL. No alcanza con comprobar disponibilidad desde Vue. Ante dos solicitudes incompatibles, solo una confirma la reserva y la otra recibe `409`.

### Criterios de finalización

- Se cumplen los criterios de aceptación de la historia.
- Las capas necesarias están integradas.
- La persistencia conserva la integridad de los datos.
- Las pruebas pertinentes pasan, incluidas las de concurrencia cuando correspondan.
- La compilación pasa y los cambios están documentados.
