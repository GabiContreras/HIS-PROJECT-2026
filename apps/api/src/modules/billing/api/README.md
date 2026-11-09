# Billing – API

## Responsabilidad

La capa API del módulo Billing expone los endpoints HTTP relacionados con la consulta de cargos de facturación.

Su función es recibir las solicitudes, aplicar los mecanismos de autenticación y autorización, y delegar las operaciones a la capa Application.

## Componentes principales

### 1. Controlador de cargos

Archivo: `cargos.controller.ts`

Implementa el controlador `CargosController`, encargado de exponer las operaciones relacionadas con los cargos.

Endpoint disponible:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/billing/cargos` | Obtiene el listado de cargos registrados. |

La operación delega la consulta a `BillingService.list()`.

### 2. Autenticación y autorización

El controlador utiliza:

- `AuthGuard`: verifica que el usuario esté autenticado.
- `RolesGuard`: controla los permisos según el rol.
- `Roles`: establece el rol `ADMINISTRATIVO` como requisito de acceso.

### 3. DTO

Archivo: `dto/cargo-detalle.dto.ts`

Define la estructura de los datos utilizados para representar los detalles de los cargos en las respuestas de la API.

### 4. Pruebas

Archivo: `cargos.controller.integration.spec.ts`

Contiene pruebas de integración relacionadas con el controlador de cargos.

## Criterios de implementación

- Los controladores deben encargarse de la comunicación HTTP.
- La lógica de negocio debe permanecer fuera de esta capa.
- Las operaciones deben delegarse a Application.
- Los endpoints deben respetar los mecanismos de autenticación y autorización establecidos.

## Relación con otras capas

API recibe las solicitudes y las delega a Application.

Application coordina los casos de uso y utiliza las abstracciones necesarias para acceder a los datos.

Infrastructure proporciona las implementaciones técnicas de persistencia.

## Consideraciones

Toda nueva funcionalidad debe respetar la arquitectura modular definida en `docs/ARQUITECTURA.md`.
