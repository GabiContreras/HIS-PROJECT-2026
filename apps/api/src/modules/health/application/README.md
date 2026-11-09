# Health / Application

## Responsabilidad

La capa Application del módulo Health está destinada a coordinar los casos de uso relacionados con la consulta del estado técnico de la API.

Su función será organizar las operaciones necesarias para obtener información sobre la disponibilidad y el funcionamiento del servicio.

## Estado actual

Actualmente, esta capa no contiene servicios, casos de uso ni otras implementaciones de código. Solamente cuenta con este archivo README.

## Organización prevista

Cuando se incorporen implementaciones, esta capa podrá contener:

- Casos de uso para consultar el estado de la API.
- Servicios de aplicación para coordinar las verificaciones.
- Interfaces necesarias para comunicarse con otros componentes.

## Consideraciones

- Esta capa debe coordinar los casos de uso sin concentrar responsabilidades propias de infraestructura.
- No debe depender directamente de controladores HTTP.
- La lógica de acceso a recursos externos debe realizarse mediante abstracciones.

## Archivos actuales

- `README.md`

**Pendiente:** implementar los casos de uso necesarios para consultar el estado técnico de la API.
