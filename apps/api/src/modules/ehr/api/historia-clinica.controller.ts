import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { CurrentIdentity } from '../../iam/api/auth.decorator.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { HistoriaClinicaService } from '../application/historia-clinica.service.js';
import { EstudiosService, MAX_ESTUDIO_ADJUNTO_BYTES } from '../application/estudios.service.js';
import type { ArchivoEstudio } from '../application/estudios.service.js';
import {
  RegistrarAlergiaDto,
  RegistrarAntecedenteFamiliarDto,
  RegistrarEstudioDto,
  RegistrarEvolucionDto,
  RectificarRegistroDto,
} from './dto/registros-clinicos.dto.js';
import { CrearEstudioDto } from './dto/crear-estudio.dto.js';

@Controller('historia-clinica')
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('HCE - Historia clínica')
@ApiBearerAuth()
export class HistoriaClinicaController {
  constructor(
    private readonly historia: HistoriaClinicaService,
    private readonly estudios: EstudiosService,
  ) {}

  @Get(':pacienteId')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO)
  @ApiOperation({
    summary: 'Historia clínica del paciente: ficha demográfica, alergias, antecedentes familiares, evoluciones y estudios',
    description: 'Cada sección viene ordenada del registro más nuevo al más viejo.',
  })
  @ApiResponse({ status: 400, description: 'pacienteId inválido' })
  @ApiResponse({ status: 403, description: 'Solo médicos y enfermeros' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  get(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.historia.obtener(pacienteId);
  }

  @Get(':pacienteId/timeline')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO)
  @ApiOperation({ summary: 'Línea de tiempo clínica unificada del paciente' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  timeline(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.historia.timeline(pacienteId);
  }

  @Get(':pacienteId/alergias')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO)
  @ApiOperation({ summary: 'Alergias registradas del paciente para validación al prescribir' })
  alergias(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.historia.alergias(pacienteId);
  }

  @Post(':pacienteId/registros/:regId/rectificar')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({
    summary: 'Rectificar un registro clínico inmutable mediante una nueva entrada vinculada',
    description: 'No modifica ni elimina el original; se registra una rectificación auditable.',
  })
  @ApiResponse({ status: 404, description: 'Paciente o registro inexistente' })
  @ApiResponse({ status: 409, description: 'El registro ya fue rectificado' })
  rectificar(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('regId', ParseUUIDPipe) registroId: string,
    @Body() dto: RectificarRegistroDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.rectificar(pacienteId, registroId, dto.motivo, identity);
  }

  @Get(':pacienteId/estudios')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO)
  @ApiOperation({ summary: 'Estudios del paciente con informe y metadatos del adjunto' })
  listarEstudios(@Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.estudios.listar(pacienteId);
  }

  @Post(':pacienteId/estudios/adjuntos')
  @Roles(RolUsuario.MEDICO)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_ESTUDIO_ADJUNTO_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tipo', 'informe', 'archivo'],
      properties: {
        tipo: { type: 'string', maxLength: 120 },
        informe: { type: 'string', maxLength: 4000 },
        estado: { type: 'string', enum: ['SOLICITADO', 'REALIZADO', 'INFORMADO'] },
        fecha: { type: 'string', format: 'date-time' },
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Registrar un estudio y almacenar su adjunto PDF/PNG/JPEG de forma privada' })
  crearEstudio(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: CrearEstudioDto,
    @UploadedFile() archivo: ArchivoEstudio,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.estudios.crear(pacienteId, dto, archivo, identity);
  }

  @Get('estudios/:id/adjunto')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO)
  @ApiOperation({ summary: 'Descargar el adjunto de un estudio con autenticación' })
  async descargarEstudio(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const archivo = await this.estudios.obtenerAdjunto(id);
    response.setHeader('Content-Type', archivo.mediaType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`);
    return new StreamableFile(archivo.buffer);
  }

  @Post(':pacienteId/alergias')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra una alergia del paciente (inmutable)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  alergia(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarAlergiaDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarAlergia(pacienteId, dto.sustancia, dto.reaccion, identity);
  }

  @Post(':pacienteId/antecedentes-familiares')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra un antecedente familiar del paciente (inmutable)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  antecedente(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarAntecedenteFamiliarDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarAntecedenteFamiliar(pacienteId, dto.parentesco, dto.descripcion, identity);
  }

  @Post(':pacienteId/evoluciones')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra una evolución médica (inmutable, con autor y fecha del servidor)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  evolucion(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarEvolucionDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarEvolucion(
      pacienteId,
      dto.nota,
      identity,
      dto.turnoId,
      dto.internacionId,
    );
  }

  @Post(':pacienteId/estudios')
  @Roles(RolUsuario.MEDICO)
  @ApiOperation({ summary: 'El médico registra el resultado de un estudio para visualizarlo en la historia (inmutable)' })
  @ApiResponse({ status: 400, description: 'Validación' })
  @ApiResponse({ status: 403, description: 'Solo médicos' })
  @ApiResponse({ status: 404, description: 'Paciente inexistente' })
  estudio(
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dto: RegistrarEstudioDto,
    @CurrentIdentity() identity: SessionIdentity,
  ) {
    return this.historia.registrarEstudio(pacienteId, dto.tipo, dto.resultado, identity);
  }
}
