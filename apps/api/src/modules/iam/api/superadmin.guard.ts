import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user.esSuperadmin) return true;
    throw new ForbiddenException(
      'Esta operación está reservada al superadmin.',
    );
  }
}
