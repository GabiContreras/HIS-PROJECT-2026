# Pruebas funcionales: Enfermería, Recursos e IAM

Registro de la verificación del Bloque B contra **un servidor y una base de datos reales** (no mocks), más el resultado de correr las migraciones desde cero y los tests de integración que el repositorio omite por defecto.

- **Fecha:** 10/11/2026.
- **Entorno:** PostgreSQL 16 local, base vacía migrada desde cero, API compilada (`node dist/main`) en `http://localhost:3000`, Node 22.
- **Base compartida (Supabase):** no se usó en ninguna de estas pruebas.

## 1. Definición de terminado verificada

| Criterio | Resultado |
| --- | --- |
| `npm run api:build` | Compila sin errores |
| `npm run api:test` | 577 pasan, 7 omitidos (la línea base era 424 al empezar el bloque) |
| `npm run api:test` con las bases locales configuradas | 583 pasan, 1 omitido (el de Supabase, a propósito) |
| `npm --prefix apps/api run lint` | 3 warnings, los mismos que antes del bloque |
| Cobertura de `modules/iam` (líneas) | 94,68 % (antes 80,75 %) |
| Migraciones sobre base vacía | 26 de 26 aplicadas |
| Prueba funcional | 29 casos, 29 pasaron, 0 fallaron. |

## 2. Prueba funcional por historia de usuario

Cada fila es un criterio de aceptación de las historias de usuario, ejercitado por HTTP contra la API levantada y comprobado además en la base cuando corresponde (stock, internaciones, administraciones).

| HU | Qué se probó | Resultado esperado | Resultado | Observación |
| --- | --- | --- | --- | --- |
| Recursos 1.1 | Dos asignaciones simultáneas de la misma cama | Una 201 y una 409 | Pasó | HTTP 201, 409; internaciones activas: 1; mensaje: "La cama Pbhafu00 ya fue ocupada por otro operador." |
| Recursos 1.1 | Un paciente ya internado no puede ocupar otra cama | 409 | Pasó | HTTP 409: "El paciente ya tiene una internación activa." |
| Recursos 1.1 | Vínculo paciente, cama y marca temporal de ingreso | Internación persistida | Pasó | estado OCUPADA; fecha_ingreso 2026-11-11T02:06:53.894Z |
| Enfermería 2.1 | Asignar cama con motivo "Cirugía programada" | Aparece el protocolo pre-quirúrgico sin llamar a POST /protocolos/ingresos | Pasó | HTTP 201; tipo PRE_QUIRURGICO; tareas: Verificar ayuno de 8 horas / Colocar vía intravenosa periférica / Realizar control de signos vitales cada 2 horas; motivo guardado: "Cirugía programada" |
| Enfermería 2.1 | Reintentar el mismo ingreso | No duplica el protocolo | Pasó | HTTP 201; mismo protocolo: true; protocolos del paciente: 1 |
| Enfermería 2.1 | Asignar cama con motivo "Neumonía" | Protocolo respiratorio | Pasó | HTTP 201; tipo RESPIRATORIO; tareas: Monitoreo de saturación de oxígeno continuo / Indicación de aislamiento de contacto y gotas |
| Enfermería 2.1 | Asignar cama sin motivo | Cama ocupada y ningún protocolo | Pasó | HTTP 201; protocolos: 0 |
| Enfermería 2.1 | PATCH /protocolos/:id/tareas/:tareaId | Guarda quién y cuándo | Pasó | HTTP 200; hecha=true; hechaPor="Prueba, enfermero"; hechaEn=2026-11-11T02:06:55.411Z |
| Recursos 2.1 | Alta, limpieza y confirmación | OCUPADA → EN_LIMPIEZA → LIBRE | Pasó | alta → EN_LIMPIEZA; asignar en limpieza → HTTP 409 "Cama Pbhafu00: No se puede asignar un paciente a una cama en estado EN_LIMPIEZA."; confirmar → LIBRE |
| Recursos 2.1 | Transiciones inválidas | 409 en cada una | Pasó | confirmar limpieza en LIBRE: 409; alta en LIBRE: 409; bloquear OCUPADA: 409 |
| Recursos 2.1 | Bloqueo por mantenimiento | LIBRE → BLOQUEADA → LIBRE; no se asigna bloqueada | Pasó | bloquear → BLOQUEADA; asignar bloqueada → HTTP 409; desbloquear → LIBRE |
| Recursos 2.1 | GET /camas/eventos abierto mientras se opera (B3) | Llegan los eventos en vivo | Pasó | HTTP 200 text/event-stream; 7 eventos: bed.assigned, bed.assigned, bed.assigned, bed.released, bed.cleaned, bed.blocked, bed.unblocked |
| Recursos 2.1 | Stream sin token y con token por query string | 401 en ambos | Pasó | sin token: 401; por query: 401 |
| Enfermería 1.1 | Control con valores normales | 201, critico: false y nota automática | Pasó | HTTP 201; critico=false; nota: "Controles de signos vitales realizados con éxito." |
| Enfermería 1.1 | Control con temperatura 39,5 | 201, critico: true, nota y notificación de alta prioridad al médico | Pasó | HTTP 201; critico=true; nota: "Valores fuera de rango: Temperatura."; notificación al médico responsable: prioridad ALTA, "¡ALTA PRIORIDAD! Temperatura de 39.5 °C (supera 39 °C) en el paciente Paciente2 Prueba mwbhafu0."; otro médico recibió 0 |
| Enfermería 1.1 | Control con valor implausible | 400 y no se guarda nada | Pasó | HTTP 400; filas antes 8, después 8; "Temperatura: 60 no es plausible (esperado entre 25 y 45 °C)." |
| Enfermería 1.2 / Recursos 3.1 | Administrar dentro de ±30 min | 201, registra al enfermero y descuenta 1 unidad (50 → 49) | Pasó | HTTP 201; stock 49; enfermero vinculado: true; cargo de farmacia: sí ($250) |
| Enfermería 1.2 | Administrar fuera de ±30 min | Rechazada (409) y sin descuento | Pasó | HTTP 409: "No hay una dosis programada dentro de ±30 minutos de este momento."; stock sin cambios: true |
| Enfermería 1.2 | Dos administraciones simultáneas de la misma dosis | Una sola se registra | Pasó | HTTP 201, 409, 409; administraciones guardadas: 1; stock 49 → 48 |
| Recursos 3.1 | Descuento concurrente con stock justo | Sin stock negativo; 409 cuando falta | Pasó | 15 pedidos sobre 10 unidades: 10 aceptados, 5 con 409; stock final 0 |
| IAM | Login y GET /auth/me | 200 con access token y cookie de refresh HttpOnly | Pasó | HTTP 200; refresh fuera del JSON: true; cookie HttpOnly: true; /auth/me → ENFERMERO |
| IAM | Refresh rotativo | Token nuevo; el refresh ya usado se rechaza y revoca la familia | Pasó | refresh → 200 (cookie rotada: true); reuso del anterior → 401; el nuevo tras el reuso → 401 |
| IAM | Logout | 204 y el refresh deja de servir | Pasó | logout → 204; refresh posterior → 401 |
| IAM | Origen no permitido en /auth/login | 403 | Pasó | origen ajeno → 403; sin Origin → 403 |
| IAM | Bloqueo tras intentos fallidos | 5 fallos → cuenta bloqueada; ni la contraseña correcta entra | Pasó | intentos fallidos → 401, 401, 401, 401, 401; contraseña correcta después → 401; bloqueo de ~15 min; mismo mensaje genérico: "Correo o contraseña incorrectos." |
| IAM | Sin token y con token inválido | 401 | Pasó | sin token → 401; token adulterado → 401 |
| IAM | Cada rol contra endpoints que no le corresponden | 403 en todos | Pasó | 16 combinaciones rol/endpoint, todas 403 |
| IAM | Protecciones de cuentas | Nadie se deshabilita a sí mismo ni al superadmin raíz | Pasó | a sí mismo → 409 "No podés deshabilitar tu propia cuenta."; al superadmin → 409 "No se puede deshabilitar al superadmin raíz." |
| IAM | Deshabilitar revoca la sesión | El access token deja de servir de inmediato | Pasó | antes → 200; deshabilitar → 200; mismo token después → 401; login → 401 |

Total: 29 casos, 29 pasaron, 0 fallaron.

### Cómo repetirla

La prueba está automatizada en `apps/api/scripts/functional-check.mjs`. Crea sus propios usuarios, pacientes, camas e insumos, por lo que **solo acepta `localhost`** como API y como base.

```bash
# 1. Base local vacía, migrada y con superadmin (ver README, sección 7)
# 2. API levantada contra esa base: npm run api:dev
# 3. Desde apps/api:
DATABASE_URL=postgres://postgres:local@localhost:5433/his \
SUPERADMIN_EMAIL=<correo del superadmin> SUPERADMIN_PASSWORD=<su contraseña> \
  node scripts/functional-check.mjs
```

Imprime esta misma tabla y termina con código 1 si algún caso falla. Para ver el stream de camas a mano:

```bash
curl -N -H "Authorization: Bearer <token>" http://localhost:3000/camas/eventos
```

### Observaciones de la prueba

- **El protocolo de ingreso no es inmediato.** `POST /camas/:id/asignar` responde `201` y el protocolo se genera después, al procesarse el evento `patient.admitted`. En la prueba apareció en menos de medio segundo; un cliente que consulte `GET /protocolos` en el mismo instante puede no verlo todavía.
- **Alerta de temperatura.** Con el paciente internado, la notificación de alta prioridad llegó solo al médico responsable de la internación; otro médico activo no recibió nada. Si el paciente no tiene internación activa, el código notifica a todos los médicos (criterio definido por el Bloque A).
- **Motivo de ingreso sin protocolo definido.** Las historias de usuario solo definen tareas para ingreso pre-quirúrgico e infección respiratoria. Cualquier otro motivo se guarda en la internación, la cama se asigna y Enfermería registra un log sin generar protocolo. Está cubierto por un test automatizado.
- **Stream de camas.** El `EventSource` del navegador no envía el header `Authorization`; el stream se consumió con `fetch` leyendo el cuerpo. El token por query string se rechaza con `401`.

## 3. Migraciones sobre base vacía

`npm --prefix apps/api run migration:run` sobre una base PostgreSQL 16 recién creada aplicó las 26 migraciones en orden y sin errores. Una segunda ejecución respondió `No migrations are pending`.

| # | Migración | Resultado |
| --- | --- | --- |
| 1 | `NormalizeColumnNamesToSnakeCase1791576000000` | Aplicada (en base vacía no hace nada: no hay columnas que renombrar) |
| 2 | `BaselineSchema1791660000000` | Aplicada |
| 3 | `AddIamAndAppointmentScheduling1791750000000` | Aplicada |
| 4 | `ClinicalEvents1791800000000` | Aplicada |
| 5 | `CreateInternaciones1791900000000` | Aplicada |
| 6 | `CreateBillingCharges1792596068000` | Aplicada |
| 7 | `AddFrecuenciaHorasToIndicaciones1792700000000` | Aplicada |
| 8 | `CreateProtocolosIngreso1792800000000` | Aplicada |
| 9 | `CreateRegistrosClinicos1792900000000` | Aplicada |
| 10 | `AlinearEstadosCama1793200000000` | Aplicada |
| 11 | `DoctorScheduleAndWaitingRoom1793370000000` | Aplicada |
| 12 | `RemoveLegacyAvailableSlots1793370100000` | Aplicada |
| 13 | `CreateEntreturnoStandby1793370200000` | Aplicada |
| 14 | `AddCoberturaToPacientesYCargos1793370300000` | Aplicada |
| 15 | `AddBajaLogicaToUsuarios1793370400000` | Aplicada |
| 16 | `NormalizeAndReconcileSchema1793370400001` | Aplicada |
| 17 | `AddPresionDiastolicaToSignosVitales1793400000000` | Aplicada |
| 18 | `AddControlIdToSignosVitales1793400100000` | Aplicada |
| 19 | `AddNotaEnfermeriaToRegistrosClinicos1793400200000` | Aplicada |
| 20 | `AddHechaToTareasProtocolo1793400300000` | Aplicada |
| 21 | `DropLegacyCargosDesgloseCheck1793500000000` | Aplicada |
| 22 | `AddInsumoPrice1793600000000` | Aplicada |
| 23 | `CreateNotificaciones1793600100000` | Aplicada |
| 24 | `AddPharmacyCharges1793700000000` | Aplicada |
| 25 | `CreateTriajes1793900000000` | Aplicada |
| 26 | `AddMotivoIngresoToInternaciones1794000000000` | Aplicada (nueva de este bloque) |

Quedan 19 tablas: `administraciones_medicacion`, `camas`, `cargos`, `entreturno_standby`, `eventos_clinicos`, `indicaciones_medicas`, `insumos`, `internaciones`, `migrations`, `notificaciones`, `pacientes`, `protocolos_ingreso`, `refresh_sessions`, `registros_clinicos`, `signos_vitales`, `tareas_protocolo`, `triajes`, `turnos` y `usuarios`.

### Hallazgos

1. **El timestamp duplicado ya no existe.** `NormalizeAndReconcileSchema` está en el repositorio como `1793370400001` y así figura también en la base compartida. No hay dos migraciones con el mismo número.
2. **`migration:generate` no sirve para detectar cambios.** Contra la base recién migrada genera unas 170 sentencias aunque no haya nada que cambiar. No falta ninguna columna que el código necesite: la base es **más estricta** que las entidades. Las diferencias son de cuatro tipos:
   - nombres de claves foráneas, índices y restricciones (las migraciones están escritas a mano con nombres propios);
   - columnas `NOT NULL` y longitudes `varchar(n)` que las entidades no declaran;
   - columnas `created_at` en `pacientes`, `turnos`, `camas` e `insumos` que no tienen campo en la entidad;
   - el tipo enumerado `rol_usuario`, que TypeORM llamaría `usuarios_rol_enum`.

   **No hay que commitear una migración generada automáticamente**: borraría restricciones e índices (incluidos los que garantizan una sola internación activa por cama y por paciente) y columnas con datos. Las migraciones nuevas se siguen escribiendo a mano e idempotentes.
3. **La base compartida tiene el historial de migraciones desincronizado con `main`.** Se detectó al correr `migration:run` contra ella por error; la corrida hizo `ROLLBACK` y no modificó nada.
   - `AddInsumoPrice` está aplicada pero registrada con su timestamp anterior (`AddInsumoPrice1793100000000`). El código la tiene como `1793600000000`, TypeORM la considera pendiente, intenta crear `insumos.precio_pesos` otra vez y falla. Esa migración no es idempotente.
   - Detrás quedan pendientes `AddPharmacyCharges1793700000000`, `CreateTriajes1793900000000` y `AddMotivoIngresoToInternaciones1794000000000`.
   - En la tabla `migrations` hay 8 filas sin archivo en el repositorio (3 renombradas y 5 eliminadas). No afectan la ejecución.
   - **Arreglo propuesto, a ejecutar por quien administra la base:** registrar la migración ya aplicada con `INSERT INTO migrations ("timestamp", name) VALUES (1793600000000, 'AddInsumoPrice1793600000000');`, comprobar si `cargos.administration_id` ya existe (en ese caso registrar también `AddPharmacyCharges1793700000000`) y recién entonces correr `migration:run`.
   - Hasta que eso se haga, **ninguna migración nueva puede aplicarse en la base compartida**.

## 4. Tests de integración con base real

Son los cuatro archivos de `apps/api/test/` con `describe.skipIf`. Se corrieron contra PostgreSQL local.

| Archivo | Qué prueba | Cómo se corrió | Resultado |
| --- | --- | --- | --- |
| `turnos-concurrency.local.spec.ts` | Reserva concurrente del mismo turno: una sola gana | `RUN_LOCAL_CONCURRENCY_TEST=true` y `DATABASE_URL` a una base local llamada `his_admissions_test`, migrada | Pasó (1 de 1) |
| `inventory-service-concurrency.spec.ts` | Descuento concurrente de stock sin quedar negativo | `PGLOCAL_PASSWORD`, base `his_test` en `localhost:5432`, y antes `node scripts/prepare-inventory-test.mjs` para crear el insumo de prueba | Pasó (1 de 1) |
| `protocolos-checklist.local.spec.ts` | Persistencia del checklist del protocolo (quién y cuándo marcó) | `CHECKLIST_TEST_DATABASE_URL` a una base local migrada con al menos 2 usuarios y 1 paciente | Pasó (4 de 4) |
| `inventory-supabase.integration.spec.ts` | Descuento de inventario contra Supabase | No se corrió | Omitido a propósito |

Notas:

- `inventory-service-concurrency.spec.ts` falla con "No se encontró el insumo de prueba" si no se corre antes `scripts/prepare-inventory-test.mjs`. El puerto `5432` y el nombre `his_test` están fijos en el archivo.
- `turnos-concurrency.local.spec.ts` exige que la base se llame exactamente `his_admissions_test`.
- `inventory-supabase.integration.spec.ts` solo acepta el host de Supabase y modifica inventario real, por lo que no puede apuntarse a una base local sin editarlo. El mismo comportamiento queda cubierto por el test local de concurrencia y por la prueba funcional de la sección 2.
