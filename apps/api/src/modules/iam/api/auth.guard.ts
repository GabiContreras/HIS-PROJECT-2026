import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../application/auth.service.js';
import { TokenService } from '../application/token.service.js';
import { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Se requiere un token de acceso.');
    }

    const claims = this.tokens.verifyAccessToken(authorization.slice(7));
    request.user = await this.auth.getSessionIdentity(claims);
    return true;
  }
}
