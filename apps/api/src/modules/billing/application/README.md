# Billing – Application

## Responsabilidad

La capa Application coordina las operaciones relacionadas con la facturación del sistema hospitalario.

Contiene el servicio principal de facturación y los suscriptores encargados de procesar eventos provenientes de otros módulos para generar cargos automáticamente.

## Componentes principales

### 1. Servicio de facturación

Archivo: `billing.service.ts`

Implementa `BillingService`, responsable de gestionar las operaciones de facturación.

Sus principales operaciones son:

- `createForAppointment()`: genera un cargo asociado a una consulta médica.
- `createForMedicationAdministration()`: genera un cargo por la administración de medicamentos.
- `list()`: obtiene el listado de cargos registrados con información relacionada del paciente, médico y cobertura.

El servicio utiliza estrategias para calcular los importes de consultas regulares y urgencias.

También contempla la distribución del importe según el tipo de cobertura médica y controla la generación de cargos duplicados.

### 2. Suscriptor de consultas atendidas

Archivo: `appointment-attended.subscriber.ts`

Implementa `AppointmentAttendedSubscriber`.

Escucha el evento:

`admissions.appointment-attended`

Cuando recibe el evento, invoca `BillingService.createForAppointment()` para registrar el cargo correspondiente a la consulta atendida.

### 3. Suscriptor de medicamentos administrados

Archivo: `medication-administered.subscriber.ts`

Implementa `MedicationAdministeredSubscriber`.

Escucha el evento:

`medication.administered`

Cuando recibe el evento, invoca `BillingService.createForMedicationAdministration()` para generar el cargo correspondiente al insumo administrado.

### 4. Gestión de eventos

Los suscriptores utilizan `EventBus` para recibir eventos del sistema.

Ambos implementan los ciclos de vida `OnModuleInit` y `OnModuleDestroy` para iniciar y cancelar sus suscripciones.

También registran los errores mediante el sistema de logging de NestJS.

## Estrategias de facturación

El servicio utiliza diferentes estrategias para calcular los importes de las consultas:

- `ConsultaRegularStrategy`: para consultas regulares.
- `ConsultaUrgenciaStrategy`: para consultas de urgencia.
- `coverageStrategyFor()`: permite determinar la distribución del importe según el tipo de cobertura.

## Criterios de implementación

- Los controladores no deben contener lógica de facturación.
- Las operaciones deben centralizarse en los servicios de Application.
- Los eventos deben procesarse mediante suscriptores.
- Los errores deben registrarse y gestionarse adecuadamente.
- Se debe evitar la generación duplicada de cargos.

## Relación con otras capas

API recibe las solicitudes HTTP y delega las operaciones a Application.

Domain proporciona las estrategias y reglas relacionadas con la facturación y las coberturas.

Infrastructure proporciona los mecanismos de persistencia utilizados por el servicio.

Los eventos permiten integrar Billing con otros módulos sin necesidad de acoplar directamente sus operaciones.

## Consideraciones

Toda nueva funcionalidad debe respetar la arquitectura modular definida en `docs/ARQUITECTURA.md`.
