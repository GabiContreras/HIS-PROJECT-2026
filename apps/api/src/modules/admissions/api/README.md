# Admissions – API

## Responsabilidad

La capa API del módulo Admissions es el punto de entrada para las operaciones relacionadas con la admisión de pacientes, la gestión de pacientes, la agenda médica y los turnos.

Su función es recibir las solicitudes HTTP, validar los datos de entrada y delegar la ejecución de las operaciones a la capa Application.

## Funciones principales

- Recibir solicitudes relacionadas con pacientes.
- Gestionar las operaciones de turnos y agenda médica.
- Exponer los endpoints correspondientes al módulo.
- Validar los datos recibidos antes de enviarlos a los casos de uso.
- Devolver respuestas HTTP al cliente.

## Criterios de implementación

- Los controladores deben ser responsables de la comunicación HTTP.
- La lógica de negocio debe permanecer en Application o Domain, según corresponda.
- No deben realizar consultas directas a la base de datos.
- No deben depender directamente de implementaciones de infraestructura.
- Las validaciones de entrada no deben reemplazar las reglas de negocio del dominio.

## Relación con otras capas

La capa API recibe las solicitudes y utiliza los servicios o casos de uso definidos en Application.

Application coordina las operaciones y utiliza las abstracciones necesarias del dominio y de infraestructura.

## Consideraciones

Toda nueva funcionalidad relacionada con admisiones debe respetar la separación de responsabilidades definida en `docs/ARQUITECTURA.md`.
