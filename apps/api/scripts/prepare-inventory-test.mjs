
import { Client } from 'pg';

const password = process.env.PGLOCAL_PASSWORD;

if (!password) {
  throw new Error(
    'Falta PGLOCAL_PASSWORD. Configurala en la terminal antes de ejecutar este script.',
  );
}

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'his_test',
  user: 'postgres',
  password,
});

try {
  await client.connect();

  const result = await client.query(
    'SELECT current_database() AS database, current_user AS username',
  );

  if (result.rows[0].database !== 'his_test') {
    throw new Error('La conexión no apunta a his_test. Se cancela la operación.');
  }

  console.log('Conexión local confirmada:', result.rows[0]);

  
  await client.query(`
    CREATE TABLE IF NOT EXISTS insumos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(150) NOT NULL UNIQUE,
      unidad_medida VARCHAR(20) NOT NULL,
      cantidad_disponible INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT ck_insumos_cantidad_no_negativa
        CHECK (cantidad_disponible >= 0)
    )
  `);

  console.log('Tabla insumos preparada en his_test.');
  
  await client.query(
    `INSERT INTO insumos (nombre, unidad_medida, cantidad_disponible)
     VALUES ($1, $2, $3)
     ON CONFLICT (nombre)
     DO UPDATE SET cantidad_disponible = EXCLUDED.cantidad_disponible`,
    ['Insumo prueba concurrencia', 'unidad', 10],
  );

  const stockResult = await client.query(
  `SELECT id, nombre, cantidad_disponible
   FROM insumos
   WHERE nombre = $1`,
  ['Insumo prueba concurrencia'],
);

console.log('Insumo preparado:', stockResult.rows[0]);
} finally {
  await client.end();
}
