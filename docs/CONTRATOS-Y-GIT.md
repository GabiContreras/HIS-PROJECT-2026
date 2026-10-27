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
