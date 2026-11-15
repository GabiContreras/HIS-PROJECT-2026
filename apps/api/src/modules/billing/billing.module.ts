import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cargo } from '../../entities/cargo.entity.js';
import { Turno } from '../../entities/turno.entity.js';
import { CargosController } from './api/cargos.controller.js';
import { CoverageCatalogController } from './api/coverage-catalog.controller.js';
import { ReportesController } from './api/reportes.controller.js';
import { LiquidacionesController } from './api/liquidaciones.controller.js';
import { Liquidacion } from '../../entities/liquidacion.entity.js';
import { LiquidacionesService } from './application/liquidaciones.service.js';
import { AppointmentAttendedSubscriber } from './application/appointment-attended.subscriber.js';
import { BillingService } from './application/billing.service.js';
import { ReportesService } from './application/reportes.service.js';
import { ConsultaRegularStrategy } from './domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from './domain/consulta-urgencia.strategy.js';
import { IamModule } from '../iam/iam.module.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { AdministracionMedicacion } from '../../entities/administracion-medicacion.entity.js';
import { Financiador } from '../../entities/financiador.entity.js';
import { Plan } from '../../entities/plan.entity.js';
import { Prestacion } from '../../entities/prestacion.entity.js';
import { Tarifa } from '../../entities/tarifa.entity.js';
import { CoverageCatalogService } from './application/coverage-catalog.service.js';
import { MedicationAdministeredSubscriber } from './application/medication-administered.subscriber.js';
import { BedReleasedSubscriber } from './application/bed-released.subscriber.js';
import { Paciente } from '../../entities/paciente.entity.js';
import { MovimientoInventario } from '../../entities/movimiento-inventario.entity.js';
import { ResourcesModule } from '../resources/resources.module.js';
import { NomencladorService } from './application/nomenclador.service.js';
import { NOMENCLADOR_REPOSITORY } from './domain/nomenclador.repository.js';
import { TypeOrmNomencladorRepository } from './infrastructure/typeorm-nomenclador.repository.js';
import { COVERAGE_VERIFIER } from './domain/ports/coverage-verifier.port.js';
import { SimulatedCoverageVerifier } from './infrastructure/simulated-coverage-verifier.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cargo, Turno, Insumo, AdministracionMedicacion, Financiador, Plan, Prestacion, Tarifa, Paciente, MovimientoInventario, Liquidacion]), IamModule, ResourcesModule],
  controllers: [CargosController, CoverageCatalogController, ReportesController, LiquidacionesController],
  providers: [
    BillingService,
    LiquidacionesService,
    ReportesService,
    CoverageCatalogService,
    NomencladorService,
    { provide: NOMENCLADOR_REPOSITORY, useClass: TypeOrmNomencladorRepository },
    ConsultaRegularStrategy,
    ConsultaUrgenciaStrategy,
    AppointmentAttendedSubscriber,
    MedicationAdministeredSubscriber,
    BedReleasedSubscriber,
    { provide: COVERAGE_VERIFIER, useClass: SimulatedCoverageVerifier },
  ],
  exports: [BillingService, CoverageCatalogService, COVERAGE_VERIFIER],
})
export class BillingModule {}
