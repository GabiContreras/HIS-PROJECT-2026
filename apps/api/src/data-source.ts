import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Usuario } from './modules/iam/infrastructure/persistence/entities/usuario.entity.js';
import { RefreshSession } from './modules/iam/infrastructure/persistence/entities/refresh-session.entity.js';
import { Paciente } from './modules/admissions/infrastructure/persistence/entities/paciente.entity.js';
import { Turno } from './modules/admissions/infrastructure/persistence/entities/turno.entity.js';
import { EntreturnoStandby } from './modules/admissions/infrastructure/persistence/entities/entreturno-standby.entity.js';
import { Cama } from './modules/resources/infrastructure/persistence/entities/cama.entity.js';
import { Insumo } from './modules/resources/infrastructure/persistence/entities/insumo.entity.js';
import { Internacion } from './modules/resources/infrastructure/persistence/entities/internacion.entity.js';
import { SignoVital } from './modules/ehr/infrastructure/persistence/entities/signo-vital.entity.js';
import { IndicacionMedica } from './modules/ehr/infrastructure/persistence/entities/indicacion-medica.entity.js';
import { AdministracionMedicacion } from './modules/nursing/infrastructure/persistence/entities/administracion-medicacion.entity.js';
import { Cargo } from './modules/billing/infrastructure/persistence/entities/cargo.entity.js';
import { SnakeNamingStrategy } from './config/snake-naming.strategy.js';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [
    Usuario,
    RefreshSession,
    Paciente,
    Turno,
    Cama,
    Insumo,
    SignoVital,
    IndicacionMedica,
    AdministracionMedicacion,
    Cargo,
    Internacion,
    EntreturnoStandby,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  ssl: process.env.DATABASE_SSL === 'false'
  ? false
  : { rejectUnauthorized: false },
});
