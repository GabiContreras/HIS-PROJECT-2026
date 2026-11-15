import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cama } from '../../entities/cama.entity.js';
import { Habitacion } from '../../entities/habitacion.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { Internacion } from '../../entities/internacion.entity.js';
import { MovimientoInventario } from '../../entities/movimiento-inventario.entity.js';
import { Paciente } from '../../entities/paciente.entity.js';
import { Sector } from '../../entities/sector.entity.js';
import { Usuario } from '../../entities/usuario.entity.js';
import { EventBus } from '../../shared/events/event-bus.service.js';
import { OutboxService } from '../../shared/events/outbox/outbox.service.js';
import { NotificacionesService } from '../admissions/application/notificaciones.service.js';
import { AdmissionsModule } from '../admissions/admissions.module.js';
import { AuthGuard } from '../iam/api/auth.guard.js';
import { RolesGuard } from '../iam/api/roles.guard.js';
import { LowStockNotificationSubscriber } from './application/low-stock-notification.subscriber.js';
import { MedicationAdministeredSubscriber } from './application/medication-administered.subscriber.js';
import { InventoryService } from './infrastructure/inventory.service.js';
import { ResourcesModule } from './resources.module.js';

describe('ResourcesModule', () => {
  it('importa el módulo que exporta NotificacionesService y registra el suscriptor de stock bajo', () => {
    expect(Reflect.getMetadata('imports', ResourcesModule)).toContain(AdmissionsModule);
    expect(Reflect.getMetadata('exports', AdmissionsModule)).toContain(NotificacionesService);
    expect(Reflect.getMetadata('providers', ResourcesModule)).toContain(LowStockNotificationSubscriber);
  });

  it('resuelve el servicio de inventario y el suscriptor de stock bajo con sus dependencias', async () => {
    const repo = { manager: {} };
    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        LowStockNotificationSubscriber,
        MedicationAdministeredSubscriber,
        EventBus,
        { provide: OutboxService, useValue: { registerConsumer: () => undefined, unregisterConsumer: () => undefined } },
        { provide: NotificacionesService, useValue: { notificarPorRol: () => undefined } },
        ...[Cama, Insumo, Internacion, MovimientoInventario, Paciente, Usuario, Sector, Habitacion].map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: repo,
        })),
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({})
      .overrideGuard(RolesGuard)
      .useValue({})
      .compile();

    expect(module.get(InventoryService)).toBeInstanceOf(InventoryService);
    expect(module.get(LowStockNotificationSubscriber)).toBeInstanceOf(LowStockNotificationSubscriber);
    await module.close();
  });
});
