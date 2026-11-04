# Implementación mínima de Billing

## Objetivo

Billing crea un cargo persistente cuando Admisión marca un turno como
`ATENDIDO`. El alcance está limitado a la demo académica: no incluye pagos,
obras sociales, impuestos, descuentos ni facturas PDF.

## Flujo

1. Un administrativo o médico cambia un turno de `CONFIRMADO` a `ATENDIDO`.
2. Una vez confirmada la transacción, `TurnosService` publica
   `admissions.appointment-attended`.
3. `AppointmentAttendedSubscriber` recibe el evento y delega el cálculo a
   `BillingService`.
4. El servicio elige una Strategy según `urgente` y persiste un `Cargo`.
5. `GET /billing/cargos` permite mostrar los cargos creados en la demo.

El evento solo contiene el identificador del turno y si fue de urgencia; no
transporta información clínica ni datos personales innecesarios.

## Estrategias de importe

| Tipo de atención | Strategy | Importe |
| --- | --- | ---: |
| Consulta regular | `ConsultaRegularStrategy` | $15.000 ARS |
| Consulta de urgencia | `ConsultaUrgenciaStrategy` | $25.000 ARS |

Los importes se almacenan como enteros en pesos argentinos para este alcance
inicial.

## Persistencia e idempotencia

La migración `1792596068-CreateBillingCharges` crea la tabla `cargos`:

- `turno_id` referencia a `turnos`;
- `turno_id` es único;
- `importe_pesos` debe ser positivo;
- `tipo_atencion` solo admite `REGULAR` o `URGENCIA`.

La unicidad de `turno_id` evita que un reintento del evento genere más de un
cargo para el mismo turno. Cuando PostgreSQL informa esa colisión, Billing
recupera y reutiliza el cargo existente.

Con `DATABASE_URL` configurada, aplicar la migración mediante:

```bash
npm --prefix apps/api run migration:run
```

## Endpoint para la demo

```text
GET /billing/cargos
```

El endpoint requiere el rol `ADMINISTRATIVO` y devuelve los cargos ordenados
del más reciente al más antiguo.

## Relación con los objetivos de la tabla

Los objetivos asignados a **TU COMPAÑERO** quedan cubiertos así:

| Objetivo | Implementación |
| --- | --- |
| `BillingModule + Patrón Strategy` | `BillingModule`, `BillingService` y las estrategias regular/urgencia. |
| `Subscriber a AppointmentAttended` | `AppointmentAttendedSubscriber` consume el evento y crea el cargo idempotente. |
| `Tests de Integración con Supertest` | La prueba de integración publica eventos, comprueba ambos importes, evita duplicados y consulta el endpoint HTTP. |

La tarea de **TÚ** sobre eventos compartidos proporciona el `EventBus` global
usado para transportar `admissions.appointment-attended`. No se modifica su
contrato genérico. La configuración de `app.module.ts` ya registraba
`BillingModule`; únicamente se agregó la entidad `Cargo` a TypeORM, cambio
técnico indispensable para persistir los cargos. La documentación de
arquitectura y contratos asignada a **TÚ** no se modificó.

## Validación realizada

```bash
npm --prefix apps/api test -- \
  src/modules/billing/api/cargos.controller.integration.spec.ts \
  src/modules/admissions/application/turnos.service.spec.ts
npm --prefix apps/api run lint
npm --prefix apps/api run build
```

Las pruebas cubren la creación de cargos regular y urgente, la idempotencia,
la consulta por HTTP y la publicación del evento después de completar la
transacción de Admisión.
