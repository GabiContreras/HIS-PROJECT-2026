# Nursing / Application

## Responsabilidad

Esta capa contiene los casos de uso relacionados con enfermería y la administración de medicación.

Su función es coordinar las operaciones del módulo, aplicar las reglas del dominio y comunicarse con los componentes necesarios para ejecutar cada operación.

## Estado actual

Actualmente, esta carpeta no contiene servicios, casos de uso ni otros componentes de aplicación implementados.

La funcionalidad de administración de medicación todavía está pendiente de desarrollo en esta capa.

## Implementación pendiente

Cuando se desarrolle, deberá contemplar:

- Casos de uso para registrar administraciones de medicación.
- Coordinación de las operaciones relacionadas con las indicaciones médicas.
- Validación de las condiciones necesarias antes de registrar una administración.
- Comunicación con los puertos del dominio y los adaptadores de infraestructura.
- Integración con otros módulos cuando sea necesario.

## Criterios de arquitectura

- Los casos de uso deben concentrar la coordinación de las operaciones.
- Las reglas de negocio deben permanecer en Domain.
- La persistencia debe resolverse mediante abstracciones, sin depender directamente de TypeORM.
- La capa API debe comunicarse con Application para ejecutar las operaciones.
