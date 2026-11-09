# Application

Esta capa contiene los servicios y componentes que implementan los casos de uso relacionados con la autenticación, la administración de credenciales y la gestión de sesiones de los usuarios.

## Archivos principales

### `auth.service.ts`

Contiene `AuthService`, responsable de coordinar los procesos de autenticación y administración de sesiones.

Entre sus responsabilidades se encuentran:

- Registrar usuarios y crear cuentas administrativas.
- Validar las credenciales durante el inicio de sesión.
- Controlar los intentos fallidos y los bloqueos temporales de cuenta.
- Crear y validar sesiones.
- Renovar los refresh tokens y revocar sesiones.
- Cerrar sesión.
- Gestionar el cambio de contraseña.
- Gestionar los flujos de recuperación de contraseña, teniendo en cuenta las restricciones actuales del entorno.
- Obtener y validar la identidad asociada a una sesión.

El servicio también transforma las cuentas en información pública para evitar exponer datos internos de las entidades.

### `token.service.ts`

Contiene `TokenService`, encargado de la generación y validación de tokens.

Sus responsabilidades incluyen:

- Generar access tokens JWT firmados con HS256.
- Verificar la estructura, firma, algoritmo, claims y vencimiento de los tokens.
- Generar refresh tokens aleatorios.
- Calcular hashes de valores opacos para almacenarlos de forma segura.
- Configurar los tiempos de expiración mediante variables de entorno.

Los tiempos de vida predeterminados son de 15 minutos para el access token y 7 días para el refresh token. La configuración se realiza mediante variables de entorno.

### `password-hasher.ts`

Contiene `PasswordHasher`, responsable de proteger las contraseñas.

Utiliza el algoritmo `scrypt` para generar hashes, junto con una sal aleatoria de 16 bytes. Al verificar una contraseña, compara los valores utilizando `timingSafeEqual`.

Las contraseñas no se almacenan en texto plano.

### `password-policy.validator.ts`

Contiene `PasswordPolicyValidator`, que valida las condiciones que debe cumplir una contraseña:

- Tener al menos 8 caracteres.
- Contener al menos una letra mayúscula.
- Contener al menos un número.
- No contener números consecutivos, ya sean ascendentes o descendentes.

## Pruebas

La capa cuenta con pruebas unitarias para:

- `auth.service.spec.ts`
- `auth.development-flows.spec.ts`
- `token.service.spec.ts`
- `password-hasher.spec.ts`

Estas pruebas permiten verificar los procesos de autenticación, la gestión de tokens, el tratamiento de contraseñas y los flujos específicos del entorno de desarrollo.

## Responsabilidad de la capa

Application coordina los casos de uso de IAM y utiliza los componentes de dominio e infraestructura que necesita para ejecutarlos. No es responsable de recibir directamente las solicitudes HTTP ni de definir la persistencia de las entidades, tareas correspondientes a otras capas.
