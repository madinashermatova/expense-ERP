import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation';
import { Channel } from '../../generated/prisma/enums';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser, PublicUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** TZ 4.2 — auth endpointlar uchun alohida rate limit (5 req/min) */
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const result = await this.auth.login(dto, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      channel: Channel.WEB,
    });

    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const cookieName = this.config.get('REFRESH_COOKIE_NAME', { infer: true });
    const token = (req.cookies as Record<string, string> | undefined)?.[
      cookieName
    ];

    const result = await this.auth.refresh(token ?? '', {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieName = this.config.get('REFRESH_COOKIE_NAME', { infer: true });
    const token = (req.cookies as Record<string, string> | undefined)?.[
      cookieName
    ];
    await this.auth.logout(token);
    res.clearCookie(cookieName, this.cookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.auth.me(user.id);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.config.get('REFRESH_COOKIE_NAME', { infer: true }), token, {
      ...this.cookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private cookieOptions() {
    const isProd =
      this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
