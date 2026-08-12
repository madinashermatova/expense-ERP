# API ma'lumotnomasi

Base URL: `http://localhost:3000/api` · Barcha javoblar JSON · Vaqt UTC (ISO 8601)

> Bu hujjat **amalda ishlaydigan** endpointlarni tavsiflaydi va har bosqichda yangilanadi.
> Rejalashtirilgan, lekin hali yozilmagan endpointlar «⏳ rejada» belgisi bilan.
> Rejaning o'zi: [`ROADMAP.md`](ROADMAP.md) · Frontend uchun ko'rsatmalar: [`FRONTEND-TZ.md`](FRONTEND-TZ.md)

Holat: **S1–S4 tayyor** (tenancy, auth, tashkilot, fayllar)

---

## Umumiy qoidalar

### Autentifikatsiya

Barcha endpointlar JWT talab qiladi (`@Public` belgilanganlardan tashqari):

```
Authorization: Bearer <accessToken>
```

Refresh token **httpOnly cookie** da (`erp_rt`) — JS uni ko'rmaydi. Barcha so'rovlar
`withCredentials: true` bilan yuborilishi shart, aks holda refresh oqimi ishlamaydi.

### Xato formati (yagona)

```jsonc
{
  "statusCode": 422,
  "code": "RECEIPT_REQUIRED",        // mashina o'qiydigan kod
  "message": "Ushbu kategoriya uchun chek majburiy",
  "details": { "files": ["majburiy"] },  // ixtiyoriy, maydon → xatolar
  "retryAfter": 900                       // faqat 429 da
}
```

`details` bo'lsa — forma maydonlariga tarqating. Bo'lmasa — toast.

### Ro'yxat javobi

```jsonc
{ "items": [ ... ], "total": 42, "page": 1, "limit": 25, "totalPages": 2 }
```

Umumiy query parametrlari: `page` (1 dan), `limit` (1–200, default 25), `sort`, `order` (`asc`/`desc`).

### Rollar

`PLATFORM_OWNER` › `ADMIN` › `DIRECTOR` › `WORKER`

- `WORKER` Web API ga **umuman kira olmaydi** — har qanday endpointda `403 WEB_ACCESS_DENIED`
- `DIRECTOR` faqat o'z filiali doirasida: **o'qishda** boshqa filial → `404`,
  **yozishda** → `403 BRANCH_FORBIDDEN`
- Tenant izolyatsiyasi: boshqa kompaniya yozuvi har doim `404`

### Pul va sana

- Summa — **string** (`"150000.00"`), frontendda arifmetika qilinmaydi
- Sana maydonlari — `YYYY-MM-DD`, vaqt bilan — ISO 8601 UTC
- Ko'rsatishda Asia/Tashkent ga o'giring

---

## Auth

### `POST /auth/login` — 🔓 ochiq

Rate limit: **5 req/min per IP**

```jsonc
// so'rov
{ "login": "admin1@alfa.uz", "password": "Parol123!", "companySlug": "alfa" }
```

`login` — email **yoki** username. `companySlug` faqat `MULTIPLE_COMPANIES` javobidan keyin.

```jsonc
// 200
{
  "accessToken": "eyJ...",
  "user": {
    "id": "uuid", "email": "admin1@alfa.uz", "username": "alfa_admin1",
    "role": "ADMIN", "language": "UZ",
    "companyId": "uuid", "companyName": "Alfa Savdo MChJ",
    "employeeId": "uuid", "fullName": "Admin Bir",
    "branchId": "uuid", "branchName": null
  }
}
```

Refresh token `Set-Cookie: erp_rt=...; HttpOnly` orqali beriladi.

| Xato | Status | Ma'nosi |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Login yoki parol noto'g'ri (qaysi biri — aytilmaydi) |
| `WEB_ACCESS_DENIED` | 403 | Ishchi roli Web ERP ga kira olmaydi |
| `ACCOUNT_INACTIVE` | 403 | Hisob bloklangan |
| `COMPANY_SUSPENDED` | 403 | Kompaniya to'xtatilgan |
| `LOGIN_LOCKED` | 429 | 5 ta noto'g'ri urinish → 15 daq blok (`retryAfter` + `Retry-After` header) |
| `TOO_MANY_REQUESTS` | 429 | IP bo'yicha rate limit |
| `MULTIPLE_COMPANIES` | 409 | `details.companies: ["slug:Nom", ...]` → kompaniya tanlab qayta yuboring |
| `VALIDATION_FAILED` | 422 | Parol < 8 belgi va h.k. |

### `POST /auth/refresh` — 🔓 ochiq

Cookie dagi refresh token bilan. **Rotatsiya:** eski token darhol bekor qilinadi.
Bekor qilingan token qayta ishlatilsa — foydalanuvchining **barcha** sessiyalari yopiladi
(token o'g'irlanishiga qarshi). Javob `login` bilan bir xil.

### `POST /auth/logout` — 🔓 ochiq → `204`

### `GET /auth/me` → `PublicUser`

---

## Filiallar

### `GET /branches`

| Query | Qiymat |
|---|---|
| `status` | `active` (default) · `archived` · `all` |
| `q` | nom yoki kod bo'yicha qidiruv |
| `sort` | `name` (default: kod bo'yicha) |

Direktor uchun natija avtomatik o'z filiali bilan cheklanadi.

```jsonc
// items[] elementi
{
  "id": "uuid", "code": "CHL", "name": "Chilonzor",
  "address": null, "phone": "+998901112233", "openedAt": "2024-01-15T00:00:00.000Z",
  "status": "ACTIVE",
  "employeeCount": 12,
  "directorCount": 1,
  "hasNoDirector": false,      // ⚠️ banner uchun (TZ 3.2)
  "createdAt": "..."
}
```

### `GET /branches/:id` → `BranchView`

### `POST /branches` — `ADMIN` → `201`

```jsonc
{ "code": "chl", "name": "Chilonzor", "address": "...", "phone": "+998901112233", "openedAt": "2024-01-15" }
```

`code` avtomatik katta harfga o'giriladi, `^[A-Z]{2,5}$` bo'lishi shart va **keyin o'zgarmaydi**.

| Xato | Status |
|---|---|
| `BRANCH_CODE_TAKEN` | 409 |
| `PLAN_LIMIT_EXCEEDED` | 403 |
| `VALIDATION_FAILED` | 422 |

### `PATCH /branches/:id` — `ADMIN`

`name`, `address`, `phone`, `openedAt`. **`code` qabul qilinmaydi** (yuborilsa 422).

### `POST /branches/:id/archive` · `POST /branches/:id/restore` — `ADMIN` → `201`

Fizik o'chirish yo'q. Ikki marta arxivlash → `409 BRANCH_ALREADY_ARCHIVED`.

---

## Xodimlar

### `GET /employees`

| Query | Qiymat |
|---|---|
| `branchId` | direktor boshqa filialni so'rasa → `403` |
| `status` | `ACTIVE` · `INACTIVE` |
| `role` | `ADMIN` · `DIRECTOR` · `WORKER` |
| `q` | ism, telefon yoki email |

```jsonc
// items[] elementi
{
  "id": "uuid", "fullName": "Aliyev Vali", "position": "Mutaxassis",
  "branchId": "uuid", "branchName": "Chilonzor", "branchCode": "CHL",
  "phone": "+998901234567", "hiredAt": "...", "status": "ACTIVE",
  "language": "UZ", "botBlocked": false,
  "userId": "uuid", "email": "worker1@alfa.uz", "username": "alfa_worker1",
  "role": "WORKER", "isActive": true,
  "telegramLinkCount": 1,
  "createdAt": "..."
}
```

### `POST /employees` — `ADMIN`, `DIRECTOR` → `201`

```jsonc
{
  "fullName": "Aliyev Vali", "position": "Mutaxassis",
  "branchId": "uuid", "phone": "+998901234567", "hiredAt": "2025-03-01",
  "language": "UZ", "role": "WORKER",
  "email": "worker9@alfa.uz", "username": "alfa_worker9",
  "password": "ixtiyoriy"        // berilmasa tizim generatsiya qiladi
}
```

```jsonc
// 201 — parol FAQAT SHU YERDA, qayta ko'rsatilmaydi
{ "employee": { ...EmployeeView }, "tempPassword": "Kx7mPq2nRt4v" }
```

| Xato | Status | Sabab |
|---|---|---|
| `ROLE_FORBIDDEN` | 403 | Direktor faqat `WORKER` yarata oladi |
| `BRANCH_FORBIDDEN` | 403 | Direktor boshqa filialga qo'sha olmaydi |
| `PHONE_TAKEN` | 409 | Telefon tenant doirasida unikal |
| `LOGIN_TAKEN` | 409 | Email yoki username band |
| `BRANCH_ARCHIVED` | 422 | Arxivlangan filialga xodim qo'shilmaydi |
| `BRANCH_NOT_FOUND` | 422 | Filial yo'q yoki boshqa kompaniyaniki |
| `PLAN_LIMIT_EXCEEDED` | 403 | Tarif limiti |

### `PATCH /employees/:id` — `ADMIN`, `DIRECTOR`

`fullName`, `position`, `phone`, `hiredAt`, `language`, `status`, `isActive`.
**`branchId` va `role` qabul qilinmaydi** — ular alohida amallar.

`status: "INACTIVE"` → hisob bloklanadi **va** Telegram bog'lanishlari bekor qilinadi.

### `POST /employees/:id/reset-password` — `ADMIN`, `DIRECTOR` → `201`

```jsonc
{ "tempPassword": "Kx7mPq2nRt4v" }
```

Yon ta'sir: barcha web sessiyalar (`RefreshToken`) va Telegram bog'lanishlari bekor qilinadi.
Direktor faqat `WORKER` parolini tiklay oladi.

### `POST /employees/:id/transfer` — `ADMIN` → `201`

```jsonc
{ "toBranchId": "uuid" }
```

Ko'chirish tarixi saqlanadi; eski xarajatlar eski filialda qoladi.
Bir xil filial → `409 SAME_BRANCH`.

### `GET /employees/:id/transfers` → ko'chirishlar tarixi

---

## Kategoriyalar

### `GET /categories` → daraxt (massiv, `children[]` bilan)

`?status=active|archived|all`

```jsonc
[
  {
    "id": "uuid", "parentId": null,
    "nameUz": "Ovqatlanish", "nameRu": "Питание",
    "receiptRequired": false, "commentRequired": false,
    "maxAmountPerEntry": null, "status": "ACTIVE", "sortOrder": 0,
    "children": [
      { "id": "uuid", "parentId": "uuid", "nameUz": "Tushlik", "nameRu": "Обед",
        "receiptRequired": true, "commentRequired": false,
        "maxAmountPerEntry": "500000", "status": "ACTIVE", "sortOrder": 0 }
    ]
  }
]
```

Bu uch maydon xarajat formasining xatti-harakatini boshqaradi:
`receiptRequired` → chek majburiy · `commentRequired` → izoh majburiy ·
`maxAmountPerEntry` → summa chegarasi.

### `POST /categories` · `PATCH /categories/:id` — `ADMIN`

Ierarxiya **aynan ikki daraja**: ichki kategoriyaga bola qo'shish → `422 CATEGORY_DEPTH_EXCEEDED`.
`PATCH` da `parentId` qabul qilinmaydi.

### `POST /categories/:id/archive` · `/restore` — `ADMIN` → `201`

Bosh kategoriya arxivlanganda **ichkilari ham** arxivlanadi.
Bosh kategoriya arxivda bo'lsa ichkisini tiklab bo'lmaydi → `409 PARENT_CATEGORY_ARCHIVED`.

### `DELETE /categories/:id` — `ADMIN` → `204`

Faqat **ishlatilmagan va bolasiz** kategoriya o'chiriladi:
`409 CATEGORY_IN_USE` · `409 CATEGORY_HAS_CHILDREN`.

---

## Fayllar

### `GET /files/:id/url` → signed URL

```jsonc
{ "url": "http://localhost:9010/erp-files/...", "expiresAt": "2026-08-12T10:15:00.000Z" }
```

TTL **15 daqiqa**. Fayl kaliti `{companyId}/...` bilan prefikslangan — boshqa kompaniya
faylini so'rash `404`. Rasmni `<img src>` ga to'g'ridan-to'g'ri qo'yish mumkin,
PDF ni yangi tabda oching.

### Yuklash cheklovlari (yuklash endpointlari S6/S9 da)

| Qoida | Qiymat |
|---|---|
| Ruxsat etilgan turlar | `jpg` · `png` · `webp` · `pdf` |
| Maksimal hajm | 10 MB (`UPLOAD_MAX_FILE_SIZE_MB`) |
| Bitta xarajatga | 1–5 fayl (`UPLOAD_MAX_FILES_PER_EXPENSE`) |

Fayl turi **faqat `Content-Type` bo'yicha emas, magic-byte bo'yicha** tekshiriladi —
`.jpg` deb nomlangan `.exe` rad etiladi.

| Xato | Status |
|---|---|
| `FILE_TYPE_NOT_ALLOWED` | 422 |
| `FILE_TOO_LARGE` | 413 |
| `TOO_MANY_FILES` | 422 |
| `FILE_CONTENT_MISMATCH` | 422 (kengaytma/MIME mazmuniga mos emas) |

---

## ⏳ Rejada (keyingi bosqichlar)

| Endpoint | Bosqich |
|---|---|
| `GET/POST /currency/rates` | S5 |
| `GET/POST/PATCH/DELETE /expenses`, `/expenses/:id/files` | S6 |
| `POST /expenses/:id/approve` · `/reject` · `/request-fix` · `/bulk-approve` | S7 |
| `GET/POST /edit-requests` | S8 |
| `GET/POST /refunds` | S9 |
| `GET/POST/PATCH /budgets` | S10 |
| `GET /notifications` | S11 |
| `GET /reports/*` | S12 |
| `POST/GET /exports` | S13 |
| `GET /audit` | S14 |
| `GET/PATCH /settings` | S15 |

---

## Xizmat endpointlari

### `GET /health` — 🔓 ochiq

```jsonc
{ "status": "ok", "db": "up", "time": "2026-08-12T04:00:00.000Z" }
```

Har javobda `x-request-id` sarlavhasi bo'ladi — xatolarni loglar bilan solishtirish uchun.
