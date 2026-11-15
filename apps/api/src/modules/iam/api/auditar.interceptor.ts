import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditoriaService } from '../application/auditoria.service.js';
import { AUDITAR_KEY, type AuditarMetadata } from './auditar.decorator.js';

type AuditedRequest = Request & { user?: { accountId: string } };

@Injectable()
export class AuditarInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditarMetadata | undefined>(
      AUDITAR_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const declared = this.reflector.get<number | undefined>(
      '__httpCode__',
      context.getHandler(),
    );
    const okStatus = declared ?? (request.method === 'POST' ? 201 : 200);

    const record = (
      accion: string,
      estadoHttp: number,
      usuarioId: string | null,
    ) => {
             const rawPacienteId = metadata.pacienteParam
        ? request.params?.[metadata.pacienteParam]
        : undefined;
      const pacienteId = typeof rawPacienteId === 'string' ? rawPacienteId : null;
      const email =
        metadata.accion === 'LOGIN' && typeof request.body?.email === 'string'
          ? request.body.email.slice(0, 255)
          : null;
      void this.auditoria.registrar({
        usuarioId,
        accion,
        recurso: metadata.recurso,
        pacienteId,
        metodo: request.method,
        ruta: request.path.slice(0, 255),
        estadoHttp,
        ip: request.ip ?? null,
        detalle: email,
      });
    };

    return next.handle().pipe(
      tap({
        next: (result) => {
          const loginId = (result as { account?: { id?: string } } | undefined)
            ?.account?.id;
          record(
            metadata.accion,
            okStatus,
            request.user?.accountId ?? loginId ?? null,
          );
        },
        error: (error: unknown) => {
          const status = error instanceof HttpException ? error.getStatus() : 500;
          record(
            `${metadata.accion}_FALLIDO`,
            status,
            request.user?.accountId ?? null,
          );
        },
      }),
    );
  }
}