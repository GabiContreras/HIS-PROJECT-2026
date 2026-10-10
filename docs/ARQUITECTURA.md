# Arquitectura del HIS

## Objetivo

Adaptar el monorepo existente a la arquitectura de referencia UTN sin cambiar Vue 3, Vite, NestJS, TypeORM ni PostgreSQL. La organización objetivo es un **monolito modular** con límites de dominio, capas hexagonales y eventos internos para reducir acoplamiento.

## Módulos de dominio

- `iam`: usuarios, autenticación, roles y permisos.
- `admissions`: pacientes, turnos, agenda y triaje.
- `ehr`: historia clínica, antecedentes y registros clínicos.
- `nursing`: signos vitales operativos, administración de medicación y cuidados de enfermería.
- `resources`: camas, internaciones, insumos e inventario.
- `billing`: cargos, coberturas y facturación.
- `health`: endpoints de estado/diagnóstico técnico.

## Capas por módulo

Cada módulo funcional debe evolucionar hacia esta estructura:

```text
modules/<modulo>/
  domain/           # entidades/reglas del dominio y puertos (interfaces)
  application/      # casos de uso
  infrastructure/   # TypeORM, repositorios y servicios técnicos
  api/              # controladores NestJS y DTOs HTTP
  <modulo>.module.ts
```

Dependencias permitidas: `api -> application -> domain`; `infrastructure` implementa los puertos definidos por `domain`. El dominio no debe importar NestJS, TypeORM ni detalles HTTP.

## Estado de esta adaptación

Esta entrega crea el esqueleto modular y registra las entidades existentes dentro de módulos por dominio, pero conserva las entidades TypeORM en `src/entities/` para evitar una migración física riesgosa. La migración de cada entidad a `infrastructure/persistence/` se debe hacer módulo por módulo, actualizando las migraciones y verificando la compilación.

`IamModule` expone autenticación, administración de cuentas y autorización con guards. Las entidades TypeORM permanecen temporalmente en `src/entities/` para evitar una migración física riesgosa.

## Eventos

`src/shared/events/EventBus` provee un bus interno en memoria usando RxJS. Publicar un evento no garantiza persistencia ni entrega tras un reinicio. No usarlo como única garantía para facturación, administración de medicación o inventario. Para esos casos usar transacciones y/o patrón Outbox e idempotencia.

Ejemplo de contrato:

```ts
{
  type: 'admissions.appointment-attended',
  occurredAt: new Date().toISOString(),
  payload: { appointmentId: '...' }
}
```

Convención: nombres de eventos en pasado, nombres estables y payloads versionables. Los eventos no deben transportar datos clínicos innecesarios.

## Persistencia

- PostgreSQL alojado en Supabase; no se adopta SQLite de la referencia.
- `synchronize: false`; el esquema se modifica con migraciones versionadas.
- `DATABASE_URL` es secreto y solo se usa en backend.
- `DATABASE_SSL=false` permite desactivar SSL solo en entornos locales que lo requieran; por defecto se utiliza SSL.

## API REST

- Controladores delgados: traducen HTTP a casos de uso.
- DTOs con `class-validator`; `ValidationPipe` global con `whitelist`.
- Errores consistentes; usar `409 Conflict` ante reservas incompatibles.
- Documentar endpoints en Swagger cuando se agreguen los casos de uso.
- Guards y autorización deben proteger rutas antes de exponer datos sensibles.

## IAM y Admisión implementados

- IAM autentica con JWT de acceso (15 minutos por defecto) y refresh tokens
  aleatorios rotatorios almacenados como hash; el refresh viaja en cookie
  HttpOnly, SameSite=Strict localmente y SameSite=None/Secure en producción.
- Los roles son `MEDICO`, `ENFERMERO` y `ADMINISTRATIVO`. Un indicador separado
  identifica al superadmin raíz, que se provisiona con el comando
  `iam:bootstrap-superadmin`; solo esa cuenta crea otros administrativos.
- Durante desarrollo, el alta de médicos y enfermeros no envía códigos por
  correo. Enfermería queda activa y el médico requiere habilitación
  administrativa. La verificación por correo se pospone hasta configurar el
  servicio de correo; estos atajos quedan bloqueados en `NODE_ENV=production`.
- El restablecimiento por email sin código está disponible solo fuera de
  producción. Las contraseñas históricas se conservan y, en desarrollo, se
  convierten a scrypt luego de un login válido.
- Las cuentas deshabilitadas no pueden iniciar sesión y sus sesiones se revocan.
- La contraseña requiere 8 caracteres, una mayúscula, un dígito y no permite
  dígitos consecutivos ascendentes ni descendentes.
- La agenda utiliza turnos regulares de 30 minutos y turnos urgentes de 15. La
  urgencia solo puede insertarse 15 minutos después del inicio de un turno libre
  de 30 minutos; ese turno se reduce a 15 minutos en la misma transacción.
- Reserva, creación de agenda y cambios de estado bloquean la fila del médico y
  la fila del turno en una transacción. Las transiciones válidas son
  `DISPONIBLE -> RESERVADO -> CONFIRMADO -> ATENDIDO`, con cancelación desde
  `RESERVADO` o `CONFIRMADO`; cancelar conserva el registro y libera otro turno
  disponible para ese horario.
- Las rutas clínicas/operativas de EHR, Nursing, Resources y Billing no forman
  parte de esta implementación.

## Estrategia de migración

1. Mantener el comportamiento actual y confirmar que compila.
2. Implementar la primera historia vertical de Admisión con dominio, caso de uso, repositorio y controlador.
3. Añadir pruebas unitarias del dominio y de integración con PostgreSQL.
4. Mover entidades TypeORM a la infraestructura de su módulo y ajustar `data-source.ts`.
5. Replicar el patrón en IAM, EHR, Nursing, Resources y Billing.
6. Añadir subscribers/eventos donde exista una necesidad real de desacoplamiento.

## Criterios para integrar Pull Requests

- Compila y pasan las pruebas pertinentes.
- No agrega secretos ni `.env`.
- Incluye migraciones si cambia el esquema.
- Respeta los límites de módulo y contratos acordados.
- Las reglas críticas se validan en backend/base de datos, no solo en frontend.
