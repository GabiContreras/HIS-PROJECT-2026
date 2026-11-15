import { Injectable } from '@nestjs/common';
import { HistoriaClinicaService } from '../../ehr/application/historia-clinica.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { RegistrarNotaEnfermeriaDto } from '../api/dto/registrar-nota-enfermeria.dto.js';

@Injectable()
export class NotasEnfermeriaService {
  constructor(private readonly historia: HistoriaClinicaService) {}

  registrar(dto: RegistrarNotaEnfermeriaDto, identity: SessionIdentity) {
    return this.historia.registrarNotaEnfermeria(dto.pacienteId, dto.titulo, dto.detalle, identity);
  }
}
