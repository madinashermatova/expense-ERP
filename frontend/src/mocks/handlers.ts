import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as any;
    
    if (body.login === 'admin' && body.password === 'password') {
      return HttpResponse.json({
        accessToken: 'mock-jwt-token-12345',
        user: {
          id: 'u1',
          login: 'admin',
          role: 'ADMIN',
          fullName: 'Tizim Administratori'
        }
      });
    }

    return new HttpResponse(
      JSON.stringify({ code: 'UNAUTHORIZED', message: 'Login yoki parol noto\'g\'ri' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }),

  http.post('*/api/auth/logout', async () => {
    await delay(300);
    return HttpResponse.json({ success: true });
  }),

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
];
