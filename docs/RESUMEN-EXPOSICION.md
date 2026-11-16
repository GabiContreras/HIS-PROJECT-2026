# Resumen para la exposición

Guía corta para presentar el backend: qué patrones se usan, cómo se resuelve la concurrencia, cómo se comunican los módulos y cuáles son los límites reales del sistema. Lo que figura acá está en el código; los resultados de la prueba contra servidor y base reales son los del registro de la verificación del 10/11/2026 (`docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`) y las cifras de la sección 8 se midieron el 16/11/2026 sobre el commit `f404552` de `main`.

## 1. Qué es

Sistema de información hospitalaria con seis módulos, los mismos del documento de diseño: Identidad y Accesos, Admisión y Turnos, Historia Clínica, Atención y Enfermería, Recursos y Camas, y Facturación. Es un monolito modular en NestJS con PostgreSQL; cada módulo tiene capas `api`, `application`, `domain` e `infrastructure`, y el dominio no depende de NestJS ni de TypeORM.

## 2. Patrones de diseño

| Patrón | Dónde | Qué resuelve | Historia de usuario |
| --- | --- | --- | --- |
| **State** | `admissions/domain/states/` | El turno solo avanza por transiciones válidas: Reservado → Confirmado → En sala de espera → Atendido, con cancelación desde los dos primeros. Un turno cancelado no puede pasar a atendido | Admisión 2.1 |
| **State** | `resources/domain/state/` | La cama no pasa de ocupada a libre sin limpieza: Libre → Ocupada → En limpieza → Libre, más Bloqueada por mantenimiento | Recursos 2.1 |
| **State** | `billing/domain/estado-cargo.ts` | El cargo pasa de Pendiente a Facturado, Pagado o Anulado solo por transiciones válidas; un cargo pagado o anulado no cambia | — |
| **Strategy** | `billing/domain/coverage.strategy.ts` | El reparto del costo cambia según la cobertura: pública (el paciente paga 0), prepaga (copago del nomenclador y el resto a la prepaga) y particular (100 % el paciente) | Facturación 1.1 |
| **Strategy** | `billing/domain/consulta-*.strategy.ts` | Cada tipo de atención (regular, urgencia) apunta a una prestación del nomenclador | — |
| **Builder** | `nursing/domain/protocolo/` | Arma el plan de cuidados paso a paso según el motivo de ingreso: `PreOpProtocolBuilder` y `RespiratoryProtocolBuilder`, elegidos por un director | Enfermería 2.1 |
| **Observer** | `shared/events/` | Los módulos se avisan por eventos sin llamarse entre sí | Recursos 3.1, Facturación 2.1, Enfermería 2.1 |

Cómo mostrarlo: en Swagger (`/docs`), intentar pasar un turno cancelado a atendido, o asignar una cama en limpieza. La API responde `409` con el mensaje de negocio.

## 3. Concurrencia

El problema: dos operadores confirman lo mismo en el mismo instante.

- **Turnos, camas, medicación y cambios de estado de cargos:** transacción con bloqueo pesimista (`SELECT ... FOR UPDATE`). El segundo pedido espera a que termine el primero, vuelve a leer el estado y recibe `409`.
- **Inventario:** una sola sentencia `UPDATE ... WHERE cantidad_disponible >= cantidad`. Es atómica y nunca deja el stock en negativo.
- **Liquidaciones:** el filtrado y el cambio de estado de los cargos ocurren en una sola transacción; de dos pedidos simultáneos sobre el mismo rango, solo uno crea la liquidación y el otro recibe `409`.
- **Segunda barrera en la base:** índices únicos (una internación activa por cama y por paciente, un cargo por turno, por administración y por internación). Si algo se escapara del código, la base lo rechaza.

Resultados de la prueba contra servidor y base reales (verificación del 10/11/2026):

| Caso | Resultado |
| --- | --- |
| Dos asignaciones simultáneas de la misma cama | Una `201` y una `409`; una sola internación activa |
| Tres confirmaciones simultáneas de la misma dosis | Una `201` y dos `409`; una sola administración y una sola unidad descontada |
| 15 descuentos simultáneos sobre 10 unidades | 10 aceptados y 5 con `409`; stock final 0 |

## 4. Comunicación entre módulos

Los módulos se comunican por eventos. El evento se publica después de confirmar la transacción. Los eventos que disparan efectos que no se pueden perder (cargos, descuento de stock, cambios de cama) son durables: además de emitirse en memoria, se guardan en la tabla `outbox_events` y se entregan a sus consumidores con reintentos y sin duplicar (ver `docs/ARQUITECTURA.md`). Los avisos (notificaciones y el protocolo de ingreso) siguen en memoria.

Recorrido para mostrar, que cruza tres módulos:

1. El enfermero confirma una dosis (`POST /indicaciones/:id/administraciones`). Enfermería registra quién la aplicó y publica `medication.administered`.
2. Recursos escucha el evento y descuenta una unidad del inventario; si el stock cruza el mínimo, notifica a los administrativos (`inventory.low-stock`).
3. Facturación escucha el mismo evento y crea el cargo "Insumos de Farmacia", vinculado a la administración.

Otros recorridos: al asignar una cama con motivo "Cirugía programada", Recursos publica `patient.admitted` y Enfermería genera el protocolo pre-quirúrgico sin que nadie lo pida a mano; al dar el alta, Facturación crea el cargo de internación con los días de cama.

La tabla completa de quién publica y quién escucha cada evento está en `docs/ARQUITECTURA.md`.

## 5. Tiempo real

`GET /camas/eventos` mantiene una conexión abierta (Server-Sent Events) y envía cada cambio de estado de cama; el servidor lee los eventos de cama de la tabla del Outbox cada segundo, por lo que funciona con más de una instancia de la API. Se puede mostrar con dos terminales: en una, `curl -N` con el token; en la otra, asignar una cama.

## 6. Seguridad

- Access token de 15 minutos por defecto y refresh token rotativo en cookie `HttpOnly`; el refresh se guarda como hash.
- Si se reutiliza un refresh ya rotado, se revoca toda la familia de sesiones.
- Bloqueo de 15 minutos tras 5 intentos fallidos, con el mismo mensaje genérico para no revelar si la cuenta existe.
- Autorización por rol con guards. En la prueba del 10/11/2026, 16 combinaciones de rol y endpoint ajeno respondieron `403`.
- Deshabilitar una cuenta invalida su sesión de inmediato.

## 7. Límites, sin esconderlos

- **Solo algunos eventos son durables.** El Outbox cubre los cargos, el descuento de stock y los eventos de cama. Las notificaciones y el protocolo de ingreso se entregan en memoria: si el servidor cae antes de procesarlos, se pierde el efecto. Además, la fila del Outbox se guarda después del commit del cambio de negocio, no dentro de la misma transacción.
- **El protocolo de ingreso se genera en segundo plano**, un instante después de asignar la cama.
- **Solo hay protocolos para dos motivos de ingreso**, los que definen las historias de usuario.
- **El stream de camas no guarda historial**: entrega los cambios ocurridos con la conexión abierta, con hasta un segundo de demora.
- **El frontend de camas y el de triaje todavía usan datos locales**, aunque los endpoints existen. El frontend de facturación muestra los cargos pero no consume las liquidaciones, los reportes ni el catálogo de coberturas.
- **El nomenclador tiene valores provisorios** (consulta regular $15.000, urgencia $25.000, día de cama $50.000 y copago de $3.000), sembrados por migración y a la espera de la definición del docente. No hay endpoint para administrarlos.
- **La liquidación a terceros no tiene datos reales con el alta de pacientes actual:** `POST /pacientes` no recibe el financiador, el plan ni el número de afiliado, por lo que los cargos quedan sin financiador.
- **Tres roles en lugar de los cinco del diseño:** Administrador y Recepcionista operan como `ADMINISTRATIVO`, y Paciente no existe como cuenta.
- **La base compartida tiene el historial de migraciones desincronizado** (ver `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`, sección 3); sobre una base vacía las 39 migraciones aplican sin errores.

## 8. Números

Medidos el 16/11/2026 sobre el commit `f404552` de `main`.

| Indicador | Valor |
| --- | --- |
| Pruebas automatizadas del backend | 1249 pasan y 21 se omiten (97 archivos pasan y 4 se omiten, de 101); las omitidas requieren una base PostgreSQL local |
| Pruebas del frontend | 48 pasan; 7 de 8 archivos pasan y 1 falla (`stores/__tests__/dashboard.store.spec.ts` importa un store que no existe) |
| Lint del backend (oxlint) | 0 errores y 12 advertencias |
| Type-check del frontend | Sin errores |
| Migraciones sobre base vacía | 39 de 39; una segunda ejecución informa que no hay pendientes |
| Entidades TypeORM | 32 archivos en `apps/api/src/entities` |
| Rutas HTTP del backend | 120 decoradores de ruta (119 sin contar `GET /`, que Swagger excluye) |
| Prueba funcional contra servidor y base reales (verificación del 10/11/2026) | 29 de 29 criterios |
