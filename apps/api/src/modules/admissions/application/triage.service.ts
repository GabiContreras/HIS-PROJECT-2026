import { Injectable } from '@nestjs/common';
import { CrearTriageDto, NivelTriage } from '../api/dto/crear-triage.dto.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';

@Injectable()
export class TriageService {
  private colaTriage: Array<any> = [];

  constructor(private readonly eventBus: EventBus) {}

  registrarTriage(dto: CrearTriageDto) {
    const nuevoRegistro = {
      id: Date.now().toString(),
      ...dto,
      fechaIngreso: new Date(),
    };

    this.colaTriage.push(nuevoRegistro);
    this.ordenarColaPorPrioridad();

    return nuevoRegistro;
  }

  obtenerCola() {
    return this.colaTriage;
  }

  private ordenarColaPorPrioridad() {
    const pesos: Record<NivelTriage, number> = {
      [NivelTriage.ROJO]: 1,
      [NivelTriage.NARANJA]: 2,
      [NivelTriage.AMARILLO]: 3,
      [NivelTriage.VERDE]: 4,
      [NivelTriage.AZUL]: 5,
    };

    this.colaTriage.sort((a, b) => pesos[a.nivel as NivelTriage] - pesos[b.nivel as NivelTriage]);
  }
}