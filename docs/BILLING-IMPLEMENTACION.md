# Facturación (módulo `billing`)

Descripción del flujo de facturación tal como está en el código. Estado verificado el 18/11/2026 sobre el commit `140aca4` de `main`. Los contratos HTTP completos (parámetros, respuestas y códigos de error) están en `docs/CONTRATOS-Y-GIT.md`.

## Alcance

El módulo crea cargos automáticos a partir de eventos de otros módulos, calcula el reparto entre paciente y tercero según la cobertura, mantiene el estado de cada cargo y ofrece listado, exportación, reportes y liquidación a terceros. No incluye pagos reales, impuestos, descuentos ni facturas en PDF. Los importes son enteros en pesos argentinos.

## Orígenes de cargos

Los tres orígenes llegan por el Outbox (ver `docs/ARQUITECTURA.md`): cada uno es un consumidor registrado por un suscriptor de `billing/application`.

| Origen | Evento | Consumidor del Outbox | Cargo creado | Clave de idempotencia |
| --- | --- | --- | --- | --- |
| Turno atendido | `admissions.appointment-attended` | `billing.appointment-attended` | `REGULAR` o `URGENCIA`, según el turno | `turno_id` único en `cargos` |
| Medicación administrada | `medication.administered` | `billing.medication-administered` | `FARMACIA`, concepto "Insumos de Farmacia" | `administration_id` único en `cargos` |
| Alta de cama | `bed.released` | `billing.bed-released` | `INTERNACION`, concepto "Internación: N días de cama" | `internacion_id` único en `cargos` |

Si el consumidor falla, el Outbox reintenta con espera creciente hasta 10 intentos; después el evento queda en estado `FALLIDO`. Si la inserción choca con el índice único (reentrega), el servicio devuelve el cargo ya existente.

### Consulta

`BillingService.createForAppointment` elige la estrategia de importe (`ConsultaRegularStrategy` o `ConsultaUrgenciaStrategy`, en `billing/domain`), cada una asociada a un código de prestación del nomenclador. Resuelve el valor y el copago con `NomencladorService`, calcula el reparto con la estrategia de cobertura del paciente y guarda el cargo con la cobertura, la entidad y el financiador vigentes en ese momento: un cambio posterior en el paciente no modifica los cargos ya emitidos.

### Farmacia

El importe es `precioPesos` del insumo por la cantidad administrada. El cargo no tiene reparto (`importe_paciente_pesos` e `importe_tercero_pesos` quedan en `null` y no tiene tipo de cobertura), pero guarda el `financiador_id` del paciente. Si el insumo tiene precio 0 o inválido, el consumidor lanza un error y el Outbox reintenta; el alta de insumos (`POST /resources/inventory`) usa 0 como precio por defecto.

### Internación

Se genera un único cargo por internación al dar el alta. Los días de cama son los días de calendario, en hora de Buenos Aires, entre `fechaIngreso` y `fechaEgreso`: cuenta el día de ingreso y no el de egreso, con un mínimo de 1 (`calcularDiasCama`, `billing/domain/dias-cama.ts`). El valor diario sale de la prestación `DIA_CAMA`. El copago se aplica una sola vez sobre el total. `bed.transferred` no genera cargos. Si la prestación falta o las fechas son inválidas, el consumidor falla y el Outbox reintenta.

## Nomenclador

Dos tablas: `prestaciones` (código, valor base y copago) y `tarifas` (valor y copago opcional por financiador y prestación, único por par). `NomencladorService.resolve` busca la prestación activa y, si el paciente tiene `financiadorId`, la tarifa activa de ese financiador; sin tarifa usa el valor base y el copago de la prestación. Si la tarifa no define copago (`null`), usa el de la prestación.

Prestaciones sembradas por las migraciones:

| Código | Valor base | Copago | Migración |
| --- | ---: | ---: | --- |
| `CONSULTA_REGULAR` | $15.000 | $3.000 | `1797600000000-CreatePrestacionesYTarifas` |
| `CONSULTA_URGENCIA` | $25.000 | $3.000 | `1797600000000-CreatePrestacionesYTarifas` |
| `DIA_CAMA` | $50.000 | $3.000 | `1797700000000-AddInternacionCharges` |

Estos valores son provisorios hasta que el docente defina el nomenclador. No existe un endpoint para administrar prestaciones ni tarifas: hoy se modifican por SQL o con una migración nueva. La tabla `tarifas` queda vacía, por lo que todos los cargos usan el valor base.

## Cobertura

`CoverageStrategy` (patrón Strategy, `billing/domain/coverage.strategy.ts`) reparte el valor entre paciente y tercero:

| Cobertura | Paciente | Tercero |
| --- | --- | --- |
| `OBRA_SOCIAL_PUBLICA` | 0 | 100 % del valor |
| `MEDICINA_PREPAGA` | copago (tope: el valor) | valor menos copago |
| `PARTICULAR` | 100 % del valor | 0 |

El catálogo de financiadores y planes (`/billing/financiadores`, `/billing/planes`) permite crear y editar; la baja es lógica (`activo: false`), sin `DELETE`. El paciente guarda `tipoCobertura` y `entidadCobertura` (texto libre) y tiene además las columnas `financiador_id`, `plan_id` y `numero_afiliado`, pero ningún endpoint de Admisión las escribe (`POST /pacientes` y `PATCH /pacientes/:id/cobertura` no reciben `financiadorId`): en el uso real los cargos quedan con `financiador_id` en `null`, usan el valor base del nomenclador y no entran en una liquidación.

`SimulatedCoverageVerifier` implementa el puerto `COVERAGE_VERIFIER` (que `BillingModule` exporta): verifica que el financiador y el plan existan, estén activos y se correspondan. Ningún módulo lo invoca todavía.

## Estados del cargo

Patrón State (`billing/domain/estado-cargo.ts`). Todos los cargos arrancan en `PENDIENTE`.

| Desde | `pagar` | `anular` | `facturar` (solo la liquidación) |
| --- | --- | --- | --- |
| `PENDIENTE` | `PAGADO` | `ANULADO` | `FACTURADO` |
| `FACTURADO` | `PAGADO` | `ANULADO` | no |
| `PAGADO` | no | no | no |
| `ANULADO` | no | no | no |

Una transición inválida responde `409`. `PATCH /billing/cargos/:id/anular` también responde `409` si el cargo ya pertenece a una liquidación. Los cambios de estado toman el cargo con bloqueo pesimista (`pessimistic_write`).

## Consultas y exportación

- `GET /billing/cargos`: página `{ items, total, limit, offset }` con filtros combinables `desde`, `hasta`, `pacienteId`, `estado` y `tipoAtencion`. Cada elemento incluye turno, médico, paciente y reparto; el paciente se resuelve también para los cargos de farmacia e internación.
- `GET /billing/cargos/exportar`: los mismos filtros, sin paginar, en CSV UTF-8 con BOM, separado por comas, con fin de línea CRLF. Se genera en lotes de 500. Los textos que empiezan con `=`, `+`, `-`, `@` o tabulación se prefijan con una comilla simple.
- `GET /billing/cargos/resumen`: totales por tipo de cobertura.
- Las fechas se interpretan en hora de Buenos Aires (`America/Argentina/Buenos_Aires`).

## Reportes administrativos

Todos son `GET` bajo `/billing/reportes` y requieren `ADMINISTRATIVO`:

| Ruta | Contenido |
| --- | --- |
| `cargos-por-periodo` | Cargos por día o por mes, con totales y los anulados aparte |
| `cargos-por-medico` | Cargos por médico del turno; farmacia e internación van en "Sin médico asignado" |
| `cargos-por-servicio` | Cargos por tipo de atención |
| `ocupacion-camas` | Camas activas, ocupadas y porcentaje (foto del momento, sin historial) |
| `consumo-insumos` | Descuentos de inventario por insumo, manuales y por medicación |

## Liquidaciones a terceros

`POST /billing/liquidaciones` recibe `{ financiadorId, desde, hasta }`. En una sola transacción toma los cargos `PENDIENTE` del financiador, con importe de tercero mayor a 0, creados en el período y que no estén en otra liquidación; los pasa a `FACTURADO` vinculados a la liquidación y guarda cantidad y total. Responde `409` si no hay cargos para liquidar. Las liquidaciones son inmutables y no registran el pago del tercero. `GET /billing/liquidaciones` (paginado, filtro por financiador) y `GET /billing/liquidaciones/:id` (con los cargos incluidos) las consultan.

Como el financiador se guarda en cada cargo al crearlo, los cargos anteriores a esa columna y los de pacientes sin `financiadorId` no se liquidan (ver "Cobertura").

## Persistencia

| Migración | Contenido |
| --- | --- |
| `1792596068000-CreateBillingCharges` | Tabla `cargos` con `turno_id` único |
| `1793370300000-AddCoberturaToPacientesYCargos` | Cobertura del paciente y reparto en el cargo |
| `1793500000000-DropLegacyCargosDesgloseCheck` | Retira una restricción previa del desglose |
| `1793600000000-AddInsumoPrice` | `insumos.precio_pesos` (por defecto 0) |
| `1793700000000-AddPharmacyCharges` | Cargos de farmacia (`administration_id` único) |
| `1797100000000-AddCargoEstado` | Columna `estado` |
| `1797200000000-CreateFinanciadoresYPlanes` | Catálogo de financiadores y planes |
| `1797300000000-AddCoberturaCatalogoToPacientes` | `financiador_id`, `plan_id` y `numero_afiliado` en pacientes |
| `1797600000000-CreatePrestacionesYTarifas` | Nomenclador y valores de las dos consultas |
| `1797700000000-AddInternacionCharges` | Cargos de internación y prestación `DIA_CAMA` |
| `1797900000000-CreateLiquidaciones` | Tabla `liquidaciones` y `cargos.liquidacion_id` |

Aplicar: `npm --prefix apps/api run migration:run`, solo contra una base local (ver README, sección 9).

## Pruebas

Las pruebas del módulo (unitarias, de integración HTTP y de dominio) están junto al código en `apps/api/src/modules/billing/**/*.spec.ts`. El flujo de punta a punta de un cargo de urgencia con Outbox real corre solo contra PostgreSQL local: `apps/api/test/cargo-urgencia.local.spec.ts` (variable `CARGO_URGENCIA_TEST_DATABASE_URL`, ver README, sección 14).

```bash
npm --prefix apps/api test -- src/modules/billing
```

## Límites actuales

- Valores del nomenclador provisorios y sin endpoint de administración.
- Sin carga de `financiadorId`, `planId` y `numeroAfiliado` desde Admisión: las liquidaciones a terceros no encuentran cargos con datos reales.
- El verificador de cobertura es simulado y no se invoca desde Admisión.
- El frontend no consume las liquidaciones, los reportes ni el catálogo de coberturas (ver `docs/FRONTEND-IMPLEMENTACION.md`).
