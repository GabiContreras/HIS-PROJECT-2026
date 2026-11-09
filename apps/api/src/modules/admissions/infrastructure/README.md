# Admissions – Infrastructure

## Responsabilidad

La capa Infrastructure contiene las implementaciones técnicas necesarias para conectar el módulo Admissions con los mecanismos de persistencia de datos.

Implementa los contratos definidos en Domain y utiliza TypeORM para interactuar con la base de datos.

## Componentes principales

### 1. Repositorio de pacientes

Archivo: `pacientes.typeorm.repository.ts`

Implementa el contrato `PacientesRepository` mediante TypeORM.

Se encarga de realizar las operaciones de búsqueda, consulta, creación y actualización de pacientes en la base de datos.

### 2. Entidades de persistencia

Ubicación: `persistence/entities/`

Contiene las entidades que representan las estructuras persistidas del módulo:

- `paciente.entity.ts`: representa los pacientes.
- `turno.entity.ts`: representa los turnos médicos.
- `entreturno-standby.entity.ts`: representa los registros de espera entre turnos.
- `notificacion.entity.ts`: representa las notificaciones asociadas al módulo.

Estas entidades utilizan decoradores de TypeORM para definir su correspondencia con las tablas de la base de datos.

## Criterios de implementación

- Las implementaciones de los repositorios deben respetar los contratos definidos en Domain.
- La persistencia debe realizarse mediante los mecanismos establecidos por el proyecto.
- Las entidades de TypeORM deben permanecer en esta capa.
- No deben incorporarse reglas de negocio propias del dominio en los repositorios.
- Las dependencias de infraestructura no deben filtrarse hacia Domain.

## Relación con otras capas

Domain define los contratos que necesita el módulo.

Infrastructure implementa esos contratos y resuelve el acceso a los datos.

Application coordina los casos de uso utilizando las abstracciones correspondientes.

API recibe las solicitudes y delega su procesamiento.

## Consideraciones

Toda modificación de persistencia debe respetar la arquitectura modular definida en `docs/ARQUITECTURA.md`.
