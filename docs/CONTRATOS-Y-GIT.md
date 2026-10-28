# Contratos de módulos y flujo Git

## Contratos mínimos de API

Cada endpoint debe documentar método/ruta, DTO de entrada, respuesta, permisos, errores y pruebas.

- Admisión: `POST /pacientes`, `GET /pacientes/:id`, `POST /turnos`, transiciones de estado.
- IAM: endpoints de autenticación y administración de usuarios (definir permisos antes de publicar).
- EHR/Nursing: registros clínicos y de medicación con trazabilidad de autor/fecha.
- Resources: disponibilidad/asignación de camas y movimientos de inventario.
- Billing: consulta y registro de cargos, evitando duplicados por reintentos.

Las rutas son propuestas de contrato, no todas están implementadas en esta entrega.

## Contratos entregados para IAM y Admisión

Las respuestas de autenticación nunca incluyen el refresh token en JSON. El
servidor lo entrega únicamente como cookie `HttpOnly`; el access token y los
datos básicos de la cuenta se devuelven en el body.

| Método y ruta | Acceso | Uso |
| --- | --- | --- |
| `POST /auth/register` | Público | Alta de médico/enfermero sin verificación por correo durante desarrollo; el médico queda pendiente de habilitación. |
| `POST /auth/login` | Origen frontend permitido | Inicio de sesión y emisión de access/refresh. |
| `POST /auth/refresh` | Cookie + origen permitido | Rota el refresh token y revoca el anterior. |
| `POST /auth/logout` | Cookie + origen permitido | Revoca la sesión actual. |
| `GET /auth/me` | Autenticado | Devuelve datos básicos, rol y estado de la cuenta. |
| `POST /auth/forgot-password` | Público | Informa que la recuperación por correo está temporalmente deshabilitada. |
| `POST /auth/reset-password` | Público solo en desarrollo | Actualiza contraseña con email y contraseña nueva; sin código de correo. Deshabilitado en producción. |
| `POST /auth/change-password` | Autenticado | Cambia contraseña y revoca las demás sesiones. |
| `POST /usuarios` | Administrativo | Alta de personal médico/enfermería sin códigos de correo durante desarrollo. |
| `POST /usuarios/administrativos` | Solo superadmin | Alta directa de otro administrativo. |
| `GET /usuarios`, `GET /usuarios/:id` | Administrativo | Consulta de cuentas, sin hashes ni credenciales. |
| `PATCH /usuarios/:id` | Administrativo | Modifica nombre/apellido. |
| `PATCH /usuarios/:id/habilitar` | Administrativo | Habilita cuentas verificadas pendientes o deshabilitadas. |
| `PATCH /usuarios/:id/deshabilitar` | Administrativo | Deshabilita cuenta y revoca sus sesiones. |
| `GET /turnos/disponibles` | Autenticado | Consulta turnos libres próximos. |
| `GET /turnos/agenda` | Médico (propia) o administrativo | Consulta agenda y datos básicos del paciente asignado. |
| `POST /turnos` | Médico (propia) o administrativo | Crea disponibilidad estándar de 30 minutos. |
| `POST /turnos/urgencia` | Médico (propia) o administrativo | Inserta urgencia de 15 minutos ajustando el turno libre adyacente. |
| `PATCH /turnos/:id/reservar` | Médico (propia) o administrativo | Reserva un turno para un paciente. |
| `PATCH /turnos/:id/transiciones` | Médico (propia) o administrativo | Confirma, cancela o marca atendido según la máquina de estados. |
| `GET /pacientes?q=` | Médico, enfermero o administrativo | Busca pacientes por nombre, apellido o documento (máx. 50). |
| `GET /pacientes/:id` | Médico, enfermero o administrativo | Devuelve un paciente; `404` si no existe. |
| `POST /pacientes` | Administrativo | Alta de paciente; `400` por validación, `409` si el documento ya existe. |
| `GET /signos-vitales/tipos` | Enfermero o médico | Tipos de signo vital con unidad, rango normal y límites de plausibilidad. |
| `GET /signos-vitales?pacienteId=` | Enfermero o médico | Últimos 100 registros, del más nuevo al más viejo; filtro opcional por paciente. Cada registro trae `unidad` y `fueraDeRango`. |
| `POST /signos-vitales` | Enfermero o médico | Registra `{ pacienteId, tipo, valor }` con autor y fecha del servidor; `400` por validación o valor implausible, `404` si el paciente no existe. Si queda fuera de rango (por ejemplo temperatura mayor a 39 °C) publica el evento `vital-sign.alert-raised`. |
| `POST /indicaciones` | Médico | Crea `{ pacienteId, insumoId, dosis, frecuenciaHoras (1-168), fechaFin? }`; el médico es el autenticado y la frecuencia se guarda también como texto (`cada 8 horas`). `400` por validación o `fechaFin` pasada, `403` si no es médico, `404` si el paciente o el insumo no existen. |
| `GET /indicaciones?pacienteId=` | Enfermero o médico | Indicaciones activas (iniciadas y sin vencer, 100 máx.) con `dosisDelDia` (día calendario UTC-3): cada dosis trae `programadaPara`, `estado` (`ADMINISTRADA`/`PENDIENTE`), `enVentana` y quién la administró. |
| `POST /indicaciones/:id/administraciones` | Enfermero | Confirma la dosis vigente `{ observaciones? }`: la hora del servidor debe caer a ±30 min de `fechaInicio + k * frecuenciaHoras`. Registra al enfermero autenticado y publica `medication.administered` (`patientId`, `supplyId`, `quantity: 1`, `administeredBy`, `administeredAt`) después de confirmar la transacción; el descuento de stock lo hace Resources (1.3). `400` UUID inválido, `403` si no es enfermero, `404` indicación inexistente, `409` si la dosis ya fue administrada, está fuera de ventana, la indicación venció o no comenzó, o es anterior a la migración y no tiene `frecuenciaHoras`. El payload del evento incluye además `administrationId` (id de la administración, clave de idempotencia). |
| `GET /resources/inventory` | Enfermero, médico o administrativo | Lista los insumos ordenados por nombre: `[{ id, nombre, unidadMedida, cantidadDisponible }]`. `401` sin sesión, `403` rol sin permiso. |
| `POST /resources/inventory/descontar` | Médico | Descuento manual `{ insumoId (UUID), cantidad (entero ≥ 1) }` → `{ insumoId, cantidadDescontada, cantidadRestante }`. `400` validación, `404` insumo inexistente, `409` stock insuficiente. |
| Evento `medication.administered` (suscriptor de Resources) | Interno, sin endpoint | Resources descuenta `quantity` unidades de `supplyId` con `InventoryService.descontarStock` (UPDATE atómico, nunca stock negativo). Idempotente por `administrationId` mientras el proceso siga vivo (memoria). Si falla (stock insuficiente, insumo inexistente, error de BD) solo se registra un log de error: no se propaga al bus ni se revierte la administración. El bus es en memoria; un Outbox queda como mejora posible. |
| `GET /protocolos?pacienteId=` | Enfermero o médico | Protocolos de ingreso del paciente (más nuevo primero): `[{ id, ingresoId, pacienteId, tipo (PRE_QUIRURGICO/RESPIRATORIO), motivoIngreso, generadoEn, tareas: [{ orden, descripcion, frecuenciaHoras }] }]`. `400` si falta o es inválido `pacienteId`, `401` sin sesión, `403` rol sin permiso, `404` paciente inexistente; lista vacía si no tiene protocolo. |
| `POST /protocolos/ingresos` | Médico o administrativo | Registra un ingreso `{ ingresoId (UUID), pacienteId (UUID), motivoIngreso (3-200) }` y genera su protocolo con el Patrón Builder: "cirugía programada" / "pre-quirúrgico" → tareas pre-operatorias; "neumonía" / "infección respiratoria" → tareas respiratorias. Idempotente por `ingresoId`: reenviarlo devuelve el protocolo existente sin duplicar. `400` validación o motivo sin protocolo, `403` rol sin permiso, `404` paciente inexistente. Equivale al evento `patient.admitted`; es el punto de entrada mientras ningún módulo lo publique. |
| Evento `patient.admitted` (suscriptor de Enfermería) | Interno, sin endpoint | Payload `{ admissionId, patientId, reason, admittedAt }`. Enfermería genera el protocolo con `ProtocolosService` (misma lógica que el endpoint, idempotente por `admissionId` gracias al índice único de `protocolos_ingreso`). Si falla (motivo sin protocolo, paciente inexistente, error de BD) solo se registra un log: no se propaga al bus. Hoy ningún módulo publica este evento (Admisión/Recursos aún no registran internaciones). |

Las contraseñas requieren 8 caracteres, una mayúscula y un dígito; se rechazan
pares de dígitos consecutivos ascendentes o descendentes. Los endpoints devuelven
errores HTTP explícitos, incluyendo `400` para validación, `401` para sesión
inválida, `403` para permisos/origen, `404` para recursos ausentes y `409` para
conflictos de estado/agenda. Los intentos bloqueados devuelven el mismo `401`
que las credenciales inválidas. Las contraseñas históricas se conservan; un
login válido en desarrollo las actualiza a scrypt.

Una urgencia solo puede comenzar 15 minutos después del inicio de una
disponibilidad estándar de 30 minutos. En una misma transacción, la disponibilidad
anterior se reduce a 15 minutos y la urgencia ocupa los otros 15. Las operaciones
de agenda y reserva bloquean filas en PostgreSQL dentro de transacciones.

## Propiedad de datos

- IAM: usuarios y roles.
- Admissions: pacientes y turnos.
- EHR: historia clínica y eventos clínicos.
- Nursing: administración de medicación y cuidados.
- Resources: camas, insumos y movimientos de inventario.
- Billing: cargos, cobertura y facturación.

Un módulo no debe modificar directamente las tablas internas de otro módulo desde su servicio. Coordinar por casos de uso públicos o eventos cuando corresponda.

## Git

- Mantener la rama de reconstrucción como base acordada por el equipo.
- Cada integrante crea una rama `feature/<modulo>-<tarea>` desde la base compartida.
- Commits pequeños: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`.
- Pull Request con resumen, pruebas ejecutadas y migraciones.
- No hacer force-push a la rama compartida ni integrar cambios sin revisión.
- No subir `.env`, tokens ni credenciales.
