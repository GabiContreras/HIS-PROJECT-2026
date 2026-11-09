# EHR / Domain

## Responsabilidad

La capa Domain del módulo EHR (Historia Clínica Electrónica) estará destinada a contener las reglas de negocio, los modelos y las abstracciones propias de la gestión de la información clínica de los pacientes.

Su objetivo será representar los conceptos y comportamientos fundamentales del dominio, independientemente de los mecanismos de persistencia o comunicación externa.

## Estado actual

Actualmente, esta capa no contiene entidades de dominio, interfaces, reglas de negocio ni otras implementaciones de código. Solamente cuenta con este archivo README.

## Organización prevista

Cuando se incorporen implementaciones, esta capa podrá contener:

- Modelos y conceptos propios de la historia clínica electrónica.
- Reglas y validaciones del dominio.
- Interfaces o puertos necesarios para definir las operaciones del dominio.

## Consideraciones

- Las reglas de negocio deben permanecer dentro del dominio.
- Esta capa no debe depender de TypeORM ni de otras tecnologías de infraestructura.
- No debe contener dependencias de controladores HTTP.

## Archivos actuales

- `README.md`

**Pendiente:** implementar los modelos y las reglas de dominio correspondientes al módulo EHR.
