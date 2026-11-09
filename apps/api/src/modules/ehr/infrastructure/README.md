# EHR / Infrastructure

## Responsabilidad

La capa Infrastructure del módulo EHR contiene las entidades de persistencia relacionadas con la Historia Clínica Electrónica.

Utiliza TypeORM para definir cómo se representan y almacenan en la base de datos las indicaciones médicas y los signos vitales de los pacientes.

## Componentes principales

### 1. Entidad IndicacionMedica

El archivo `persistence/entities/indicacion-medica.entity.ts` define la entidad `IndicacionMedica`, asociada a la tabla `indicaciones_medicas`.

Representa las indicaciones médicas realizadas a los pacientes.

Sus atributos y relaciones principales son:

- **id:** identificador único generado mediante UUID.
- **paciente:** paciente al que corresponde la indicación.
- **medico:** usuario que realiza la indicación.
- **insumo:** insumo relacionado con la indicación.
- **dosis:** dosis indicada.
- **frecuencia:** frecuencia de administración.
- **fechaInicio:** fecha de inicio, generada automáticamente.
- **fechaFin:** fecha de finalización, opcional.

La entidad utiliza relaciones `ManyToOne` con Paciente, Usuario e Insumo.

### 2. Entidad SignoVital

El archivo `persistence/entities/signo-vital.entity.ts` define la entidad `SignoVital`, asociada a la tabla `signos_vitales`.

Representa los registros de signos vitales de los pacientes.

Sus atributos y relaciones principales son:

- **id:** identificador único generado mediante UUID.
- **paciente:** paciente al que pertenece el registro.
- **registradoPor:** usuario responsable de registrar el signo vital.
- **tipo:** tipo de signo vital registrado.
- **valor:** valor numérico registrado.
- **fechaHora:** fecha y hora de creación del registro, generada automáticamente.

La entidad utiliza relaciones `ManyToOne` con Paciente y Usuario.

## Relaciones con otros módulos

Las entidades de EHR se relacionan con entidades pertenecientes a otros módulos:

- **Admissions:** aporta la entidad Paciente.
- **IAM:** aporta la entidad Usuario.
- **Resources:** aporta la entidad Insumo, utilizada por IndicacionMedica.

Estas relaciones permiten vincular la información clínica con los pacientes, los usuarios del sistema y los insumos disponibles.

## Persistencia

Las entidades utilizan decoradores de TypeORM para definir sus tablas, columnas, identificadores y relaciones.

Entre los decoradores utilizados se encuentran:

- `@Entity`: identifica la tabla asociada.
- `@PrimaryGeneratedColumn`: genera identificadores únicos.
- `@Column`: define los campos almacenados.
- `@ManyToOne`: establece relaciones entre entidades.
- `@CreateDateColumn`: registra automáticamente fechas de creación.

También se definen comportamientos de eliminación mediante `onDelete`, utilizando `CASCADE` y `RESTRICT` según la relación.

## Consideraciones

- Esta capa se ocupa de la representación y persistencia de la información clínica.
- Las reglas de negocio no deben concentrarse en las entidades de persistencia.
- Las relaciones permiten integrar la historia clínica con los módulos Admissions, IAM y Resources.

## Archivos de esta capa

- `persistence/entities/indicacion-medica.entity.ts`
- `persistence/entities/signo-vital.entity.ts`
