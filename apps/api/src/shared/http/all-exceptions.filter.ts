import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
};

/**
 * Filtro global: garantiza que TODO error salga con el mismo formato.
 * Los filtros de módulo (ej. errores de dominio de billing) tienen prioridad sobre este.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      code =
        statusCode === 400 && Array.isArray(message)
          ? 'VALIDATION_ERROR'
          : (CODE_BY_STATUS[statusCode] ?? 'HTTP_ERROR');
    } else {
      // Error inesperado: se loguea completo, pero al cliente no se le filtra el detalle.
      this.logger.error(
        `Error no controlado en ${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(statusCode).json({
      statusCode,
      code,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}