# DentaCare — Zamonaviy Stomatologiya Klinikasi Markaziy Web Tizimi 🦷

Ushbu loyiha zamonaviy stomatologiya klinikalari faoliyatini to‘liq avtomatlashtirish, qabullarni boshqarish, bemorlar bazasini yuritish, kassa-to‘lov hisob-kitoblarini olib borish va moliyaviy savdo tahlilini yuritish uchun yaratilgan professional web tizim hisoblanadi.

Loyiha kompyuterlar va planshetlardan bir vaqtda **markaziy PostgreSQL ma’lumotlar bazasi** bilan ishlashga to‘liq moslashtirilgan.

---

## 🏛️ Tizim Arxitekturasi

- **Frontend:** React Native Web (Expo SDK 51) — Kompyuter va planshet ekranlariga to‘liq moslashuvchan (Responsive) interfeys.
- **Backend API:** Node.js HTTP/REST API (`serve-web.js` + `server/apiRouter.js`) — Port 3000.
- **Ma’lumotlar Bazasi:** **PostgreSQL 16** — Barcha bemorlar, qabullar, to‘lovlar, shifokorlar, xodimlar va sozlamalar doimiy relatsion jadvallarda saqlanadi.
- **Xavfsizlik:** PIN-kodlar PBKDF2 va unikal tuz (salt) orqali heshlangan (`server/cryptoUtils.js`), audit log jurnali (`audit_logs` jadvali).
- **Tarmoq (LAN):** Bitta klinika Wi-Fi/LAN tarmog‘ida kompyuter va planshetlardan bir xil markaziy ma’lumotlar bilan ishlash imkoniyati.

---

## 🚀 Ishga Tushirish Bo‘yicha Qo‘llanma

### 1-USUL: Docker Compose orqali (Tavsiya etiladi — PostgreSQL 16 bilan)

Agar kompyuteringizda Docker Desktop o‘rnatilgan bo‘lsa:

```bash
# Faqat PostgreSQL bazasini fonda ishga tushirish:
docker compose up -d postgres

# Baza holatini tekshirish:
docker compose ps
```

Keyin Node.js server va web ilovani odatdagidek ishga tushirasiz:
```bash
# Backend serverni ishga tushirish (3000-port):
node serve-web.js

# Frontend Expo Web (8081-port):
npm run dev
```

---

### 2-USUL: Lokal PostgreSQL (Windows xizmati yoki PgAdmin)

1. Kompyuteringizda PostgreSQL o‘rnatilgan bo‘lsa (port 5432):
2. `dentacare` nomli bo‘sh ma’lumotlar bazasini yarating:
   ```sql
   CREATE DATABASE dentacare;
   ```
3. Loyihadagi `.env` faylida PostgreSQL parolini ko‘rsating:
   ```env
   DATABASE_URL=postgresql://postgres:parolingiz@localhost:5432/dentacare
   ```
4. Backend serverni ishga tushiring:
   ```bash
   node serve-web.js
   ```
   *Barcha SQL jadvallar (`server/schema.sql`) va boshlang‘ich katalog avtomatik tarzda yaratiladi va tekshiriladi!*

---

## 📱 Planshet va Boshqa Kompyuterlardan Ulanish (LAN Yo‘riqnomasi)

Klinika qabulxonasidagi kompyuter, shifokorlar xonasi va planshetlar bir xil bazada ishlashi uchun:

1. **Server kompyuterining lokal IP manzilini aniqlang:**
   Windows buyruqlar satrida (cmd / powershell):
   ```cmd
   ipconfig
   ```
   `IPv4 Address` qatorini toping (masalan: `192.168.1.15`).

2. **`.env` faylini sozlang:**
   Loyihaning `.env` faylida quyidagi qatorni yozing:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.15:3000
   ```

3. **Planshet orqali ulanish:**
   - Planshetni klinikaning o‘sha Wi-Fi tarmog‘iga ulang.
   - Planshet brauzerida (Chrome / Safari) quyidagi manzilni oching:
     ```
     http://192.168.1.15:8081
     ```
     *(yoki ishlab chiqarish buildida: `http://192.168.1.15:3000`)*

4. Endi kompyuterda kiritilgan bemor yoki to‘lov bir zumda planshetda ham ko‘rinadi!

---

## 📦 Lokal Ma’lumotlarni Markaziy Bazaga Ko‘chirish (Migratsiya)

Ilgari brauzer xotirasida (`localStorage`) saqlanib kelgan ma’lumotlarni markaziy PostgreSQL bazasiga xavfsiz o‘tkazish:

1. DentaCare tizimiga Menejer (PIN: `1234`) sifatida kiring.
2. Chap menyudan **“Sozlamalar”** bo‘limiga o‘ting.
3. **“Markaziy PostgreSQL Baza & Zaxira Boshqaruvi”** bo‘limiga tushing:
   - **1-qadam:** “Lokal Zaxira Faylini Yuklab Olish (.json)” tugmasini bosing — kompyuteringizga barcha mavjud bemorlar, qabullar va to‘lovlar zaxira nusxa qilib yuklab olinadi.
   - **2-qadam:** “Markaziy Bazasiga Import Qilish” tugmasini bosing.
4. Tizim takroriy yozuv yaratmasdan (idempotent `ON CONFLICT DO UPDATE`) barcha yozuvlarni PostgreSQL bazasiga ko‘chiradi va ekranda quyidagi hisobotni chiqaradi:
   - Ko‘chirilgan bemorlar soni
   - Ko‘chirilgan qabullar soni
   - Ko‘chirilgan to‘lovlar soni
   - Bazadagi jami tushum summasi
5. Import muvaffaqiyatli yakunlanmaguncha eski yozuvlar o‘chirilmaydi.

---

## 🔌 API Endpoints (REST)

| Marshrut | Metod | Tavsif |
|---|---|---|
| `/api/health` | GET | Server va PostgreSQL ulanish holati |
| `/api/auth/login` | POST | PIN tekshiruvi (PBKDF2 hash) va autentifikatsiya |
| `/api/auth/update-pin` | POST | Xodim PIN-kodini xavfsiz yangilash |
| `/api/staff` | GET, POST | Xodimlar ro‘yxati va yangi xodim qo‘shish |
| `/api/patients` | GET, POST, PUT, DELETE | Bemorlar CRUD amallari |
| `/api/appointments` | GET, POST, PUT, DELETE | Qabullar CRUD va vaqt to‘qnashuvini tekshirish |
| `/api/payments` | GET, POST | To‘lovlar yaratish va ro‘yxati |
| `/api/payments/:id/complete` | POST | To‘lovni yakunlash va bemor qarzini kamaytirish |
| `/api/payments/:id/refund` | POST | To‘lovni qaytarish |
| `/api/settings` | GET, PUT | Klinika sozlamalari |
| `/api/migrate/import` | POST | Zaxira ma’lumotlarni PostgreSQL ga ko‘chirish |
| `/api/migrate/export` | GET | Bazani to‘liq JSON fayl ko‘rinishida eksport qilish |
| `/api/migrate/stats` | GET | Baza yozuvlari va summalari statistikasi |
| `/api/telegram/*` | GET, POST | Telegram Bot integratsiyasi |
| `/api/sms/*` | GET, POST | Eskiz.uz SMS shlyuzi |

---

## 🛡️ Xavfsizlik va Tranzaksiyalar

- **Tranzaksiyalar (`BEGIN / COMMIT / ROLLBACK`):** Qabul holati "Yakunlandi"ga o‘tganda to‘lov yaratilishi va bemor qarzining o‘zgarishi bitta atomic tranzaksiyada bajariladi.
- **PIN Xavfsizligi:** PIN kodlar ochiq matnda saqlanmaydi. Har bir xodim uchun alohida salt yaratilib, 10 000 marta iteratsiyali PBKDF2 SHA-512 heshi saqlanadi.
- **Offline Himoya:** Server yoki tarmoq vaqtincha uzilib qolganda ma’lumotlar yo‘qolmaydi, foydalanuvchiga sariq/qizil ogohlantirish banneri ko‘rsatiladi va qayta tekshirish imkoni beriladi.
