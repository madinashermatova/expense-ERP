import { Language, Role } from '../../generated/prisma/enums';

/** JWT access token ichidagi ma'lumot */
export interface AccessTokenPayload {
  sub: string;
  /** PLATFORM_OWNER uchun null */
  cid: string | null;
  role: Role;
  /** DIRECTOR uchun filial doirasi */
  bid: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

/** `request.user` ga yoziladigan obyekt */
export interface AuthenticatedUser {
  id: string;
  companyId: string | null;
  role: Role;
  branchId: string | null;
  email: string;
  employeeId: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  role: Role;
  language: Language;
  companyId: string | null;
  companyName: string | null;
  employeeId: string | null;
  fullName: string | null;
  branchId: string | null;
  branchName: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

/** Bir xil login bir nechta kompaniyada topilganda qaytariladigan variant */
export interface CompanyChoice {
  slug: string;
  name: string;
}
