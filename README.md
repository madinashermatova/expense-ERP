# Expense ERP

Xarajatlar boshqaruvi tizimi — Web ERP + Telegram bot, multi-tenant (SaaS-ready).

## Hujjatlar

| Hujjat | Kimga |
|---|---|
| [`docs/TZ.md`](docs/TZ.md) | Asosiy texnik topshiriq (backend + bot + web) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Ishlar rejasi: backend S0–S18, frontend F1–F10 |
| [`docs/API.md`](docs/API.md) | **API ma'lumotnomasi** — endpointlar, xato kodlari, misollar |
| [`docs/FRONTEND-TZ.md`](docs/FRONTEND-TZ.md) | Frontend ishlab chiquvchi uchun topshiriq |
| [`docs/DESIGN-TZ.md`](docs/DESIGN-TZ.md) | Dizayn tizimi va UI qoidalari |

## Tuzilma

```
backend/    NestJS + Prisma + PostgreSQL + Redis/BullMQ + Telegraf
frontend/   React 18 + Vite + TailwindCSS + shadcn/ui
docs/       TZ va qo'llanmalar
```

## Ishga tushirish (dev)

```bash
docker compose up -d          # postgres, postgres-test, redis, minio
cd backend && npm install
cp .env.example .env
npm run prisma:migrate
npm run seed
npm run start:dev
```

## Servislar (dev)

| Servis | Port | Kirish |
|---|---|---|
| Postgres | 5442 | erp / erp_dev_password |
| Postgres (test) | 5443 | erp / erp_test_password |
| Redis | 6389 | — |
| MinIO API | 9010 | erp_minio / erp_minio_dev_password |
| MinIO Console | 9011 | erp_minio / erp_minio_dev_password |
| Backend API | 3000 | http://localhost:3000/api |
