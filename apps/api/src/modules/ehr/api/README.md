# EHR / API

## Responsabilidad

La capa API del módulo EHR (Historia Clínica Electrónica) está destinada a gestionar la comunicación entre las solicitudes externas y los casos de uso de la aplicación.

Su función será recibir las solicitudes relacionadas con la historia clínica y delegar su procesamiento a la capa Application.

## Estado actual

Actualmente, esta capa no contiene controladores, DTOs ni otras implementaciones de código. Solamente cuenta con este archivo README.

## Organización prevista

Cuando se incorporen implementaciones, esta capa podrá contener:

- Controladores para recibir las solicitudes HTTP.
- DTOs para definir y validar los datos de entrada y salida.
- Documentación de los endpoints disponibles.

## Consideraciones

- Los controladores no deben contener reglas de negocio.
- La lógica de los casos de uso corresponde a la capa Application.
- Esta capa no debe acceder directamente a los mecanismos de persistencia.

## Archivos actuales

- `README.md`

**Pendiente:** implementar los componentes de API necesarios para el módulo EHR.
