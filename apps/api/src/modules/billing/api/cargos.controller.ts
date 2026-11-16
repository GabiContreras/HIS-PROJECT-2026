import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Readable } from 'node:stream';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { BillingService } from '../application/billing.service.js';
import { nombreArchivoCargos } from '../domain/csv-cargos.js';
import { LIMITE_POR_DEFECTO, OFFSET_POR_DEFECTO } from '../domain/filtro-cargos.js';
import { CargoEstadoDto } from './dto/cargo-estado.dto.js';
import { CargosPaginaDto } from './dto/cargos-pagina.dto.js';
import { CargosFiltroQueryDto, CargosListadoQueryDto } from './dto/cargos-query.dto.js';

const FILTROS_INVALIDOS =
  'limit fuera de 1 a 100, offset negativo o no entero, estado o tipoAtencion desconocidos, pacienteId que no es un UUID, fechas que no tienen el formato YYYY-MM-DD o no existen, o desde posterior a hasta.';

@Controller('billing/cargos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRATIVO)
@ApiTags('Billing')
@ApiBearerAuth()
export class CargosController {
  constructor(private readonly billing: BillingService) { }

  @Get()
  @ApiOperation({
    summary: 'Listar cargos de facturación',
    description:
      'Devuelve una página de cargos, del más reciente al más antiguo, con total de cargos que cumplen los filtros. Los filtros son opcionales y se combinan (AND). Disponible para usuarios administrativos.',
  })
  @ApiOkResponse({
    type: CargosPaginaDto,
    description: 'Página de cargos obtenida correctamente.',
  })
  @ApiBadRequestResponse({ description: FILTROS_INVALIDOS })
  @ApiUnauthorizedResponse({
    description: 'El usuario no está autenticado.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos para consultar los cargos.',
  })
  list(@Query() query: CargosListadoQueryDto) {
    const { limit, offset, ...filtros } = query;
    return this.billing.list(filtros, limit ?? LIMITE_POR_DEFECTO, offset ?? OFFSET_POR_DEFECTO);
  }

  @Get('exportar')
  @ApiOperation({
    summary: 'Exportar cargos a CSV',
    description:
      'Exporta todos los cargos que cumplen los filtros (sin paginar) como CSV UTF-8 con BOM, separado por comas y con fin de línea CRLF. Los textos que empiezan con =, +, -, @ o tabulación se prefijan con una comilla simple para evitar la inyección de fórmulas en planillas.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Archivo CSV con las columnas id, fecha, tipoAtencion, estado, concepto, importePesos, pacientePesos, terceroPesos, cobertura, paciente y medico.',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  @ApiBadRequestResponse({ description: FILTROS_INVALIDOS })
  @ApiUnauthorizedResponse({
    description: 'El usuario no está autenticado.',
  })
  @ApiForbiddenResponse({
    description: 'Solo el rol ADMINISTRATIVO puede exportar los cargos.',
  })
  exportar(@Query() query: CargosFiltroQueryDto): StreamableFile {
    const csv = this.billing.exportarCsv(query);
    return new StreamableFile(Readable.from(csv, { objectMode: false }), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${nombreArchivoCargos(new Date())}"`,
    });
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Reporte: cargos agrupados por tipo de cobertura' })
  @ApiOkResponse({ description: 'Totales por cobertura.' })
  resumen() {
    return this.billing.resumen();
  }

  @Patch(':id/pagar')
  @ApiOperation({
    summary: 'Marcar un cargo como pagado',
    description: 'Permitido desde los estados PENDIENTE y FACTURADO.',
  })
  @ApiOkResponse({ type: CargoEstadoDto })
  @ApiNotFoundResponse({ description: 'El cargo no existe.' })
  @ApiConflictResponse({
    description: 'El cargo ya está pagado o anulado.',
  })
  async pagar(@Param('id', ParseUUIDPipe) id: string): Promise<CargoEstadoDto> {
    const { estado } = await this.billing.pagar(id);
    return { id, estado };
  }

  @Patch(':id/anular')
  @ApiOperation({
    summary: 'Anular un cargo',
    description: 'Permitido desde los estados PENDIENTE y FACTURADO.',
  })
  @ApiOkResponse({ type: CargoEstadoDto })
  @ApiNotFoundResponse({ description: 'El cargo no existe.' })
  @ApiConflictResponse({
    description: 'El cargo ya está pagado o anulado, o ya está incluido en una liquidación.',
  })
  async anular(@Param('id', ParseUUIDPipe) id: string): Promise<CargoEstadoDto> {
    const { estado } = await this.billing.anular(id);
    return { id, estado };
  }
}
