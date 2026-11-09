# EHR / Application

## Responsabilidad

La capa Application del módulo EHR (Historia Clínica Electrónica) estará destinada a coordinar los casos de uso relacionados con la gestión de la información clínica de los pacientes.

Su función será organizar la ejecución de las operaciones solicitadas por la capa API y coordinar la comunicación con el dominio y los puertos necesarios.

## Estado actual

Actualmente, esta capa no contiene servicios, casos de uso ni otras implementaciones de código. Solamente cuenta con este archivo README.

## Organización prevista

Cuando se incorporen implementaciones, esta capa podrá contener:

- Casos de uso relacionados con la historia clínica electrónica.
- Servicios de aplicación para coordinar las operaciones.
- Interfaces o puertos necesarios para comunicarse con otras capas.

## Consideraciones

- La capa Application debe coordinar los casos de uso, sin concentrar las reglas propias del dominio.
- No debe depender directamente de controladores HTTP.
- El acceso a mecanismos de persistencia debe realizarse mediante abstracciones.

## Archivos actuales

- `README.md`

**Pendiente:** implementar los casos de uso y servicios necesarios para el módulo EHR.
