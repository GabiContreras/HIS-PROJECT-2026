const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
const TEST_DATABASE_PREFIX = 'his_';

export function assertLocalDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error('SEGURIDAD: falta la URL de la base de datos de prueba.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SEGURIDAD: la URL de la base de datos de prueba no es válida.');
  }
  if (!LOCAL_HOSTS.includes(parsed.hostname)) {
    throw new Error('SEGURIDAD: esta prueba escribe datos y solo puede ejecutarse contra PostgreSQL local.');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database.startsWith(TEST_DATABASE_PREFIX)) {
    throw new Error(
      `SEGURIDAD: la base de datos de prueba debe llamarse con el prefijo ${TEST_DATABASE_PREFIX} (por ejemplo his_fac10).`,
    );
  }
  return url;
}
