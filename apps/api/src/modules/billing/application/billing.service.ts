import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  Cargo,
} from '../../../entities/cargo.entity.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Cargo)
    private readonly cargos: Repository<Cargo>,
    private readonly consultaRegular: ConsultaRegularStrategy,
    private readonly consultaUrgencia: ConsultaUrgenciaStrategy,
  ) {}

  async createForAppointment(input: {
    appointmentId: string;
    urgente: boolean;
  }): Promise<Cargo> {
    const strategy = input.urgente
      ? this.consultaUrgencia
      : this.consultaRegular;
    try {
      return await this.cargos.save(
        this.cargos.create({
          turnoId: input.appointmentId,
          importePesos: strategy.calculateAmount(),
          tipoAtencion: strategy.tipoAtencion,
        }),
      );
    } catch (error) {
      if (!this.isDuplicateAppointmentCharge(error)) throw error;
      return this.cargos.findOneByOrFail({ turnoId: input.appointmentId });
    }
  }

  list(): Promise<Cargo[]> {
    return this.cargos.find({ order: { createdAt: 'DESC' } });
  }

  private isDuplicateAppointmentCharge(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
}
