import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MockService } from '@/mocks/mockService';

export async function handleMockRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse | null> {
  const url = config.url || '';
  const method = (config.method || 'get').toLowerCase();
  const data = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
  const params = config.params || {};

  // Artificial short delay for realistic UI loading states (100ms - 250ms)
  await new Promise(r => setTimeout(r, 150));

  // 1. Auth
  if (url === '/auth/login' && method === 'post') {
    const { login, password, companySlug } = data;
    
    // Simulate MULTIPLE_COMPANIES
    if (login === 'multi@erp.uz' && !companySlug) {
      const err: any = new Error('Multiple companies');
      err.response = {
        status: 409,
        data: {
          statusCode: 409,
          code: 'MULTIPLE_COMPANIES',
          message: 'Bu login bir nechta kompaniyada mavjud — kompaniyani tanlang',
          details: { companies: ['alfa:Alfa Savdo MChJ', 'beta:Beta Logistika MChJ'] }
        }
      };
      throw err;
    }

    if (login === 'locked@erp.uz') {
      const err: any = new Error('Login locked');
      err.response = {
        status: 429,
        data: {
          statusCode: 429,
          code: 'LOGIN_LOCKED',
          message: 'Hisob bloklangan, 15 daqiqadan so\'ng urinib ko\'ring'
        }
      };
      throw err;
    }

    // Demo accounts
    if (login === 'admin@erp.uz' || login === 'admin') {
      return {
        data: {
          accessToken: 'mock-jwt-admin-token-' + Date.now(),
          user: {
            id: 'u1',
            login: 'admin',
            fullName: 'Bekzod Abdullayev (Admin)',
            role: 'ADMIN',
            branchId: 'b1'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }

    if (login === 'director@erp.uz' || login === 'director_chl' || login === 'director') {
      return {
        data: {
          accessToken: 'mock-jwt-director-token-' + Date.now(),
          user: {
            id: 'u2',
            login: 'director_chl',
            fullName: 'Rustam Rahimov (Direktor)',
            role: 'DIRECTOR',
            branchId: 'b1'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }

    if (login === 'worker@erp.uz' || login === 'worker_chl' || login === 'worker') {
      return {
        data: {
          accessToken: 'mock-jwt-worker-token-' + Date.now(),
          user: {
            id: 'u10',
            login: 'worker_chl',
            fullName: 'Alisher Qodirov (Xodim)',
            role: 'WORKER',
            branchId: 'b1'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }

    // Default fallback: allow any valid login / pass with >=8 chars as Admin
    if (password && password.length >= 8) {
      return {
        data: {
          accessToken: 'mock-jwt-token-' + Date.now(),
          user: {
            id: 'u1',
            login: login || 'admin',
            fullName: login.includes('director') ? 'Filial Direktori' : 'Administrator',
            role: login.includes('director') ? 'DIRECTOR' : 'ADMIN',
            branchId: 'b1'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }

    const err: any = new Error('Invalid credentials');
    err.response = {
      status: 401,
      data: {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Login yoki parol noto\'g\'ri'
      }
    };
    throw err;
  }

  if (url === '/auth/logout') {
    return { data: { success: true }, status: 200, statusText: 'OK', headers: {}, config };
  }

  if (url === '/auth/refresh') {
    return {
      data: { accessToken: 'mock-refreshed-jwt-' + Date.now() },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    };
  }

  // 2. Branches
  if (url === '/branches') {
    if (method === 'get') {
      return { data: MockService.getBranches(params.status), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.createBranch(data), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  if (url.startsWith('/branches/') && url.endsWith('/archive')) {
    const id = url.split('/')[2];
    return { data: MockService.archiveBranch(id), status: 200, statusText: 'OK', headers: {}, config };
  }

  if (url.startsWith('/branches/') && method === 'patch') {
    const id = url.split('/')[2];
    return { data: MockService.updateBranch(id, data), status: 200, statusText: 'OK', headers: {}, config };
  }

  // 3. Employees
  if (url === '/employees') {
    if (method === 'get') {
      return { data: MockService.getEmployees(params.branchId, params.status, params.q), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.createEmployee(data), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  if (url.startsWith('/employees/') && url.endsWith('/reset-password')) {
    const id = url.split('/')[2];
    return { data: MockService.resetEmployeePassword(id), status: 200, statusText: 'OK', headers: {}, config };
  }

  // 4. Categories
  if (url === '/categories') {
    if (method === 'get') {
      return { data: MockService.getCategories(), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.createCategory(data), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  // 5. Expenses
  if (url === '/expenses' && method === 'get') {
    return { data: MockService.getExpenses(params), status: 200, statusText: 'OK', headers: {}, config };
  }

  if (url === '/expenses' && method === 'post') {
    return { data: MockService.createExpense(data), status: 201, statusText: 'Created', headers: {}, config };
  }

  if (url === '/expenses/bulk-approve' && method === 'post') {
    const count = MockService.bulkApprove(data.ids || []);
    return { data: { count, success: true }, status: 200, statusText: 'OK', headers: {}, config };
  }

  if (url.startsWith('/expenses/')) {
    const parts = url.split('/');
    const id = parts[2];
    const action = parts[3];

    if (action === 'approve' && method === 'post') {
      return { data: MockService.approveExpense(id), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (action === 'reject' && method === 'post') {
      return { data: MockService.rejectExpense(id, data.reason), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (action === 'request-fix' && method === 'post') {
      return { data: MockService.requestFixExpense(id, data.reason), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'get') {
      const exp = MockService.getExpenseById(id);
      return { data: exp, status: 200, statusText: 'OK', headers: {}, config };
    }
  }

  // 6. Refunds
  if (url === '/refunds') {
    if (method === 'get') {
      return { data: MockService.getRefunds(), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.createRefund(data), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  if (url.startsWith('/refunds/') && url.endsWith('/approve')) {
    const id = url.split('/')[2];
    return { data: MockService.approveRefund(id), status: 200, statusText: 'OK', headers: {}, config };
  }

  if (url.startsWith('/refunds/') && url.endsWith('/reject')) {
    const id = url.split('/')[2];
    return { data: MockService.rejectRefund(id, data.reason), status: 200, statusText: 'OK', headers: {}, config };
  }

  // 7. Edit requests
  if (url === '/edit-requests') {
    if (method === 'get') {
      return { data: MockService.getEditRequests(), status: 200, statusText: 'OK', headers: {}, config };
    }
  }

  if (url.startsWith('/edit-requests/') && url.endsWith('/apply')) {
    const id = url.split('/')[2];
    return { data: MockService.applyEditRequest(id), status: 200, statusText: 'OK', headers: {}, config };
  }

  if (url.startsWith('/edit-requests/') && url.endsWith('/reject')) {
    const id = url.split('/')[2];
    return { data: MockService.rejectEditRequest(id, data.reason), status: 200, statusText: 'OK', headers: {}, config };
  }

  // 8. Budgets
  if (url === '/budgets') {
    if (method === 'get') {
      return { data: MockService.getBudgets(params.scope), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.createBudget(data), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  // 9. Currency rates
  if (url === '/currency/rates') {
    if (method === 'get') {
      return { data: MockService.getCurrencyRates(), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.addCurrencyRate(data), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  // 10. Reports
  if (url.startsWith('/reports/')) {
    const type = url.split('/')[2];
    if (type === 'summary') {
      return {
        data: {
          totalSpend: 148500000,
          pendingDirectorCount: 4,
          pendingAdminCount: 2,
          refundedSum: 2350000,
          budgetPercent: 78
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }
    if (type === 'by-branch') {
      return {
        data: [
          { name: 'Chilonzor', amount: 24500000, limit: 30000000, count: 48 },
          { name: 'Yunusobod', amount: 18200000, limit: 25000000, count: 32 },
          { name: 'Mirobod', amount: 28900000, limit: 28000000, count: 54 },
          { name: 'Samarqand', amount: 14200000, limit: 20000000, count: 22 },
          { name: 'Buxoro', amount: 9800000, limit: 15000000, count: 18 },
          { name: 'Namangan', amount: 12400000, limit: 18000000, count: 21 },
          { name: 'Farg\'ona', amount: 11500000, limit: 16000000, count: 19 }
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }
    if (type === 'by-category') {
      return {
        data: [
          { name: 'Marketing & Reklama', value: 42500000, color: '#3b82f6' },
          { name: 'Ofis & Ma\'muriy', value: 26800000, color: '#10b981' },
          { name: 'Transport & Yoqilg\'i', value: 19400000, color: '#f59e0b' },
          { name: 'IT & Uskunalar', value: 15600000, color: '#8b5cf6' },
          { name: 'Xizmat safari', value: 12300000, color: '#ec4899' },
          { name: 'Boshqa xarajatlar', value: 8900000, color: '#6b7280' }
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }
    if (type === 'by-employee') {
      return {
        data: [
          { id: '1', name: 'Farrux Shukurov', branch: 'Mirobod', count: 18, total: 28400000 },
          { id: '2', name: 'Sherzod Toirov', branch: 'Chilonzor', count: 24, total: 22400000 },
          { id: '3', name: 'Zarina Normatova', branch: 'Chilonzor', count: 12, total: 19800000 },
          { id: '4', name: 'Alisher Qodirov', branch: 'Chilonzor', count: 15, total: 18500000 },
          { id: '5', name: 'Bobur Mirzayev', branch: 'Yunusobod', count: 9, total: 16700000 },
          { id: '6', name: 'Malika Usmonova', branch: 'Chilonzor', count: 14, total: 14200000 },
          { id: '7', name: 'Nigora Ahmedova', branch: 'Yunusobod', count: 11, total: 12900000 }
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }
  }

  // 11. Exports
  if (url === '/exports') {
    if (method === 'get') {
      return { data: MockService.getExportJobs(), status: 200, statusText: 'OK', headers: {}, config };
    }
    if (method === 'post') {
      return { data: MockService.createExportJob(data.type, data.format, data.filters), status: 201, statusText: 'Created', headers: {}, config };
    }
  }

  // 12. Notifications
  if (url === '/notifications') {
    if (method === 'get') {
      return { data: MockService.getNotifications(), status: 200, statusText: 'OK', headers: {}, config };
    }
  }
  if (url === '/notifications/read-all') {
    MockService.markAllNotificationsRead();
    return { data: { success: true }, status: 200, statusText: 'OK', headers: {}, config };
  }
  if (url.startsWith('/notifications/') && url.endsWith('/read')) {
    const id = url.split('/')[2];
    MockService.markNotificationRead(id);
    return { data: { success: true }, status: 200, statusText: 'OK', headers: {}, config };
  }

  // 13. Audit
  if (url === '/audit') {
    return { data: MockService.getAuditLogs(), status: 200, statusText: 'OK', headers: {}, config };
  }

  // 14. Settings
  if (url === '/settings') {
    return {
      data: {
        currencyBase: 'UZS',
        reportPeriodStartDay: 1,
        defaultLanguage: 'uz',
        notificationsEnabled: true,
        reminderHour: 18,
        editWindowHours: 24
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    };
  }

  return null;
}
