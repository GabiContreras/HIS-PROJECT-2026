import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { VitalSignAlert } from '../../../shared/events/vital-sign-alert.event.js';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { RegistrarControlSignosVitalesDto } from '../api/dto/registrar-control-signos-vitales.dto.js';
import type { RegistrarSignoVitalDto } from '../api/dto/registrar-signo-vital.dto.js';
import {
  CAMPOS_CONTROL,
  TEMPERATURA_CRITICA_C,
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
  registradoPor: string;
  fueraDeRango: boolean;
}

export interface ControlSignosVitalesView {
  /** Identificador del control (agrupa las cuatro mediciones). */
  id: string;
  pacienteId: string;
  paciente: string;
  sistolica: number;
  diastolica: number;
  frecuenciaCardiaca: number;
  temperatura: number;
  fechaHora: string;
  registradoPor: string;
  /** Temperatura mayor a 39 °C (HU 1.1): se destaca en rojo y se alerta al médico. */
  critico: boolean;
  /** Etiquetas de los valores fuera de su rango normal. */
  fueraDeRango: string[];
  /** Nota de enfermería automática del control. */
  nota: string;
}

const NOTA_CONTROL_EXITOSO = 'Controles de signos vitales realizados con éxito.';
const LIST_LIMIT = 100;
/** Cada control guarda una medición por campo. */
const LECTURAS_POR_CONTROL = Object.keys(CAMPOS_CONTROL).length;

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

  /** HU 1.1: guarda presión, frecuencia cardíaca y temperatura como un solo control, todo o nada. */
  async registrarControl(dto: RegistrarControlSignosVitalesDto, identity: SessionIdentity): Promise<ControlSignosVitalesView> {
    const lecturas = (Object.entries(CAMPOS_CONTROL) as [keyof typeof CAMPOS_CONTROL, TipoSignoVital][]).map(
      ([campo, tipo]) => ({ tipo, valor: dto[campo] }),
    );
    const implausibles = lecturas
      .filter(({ tipo, valor }) => !esValorPlausible(tipo, valor))
      .map(({ tipo, valor }) => {
        const { etiqueta, minPlausible, maxPlausible, unidad } = VITAL_SIGN_RULES[tipo];
        return `${etiqueta}: ${valor} no es plausible (esperado entre ${minPlausible} y ${maxPlausible} ${unidad}).`;
      });
    if (implausibles.length > 0) throw new BadRequestException(implausibles);
    await this.pacientes.get(dto.pacienteId);

    const rows = await this.repository.createControl({
      pacienteId: dto.pacienteId,
      registradoPorId: identity.accountId,
      lecturas,
    });

    // Las alertas se publican recién cuando el control quedó guardado completo.
    for (const row of rows) {
      const view = this.toView(row);
      if (!view.fueraDeRango) continue;
      this.events.publish(
        new VitalSignAlert({
          vitalSignId: row.id,
          patientId: row.pacienteId,
          tipo: view.tipo,
          valor: view.valor,
          unidad: view.unidad,
          registeredBy: identity.accountId,
          registeredAt: view.fechaHora,
        }),
      );
    }
    return this.toControlView(rows)!;
  }

  async listarControles(pacienteId?: string): Promise<ControlSignosVitalesView[]> {
    const rows = await this.repository.listControles(pacienteId, LIST_LIMIT * LECTURAS_POR_CONTROL);
    const porControl = new Map<string, SignoVitalData[]>();
    for (const row of rows) {
      const group = porControl.get(row.controlId!) ?? [];
      group.push(row);
      porControl.set(row.controlId!, group);
    }
    return [...porControl.values()]
      .map((group) => this.toControlView(group))
      .filter((view): view is ControlSignosVitalesView => view !== null)
      .slice(0, LIST_LIMIT);
  }

  private toControlView(rows: SignoVitalData[]): ControlSignosVitalesView | null {
    const valor = (tipo: TipoSignoVital) => rows.find((row) => row.tipo === tipo)?.valor;
    const sistolica = valor(CAMPOS_CONTROL.sistolica);
    const diastolica = valor(CAMPOS_CONTROL.diastolica);
    const frecuenciaCardiaca = valor(CAMPOS_CONTROL.frecuenciaCardiaca);
    const temperatura = valor(CAMPOS_CONTROL.temperatura);
    if (sistolica === undefined || diastolica === undefined || frecuenciaCardiaca === undefined || temperatura === undefined) {
      return null;
    }
    const first = rows[0]!;
    const fueraDeRango = rows
      .filter((row) => estaFueraDeRango(row.tipo as TipoSignoVital, row.valor))
      .map((row) => VITAL_SIGN_RULES[row.tipo as TipoSignoVital].etiqueta);
    return {
      id: first.controlId!,
      pacienteId: first.pacienteId,
      paciente: first.paciente,
      sistolica,
      diastolica,
      frecuenciaCardiaca,
      temperatura,
      fechaHora: first.fechaHora.toISOString(),
      registradoPor: first.registradoPor,
      critico: temperatura > TEMPERATURA_CRITICA_C,
      fueraDeRango,
      nota: fueraDeRango.length === 0 ? NOTA_CONTROL_EXITOSO : `Valores fuera de rango: ${fueraDeRango.join(', ')}.`,
    };
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
      registradoPor: row.registradoPor,
      fueraDeRango: estaFueraDeRango(tipo, row.valor),
    };
  }
}
