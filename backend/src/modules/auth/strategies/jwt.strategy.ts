import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvironmentVariables } from '../../../config/env.validation';
import { AccessTokenPayload, AuthenticatedUser } from '../auth.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { CompanyStatus } from '../../../generated/prisma/enums';
import { toAppLanguage } from '../../../common/i18n/languages';
import { unauthorized } from '../../../common/errors/app-error';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Token yaroqli bo'lsa ham foydalanuvchi holati har so'rovda tekshiriladi:
   * bloklangan xodim yoki to'xtatilgan kompaniya darhol kirish huquqini yo'qotadi.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.tenantContext.runUnscoped(
      'auth: token egasini tekshirish',
      () =>
        this.prisma.raw.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            role: true,
            companyId: true,
            employeeId: true,
            isActive: true,
            language: true,
            employee: { select: { branchId: true, status: true } },
            company: { select: { status: true } },
          },
        }),
    );

    if (!user || !user.isActive) {
      throw unauthorized('UNAUTHORIZED');
    }

    if (user.company && user.company.status === CompanyStatus.SUSPENDED) {
      throw unauthorized('COMPANY_SUSPENDED');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      branchId: user.employee?.branchId ?? null,
      email: user.email,
      employeeId: user.employeeId,
      language: toAppLanguage(user.language),
    };
  }
}
