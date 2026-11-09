# IAM / Domain

## Responsabilidad

Esta capa representa las reglas y conceptos propios del dominio de Identidad y Acceso (IAM).

Su responsabilidad es definir los conceptos relacionados con la identidad de los usuarios, los roles y los permisos, manteniendo estas reglas independientes de NestJS, TypeORM y otros detalles de infraestructura.

## Alcance del dominio

De acuerdo con el diseño general del HIS, IAM debe contemplar:

- **Identidad:** representación del usuario dentro del sistema.
- **Roles:** clasificación de los tipos de usuarios y sus responsabilidades.
- **Permisos:** reglas que determinan qué acciones puede realizar cada usuario.
- **Autorización:** criterios para permitir o rechazar operaciones según la identidad y el rol.

IAM es un área transversal: sus mecanismos de identidad y autorización deben ser utilizados por los demás módulos del sistema.

## Estado actual

Actualmente, esta carpeta no contiene clases, entidades de dominio, reglas de negocio ni interfaces propias.

La autenticación y la gestión de cuentas se encuentran implementadas principalmente en la capa Application, mientras que las entidades de persistencia se ubican en Infrastructure.

Por lo tanto, los conceptos y reglas propios del dominio todavía están pendientes de una separación e implementación específica en esta capa.

## Criterio de arquitectura

Las reglas del dominio deben mantenerse independientes de los detalles técnicos de autenticación, persistencia y transporte HTTP.

La verificación de identidad y la autorización por rol deben ser aplicadas desde la API, utilizando los mecanismos correspondientes del módulo IAM.
