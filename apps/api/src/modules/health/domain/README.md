# Health / Domain

## Responsabilidad

La capa Domain del módulo Health está destinada a contener los conceptos, modelos y reglas propias del estado técnico de la API.

Su objetivo será definir los elementos fundamentales necesarios para representar y evaluar el estado del servicio, independientemente de los mecanismos de comunicación o infraestructura.

## Estado actual

Actualmente, esta capa no contiene entidades de dominio, interfaces, reglas de negocio ni otras implementaciones de código. Solamente cuenta con este archivo README.

## Organización prevista

Cuando se incorporen implementaciones, esta capa podrá contener:

- Modelos relacionados con el estado técnico de la API.
- Reglas para determinar las condiciones del servicio.
- Interfaces o abstracciones necesarias para definir las operaciones del dominio.

## Consideraciones

- Las reglas propias del dominio deben permanecer en esta capa.
- No debe depender de controladores HTTP.
- No debe contener dependencias de infraestructura ni de tecnologías específicas.

## Archivos actuales

- `README.md`

**Pendiente:** implementar los modelos y las reglas de dominio correspondientes al módulo Health.
