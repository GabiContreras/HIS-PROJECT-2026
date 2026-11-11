import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la API y de la conexión a la base' })
  @ApiOkResponse({ description: 'API operativa.' })
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}