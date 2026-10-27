# Validacion posterior a la implementacion

## Alcance

Este documento registra los problemas detectados al validar la integracion de
la implementacion de gestion de usuarios, turnos y facturacion, las
correcciones aplicadas y el estado actual del sistema.

## Errores detectados y correcciones

### Migracion de eventos clinicos no detectada

La migracion `ClinicalEvents1791800000000` estaba dentro de un subdirectorio
accidental:

```text
src/migrations/apps/api/src/migrations/
```

El datasource de TypeORM solo carga migraciones ubicadas directamente en
`src/migrations/*.ts`, por lo que la migracion no se encontraba al ejecutar
`migration:run`.

**Correccion**

- Se movio la migracion a `src/migrations/`.
- Se hizo idempotente para manejar una base que ya tenia la tabla
  `eventos_clinicos`, pero no el registro de esa migracion. La migracion ahora
  usa `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `CREATE OR REPLACE FUNCTION` y vuelve a crear el trigger de solo agregado.

**Resultado**

La migracion se registro correctamente sin eliminar datos existentes.

### Migraciones pendientes

La base configurada tenia dos migraciones pendientes:

- `ClinicalEvents1791800000000`
- `CreateInternaciones1791900000000`

**Correccion**

Se ejecutaron con:

```bash
npm --prefix apps/api run migration:run
```

**Resultado**

Las cinco migraciones del codigo fuente quedaron registradas como ejecutadas.

### Error de inyeccion de dependencias en facturacion

Al iniciar la API, Nest no podia construir `AuthGuard` para los endpoints de
facturacion:

```text
Nest can't resolve dependencies of the AuthGuard (?, AuthService).
```

`BillingModule` usa los guards de IAM en `CargosController`, pero no importaba
`IamModule`, que exporta `AuthGuard`, `AuthService` y `TokenService`.

**Correccion**

Se agrego `IamModule` a los imports de `BillingModule`.

**Resultado**

La API inicia correctamente y registra la ruta protegida
`GET /billing/cargos`.

### Variables de entorno

Se creo `apps/api/.env`, que no se versiona por estar cubierto por
`.gitignore`.

Durante la revision se corrigieron dos claves:

- `DB_SSL` se renombro a `DATABASE_SSL`, que es la variable que consume la
  aplicacion.
- `FRONTEND_ORIGINS` contenia texto adicional dentro del valor. Se dejo como
  `http://localhost:5173`, permitiendo que el frontend pase la validacion CORS.

No se documentan valores de credenciales, secretos ni cadenas de conexion.

## Validaciones realizadas

| Verificacion | Resultado |
| --- | --- |
| Build de API (`npm --prefix apps/api run build`) | Correcto |
| Tests de aplicacion (`npm --prefix apps/api run test -- src`) | 25 de 25 aprobados |
| Estado de migraciones | Sin migraciones pendientes |
| Inicio de API con Nest y conexion a PostgreSQL | Correcto |
| `GET /` | HTTP 200 |
| Swagger (`/docs`) | HTTP 200 |
| `GET /auth/me` sin token | HTTP 401 esperado |
| Preflight CORS desde `http://localhost:5173` | HTTP 204 con origen autorizado |
| Frontend Vite | HTTP 200 |

## Prueba no incluida

El unico test no incluido en los 25 es el de concurrencia de inventario:

```text
apps/api/test/inventory-service-concurrency.spec.ts
```

Requiere una instancia PostgreSQL local separada llamada `his_test` y la
variable de entorno `PGLOCAL_PASSWORD`. No se ejecuto durante esta validacion
porque ese entorno de prueba aislado no estaba configurado.

## Estado actual

La API inicia y se conecta a la base configurada. El frontend responde
localmente, CORS permite el origen del frontend y las migraciones estan
sincronizadas con la base usada en la validacion.

Para iniciar los servicios nuevamente:

```bash
npm --prefix apps/api run start:dev
npm --prefix apps/web run dev
```

URLs locales:

- Frontend: `http://localhost:5173`
- API y Swagger: `http://localhost:3000/docs`
