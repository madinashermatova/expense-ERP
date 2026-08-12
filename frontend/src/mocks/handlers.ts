import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.get('*/api/expenses', async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const limit = Number(url.searchParams.get('limit') || '10');

    // Generate mock expenses
    const items = Array.from({ length: limit }).map((_, i) => {
      const id = (page - 1) * limit + i + 1;
      return {
        id: id.toString(),
        globalNumber: `EXP-00${id}`,
        branchNumber: `TOS-2026-${id}`,
        date: '2026-08-12',
        branch: { id: 'b1', name: 'Toshkent' },
        category: { id: 'c1', name: 'Transport' },
        employees: [{ id: 'e1', fullName: 'Ali Valiyev' }],
        amount: '150000.00',
        currency: 'UZS',
        paymentMethod: 'CARD',
        status: id % 3 === 0 ? 'APPROVED' : (id % 2 === 0 ? 'DIRECTOR_PENDING' : 'DRAFT'),
        hasReceipt: id % 2 === 0
      };
    });

    return HttpResponse.json({
      items,
      total: 100,
      page,
      limit,
      totalPages: Math.ceil(100 / limit)
    });
  }),

  http.get('*/api/budgets', async () => {
    await delay(300);
    return HttpResponse.json([
      { id: 'bd1', scopeType: 'CATEGORY', scopeId: 'c1', period: '2026-08', amountLimit: 5000000, actualAmount: 4800000 },
      { id: 'bd2', scopeType: 'BRANCH', scopeId: 'b1', period: '2026-08', amountLimit: 20000000, actualAmount: 5000000 }
    ]);
  }),
  http.post('*/api/budgets', async () => {
    await delay(500);
    return HttpResponse.json({ success: true }, { status: 201 });
  }),

  http.get('*/api/currencies', async () => {
    await delay(300);
    return HttpResponse.json([
      { id: 'cr1', date: '2026-08-12', currency: 'USD', rate: 12600.00 },
      { id: 'cr2', date: '2026-08-11', currency: 'USD', rate: 12590.50 }
    ]);
  }),
  http.post('*/api/currencies', async () => {
    await delay(500);
    return HttpResponse.json({ success: true }, { status: 201 });
  }),

  http.post('*/api/expenses/:id/approve', async () => {
    await delay(300);
    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/expenses/:id/reject', async () => {
    await delay(300);
    return HttpResponse.json({ success: true });
  }),

  // Refunds
  http.get('*/api/refunds', async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'PENDING';
    
    return HttpResponse.json({
      items: [
        {
          id: 'ref-1',
          expenseId: 'exp-123',
          expenseGlobalNumber: 'EXP-000123',
          amount: '150000.00',
          reason: 'Noto\'g\'ri kiritilibdi',
          status: 'PENDING',
          createdAt: '2026-08-10'
        }
      ].filter(r => r.status === status),
      total: 1
    });
  }),
  
  http.post('*/api/refunds', async () => {
    await delay(800);
    return HttpResponse.json({ success: true }, { status: 201 });
  }),

  http.post('*/api/refunds/:id/approve', async () => {
    await delay(500);
    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/refunds/:id/reject', async () => {
    await delay(500);
    return HttpResponse.json({ success: true });
  }),

  // Edit Requests
  http.get('*/api/edit-requests', async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'PENDING';
    
    return HttpResponse.json({
      items: [
        {
          id: 'er-1',
          expenseId: 'exp-456',
          expenseGlobalNumber: 'EXP-000456',
          requestedBy: 'Azizov Alisher (Worker)',
          reason: 'Kategoriya xato kiritilgan, o\'zgartirish kerak.',
          status: 'PENDING',
          createdAt: '2026-08-11'
        }
      ].filter(r => r.status === status),
      total: 1
    });
  }),

  http.post('*/api/edit-requests/:id/apply', async () => {
    await delay(500);
    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/edit-requests/:id/reject', async () => {
    await delay(500);
    return HttpResponse.json({ success: true });
  }),

  // Reports
  http.get('*/api/reports', async ({ request }) => {
    await delay(600);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    
    return HttpResponse.json([
      { group: 'Toshkent bosh ofis', totalAmount: 45000000, count: 12 },
      { group: 'Samarqand filiali', totalAmount: 12000000, count: 5 }
    ]);
  }),

  // Audit
  http.get('*/api/audit', async () => {
    await delay(400);
    return HttpResponse.json({
      items: [
        { id: 'a1', createdAt: '2026-08-12T10:00:00Z', userFullName: 'Azizov Alisher', action: 'CREATE', entityType: 'EXPENSE', entityId: 'exp-123', details: { amount: 500000 } },
        { id: 'a2', createdAt: '2026-08-11T14:30:00Z', userFullName: 'Karimova Malika', action: 'UPDATE', entityType: 'EMPLOYEE', entityId: 'emp-456', details: { role: 'DIRECTOR' } },
      ],
      total: 2,
    });
  }),
];
