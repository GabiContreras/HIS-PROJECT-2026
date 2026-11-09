# Reglas de Proyecto - HIS / OptiMed

## Arquitectura y Backend
- Monolito modular (NestJS en `apps/api`). Prohibido proponer microservicios.
- Hexagonal "light": la capa de dominio (`domain`) NO debe importar NestJS ni TypeORM.
- Naming convention: Código en `camelCase`, base de datos en `snake_case` usando `SnakeNamingStrategy`.
- Concurrencia crítica: Usar transacciones con bloqueo pesimista (`pessimistic_write` / `SELECT ... FOR UPDATE`) al reservar turnos, asignar camas o tocar inventario. Retornar error 409 ante conflicto.
- Base de datos: Nunca usar `synchronize: true`. Siempre generar y aplicar migraciones versionadas.

## Frontend
- Vue 3 + Pinia + Vue Router en `apps/web`.
- Usar siempre Composition API (`<script setup lang="ts">`).
- Organización por features (`admissions`, `beds`, `billing`, etc.).

## Tipos Compartidos
- Usar DTOs y tipos exportados desde `packages/contracts`.