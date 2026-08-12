import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { BranchStatus, Prisma, Role } from '../../generated/prisma/client';
import { PlanLimitService } from '../plans/plan-limit.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchesDto } from './dto/list-branches.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

export interface BranchView {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  openedAt: Date | null;
  status: BranchStatus;
  employeeCount: number;
  directorCount: number;
  /** TZ 3.2 — har bir filialda kamida bitta direktor bo'lishi kerak */
  hasNoDirector: boolean;
  createdAt: Date;
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimit: PlanLimitService,
    private readonly branchScope: BranchScopeService,
  ) {}

  async list(query: ListBranchesDto): Promise<Paginated<BranchView>> {
    const { skip, take, page, limit } = toSkipTake(query);

    const where: Prisma.BranchWhereInput = {
      ...(query.status === 'all'
        ? {}
        : {
            status:
              query.status === 'archived'
                ? BranchStatus.ARCHIVED
                : BranchStatus.ACTIVE,
          }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q.toUpperCase() } },
            ],
          }
        : {}),
      // Direktor faqat o'z filialini ko'radi
      ...(this.branchScope.ownBranchId
        ? { id: this.branchScope.ownBranchId }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.db.branch.findMany({
        where,
        skip,
        take,
        orderBy:
          query.sort === 'name' ? { name: query.order } : { code: 'asc' },
        include: { _count: { select: { employees: true } } },
      }),
      this.prisma.db.branch.count({ where }),
    ]);

    const directorCounts = await this.directorCounts(rows.map((b) => b.id));

    return paginate(
      rows.map((b) =>
        this.toView(b, b._count.employees, directorCounts.get(b.id) ?? 0),
      ),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<BranchView> {
    const branch = await this.prisma.db.branch.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });

    if (!branch) throw this.notFound();
    this.branchScope.assertCanAccess(branch.id);

    const directors = await this.directorCounts([branch.id]);
    return this.toView(
      branch,
      branch._count.employees,
      directors.get(branch.id) ?? 0,
    );
  }

  async create(dto: CreateBranchDto): Promise<BranchView> {
    await this.planLimit.assertCanCreateBranch();

    const existing = await this.prisma.db.branch.findFirst({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'BRANCH_CODE_TAKEN',
        message: `"${dto.code}" kodi allaqachon band`,
        details: { code: ['band'] },
      });
    }

    const branch = await this.prisma.db.branch.create({
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        openedAt: dto.openedAt ? new Date(dto.openedAt) : null,
      } as Prisma.BranchUncheckedCreateInput,
    });

    return this.toView(branch, 0, 0);
  }

  async update(id: string, dto: UpdateBranchDto): Promise<BranchView> {
    await this.ensureExists(id);

    const branch = await this.prisma.db.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.openedAt !== undefined
          ? { openedAt: new Date(dto.openedAt) }
          : {}),
      },
      include: { _count: { select: { employees: true } } },
    });

    const directors = await this.directorCounts([branch.id]);
    return this.toView(
      branch,
      branch._count.employees,
      directors.get(branch.id) ?? 0,
    );
  }

  /** TZ 3.2 — fizik o'chirish yo'q, faqat arxivlash; tarixiy ma'lumot saqlanadi */
  async archive(id: string): Promise<BranchView> {
    const branch = await this.ensureExists(id);

    if (branch.status === BranchStatus.ARCHIVED) {
      throw new ConflictException({
        statusCode: 409,
        code: 'BRANCH_ALREADY_ARCHIVED',
        message: 'Filial allaqachon arxivlangan',
      });
    }

    const updated = await this.prisma.db.branch.update({
      where: { id },
      data: { status: BranchStatus.ARCHIVED },
      include: { _count: { select: { employees: true } } },
    });

    const directors = await this.directorCounts([id]);
    return this.toView(
      updated,
      updated._count.employees,
      directors.get(id) ?? 0,
    );
  }

  async restore(id: string): Promise<BranchView> {
    await this.ensureExists(id);
    await this.planLimit.assertCanCreateBranch();

    const updated = await this.prisma.db.branch.update({
      where: { id },
      data: { status: BranchStatus.ACTIVE },
      include: { _count: { select: { employees: true } } },
    });

    const directors = await this.directorCounts([id]);
    return this.toView(
      updated,
      updated._count.employees,
      directors.get(id) ?? 0,
    );
  }

  /** Xarajat yaratishda ishlatiladi: arxivlangan filialga yozib bo'lmaydi (TZ 3.2) */
  async assertActive(branchId: string): Promise<void> {
    const branch = await this.prisma.db.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw this.notFound();
    if (branch.status === BranchStatus.ARCHIVED) {
      throw new ConflictException({
        statusCode: 422,
        code: 'BRANCH_ARCHIVED',
        message: "Arxivlangan filialga yangi yozuv kiritib bo'lmaydi",
      });
    }
  }

  private async ensureExists(id: string) {
    const branch = await this.prisma.db.branch.findUnique({ where: { id } });
    if (!branch) throw this.notFound();
    this.branchScope.assertCanAccess(branch.id);
    return branch;
  }

  private async directorCounts(
    branchIds: string[],
  ): Promise<Map<string, number>> {
    if (branchIds.length === 0) return new Map();

    const grouped = await this.prisma.db.employee.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: branchIds },
        user: { role: Role.DIRECTOR, isActive: true },
      },
      _count: { _all: true },
    });

    return new Map(grouped.map((g) => [g.branchId, g._count._all]));
  }

  private toView(
    branch: {
      id: string;
      code: string;
      name: string;
      address: string | null;
      phone: string | null;
      openedAt: Date | null;
      status: BranchStatus;
      createdAt: Date;
    },
    employeeCount: number,
    directorCount: number,
  ): BranchView {
    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      openedAt: branch.openedAt,
      status: branch.status,
      employeeCount,
      directorCount,
      hasNoDirector:
        directorCount === 0 && branch.status === BranchStatus.ACTIVE,
      createdAt: branch.createdAt,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'BRANCH_NOT_FOUND',
      message: 'Filial topilmadi',
    });
  }
}
