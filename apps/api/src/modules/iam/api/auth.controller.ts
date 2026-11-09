
import {
  Body,
  ForbiddenException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '../application/auth.service.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { TokenService } from '../application/token.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { EmailDto } from './dto/email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { RegistroDto } from './dto/registro.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentIdentity } from './auth.decorator.js';
import { MessageResponseDto } from './dto/message-response.dto.js';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto.js';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto.js';
import { AccountResponseDto } from './dto/account-response.dto.js';

const REFRESH_COOKIE = 'his_refresh';

@Controller('auth')
@ApiTags('Autenticación')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar una cuenta',
    description:
      'Crea una cuenta de usuario. El registro sin verificación de correo está disponible únicamente durante el desarrollo.',
  })
  @ApiCreatedResponse({ description: 'Cuenta creada correctamente.',type: MessageResponseDto, })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiForbiddenResponse({
    description: 'El registro sin verificación está deshabilitado en producción.',
  })
  @ApiConflictResponse({ description: 'Ya existe una cuenta con ese correo.' })
  register(@Body() dto: RegistroDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica al usuario, devuelve un access token y establece una cookie HTTP-only para renovar la sesión.',
  })
  @ApiOkResponse({ description: 'Inicio de sesión correcto.',type: LoginResponseDto,})
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({
    description: 'Credenciales incorrectas o cuenta no habilitada.',
  })
  @ApiForbiddenResponse({ description: 'El origen de la solicitud no está permitido.' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const result = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, account: result.account };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renovar sesión',
    description:
      'Renueva el access token utilizando la cookie HTTP-only de actualización.',
  })
  @ApiOkResponse({ description: 'Sesión renovada correctamente.',type: LoginResponseDto, })
  @ApiUnauthorizedResponse({
    description: 'La sesión venció, fue revocada o el token no es válido.',
  })
  @ApiForbiddenResponse({ description: 'El origen de la solicitud no está permitido.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const refreshToken = this.readRefreshCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException(
        'No hay una sesión de actualización activa.',
      );
    }
    const result = await this.auth.refresh(refreshToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, account: result.account };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Revoca la sesión actual y elimina la cookie de actualización.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada correctamente.' })
  @ApiForbiddenResponse({ description: 'El origen de la solicitud no está permitido.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertTrustedOrigin(request);
    await this.auth.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar cuenta autenticada',
    description: 'Devuelve los datos públicos de la cuenta de la sesión actual.',
  })
  @ApiOkResponse({ description: 'Datos de la cuenta obtenidos correctamente.',type: AccountResponseDto, })
  @ApiUnauthorizedResponse({ description: 'La sesión no está activa.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta.' })
  me(@CurrentIdentity() identity: SessionIdentity) {
    return this.auth.publicAccount(identity.accountId);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña',
    description:
      'Informa el estado actual del mecanismo de recuperación por correo, que está temporalmente deshabilitado.',
  })
 @ApiOkResponse({description: 'Se devuelve información sobre la recuperación de contraseña.',type: ForgotPasswordResponseDto,})
   forgotPassword(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);}

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Restablecer contraseña',
    description:
      'Restablece la contraseña de una cuenta. El procedimiento sin verificación está disponible únicamente durante el desarrollo.',
  })
  @ApiOkResponse({description: 'Contraseña restablecida correctamente.',type: ResetPasswordResponseDto,})
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiForbiddenResponse({
    description: 'El restablecimiento sin verificación está deshabilitado en producción.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró una cuenta habilitada.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description:
      'Actualiza la contraseña de la cuenta autenticada y revoca las demás sesiones activas.',
  })
  @ApiOkResponse({
   description: 'Contraseña actualizada correctamente.',
   schema: {
     example: {
       message: 'La contraseña fue actualizada.',
      },
    },
  })  
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiUnauthorizedResponse({
    description: 'La sesión no está activa o la contraseña actual es incorrecta.',
  })
  changePassword(
    @CurrentIdentity() identity: SessionIdentity,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      identity,
      dto.passwordActual,
      dto.passwordNueva,
    );
  }

  private setRefreshCookie(response: Response, value: string): void {
    const maxAge = this.tokens.refreshTokenTtlSeconds;
    const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Strict';
    response.setHeader(
      'Set-Cookie',
      `${REFRESH_COOKIE}=${value}; HttpOnly; Path=/auth; SameSite=${sameSite}; Max-Age=${maxAge}${this.secureCookieAttribute()}`,
    );
  }

  private clearRefreshCookie(response: Response): void {
    const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Strict';
    response.setHeader(
      'Set-Cookie',
      `${REFRESH_COOKIE}=; HttpOnly; Path=/auth; SameSite=${sameSite}; Max-Age=0${this.secureCookieAttribute()}`,
    );
  }

  private secureCookieAttribute(): string {
    return process.env.NODE_ENV === 'production' ? '; Secure' : '';
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;
    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
    return cookie?.slice(REFRESH_COOKIE.length + 1);
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.headers.origin;
    const host = request.get('host');
    const apiOrigin = host ? `${request.protocol}://${host}` : undefined;
    const allowedOrigins = (
      process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173'
    )
      .split(',')
      .map((value) => value.trim());
    if (
      !origin ||
      (!allowedOrigins.includes(origin) && origin !== apiOrigin)
    ) {
      throw new ForbiddenException(
        'Solicitud de autenticación desde un origen no permitido.',
      );
    }
  }
}
