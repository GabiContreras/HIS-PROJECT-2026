# HIS — Sistema de Información Hospitalaria

Monorepo de aplicación web con Vue 3 + Vite, API NestJS, TypeORM y PostgreSQL (Supabase).

## Requisitos

- Node.js compatible con las versiones fijadas en los `package.json`.
- npm.
- Instancia PostgreSQL/Supabase y una URL de conexión para el backend.

## Configuración inicial

1. Copiar `.env.example` a `apps/api/.env` y completar `DATABASE_URL`.
2. Instalar dependencias en cada workspace si no se instala desde la raíz:

```bash
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

3. Ejecutar API: `npm --prefix apps/api run start:dev`.
4. Ejecutar frontend: `npm --prefix apps/web run dev`.

Revisar `docs/ARQUITECTURA.md` y los README de cada aplicación para confirmar comandos y requisitos de entorno.

## Arquitectura

La API se está adaptando a monolito modular con módulos de dominio y capas hexagonales. Esta versión crea la estructura inicial y mantiene las entidades TypeORM actuales en su ubicación original para reducir riesgos. No todos los casos de uso de los módulos están implementados todavía.

## Seguridad

No subir archivos `.env` ni credenciales. La clave de conexión a Supabase debe existir solo en backend. Las migraciones deben estar versionadas y `synchronize` debe permanecer desactivado.
