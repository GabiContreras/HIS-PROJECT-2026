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
| `GET /usuarios`, `GET /usuarios/:id` | Administrativo | Consulta de cuentas, sin hashes ni credenciales. `GET /usuarios?incluirBajas=true` incluye las dadas de baja, solo si quien consulta es superadmin. |
| `PATCH /usuarios/:id` | Administrativo | Modifica nombre/apellido. Sobre otro administrativo, solo el superadmin; cada uno puede corregir el suyo. |
| `PATCH /usuarios/:id/habilitar` | Administrativo | Habilita cuentas verificadas pendientes o deshabilitadas. Sobre administrativos, solo el superadmin. |
| `PATCH /usuarios/:id/deshabilitar` | Administrativo | Deshabilita cuenta y revoca sus sesiones. Sobre administrativos, solo el superadmin; nadie puede deshabilitarse a sí mismo ni al superadmin raíz. |
| `PATCH /usuarios/:id/baja` | Solo superadmin | Baja lógica: archiva la cuenta (no inicia sesión, sale de listados y selectores, conserva su historial). `409` si es un médico con turnos futuros activos, el superadmin raíz o uno mismo. |
| `PATCH /usuarios/:id/restaurar` | Solo superadmin | Restaura una cuenta dada de baja; vuelve como `DESHABILITADO`. |
| `PATCH /usuarios/:id/horario` | Administrativo | Define la jornada del médico (`horaInicio`/`horaFin`, bloques de 30 min dentro de 08:00–20:00). |
| `GET /turnos/disponibles` | Autenticado | Horarios libres **calculados** con el horario de cada médico (rango por defecto 7 días, máximo 31). Los entreturnos no cuentan. |
| `GET /turnos/agenda` | Médico (propia) o administrativo | Consulta agenda y datos básicos del paciente asignado. |
| `GET /turnos/transiciones` | Médico, enfermero o administrativo | Estados a los que puede pasar cada estado (fuente: Patrón State). |
| `POST /turnos` | Médico (propia) o administrativo | Reserva un horario libre: `{ medicoId, fechaHora, pacienteId }`. `409` si acaba de ser ocupado. |
| `POST /turnos/entreturno` | Médico (propia) o administrativo | Entreturno de 15 min a los :15/:45 dentro de un horario libre de 30 min. |
| `PATCH /turnos/:id/transiciones` | Médico (propia) o administrativo | Confirma, registra llegada (`EN_SALA_DE_ESPERA`), atiende o cancela. Al cancelar devuelve `promovido` si la lista de espera ocupó el horario. |
| `GET /turnos/espera?medicoId=&fecha=` | Médico (propia) o administrativo | Cola de espera de entreturnos del día, con posición. |
| `POST /turnos/espera` | Médico (propia) o administrativo | Anota a un paciente (`{ medicoId, pacienteId, fecha }`); `409` si el médico aún tiene horarios libres ese día. |
| `DELETE /turnos/espera/:id` | Médico (propia) o administrativo | Quita a un paciente de la cola. |
| `GET /pacientes?q=` | Médico, enfermero o administrativo | Busca pacientes por nombre, apellido o documento (máx. 50). Incluye la cobertura. |
| `GET /pacientes/:id` | Médico, enfermero o administrativo | Devuelve un paciente; `404` si no existe. |
| `POST /pacientes` | Administrativo | Alta de paciente con `tipoCobertura` (`OBRA_SOCIAL_PUBLICA`, `MEDICINA_PREPAGA`, `PARTICULAR`) y `entidadCobertura` (obligatoria en prepaga); `400` por validación, `409` si el documento ya existe. |
| `PATCH /pacientes/:id/cobertura` | Administrativo | Cambia la cobertura; no modifica cargos ya emitidos. |
| `POST /triaje` | Enfermero o médico | Registra el triaje de guardia (HU Admisión 3.1) `{ pacienteId (UUID), nivel (ROJO, NARANJA, AMARILLO, VERDE o AZUL), motivoConsulta, medicoDestinoId? (UUID) }`. Responde `201` con `{ id, pacienteId, paciente, motivo, nivel, estado, llegadaAt }`; `paciente` es "Apellido, Nombre". Con nivel `ROJO` crea una notificación `TRIAGE_RIESGO_VITAL` de prioridad `ALTA` para el médico destino o, si no viene, para todos los médicos activos. `400` por validación, `403` para otros roles, `404` si el paciente no existe o el médico destino no es un médico activo. |
| `GET /triaje` | Enfermero, médico o administrativo | Cola de espera (solo registros `EN_COLA`) con la forma de la respuesta del `POST`, ordenada por nivel (ROJO primero y AZUL último) y, dentro del nivel, por orden de llegada. La cola es persistente: reiniciar el servidor no la borra. |
| `PATCH /triaje/:id/atender` | Médico | Marca el registro como `ATENDIDO` y lo saca de la cola. `404` si no existe, `409` si ya estaba atendido. |
| `GET /notificaciones` | Autenticado | Notificaciones de la cuenta autenticada, de la más reciente a la más antigua: `[{ id, destinatarioId, tipo, prioridad, mensaje, leida, createdAt }]`. Con `?soloNoLeidas=true` devuelve solo las no leídas; cualquier otro valor equivale a no filtrar. `401` sin sesión. |
| `PATCH /notificaciones/:id/leer` | Autenticado | Marca como leída una notificación propia. `404` si no existe o pertenece a otro usuario. |
| Evento `admissions.patient-waiting` (suscriptor de Admisión) | Interno, sin endpoint | Se publica cuando un turno pasa a `EN_SALA_DE_ESPERA`; payload `{ appointmentId, doctorId, patientId }`. El suscriptor crea una notificación `PACIENTE_EN_SALA_DE_ESPERA` de prioridad `MEDIA` para el médico del turno, con el nombre del paciente. Si falla solo se registra un log: no se propaga al bus. |
| Evento `admissions.standby-promoted` (suscriptor de Admisión) | Interno, sin endpoint | Se publica cuando al cancelar un turno se promueve al primero de la lista de espera; payload `{ appointmentId, doctorId, patientId, scheduledAt }` (`scheduledAt` en formato ISO). El suscriptor crea una notificación `ESPERA_PROMOVIDA` de prioridad `MEDIA` para todos los administrativos activos, con paciente, médico y horario en hora de la clínica. Si falla solo se registra un log. |
| `GET /billing/cargos` | Administrativo | Cargos con el turno, paciente, médico y el reparto paciente / tercero según la cobertura. |
| `GET /signos-vitales/tipos` | Enfermero o médico | Tipos de signo vital (`PRESION_ARTERIAL` = sistólica, `PRESION_DIASTOLICA`, `TEMPERATURA`, `FRECUENCIA_CARDIACA`, `FRECUENCIA_RESPIRATORIA`, `SATURACION_O2`) con unidad, rango normal y límites de plausibilidad. |
| `GET /signos-vitales?pacienteId=` | Enfermero o médico | Últimos 100 registros, del más nuevo al más viejo; filtro opcional por paciente. Cada registro trae `unidad`, `fueraDeRango` y `registradoPor` ("Apellido, Nombre"). |
| `POST /signos-vitales` | Enfermero o médico | Registra `{ pacienteId, tipo, valor }` con autor y fecha del servidor; `400` por validación o valor implausible, `404` si el paciente no existe. Si queda fuera de rango (por ejemplo temperatura mayor a 39 °C) publica el evento `vital-sign.alert-raised`. |
| `POST /signos-vitales/controles` | Enfermero o médico | Control de signos vitales (HU 1.1). Cuerpo `{ pacienteId, sistolica, diastolica, frecuenciaCardiaca, temperatura }`. Guarda las cuatro mediciones juntas con el mismo `controlId` y la misma fecha y hora del servidor, en una sola transacción (todo o nada). Responde `201` con `{ id, pacienteId, paciente, sistolica, diastolica, frecuenciaCardiaca, temperatura, fechaHora, registradoPor, critico, fueraDeRango, nota }`: `critico` es `true` si la temperatura supera 39 °C, `fueraDeRango` lista las etiquetas de los valores fuera de rango y `nota` es la nota de enfermería automática ("Controles de signos vitales realizados con éxito." o los valores fuera de rango). Con temperatura mayor a 39 °C se publica el evento `vital-sign.alert-raised` (una vez guardado el control completo). Errores: `400` por validación o valor implausible (no se guarda nada), `403` para otros roles, `404` si el paciente no existe. |
| `GET /signos-vitales/controles?pacienteId=` | Enfermero o médico | Últimos 100 controles, del más nuevo al más viejo; filtro opcional por paciente. Cada ítem tiene la misma forma que la respuesta del `POST` (una fila por control, no por medición). Los registros sueltos creados con `POST /signos-vitales` no pertenecen a ningún control y no aparecen en este listado. |
| Evento `vital-sign.alert-raised` (suscriptor de Admisión) | Interno, sin endpoint | Con tipo `TEMPERATURA` y valor mayor a 39 °C crea una notificación `SIGNOS_VITALES_ALERTA` de prioridad `ALTA` con el nombre del paciente. Va al médico responsable de la internación activa del paciente (`fechaEgreso` nula) y, si no hay internación activa o ese médico no está activo, a todos los médicos activos. El sistema no modela sectores ni guardias, por eso se usa el médico responsable de la internación como aproximación a "médico de guardia del sector". Si falla solo se registra un log. |
| `POST /indicaciones` | Médico | Crea `{ pacienteId, insumoId, dosis, frecuenciaHoras (1-168), fechaFin? }`; el médico es el autenticado y la frecuencia se guarda también como texto (`cada 8 horas`). `400` por validación o `fechaFin` pasada, `403` si no es médico, `404` si el paciente o el insumo no existen. |
| `GET /indicaciones?pacienteId=` | Enfermero o médico | Indicaciones activas (iniciadas y sin vencer, 100 máx.) con `dosisDelDia` (día calendario UTC-3): cada dosis trae `programadaPara`, `estado` (`ADMINISTRADA`/`PENDIENTE`), `enVentana` y quién la administró. |
| `POST /indicaciones/:id/administraciones` | Enfermero | Confirma la dosis vigente `{ observaciones? }`: la hora del servidor debe caer a ±30 min de `fechaInicio + k * frecuenciaHoras`. Registra al enfermero autenticado y publica `medication.administered` (`patientId`, `supplyId`, `quantity: 1`, `administeredBy`, `administeredAt`) después de confirmar la transacción; el descuento de stock lo hace Resources (1.3). `400` UUID inválido, `403` si no es enfermero, `404` indicación inexistente, `409` si la dosis ya fue administrada, está fuera de ventana, la indicación venció o no comenzó, o es anterior a la migración y no tiene `frecuenciaHoras`. El payload del evento incluye además `administrationId` (id de la administración, clave de idempotencia). |
| `GET /resources/inventory` | Enfermero, médico o administrativo | Lista los insumos ordenados por nombre: `[{ id, nombre, unidadMedida, cantidadDisponible }]`. `401` sin sesión, `403` rol sin permiso. |
| `POST /resources/inventory/descontar` | Médico | Descuento manual `{ insumoId (UUID), cantidad (entero ≥ 1) }` → `{ insumoId, cantidadDescontada, cantidadRestante }`. `400` validación, `404` insumo inexistente, `409` stock insuficiente. |
| Evento `medication.administered` (suscriptor de Resources) | Interno, sin endpoint | Resources descuenta `quantity` unidades de `supplyId` con `InventoryService.descontarStock` (UPDATE atómico, nunca stock negativo). Idempotente por `administrationId` mientras el proceso siga vivo (memoria). Si falla (stock insuficiente, insumo inexistente, error de BD) solo se registra un log de error: no se propaga al bus ni se revierte la administración. El bus es en memoria; un Outbox queda como mejora posible. |
| `GET /protocolos?pacienteId=` | Enfermero o médico | Protocolos de ingreso del paciente (más nuevo primero): `[{ id, ingresoId, pacienteId, tipo (PRE_QUIRURGICO/RESPIRATORIO), motivoIngreso, generadoEn, tareas: [{ orden, descripcion, frecuenciaHoras }] }]`. `400` si falta o es inválido `pacienteId`, `401` sin sesión, `403` rol sin permiso, `404` paciente inexistente; lista vacía si no tiene protocolo. |
| `POST /protocolos/ingresos` | Médico o administrativo | Registra un ingreso `{ ingresoId (UUID), pacienteId (UUID), motivoIngreso (3-200) }` y genera su protocolo con el Patrón Builder: "cirugía programada" / "pre-quirúrgico" → tareas pre-operatorias; "neumonía" / "infección respiratoria" → tareas respiratorias. Idempotente por `ingresoId`: reenviarlo devuelve el protocolo existente sin duplicar. `400` validación o motivo sin protocolo, `403` rol sin permiso, `404` paciente inexistente. Es la alternativa manual al evento `patient.admitted`, que Recursos publica al asignar una cama con `motivoIngreso`. |
| `POST /camas/:id/asignar` | Médico o administrativo | Asigna la cama `{ pacienteId (UUID), medicoId? (UUID; obligatorio si asigna un administrativo), motivoIngreso? (3-200) }` con bloqueo pesimista y crea la internación. Publica `bed.assigned`; si se informa `motivoIngreso` lo guarda en la internación y publica además `patient.admitted`. El motivo se recorta y un texto vacío se toma como no informado. El protocolo se genera en segundo plano: puede tardar un instante en aparecer en `GET /protocolos`. Un motivo sin protocolo definido no impide la asignación (solo queda un log en Enfermería). `400` validación o médico no habilitado, `404` cama o paciente inexistente, `409` cama ocupada o paciente ya internado. |
| Evento `patient.admitted` (suscriptor de Enfermería) | Interno, sin endpoint | Payload `{ admissionId, patientId, reason, admittedAt }`. Enfermería genera el protocolo con `ProtocolosService` (misma lógica que el endpoint, idempotente por `admissionId` gracias al índice único de `protocolos_ingreso`). Si falla (motivo sin protocolo, paciente inexistente, error de BD) solo se registra un log: no se propaga al bus. Lo publica Recursos desde `POST /camas/:id/asignar` cuando se informa `motivoIngreso`, después de confirmar la transacción; `admissionId` es el id de la internación. |
| `GET /historia-clinica/:pacienteId` | Médico o enfermero | Historia clínica: `{ paciente (ficha demográfica de Admisión), alergias, antecedentesFamiliares, evoluciones, estudios }`; cada sección es una lista `[{ id, categoria, titulo, detalle, registradoPor, fechaHora }]` del más nuevo al más viejo (`titulo` es `null` en las evoluciones). `400` si `pacienteId` no es UUID, `401` sin sesión, `403` administrativo, `404` paciente inexistente. |
| `POST /historia-clinica/:pacienteId/alergias` | Médico | Registra `{ sustancia (2-120), reaccion (2-1000) }`. Autor y fecha los pone el servidor. `201` con el registro; `400` validación, `403` rol sin permiso, `404` paciente inexistente. |
| `POST /historia-clinica/:pacienteId/antecedentes-familiares` | Médico | Registra `{ parentesco (2-120), descripcion (2-1000) }`. Mismos errores que alergias. |
| `POST /historia-clinica/:pacienteId/evoluciones` | Médico | Registra la evolución médica `{ nota (3-4000) }`. Mismos errores que alergias. |
| `POST /historia-clinica/:pacienteId/estudios` | Médico | Registra un estudio para su visualización `{ tipo (2-120), resultado (2-4000) }` (texto; no hay carga de archivos). Mismos errores que alergias. |

La historia clínica es inmutable: no existen endpoints de modificación ni borrado, y la tabla `registros_clinicos` rechaza `UPDATE` y `DELETE` con un trigger. Los textos se guardan sin espacios en los extremos. Las lecturas excluyen al administrativo porque los datos clínicos no forman parte de su función; la ficha demográfica sigue disponible para él en `GET /pacientes/:id`.

Las contraseñas requieren 8 caracteres, una mayúscula y un dígito; se rechazan
pares de dígitos consecutivos ascendentes o descendentes. Los endpoints devuelven
errores HTTP explícitos, incluyendo `400` para validación, `401` para sesión
inválida, `403` para permisos/origen, `404` para recursos ausentes y `409` para
conflictos de estado/agenda. Los intentos bloqueados devuelven el mismo `401`
que las credenciales inválidas. Las contraseñas históricas se conservan; un
login válido en desarrollo las actualiza a scrypt.

Un entreturno solo puede comenzar 15 minutos después del inicio de un horario libre
de 30 minutos: ocupa la segunda mitad y el horario anterior queda en 15 minutos
(se calcula, no se modifica ninguna fila). La reserva y la cancelación bloquean la
fila del médico en PostgreSQL dentro de una transacción; un índice único evita
dos turnos activos en el mismo horario. Al cancelar un turno, el horario liberado
pasa en la misma transacción al primero de la lista de espera de ese médico y día.

Facturación: el valor base de la consulta se reparte según la cobertura del
paciente. Obra social pública: paciente 0, Estado 100%. Medicina prepaga: copago
fijo para el paciente y el resto se reclama a la prepaga (el copago es un valor único
hasta tener el nomenclador). Particular: paciente 100%. La cobertura y el reparto
quedan congelados en el cargo al momento de facturar.

## Propiedad de datos

- IAM: usuarios y roles.
- Admissions: pacientes y turnos.
- EHR: historia clínica (alergias, antecedentes familiares, evoluciones y estudios en `registros_clinicos`) y eventos clínicos.
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
