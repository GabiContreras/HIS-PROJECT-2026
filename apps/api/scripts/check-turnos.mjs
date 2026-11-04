import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});
await client.connect();

const cols = await client.query(
  `select column_name, data_type from information_schema.columns
   where table_name = 'turnos' order by ordinal_position`,
);
console.log('--- columnas de turnos ---');
console.table(cols.rows);

const migs = await client.query('select id, timestamp, name from migrations order by id').catch(
  (e) => ({ rows: [{ error: e.message }] }),
);
console.log('--- migraciones aplicadas ---');
console.table(migs.rows);

await client.end();