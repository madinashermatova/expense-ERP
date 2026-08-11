# Expense ERP

Xarajatlar boshqaruvi tizimi — Web ERP + Telegram bot, multi-tenant (SaaS-ready).

Texnik topshiriq: [`docs/TZ.md`](docs/TZ.md)

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
