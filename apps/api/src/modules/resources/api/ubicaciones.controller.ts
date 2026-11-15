import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { Roles } from '../../iam/api/roles.decorator.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { CamasService } from '../application/camas.service.js';
import { CrearHabitacionDto } from './dto/crear-habitacion.dto.js';
import { CrearSectorDto } from './dto/crear-sector.dto.js';
import { ListarHabitacionesDto } from './dto/listar-habitaciones.dto.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@ApiTags('Ubicación de camas')
@ApiBearerAuth()
export class UbicacionesController {
  constructor(private readonly camas: CamasService) {}

  @Get('sectores')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Listar sectores activos' })
  listarSectores() {
    return this.camas.listarSectores();
  }

  @Post('sectores')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Crear un sector' })
  crearSector(@Body() dto: CrearSectorDto) {
    return this.camas.crearSector(dto);
  }

  @Get('habitaciones')
  @Roles(RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Listar habitaciones activas por sector' })
  listarHabitaciones(@Query() filtro: ListarHabitacionesDto) {
    return this.camas.listarHabitaciones(filtro.sectorId);
  }

  @Post('habitaciones')
  @Roles(RolUsuario.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Crear habitación con capacidad y sector' })
  crearHabitacion(@Body() dto: CrearHabitacionDto) {
    return this.camas.crearHabitacion(dto);
  }
}
