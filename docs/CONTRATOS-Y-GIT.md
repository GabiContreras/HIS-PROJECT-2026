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
| `GET /billing/cargos` | Administrativo | Cargos con el turno, paciente, médico y el reparto paciente / tercero según la cobertura. |

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
