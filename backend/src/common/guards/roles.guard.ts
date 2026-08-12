import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../../generated/prisma/enums';
import { AuthenticatedUser } from '../../modules/auth/auth.types';

/**
 * TZ 2.2 — rollar matritsasi server tomonda majburlanadi.
 * `WORKER` Web ERP endpointlariga umuman kira olmaydi (TZ 3.1 qabul mezoni).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return false;

    // Ishchi Web API ga umuman kirmaydi — endpointda @Roles bo'lmasa ham
    if (user.role === Role.WORKER) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'WEB_ACCESS_DENIED',
        message: 'Ishchi hisobi Web ERP ga kira olmaydi',
      });
    }

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    if (!required.includes(user.role)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: "Bu amal uchun ruxsatingiz yo'q",
      });
    }

    return true;
  }
}
