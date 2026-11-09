# Nursing / Domain

## Responsabilidad

Esta capa representa las reglas y conceptos propios del dominio de Enfermería y Administración de Medicación.

Su responsabilidad es definir las reglas que determinan cómo deben realizarse y registrarse las administraciones de medicación, manteniendo estas reglas independientes de los detalles técnicos de persistencia y comunicación.

## Conceptos principales

De acuerdo con la implementación actual del módulo, intervienen los siguientes conceptos:

- **Indicación médica:** representa la indicación que sirve como referencia para administrar una medicación.
- **Enfermero:** usuario responsable de realizar la administración.
- **Administración de medicación:** registro de una administración asociada a una indicación médica.
- **Fecha y hora de administración:** momento en que se registra la administración.
- **Observaciones:** información adicional asociada al registro.

## Estado actual

Actualmente, esta carpeta no contiene modelos de dominio, reglas de negocio, interfaces ni servicios propios.

La entidad `AdministracionMedicacion` se encuentra implementada en la capa Infrastructure mediante TypeORM.

Por lo tanto, la separación de los conceptos y reglas de negocio propios del dominio todavía está pendiente.

## Implementación pendiente

Esta capa deberá contemplar, cuando se desarrolle:

- Reglas para validar las administraciones de medicación.
- Condiciones para relacionar una administración con una indicación médica.
- Reglas relacionadas con el registro de fecha, hora y responsable.
- Validaciones propias del proceso de enfermería.
- Interfaces o contratos necesarios para desacoplar las reglas del dominio de la persistencia.

## Criterios de arquitectura

- Las reglas de negocio deben permanecer en Domain.
- El dominio no debe depender directamente de TypeORM.
- Las entidades de persistencia deben permanecer en Infrastructure.
- Application debe coordinar los casos de uso utilizando las reglas y abstracciones del dominio.
