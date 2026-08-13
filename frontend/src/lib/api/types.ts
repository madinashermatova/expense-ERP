// Mirror of backend *View interfaces

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface SummaryReport {
  totalUzs: string;
  pendingDirectorCount: number;
  pendingAdminCount: number;
  // Other fields can be added if needed
}

export interface GroupedRow {
  groupId: string;
  groupName: string;
  totalUzs: string;
  count: number;
  // Other fields can be added if needed
}

export interface BranchView {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  openedAt: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  employeeCount: number;
  directorCount: number;
}

export interface EmployeeView {
  id: string;
  fullName: string;
  position: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  phone: string | null;
  hiredAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  language: 'uz' | 'ru';
  role: 'DIRECTOR' | 'ACCOUNTANT' | 'ADMIN' | 'PLATFORM_OWNER' | 'EMPLOYEE';
  isActive: boolean;
  botBlocked: boolean;
  email: string;
}

export interface CategoryView {
  id: string;
  parentId: string | null;
  nameUz: string;
  nameRu: string;
  name: string; // Used in frontend
  receiptRequired: boolean;
  commentRequired: boolean;
  maxAmountPerEntry: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  sortOrder: number;
  children?: CategoryView[];
}

export interface BudgetView {
  id: string;
  scope: 'BRANCH' | 'CATEGORY' | 'GLOBAL';
  scopeId: string;
  scopeName: string | null;
  amount: string;
  amountLimit: string; // Used in frontend
  actualAmount: string; // Used in frontend
  scopeType: string;
  currency: 'UZS' | 'USD';
  effectiveFrom: string;
  effectiveTo: string | null;
  period: string; // Used in frontend
  createdAt: string;
}

export interface BudgetUsageView extends BudgetView {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  spent: string;
  remaining: string;
  usedPercent: number;
}

export interface RateView {
  id: string;
  date: string;
  currency: 'UZS' | 'USD';
  rate: string;
  source: 'CBU' | 'MANUAL';
  createdAt: string;
}

export interface ExpenseShareView {
  employeeId: string;
  employeeName: string;
  amount: string;
  amountUzs: string;
}

export interface ExpenseView {
  id: string;
  globalNumber: string;
  branchNumber: string;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  category: { id: string; name: string }; // from Row
  amount: string;
  currency: 'UZS' | 'USD';
  rateUsed: string;
  status: string;
  date: string;
  employees: { id: string; fullName: string }[];
  paymentMethod: string;
  hasReceipt: boolean;
  version: number;
}

export interface BulkApproveResult {
  approved: string[];
  failed: { id: string; code: string; message: string }[];
}

export interface EditRequestView {
  id: string;
  expenseId: string;
  expenseGlobalNumber: string;
  expenseBranchNumber: string;
  requestedByEmployeeId: string;
  requestedBy: string;
  description: string;
  status: string;
  handledByUserId: string | null;
  handledAt: string | null;
}

export interface RefundView {
  id: string;
  expenseId: string;
  expenseGlobalNumber: string;
  expenseBranchNumber: string;
  branchId: string;
  amount: string;
  currency: 'UZS' | 'USD';
  rateUsed: string;
  amountUzs: string;
  reason: string;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  payload: unknown;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface AuditChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface AuditEntryView {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userRole: 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER' | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: AuditChange[] | null;
  ip: string | null;
  channel: 'WEB' | 'TELEGRAM' | 'SYSTEM';
}

export interface AuditFacets {
  actions: string[];
  entityTypes: string[];
}

export interface ExportJobView {
  id: string;
  type: string;
  format: string;
  status: string;
  filters: any;
  rowCount: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
}
