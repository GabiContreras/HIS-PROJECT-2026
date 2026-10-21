
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CrearPacienteDto } from './dto/crear-paciente.dto.js';
import { PacientesService } from '../application/pacientes.service.js';

@ApiTags('Pacientes')
@Controller('pacientes')
export class PacientesController {
  constructor(
    private readonly pacientesService: PacientesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un paciente' })
  @ApiCreatedResponse({
    description: 'Paciente registrado correctamente.',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un paciente con ese documento.',
  })
  crear(@Body() dto: CrearPacienteDto) {
    return this.pacientesService.create(dto);
  }
}
