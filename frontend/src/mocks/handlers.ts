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

  // Add more mock endpoints as needed
];
