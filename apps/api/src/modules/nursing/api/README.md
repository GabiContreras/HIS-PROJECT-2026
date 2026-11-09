# Nursing / API

## Responsabilidad

Esta capa corresponde a la interfaz HTTP del módulo Nursing, relacionado con enfermería y la administración de medicación.

Su función es recibir las solicitudes externas, validar los datos de entrada y comunicar las operaciones correspondientes a la capa Application.

## Estado actual

Actualmente, esta carpeta no contiene controladores, DTOs ni endpoints implementados.

Por lo tanto, el módulo todavía no expone operaciones HTTP propias para la administración de medicación.

## Implementación pendiente

Cuando se desarrolle esta capa, deberá contemplar:

- Controladores para recibir las solicitudes relacionadas con la administración de medicación.
- DTOs para validar los datos de entrada y definir las respuestas.
- Integración con los casos de uso de la capa Application.
- Aplicación de los mecanismos de autenticación y autorización correspondientes.

## Criterios de arquitectura

- Los controladores deben limitarse a gestionar la comunicación HTTP.
- Las reglas de negocio deben permanecer fuera de esta capa.
- La persistencia debe resolverse mediante la capa Infrastructure.
- La API debe comunicarse con Application sin depender directamente de los detalles de persistencia.
