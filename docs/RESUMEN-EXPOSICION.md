# Resumen para la exposición

Guía corta para presentar el backend: qué patrones se usan, cómo se resuelve la concurrencia, cómo se comunican los módulos y cuáles son los límites reales del sistema. Todo lo que figura acá está en el código y fue verificado (ver `docs/PRUEBAS-FUNCIONALES-ENFERMERIA-RECURSOS-IAM.md`).

## 1. Qué es

Sistema de información hospitalaria con seis módulos, los mismos del documento de diseño: Identidad y Accesos, Admisión y Turnos, Historia Clínica, Atención y Enfermería, Recursos y Camas, y Facturación. Es un monolito modular en NestJS con PostgreSQL; cada módulo tiene capas `api`, `application`, `domain` e `infrastructure`, y el dominio no depende de NestJS ni de TypeORM.

## 2. Patrones de diseño

| Patrón | Dónde | Qué resuelve | Historia de usuario |
| --- | --- | --- | --- |
| **State** | `admissions/domain/states/` | El turno solo avanza por transiciones válidas: Programado → Confirmado → En sala de espera → Atendido, con cancelación desde los dos primeros. Un turno cancelado no puede pasar a atendido | Admisión 2.1 |
| **State** | `resources/domain/state/` | La cama no pasa de ocupada a libre sin limpieza: Libre → Ocupada → En limpieza → Libre, más Bloqueada por mantenimiento | Recursos 2.1 |
| **Strategy** | `billing/domain/` | El reparto del costo cambia según la cobertura: pública (el paciente paga 0), prepaga (copago fijo y el resto a la prepaga) y particular (100 % el paciente) | Facturación 1.1 |
| **Builder** | `nursing/domain/protocolo/` | Arma el plan de cuidados paso a paso según el motivo de ingreso: `PreOpProtocolBuilder` y `RespiratoryProtocolBuilder`, elegidos por un director | Enfermería 2.1 |
| **Observer** | `shared/events/` | Los módulos se avisan por eventos sin llamarse entre sí | Recursos 3.1, Facturación 2.1, Enfermería 2.1 |

Cómo mostrarlo: en Swagger (`/docs`), intentar pasar un turno cancelado a atendido, o asignar una cama en limpieza. La API responde `409` con el mensaje de negocio.

## 3. Concurrencia

El problema: dos operadores confirman lo mismo en el mismo instante.

- **Turnos, camas y medicación:** transacción con bloqueo pesimista (`SELECT ... FOR UPDATE`). El segundo pedido espera a que termine el primero, vuelve a leer el estado y recibe `409`.
- **Inventario:** una sola sentencia `UPDATE ... WHERE cantidad_disponible >= cantidad`. Es atómica y nunca deja el stock en negativo.
- **Segunda barrera en la base:** índices únicos (una internación activa por cama y por paciente, un cargo por turno, un cargo por administración). Si algo se escapara del código, la base lo rechaza.

Resultados de la prueba contra servidor y base reales:

| Caso | Resultado |
| --- | --- |
| Dos asignaciones simultáneas de la misma cama | Una `201` y una `409`; una sola internación activa |
| Tres confirmaciones simultáneas de la misma dosis | Una `201` y dos `409`; una sola administración y una sola unidad descontada |
| 15 descuentos simultáneos sobre 10 unidades | 10 aceptados y 5 con `409`; stock final 0 |

## 4. Comunicación entre módulos

Los módulos se comunican por un bus de eventos en memoria. El evento se publica después de confirmar la transacción.

Recorrido para mostrar, que cruza tres módulos:

1. El enfermero confirma una dosis (`POST /indicaciones/:id/administraciones`). Enfermería registra quién la aplicó y publica `medication.administered`.
2. Recursos escucha el evento y descuenta una unidad del inventario.
3. Facturación escucha el mismo evento y crea el cargo "Insumos de Farmacia", vinculado a la administración.

Otro recorrido: al asignar una cama con motivo "Cirugía programada", Recursos publica `patient.admitted` y Enfermería genera el protocolo pre-quirúrgico con sus tres tareas, sin que nadie lo pida a mano.

La tabla completa de quién publica y quién escucha cada evento está en `docs/ARQUITECTURA.md`.

## 5. Tiempo real

`GET /camas/eventos` mantiene una conexión abierta (Server-Sent Events) y envía cada cambio de estado de cama. Se puede mostrar con dos terminales: en una, `curl -N` con el token; en la otra, asignar una cama.

## 6. Seguridad

- Access token de 15 minutos como máximo y refresh token rotativo en cookie `HttpOnly`; el refresh se guarda como hash.
- Si se reutiliza un refresh ya rotado, se revoca toda la familia de sesiones.
- Bloqueo de 15 minutos tras 5 intentos fallidos, con el mismo mensaje genérico para no revelar si la cuenta existe.
- Autorización por rol con guards. En la prueba, 16 combinaciones de rol y endpoint ajeno respondieron `403`.
- Deshabilitar una cuenta invalida su sesión de inmediato.

## 7. Límites, sin esconderlos

- **Los eventos son en memoria: no hay entrega durable.** Si el servidor se cae justo después de guardar y antes de procesar el evento, se pierde el efecto (el descuento de stock, el cargo de farmacia, el protocolo o la notificación). La solución conocida es el patrón Outbox; no está implementado.
- **El protocolo de ingreso se genera en segundo plano**, un instante después de asignar la cama.
- **Solo hay protocolos para dos motivos de ingreso**, los que definen las historias de usuario.
- **El stream de camas no guarda historial** y no escalaría a varias instancias sin un bus compartido.
- **El frontend de camas y el de triaje todavía usan datos locales**, aunque los endpoints existen.
- **El copago de prepaga y las tarifas son valores fijos provisorios**, a la espera del nomenclador.
- **Tres roles en lugar de los cinco del diseño:** Administrador y Recepcionista operan como `ADMINISTRATIVO`, y Paciente no existe como cuenta.
- **La base compartida tiene el historial de migraciones desincronizado**; sobre una base vacía las 26 migraciones aplican sin errores.

## 8. Números

| Indicador | Valor |
| --- | --- |
| Pruebas automatizadas del backend | 577 pasan, 7 omitidas (requieren base real; con base local pasan 583) |
| Cobertura de líneas de IAM | 94,68 % |
| Prueba funcional contra servidor y base reales | 29 de 29 criterios |
| Migraciones sobre base vacía | 26 de 26 |
