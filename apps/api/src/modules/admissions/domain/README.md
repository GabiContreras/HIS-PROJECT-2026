# Admissions – Domain

## Responsabilidad

La capa Domain contiene los modelos, reglas de negocio, contratos y comportamientos propios del módulo Admissions.

Su objetivo es representar los conceptos principales del proceso de admisión de pacientes y gestionar las reglas que determinan el comportamiento de los turnos.

## Componentes principales

### 1. Paciente

Archivo: `paciente.ts`

Define la interfaz del paciente y sus datos principales:

- Identificador.
- Nombre y apellido.
- Documento.
- Fecha de nacimiento.
- Teléfono.

### 2. Reglas de paciente

Archivo: `paciente.rules.ts`

Contiene la validación de la fecha de nacimiento mediante la función `validateBirthDate`.

Se contemplan dos errores:

- `FUTURE`: la fecha ingresada es posterior a la fecha actual.
- `TOO_OLD`: la fecha es anterior al límite permitido (`1900-01-01`).

### 3. Repositorio de pacientes

Archivo: `ports/pacientes.repository.ts`

Define el contrato `PacientesRepository`, que establece las operaciones disponibles para trabajar con los datos de pacientes:

- Buscar pacientes.
- Consultar un paciente por identificador.
- Consultar por documento.
- Crear pacientes.
- Actualizar la cobertura médica.

También define `DocumentoDuplicadoError` para representar el caso de un documento ya registrado.

### 4. Estados de turnos – Patrón State

Archivos:
- `states/turno-state.interface.ts`
- `states/turno-states.ts`

Implementa el patrón State para controlar las transiciones de los turnos.

Los estados contemplados son:

- Reservado.
- Confirmado.
- En sala de espera.
- Atendido.
- Cancelado.
- Disponible.

Cada estado determina qué transiciones están permitidas. Cuando se intenta realizar una transición inválida, se utiliza `TransicionTurnoInvalidaError`.

También se dispone de `turnoStateFor()` para obtener el comportamiento correspondiente a un estado y `tablaTransiciones()` para consultar las transiciones permitidas.

### 5. Pruebas

Archivo: `states/turno-states.spec.ts`

Contiene pruebas relacionadas con el comportamiento y las transiciones de los estados de los turnos.

## Criterios de implementación

- Las reglas de negocio deben permanecer dentro del dominio.
- Los contratos deben definir las operaciones sin depender de implementaciones concretas.
- El dominio no debe depender de controladores HTTP.
- No debe contener consultas directas a la base de datos.
- Las transiciones de estados deben respetar las reglas definidas para cada estado.

## Relación con otras capas

Application utiliza los modelos, reglas y contratos definidos por Domain.

Infrastructure implementa los contratos necesarios para acceder a los datos.

API expone las operaciones mediante los endpoints correspondientes.

## Consideraciones

Toda modificación debe respetar la separación de responsabilidades establecida en `docs/ARQUITECTURA.md`.
