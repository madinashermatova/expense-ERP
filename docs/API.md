# API ma'lumotnomasi

Base URL: `http://localhost:3000/api` · Barcha javoblar JSON · Vaqt UTC (ISO 8601)

> Bu hujjat **amalda ishlaydigan** endpointlarni tavsiflaydi va har bosqichda yangilanadi.
> Rejalashtirilgan, lekin hali yozilmagan endpointlar «⏳ rejada» belgisi bilan.
> Rejaning o'zi: [`ROADMAP.md`](ROADMAP.md) · Frontend uchun ko'rsatmalar: [`FRONTEND-TZ.md`](FRONTEND-TZ.md)

Holat: **S1–S11 tayyor** — tenancy, auth, tashkilot, fayllar, valyuta, xarajatlar,
tasdiqlash, tahrirlash, qaytarish, byudjet, bildirishnomalar

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

Saqlangan fayl kengaytmasi **yuborilgan nomdan emas, aniqlangan turdan** olinadi.
Boshqa kompaniya fayliga so'rov `404` qaytaradi (mavjudligi oshkor qilinmaydi).

---

## Xarajatlar

Har bir xarajat **ikkita raqamga** ega: `globalNumber` (`EXP-000123`, kompaniya bo'ylab
uzluksiz) va `branchNumber` (`CHL-2026-0045`, filial kodi + yil + filial ichidagi
ketma-ketlik, har yil 1 dan qayta boshlanadi). Ikkalasi ham yaratilganda beriladi va
**hech qachon o'zgarmaydi** — tahrirlash, qaytarish, statusni o'zgartirish ularga tegmaydi.

### `GET /expenses`

| Query | Qiymat |
|---|---|
| `branchId` | filial (direktor uchun avtomatik o'z filiali) |
| `categoryId` · `employeeId` · `createdByUserId` | uuid |
| `status` | `DRAFT,DIRECTOR_PENDING,…` — vergul bilan bir nechta |
| `paymentMethod` | `CASH` · `CARD` · `TRANSFER` |
| `currency` | `UZS` · `USD` |
| `dateFrom` · `dateTo` | `YYYY-MM-DD` |
| `amountFrom` · `amountTo` | UZS ekvivalenti bo'yicha |
| `q` | `globalNumber`, `branchNumber` yoki izoh bo'yicha qidiruv |
| `includeDeleted` | `true` — o'chirilganlarni ham ko'rsatadi |
| `sort` | `date` (default) · `amount` · `amountUzs` · `createdAt` · `globalNumber` · `status` |

`employeeId` — o'sha xodimning **ulushi** bor xarajatlar (kiritgan shaxs emas).
Sukut bo'yicha o'chirilgan yozuvlar ko'rinmaydi.

```jsonc
// items[] elementi
{
  "id": "uuid",
  "globalNumber": "EXP-000123",
  "branchNumber": "CHL-2026-0045",
  "branchId": "uuid", "branchName": "Chilonzor",
  "categoryId": "uuid", "categoryName": "Tushlik",
  "amount": "150000.00",
  "currency": "UZS",
  "rateUsed": "1.000000",          // yaratilishdagi kurs snapshot i
  "rateSource": "MANUAL",
  "amountUzs": "150000.00",
  "refundedAmount": "0.00",
  "effectiveAmount": "150000.00",  // amount − refundedAmount
  "date": "2026-08-12",
  "comment": null,
  "paymentMethod": "CASH",
  "status": "DIRECTOR_PENDING",
  "createdByUserId": "uuid", "createdByName": "Admin Bir",
  "channel": "WEB",
  "version": 0,                    // optimistik blokirovka uchun (S7)
  "deletedAt": null,
  "createdAt": "...",
  "shares": [
    { "employeeId": "uuid", "employeeName": "Ali Valiyev",
      "amount": "75000.00", "amountUzs": "75000.00" }
  ]
}
```

### `GET /expenses/:id` → `ExpenseView` + `files[]`

Kartochkada qo'shimcha `files: [{ id, originalName, mimeType, sizeBytes, createdAt }]`.
Faylning o'zi `GET /files/:id/url` orqali signed URL bilan olinadi.

### `POST /expenses` → `201`

```jsonc
{
  "branchId": "uuid",
  "categoryId": "uuid",
  "employeeIds": ["uuid", "uuid"],   // kim uchun (1–50)
  "amount": "100000.00",
  "currency": "UZS",
  "date": "2026-08-12",
  "comment": "Jamoa tushligi",       // kategoriya talab qilsa majburiy
  "paymentMethod": "CASH",
  "shares": [                        // ixtiyoriy — berilmasa teng bo'linadi
    { "employeeId": "uuid", "amount": "60000.00" },
    { "employeeId": "uuid", "amount": "40000.00" }
  ]
}
```

**Taqsimlash.** `shares` berilmasa summa xodimlar o'rtasida teng bo'linadi va qoldiq
tiyinlar **ro'yxatdagi birinchi xodimga** qo'shiladi (`100000/3` → `33333.34 + 33333.33 +
33333.33`). Berilsa — ulushlar yig'indisi umumiy summaga **aniq teng** bo'lishi shart.

**Status.** Kategoriya chek talab qilmasa yozuv to'g'ridan-to'g'ri `DIRECTOR_PENDING` da
tug'iladi. `receiptRequired` bo'lsa — `DRAFT` da: chek yuklab, so'ng
`POST /expenses/:id/submit` chaqiriladi. Raqamlar baribir yaratilishda beriladi.

**Dublikat.** Bir xil xodim + kategoriya + summa + sana 10 daqiqa ichida takrorlansa,
javobga `duplicateWarning: { expenseId, globalNumber }` qo'shiladi — **bloklamaydi**.

Xatolar:

| Kod | Status | Sabab |
|---|---|---|
| `AMOUNT_NOT_POSITIVE` | 422 | summa ≤ 0 |
| `DATE_IN_FUTURE` | 422 | kelajakdagi sana |
| `COMMENT_REQUIRED` | 422 | kategoriya izoh talab qiladi |
| `CATEGORY_LIMIT_EXCEEDED` | 422 | `maxAmountPerEntry` dan oshdi |
| `CATEGORY_ARCHIVED` · `BRANCH_ARCHIVED` | 422 | arxivlangan yozuv |
| `EMPLOYEE_WRONG_BRANCH` | 422 | xodim boshqa filialda |
| `EMPLOYEE_INACTIVE` · `EMPLOYEE_NOT_FOUND` | 422 | xodim yaroqsiz |
| `SHARES_SUM_MISMATCH` | 422 | ulushlar yig'indisi mos emas |
| `SHARES_MISMATCH` | 422 | ulushlar ro'yxati xodimlarga mos emas |
| `SHARE_NOT_POSITIVE` | 422 | ulush ≤ 0 |
| `CURRENCY_RATE_MISSING` | 422 | o'sha sanaga kurs yo'q (TZ 3.5) |

### `POST /expenses/:id/files` → `201` — `multipart/form-data`

Maydon nomi `files`, 1–5 ta fayl. Tur mazmun (magic-byte) bo'yicha aniqlanadi:
jpg / png / webp / pdf, har biri ≤ 10 MB. Javob — `FileView[]`.

| Kod | Status |
|---|---|
| `FILE_TOO_LARGE` | 413 |
| `TOO_MANY_FILES` · `FILE_TYPE_NOT_ALLOWED` · `FILE_CONTENT_MISMATCH` | 422 |
| `EXPENSE_LOCKED` | 409 — yakunlangan xarajat (`APPROVED`, `REFUNDED`, …) |

### `DELETE /expenses/:id/files/:fileId` → `204`

### `POST /expenses/:id/submit` → `201`

`DRAFT` → `DIRECTOR_PENDING`. Kategoriya chek talab qilsa va fayl bo'lmasa —
`422 RECEIPT_REQUIRED`. Boshqa statusda — `422 INVALID_STATUS_TRANSITION`.

### `DELETE /expenses/:id` → `204`

**Soft delete**: yozuv bazadan o'chirilmaydi, `deletedAt` to'ldiriladi va audit
jurnaliga `expense.delete` yoziladi. Tasdiqlangan yoki qaytarilgan xarajat uchun —
`409 EXPENSE_NOT_DELETABLE` (buning o'rniga bekor qilish yoki qaytarish ishlatiladi).

---

## Tasdiqlash oqimi

Har bir xarajat, summasidan qat'i nazar, **ikki bosqichdan** o'tadi:

```
DRAFT ──submit──> DIRECTOR_PENDING ──approve──> ADMIN_PENDING ──approve──> APPROVED
                         │                            │
                         ├──reject──────> REJECTED <───┤
                         ├──request-fix─> NEEDS_FIX <──┤
                         └──cancel──────> CANCELLED    │
                                  NEEDS_FIX ──submit──>┘  (oqim 1-bosqichdan)
```

| Bosqich | Kim hal qiladi |
|---|---|
| `DIRECTOR_PENDING` | filial direktori **yoki** bosh admin |
| `ADMIN_PENDING` | faqat bosh admin (direktor → `403 STAGE_FORBIDDEN`) |

- **Direktor o'zi kiritgan** xarajat 1-bosqichni o'tkazib yuboradi va darhol
  `ADMIN_PENDING` bo'ladi — yaratishda ham, `NEEDS_FIX` dan qaytganda ham.
- **Four-eyes:** bosh admin o'zi kiritgan xarajatni tasdiqlay olmaydi
  (`403 SELF_APPROVAL_FORBIDDEN`). Tizimda boshqa faol bosh admin qolmagan bo'lsa
  amal o'tadi, lekin yozuvda `selfApproved: true` qoladi va audit shuni ko'rsatadi.
- Har bir o'tish `expense_status_history` ga yoziladi (kim, qachon, sabab, kanal).
- Faqat `APPROVED` xarajatlar hisobot va byudjet sarfida hisobga olinadi.

### Optimistik blokirovka

Barcha qaror endpointlari ixtiyoriy `version` qabul qiladi — kartochka ochilgandagi
qiymat. Berilmasa server o'qigan qiymat ishlatiladi. Ikkala holatda ham ikkinchi
tasdiqlovchi `409 ALREADY_PROCESSED` oladi.

### `POST /expenses/:id/submit` → `201`

`DRAFT` yoki `NEEDS_FIX` → 1-bosqich. Chek majburiy kategoriyada fayl bo'lmasa —
`422 RECEIPT_REQUIRED`. Qayta yuborilganda oldingi bosqich qarorlari tozalanadi
(`directorApprovedByUserId`, `adminApprovedByUserId`, `approvedAt` → `null`); tarix qoladi.

### `POST /expenses/:id/approve` → `201` → `ExpenseView`

```jsonc
{ "version": 3 }   // ixtiyoriy
```

| Kod | Status | Sabab |
|---|---|---|
| `STAGE_FORBIDDEN` | 403 | rol bu bosqichni hal qila olmaydi |
| `SELF_APPROVAL_FORBIDDEN` | 403 | four-eyes qoidasi |
| `ALREADY_PROCESSED` | 409 | boshqa tasdiqlovchi ulgurdi |
| `INVALID_STATUS_TRANSITION` | 422 | yakunlangan yoki mos kelmaydigan status |

### `POST /expenses/:id/reject` · `POST /expenses/:id/request-fix` → `201`

```jsonc
{ "reason": "Chek nusxasi o'qilmayapti", "version": 3 }
```

`reason` **majburiy, ≥ 10 belgi** — qisqasi `422`. `request-fix` yozuvni `NEEDS_FIX` ga
qaytaradi va oldingi bosqich qarorlarini tozalaydi.

### `POST /expenses/:id/cancel` → `201`

Faqat **kiritgan shaxs**, faqat `DRAFT` / `DIRECTOR_PENDING` / `NEEDS_FIX` da.
Boshqa foydalanuvchi → `403 NOT_EXPENSE_OWNER`.

### `POST /expenses/bulk-approve` → `201`

```jsonc
{ "ids": ["uuid", "uuid"] }        // 1–20 ta
```

```jsonc
{
  "approved": ["uuid"],
  "failed": [
    { "id": "uuid", "code": "INVALID_STATUS_TRANSITION", "message": "…" }
  ]
}
```

Har bir ariza **o'z tranzaksiyasida** qayta ishlanadi: bittasi yiqilsa qolganlari o'tadi.
20 tadan ortiq id → `422`.

### Eslatma

Soatlik cron `approval.reminderHours` (sukut 24) dan uzoq navbatda turgan arizalar
bo'yicha tasdiqlovchiga `APPROVAL_REMINDER` bildirishnomasi yuboradi:
`DIRECTOR_PENDING` → filial direktorlari, `ADMIN_PENDING` → bosh adminlar.
Bitta ariza bo'yicha eslatma **bir marta** yuboriladi.

---

## Tahrirlash

### `PATCH /expenses/:id` → `200` → `ExpenseView` — `ADMIN`, `DIRECTOR`

```jsonc
{
  "reason": "Chek summasi noto'g'ri kiritilgan edi",  // majburiy, ≥ 10 belgi
  "amount": "175000.00",
  "currency": "USD",
  "date": "2026-08-11",
  "categoryId": "uuid",
  "comment": "…",
  "paymentMethod": "CARD",
  "employeeIds": ["uuid"],                            // berilsa taqsimlash qayta quriladi
  "shares": [{ "employeeId": "uuid", "amount": "175000.00" }]
}
```

Raqamlar, status, kim kiritgani va qaytarilgan summa **hech qachon tahrirlanmaydi**.

**Qachon mumkin:**

| Status | Shart |
|---|---|
| `DRAFT` · `DIRECTOR_PENDING` · `NEEDS_FIX` | oynasiz — hali qaror chiqmagan |
| `APPROVED` | `approvedAt` dan `expense.editWindowHours` (sukut **24 soat**) ichida |
| `ADMIN_PENDING` | ❌ direktor qarori chiqqan — `request-fix` ishlatiladi |
| `REJECTED` · `CANCELLED` · `REFUNDED` | ❌ |

**Kurs snapshot i:** faqat `currency` yoki `date` o'zgarganda qayta hisoblanadi (asl
snapshot noto'g'ri kirishga tayangan edi). Faqat summa o'zgarsa eski kurs saqlanadi —
tarixiy kurs muzlatiladi (TZ 3.5).

Har tahrir `audit_log` ga **eski → yangi** ko'rinishida va `expense_status_history` ga
(status o'zgarmagan yozuv, sabab bilan) tushadi.

| Kod | Status | Sabab |
|---|---|---|
| `EDIT_WINDOW_CLOSED` | 422 | 24 soat o'tgan — «Tahrirlash muddati tugagan» |
| `EXPENSE_NOT_EDITABLE` | 422 | status tahrirlashga yopiq |
| `AMOUNT_BELOW_REFUNDED` | 422 | summa qaytarilgan miqdordan kichik |
| `CATEGORY_LIMIT_EXCEEDED` · `COMMENT_REQUIRED` · `SHARES_SUM_MISMATCH` | 422 | yaratishdagi kabi |

---

## Tahrirlash murojaatlari

Ishchi Web ERP ga kira olmaydi, shuning uchun murojaatni **bot** yuboradi (S16);
Web tomonida direktor yoki bosh admin uni qo'llaydi yoki rad etadi.

### `GET /edit-requests`

| Query | Qiymat |
|---|---|
| `status` | `PENDING` · `APPLIED` · `REJECTED` · `RESOLVED` (= APPLIED + REJECTED) |
| `expenseId` | uuid |

Direktor faqat o'z filiali xarajatlari bo'yicha murojaatlarni ko'radi.

```jsonc
// items[] elementi
{
  "id": "uuid",
  "expenseId": "uuid",
  "expenseGlobalNumber": "EXP-000123",
  "expenseBranchNumber": "CHL-2026-0045",
  "requestedByEmployeeId": "uuid",
  "requestedBy": "Ali Valiyev",
  "description": "Summa 150 000 emas, 175 000 bo'lishi kerak",
  "status": "PENDING",
  "handledByUserId": null,
  "handledAt": null,
  "rejectReason": null,
  "createdAt": "..."
}
```

### `GET /edit-requests/:id` → `EditRequestView`

### `POST /edit-requests` → `201`

```jsonc
{ "expenseId": "uuid", "description": "Nima o'zgarishi kerak" }   // ≥ 10 belgi
```

Bitta xarajat bo'yicha bir vaqtda faqat bitta ochiq murojaat — ikkinchisi
`409 EDIT_REQUEST_PENDING`. Murojaat filial direktorlariga (yo'q bo'lsa bosh adminlarga)
`EDIT_REQUEST_SUBMITTED` bildirishnomasi sifatida boradi.

### `POST /edit-requests/:id/apply` → `201` — `ADMIN`, `DIRECTOR`

```jsonc
{ "changes": { "reason": "…", "amount": "175000.00" } }   // ixtiyoriy
```

`changes` berilsa xarajat ham shu yerda tahrirlanadi — `PATCH /expenses/:id` bilan
bir xil qoidalar (oyna, sabab, audit). Berilmasa murojaat shunchaki `APPLIED` bo'ladi.

### `POST /edit-requests/:id/reject` → `201` — `ADMIN`, `DIRECTOR`

```jsonc
{ "reason": "…" }   // ≥ 10 belgi
```

Ko'rib chiqilgan murojaatni qayta hal qilishga urinish — `409 ALREADY_PROCESSED`.

---

## Qaytarish (Refund)

Asl xarajat yozuvi **o'zgarmaydi**: qaytarish alohida bog'langan yozuv, xarajatda esa
faqat `refundedAmount` va status yangilanadi.
**Effektiv summa = `amount − refundedAmount`** — hisobot va byudjet sarfida shu ishlatiladi.

```
POST /refunds (isbot fayli majburiy) → DIRECTOR_PENDING
      ↓ direktor
   ADMIN_PENDING
      ↓ bosh admin
   APPROVED → xarajat PARTIALLY_REFUNDED yoki REFUNDED
```

- Qaytarish faqat `APPROVED` yoki `PARTIALLY_REFUNDED` xarajatga yaratiladi
  (ikkinchisi — bitta xarajatga bir nechta qisman qaytarish uchun).
- Qaytarish summasi **qolgan summadan** oshmaydi. Qolgan summa hisobida hali ko'rilmagan
  so'rovlar ham chegiriladi.
- Kurs asl xarajatdan **meros olinadi** (`rateUsed`) — hisobot tarixi o'zgarmasligi uchun.
- Qaytarishlar yig'indisi to'liq summaga yetganda xarajat avtomatik `REFUNDED` bo'ladi.

### `GET /refunds`

| Query | Qiymat |
|---|---|
| `status` | `DIRECTOR_PENDING` · `ADMIN_PENDING` · `APPROVED` · `REJECTED` · `PENDING` (= ikkala navbat) |
| `expenseId` · `branchId` | uuid |

Direktor uchun natija avtomatik o'z filiali bilan cheklanadi.

```jsonc
// items[] elementi
{
  "id": "uuid",
  "expenseId": "uuid",
  "expenseGlobalNumber": "EXP-000123",
  "expenseBranchNumber": "CHL-2026-0045",
  "branchId": "uuid",
  "amount": "200000.00",
  "currency": "UZS",
  "rateUsed": "1.000000",
  "amountUzs": "200000.00",
  "reason": "Kompyuter qaytarildi, do'kon pulni qaytardi",
  "status": "DIRECTOR_PENDING",
  "requestedByUserId": "uuid",
  "directorApprovedByUserId": null,
  "adminApprovedByUserId": null,
  "approvedAt": null,
  "rejectReason": null,
  "version": 0,
  "createdAt": "...",
  "files": [{ "id": "uuid", "originalName": "kvitansiya.png", "mimeType": "image/png" }]
}
```

### `GET /refunds/:id` → `RefundView`

### `POST /refunds` → `201` — `multipart/form-data`

| Maydon | Izoh |
|---|---|
| `expenseId` | uuid |
| `amount` | `"200000.00"` |
| `reason` | ≥ 10 belgi |
| `files` | **majburiy**, 1–5 ta (jpg/png/webp/pdf, ≤ 10 MB) |

Isbot fayli istisnosiz majburiy — shuning uchun so'rov va fayl bitta chaqiruvda yuboriladi.
Faylning o'zi keyin `GET /files/:id/url` orqali signed URL bilan olinadi.

| Kod | Status | Sabab |
|---|---|---|
| `REFUND_PROOF_REQUIRED` | 422 | «Qaytarish uchun isbot majburiy» |
| `EXPENSE_NOT_REFUNDABLE` | 422 | xarajat tasdiqlanmagan |
| `REFUND_EXCEEDS_REMAINING` | 422 | qolgan summadan oshdi |
| `AMOUNT_NOT_POSITIVE` | 422 | summa ≤ 0 |

### `POST /refunds/:id/approve` → `201` — `ADMIN`, `DIRECTOR`

```jsonc
{ "version": 1 }   // ixtiyoriy, optimistik blokirovka
```

`DIRECTOR_PENDING` → `ADMIN_PENDING` → `APPROVED`. Ikkinchi bosqichni faqat bosh admin
hal qiladi (direktor → `403 STAGE_FORBIDDEN`); ikkinchi tasdiqlovchi
`409 ALREADY_PROCESSED` oladi.

Yakuniy tasdiqda xarajatning `refundedAmount` i oshadi va statusi
`PARTIALLY_REFUNDED` / `REFUNDED` bo'ladi; `audit_log` ga `expense.refunded` yoziladi.

### `POST /refunds/:id/reject` → `201` — `ADMIN`, `DIRECTOR`

```jsonc
{ "reason": "…", "version": 1 }   // reason ≥ 10 belgi
```

Rad etilgan so'rov xarajatga **ta'sir qilmaydi** va qolgan summani band qilmaydi.

---

## Byudjet va limitlar

Limit **yumshoq (soft)**: limitdan oshgan xarajat **bloklanmaydi**, faqat ogohlantiriladi.

- Turlari: `BRANCH` (filial oylik), `CATEGORY` (kategoriya oylik), `EMPLOYEE` (xodim boshiga).
- Belgilash huquqi — **faqat bosh admin**; ko'rish — admin va direktor.
- Davr sozlamadagi `report.periodStartDay` ga bog'lanadi (sukut `1` — kalendar oy).
- Sarf hisobida faqat ikki bosqichdan o'tgan xarajatlarning **effektiv summasi**
  (`amount − refundedAmount`) ishtirok etadi.
- Chegaralar **80%** va **100%** — har biri bir davrda **bir marta** xabar qiladi.

### `GET /budgets`

| Query | Qiymat |
|---|---|
| `scope` | `BRANCH` · `CATEGORY` · `EMPLOYEE` |
| `scopeId` | uuid |
| `on` | `YYYY-MM-DD` — shu sanaga amalda bo'lgan limitlar |

```jsonc
// items[] elementi
{
  "id": "uuid",
  "scope": "BRANCH",
  "scopeId": "uuid",
  "scopeName": "Chilonzor",
  "amount": "10000000.00",
  "currency": "UZS",
  "effectiveFrom": "2026-08-01",
  "effectiveTo": null,          // null — cheksiz
  "createdAt": "..."
}
```

### `GET /budgets/usage` → `BudgetUsageView[]`

Joriy (yoki `on` sanasidagi) davrdagi sarf — ro'yxatlardagi ⚠️ belgilari uchun.

| Query | Qiymat |
|---|---|
| `scope` | ixtiyoriy filtr |
| `on` | `YYYY-MM-DD` — sukut: bugun |

```jsonc
{
  "id": "uuid", "scope": "BRANCH", "scopeId": "uuid", "scopeName": "Chilonzor",
  "amount": "10000000.00", "currency": "UZS",
  "effectiveFrom": "2026-08-01", "effectiveTo": null, "createdAt": "...",
  "periodKey": "2026-08",
  "periodStart": "2026-08-01",
  "periodEnd": "2026-08-31",
  "spent": "8500000.00",
  "remaining": "1500000.00",
  "usedPercent": 85
}
```

### `GET /budgets/:id` → `BudgetView`

### `POST /budgets` → `201` — `ADMIN`

```jsonc
{
  "scope": "BRANCH",
  "scopeId": "uuid",
  "amount": "10000000.00",
  "currency": "UZS",            // ixtiyoriy, default UZS
  "effectiveFrom": "2026-08-01",
  "effectiveTo": null           // ixtiyoriy
}
```

| Kod | Status | Sabab |
|---|---|---|
| `SCOPE_NOT_FOUND` | 422 | filial / kategoriya / xodim topilmadi |
| `INVALID_DATE_RANGE` | 422 | tugash sanasi boshlanishdan oldin |
| `AMOUNT_NOT_POSITIVE` | 422 | limit ≤ 0 |
| `BUDGET_OVERLAP` | 409 | shu doiraga shu muddatda limit allaqachon bor |

### `PATCH /budgets/:id` — `ADMIN`

`amount`, `effectiveFrom`, `effectiveTo`. `effectiveTo: ""` — muddatni cheksizga o'zgartiradi.

### `DELETE /budgets/:id` → `204` — `ADMIN`

### Ogohlantirish: `budgetWarning`

`POST /expenses` javobiga qo'shiladi (yozuv baribir `201` bilan yaratiladi):

```jsonc
{
  "id": "…", "globalNumber": "EXP-000123", /* … ExpenseView … */
  "budgetWarning": [
    {
      "budgetId": "uuid",
      "scope": "BRANCH", "scopeId": "uuid", "scopeName": "Chilonzor",
      "limit": "10000000.00",
      "spent": "8000000.00",      // tasdiqlangan sarf
      "projected": "8500000.00",  // shu xarajat qo'shilgandan keyin
      "usedPercent": 85,
      "threshold": 80             // kesib o'tilgan chegara: 80 yoki 100
    }
  ]
}
```

Yangi yozuv hali `APPROVED` emas, ya'ni sarfda hisoblanmaydi — shuning uchun
`projected` da uning summasi qo'shib ko'rsatiladi.

**Bildirishnoma** (`BUDGET_THRESHOLD`) esa sarf haqiqatan o'zgarganda, ya'ni
**yakuniy tasdiqda** yuboriladi: bosh adminlarga va (filial/xodim limiti bo'lsa) o'sha
filial direktorlariga. Bir davrda bir chegara — bir marta.

---

## Bildirishnomalar

Yozish **ikki qatlamli**: `Notification` yozuvi darhol bazaga tushadi (Web badge i uchun),
Telegram yuborish esa BullMQ navbatiga qo'yiladi. Navbat yiqilsa ham foydalanuvchi
xabarni Web da ko'radi — navbat yagona yetkazish yo'li emas. Email kanali doiraga kirmaydi.

| Hodisa | `type` | Kimga |
|---|---|---|
| Yangi xarajat kiritildi | `EXPENSE_CREATED` | filial direktori (yo'q bo'lsa adminlar) |
| Direktor tasdiqladi | `EXPENSE_DIRECTOR_APPROVED` | bosh adminlar |
| Yakuniy tasdiqlandi | `EXPENSE_FINALIZED` | kiritgan shaxs |
| Rad etildi | `EXPENSE_REJECTED` | kiritgan shaxs |
| Tuzatish so'raldi | `FIX_REQUESTED` | kiritgan shaxs |
| Tahrirlash murojaati | `EDIT_REQUEST_SUBMITTED` | filial direktorlari |
| Qaytarish so'rovi | `REFUND_SUBMITTED` | direktorlar → adminlar |
| Qaytarish hal qilindi | `REFUND_RESOLVED` | so'rovchi |
| Limit 80% / 100% | `BUDGET_THRESHOLD` | adminlar + filial direktori |
| Javobsiz ariza | `APPROVAL_REMINDER` | tasdiqlovchi |
| Kurs olinmadi | `CURRENCY_RATE_FAILED` | adminlar |

### Navbat

- Job payload: `{ companyId, notificationId, userId, type, payload }` — `companyId`
  **majburiy**, processor tenant kontekstini shundan tiklaydi.
- **3 urinish**, eksponensial backoff (`delay: 2000`). Uchinchisidan keyin job `failed`
  holatida qoladi va log yoziladi.
- Foydalanuvchi botni bloklagan bo'lsa (`403`) job **muvaffaqiyatli** yakunlanadi,
  qayta urinilmaydi, xodim kartochkasida `botBlocked = true` bo'ladi.
- Telegram yuborilgach `Notification.sentAt` to'ldiriladi.

### `GET /notifications`

Faqat **o'z** bildirishnomalari ko'rinadi.

| Query | Qiymat |
|---|---|
| `isRead` | `false` — o'qilmaganlar (badge ro'yxati) · `true` |
| `type` | yuqoridagi turlardan biri |

```jsonc
// items[] elementi
{
  "id": "uuid",
  "type": "EXPENSE_CREATED",
  "title": "Yangi xarajat: EXP-000123 — 150000.00",
  "payload": { "expenseId": "uuid", "globalNumber": "EXP-000123", "amount": "150000.00" },
  "channel": "WEB",
  "isRead": false,
  "readAt": null,
  "sentAt": "2026-08-12T09:00:01.000Z",   // Telegram ga yuborilgan vaqt
  "createdAt": "..."
}
```

`title` **serverda** tayyorlanadi va foydalanuvchining `language` iga (uz/ru) qarab
beriladi — Web badge i va Telegram xabari bir manbadan, mijozda takrorlanmaydi.

### `GET /notifications/unread-count` → `{ "count": 3 }`

### `POST /notifications/:id/read` → `204`

Boshqa foydalanuvchining yozuvi → `404`.

### `POST /notifications/mark-all-read` → `{ "updated": 3 }`

---

## Valyuta

Qo'llab-quvvatlanadigan valyutalar: **UZS** va **USD**. Hisobot valyutasi — UZS.

### `GET /currency/rates`

`?from=YYYY-MM-DD&to=YYYY-MM-DD&currency=USD` — oxirgi 400 yozuv, sana bo'yicha kamayish tartibida.

```jsonc
[
  { "id": "uuid", "date": "2026-08-12", "currency": "USD",
    "rate": "12650.500000", "source": "AUTO", "createdAt": "..." }
]
```

### `GET /currency/rates/current?currency=USD`

Xarajat formasida UZS ekvivalentini oldindan ko'rsatish uchun.

```jsonc
{ "currency": "USD", "rate": "12650.500000", "source": "AUTO", "rateDate": "2026-08-11" }
```

`rateDate` so'ralgan sanadan **eski bo'lishi mumkin**: aniq kunga kurs bo'lmasa
(dam olish kuni, bayram) oldingi eng yaqin kurs ishlatiladi.

### `POST /currency/rates` — `ADMIN` → `201`

```jsonc
{ "date": "2026-08-10", "currency": "USD", "rate": "12650.5" }
```

Bir kunga takroriy yuborish **yangilaydi** (dublikat yaratmaydi).

| Xato | Status |
|---|---|
| `RATE_NOT_POSITIVE` | 422 |
| `CURRENCY_NOT_CONVERTIBLE` | 422 (UZS uchun kurs kiritilmaydi) |

### `GET /currency/base` · `POST /currency/base` — o'qish barchaga, yozish `ADMIN`

```jsonc
{ "mode": "AUTO" }   // AUTO = CBU kurslari, MANUAL = qo'lda kiritilganlar
```

Hisob bazasi **barcha konvertatsiya va hisobotlarga** ta'sir qiladi (TZ 3.5).
`MANUAL` tanlangan bo'lsa CBU kurslari umuman ishlatilmaydi — kerakli sanaga qo'lda
kurs kiritilmagan bo'lsa USD xarajat yaratish `422 CURRENCY_RATE_MISSING` bilan bloklanadi.

### Kurs snapshot i

Xarajat yaratilganda o'sha sanadagi kurs yozuvga **ko'chirib olinadi** (`rateUsed`,
`rateSource`, `amountUzs`). Keyin kurs o'zgarsa tarixiy hisobot **o'zgarmaydi**.

### CBU sinxronizatsiyasi

Har kuni **09:00 (Asia/Tashkent)** avtomatik tortiladi. CBU javob bermasa:
oxirgi ma'lum kurs kuchda qoladi, cron yiqilmaydi, bosh adminlarga
`CURRENCY_RATE_FAILED` bildirishnomasi yuboriladi.

---

## ⏳ Rejada (keyingi bosqichlar)

| Endpoint | Bosqich |
|---|---|
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
