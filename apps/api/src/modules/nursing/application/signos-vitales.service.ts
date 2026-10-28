import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { VitalSignAlert } from '../../../shared/events/vital-sign-alert.event.js';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { RegistrarSignoVitalDto } from '../api/dto/registrar-signo-vital.dto.js';
import {
  TipoSignoVital,
  VITAL_SIGN_RULES,
  esValorPlausible,
  estaFueraDeRango,
  unidadDe,
} from '../domain/vital-sign-rules.js';
import {
  SIGNOS_VITALES_REPOSITORY,
  type SignoVitalData,
  type SignosVitalesRepository,
} from '../domain/ports/signos-vitales.repository.js';

export interface SignoVitalView {
  id: string;
  pacienteId: string;
  paciente: string;
  tipo: TipoSignoVital;
  valor: number;
  unidad: string;
  fechaHora: string;
  fueraDeRango: boolean;
}

const LIST_LIMIT = 100;

@Injectable()
export class SignosVitalesService {
  constructor(
    @Inject(SIGNOS_VITALES_REPOSITORY)
    private readonly repository: SignosVitalesRepository,
    private readonly pacientes: PacientesService,
    private readonly events: EventBus,
  ) {}

  tipos() {
    return Object.entries(VITAL_SIGN_RULES).map(([tipo, rule]) => ({ tipo, ...rule }));
  }

  async registrar(dto: RegistrarSignoVitalDto, identity: SessionIdentity): Promise<SignoVitalView> {
    if (!esValorPlausible(dto.tipo, dto.valor)) {
      const { minPlausible, maxPlausible, unidad } = VITAL_SIGN_RULES[dto.tipo];
      throw new BadRequestException(
        `El valor ${dto.valor} no es plausible para ${dto.tipo} (esperado entre ${minPlausible} y ${maxPlausible} ${unidad}).`,
      );
    }
    // Admisión es dueño de pacientes: se consulta por su caso de uso (404 si no existe).
    await this.pacientes.get(dto.pacienteId);

    const saved = await this.repository.create({
      pacienteId: dto.pacienteId,
      registradoPorId: identity.accountId,
      tipo: dto.tipo,
      valor: dto.valor,
    });

    const view = this.toView(saved);
    if (view.fueraDeRango) {
      this.events.publish(
        new VitalSignAlert({
          vitalSignId: saved.id,
          patientId: saved.pacienteId,
          tipo: dto.tipo,
          valor: view.valor,
          unidad: view.unidad,
          registeredBy: identity.accountId,
          registeredAt: view.fechaHora,
        }),
      );
    }
    return view;
  }

  async listar(pacienteId?: string): Promise<SignoVitalView[]> {
    const rows = await this.repository.list(pacienteId, LIST_LIMIT);
    return rows.map((row) => this.toView(row));
  }

  private toView(row: SignoVitalData): SignoVitalView {
    const tipo = row.tipo as TipoSignoVital;
    return {
      id: row.id,
      pacienteId: row.pacienteId,
      paciente: row.paciente,
      tipo,
      valor: row.valor,
      unidad: unidadDe(tipo),
      fechaHora: row.fechaHora.toISOString(),
      fueraDeRango: estaFueraDeRango(tipo, row.valor),
    };
  }
}
