import { Injectable, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../../common/crypto/password.service';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import {
  BranchStatus,
  EmployeeStatus,
  Language,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { PlanLimitService } from '../plans/plan-limit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  conflict,
  forbidden,
  notFound as notFoundError,
  unprocessable,
} from '../../common/errors/app-error';

export interface EmployeeView {
  id: string;
  fullName: string;
  position: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  phone: string | null;
  hiredAt: Date | null;
  status: EmployeeStatus;
  language: Language;
  botBlocked: boolean;
  userId: string | null;
  email: string | null;
  username: string | null;
  role: Role | null;
  isActive: boolean;
  telegramLinkCount: number;
  createdAt: Date;
}

/** Parol faqat yaratilganda/tiklanganda bir marta qaytariladi (TZ 3.3) */
export interface EmployeeWithPassword {
  employee: EmployeeView;
  tempPassword: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly planLimit: PlanLimitService,
    private readonly branchScope: BranchScopeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(query: ListEmployeesDto): Promise<Paginated<EmployeeView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const branchId = this.branchScope.resolveListFilter(query.branchId);

    const where: Prisma.EmployeeWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { user: { role: query.role } } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.db.employee.findMany({
        where,
        skip,
        take,
        orderBy:
          query.sort === 'createdAt'
            ? { createdAt: query.order }
            : { fullName: 'asc' },
        include: this.include(),
      }),
      this.prisma.db.employee.count({ where }),
    ]);

    return paginate(
      rows.map((r) => this.toView(r)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<EmployeeView> {
    const employee = await this.prisma.db.employee.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!employee) throw this.notFound();
    this.branchScope.assertCanAccess(employee.branchId);
    return this.toView(employee);
  }

  /**
   * TZ 3.3 — har bir xodimga `User` hisobi yaratiladi (WORKER ham),
   * boshlang'ich parol bir marta qaytariladi.
   */
  async create(dto: CreateEmployeeDto): Promise<EmployeeWithPassword> {
    this.assertCanAssignRole(dto.role);
    this.branchScope.assertCanWrite(dto.branchId);
    await this.planLimit.assertCanCreateEmployee();

    const branch = await this.prisma.db.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) {
      throw unprocessable('BRANCH_NOT_FOUND', {
        details: { branchId: ['topilmadi'] },
      });
    }
    if (branch.status === BranchStatus.ARCHIVED) {
      throw unprocessable('BRANCH_ARCHIVED');
    }

    await this.assertPhoneFree(dto.phone);
    await this.assertLoginFree(dto.email.toLowerCase(), dto.username);

    const plain = dto.password ?? this.password.generateTemporary();
    const passwordHash = await this.password.hash(plain);

    const created = await this.prisma.db.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          fullName: dto.fullName,
          position: dto.position ?? null,
          branchId: dto.branchId,
          phone: dto.phone ?? null,
          hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : null,
          language: dto.language ?? Language.UZ,
        } as Prisma.EmployeeUncheckedCreateInput,
      });

      await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          username: dto.username ?? null,
          passwordHash,
          role: dto.role,
          employeeId: employee.id,
          language: dto.language ?? Language.UZ,
        },
      });

      return tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: this.include(),
      });
    });

    return { employee: this.toView(created), tempPassword: plain };
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeView> {
    const employee = await this.ensureExists(id);
    this.branchScope.assertCanWrite(employee.branchId);

    if (dto.phone !== undefined) {
      await this.assertPhoneFree(dto.phone, id);
    }

    const updated = await this.prisma.db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.hiredAt !== undefined
            ? { hiredAt: new Date(dto.hiredAt) }
            : {}),
          ...(dto.language !== undefined ? { language: dto.language } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      // Xodim nofaol qilinsa, hisobi ham bloklanadi (TZ 3.3)
      const nextActive =
        dto.isActive ??
        (dto.status !== undefined
          ? dto.status === EmployeeStatus.ACTIVE
          : undefined);

      if (nextActive !== undefined) {
        await tx.user.updateMany({
          where: { employeeId: id },
          data: { isActive: nextActive },
        });
      }

      return tx.employee.findUniqueOrThrow({
        where: { id },
        include: this.include(),
      });
    });

    // Nofaol xodim botga kira olmaydi — bog'lanishlar bekor qilinadi.
    // Tranzaksiyadan tashqarida: bu alohida, qaytarilishi shart bo'lmagan amal.
    const deactivated =
      dto.isActive === false ||
      (dto.status !== undefined && dto.status === EmployeeStatus.INACTIVE);
    if (deactivated) {
      await this.revokeTelegramLinks(id);
    }

    return this.toView(updated);
  }

  /**
   * TZ 3.3 — parol qayta tiklanganda xodimning barcha Telegram bog'lanishlari bekor qilinadi.
   */
  async resetPassword(id: string): Promise<{ tempPassword: string }> {
    const employee = await this.ensureExists(id);
    this.branchScope.assertCanWrite(employee.branchId);

    const user = await this.prisma.db.user.findFirst({
      where: { employeeId: id },
    });
    if (!user) {
      throw notFoundError('USER_NOT_FOUND');
    }

    // Direktor faqat WORKER parolini tiklay oladi
    this.assertCanAssignRole(user.role);

    const plain = this.password.generateTemporary();
    const passwordHash = await this.password.hash(plain);

    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });

    // Amaldagi barcha web sessiyalar yopiladi
    await this.tenantContext.runUnscoped(
      'employees: parol tiklandi, sessiyalarni yopish',
      () =>
        this.prisma.raw.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
    );

    await this.revokeTelegramLinks(id);

    return { tempPassword: plain };
  }

  /** TZ 3.3 — ko'chirish tarixi saqlanadi, eski xarajatlar eski filialda qoladi */
  async transfer(id: string, dto: TransferEmployeeDto): Promise<EmployeeView> {
    const employee = await this.ensureExists(id);

    if (employee.branchId === dto.toBranchId) {
      throw conflict('SAME_BRANCH');
    }

    const target = await this.prisma.db.branch.findUnique({
      where: { id: dto.toBranchId },
    });
    if (!target) {
      throw unprocessable('BRANCH_NOT_FOUND', {
        details: { toBranchId: ['topilmadi'] },
      });
    }
    if (target.status === BranchStatus.ARCHIVED) {
      throw unprocessable('BRANCH_ARCHIVED');
    }

    const userId = this.tenantContext.userId;
    if (!userId) {
      throw forbidden('FORBIDDEN');
    }

    const updated = await this.prisma.db.$transaction(async (tx) => {
      await tx.employeeTransfer.create({
        data: {
          employeeId: id,
          fromBranchId: employee.branchId,
          toBranchId: dto.toBranchId,
          movedByUserId: userId,
        } as Prisma.EmployeeTransferUncheckedCreateInput,
      });

      await tx.employee.update({
        where: { id },
        data: { branchId: dto.toBranchId },
      });

      return tx.employee.findUniqueOrThrow({
        where: { id },
        include: this.include(),
      });
    });

    return this.toView(updated);
  }

  async transferHistory(id: string) {
    await this.ensureExists(id);
    return this.prisma.db.employeeTransfer.findMany({
      where: { employeeId: id },
      orderBy: { movedAt: 'desc' },
      include: {
        fromBranch: { select: { code: true, name: true } },
        toBranch: { select: { code: true, name: true } },
        movedBy: { select: { email: true } },
      },
    });
  }

  // ── ichki yordamchilar ────────────────────────────────────────────────────

  /** TZ 3.3 — direktor faqat o'z filialiga va faqat WORKER roli bilan xodim qo'shadi */
  private assertCanAssignRole(role: Role): void {
    if (!this.branchScope.isDirector) return;
    if (role !== Role.WORKER) {
      throw forbidden('ROLE_FORBIDDEN');
    }
  }

  private async assertPhoneFree(
    phone: string | undefined,
    exceptId?: string,
  ): Promise<void> {
    if (!phone) return;
    const existing = await this.prisma.db.employee.findFirst({
      where: { phone, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (existing) {
      throw conflict('PHONE_TAKEN', { details: { phone: ['band'] } });
    }
  }

  private async assertLoginFree(
    email: string,
    username?: string,
  ): Promise<void> {
    const existing = await this.prisma.db.user.findFirst({
      where: { OR: [{ email }, ...(username ? [{ username }] : [])] },
    });
    if (existing) {
      throw conflict('LOGIN_TAKEN', {
        details:
          existing.email === email
            ? { email: ['band'] }
            : { username: ['band'] },
      });
    }
  }

  private async revokeTelegramLinks(employeeId: string): Promise<void> {
    const user = await this.prisma.db.user.findFirst({ where: { employeeId } });
    if (!user) return;

    // TelegramAccountLink tenant extension ostida — companyId bor
    await this.prisma.db.telegramAccountLink.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  private async ensureExists(id: string) {
    const employee = await this.prisma.db.employee.findUnique({
      where: { id },
    });
    if (!employee) throw this.notFound();
    this.branchScope.assertCanAccess(employee.branchId);
    return employee;
  }

  private include() {
    return {
      branch: { select: { id: true, code: true, name: true } },
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          _count: { select: { telegramLinks: true } },
        },
      },
    } satisfies Prisma.EmployeeInclude;
  }

  private toView(employee: {
    id: string;
    fullName: string;
    position: string | null;
    branchId: string;
    phone: string | null;
    hiredAt: Date | null;
    status: EmployeeStatus;
    language: Language;
    botBlocked: boolean;
    createdAt: Date;
    branch: { code: string; name: string };
    user: {
      id: string;
      email: string;
      username: string | null;
      role: Role;
      isActive: boolean;
      _count: { telegramLinks: number };
    } | null;
  }): EmployeeView {
    return {
      id: employee.id,
      fullName: employee.fullName,
      position: employee.position,
      branchId: employee.branchId,
      branchName: employee.branch.name,
      branchCode: employee.branch.code,
      phone: employee.phone,
      hiredAt: employee.hiredAt,
      status: employee.status,
      language: employee.language,
      botBlocked: employee.botBlocked,
      userId: employee.user?.id ?? null,
      email: employee.user?.email ?? null,
      username: employee.user?.username ?? null,
      role: employee.user?.role ?? null,
      isActive: employee.user?.isActive ?? false,
      telegramLinkCount: employee.user?._count.telegramLinks ?? 0,
      createdAt: employee.createdAt,
    };
  }

  private notFound(): NotFoundException {
    return notFoundError('EMPLOYEE_NOT_FOUND');
  }
}
