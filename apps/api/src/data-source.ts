import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Usuario } from './entities/usuario.entity.js';
import { RefreshSession } from './entities/refresh-session.entity.js';
import { Paciente } from './entities/paciente.entity.js';
import { Turno } from './entities/turno.entity.js';
import { Cama } from './entities/cama.entity.js';
import { Insumo } from './entities/insumo.entity.js';
import { Internacion } from './entities/internacion.entity.js';
import { SignoVital } from './entities/signo-vital.entity.js';
import { IndicacionMedica } from './entities/indicacion-medica.entity.js';
import { AdministracionMedicacion } from './entities/administracion-medicacion.entity.js';
import { SnakeNamingStrategy } from './config/snake-naming.strategy.js';
import { Cargo } from './entities/cargo.entity.js';
import { EntreturnoStandby } from './entities/entreturno-standby.entity.js';
import { ProtocoloIngreso } from './entities/protocolo-ingreso.entity.js';
import { TareaProtocolo } from './entities/tarea-protocolo.entity.js';
import { RegistroClinico } from './entities/registro-clinico.entity.js';
import { NotificacionEntity } from './entities/notificacion.entity.js';
import { TriajeRegistro } from './entities/triaje.entity.js';
import { OutboxEvent } from './entities/outbox-event.entity.js';

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
    ProtocoloIngreso,
    TareaProtocolo,
    RegistroClinico,
    NotificacionEntity,
    TriajeRegistro,
    OutboxEvent,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  ssl: process.env.DATABASE_SSL === 'false'
  ? false
  : { rejectUnauthorized: false },
});
