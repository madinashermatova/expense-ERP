import {
  Branch,
  Employee,
  Category,
  Expense,
  Refund,
  EditRequest,
  Budget,
  CurrencyRate,
  AuditLog,
  ExportJob,
  NotificationItem,
  initialBranches,
  initialEmployees,
  initialCategories,
  initialExpenses,
  initialRefunds,
  initialEditRequests,
  initialBudgets,
  initialCurrencyRates,
  initialAuditLogs,
  initialExportJobs,
  initialNotifications
} from './data';

const STORAGE_KEYS = {
  BRANCHES: 'erp_mock_branches',
  EMPLOYEES: 'erp_mock_employees',
  CATEGORIES: 'erp_mock_categories',
  EXPENSES: 'erp_mock_expenses',
  REFUNDS: 'erp_mock_refunds',
  EDIT_REQUESTS: 'erp_mock_edit_requests',
  BUDGETS: 'erp_mock_budgets',
  CURRENCY_RATES: 'erp_mock_currency_rates',
  AUDIT_LOGS: 'erp_mock_audit_logs',
  EXPORT_JOBS: 'erp_mock_export_jobs',
  NOTIFICATIONS: 'erp_mock_notifications',
  SETTINGS: 'erp_mock_settings'
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Storage save error:', err);
  }
}

export class MockService {
  // Branches
  static getBranches(status?: string): Branch[] {
    const branches = getStored<Branch[]>(STORAGE_KEYS.BRANCHES, initialBranches);
    if (status && status !== 'all') {
      return branches.filter(b => b.status === status);
    }
    return branches;
  }

  static createBranch(data: Partial<Branch>): Branch {
    const branches = this.getBranches('all');
    const newBranch: Branch = {
      id: 'b' + (branches.length + 1),
      code: (data.code || 'BR').toUpperCase(),
      name: data.name || 'Yangi filial',
      address: data.address,
      phone: data.phone,
      openedAt: data.openedAt || new Date().toISOString().split('T')[0],
      status: 'active',
      employeeCount: 0,
      monthlySpend: 0,
      monthlyLimit: 20000000
    };
    branches.unshift(newBranch);
    setStored(STORAGE_KEYS.BRANCHES, branches);

    this.addAuditLog({
      entityType: 'BRANCH',
      entityId: newBranch.id,
      action: 'CREATE',
      newValue: newBranch
    });

    return newBranch;
  }

  static updateBranch(id: string, data: Partial<Branch>): Branch {
    const branches = this.getBranches('all');
    const index = branches.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Branch not found');
    const old = { ...branches[index] };
    branches[index] = { ...branches[index], ...data, code: branches[index].code }; // code immutable
    setStored(STORAGE_KEYS.BRANCHES, branches);

    this.addAuditLog({
      entityType: 'BRANCH',
      entityId: id,
      action: 'UPDATE',
      oldValue: old,
      newValue: branches[index]
    });

    return branches[index];
  }

  static archiveBranch(id: string): Branch {
    return this.updateBranch(id, { status: 'archived' });
  }

  // Employees
  static getEmployees(branchId?: string, status?: string, q?: string): Employee[] {
    let employees = getStored<Employee[]>(STORAGE_KEYS.EMPLOYEES, initialEmployees);
    if (branchId) {
      employees = employees.filter(e => e.branchId === branchId);
    }
    if (status) {
      employees = employees.filter(e => e.status === status);
    }
    if (q) {
      const search = q.toLowerCase();
      employees = employees.filter(e => 
        e.fullName.toLowerCase().includes(search) || 
        e.email.toLowerCase().includes(search) || 
        (e.username && e.username.toLowerCase().includes(search))
      );
    }
    return employees;
  }

  static createEmployee(data: Partial<Employee>): { employee: Employee; tempPassword: string } {
    const employees = this.getEmployees();
    const branches = this.getBranches('all');
    const branch = branches.find(b => b.id === data.branchId);
    
    // Generate temp password (e.g. TempPass#2026)
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `Pass#${randomDigits}`;

    const newEmp: Employee = {
      id: 'u' + (employees.length + 1),
      fullName: data.fullName || 'Yangi xodim',
      position: data.position || 'Mutaxassis',
      branchId: data.branchId || 'b1',
      branchName: branch?.name || 'Bosh ofis',
      phone: data.phone || '+998901112233',
      hiredAt: data.hiredAt || new Date().toISOString().split('T')[0],
      role: data.role || 'WORKER',
      email: data.email || `employee${employees.length + 1}@erp.uz`,
      username: data.username || `emp_${employees.length + 1}`,
      status: 'active',
      telegramUsername: data.telegramUsername || `@user_${employees.length + 1}`,
      totalExpenses: 0,
      currentMonthExpenses: 0,
      refundedAmount: 0
    };

    employees.unshift(newEmp);
    setStored(STORAGE_KEYS.EMPLOYEES, employees);

    this.addAuditLog({
      entityType: 'EMPLOYEE',
      entityId: newEmp.id,
      action: 'CREATE',
      newValue: { ...newEmp, tempPassword }
    });

    return { employee: newEmp, tempPassword };
  }

  static resetEmployeePassword(id: string): { tempPassword: string } {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `Reset#${randomDigits}`;

    this.addAuditLog({
      entityType: 'EMPLOYEE',
      entityId: id,
      action: 'UPDATE',
      newValue: { passwordReset: true }
    });

    return { tempPassword };
  }

  // Categories
  static getCategories(): Category[] {
    return getStored<Category[]>(STORAGE_KEYS.CATEGORIES, initialCategories);
  }

  static createCategory(data: Partial<Category>): Category {
    const categories = this.getCategories();
    const newCat: Category = {
      id: 'c' + (categories.length + 1),
      nameUz: data.nameUz || 'Yangi kategoriya',
      nameRu: data.nameRu || 'Новая категория',
      receiptRequired: !!data.receiptRequired,
      commentRequired: !!data.commentRequired,
      maxAmountPerEntry: data.maxAmountPerEntry || 10000000,
      status: 'active',
      orderIndex: categories.length + 1,
      children: []
    };

    if (data.parentId) {
      const parent = categories.find(c => c.id === data.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(newCat);
      }
    } else {
      categories.push(newCat);
    }

    setStored(STORAGE_KEYS.CATEGORIES, categories);
    return newCat;
  }

  // Expenses
  static getExpenses(params: {
    page?: number;
    limit?: number;
    branchId?: string;
    categoryId?: string;
    employeeId?: string;
    status?: string | string[];
    minAmount?: number;
    maxAmount?: number;
    paymentMethod?: string;
    currency?: string;
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  } = {}): { items: Expense[]; total: number; page: number; limit: number; totalPages: number } {
    let items = getStored<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);

    if (params.branchId) {
      items = items.filter(e => e.branchId === params.branchId);
    }
    if (params.categoryId) {
      items = items.filter(e => e.categoryId === params.categoryId || e.categoryId.startsWith(params.categoryId + '_'));
    }
    if (params.employeeId) {
      items = items.filter(e => e.shares.some(s => s.employeeId === params.employeeId) || e.createdById === params.employeeId);
    }
    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      if (statuses.length > 0 && statuses[0] !== 'ALL' && statuses[0] !== '') {
        items = items.filter(e => statuses.includes(e.status));
      }
    }
    if (params.paymentMethod) {
      items = items.filter(e => e.paymentMethod === params.paymentMethod);
    }
    if (params.currency) {
      items = items.filter(e => e.currency === params.currency);
    }
    if (params.minAmount) {
      items = items.filter(e => parseFloat(e.amount) >= (params.minAmount || 0));
    }
    if (params.maxAmount) {
      items = items.filter(e => parseFloat(e.amount) <= (params.maxAmount || Infinity));
    }
    if (params.from) {
      items = items.filter(e => e.date >= (params.from || ''));
    }
    if (params.to) {
      items = items.filter(e => e.date <= (params.to || ''));
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(e => 
        e.globalNumber.toLowerCase().includes(q) || 
        e.branchNumber.toLowerCase().includes(q) || 
        (e.description && e.description.toLowerCase().includes(q)) ||
        e.categoryName.toLowerCase().includes(q) ||
        e.createdByName.toLowerCase().includes(q)
      );
    }

    // Sort
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = items.length;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages
    };
  }

  static getExpenseById(id: string): Expense | undefined {
    const expenses = getStored<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
    return expenses.find(e => e.id === id);
  }

  static createExpense(data: Partial<Expense> & { currentUserId?: string; currentUserName?: string }): Expense {
    const expenses = getStored<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
    const branches = this.getBranches('all');
    const categories = this.getCategories();
    const branch = branches.find(b => b.id === data.branchId) || branches[0];
    
    // Find category name
    let catName = 'Boshqa';
    for (const c of categories) {
      if (c.id === data.categoryId) { catName = c.nameUz; break; }
      if (c.children) {
        const sub = c.children.find(s => s.id === data.categoryId);
        if (sub) { catName = sub.nameUz; break; }
      }
    }

    const nextId = expenses.length + 101;
    const globalNum = `EXP-000${nextId}`;
    const branchNum = `${branch.code}-2026-00${nextId % 100}`;

    const newExpense: Expense = {
      id: 'exp-' + nextId,
      globalNumber: globalNum,
      branchNumber: branchNum,
      date: data.date || new Date().toISOString().split('T')[0],
      branchId: data.branchId || branch.id,
      branchName: branch.name,
      categoryId: data.categoryId || 'c1',
      categoryName: catName,
      createdById: data.currentUserId || 'u1',
      createdByName: data.currentUserName || 'Foydalanuvchi',
      amount: data.amount ? parseFloat(data.amount).toFixed(2) : '0.00',
      currency: (data.currency as any) || 'UZS',
      amountUzs: data.amount ? parseFloat(data.amount).toFixed(2) : '0.00',
      paymentMethod: (data.paymentMethod as any) || 'CARD',
      status: 'DIRECTOR_PENDING',
      description: data.description,
      hasReceipt: !!(data.files && data.files.length > 0),
      isOverLimit: false,
      shares: data.shares || [],
      files: data.files || [],
      statusHistory: [
        {
          id: 'h-' + Date.now(),
          status: 'DIRECTOR_PENDING',
          changedBy: data.currentUserId || 'u1',
          changedByName: data.currentUserName || 'Foydalanuvchi',
          timestamp: new Date().toLocaleString('uz-UZ')
        }
      ],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    expenses.unshift(newExpense);
    setStored(STORAGE_KEYS.EXPENSES, expenses);

    this.addAuditLog({
      entityType: 'EXPENSE',
      entityId: newExpense.id,
      action: 'CREATE',
      newValue: newExpense
    });

    this.addNotification({
      title: 'Yangi xarajat kiritildi',
      message: `${newExpense.createdByName} tomonidan ${newExpense.globalNumber} raqamli (${newExpense.amount} so'm) xarajat tasdiqqa yuborildi.`,
      type: 'INFO',
      link: '/approvals'
    });

    return newExpense;
  }

  static approveExpense(id: string, approverName: string = 'Direktor'): Expense {
    const expenses = getStored<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
    const index = expenses.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Expense not found');

    const exp = expenses[index];
    const newStatus = exp.status === 'DIRECTOR_PENDING' ? 'ADMIN_PENDING' : 'APPROVED';

    exp.status = newStatus;
    exp.statusHistory.push({
      id: 'h-' + Date.now(),
      status: newStatus,
      changedBy: 'current-user',
      changedByName: approverName,
      timestamp: new Date().toLocaleString('uz-UZ'),
      reason: 'Tasdiqlandi'
    });

    setStored(STORAGE_KEYS.EXPENSES, expenses);

    this.addAuditLog({
      entityType: 'EXPENSE',
      entityId: id,
      action: 'APPROVE',
      newValue: { status: newStatus }
    });

    return exp;
  }

  static rejectExpense(id: string, reason: string, rejectorName: string = 'Direktor'): Expense {
    const expenses = getStored<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
    const index = expenses.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Expense not found');

    const exp = expenses[index];
    exp.status = 'REJECTED';
    exp.statusHistory.push({
      id: 'h-' + Date.now(),
      status: 'REJECTED',
      changedBy: 'current-user',
      changedByName: rejectorName,
      timestamp: new Date().toLocaleString('uz-UZ'),
      reason
    });

    setStored(STORAGE_KEYS.EXPENSES, expenses);

    this.addAuditLog({
      entityType: 'EXPENSE',
      entityId: id,
      action: 'REJECT',
      newValue: { status: 'REJECTED', reason }
    });

    return exp;
  }

  static requestFixExpense(id: string, reason: string, userName: string = 'Direktor'): Expense {
    const expenses = getStored<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
    const index = expenses.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Expense not found');

    const exp = expenses[index];
    exp.status = 'NEEDS_FIX';
    exp.statusHistory.push({
      id: 'h-' + Date.now(),
      status: 'NEEDS_FIX',
      changedBy: 'current-user',
      changedByName: userName,
      timestamp: new Date().toLocaleString('uz-UZ'),
      reason
    });

    setStored(STORAGE_KEYS.EXPENSES, expenses);
    return exp;
  }

  static bulkApprove(ids: string[]): number {
    let count = 0;
    ids.forEach(id => {
      try {
        this.approveExpense(id, 'Admin');
        count++;
      } catch (err) {
        console.error(err);
      }
    });
    return count;
  }

  // Refunds
  static getRefunds(): Refund[] {
    return getStored<Refund[]>(STORAGE_KEYS.REFUNDS, initialRefunds);
  }

  static createRefund(data: Partial<Refund>): Refund {
    const refunds = this.getRefunds();
    const newRefund: Refund = {
      id: 'ref-' + (refunds.length + 1),
      expenseId: data.expenseId || 'exp-1',
      expenseGlobalNumber: data.expenseGlobalNumber || 'EXP-000101',
      branchId: data.branchId || 'b1',
      branchName: data.branchName || 'Chilonzor filiali',
      employeeName: data.employeeName || 'Alisher Qodirov',
      amount: data.amount ? parseFloat(data.amount).toFixed(2) : '0.00',
      originalAmount: data.originalAmount || '500000.00',
      isPartial: !!data.isPartial,
      reason: data.reason || 'Qoldiq qaytarildi',
      status: 'PENDING',
      files: data.files || [],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    refunds.unshift(newRefund);
    setStored(STORAGE_KEYS.REFUNDS, refunds);

    this.addAuditLog({
      entityType: 'REFUND',
      entityId: newRefund.id,
      action: 'CREATE',
      newValue: newRefund
    });

    return newRefund;
  }

  static approveRefund(id: string): Refund {
    const refunds = this.getRefunds();
    const index = refunds.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Refund not found');
    refunds[index].status = 'APPROVED';
    refunds[index].approvedAt = new Date().toLocaleString('uz-UZ');
    refunds[index].approvedByName = 'Admin';
    setStored(STORAGE_KEYS.REFUNDS, refunds);
    return refunds[index];
  }

  static rejectRefund(id: string, reason: string): Refund {
    const refunds = this.getRefunds();
    const index = refunds.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Refund not found');
    refunds[index].status = 'REJECTED';
    refunds[index].reason = reason;
    setStored(STORAGE_KEYS.REFUNDS, refunds);

    this.addAuditLog({
      entityType: 'REFUND',
      entityId: id,
      action: 'REJECT',
      newValue: { status: 'REJECTED', reason }
    });

    return refunds[index];
  }

  // Edit Requests
  static getEditRequests(): EditRequest[] {
    return getStored<EditRequest[]>(STORAGE_KEYS.EDIT_REQUESTS, initialEditRequests);
  }

  static applyEditRequest(id: string): EditRequest {
    const reqs = this.getEditRequests();
    const index = reqs.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Edit request not found');
    reqs[index].status = 'APPLIED';
    setStored(STORAGE_KEYS.EDIT_REQUESTS, reqs);
    return reqs[index];
  }

  static rejectEditRequest(id: string, reason: string): EditRequest {
    const reqs = this.getEditRequests();
    const index = reqs.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Edit request not found');
    reqs[index].status = 'REJECTED';
    reqs[index].reason = reason;
    setStored(STORAGE_KEYS.EDIT_REQUESTS, reqs);

    this.addAuditLog({
      entityType: 'EDIT_REQUEST',
      entityId: id,
      action: 'REJECT',
      newValue: { status: 'REJECTED', reason }
    });

    return reqs[index];
  }

  // Budgets
  static getBudgets(scope?: string): Budget[] {
    let budgets = getStored<Budget[]>(STORAGE_KEYS.BUDGETS, initialBudgets);
    if (scope && scope !== 'ALL') {
      budgets = budgets.filter(b => b.scopeType === scope);
    }
    return budgets;
  }

  static createBudget(data: Partial<Budget>): Budget {
    const budgets = this.getBudgets();
    const newBudget: Budget = {
      id: 'bg' + (budgets.length + 1),
      scopeType: data.scopeType || 'BRANCH',
      scopeId: data.scopeId || 'b1',
      scopeName: data.scopeName || 'Filial',
      period: data.period || '2026-08',
      amountLimit: data.amountLimit || 10000000,
      actualAmount: data.actualAmount || 0
    };
    budgets.unshift(newBudget);
    setStored(STORAGE_KEYS.BUDGETS, budgets);
    return newBudget;
  }

  // Currency Rates
  static getCurrencyRates(): CurrencyRate[] {
    return getStored<CurrencyRate[]>(STORAGE_KEYS.CURRENCY_RATES, initialCurrencyRates);
  }

  static addCurrencyRate(data: Partial<CurrencyRate>): CurrencyRate {
    const rates = this.getCurrencyRates();
    const newRate: CurrencyRate = {
      id: 'cr' + (rates.length + 1),
      date: data.date || new Date().toISOString().split('T')[0],
      currency: (data.currency as any) || 'USD',
      rate: data.rate || 12850,
      source: 'MANUAL'
    };
    rates.unshift(newRate);
    setStored(STORAGE_KEYS.CURRENCY_RATES, rates);
    return newRate;
  }

  // Audit
  static getAuditLogs(): AuditLog[] {
    return getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);
  }

  static addAuditLog(data: Partial<AuditLog>): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: 'aud-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: data.userId || 'u1',
      userName: data.userName || 'Administrator',
      entityType: data.entityType || 'EXPENSE',
      entityId: data.entityId || '',
      action: data.action || 'UPDATE',
      channel: data.channel || 'WEB',
      oldValue: data.oldValue,
      newValue: data.newValue,
      ipAddress: '127.0.0.1'
    };
    logs.unshift(newLog);
    setStored(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // Exports
  static getExportJobs(): ExportJob[] {
    return getStored<ExportJob[]>(STORAGE_KEYS.EXPORT_JOBS, initialExportJobs);
  }

  static createExportJob(type: string, format: 'xlsx' | 'pdf', filters: Record<string, any>): ExportJob {
    const jobs = this.getExportJobs();
    const typeNames: Record<string, string> = {
      E1: 'Xarajatlar reestri (E1)',
      E2: 'Filiallar kesimida tahlil (E2)',
      E3: 'Kategoriyalar hisoboti (E3)',
      E4: 'Xodimlar balansi (E4)',
      E5: 'Byudjet ijrosi (E5)',
      E9: 'Audit jurnali (E9)'
    };

    const newJob: ExportJob = {
      id: 'job-' + Date.now(),
      type,
      typeName: typeNames[type] || `Hisobot (${type})`,
      format,
      filters,
      status: 'QUEUED',
      rowCount: Math.floor(50 + Math.random() * 200),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      expiresAt: new Date(Date.now() + 86400000).toISOString().replace('T', ' ').substring(0, 19)
    };

    jobs.unshift(newJob);
    setStored(STORAGE_KEYS.EXPORT_JOBS, jobs);

    // Simulate background transition QUEUED -> RUNNING -> DONE
    setTimeout(() => {
      const currentJobs = this.getExportJobs();
      const j = currentJobs.find(item => item.id === newJob.id);
      if (j) {
        j.status = 'RUNNING';
        setStored(STORAGE_KEYS.EXPORT_JOBS, currentJobs);
      }
    }, 1500);

    setTimeout(() => {
      const currentJobs = this.getExportJobs();
      const j = currentJobs.find(item => item.id === newJob.id);
      if (j) {
        j.status = 'DONE';
        j.downloadUrl = `#download-${newJob.id}`;
        setStored(STORAGE_KEYS.EXPORT_JOBS, currentJobs);
      }
    }, 4500);

    return newJob;
  }

  // Notifications
  static getNotifications(): NotificationItem[] {
    return getStored<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, initialNotifications);
  }

  static markNotificationRead(id: string): void {
    const notifs = this.getNotifications();
    const n = notifs.find(item => item.id === id);
    if (n) {
      n.isRead = true;
      setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
    }
  }

  static markAllNotificationsRead(): void {
    const notifs = this.getNotifications();
    notifs.forEach(n => n.isRead = true);
    setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
  }

  static addNotification(data: Partial<NotificationItem>): void {
    const notifs = this.getNotifications();
    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: data.title || 'Bildirishnoma',
      message: data.message || '',
      type: data.type || 'INFO',
      isRead: false,
      link: data.link,
      createdAt: 'Hozirgina'
    };
    notifs.unshift(newNotif);
    setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
  }
}
