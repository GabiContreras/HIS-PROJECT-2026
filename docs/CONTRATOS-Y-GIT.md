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
| `POST /auth/login` | Origen frontend permitido | Inicio de sesión y emisión de access/refresh. |
| `POST /auth/refresh` | Cookie + origen permitido | Rota el refresh token y revoca el anterior. |
| `POST /auth/logout` | Cookie + origen permitido | Revoca la sesión actual. |
| `GET /auth/me` | Autenticado | Devuelve datos básicos, rol y estado de la cuenta. |
| `POST /auth/forgot-password` | Público | Informa que la recuperación por correo no está disponible y que debe pedirse a un administrativo. |
| `POST /auth/change-password` | Autenticado | Cambia contraseña y revoca las demás sesiones. |
| `POST /usuarios` | Administrativo | Alta de personal médico/enfermería sin códigos de correo; el médico queda pendiente de habilitación. Única vía de alta de personal. |
| `POST /usuarios/administrativos` | Solo superadmin | Alta directa de otro administrativo. |
| `GET /usuarios`, `GET /usuarios/:id` | Administrativo | Consulta de cuentas, sin hashes ni credenciales. |
| `PATCH /usuarios/:id` | Administrativo (cuentas administrativas: solo superadmin) | Modifica nombre/apellido. |
| `PATCH /usuarios/:id/habilitar` | Administrativo (cuentas administrativas: solo superadmin) | Habilita cuentas verificadas pendientes o deshabilitadas. |
| `PATCH /usuarios/:id/deshabilitar` | Administrativo (cuentas administrativas: solo superadmin) | Deshabilita cuenta y revoca sus sesiones. No permite autodeshabilitarse. |
| `PATCH /usuarios/:id/restablecer-clave` | Administrativo (cuentas administrativas: solo superadmin) | Asigna una contraseña temporal (`passwordTemporal`) y revoca todas las sesiones de la cuenta. No aplica a la propia cuenta ni al superadmin raíz. |
| `GET /turnos/disponibles` | Autenticado | Consulta turnos libres próximos. |
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
| `GET /billing/financiadores` | Administrativo | Catálogo de coberturas: `[{ id, nombre, tipo, activo, createdAt, planes: [{ id, financiadorId, nombre, activo, createdAt }] }]`, ordenado por nombre. Incluye los dados de baja para poder reactivarlos. |
| `POST /billing/financiadores` | Administrativo | Crea un financiador `{ nombre, tipo }` con `tipo` `OBRA_SOCIAL_PUBLICA` o `MEDICINA_PREPAGA` (`PARTICULAR` no tiene financiador). `400` por validación, `409` si ya existe un financiador con ese nombre (sin distinguir mayúsculas). |
| `PATCH /billing/financiadores/:id` | Administrativo | Edita `{ nombre?, tipo?, activo? }`; `activo: false` es la baja lógica (no hay `DELETE`). `404` si no existe, `409` por nombre duplicado. |
| `POST /billing/financiadores/:id/planes` | Administrativo | Crea un plan `{ nombre }` del financiador. `404` si el financiador no existe, `409` si ya tiene un plan con ese nombre. |
| `PATCH /billing/planes/:id` | Administrativo | Edita `{ nombre?, activo? }`; `activo: false` es la baja lógica. `404` si no existe, `409` por nombre duplicado en el financiador. |
| `GET /billing/cargos` | Administrativo | Cargos con el turno, paciente, médico, el reparto paciente / tercero según la cobertura y el `estado` (`PENDIENTE`, `FACTURADO`, `PAGADO` o `ANULADO`; los cargos nuevos y los existentes arrancan en `PENDIENTE`). |
| `PATCH /billing/cargos/:id/pagar` | Administrativo | Pasa el cargo a `PAGADO` desde `PENDIENTE` o `FACTURADO`. Responde `{ id, estado }`. `404` si no existe, `409` si ya está pagado o anulado. |
| `PATCH /billing/cargos/:id/anular` | Administrativo | Pasa el cargo a `ANULADO` desde `PENDIENTE` o `FACTURADO`. Responde `{ id, estado }`. `404` si no existe, `409` si ya está pagado o anulado. |
| `GET /signos-vitales/tipos` | Enfermero o médico | Tipos de signo vital (`PRESION_ARTERIAL` = sistólica, `PRESION_DIASTOLICA`, `TEMPERATURA`, `FRECUENCIA_CARDIACA`, `FRECUENCIA_RESPIRATORIA`, `SATURACION_O2`) con unidad, rango normal y límites de plausibilidad. |
| `GET /signos-vitales?pacienteId=` | Enfermero o médico | Últimos 100 registros, del más nuevo al más viejo; filtro opcional por paciente. Cada registro trae `unidad`, `fueraDeRango` y `registradoPor` ("Apellido, Nombre"). |
| `POST /signos-vitales` | Enfermero o médico | Registra `{ pacienteId, tipo, valor }` con autor y fecha del servidor; `400` por validación o valor implausible, `404` si el paciente no existe. Si queda fuera de rango (por ejemplo temperatura mayor a 39 °C) publica el evento `vital-sign.alert-raised`. |
| `POST /signos-vitales/controles` | Enfermero o médico | Control de signos vitales (HU 1.1). Cuerpo `{ pacienteId, sistolica, diastolica, frecuenciaCardiaca, temperatura }`. Guarda las cuatro mediciones juntas con el mismo `controlId` y la misma fecha y hora del servidor, en una sola transacción (todo o nada). Responde `201` con `{ id, pacienteId, paciente, sistolica, diastolica, frecuenciaCardiaca, temperatura, fechaHora, registradoPor, critico, fueraDeRango, nota }`: `critico` es `true` si la temperatura supera 39 °C, `fueraDeRango` lista las etiquetas de los valores fuera de rango y `nota` es la nota de enfermería automática ("Controles de signos vitales realizados con éxito." o los valores fuera de rango). Con temperatura mayor a 39 °C se publica el evento `vital-sign.alert-raised` (una vez guardado el control completo). Errores: `400` por validación o valor implausible (no se guarda nada), `403` para otros roles, `404` si el paciente no existe. |
| `GET /signos-vitales/controles?pacienteId=` | Enfermero o médico | Últimos 100 controles, del más nuevo al más viejo; filtro opcional por paciente. Cada ítem tiene la misma forma que la respuesta del `POST` (una fila por control, no por medición). Los registros sueltos creados con `POST /signos-vitales` no pertenecen a ningún control y no aparecen en este listado. |
| Evento `vital-sign.alert-raised` (suscriptor de Admisión) | Interno, sin endpoint | Con tipo `TEMPERATURA` y valor mayor a 39 °C crea una notificación `SIGNOS_VITALES_ALERTA` de prioridad `ALTA` con el nombre del paciente. Va al médico responsable de la internación activa del paciente (`fechaEgreso` nula) y, si no hay internación activa o ese médico no está activo, a todos los médicos activos. El sistema no modela sectores ni guardias, por eso se usa el médico responsable de la internación como aproximación a "médico de guardia del sector". Si falla solo se registra un log. |
| `POST /indicaciones` | Médico | Crea `{ pacienteId, tipo?, insumoId?, internacionId?, dosis, frecuenciaHoras (1-168), fechaFin? }`. `tipo` admite `MEDICACION` (predeterminado), `DIETA`, `CURACION`, `ESTUDIO` y `CUIDADO`; `insumoId` es obligatorio solo para `MEDICACION`, y `internacionId` debe pertenecer al paciente. Devuelve también `alertasAlergia`. `400` por validación, relación inválida o `fechaFin` pasada, `403` si no es médico, `404` si el paciente o el insumo no existen. |
| `GET /indicaciones?pacienteId=` | Enfermero o médico | Indicaciones activas (iniciadas y sin vencer, 100 máx.), con `tipo`, `estado`, `internacionId`, `insumoId` anulable y `dosisDelDia` (día calendario UTC-3). Cada dosis trae `programadaPara`, `estado` (`ADMINISTRADA`/`OMITIDA`/`PENDIENTE`), `enVentana` y, si corresponde, quién/cuándo la registró y el motivo de omisión. |
| `POST /indicaciones/:id/administraciones` | Enfermero | Confirma la dosis vigente `{ observaciones? }`: la hora del servidor debe caer a ±30 min de `fechaInicio + k * frecuenciaHoras`. Registra al enfermero autenticado y publica `medication.administered` (`patientId`, `supplyId`, `quantity: 1`, `administeredBy`, `administeredAt`) únicamente para una administración nueva y después de confirmar la transacción; el descuento de stock lo hace Resources. Repetir la solicitud de la misma dosis dentro de la ventana devuelve la administración existente sin volver a publicar el evento. `400` UUID inválido, `403` si no es enfermero, `404` indicación inexistente, `409` si la dosis está fuera de ventana, la indicación venció/no comenzó/no está activa, o es anterior a la migración y no tiene `frecuenciaHoras`. |
| `GET /resources/inventory` | Enfermero, médico o administrativo | Lista los insumos ordenados por nombre: `[{ id, nombre, unidadMedida, cantidadDisponible }]`. `401` sin sesión, `403` rol sin permiso. |
| `POST /resources/inventory` | Administrativo | Alta de insumo `{ nombre (texto no vacío, máx. 150), unidadMedida (texto no vacío, máx. 20), precioPesos? (entero ≥ 0, por defecto 0), stockMinimo? (entero ≥ 0, por defecto 0) }` → `201 { id, nombre, unidadMedida, cantidadDisponible (siempre 0), precioPesos, stockMinimo }`. `400` validación, `403` rol sin permiso, `409` ya existe un insumo con ese nombre. |
| `PATCH /resources/inventory/:id` | Administrativo | Edita `{ unidadMedida?, precioPesos?, stockMinimo? }` (al menos uno; el nombre y el stock disponible no se editan por acá) con un `UPDATE` que no toca `cantidad_disponible` → `200 { id, nombre, unidadMedida, cantidadDisponible, precioPesos, stockMinimo }`. `400` validación, id no UUID o sin campos, `403` rol sin permiso, `404` insumo inexistente. |
| `POST /resources/inventory/:id/reponer` | Administrativo | Reposición `{ cantidad (entero entre 1 y 10000 por reposición) }` con un `UPDATE` atómico `cantidad_disponible = cantidad_disponible + :cantidad` → `201 { insumoId, cantidadRepuesta, cantidadActual }`. `400` validación o id no UUID, `403` rol sin permiso, `404` insumo inexistente, `409` la suma supera el máximo de la columna (entero de 32 bits). |
| `POST /resources/inventory/descontar` | Médico | Descuento manual `{ insumoId (UUID), cantidad (entero ≥ 1) }` → `{ insumoId, cantidadDescontada, cantidadRestante }`. `400` validación, `404` insumo inexistente, `409` stock insuficiente. |
| Evento `medication.administered` (suscriptor de Resources) | Interno, sin endpoint | Resources descuenta `quantity` unidades de `supplyId` con `InventoryService.descontarStock` (UPDATE atómico, nunca stock negativo). Idempotente por `administrationId` mientras el proceso siga vivo (memoria). Si falla (stock insuficiente, insumo inexistente, error de BD) solo se registra un log de error: no se propaga al bus ni se revierte la administración. El bus es en memoria; un Outbox queda como mejora posible. |
| `GET /protocolos?pacienteId=` | Enfermero o médico | Protocolos de ingreso del paciente (más nuevo primero): `[{ id, ingresoId, pacienteId, tipo (PRE_QUIRURGICO/RESPIRATORIO), motivoIngreso, generadoEn, tareas: [{ orden, descripcion, frecuenciaHoras }] }]`. `400` si falta o es inválido `pacienteId`, `401` sin sesión, `403` rol sin permiso, `404` paciente inexistente; lista vacía si no tiene protocolo. |
| `POST /protocolos/ingresos` | Médico o administrativo | Registra un ingreso `{ ingresoId (UUID), pacienteId (UUID), motivoIngreso (3-200) }` y genera su protocolo con el Patrón Builder: "cirugía programada" / "pre-quirúrgico" → tareas pre-operatorias; "neumonía" / "infección respiratoria" → tareas respiratorias. Idempotente por `ingresoId`: reenviarlo devuelve el protocolo existente sin duplicar. `400` validación o motivo sin protocolo, `403` rol sin permiso, `404` paciente inexistente. Es la alternativa manual al evento `patient.admitted`, que Recursos publica al asignar una cama con `motivoIngreso`. |
| `POST /camas/:id/asignar` | Médico o administrativo | Asigna la cama `{ pacienteId (UUID), medicoId? (UUID; obligatorio si asigna un administrativo), motivoIngreso? (3-200) }` con bloqueo pesimista y crea la internación. Publica `bed.assigned`; si se informa `motivoIngreso` lo guarda en la internación y publica además `patient.admitted`. El motivo se recorta y un texto vacío se toma como no informado. El protocolo se genera en segundo plano: puede tardar un instante en aparecer en `GET /protocolos`. Un motivo sin protocolo definido no impide la asignación (solo queda un log en Enfermería). `400` validación o médico no habilitado, `404` cama o paciente inexistente, `409` cama ocupada o paciente ya internado. |
| `GET /camas/eventos` | Enfermero, médico o administrativo | Stream de Server-Sent Events (`text/event-stream`) con los cambios de estado de las camas. Cada mensaje trae en `data` `{ tipo (bed.assigned / bed.released / bed.cleaned / bed.blocked / bed.unblocked), camaId, numero, estado (estado en el que queda la cama), at }`. Cada 25 s envía un evento `ping` para mantener la conexión. Solo llegan los cambios posteriores a la conexión: el estado inicial se pide a `GET /camas`. Requiere `Authorization: Bearer`; el `EventSource` nativo del navegador no puede enviar ese header, así que el cliente debe usar `fetch` con lectura del stream (o una librería de fetch-event-source). El token no se pasa por query string. `401` sin sesión, `403` rol sin permiso. |
| Evento `patient.admitted` (suscriptor de Enfermería) | Interno, sin endpoint | Payload `{ admissionId, patientId, reason, admittedAt }`. Enfermería genera el protocolo con `ProtocolosService` (misma lógica que el endpoint, idempotente por `admissionId` gracias al índice único de `protocolos_ingreso`). Si falla (motivo sin protocolo, paciente inexistente, error de BD) solo se registra un log: no se propaga al bus. Lo publica Recursos desde `POST /camas/:id/asignar` cuando se informa `motivoIngreso`, después de confirmar la transacción; `admissionId` es el id de la internación. |
| `GET /historia-clinica/:pacienteId` | Médico o enfermero | Historia clínica: `{ paciente (ficha demográfica de Admisión), alergias, antecedentesFamiliares, evoluciones, estudios, notasEnfermeria, rectificaciones }`; cada sección es una lista de registros inmutables del más nuevo al más viejo. Los registros incluyen `categoria`, `corrigeA`, `rectificado`, `turnoId` e `internacionId` además de autor y fecha. `400` si `pacienteId` no es UUID, `401` sin sesión, `403` administrativo, `404` paciente inexistente. |
| `GET /historia-clinica/:pacienteId/timeline` | Médico o enfermero | Línea de tiempo unificada con registros clínicos, internaciones, signos vitales, medicación administrada y turnos atendidos, ordenada cronológicamente; cada entrada expone `{ id, tipo, fechaHora, titulo, detalle }`. |
| `GET /historia-clinica/:pacienteId/alergias` | Médico o enfermero | Registros de alergia del paciente, para controles clínicos al prescribir. |
| `POST /historia-clinica/:pacienteId/registros/:regId/rectificar` | Médico | Crea una entrada `RECTIFICACION` inmutable con `{ motivo }` y referencia `corrigeA`; nunca modifica el original. `409` si ya existe rectificación del registro. La integración con el decorador de auditoría de IAM queda pendiente de la entrega de ese contrato por el Frente A. |
| `POST /historia-clinica/:pacienteId/estudios/adjuntos` | Médico | `multipart/form-data`: `tipo`, `informe`, `archivo` y opcionalmente `estado` (`SOLICITADO`/`REALIZADO`/`INFORMADO`) y `fecha`. Acepta PDF/PNG/JPEG de hasta 10 MB y guarda el archivo fuera del directorio público. `GET /historia-clinica/:pacienteId/estudios` lista metadatos y `GET /historia-clinica/estudios/:id/adjunto` descarga con autenticación. |
| `POST /historia-clinica/:pacienteId/evoluciones` | Médico | Registra `{ nota, turnoId?, internacionId? }`; si se vincula turno o internación, debe pertenecer al paciente. Los campos demográficos todavía dependen de la entrega ADM-2 y no se duplican en HCE. |
| `POST /notas-enfermeria` | Enfermero | Registra una nota inmutable de Enfermería para el paciente con autor y fecha del servidor; los controles completos de signos vitales también generan su nota automática en HCE. |
| `PATCH /indicaciones/:id/suspender` | Médico | Suspende o finaliza la indicación con `{ estado: SUSPENDIDA\|FINALIZADA, motivo }`; registra motivo y actor. No se elimina la indicación. |
| `POST /indicaciones/:id/omisiones` | Enfermero | Registra una dosis omitida con motivo obligatorio y trazabilidad. |
| `POST /indicaciones/:id/ejecuciones` | Enfermero | Registra la ejecución u omisión de una indicación no medicamentosa `{ resultado: EJECUTADA\|OMITIDA, motivoOmision? }`. La omisión requiere motivo; no publica `medication.administered` ni descuenta insumos. |
| `GET /signos-vitales?pacienteId=&internacionId=` | Enfermero o médico | Últimos 100 registros, opcionalmente filtrados por paciente e internación. Cada registro incluye `internacionId` y la marca `fueraDeRango`. |
| `GET /signos-vitales/controles?pacienteId=&internacionId=` y `POST /signos-vitales/controles` | Enfermero o médico | Los filtros aceptan una internación del paciente. El alta acepta `internacionId?` junto con las cuatro mediciones; si la internación no pertenece al paciente responde `400`. |
| `GET /signos-vitales/:pacienteId/serie?tipo=&internacionId=` | Enfermero o médico | Serie cronológica del paciente; tipo e internación son filtros opcionales. Un vínculo de internación ajeno al paciente se rechaza. |
| `GET /camas` y `GET /camas/:id` | Médico, enfermero o administrativo | Mapa/detalle persistentes; se puede filtrar el mapa por estado y sector. La respuesta incluye habitación, sector, paciente, versión, actividad y motivo de bloqueo. Estados del API: `LIBRE`, `OCUPADA`, `EN_LIMPIEZA` y `BLOQUEADA`. |
| `POST /camas`, `PATCH /camas/:id`, `DELETE /camas/:id` | Administrativo | Alta en habitación activa con capacidad disponible; edición solo de cama libre; baja lógica de cama libre. |
| `POST /camas/:id/trasladar` | Médico o administrativo | `{ camaDestinoId }`; operación atómica, origen a `EN_LIMPIEZA` y destino a `OCUPADA`, sin reiniciar fechas de la internación. |
| `POST /camas/:id/bloquear` y `POST /camas/:id/desbloquear` | Administrativo | Bloqueo de cama libre con motivo obligatorio; desbloqueo a `LIBRE`. |
| `GET /internaciones?pacienteId=&camaId=` | Médico, enfermero o administrativo | Historial de internaciones filtrable por paciente o cama. El alta se registra con `POST /camas/:id/alta` (médico o administrativo) y pasa la cama a `EN_LIMPIEZA`. |
| `GET/POST /sectores` y `GET/POST /habitaciones` | Médico, enfermero o administrativo para lectura; administrativo para alta | Ubicaciones activas. La creación de habitación vincula un sector y declara su capacidad. |
| Evento `bed.transferred` | Interno, sin endpoint | Se publica después del traslado transaccional con identificadores de cama/paciente y fecha; los eventos de cama se respaldan en Outbox para distribuir el stream SSE entre instancias. |
| `POST /historia-clinica/:pacienteId/alergias` | Médico | Registra `{ sustancia (2-120), reaccion (2-1000) }`. Autor y fecha los pone el servidor. `201` con el registro; `400` validación, `403` rol sin permiso, `404` paciente inexistente. |
| `POST /historia-clinica/:pacienteId/antecedentes-familiares` | Médico | Registra `{ parentesco (2-120), descripcion (2-1000) }`. Mismos errores que alergias. |
| `POST /historia-clinica/:pacienteId/evoluciones` | Médico | Registra la evolución médica `{ nota (3-4000) }`. Mismos errores que alergias. |
| `POST /historia-clinica/:pacienteId/estudios` | Médico | Registra un estudio para su visualización `{ tipo (2-120), resultado (2-4000) }` (texto; no hay carga de archivos). Mismos errores que alergias. |

Contrato INT-8, validación de cobertura (Facturación entrega el puerto y el adaptador simulado; Admisión lo invoca al reservar o atender un turno):

| Elemento | Detalle |
| --- | --- |
| Token | `COVERAGE_VERIFIER`, exportado por `BillingModule`. Se inyecta con `@Inject(COVERAGE_VERIFIER)` importando `BillingModule`; el tipo es `CoverageVerifier`, de `modules/billing/domain/ports/coverage-verifier.port.ts`. |
| Firma | `verify(input: CoverageCheckInput): Promise<CoverageCheckResult>` con `input = { tipoCobertura, financiadorId, planId, numeroAfiliado, prestacion? }` (los datos de afiliación del paciente; `prestacion` es opcional y hoy el adaptador simulado la ignora). Devuelve `{ cubierta: boolean, motivo? }`. |
| Errores | No lanza excepciones por rechazo: devuelve `cubierta: false` con un `motivo`. Quien invoca traduce el rechazo a su error HTTP. |
| `AFILIACION_INCOMPLETA` | Obra social pública o prepaga sin `financiadorId`, `planId` o `numeroAfiliado` (nulos o vacíos). |
| `FINANCIADOR_INEXISTENTE` / `FINANCIADOR_INACTIVO` | El financiador no existe o está dado de baja. |
| `PLAN_INEXISTENTE` / `PLAN_INACTIVO` | El plan no existe o está dado de baja. |
| `PLAN_NO_PERTENECE_AL_FINANCIADOR` | El plan pertenece a otro financiador. |
| Particular | `PARTICULAR` siempre devuelve `cubierta: true` sin consultar nada. |

Uso desde Admisión: `const r = await this.coverageVerifier.verify({ tipoCobertura, financiadorId, planId, numeroAfiliado });` y, si `!r.cubierta`, rechazar según `r.motivo`. La afiliación se considera vigente cuando está completa y el financiador y el plan siguen activos; el modelo no tiene fechas de vigencia.

La historia clínica es inmutable: no existen endpoints de modificación ni borrado, y la tabla `registros_clinicos` rechaza `UPDATE` y `DELETE` con un trigger. Los textos se guardan sin espacios en los extremos. Las lecturas excluyen al administrativo porque los datos clínicos no forman parte de su función; la ficha demográfica sigue disponible para él en `GET /pacientes/:id`.

Los `:id` de `/usuarios` y `/turnos` deben ser UUID; si no lo son, la API responde `400`.

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
