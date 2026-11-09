# IAM / API

## Responsabilidad

La capa API del módulo IAM (Identity and Access Management) se encarga de gestionar las solicitudes HTTP relacionadas con la autenticación, autorización y administración de cuentas de usuario.

Su función es recibir las solicitudes, validar los datos de entrada, aplicar los mecanismos de seguridad correspondientes y delegar las operaciones a los servicios de aplicación.

## 1. Autenticación

El archivo `auth.controller.ts` define el controlador asociado a la ruta `/auth`.

Implementa las siguientes operaciones:

- **POST /auth/register:** registra una nueva cuenta de usuario.
- **POST /auth/login:** autentica al usuario y devuelve un token de acceso. También establece una cookie HTTP-only para renovar la sesión.
- **POST /auth/refresh:** renueva la sesión utilizando la cookie de actualización.
- **POST /auth/logout:** revoca la sesión actual y elimina la cookie de actualización.
- **GET /auth/me:** obtiene los datos públicos de la cuenta autenticada.
- **POST /auth/forgot-password:** informa el estado del mecanismo de recuperación de contraseña.
- **POST /auth/reset-password:** permite restablecer la contraseña. El procedimiento sin verificación está disponible únicamente durante el desarrollo.
- **POST /auth/change-password:** permite cambiar la contraseña de la cuenta autenticada y revoca las demás sesiones activas.

El controlador utiliza `AuthService` y `TokenService` para delegar las operaciones correspondientes.

También controla el origen de las solicitudes de autenticación y configura la cookie de actualización según el entorno de ejecución.

## 2. Administración de usuarios

El archivo `usuarios.controller.ts` define el controlador asociado a la ruta `/usuarios`.

Permite realizar las siguientes operaciones:

- **POST /usuarios:** crear cuentas de personal.
- **POST /usuarios/administrativos:** crear cuentas administrativas.
- **GET /usuarios:** listar usuarios registrados.
- **GET /usuarios/:id:** consultar una cuenta por su identificador.
- **PATCH /usuarios/:id:** actualizar el nombre o apellido de un usuario.
- **PATCH /usuarios/:id/horario:** actualizar el horario de atención de un médico.
- **PATCH /usuarios/:id/habilitar:** habilitar una cuenta.
- **PATCH /usuarios/:id/deshabilitar:** deshabilitar una cuenta.
- **PATCH /usuarios/:id/baja:** realizar la baja lógica de una cuenta.
- **PATCH /usuarios/:id/restaurar:** restaurar una cuenta dada de baja.

Las operaciones se encuentran protegidas mediante los mecanismos de autenticación y autorización correspondientes.

## 3. Administración de cuentas

El archivo `account-admin.service.ts` contiene el servicio `AccountAdminService`.

Se encarga de coordinar las operaciones administrativas sobre las cuentas de usuario.

Entre sus responsabilidades se encuentran:

- Listar y consultar cuentas.
- Actualizar perfiles de usuarios.
- Modificar horarios médicos.
- Crear cuentas administrativas mediante `AuthService`.
- Habilitar y deshabilitar cuentas.
- Realizar bajas lógicas y restauraciones.
- Revocar sesiones activas cuando corresponde.
- Verificar permisos y restricciones antes de modificar una cuenta.

Para realizar estas operaciones utiliza repositorios de TypeORM y transacciones mediante `DataSource`.

En la baja lógica de un médico también verifica que no existan turnos futuros activos y retira los registros de espera pendientes asociados a ese médico.

## 4. Autenticación y autorización

La capa API contiene distintos componentes para controlar el acceso a las operaciones.

### AuthGuard

El archivo `auth.guard.ts` implementa `AuthGuard`.

Se encarga de:

- Verificar que la solicitud incluya un token Bearer.
- Validar el token de acceso.
- Obtener la identidad de la sesión.
- Incorporar la identidad del usuario a la solicitud.

### RolesGuard

El archivo `roles.guard.ts` implementa `RolesGuard`.

Comprueba si el usuario autenticado tiene alguno de los roles requeridos para ejecutar una operación.

### SuperadminGuard

El archivo `superadmin.guard.ts` implementa `SuperadminGuard`.

Restringe determinadas operaciones exclusivamente a usuarios con permisos de superadministrador.

### Decoradores

- **`auth.decorator.ts`:** define `CurrentIdentity`, que permite obtener la identidad del usuario autenticado.
- **`roles.decorator.ts`:** define `Roles`, que permite establecer los roles autorizados para acceder a una operación.

### Solicitud autenticada

El archivo `authenticated-request.ts` define el tipo de solicitud utilizado para trabajar con la identidad del usuario autenticado.

## 5. DTOs y validaciones

Los DTOs se encuentran dentro de la carpeta `dto/`.

Su función es definir la estructura de los datos que reciben y devuelven los endpoints, además de establecer validaciones.

Principales DTOs:

- `registro.dto.ts`: datos necesarios para registrar una cuenta.
- `login.dto.ts`: credenciales para iniciar sesión.
- `login-response.dto.ts`: respuesta del inicio de sesión.
- `account-response.dto.ts`: información pública de una cuenta.
- `create-admin.dto.ts`: datos para crear una cuenta administrativa.
- `update-user.dto.ts`: datos para actualizar el perfil de un usuario.
- `horario-medico.dto.ts`: horario de atención de un médico.
- `change-password.dto.ts`: datos para cambiar la contraseña.
- `reset-password.dto.ts`: datos para restablecer la contraseña.
- `email.dto.ts`: dirección de correo electrónico.
- `message-response.dto.ts`: respuesta general de una operación.
- `forgot-password-response.dto.ts`: respuesta del mecanismo de recuperación.
- `reset-password-response.dto.ts`: confirmación del restablecimiento.

Los DTOs utilizan decoradores de `class-validator` para controlar los datos recibidos y `@nestjs/swagger` para documentar los contratos de la API.

También utilizan `PasswordPolicyValidator` para validar las contraseñas según la política de seguridad definida por la aplicación.

## 6. Documentación y pruebas

Los controladores utilizan decoradores de NestJS Swagger para documentar las operaciones, parámetros, respuestas y posibles errores HTTP.

Esta capa cuenta con pruebas para verificar su funcionamiento:

- `auth.controller.integration.spec.ts`: pruebas de integración del controlador de autenticación.
- `account-admin.service.spec.ts`: pruebas del servicio de administración de cuentas.

## Consideraciones

- Los controladores reciben las solicitudes y delegan la lógica correspondiente a los servicios.
- Los mecanismos de autenticación y autorización protegen las operaciones según los permisos requeridos.
- Los DTOs permiten validar los datos de entrada y definir las respuestas.
- Las operaciones de administración de cuentas respetan las restricciones de roles y estados.
- La recuperación de contraseña por correo se encuentra temporalmente deshabilitada.

## Archivos de esta capa

- `account-admin.service.ts`
- `account-admin.service.spec.ts`
- `auth.controller.ts`
- `auth.controller.integration.spec.ts`
- `auth.decorator.ts`
- `auth.guard.ts`
- `authenticated-request.ts`
- `roles.decorator.ts`
- `roles.guard.ts`
- `superadmin.guard.ts`
- `usuarios.controller.ts`
- `dto/` (DTOs de entrada y salida)
