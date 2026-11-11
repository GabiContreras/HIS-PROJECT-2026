import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../entities/usuario.entity.js';
import dataSource from '../data-source.js';
import { PasswordHasher } from '../modules/iam/application/password-hasher.js';
import { PasswordPolicyValidator } from '../modules/iam/application/password-policy.validator.js';

async function bootstrapSuperadmin(): Promise<void> {
  const nombre = process.env.SUPERADMIN_NOMBRE?.trim();
  const apellido = process.env.SUPERADMIN_APELLIDO?.trim();
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!nombre || !apellido || !email || !password) {
    throw new Error(
      'Definí SUPERADMIN_NOMBRE, SUPERADMIN_APELLIDO, SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD.',
    );
  }
  if (!new PasswordPolicyValidator().validate(password)) {
    throw new Error(
      'SUPERADMIN_PASSWORD debe cumplir la política de contraseña de IAM.',
    );
  }

  dataSource.setOptions({ migrations: [] });
  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(Usuario);
    const currentRoot = await users.findOneBy({ esSuperadmin: true });
    if (currentRoot) {
      if (currentRoot.email === email) {
        console.info(
          'El superadmin configurado ya existe; no se hicieron cambios.',
        );
        return;
      }
      throw new Error(
        'Ya existe un superadmin raíz. No se permite crear otro mediante este comando.',
      );
    }

    const hasher = new PasswordHasher();
    const user = users.create({
      nombre,
      apellido,
      email,
      passwordHash: await hasher.hash(password),
      rol: RolUsuario.ADMINISTRATIVO,
      estado: EstadoCuenta.ACTIVO,
      emailVerificado: true,
      esSuperadmin: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
    await users.save(user);
    console.info('Se creó el superadmin raíz.');
  } finally {
    await dataSource.destroy();
  }
}

await bootstrapSuperadmin();
