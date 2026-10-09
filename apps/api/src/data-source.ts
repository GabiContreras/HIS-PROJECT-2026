import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Usuario } from './entities/usuario.entity.js';
import { Paciente } from './entities/paciente.entity.js';
import { Turno } from './entities/turno.entity.js';
import { Cama } from './entities/cama.entity.js';
import { Insumo } from './entities/insumo.entity.js';
import { SignoVital } from './entities/signo-vital.entity.js';
import { IndicacionMedica } from './entities/indicacion-medica.entity.js';
import { AdministracionMedicacion } from './entities/administracion-medicacion.entity.js';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    Usuario,
    Paciente,
    Turno,
    Cama,
    Insumo,
    SignoVital,
    IndicacionMedica,
    AdministracionMedicacion,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
});
