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

El módulo `iam` reutiliza temporalmente `UsuariosModule` existente. La autenticación/JWT/RBAC todavía debe implementarse; no se considera terminada por la mera existencia de `IamModule`.

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
- El código TypeScript usa `camelCase`; los nombres de tablas y columnas en PostgreSQL usan `snake_case`, mediante `SnakeNamingStrategy`, configurada tanto en `app.module.ts` como en `data-source.ts`.
- Los nombres explícitos de entidades y columnas deben respetar `snake_case`. Los cambios en una base existente se hacen con migraciones revisadas; activar la estrategia no renombra columnas por sí solo.
- `DATABASE_URL` es secreto y solo se usa en backend.
- `DATABASE_SSL=false` permite desactivar SSL solo en entornos locales que lo requieran; por defecto se utiliza SSL.

## API REST

- Controladores delgados: traducen HTTP a casos de uso.
- DTOs con `class-validator`; `ValidationPipe` global con `whitelist`.
- Errores consistentes; usar `409 Conflict` ante reservas incompatibles.
- Documentar endpoints en Swagger cuando se agreguen los casos de uso.
- Guards y autorización deben proteger rutas antes de exponer datos sensibles.

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
