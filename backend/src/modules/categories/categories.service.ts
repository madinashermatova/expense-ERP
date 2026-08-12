import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CategoryStatus, Prisma } from '../../generated/prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  conflict,
  notFound as notFoundError,
  unprocessable,
} from '../../common/errors/app-error';

export interface CategoryView {
  id: string;
  parentId: string | null;
  nameUz: string;
  nameRu: string;
  receiptRequired: boolean;
  commentRequired: boolean;
  maxAmountPerEntry: string | null;
  status: CategoryStatus;
  sortOrder: number;
  children?: CategoryView[];
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Daraxt ko'rinishida qaytaradi (2 daraja) */
  async tree(query: ListCategoriesDto): Promise<CategoryView[]> {
    const where: Prisma.CategoryWhereInput =
      query.status === 'all'
        ? {}
        : {
            status:
              query.status === 'archived'
                ? CategoryStatus.ARCHIVED
                : CategoryStatus.ACTIVE,
          };

    const rows = await this.prisma.db.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }],
    });

    const parents = rows
      .filter((c) => c.parentId === null)
      .map((c) => this.toView(c));
    const byParent = new Map<string, CategoryView[]>();

    for (const row of rows) {
      if (!row.parentId) continue;
      const list = byParent.get(row.parentId) ?? [];
      list.push(this.toView(row));
      byParent.set(row.parentId, list);
    }

    for (const parent of parents) {
      parent.children = byParent.get(parent.id) ?? [];
    }

    return parents;
  }

  async findOne(id: string): Promise<CategoryView> {
    const category = await this.prisma.db.category.findUnique({
      where: { id },
    });
    if (!category) throw this.notFound();
    return this.toView(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryView> {
    if (dto.parentId) {
      const parent = await this.prisma.db.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw this.notFound();
      // TZ 3.4 — ierarxiya aynan ikki daraja
      if (parent.parentId !== null) {
        throw unprocessable('CATEGORY_DEPTH_EXCEEDED');
      }
    }

    const created = await this.prisma.db.category.create({
      data: {
        parentId: dto.parentId ?? null,
        nameUz: dto.nameUz,
        nameRu: dto.nameRu,
        receiptRequired: dto.receiptRequired ?? false,
        commentRequired: dto.commentRequired ?? false,
        maxAmountPerEntry: dto.maxAmountPerEntry ?? null,
        sortOrder: dto.sortOrder ?? 0,
      } as Prisma.CategoryUncheckedCreateInput,
    });

    return this.toView(created);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryView> {
    await this.ensureExists(id);

    const updated = await this.prisma.db.category.update({
      where: { id },
      data: {
        ...(dto.nameUz !== undefined ? { nameUz: dto.nameUz } : {}),
        ...(dto.nameRu !== undefined ? { nameRu: dto.nameRu } : {}),
        ...(dto.receiptRequired !== undefined
          ? { receiptRequired: dto.receiptRequired }
          : {}),
        ...(dto.commentRequired !== undefined
          ? { commentRequired: dto.commentRequired }
          : {}),
        ...(dto.maxAmountPerEntry !== undefined
          ? { maxAmountPerEntry: dto.maxAmountPerEntry }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    return this.toView(updated);
  }

  /**
   * TZ 3.4 — kategoriya o'chirilmaydi, faqat arxivlanadi.
   * Bosh kategoriya arxivlansa, ichki kategoriyalari ham arxivlanadi.
   */
  async archive(id: string): Promise<CategoryView> {
    const category = await this.ensureExists(id);

    if (category.status === CategoryStatus.ARCHIVED) {
      throw conflict('CATEGORY_ALREADY_ARCHIVED');
    }

    const updated = await this.prisma.db.$transaction(async (tx) => {
      if (category.parentId === null) {
        await tx.category.updateMany({
          where: { parentId: id },
          data: { status: CategoryStatus.ARCHIVED },
        });
      }
      return tx.category.update({
        where: { id },
        data: { status: CategoryStatus.ARCHIVED },
      });
    });

    return this.toView(updated);
  }

  async restore(id: string): Promise<CategoryView> {
    const category = await this.ensureExists(id);

    // Ichki kategoriyani tiklash uchun bosh kategoriya faol bo'lishi kerak
    if (category.parentId) {
      const parent = await this.prisma.db.category.findUnique({
        where: { id: category.parentId },
      });
      if (parent?.status === CategoryStatus.ARCHIVED) {
        throw conflict('PARENT_CATEGORY_ARCHIVED');
      }
    }

    const updated = await this.prisma.db.category.update({
      where: { id },
      data: { status: CategoryStatus.ACTIVE },
    });

    return this.toView(updated);
  }

  /**
   * TZ 3.4 qabul mezoni: ishlatilgan kategoriyani o'chirish 409 qaytaradi,
   * arxivlash esa muvaffaqiyatli. Ishlatilmagan kategoriya o'chirilishi mumkin.
   */
  async remove(id: string): Promise<void> {
    const category = await this.ensureExists(id);

    const [expenseCount, childCount] = await Promise.all([
      this.prisma.db.expense.count({ where: { categoryId: id } }),
      this.prisma.db.category.count({ where: { parentId: id } }),
    ]);

    if (expenseCount > 0) {
      throw conflict('CATEGORY_IN_USE');
    }

    if (childCount > 0) {
      throw conflict('CATEGORY_HAS_CHILDREN');
    }

    await this.prisma.db.category.delete({ where: { id: category.id } });
  }

  /** Xarajat yaratishda kategoriya qoidalarini olish uchun */
  async getRules(id: string): Promise<{
    receiptRequired: boolean;
    commentRequired: boolean;
    maxAmountPerEntry: string | null;
    status: CategoryStatus;
  }> {
    const category = await this.prisma.db.category.findUnique({
      where: { id },
    });
    if (!category) throw this.notFound();
    return {
      receiptRequired: category.receiptRequired,
      commentRequired: category.commentRequired,
      maxAmountPerEntry: category.maxAmountPerEntry?.toString() ?? null,
      status: category.status,
    };
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.db.category.findUnique({
      where: { id },
    });
    if (!category) throw this.notFound();
    return category;
  }

  private toView(category: {
    id: string;
    parentId: string | null;
    nameUz: string;
    nameRu: string;
    receiptRequired: boolean;
    commentRequired: boolean;
    maxAmountPerEntry: Prisma.Decimal | null;
    status: CategoryStatus;
    sortOrder: number;
  }): CategoryView {
    return {
      id: category.id,
      parentId: category.parentId,
      nameUz: category.nameUz,
      nameRu: category.nameRu,
      receiptRequired: category.receiptRequired,
      commentRequired: category.commentRequired,
      maxAmountPerEntry: category.maxAmountPerEntry?.toString() ?? null,
      status: category.status,
      sortOrder: category.sortOrder,
    };
  }

  private notFound(): NotFoundException {
    return notFoundError('CATEGORY_NOT_FOUND');
  }
}
