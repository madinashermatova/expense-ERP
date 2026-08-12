import * as argon2 from 'argon2';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { Language, Role } from '../../src/generated/prisma/enums';

export const TEST_PASSWORD = 'Parol123!';

export interface SeededCompany {
  companyId: string;
  slug: string;
  branchIds: string[];
  adminId: string;
  admin2Id: string;
  directorId: string;
  workerId: string;
  adminEmail: string;
  admin2Email: string;
  directorEmail: string;
  workerEmail: string;
}

let cachedHash: string | null = null;

async function hash(): Promise<string> {
  if (!cachedHash) {
    // Testlarda tezlik uchun yengilroq parametrlar — prodda PasswordService qiymatlari
    cachedHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
  }
  return cachedHash;
}

/** Testlar uchun minimal, lekin to'liq kompaniya: 2 admin, 2 filial, direktor, ishchi */
export async function seedCompany(
  prisma: PrismaService,
  slug: string,
  domain: string,
): Promise<SeededCompany> {
  const passwordHash = await hash();

  const company = await prisma.raw.company.create({
    data: { name: `${slug} MChJ`, slug, defaultLanguage: Language.UZ },
  });

  const branch1 = await prisma.raw.branch.create({
    data: { companyId: company.id, code: 'AAA', name: 'Birinchi filial' },
  });
  const branch2 = await prisma.raw.branch.create({
    data: { companyId: company.id, code: 'BBB', name: 'Ikkinchi filial' },
  });

  const mk = async (
    role: Role,
    email: string,
    branchId: string,
    fullName: string,
  ) => {
    const employee = await prisma.raw.employee.create({
      data: { companyId: company.id, fullName, branchId },
    });
    const user = await prisma.raw.user.create({
      data: {
        companyId: company.id,
        email,
        username: `${slug}_${email.split('@')[0]}`,
        passwordHash,
        role,
        employeeId: employee.id,
      },
    });
    return user.id;
  };

  const adminId = await mk(
    Role.ADMIN,
    `admin1@${domain}`,
    branch1.id,
    'Admin Bir',
  );
  const admin2Id = await mk(
    Role.ADMIN,
    `admin2@${domain}`,
    branch1.id,
    'Admin Ikki',
  );
  const directorId = await mk(
    Role.DIRECTOR,
    `director@${domain}`,
    branch1.id,
    'Direktor',
  );
  const workerId = await mk(
    Role.WORKER,
    `worker@${domain}`,
    branch1.id,
    'Ishchi',
  );

  return {
    companyId: company.id,
    slug,
    branchIds: [branch1.id, branch2.id],
    adminId,
    admin2Id,
    directorId,
    workerId,
    adminEmail: `admin1@${domain}`,
    admin2Email: `admin2@${domain}`,
    directorEmail: `director@${domain}`,
    workerEmail: `worker@${domain}`,
  };
}
