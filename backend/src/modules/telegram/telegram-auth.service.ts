import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit/audit.service';
import { PasswordService } from '../../common/crypto/password.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EnvironmentVariables } from '../../config/env.validation';
import { Channel, CompanyStatus, Role } from '../../generated/prisma/enums';
import { ActiveAccount } from './bot-types';

export interface LinkedAccount {
  linkId: string;
  userId: string;
  companyId: string;
  companyName: string;
  fullName: string;
  role: Role;
}

export type LoginOutcome =
  | { kind: 'ok'; account: ActiveAccount }
  | { kind: 'invalid' }
  | { kind: 'locked'; minutes: number }
  | { kind: 'inactive' }
  | { kind: 'suspended' }
  | { kind: 'foreignCompany'; companyName: string }
  | { kind: 'alreadyLinked'; account: ActiveAccount };

/**
 * Bot autentifikatsiyasi (TZ 3.12.1, 3.12.2, 3.16.5).
 *
 * Web login dan farqlari ataylab:
 * - **Ishchi kira oladi** — bot ishchining asosiy ish joyi (Web da 403 qaytadi).
 * - **Kompaniya bir nechta bo'lsa slug so'ralmaydi** — bot da URL parametri yo'q, shuning
 *   uchun parol har nomzodga tekshiriladi va faqat mos kelganlari qoladi. Bittadan ko'p
 *   qolsa foydalanuvchidan kompaniyani tanlash so'raladi.
 * - **Bloklash `telegramId` bo'yicha** (`TelegramLoginAttempt`), `User` bo'yicha emas:
 *   bot da hujumchi login nomlarini almashtirib urinishi mumkin, ya'ni hisoblagich
 *   hisobga emas, Telegram akkauntiga bog'lanishi kerak.
 */
@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  private get maxAttempts(): number {
    return this.config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
  }

  private get lockMinutes(): number {
    return this.config.get('LOGIN_LOCK_MINUTES', { infer: true });
  }

  private get sessionDays(): number {
    return this.config.get('TELEGRAM_SESSION_DAYS', { infer: true });
  }

  /**
   * Faol hisob konteksti. Bog'lanish bekor qilingan yoki muddati tugagan bo'lsa
   * `null` qaytadi — chaqiruvchi qayta login so'raydi (TZ: 30 kundan keyin).
   */
  async resolveActive(
    botId: string,
    telegramId: bigint,
    activeLinkId: string | null,
  ): Promise<ActiveAccount | null> {
    if (!activeLinkId) return null;

    const link = await this.tenantContext.runUnscoped(
      "telegram: faol hisob bog'lanishini o'qish",
      () =>
        this.prisma.db.telegramAccountLink.findUnique({
          where: { id: activeLinkId },
          include: {
            company: { select: { id: true, name: true, status: true } },
            user: {
              select: {
                id: true,
                role: true,
                isActive: true,
                employee: {
                  select: {
                    id: true,
                    fullName: true,
                    branchId: true,
                    branch: { select: { name: true } },
                  },
                },
              },
            },
          },
        }),
    );

    if (
      !link ||
      link.botId !== botId ||
      link.telegramId !== telegramId ||
      link.isRevoked ||
      link.expiresAt < new Date() ||
      !link.user.isActive ||
      link.company.status === CompanyStatus.SUSPENDED
    ) {
      return null;
    }

    await this.tenantContext.runUnscoped('telegram: lastUsedAt yangilash', () =>
      this.prisma.db.telegramAccountLink.update({
        where: { id: link.id },
        data: { lastUsedAt: new Date() },
      }),
    );

    return this.toAccount(link.id, link.company.id, link.company.name, {
      id: link.user.id,
      role: link.user.role,
      employee: link.user.employee,
    });
  }

  /** Login + parol (TZ 3.12.1). `restrictCompanyId` — kompaniya boti uchun */
  async login(
    params: {
      botId: string;
      telegramId: bigint;
      login: string;
      password: string;
      restrictCompanyId: string | null;
    },
    /** Bir nechta kompaniya topilib, foydalanuvchi allaqachon tanlagan bo'lsa */
    chosenUserId?: string,
  ): Promise<
    LoginOutcome | { kind: 'chooseCompany'; options: LinkedAccount[] }
  > {
    const lock = await this.checkLock(params.telegramId);
    if (lock) return lock;

    const candidates = await this.tenantContext.runUnscoped(
      "telegram: login bo'yicha qidiruv",
      () =>
        this.prisma.db.user.findMany({
          where: {
            OR: [
              { email: params.login.toLowerCase() },
              { username: params.login },
            ],
            // Platforma egasi kompaniyaga tegishli emas — bot unga xizmat qilmaydi
            companyId: { not: null },
            ...(chosenUserId ? { id: chosenUserId } : {}),
          },
          include: {
            company: { select: { id: true, name: true, status: true } },
            employee: {
              select: {
                id: true,
                fullName: true,
                branchId: true,
                branch: { select: { name: true } },
              },
            },
          },
        }),
    );

    const matched: typeof candidates = [];
    for (const candidate of candidates) {
      if (await this.password.verify(candidate.passwordHash, params.password)) {
        matched.push(candidate);
      }
    }

    if (matched.length === 0) {
      const attempt = await this.registerFailure(params.telegramId);
      return attempt ?? { kind: 'invalid' };
    }

    if (matched.length > 1) {
      // Parol to'g'ri — urinish hisoblagichi tozalanadi, foydalanuvchi kompaniyani tanlaydi
      await this.resetFailures(params.telegramId);
      return {
        kind: 'chooseCompany',
        options: matched.map((user) => ({
          linkId: '',
          userId: user.id,
          companyId: user.company!.id,
          companyName: user.company!.name,
          fullName: user.employee?.fullName ?? user.email,
          role: user.role,
        })),
      };
    }

    await this.resetFailures(params.telegramId);
    return this.finishLogin(
      matched[0],
      params.botId,
      params.telegramId,
      params.restrictCompanyId,
    );
  }

  /**
   * Kompaniya tanlangandan keyin loginni yakunlash.
   *
   * Parol shu bosqichda **qayta so'ralmaydi va saqlanmaydi** — u oldingi qadamda
   * tekshirilgan. Sessiyada faqat nomzod `userId` lari va tekshirilgan vaqt turadi;
   * chaqiruvchi o'sha vaqtning eskirmaganini tekshiradi.
   */
  async completeChosenCompany(params: {
    botId: string;
    telegramId: bigint;
    userId: string;
    restrictCompanyId: string | null;
  }): Promise<LoginOutcome> {
    const user = await this.tenantContext.runUnscoped(
      "telegram: tanlangan kompaniya hisobini o'qish",
      () =>
        this.prisma.db.user.findUnique({
          where: { id: params.userId },
          include: {
            company: { select: { id: true, name: true, status: true } },
            employee: {
              select: {
                id: true,
                fullName: true,
                branchId: true,
                branch: { select: { name: true } },
              },
            },
          },
        }),
    );

    if (!user?.company) return { kind: 'invalid' };

    return this.finishLogin(
      user,
      params.botId,
      params.telegramId,
      params.restrictCompanyId,
    );
  }

  private async finishLogin(
    user: {
      id: string;
      companyId: string | null;
      email: string;
      role: Role;
      isActive: boolean;
      company: { id: string; name: string; status: CompanyStatus } | null;
      employee: {
        id: string;
        fullName: string;
        branchId: string | null;
        branch: { name: string } | null;
      } | null;
    },
    botId: string,
    telegramId: bigint,
    restrictCompanyId: string | null,
  ): Promise<LoginOutcome> {
    /*
     * Kompaniya botida faqat o'sha kompaniya hisoblari bilan kirish mumkin (TZ 3.16.5).
     * Tekshiruv **parol tasdiqlangandan keyin**: aks holda "bu bot boshqa kompaniya uchun"
     * javobi login mavjudligini oshkor qilardi.
     */
    if (restrictCompanyId && user.companyId !== restrictCompanyId) {
      const own = await this.tenantContext.runUnscoped(
        "telegram: bot kompaniyasi nomini o'qish",
        () =>
          this.prisma.db.company.findUnique({
            where: { id: restrictCompanyId },
            select: { name: true },
          }),
      );
      return { kind: 'foreignCompany', companyName: own?.name ?? '' };
    }

    if (!user.isActive) return { kind: 'inactive' };
    if (user.company!.status === CompanyStatus.SUSPENDED) {
      return { kind: 'suspended' };
    }

    const existing = await this.tenantContext.runUnscoped(
      "telegram: mavjud bog'lanishni izlash",
      () =>
        this.prisma.db.telegramAccountLink.findUnique({
          where: {
            telegramId_userId: {
              telegramId: telegramId,
              userId: user.id,
            },
          },
        }),
    );

    const expiresAt = new Date(
      Date.now() + this.sessionDays * 24 * 60 * 60 * 1000,
    );

    const link = await this.tenantContext.runUnscoped(
      "telegram: hisob bog'lanishini yaratish",
      () =>
        this.prisma.db.telegramAccountLink.upsert({
          where: {
            telegramId_userId: {
              telegramId: telegramId,
              userId: user.id,
            },
          },
          create: {
            telegramId: telegramId,
            userId: user.id,
            companyId: user.companyId!,
            botId: botId,
            expiresAt,
          },
          update: {
            botId: botId,
            isRevoked: false,
            expiresAt,
            lastUsedAt: new Date(),
          },
        }),
    );

    const account = this.toAccount(
      link.id,
      user.company!.id,
      user.company!.name,
      user,
    );

    await this.writeAudit(account, 'auth.telegram_login');

    // Faol va amaldagi bog'lanish qayta kiritilgan — foydalanuvchiga aytiladi
    if (
      existing &&
      !existing.isRevoked &&
      existing.expiresAt > new Date() &&
      existing.botId === botId
    ) {
      return { kind: 'alreadyLinked', account };
    }

    return { kind: 'ok', account };
  }

  /** Bog'langan hisoblar ro'yxati (TZ 3.12.2) */
  async listAccounts(
    botId: string,
    telegramId: bigint,
  ): Promise<LinkedAccount[]> {
    const links = await this.tenantContext.runUnscoped(
      "telegram: bog'langan hisoblar ro'yxati",
      () =>
        this.prisma.db.telegramAccountLink.findMany({
          where: {
            telegramId,
            botId,
            isRevoked: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { linkedAt: 'asc' },
          include: {
            company: { select: { id: true, name: true } },
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                employee: { select: { fullName: true } },
              },
            },
          },
        }),
    );

    return links.map((link) => ({
      linkId: link.id,
      userId: link.user.id,
      companyId: link.company.id,
      companyName: link.company.name,
      fullName: link.user.employee?.fullName ?? link.user.email,
      role: link.user.role,
    }));
  }

  /** Parolsiz almashtirish — bog'lanish allaqachon tasdiqlangan (TZ 3.12.2) */
  async switchTo(
    botId: string,
    telegramId: bigint,
    linkId: string,
  ): Promise<ActiveAccount | null> {
    const accounts = await this.listAccounts(botId, telegramId);
    if (!accounts.some((account) => account.linkId === linkId)) return null;

    const active = await this.resolveActive(botId, telegramId, linkId);
    if (active) await this.writeAudit(active, 'auth.telegram_switch');
    return active;
  }

  /** Faol hisobdan chiqish. Qaytadi: keyingi faol bog'lanish (bo'lsa) */
  async logoutActive(
    botId: string,
    telegramId: bigint,
    linkId: string,
  ): Promise<LinkedAccount | null> {
    await this.revoke([linkId]);

    const remaining = await this.listAccounts(botId, telegramId);
    return remaining[0] ?? null;
  }

  async logoutAll(botId: string, telegramId: bigint): Promise<void> {
    const accounts = await this.listAccounts(botId, telegramId);
    await this.revoke(accounts.map((account) => account.linkId));
  }

  private async revoke(linkIds: string[]): Promise<void> {
    if (linkIds.length === 0) return;

    await this.tenantContext.runUnscoped(
      "telegram: bog'lanishni bekor qilish",
      () =>
        this.prisma.db.telegramAccountLink.updateMany({
          where: { id: { in: linkIds } },
          data: { isRevoked: true },
        }),
    );
  }

  private async checkLock(
    telegramId: bigint,
  ): Promise<{ kind: 'locked'; minutes: number } | null> {
    const attempt = await this.prisma.db.telegramLoginAttempt.findUnique({
      where: { telegramId },
    });

    if (!attempt?.lockedUntil || attempt.lockedUntil <= new Date()) return null;

    const minutes = Math.max(
      1,
      Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60_000),
    );
    return { kind: 'locked', minutes };
  }

  /** Muvaffaqiyatsiz urinish. Limitga yetganda blok qaytaradi (TZ 3.12.1) */
  private async registerFailure(
    telegramId: bigint,
  ): Promise<{ kind: 'locked'; minutes: number } | null> {
    const existing = await this.prisma.db.telegramLoginAttempt.findUnique({
      where: { telegramId },
    });

    const failedCount = (existing?.failedCount ?? 0) + 1;
    const locked = failedCount >= this.maxAttempts;
    const lockedUntil = locked
      ? new Date(Date.now() + this.lockMinutes * 60_000)
      : null;

    await this.prisma.db.telegramLoginAttempt.upsert({
      where: { telegramId },
      create: { telegramId, failedCount, lockedUntil },
      update: { failedCount, lockedUntil, lastAttemptAt: new Date() },
    });

    if (!locked) return null;

    this.logger.warn(
      `Telegram login bloklandi: telegramId=${String(telegramId)}`,
    );
    return { kind: 'locked', minutes: this.lockMinutes };
  }

  private async resetFailures(telegramId: bigint): Promise<void> {
    await this.prisma.db.telegramLoginAttempt.deleteMany({
      where: { telegramId },
    });
  }

  private async writeAudit(
    account: ActiveAccount,
    action: string,
  ): Promise<void> {
    // Kontekst qo'lda beriladi: bot so'rovida guard yo'q, companyId aynan hozir aniqlandi
    await this.tenantContext.runAsync(
      {
        companyId: account.companyId,
        userId: account.userId,
        role: account.role,
        branchId: account.branchId,
        channel: Channel.TELEGRAM,
      },
      () =>
        this.audit.log({
          action,
          entityType: 'User',
          entityId: account.userId,
        }),
    );
  }

  private toAccount(
    linkId: string,
    companyId: string,
    companyName: string,
    user: {
      id: string;
      role: Role;
      email?: string;
      employee: {
        id: string;
        fullName: string;
        branchId: string | null;
        branch: { name: string } | null;
      } | null;
    },
  ): ActiveAccount {
    return {
      linkId,
      userId: user.id,
      companyId,
      companyName,
      role: user.role,
      branchId: user.employee?.branchId ?? null,
      branchName: user.employee?.branch?.name ?? null,
      fullName: user.employee?.fullName ?? user.email ?? '',
      employeeId: user.employee?.id ?? null,
    };
  }
}
