# Admissions – Application

## Responsabilidad

La capa Application coordina los casos de uso del módulo Admissions. Se encarga de organizar las operaciones relacionadas con pacientes, admisiones, agenda médica y turnos.

Actúa como intermediaria entre la capa API y el dominio, coordinando las acciones necesarias para ejecutar cada operación.

## Funciones principales

- Coordinar los casos de uso relacionados con pacientes.
- Gestionar las operaciones de creación, modificación y consulta de turnos.
- Coordinar las operaciones vinculadas con la agenda médica.
- Controlar el flujo de ejecución de las solicitudes recibidas desde API.
- Utilizar las abstracciones necesarias para acceder a los datos.

## Criterios de implementación

- Cada caso de uso debe tener una responsabilidad clara.
- No debe contener lógica relacionada con HTTP.
- No debe depender directamente de controladores.
- No debe implementar consultas de persistencia concretas.
- Las reglas de negocio deben pertenecer al dominio cuando corresponda.

## Relación con otras capas

La capa API invoca los casos de uso de Application.

Application coordina las operaciones utilizando las entidades, reglas y contratos definidos por Domain, y las implementaciones necesarias a través de las abstracciones correspondientes.

## Consideraciones

Las nuevas funcionalidades deben respetar la separación de responsabilidades establecida en `docs/ARQUITECTURA.md`.
