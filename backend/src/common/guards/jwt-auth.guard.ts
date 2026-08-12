import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AuthenticatedUser } from '../../modules/auth/auth.types';
import { Role } from '../../generated/prisma/enums';

/**
 * Global guard. Token tekshirilgach tenant kontekstini to'ldiradi —
 * shundan keyingina Prisma extension biznes so'rovlariga ruxsat beradi.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const result = super.handleRequest<TUser>(err, user, info, context);
    const authUser = result as AuthenticatedUser;

    this.tenantContext.patch({
      companyId: authUser.companyId,
      userId: authUser.id,
      role: authUser.role,
      branchId: authUser.role === Role.DIRECTOR ? authUser.branchId : null,
    });

    return result;
  }
}
