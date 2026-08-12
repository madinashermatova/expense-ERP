import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

/** Endpointga faqat sanab o'tilgan rollarni qo'yadi (TZ 2.2) */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
