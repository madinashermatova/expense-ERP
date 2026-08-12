# API ma'lumotnomasi

Base URL: `http://localhost:3000/api` · Barcha javoblar JSON · Vaqt UTC (ISO 8601)

> Bu hujjat **amalda ishlaydigan** endpointlarni tavsiflaydi va har bosqichda yangilanadi.
> Rejalashtirilgan, lekin hali yozilmagan endpointlar «⏳ rejada» belgisi bilan.
> Rejaning o'zi: [`ROADMAP.md`](ROADMAP.md) · Frontend uchun ko'rsatmalar: [`FRONTEND-TZ.md`](FRONTEND-TZ.md)

Holat: **S1–S7 tayyor** (tenancy, auth, tashkilot, fayllar, valyuta, xarajatlar, tasdiqlash oqimi)

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
| `PATCH /expenses/:id` (24 soatlik tahrirlash oynasi) | S8 |
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
