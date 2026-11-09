# Health / API

## Responsabilidad

La capa API del módulo Health está destinada a exponer los mecanismos de consulta del estado técnico de la aplicación.

Su función es permitir que otros servicios o herramientas puedan verificar la disponibilidad y el funcionamiento básico de la API.

## Estado actual

Actualmente, esta capa no contiene controladores, DTOs ni otras implementaciones de código. Solamente cuenta con este archivo README.

## Organización prevista

Cuando se incorporen implementaciones, esta capa podrá contener:

- Controladores para consultar el estado de la API.
- Endpoints de verificación de disponibilidad.
- Respuestas que permitan conocer el estado general del servicio.

## Consideraciones

- Esta capa debe encargarse de recibir y responder las solicitudes HTTP relacionadas con el estado de la API.
- No debe contener reglas de negocio de otros módulos.
- La lógica de verificación, si requiere coordinación con otros componentes, debe delegarse a la capa Application.

## Archivos actuales

- `README.md`

**Pendiente:** implementar los endpoints necesarios para consultar el estado técnico de la API.
