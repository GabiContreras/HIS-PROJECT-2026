# Contratos de módulos y flujo Git

## Contratos mínimos de API

Cada endpoint debe documentar método/ruta, DTO de entrada, respuesta, permisos, errores y pruebas.

- Admisión: `POST /pacientes`, `GET /pacientes/:id`, `POST /turnos`, transiciones de estado.
- IAM: endpoints de autenticación y administración de usuarios (definir permisos antes de publicar).
- EHR/Nursing: registros clínicos y de medicación con trazabilidad de autor/fecha.
- Resources: disponibilidad/asignación de camas y movimientos de inventario.
- Billing: consulta y registro de cargos, evitando duplicados por reintentos.

Las rutas son propuestas de contrato, no todas están implementadas en esta entrega.

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
