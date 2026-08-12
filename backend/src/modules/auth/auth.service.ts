import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PasswordService } from '../../common/crypto/password.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EnvironmentVariables } from '../../config/env.validation';
import { Channel, CompanyStatus, Role } from '../../generated/prisma/enums';
import { LoginDto } from './dto/login.dto';
import {
  AccessTokenPayload,
  CompanyChoice,
  LoginResult,
  PublicUser,
  RefreshTokenPayload,
} from './auth.types';

/** Login natijasi bir nechta kompaniyaga to'g'ri kelganda */
export class MultipleCompaniesException extends ConflictException {
  constructor(companies: CompanyChoice[]) {
    super({
      statusCode: HttpStatus.CONFLICT,
      code: 'MULTIPLE_COMPANIES',
      message: 'Bu login bir nechta kompaniyada mavjud — kompaniyani tanlang',
      details: { companies: companies.map((c) => `${c.slug}:${c.name}`) },
    });
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * TZ 3.1 — email yoki username + parol.
   * Xato xabari har doim bir xil: qaysi biri noto'g'ri ekani oshkor qilinmaydi.
   */
  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string; channel: Channel },
  ) {
    // companyId hali noma'lum — foydalanuvchi aynan shu qadamdan keyin aniqlanadi
    const candidates = await this.tenantContext.runUnscoped(
      "auth: login bo'yicha qidiruv",
      () =>
        this.prisma.raw.user.findMany({
          where: {
            OR: [{ email: dto.login.toLowerCase() }, { username: dto.login }],
            ...(dto.companySlug ? { company: { slug: dto.companySlug } } : {}),
          },
          include: {
            company: {
              select: { id: true, name: true, slug: true, status: true },
            },
            employee: {
              select: {
                id: true,
                fullName: true,
                branchId: true,
                status: true,
              },
            },
          },
        }),
    );

    if (candidates.length === 0) {
      throw this.invalidCredentials();
    }

    if (candidates.length > 1) {
      throw new MultipleCompaniesException(
        candidates
          .filter((u) => u.company)
          .map((u) => ({ slug: u.company!.slug, name: u.company!.name })),
      );
    }

    const user = candidates[0];

    this.assertNotLocked(user.lockedUntil);

    const ok = await this.password.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.registerFailedAttempt(user.id, user.failedLoginCount);
      throw this.invalidCredentials();
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'ACCOUNT_INACTIVE',
        message: 'Hisob faol emas — administratoringizga murojaat qiling',
      });
    }

    if (user.company && user.company.status === CompanyStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'COMPANY_SUSPENDED',
        message: "Kompaniya hisobi to'xtatilgan",
      });
    }

    // TZ 2.2 — ishchi Web ERP ga kira olmaydi (to'g'ri parol bilan ham)
    if (meta.channel === Channel.WEB && user.role === Role.WORKER) {
      await this.resetFailedAttempts(user.id);
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'WEB_ACCESS_DENIED',
        message:
          'Ishchi hisobi Web ERP ga kira olmaydi — Telegram botdan foydalaning',
      });
    }

    await this.resetFailedAttempts(user.id);

    const branchId = user.employee?.branchId ?? null;
    const tokens = await this.issueTokens(
      { id: user.id, companyId: user.companyId, role: user.role, branchId },
      meta,
    );

    /*
     * TZ 3.14 — login audit jurnaliga tushadi. Kontekst shu yerda qo'lda beriladi:
     * so'rov `@Public` bo'lgani uchun guard uni to'ldirmagan, `companyId` esa aynan
     * hozir ma'lum bo'ldi. Platforma egasida `companyId` yo'q — u yozilmaydi.
     */
    if (user.companyId) {
      await this.tenantContext.runAsync(
        {
          companyId: user.companyId,
          userId: user.id,
          role: user.role,
          branchId,
          channel: meta.channel,
          ip: meta.ip ?? null,
        },
        () =>
          this.audit.log({
            action: 'auth.login',
            entityType: 'User',
            entityId: user.id,
          }),
      );
    }

    return {
      ...tokens,
      user: this.toPublicUser(user),
    } satisfies LoginResult;
  }

  /** TZ 4.2 — refresh rotatsiyasi: eski token bekor qilinadi, yangisi beriladi */
  async refresh(rawToken: string, meta: { ip?: string; userAgent?: string }) {
    // Imzo va muddat tekshiriladi; egasi keyin bazadagi hash bo'yicha aniqlanadi
    try {
      await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw this.invalidRefresh();
    }

    const tokenHash = this.hashToken(rawToken);

    const stored = await this.tenantContext.runUnscoped(
      'auth: refresh token qidiruvi',
      () =>
        this.prisma.raw.refreshToken.findUnique({
          where: { tokenHash },
          include: {
            user: {
              include: {
                company: {
                  select: { id: true, name: true, slug: true, status: true },
                },
                employee: {
                  select: {
                    id: true,
                    fullName: true,
                    branchId: true,
                    status: true,
                  },
                },
              },
            },
          },
        }),
    );

    if (!stored) {
      throw this.invalidRefresh();
    }

    // Bekor qilingan token qayta ishlatilmoqda — o'g'irlangan bo'lishi mumkin.
    // Xavfsizlik choralari: foydalanuvchining barcha sessiyalari yopiladi.
    if (stored.revokedAt || stored.expiresAt < new Date()) {
      await this.tenantContext.runUnscoped(
        'auth: shubhali refresh — barcha sessiyani yopish',
        () =>
          this.prisma.raw.refreshToken.updateMany({
            where: { userId: stored.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
      );
      this.logger.warn(
        `Bekor qilingan refresh token ishlatildi: user=${stored.userId}`,
      );
      throw this.invalidRefresh();
    }

    const user = stored.user;
    if (!user.isActive || user.company?.status === CompanyStatus.SUSPENDED) {
      throw this.invalidRefresh();
    }

    await this.tenantContext.runUnscoped(
      'auth: eski refresh tokenni bekor qilish',
      () =>
        this.prisma.raw.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        }),
    );

    const tokens = await this.issueTokens(
      {
        id: user.id,
        companyId: user.companyId,
        role: user.role,
        branchId: user.employee?.branchId ?? null,
      },
      meta,
    );

    return { ...tokens, user: this.toPublicUser(user) } satisfies LoginResult;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await this.tenantContext.runUnscoped('auth: logout', () =>
      this.prisma.raw.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.tenantContext.runUnscoped(
      'auth: joriy foydalanuvchi',
      () =>
        this.prisma.raw.user.findUnique({
          where: { id: userId },
          include: {
            company: {
              select: { id: true, name: true, slug: true, status: true },
            },
            employee: {
              select: {
                id: true,
                fullName: true,
                branchId: true,
                status: true,
              },
            },
          },
        }),
    );
    if (!user) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
        message: 'Foydalanuvchi topilmadi',
      });
    }
    return this.toPublicUser(user);
  }

  // ── ichki yordamchilar ────────────────────────────────────────────────────

  private async issueTokens(
    user: {
      id: string;
      companyId: string | null;
      role: Role;
      branchId: string | null;
    },
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      cid: user.companyId,
      role: user.role,
      bid: user.role === Role.DIRECTOR ? user.branchId : null,
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti } satisfies RefreshTokenPayload,
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );

    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);

    await this.tenantContext.runUnscoped('auth: refresh token saqlash', () =>
      this.prisma.raw.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(refreshToken),
          expiresAt: new Date(decoded.exp * 1000),
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      }),
    );

    await this.tenantContext.runUnscoped('auth: oxirgi kirish vaqti', () =>
      this.prisma.raw.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );

    return { accessToken, refreshToken };
  }

  /** Refresh token bazada ochiq saqlanmaydi — faqat SHA-256 hash */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertNotLocked(lockedUntil: Date | null): void {
    if (!lockedUntil || lockedUntil <= new Date()) return;
    const retryAfter = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'LOGIN_LOCKED',
        message: "Juda ko'p urinish — biroz kutib qayta urinib ko'ring",
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** TZ 3.1 — 5 ta muvaffaqiyatsiz urinishdan keyin 15 daqiqa blok */
  private async registerFailedAttempt(
    userId: string,
    currentCount: number,
  ): Promise<void> {
    const maxAttempts = this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
    const lockMinutes = this.config.get('LOGIN_LOCK_MINUTES', { infer: true });
    const next = currentCount + 1;

    await this.tenantContext.runUnscoped('auth: muvaffaqiyatsiz urinish', () =>
      this.prisma.raw.user.update({
        where: { id: userId },
        data: {
          failedLoginCount: next,
          lockedUntil:
            next >= maxAttempts
              ? new Date(Date.now() + lockMinutes * 60_000)
              : null,
        },
      }),
    );
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await this.tenantContext.runUnscoped('auth: hisoblagichni tozalash', () =>
      this.prisma.raw.user.update({
        where: { id: userId },
        data: { failedLoginCount: 0, lockedUntil: null },
      }),
    );
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
      message: "Login yoki parol noto'g'ri",
    });
  }

  private invalidRefresh(): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Sessiya muddati tugagan — qayta kiring',
    });
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    username: string | null;
    role: Role;
    language: PublicUser['language'];
    companyId: string | null;
    employeeId: string | null;
    company?: { name: string } | null;
    employee?: { fullName: string; branchId: string } | null;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      language: user.language,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      employeeId: user.employeeId,
      fullName: user.employee?.fullName ?? null,
      branchId: user.employee?.branchId ?? null,
      branchName: null,
    };
  }
}
