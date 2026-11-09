# Billing / Infrastructure

## Responsabilidad

La capa de infraestructura de Billing contiene los elementos relacionados con la persistencia de los cargos de facturación en la base de datos.

Utiliza TypeORM para definir la estructura de la entidad y establecer cómo se almacenan los datos.

## Componentes principales

### 1. Entidad Cargo

El archivo `persistence/entities/cargo.entity.ts` define la entidad `Cargo`, que representa los cargos generados dentro del sistema.

La entidad está asociada a la tabla `cargos` mediante el decorador `@Entity`.

Contiene los siguientes atributos:

- **id:** identificador único del cargo, generado mediante UUID.
- **turnoId:** identificador del turno relacionado. Es opcional y único.
- **administrationId:** identificador de la administración de medicación relacionada. Es opcional.
- **concepto:** descripción del cargo. Es opcional.
- **importePesos:** importe total del cargo.
- **tipoAtencion:** tipo de atención facturable.
- **tipoCobertura:** tipo de cobertura del paciente. Es opcional.
- **entidadCobertura:** nombre de la entidad responsable de la cobertura. Es opcional.
- **importePacientePesos:** importe que debe abonar el paciente. Es opcional.
- **importeTerceroPesos:** importe correspondiente a un tercero. Es opcional.
- **createdAt:** fecha y hora de creación del registro, generada automáticamente.

### 2. Tipos de atención facturable

La entidad define el enumerado `TipoAtencionFacturable`, que contempla tres categorías:

- `REGULAR`: consulta regular.
- `URGENCIA`: consulta de urgencia.
- `FARMACIA`: cargo relacionado con farmacia.

### 3. Persistencia

La entidad utiliza decoradores de TypeORM para definir la correspondencia entre sus atributos y las columnas de la tabla `cargos`.

Entre ellos se encuentran:

- `@PrimaryGeneratedColumn`: genera el identificador único.
- `@Column`: define las columnas y sus características.
- `@CreateDateColumn`: registra automáticamente la fecha de creación.

También utiliza `CoverageType`, definido en `shared/events/coverage-type.ts`, para representar los tipos de cobertura.

## Consideraciones

- Esta capa se ocupa de la representación y almacenamiento de los cargos.
- La entidad no contiene las reglas de cálculo de los importes; esas responsabilidades corresponden a la capa de dominio.
- Los campos relacionados con el turno y la administración de medicación permiten asociar un cargo con distintos conceptos facturables.

## Archivos de esta capa

- `persistence/entities/cargo.entity.ts`
