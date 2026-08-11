# Dizayn TZ — Web ERP

Versiya: 1 | Sana: 2026-08-12 | Asos: [`TZ.md`](TZ.md) 4.3, 5.5 · Amaliyot: [`FRONTEND-TZ.md`](FRONTEND-TZ.md)

---

## 1. Dizayn falsafasi

Bu **ish quroli**, marketing sayti emas. Foydalanuvchi kuniga o'nlab arizani ko'rib chiqadi,
raqamlarni taqqoslaydi, hisobot chiqaradi. Shuning uchun:

| Tamoyil | Amalda nimani anglatadi |
|---|---|
| **Ma'lumot birinchi** | Bezak minimal, ekranning ≥70% i mazmun. Katta hero bloklar yo'q |
| **Zichlik boshqariladi** | Jadval standart "compact" (qator 44px), "comfortable" (56px) rejimi bor |
| **Bir qarashda holat** | Status, limitdan oshish, chek bor-yo'qligi — rang + ikonka + matn (faqat rang emas) |
| **Xatoni oldini olish** | Qaytarib bo'lmaydigan amallar (arxivlash, o'chirish, tasdiqlash) — tasdiq dialogi |
| **Tez** | Skeleton, optimistik yangilanish yo'q (moliyaviy amal — faqat server javobidan keyin) |
| **Ikki til teng** | Ruscha matn uzunroq — hech qanday fixed width yo'q |

**Ilhom:** Linear ning tozaligi + Stripe Dashboard ning ma'lumot zichligi.
Ranglar kam, tipografiya kuchli, chegaralar nozik.

---

## 2. Rang tizimi (dizayn tokenlari)

CSS o'zgaruvchilari sifatida `styles/globals.css` da, shadcn/ui konvensiyasida
(HSL, `hsl(var(--token))`).

### Light (asosiy)

```css
:root {
  /* Neytral — asosiy karkas */
  --background:        0 0% 100%;      /* #FFFFFF */
  --foreground:        222 20% 12%;    /* #191D24  asosiy matn */
  --muted:             220 14% 96%;    /* #F4F5F7  fon bloklari */
  --muted-foreground:  220 9% 46%;     /* #6B7280  ikkilamchi matn */
  --border:            220 13% 91%;    /* #E4E6EB */
  --input:             220 13% 91%;
  --card:              0 0% 100%;
  --card-foreground:   222 20% 12%;

  /* Brend — to'q ko'k (ishonch, moliya) */
  --primary:           222 62% 44%;    /* #2B55B4 */
  --primary-foreground:0 0% 100%;
  --primary-hover:     222 62% 38%;
  --primary-subtle:    222 62% 96%;    /* fon uchun */

  /* Semantik */
  --success:           152 56% 34%;    /* #218757  tasdiqlangan */
  --success-subtle:    152 56% 95%;
  --warning:           38 92% 44%;     /* #D68B07  limit 80%, kutilmoqda */
  --warning-subtle:    38 92% 95%;
  --destructive:       0 65% 48%;      /* #CA2B2B  rad etilgan, o'chirish */
  --destructive-subtle:0 65% 96%;
  --info:              205 78% 43%;    /* #1B7FC4  ma'lumot */
  --info-subtle:       205 78% 95%;

  --ring:              222 62% 44%;
  --radius:            0.5rem;
}
```

### Dark

```css
.dark {
  --background:        222 24% 9%;     /* #10131A */
  --foreground:        220 14% 93%;
  --muted:             222 18% 15%;
  --muted-foreground:  220 10% 62%;
  --border:            222 16% 20%;
  --input:             222 16% 20%;
  --card:              222 22% 12%;
  --card-foreground:   220 14% 93%;

  --primary:           222 70% 62%;    /* dark da yorug'roq */
  --primary-foreground:222 30% 10%;
  --primary-hover:     222 70% 68%;
  --primary-subtle:    222 40% 18%;

  --success:           152 48% 48%;
  --success-subtle:    152 30% 16%;
  --warning:           38 84% 56%;
  --warning-subtle:    38 40% 18%;
  --destructive:       0 62% 58%;
  --destructive-subtle:0 40% 18%;
  --info:              205 70% 58%;
  --info-subtle:       205 40% 18%;
}
```

**Qoida:** hech qanday rang komponent ichida hardcode qilinmaydi — faqat token.
Dark rejim **nice-to-have** (TZ 4.3), lekin tokenlar birinchi kundan ikkalasi uchun yoziladi.

### Status ranglari (xarajat)

| Status | Rang | Badge ko'rinishi |
|---|---|---|
| `DRAFT` | neytral | kulrang, ⚪ |
| `DIRECTOR_PENDING` | warning | sariq, ⏳ "Direktor tasdig'ida" |
| `ADMIN_PENDING` | info | ko'k, ⏳ "Yakuniy tasdiqda" |
| `NEEDS_FIX` | warning (to'q) | to'q sariq, ✏️ "Tuzatish so'raldi" |
| `APPROVED` | success | yashil, ✅ "Tasdiqlangan" |
| `REJECTED` | destructive | qizil, ❌ "Rad etilgan" |
| `CANCELLED` | neytral | kulrang, ⊘ "Bekor qilingan" |
| `PARTIALLY_REFUNDED` | info | ko'k chegara, ↩️ "Qisman qaytarilgan" |
| `REFUNDED` | neytral + chiziq | kulrang, ↩️ "Qaytarilgan" |

Badge — **doim ikonka + matn**, faqat rang emas (rang ko'rmaydigan foydalanuvchilar uchun).

### Byudjet foizi

`<80%` success · `80–99%` warning · `≥100%` destructive.
Progress bar + foiz raqami + tooltip da "1 250 000 / 1 500 000 so'm".

---

## 3. Tipografiya

| Rol | Font | O'lcham / qalinlik |
|---|---|---|
| Interfeys | **Inter** (variable), fallback: `system-ui, -apple-system, "Segoe UI", sans-serif` | |
| Raqam/pul | **Inter Tabular** (`font-variant-numeric: tabular-nums`) | jadvalda majburiy |
| Kod / raqamlash (`EXP-000123`) | `ui-monospace, "JetBrains Mono", monospace` | 13px |

```
display   28px / 34px / 600   — sahifa sarlavhasi (kam ishlatiladi)
h1        22px / 28px / 600   — ekran sarlavhasi
h2        18px / 26px / 600   — bo'lim
h3        15px / 22px / 600   — karta sarlavhasi
body      14px / 21px / 400   — asosiy matn (ERP uchun 14px optimal)
body-sm   13px / 19px / 400   — jadval, ikkilamchi
caption   12px / 16px / 500   — yorliq, badge, yordam matni
number-lg 24px / 30px / 600   — KPI raqami, tabular
```

**Qoidalar:**
- Matn kengligi ≤ 75 belgi (uzun tavsiflar uchun `max-w-prose`)
- Sarlavhalarda BOSH HARF bilan yozish yo'q (o'zbek/rus tilida yomon o'qiladi)
- Pul summasi **doim** tabular-nums va o'ngga tekislangan
- Kirill va lotin bir xil fontda — Inter ikkalasini qamrab oladi

---

## 4. Layout va masofa

### Grid

- Spacing shkalasi: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (Tailwind `1,2,3,4,6,8,12,16`)
- Sahifa padding: `24px` (desktop), `16px` (<1024px)
- Kartalar orasi: `16px`, bo'limlar orasi: `32px`

### Ilova karkasi

```
┌──────────────────────────────────────────────────────────┐
│ Header (56px): logo · qidiruv · til · bildirishnoma · avatar │
├────────────┬─────────────────────────────────────────────┤
│ Sidebar    │  PageHeader (sarlavha + amal tugmalari)     │
│ 248px      │  ────────────────────────────────────────   │
│ (yig'ilsa  │  FilterBar (yopishqoq)                      │
│  64px)     │  ────────────────────────────────────────   │
│            │  Mazmun                                      │
└────────────┴─────────────────────────────────────────────┘
```

- **Sidebar:** guruhlangan menyu (Asosiy · Tasdiqlash · Tashkilot · Moliya · Tizim),
  faol element chap tomonda 3px `primary` chiziq + `primary-subtle` fon.
  Tasdiqlash kutayotgan sonlar badge bilan. `Ctrl/Cmd + B` bilan yig'iladi.
- **Header:** global qidiruv (`Ctrl/Cmd + K` — xarajat raqami, xodim, filial bo'yicha).
- **PageHeader:** sarlavha chapda, birlamchi amal o'ngda (faqat **bitta** birlamchi tugma).

### Breakpointlar

| Nom | Kenglik | Xatti-harakat |
|---|---|---|
| `xl` | ≥1280 | To'liq layout, sidebar ochiq |
| `lg` | 1024–1279 | Sidebar yig'ilgan (ikonka) |
| `md` | 768–1023 | Sidebar overlay, jadval gorizontal scroll, filtrlar drawer da |
| `sm` | <768 | Asosiy ekranlar ishlaydi (ro'yxat karta ko'rinishida), murakkab
formalar uchun ogohlantirish |

**Desktop-first** — TZ 4.3 bo'yicha planshetda to'liq ishlashi shart, telefon — ixtiyoriy.

---

## 5. Komponentlar

### Jadval (`DataTable`) — eng muhim komponent

- Sarlavha qatori: `muted` fon, `caption` o'lchami, **yopishqoq** (sticky)
- Qator balandligi: compact 44px / comfortable 56px (foydalanuvchi tanlaydi, saqlanadi)
- Zebra yo'q; o'rniga nozik `border-b` (1px `--border`)
- Hover: `muted` fon; tanlangan qator: `primary-subtle`
- Ustun tekislash: matn — chap, sana — chap, summa/son — **o'ng**, status/amal — markaz
- Saralanadigan ustun sarlavhasida ↑↓ ikonka (faol bo'lganda `primary`)
- Birinchi ustun (raqam) — yopishqoq (sticky left) gorizontal scroll da
- Amallar ustuni — `⋯` menyu (3 tadan ko'p amal bo'lsa), o'ngda yopishqoq
- Bulk tanlash: checkbox ustuni + tanlanganda yuqorida floating panel
  ("5 ta tanlandi · Tasdiqlash · Eksport · Bekor qilish")
- Bo'sh holat: markazda ikonka + tushuntirish + birlamchi amal tugmasi
- Yuklanish: 5–8 qator skeleton (haqiqiy ustun kengliklari bilan)

### Formalar

- Yorliq maydon **ustida** (yon tomonda emas) — ruscha uzun matn uchun
- Majburiy maydon: yorliqdan keyin `*` (destructive rang)
- Yordam matni yorliq ostida `caption` bilan; xato — maydon ostida, destructive + ikonka
- Maydon balandligi 40px, radius `--radius`
- Fokus: 2px `ring` + 2px offset (klaviatura navigatsiyasi ko'rinishi shart)
- Guruhlangan formalar `Card` ichida, bo'lim sarlavhasi bilan
- Saqlash paneli uzun formalarda **pastda yopishqoq** (Bekor qilish + Saqlash)

### Tugmalar

| Variant | Qachon |
|---|---|
| `primary` | Sahifadagi asosiy amal — **ekranda bittadan ko'p emas** |
| `secondary` | Yordamchi amallar |
| `ghost` | Jadval ichidagi amallar, ikonka tugmalar |
| `destructive` | O'chirish, rad etish — **doim tasdiq dialogi bilan** |
| `success` | Tasdiqlash tugmasi (tasdiqlash navbatida) |

O'lchamlar: `sm` 32px · `md` 40px (default) · `lg` 44px.
Yuklanishda spinner + matn "Saqlanmoqda…", tugma disabled.

### Dialoglar

- Tasdiq dialogi: sarlavha savol shaklida, tanada oqibat tushuntiriladi,
  destructive amalda tugma qizil va **ikkinchi o'rinda** (chapda "Bekor qilish")
- Sabab talab qiladigan dialoglar (rad etish, tuzatish, tahrirlash): textarea +
  **jonli belgi hisoblagichi** (`10/10 minimal`), 10 belgigacha tugma bloklangan
- Fayl preview: lightbox (Esc bilan yopiladi, ←/→ bilan navigatsiya)

### Bildirishnomalar (toast)

- O'ng yuqorida, 4 s (xato — 6 s yoki qo'lda yopiladi)
- Turlar: success / warning / destructive / info — ikonka bilan
- Byudjet ogohlantirishi — warning toast, "Batafsil" havolasi bilan

### Grafiklar (Recharts)

Kategoriya palitrasi (ketma-ket, kontrastli, dark da ham ishlaydi):

```
1 #2B55B4  2 #218757  3 #D68B07  4 #8B5CF6  5 #0EA5E9
6 #DB2777  7 #14B8A6  8 #F97316  9 #6366F1  10 #64748B
```

- Grid chiziqlari — `--border`, faqat gorizontal
- O'q yorliqlari — `caption`, `muted-foreground`
- Tooltip — karta uslubida, pul formatlangan holda
- Legend — grafik ostida, gorizontal
- Pie/donut — 6 tadan ko'p segment bo'lsa qolganlari "Boshqa" ga yig'iladi
- Bo'sh ma'lumot: "Bu davr uchun ma'lumot yo'q" + davr o'zgartirish taklifi

### Pul ko'rsatish (`MoneyText`)

```
150 000 so'm          — UZS, mingliklar nozik bo'shliq bilan
$1 250.00             — USD
150 000 so'm          — asosiy
≈ 1 250 000 so'm      — USD yozuvda UZS ekvivalenti caption bilan ostida
```

Manfiy/qaytarilgan summa — destructive rang + `−` belgisi.
Qaytarilgan xarajat qatorida asl summa ustidan chizilgan, yonida effektiv summa.

---

## 6. Ikonkalar

**lucide-react** — yagona to'plam. O'lcham 16px (matn ichida), 20px (tugma), 24px (bo'sh holat).
Ikonka **hech qachon yolg'iz ma'no tashimaydi** — tooltip yoki matn bilan.

Asosiy moslik: xarajat `Receipt` · tasdiqlash `CheckCircle2` · rad etish `XCircle` ·
qaytarish `Undo2` · tahrirlash `PencilLine` · filial `Building2` · xodim `Users` ·
kategoriya `FolderTree` · byudjet `Target` · hisobot `BarChart3` · eksport `Download` ·
audit `ScrollText` · sozlama `Settings` · valyuta `Coins` · bildirishnoma `Bell`.

---

## 7. Holatlar (har bir ekranda majburiy)

| Holat | Ko'rinish |
|---|---|
| **Loading** | Skeleton (spinner emas) — haqiqiy layout shaklida |
| **Empty** | Ikonka (24px, muted) + sarlavha + 1 jumla tushuntirish + birlamchi amal |
| **Empty (filtr natijasi)** | "Filtr bo'yicha natija topilmadi" + "Filtrni tozalash" tugmasi |
| **Error** | Ikonka + "Ma'lumotni yuklab bo'lmadi" + "Qayta urinish" tugmasi |
| **Forbidden (403)** | Qulf ikonkasi + "Bu bo'limga ruxsatingiz yo'q" + bosh sahifa havolasi |
| **Not found (404)** | "Yozuv topilmadi yoki o'chirilgan" |
| **Offline** | Yuqorida yopishqoq banner |

---

## 8. Kirish imkoniyati (a11y) — WCAG 2.1 AA

- Kontrast: oddiy matn ≥4.5:1, katta matn va ikonkalar ≥3:1 (light va dark da tekshiriladi)
- Fokus ko'rinishi: **hech qachon `outline: none` siz** — 2px ring + offset
- Barcha interaktiv element klaviatura bilan: `Tab` tartibi mantiqiy, dialogda fokus tuzoq
- Modal ochilganda fokus ichkariga, yopilganda chaqirgan elementga qaytadi
- Jadval: `<th scope>` , saralash holati `aria-sort` bilan
- Forma: har bir input `<label for>` bilan bog'langan, xato `aria-describedby` + `aria-invalid`
- Status/o'zgarish e'lonlari — `aria-live="polite"` (toast uchun)
- Ikonka-tugmalarda `aria-label` (i18n dan)
- Animatsiya: `prefers-reduced-motion` hurmat qilinadi

---

## 9. Harakat (motion)

Minimal va tez — ERP da animatsiya diqqatni chalg'itmasligi kerak.

| Element | Davomiylik | Easing |
|---|---|---|
| Hover / fokus | 120ms | `ease-out` |
| Dropdown, popover | 150ms | `ease-out` |
| Dialog | 200ms (fade + 4px yuqoriga) | `ease-out` |
| Sidebar yig'ilishi | 200ms | `ease-in-out` |
| Toast | 200ms (o'ngdan sirg'alish) | `ease-out` |
| Skeleton shimmer | 1.5s cheksiz | `linear` |

Sahifa o'tishlarida animatsiya **yo'q**. Grafiklar birinchi renderda 400ms animatsiya,
keyingi yangilanishlarda yo'q.

---

## 10. Kontent va til qoidalari

- Murojaat: **siz** (rasmiy), buyruq shaklida ("Saqlang" emas, "Saqlash")
- Tugma matni — fe'l ("Tasdiqlash", "Qaytarish yaratish"), ≤3 so'z
- Xato xabari: nima bo'ldi + nima qilish kerak
  - ❌ "Xatolik yuz berdi"
  - ✅ "Chek yuklanmadi: fayl hajmi 10 MB dan oshmasligi kerak"
- Bo'sh holat: ayblovsiz, keyingi qadamni taklif qiladi
- Sonlar: mingliklar **nozik bo'shliq** bilan (`150 000`), o'nlik — vergul (`150 000,50`)
  o'zbek va rus tilida ikkalasida
- Sana: `06.08.2026` (qisqa), `6-avgust, 2026` (batafsil), vaqt `14:30`
- Filial raqami va global raqam — monospace, nusxalash tugmasi bilan

---

## 11. Yetkazib berish talablari

Frontend ishlab chiquvchi quyidagilarni tayyorlaydi:

1. `styles/globals.css` — yuqoridagi barcha tokenlar (light + dark)
2. `tailwind.config.ts` — tokenlarga bog'langan tema kengaytmasi
3. `components/ui/` — shadcn/ui komponentlari (button, input, select, dialog, table,
   dropdown-menu, badge, card, tabs, toast, tooltip, popover, calendar, checkbox,
   radio-group, textarea, skeleton, progress, alert, sheet, command)
4. `components/shared/` — `DataTable`, `PageHeader`, `FilterBar`, `StatusBadge`,
   `MoneyText`, `EmptyState`, `ErrorState`, `ConfirmDialog`, `ReasonDialog`,
   `FileDropzone`, `DateRangePicker`, `RoleGate`, `ExportButton`, `BudgetProgress`
5. Storybook **ixtiyoriy** — lekin `components/shared/` uchun tavsiya etiladi

**Dizayn fayli (Figma) shart emas** — ushbu hujjat va shadcn/ui bilan to'g'ridan-to'g'ri
kodda ishlash ko'zda tutilgan. Agar Figma tuzilsa, tokenlar shu yerdagi qiymatlardan olinadi.
