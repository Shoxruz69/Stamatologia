const url = require('url');
const db = require('./db');
const { hashPin, verifyPin, generateSessionToken } = require('./cryptoUtils');
const AuditLogger = require('./auditLogger');

const auditLogger = new AuditLogger(db);

/**
 * Request body'sini JSON sifatida o'qish uchun yordamchi funksiya
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        // 20MB limit
        req.destroy();
        reject(new Error('So‘rov hajmi juda katta'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(new Error('Noto‘g‘ri JSON format: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message, code = 'ERROR') {
  sendJson(res, statusCode, { ok: false, error: message, code });
}

/**
 * O'zbekiston telefon raqamini standart formatga keltirish (+998 90 123 45 67)
 */
function normalizeUzbekPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  let national = digits;
  if (digits.startsWith('998') && digits.length >= 12) {
    national = digits.slice(3, 12);
  } else if (digits.length >= 9) {
    national = digits.slice(-9);
  }
  if (national.length === 9) {
    return `+998 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`;
  }
  return String(phone).trim();
}

/**
 * Telefon raqamining oxirgi 9 ta raqamini olish (aniq dublikat tekshiruvi uchun)
 */
function extractNationalPhoneDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length >= 12) {
    return digits.slice(3, 12);
  }
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/**
 * Asosiy API yo'riqchisi (Router)
 */
async function handleApiRequest(req, res, pathname, queryParams) {
  if (!pathname && req.url) {
    try {
      const u = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      pathname = u.pathname;
      queryParams = u.searchParams;
    } catch {}
  }

  // 1. TIZIM VA BAZA HOLATI (Haqiqiy SELECT 1 orqali tekshirish)
  if (pathname === '/api/health' && req.method === 'GET') {
    const pingResult = await db.ping();
    const dbStatus = db.getDbStatus();
    const isDbConnected = pingResult.connected;

    return sendJson(res, isDbConnected ? 200 : 503, {
      ok: isDbConnected,
      status: isDbConnected ? 'online' : 'database_disconnected',
      version: '1.0.0',
      serverTime: new Date().toISOString(),
      database: {
        engine: 'PostgreSQL',
        connected: isDbConnected,
        lastError: pingResult.error || dbStatus.lastError,
        name: dbStatus.database,
      },
    });
  }

  // ========================================================
  // 1.1. KLINIKANI BIRINCHI ISHGA TUSHIRISH VA SOZLASH (Setup)
  // ========================================================
  if (pathname === '/api/setup/status' && req.method === 'GET') {
    try {
      if (!db.isReady()) {
        return sendError(res, 503, 'PostgreSQL ma’lumotlar bazasi ulanmagan', 'DB_OFFLINE');
      }

      const mgrRes = await db.query(
        "SELECT COUNT(*) as cnt FROM staff_members WHERE role = 'Menejer' AND is_active = true"
      );
      const isSetupComplete = parseInt(mgrRes.rows[0].cnt, 10) > 0;

      const setRes = await db.query(
        "SELECT name, phone FROM clinic_settings WHERE id = 'default'"
      );
      const settings = setRes.rows[0] || null;

      return sendJson(res, 200, {
        ok: true,
        isSetupComplete,
        clinicName: settings?.name || '',
        clinicPhone: settings?.phone || '',
      });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/setup/initialize' && req.method === 'POST') {
    try {
      if (!db.isReady()) {
        return sendError(res, 503, 'PostgreSQL ma’lumotlar bazasi ulanmagan', 'DB_OFFLINE');
      }

      const { clinicName, adminName, adminPin, phone } = await readJsonBody(req);

      if (!adminName || !adminName.trim()) {
        return sendError(res, 400, 'Boshqaruvchi (Admin) ismini kiritish majburiy', 'VALIDATION_ERROR');
      }

      const cleanPin = String(adminPin || '').trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        return sendError(res, 400, 'Admin PIN kodi aynan 4 ta raqamdan iborat bo‘lishi kerak', 'VALIDATION_ERROR');
      }

      // Tizim allaqachon sozlanganligini tekshirish
      const mgrCheck = await db.query(
        "SELECT COUNT(*) as cnt FROM staff_members WHERE role = 'Menejer' AND is_active = true"
      );
      if (parseInt(mgrCheck.rows[0].cnt, 10) > 0) {
        return sendError(res, 400, 'Klinika tizimi allaqachon sozlangan. Menejer PIN kodi orqali kiring.', 'ALREADY_INITIALIZED');
      }

      const cleanClinicName = (clinicName || '').trim() || 'DentaCare Stomatologiya Markazi';
      const cleanPhone = (phone || '').trim();
      const adminPinHash = hashPin(cleanPin);
      const nameParts = adminName.trim().split(/\s+/).filter(Boolean);
      const initials = nameParts.length >= 2 ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() : (nameParts.length === 1 ? nameParts[0][0].toUpperCase() : 'M');

      const user = await db.withTransaction(async (client) => {
        // 1. Yangi Menejer (Admin) akkauntini yaratish
        const staffRes = await client.query(
          `INSERT INTO staff_members (id, name, role, pin_hash, avatar, avatar_color, title, phone, is_active)
           VALUES ($1, $2, 'Menejer', $3, $4, '#1D4ED8', 'Klinika Rahbari', $5, true)
           RETURNING id, name, role, avatar, avatar_color AS "avatarColor", title, phone`,
          [adminId, adminName.trim(), adminPinHash, initials, cleanPhone]
        );

        // 2. Klinika nomi va telefonini sozlamalarga yozish
        await client.query(
          `INSERT INTO clinic_settings (id, name, phone, tagline, working_hours, default_appointment_duration, currency, tax_rate_percent)
           VALUES ('default', $1, $2, 'Sog‘lom va go‘zal tabassum maskani', 'Dush - Shan: 09:00 - 18:00', 30, 'so''m', 0)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             updated_at = NOW()`,
          [cleanClinicName, cleanPhone]
        );

        return staffRes.rows[0];
      });

      const token = generateSessionToken();

      await auditLogger.log({
        action: 'INITIAL_SETUP',
        entityType: 'clinic',
        entityId: 'default',
        performedById: user.id,
        performedByName: user.name,
        details: { clinicName: cleanClinicName },
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Klinika muvaffaqiyatli ishga tushirildi!',
        token,
        user,
      });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 2. AUTHENTICATION & PIN TEKSHIRUVI
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { staffId, pin } = await readJsonBody(req);
      if (!staffId || !pin) {
        return sendError(res, 400, 'Xodim identifikatori va PIN kiritilishi shart', 'VALIDATION_ERROR');
      }

      if (!db.isReady()) {
        return sendError(res, 503, 'PostgreSQL ma’lumotlar bazasi ulanmagan. Iltimos, serverni tekshiring.', 'DB_OFFLINE');
      }

      const result = await db.query(
        `SELECT id, name, role, pin_hash, avatar, avatar_color, title, phone, is_active
         FROM staff_members WHERE id = $1 AND is_active = true`,
        [staffId]
      );

      if (result.rows.length === 0) {
        return sendError(res, 404, 'Bunday xodim topilmadi yoki faol emas', 'STAFF_NOT_FOUND');
      }

      const staff = result.rows[0];
      const isValid = verifyPin(pin, staff.pin_hash);

      if (!isValid) {
        return sendError(res, 401, 'Kiritilgan PIN kod noto‘g‘ri', 'INVALID_PIN');
      }

      const token = generateSessionToken();

      await auditLogger.log({
        action: 'LOGIN',
        entityType: 'staff',
        entityId: staff.id,
        performedById: staff.id,
        performedByName: staff.name,
        details: { role: staff.role },
      });

      return sendJson(res, 200, {
        ok: true,
        token,
        user: {
          id: staff.id,
          name: staff.name,
          role: staff.role,
          avatar: staff.avatar,
          avatarColor: staff.avatar_color,
          title: staff.title,
          phone: staff.phone,
        },
      });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // PIN kodni yangilash
  if (pathname === '/api/auth/update-pin' && req.method === 'POST') {
    try {
      const { staffId, newPin } = await readJsonBody(req);
      if (!staffId || !newPin || String(newPin).trim().length !== 4) {
        return sendError(res, 400, 'PIN aynan 4 ta raqamdan iborat bo‘lishi kerak', 'INVALID_PIN');
      }

      const newHash = hashPin(newPin);
      await db.query(
        `UPDATE staff_members SET pin_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newHash, staffId]
      );

      await auditLogger.log({
        action: 'UPDATE_PIN',
        entityType: 'staff',
        entityId: staffId,
        details: { success: true },
      });

      return sendJson(res, 200, { ok: true, message: 'PIN kod muvaffaqiyatli yangilandi' });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 3. XODIMLAR (Staff)
  if (pathname === '/api/staff' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, name, role, avatar, avatar_color AS "avatarColor", title, phone, is_active AS "isActive"
         FROM staff_members WHERE is_active = true ORDER BY name ASC`
      );
      return sendJson(res, 200, { ok: true, staff: result.rows });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/staff' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { name, role, pin, title, phone } = body;
      if (!name || !role || !pin) {
        return sendError(res, 400, 'Ism, lavozim va PIN kod majburiy', 'VALIDATION_ERROR');
      }

      const pinHash = hashPin(pin);
      const id = body.id || `staff-${Date.now()}`;
      const nameParts = name.trim().split(/\s+/).filter(Boolean);
      const initials = body.avatar || (nameParts.length >= 2 ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() : (nameParts.length === 1 ? nameParts[0][0].toUpperCase() : 'M'));
      const color = body.avatarColor || '#0D9488';

      const result = await db.query(
        `INSERT INTO staff_members (id, name, role, pin_hash, avatar, avatar_color, title, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id, name, role, avatar, avatar_color AS "avatarColor", title, phone, is_active AS "isActive"`,
        [id, name.trim(), role, pinHash, initials, color, title || null, phone || null]
      );

      return sendJson(res, 201, { ok: true, staff: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/staff/') && req.method === 'PUT') {
    try {
      const id = pathname.replace('/api/staff/', '');
      const body = await readJsonBody(req);
      const { name, role, title, phone, avatar, avatarColor, pin } = body;

      const cleanName = typeof name === 'string' ? name.trim() : null;
      let cleanInitials = avatar;
      if (!cleanInitials && cleanName) {
        const parts = cleanName.replace(/^Dr\.\s*/i, '').split(/\s+/).filter(Boolean);
        cleanInitials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : (parts.length === 1 ? parts[0][0].toUpperCase() : 'M');
      }

      const params = [id];
      const updates = [];

      if (cleanName !== null && cleanName !== undefined) {
        params.push(cleanName);
        updates.push(`name = $${params.length}`);
      }
      if (cleanInitials) {
        params.push(cleanInitials);
        updates.push(`avatar = $${params.length}`);
      }
      if (title !== undefined) {
        params.push(title);
        updates.push(`title = $${params.length}`);
      }
      if (phone !== undefined) {
        params.push(phone);
        updates.push(`phone = $${params.length}`);
      }
      if (avatarColor) {
        params.push(avatarColor);
        updates.push(`avatar_color = $${params.length}`);
      }
      if (role) {
        params.push(role);
        updates.push(`role = $${params.length}`);
      }
      if (pin && /^\d{4}$/.test(String(pin).trim())) {
        params.push(hashPin(String(pin).trim()));
        updates.push(`pin_hash = $${params.length}`);
      }

      if (updates.length === 0) {
        return sendError(res, 400, 'Yangilash uchun ma\'lumot berilmadi');
      }

      const result = await db.query(
        `UPDATE staff_members
         SET ${updates.join(', ')}
         WHERE id = $1
         RETURNING id, name, role, avatar, avatar_color AS "avatarColor", title, phone, is_active AS "isActive"`,
        params
      );

      if (result.rows.length === 0) {
        const mgrUpdates = updates.map((u, i) => u.replace(`$${i + 2}`, `$${i + 1}`));
        const mgrCheck = await db.query(
          `UPDATE staff_members
           SET ${mgrUpdates.join(', ')}
           WHERE role = 'Menejer'
           RETURNING id, name, role, avatar, avatar_color AS "avatarColor", title, phone, is_active AS "isActive"`,
          params.slice(1)
        );
        if (mgrCheck.rows.length > 0) {
          return sendJson(res, 200, { ok: true, staff: mgrCheck.rows[0] });
        }
        return sendError(res, 404, 'Xodim topilmadi');
      }

      return sendJson(res, 200, { ok: true, staff: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 4. XIZMATLAR (Services)
  if (pathname === '/api/services' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, name, category, price, duration_minutes AS "durationMinutes",
                is_active AS "isActive", description
         FROM services WHERE is_active = true ORDER BY name ASC`
      );
      return sendJson(res, 200, { ok: true, services: result.rows });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/services' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const id = body.id || `srv-${Date.now()}`;

      // Idempotency: Agar shu ID'li xizmat mavjud bo'lsa, mavjudini qaytarish
      const existingSrv = await db.query(
        `SELECT id, name, category, price, duration_minutes AS "durationMinutes",
                is_active AS "isActive", description
         FROM services WHERE id = $1`,
        [id]
      );
      if (existingSrv.rows.length > 0) {
        return sendJson(res, 200, { ok: true, service: existingSrv.rows[0], deduplicated: true });
      }

      const result = await db.query(
        `INSERT INTO services (id, name, category, price, duration_minutes, is_active, description)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         RETURNING id, name, category, price, duration_minutes AS "durationMinutes", is_active AS "isActive", description`,
        [id, body.name, body.category, body.price || 0, body.durationMinutes || 30, body.description || null]
      );
      return sendJson(res, 201, { ok: true, service: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/services/') && req.method === 'PUT') {
    try {
      const id = pathname.replace('/api/services/', '');
      const body = await readJsonBody(req);
      const result = await db.query(
        `UPDATE services
         SET name = COALESCE($1, name),
             category = COALESCE($2, category),
             price = COALESCE($3, price),
             duration_minutes = COALESCE($4, duration_minutes),
             description = COALESCE($5, description),
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, name, category, price, duration_minutes AS "durationMinutes", is_active AS "isActive", description`,
        [body.name, body.category, body.price, body.durationMinutes, body.description, id]
      );
      return sendJson(res, 200, { ok: true, service: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/services/') && req.method === 'DELETE') {
    try {
      const id = pathname.replace('/api/services/', '');
      await db.query(`UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true, message: 'Xizmat o‘chirildi' });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 5. SHIFOKORLAR (Doctors)
  if (pathname === '/api/doctors' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, full_name AS "fullName", specialty, phone,
                work_days AS "workDays", work_hours AS "workHours",
                is_active AS "isActive", avatar_color AS "avatarColor"
         FROM doctors WHERE is_active = true ORDER BY full_name ASC`
      );
      return sendJson(res, 200, { ok: true, doctors: result.rows });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/doctors' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const id = body.id || `doc-${Date.now()}`;

      // Idempotency: Agar shu ID'li shifokor mavjud bo'lsa, mavjudini qaytarish
      const existingDoc = await db.query(
        `SELECT id, full_name AS "fullName", specialty, phone,
                work_days AS "workDays", work_hours AS "workHours",
                is_active AS "isActive", avatar_color AS "avatarColor"
         FROM doctors WHERE id = $1`,
        [id]
      );
      if (existingDoc.rows.length > 0) {
        return sendJson(res, 200, { ok: true, doctor: existingDoc.rows[0], deduplicated: true });
      }

      const normDocPhone = normalizeUzbekPhone(body.phone);
      const result = await db.query(
        `INSERT INTO doctors (id, full_name, specialty, phone, work_days, work_hours, is_active, avatar_color)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING id, full_name AS "fullName", specialty, phone,
                   work_days AS "workDays", work_hours AS "workHours",
                   is_active AS "isActive", avatar_color AS "avatarColor"`,
        [
          id,
          body.fullName,
          body.specialty,
          normDocPhone || body.phone,
          JSON.stringify(body.workDays || []),
          JSON.stringify(body.workHours || { start: '09:00', end: '18:00' }),
          body.avatarColor || '#0D9488',
        ]
      );
      return sendJson(res, 201, { ok: true, doctor: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/doctors/') && req.method === 'PUT') {
    try {
      const id = pathname.replace('/api/doctors/', '');
      const body = await readJsonBody(req);
      const result = await db.query(
        `UPDATE doctors
         SET full_name = COALESCE($1, full_name),
             specialty = COALESCE($2, specialty),
             phone = COALESCE($3, phone),
             work_days = COALESCE($4, work_days),
             work_hours = COALESCE($5, work_hours),
             avatar_color = COALESCE($6, avatar_color),
             updated_at = NOW()
         WHERE id = $7
         RETURNING id, full_name AS "fullName", specialty, phone,
                   work_days AS "workDays", work_hours AS "workHours",
                   is_active AS "isActive", avatar_color AS "avatarColor"`,
        [
          body.fullName,
          body.specialty,
          body.phone,
          body.workDays ? JSON.stringify(body.workDays) : null,
          body.workHours ? JSON.stringify(body.workHours) : null,
          body.avatarColor,
          id,
        ]
      );
      return sendJson(res, 200, { ok: true, doctor: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/doctors/') && req.method === 'DELETE') {
    try {
      const id = pathname.replace('/api/doctors/', '');
      await db.query(`UPDATE doctors SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true, message: 'Shifokor o‘chirildi' });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 6. BEMORLAR (Patients)
  if (pathname === '/api/patients' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, full_name AS "fullName", phone, gender, birth_date AS "birthDate",
                address, total_visits AS "totalVisits", last_visit_date AS "lastVisitDate",
                debt, notes, telegram_chat_id AS "telegramChatId",
                telegram_username AS "telegramUsername", telegram_connected_at AS "telegramConnectedAt",
                TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
         FROM patients ORDER BY created_at DESC`
      );
      return sendJson(res, 200, { ok: true, patients: result.rows });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/patients' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const id = body.id || `pat-${Date.now()}`;
      const debt = parseInt(body.debt || 0, 10);

      // 1. Idempotency: Agar shu ID'li bemor mavjud bo'lsa, mavjudini qaytarish
      const existingById = await db.query(
        `SELECT id, full_name AS "fullName", phone, gender, birth_date AS "birthDate",
                address, total_visits AS "totalVisits", last_visit_date AS "lastVisitDate",
                debt, notes, telegram_chat_id AS "telegramChatId",
                telegram_username AS "telegramUsername", telegram_connected_at AS "telegramConnectedAt",
                TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
         FROM patients WHERE id = $1`,
        [id]
      );
      if (existingById.rows.length > 0) {
        return sendJson(res, 200, { ok: true, patient: existingById.rows[0], deduplicated: true });
      }

      // 2. Telefon raqamini normalizatsiya qilish va dublikat tekshirish
      const normPhone = normalizeUzbekPhone(body.phone);
      const natDigits = extractNationalPhoneDigits(normPhone || body.phone);

      if (natDigits && natDigits.length >= 7) {
        const existingByPhone = await db.query(
          `SELECT id, full_name, phone FROM patients
           WHERE regexp_replace(phone, '\\D', '', 'g') LIKE $1`,
          [`%${natDigits}`]
        );
        if (existingByPhone.rows.length > 0) {
          const dup = existingByPhone.rows[0];
          return sendError(
            res,
            409,
            `Ushbu telefon raqamiga (${dup.phone}) ega bemor allaqachon mavjud: "${dup.full_name}". Takroriy bemor qo‘shish to‘xtatildi.`,
            'DUPLICATE_PHONE'
          );
        }
      }

      const result = await db.query(
        `INSERT INTO patients (id, full_name, phone, gender, birth_date, address, total_visits, debt, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, NOW())
         RETURNING id, full_name AS "fullName", phone, gender, birth_date AS "birthDate",
                   address, total_visits AS "totalVisits", last_visit_date AS "lastVisitDate",
                   debt, notes, TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"`,
        [id, body.fullName ? body.fullName.trim() : '', normPhone || body.phone || '', body.gender || 'Erkak', body.birthDate || null, body.address || null, debt, body.notes || null]
      );

      await auditLogger.log({
        action: 'CREATE_PATIENT',
        entityType: 'patient',
        entityId: id,
        details: { name: body.fullName, phone: normPhone || body.phone },
      });

      return sendJson(res, 201, { ok: true, patient: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/patients/') && req.method === 'PUT') {
    try {
      const id = pathname.replace('/api/patients/', '');
      const body = await readJsonBody(req);

      let normPhone = undefined;
      if (body.phone !== undefined) {
        normPhone = normalizeUzbekPhone(body.phone);
        const natDigits = extractNationalPhoneDigits(normPhone || body.phone);
        if (natDigits && natDigits.length >= 7) {
          const checkPhone = await db.query(
            `SELECT id, full_name, phone FROM patients
             WHERE regexp_replace(phone, '\\D', '', 'g') LIKE $1 AND id != $2`,
            [`%${natDigits}`, id]
          );
          if (checkPhone.rows.length > 0) {
            const dup = checkPhone.rows[0];
            return sendError(
              res,
              409,
              `Boshqa bemor (${dup.full_name}) ushbu telefon raqamiga (${dup.phone}) ega.`,
              'DUPLICATE_PHONE'
            );
          }
        }
      }

      const result = await db.query(
        `UPDATE patients
         SET full_name = COALESCE($1, full_name),
             phone = COALESCE($2, phone),
             gender = COALESCE($3, gender),
             birth_date = COALESCE($4, birth_date),
             address = COALESCE($5, address),
             debt = COALESCE($6, debt),
             notes = COALESCE($7, notes),
             telegram_chat_id = COALESCE($8, telegram_chat_id),
             telegram_username = COALESCE($9, telegram_username),
             updated_at = NOW()
         WHERE id = $10
         RETURNING id, full_name AS "fullName", phone, gender, birth_date AS "birthDate",
                   address, total_visits AS "totalVisits", last_visit_date AS "lastVisitDate",
                   debt, notes, telegram_chat_id AS "telegramChatId",
                   telegram_username AS "telegramUsername",
                   TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"`,
        [
          body.fullName !== undefined ? body.fullName.trim() : null,
          normPhone !== undefined ? normPhone : null,
          body.gender,
          body.birthDate,
          body.address,
          body.debt !== undefined ? parseInt(body.debt, 10) : null,
          body.notes,
          body.telegramChatId,
          body.telegramUsername,
          id,
        ]
      );
      if (result.rows.length === 0) {
        return sendError(res, 404, 'Bemor topilmadi');
      }
      return sendJson(res, 200, { ok: true, patient: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/patients/') && req.method === 'DELETE') {
    try {
      const id = pathname.replace('/api/patients/', '');
      await db.query(`DELETE FROM patients WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true, message: 'Bemor o‘chirildi' });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 7. QABULLAR (Appointments)
  if (pathname === '/api/appointments' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, patient_id AS "patientId", patient_name AS "patientName", patient_phone AS "patientPhone",
                doctor_id AS "doctorId", doctor_name AS "doctorName",
                service_id AS "serviceId", service_name AS "serviceName", service_price AS "servicePrice",
                date, time, duration_minutes AS "durationMinutes", status, notes,
                paid_amount AS "paidAmount", TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
         FROM appointments ORDER BY date DESC, time DESC`
      );
      return sendJson(res, 200, { ok: true, appointments: result.rows });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/appointments' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { doctorId, date, time } = body;
      const id = body.id || `apt-${Date.now()}`;

      // 1. Idempotency: Agar shu ID'li qabul mavjud bo'lsa, mavjudini qaytarish
      const existingApt = await db.query(
        `SELECT id, patient_id AS "patientId", patient_name AS "patientName", patient_phone AS "patientPhone",
                doctor_id AS "doctorId", doctor_name AS "doctorName",
                service_id AS "serviceId", service_name AS "serviceName", service_price AS "servicePrice",
                date, time, duration_minutes AS "durationMinutes", status, notes,
                paid_amount AS "paidAmount", TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
         FROM appointments WHERE id = $1`,
        [id]
      );
      if (existingApt.rows.length > 0) {
        return sendJson(res, 200, { ok: true, appointment: existingApt.rows[0], deduplicated: true });
      }

      // 2. Vaqt to'qnashuvi tekshiruvi (Concurrency / Conflict check)
      const conflictRes = await db.query(
        `SELECT id FROM appointments
         WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status != 'Bekor qilindi' AND id != $4`,
        [doctorId, date, time, id]
      );

      if (conflictRes.rows.length > 0) {
        return sendError(
          res,
          409,
          `Shifokor ushbu vaqtda (${time}) allaqachon boshqa qabulda band!`,
          'CONFLICT_APPOINTMENT'
        );
      }

      const price = parseInt(body.servicePrice || 0, 10);

      // Tranzaksiya orqali qabul yaratish, bemorning tashrif sonini oshirish
      // va agar holat "Yakunlandi" bo'lsa, avtomatik to'lov yaratish
      const savedApt = await db.withTransaction(async (client) => {
        const aptRes = await client.query(
          `INSERT INTO appointments (
            id, patient_id, patient_name, patient_phone,
            doctor_id, doctor_name, service_id, service_name, service_price,
            date, time, duration_minutes, status, notes, paid_amount, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, NOW())
          RETURNING id, patient_id AS "patientId", patient_name AS "patientName", patient_phone AS "patientPhone",
                    doctor_id AS "doctorId", doctor_name AS "doctorName",
                    service_id AS "serviceId", service_name AS "serviceName", service_price AS "servicePrice",
                    date, time, duration_minutes AS "durationMinutes", status, notes,
                    paid_amount AS "paidAmount", TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"`,
          [
            id,
            body.patientId,
            body.patientName,
            body.patientPhone,
            body.doctorId,
            body.doctorName,
            body.serviceId || null,
            body.serviceName,
            price,
            body.date,
            body.time,
            body.durationMinutes || 30,
            body.status || 'Kutilmoqda',
            body.notes || null,
          ]
        );

        // Bemorning tashriflarini yangilash
        await client.query(
          `UPDATE patients
           SET total_visits = total_visits + 1, last_visit_date = $1, updated_at = NOW()
           WHERE id = $2`,
          [body.date, body.patientId]
        );

        // Agar "Yakunlandi" holatida bo'lsa, "To‘lash kerak" to'lovini yaratamiz
        if (body.status === 'Yakunlandi') {
          const randReceipt = `CH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          const payId = `pay-${Date.now()}`;
          await client.query(
            `INSERT INTO payments (
              id, appointment_id, patient_id, patient_name, doctor_id, doctor_name,
              service_name, total_amount, paid_amount, debt_amount,
              payment_method, status, date, time, notes, receipt_number, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $8, 'Naqd', 'To‘lash kerak', $9, $10, $11, $12, NOW())`,
            [
              payId,
              id,
              body.patientId,
              body.patientName,
              body.doctorId,
              body.doctorName,
              body.serviceName,
              price,
              body.date,
              body.time,
              `Qabul yakunlandi (${body.date} ${body.time})`,
              randReceipt,
            ]
          );

          if (price > 0) {
            await client.query(
              `UPDATE patients SET debt = debt + $1, updated_at = NOW() WHERE id = $2`,
              [price, body.patientId]
            );
          }
        }

        return aptRes.rows[0];
      });

      await auditLogger.log({
        action: 'CREATE_APPOINTMENT',
        entityType: 'appointment',
        entityId: id,
        details: { patient: body.patientName, doctor: body.doctorName, date: body.date, time: body.time },
      });

      return sendJson(res, 201, { ok: true, appointment: savedApt });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/appointments/') && req.method === 'PUT') {
    try {
      const id = pathname.replace('/api/appointments/', '');
      const body = await readJsonBody(req);

      // Vaqt to'qnashuvi tekshiruvi (agar vaqt yoki shifokor o'zgarsa)
      if (body.doctorId && body.date && body.time) {
        const conflictRes = await db.query(
          `SELECT id FROM appointments
           WHERE doctor_id = $1 AND date = $2 AND time = $3 AND id != $4 AND status != 'Bekor qilindi'`,
          [body.doctorId, body.date, body.time, id]
        );
        if (conflictRes.rows.length > 0) {
          return sendError(res, 409, `Shifokor ushbu vaqtda band`, 'CONFLICT_APPOINTMENT');
        }
      }

      const updated = await db.withTransaction(async (client) => {
        const curRes = await client.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (curRes.rows.length === 0) {
          throw new Error('Qabul topilmadi');
        }
        const cur = curRes.rows[0];

        const resApt = await client.query(
          `UPDATE appointments
           SET patient_name = COALESCE($1, patient_name),
               doctor_id = COALESCE($2, doctor_id),
               doctor_name = COALESCE($3, doctor_name),
               service_name = COALESCE($4, service_name),
               service_price = COALESCE($5, service_price),
               date = COALESCE($6, date),
               time = COALESCE($7, time),
               status = COALESCE($8, status),
               notes = COALESCE($9, notes),
               paid_amount = COALESCE($10, paid_amount),
               updated_at = NOW()
           WHERE id = $11
           RETURNING id, patient_id AS "patientId", patient_name AS "patientName", patient_phone AS "patientPhone",
                     doctor_id AS "doctorId", doctor_name AS "doctorName",
                     service_id AS "serviceId", service_name AS "serviceName", service_price AS "servicePrice",
                     date, time, duration_minutes AS "durationMinutes", status, notes,
                     paid_amount AS "paidAmount", TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"`,
          [
            body.patientName,
            body.doctorId,
            body.doctorName,
            body.serviceName,
            body.servicePrice,
            body.date,
            body.time,
            body.status,
            body.notes,
            body.paidAmount,
            id,
          ]
        );

        // Agar status "Yakunlandi"ga o'tgan bo'lsa va to'lov yo'q bo'lsa, to'lov yaratamiz
        if (body.status === 'Yakunlandi' && cur.status !== 'Yakunlandi') {
          const payCheck = await client.query('SELECT id FROM payments WHERE appointment_id = $1', [id]);
          if (payCheck.rows.length === 0) {
            const price = body.servicePrice || cur.service_price || 0;
            const randReceipt = `CH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const payId = `pay-${Date.now()}`;
            await client.query(
              `INSERT INTO payments (
                id, appointment_id, patient_id, patient_name, doctor_id, doctor_name,
                service_name, total_amount, paid_amount, debt_amount,
                payment_method, status, date, time, notes, receipt_number, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $8, 'Naqd', 'To‘lash kerak', $9, $10, $11, $12, NOW())`,
              [
                payId,
                id,
                cur.patient_id,
                body.patientName || cur.patient_name,
                body.doctorId || cur.doctor_id,
                body.doctorName || cur.doctor_name,
                body.serviceName || cur.service_name,
                price,
                body.date || cur.date,
                body.time || cur.time,
                `Qabul yakunlandi (${body.date || cur.date} ${body.time || cur.time})`,
                randReceipt,
              ]
            );

            if (price > 0) {
              await client.query('UPDATE patients SET debt = debt + $1 WHERE id = $2', [price, cur.patient_id]);
            }
          }
        }

        return resApt.rows[0];
      });

      return sendJson(res, 200, { ok: true, appointment: updated });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname.startsWith('/api/appointments/') && req.method === 'DELETE') {
    try {
      const id = pathname.replace('/api/appointments/', '');
      await db.withTransaction(async (client) => {
        // Agar to'lanmagan to'lov bo'lsa, o'chiramiz va bemor qarzini kamaytiramiz
        const payRes = await client.query(
          "SELECT id, patient_id, debt_amount FROM payments WHERE appointment_id = $1 AND status = 'To‘lash kerak'",
          [id]
        );
        for (const p of payRes.rows) {
          if (p.debt_amount > 0) {
            await client.query('UPDATE patients SET debt = GREATEST(0, debt - $1) WHERE id = $2', [
              p.debt_amount,
              p.patient_id,
            ]);
          }
          await client.query('DELETE FROM payments WHERE id = $1', [p.id]);
        }
        await client.query('DELETE FROM appointments WHERE id = $1', [id]);
      });
      return sendJson(res, 200, { ok: true, message: 'Qabul o‘chirildi' });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 8. TO'LOVLAR (Payments)
  if (pathname === '/api/payments' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, appointment_id AS "appointmentId", patient_id AS "patientId",
                patient_name AS "patientName", doctor_id AS "doctorId", doctor_name AS "doctorName",
                service_name AS "serviceName", total_amount AS "totalAmount",
                paid_amount AS "paidAmount", debt_amount AS "debtAmount",
                payment_method AS "paymentMethod", status, date, time, notes,
                receipt_number AS "receiptNumber", TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
         FROM payments ORDER BY date DESC, time DESC`
      );
      return sendJson(res, 200, { ok: true, payments: result.rows });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/payments' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const id = body.id || `pay-${Date.now()}`;
      const receiptNumber = body.receiptNumber || `CH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Idempotency: Agar shu ID yoki receiptNumber mavjud bo'lsa, mavjudini qaytarish
      const existingPay = await db.query(
        `SELECT id, appointment_id AS "appointmentId", patient_id AS "patientId",
                patient_name AS "patientName", doctor_id AS "doctorId", doctor_name AS "doctorName",
                service_name AS "serviceName", total_amount AS "totalAmount",
                paid_amount AS "paidAmount", debt_amount AS "debtAmount",
                payment_method AS "paymentMethod", status, date, time, notes,
                receipt_number AS "receiptNumber", TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
         FROM payments WHERE id = $1 OR (receipt_number = $2 AND receipt_number IS NOT NULL)`,
        [id, receiptNumber]
      );
      if (existingPay.rows.length > 0) {
        return sendJson(res, 200, { ok: true, payment: existingPay.rows[0], deduplicated: true });
      }

      const totalAmount = parseInt(body.totalAmount || 0, 10);
      const paidAmount = parseInt(body.paidAmount || 0, 10);
      const debtAmount = Math.max(0, totalAmount - paidAmount);
      const status = body.status || (debtAmount === 0 ? 'To‘landi' : 'Qisman to‘langan');

      const saved = await db.withTransaction(async (client) => {
        const payRes = await client.query(
          `INSERT INTO payments (
            id, appointment_id, patient_id, patient_name, doctor_id, doctor_name,
            service_name, total_amount, paid_amount, debt_amount,
            payment_method, status, date, time, notes, receipt_number, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          RETURNING id, appointment_id AS "appointmentId", patient_id AS "patientId",
                    patient_name AS "patientName", doctor_id AS "doctorId", doctor_name AS "doctorName",
                    service_name AS "serviceName", total_amount AS "totalAmount",
                    paid_amount AS "paidAmount", debt_amount AS "debtAmount",
                    payment_method AS "paymentMethod", status, date, time, notes,
                    receipt_number AS "receiptNumber"`,
          [
            id,
            body.appointmentId || null,
            body.patientId,
            body.patientName,
            body.doctorId,
            body.doctorName,
            body.serviceName,
            totalAmount,
            paidAmount,
            debtAmount,
            body.paymentMethod || 'Naqd',
            status,
            body.date,
            body.time,
            body.notes || null,
            receiptNumber,
          ]
        );

        // Agar qarz qolsa, bemor qarzini oshiramiz
        if (debtAmount > 0) {
          await client.query('UPDATE patients SET debt = debt + $1 WHERE id = $2', [debtAmount, body.patientId]);
        }

        // Qabulga to'lov miqdorini yozish
        if (body.appointmentId) {
          await client.query(
            'UPDATE appointments SET paid_amount = paid_amount + $1 WHERE id = $2',
            [paidAmount, body.appointmentId]
          );
        }

        return payRes.rows[0];
      });

      await auditLogger.log({
        action: 'CREATE_PAYMENT',
        entityType: 'payment',
        entityId: id,
        details: { patient: body.patientName, amount: totalAmount, receipt: receiptNumber },
      });

      return sendJson(res, 201, { ok: true, payment: saved });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // To'lovni "To‘landi" holatiga o'tkazish
  if (pathname.endsWith('/complete') && req.method === 'POST') {
    try {
      const id = pathname.replace('/api/payments/', '').replace('/complete', '');
      const body = await readJsonBody(req);
      const paymentMethod = body.paymentMethod || 'Naqd';

      const updated = await db.withTransaction(async (client) => {
        const payRes = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
        if (payRes.rows.length === 0) {
          throw new Error('To‘lov topilmadi');
        }
        const pay = payRes.rows[0];
        const remainingDebt = pay.debt_amount > 0 ? pay.debt_amount : Math.max(0, pay.total_amount - pay.paid_amount);

        const resP = await client.query(
          `UPDATE payments
           SET status = 'To‘landi',
               paid_amount = total_amount,
               debt_amount = 0,
               payment_method = $1,
               updated_at = NOW()
           WHERE id = $2
           RETURNING id, appointment_id AS "appointmentId", patient_id AS "patientId",
                     patient_name AS "patientName", doctor_id AS "doctorId", doctor_name AS "doctorName",
                     service_name AS "serviceName", total_amount AS "totalAmount",
                     paid_amount AS "paidAmount", debt_amount AS "debtAmount",
                     payment_method AS "paymentMethod", status, date, time, notes,
                     receipt_number AS "receiptNumber"`,
          [paymentMethod, id]
        );

        // Bemorning qarzini kamaytirish
        if (remainingDebt > 0) {
          await client.query(
            'UPDATE patients SET debt = GREATEST(0, debt - $1), updated_at = NOW() WHERE id = $2',
            [remainingDebt, pay.patient_id]
          );
        }

        // Qabulning paid_amount'ini to'liq qilish
        if (pay.appointment_id) {
          await client.query(
            'UPDATE appointments SET paid_amount = $1, updated_at = NOW() WHERE id = $2',
            [pay.total_amount, pay.appointment_id]
          );
        }

        return resP.rows[0];
      });

      return sendJson(res, 200, { ok: true, payment: updated });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // To'lovni qaytarish (refund)
  if (pathname.endsWith('/refund') && req.method === 'POST') {
    try {
      const id = pathname.replace('/api/payments/', '').replace('/refund', '');
      const updated = await db.withTransaction(async (client) => {
        const payRes = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
        if (payRes.rows.length === 0) throw new Error('To‘lov topilmadi');
        const pay = payRes.rows[0];

        const resP = await client.query(
          `UPDATE payments SET status = 'Qaytarilgan', updated_at = NOW() WHERE id = $1
           RETURNING id, appointment_id AS "appointmentId", patient_id AS "patientId",
                     patient_name AS "patientName", doctor_id AS "doctorId", doctor_name AS "doctorName",
                     service_name AS "serviceName", total_amount AS "totalAmount",
                     paid_amount AS "paidAmount", debt_amount AS "debtAmount",
                     payment_method AS "paymentMethod", status, date, time, notes,
                     receipt_number AS "receiptNumber"`,
          [id]
        );

        // Bemorga qarzni qayta tiklash
        if (pay.paid_amount > 0) {
          await client.query('UPDATE patients SET debt = debt + $1, updated_at = NOW() WHERE id = $2', [
            pay.paid_amount,
            pay.patient_id,
          ]);
        }

        return resP.rows[0];
      });

      return sendJson(res, 200, { ok: true, payment: updated });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 9. SOZLAMALAR (Clinic Settings)
  if (pathname === '/api/settings' && req.method === 'GET') {
    try {
      const result = await db.query(
        `SELECT id, name, tagline, address, phone, working_hours AS "workingHours",
                default_appointment_duration AS "defaultAppointmentDuration",
                currency, tax_rate_percent AS "taxRatePercent"
         FROM clinic_settings WHERE id = 'default'`
      );
      return sendJson(res, 200, { ok: true, settings: result.rows[0] || null });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (pathname === '/api/settings' && req.method === 'PUT') {
    try {
      const body = await readJsonBody(req);
      const result = await db.query(
        `INSERT INTO clinic_settings (id, name, tagline, address, phone, working_hours, default_appointment_duration, currency, tax_rate_percent)
         VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           tagline = EXCLUDED.tagline,
           address = EXCLUDED.address,
           phone = EXCLUDED.phone,
           working_hours = EXCLUDED.working_hours,
           default_appointment_duration = EXCLUDED.default_appointment_duration,
           currency = EXCLUDED.currency,
           tax_rate_percent = EXCLUDED.tax_rate_percent,
           updated_at = NOW()
         RETURNING id, name, tagline, address, phone, working_hours AS "workingHours",
                   default_appointment_duration AS "defaultAppointmentDuration",
                   currency, tax_rate_percent AS "taxRatePercent"`,
        [
          body.name,
          body.tagline,
          body.address,
          body.phone,
          body.workingHours,
          body.defaultAppointmentDuration || 30,
          body.currency || 'so\'m',
          body.taxRatePercent || 0,
        ]
      );
      return sendJson(res, 200, { ok: true, settings: result.rows[0] });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // 10. MIGRATSIYA, ZAXIRALASH VA STATISTIKA
  if (pathname === '/api/migrate/stats' && req.method === 'GET') {
    try {
      const pRes = await db.query('SELECT COUNT(*) as count, COALESCE(SUM(debt), 0) as total_debt FROM patients');
      const aRes = await db.query('SELECT COUNT(*) as count FROM appointments');
      const payRes = await db.query(
        'SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_sum, COALESCE(SUM(paid_amount), 0) as total_paid FROM payments'
      );
      const dRes = await db.query('SELECT COUNT(*) as count FROM doctors WHERE is_active = true');
      const sRes = await db.query('SELECT COUNT(*) as count FROM services WHERE is_active = true');

      return sendJson(res, 200, {
        ok: true,
        stats: {
          patientsCount: parseInt(pRes.rows[0].count, 10),
          totalDebt: parseInt(pRes.rows[0].total_debt, 10),
          appointmentsCount: parseInt(aRes.rows[0].count, 10),
          paymentsCount: parseInt(payRes.rows[0].count, 10),
          totalRevenue: parseInt(payRes.rows[0].total_paid, 10),
          totalBilled: parseInt(payRes.rows[0].total_sum, 10),
          doctorsCount: parseInt(dRes.rows[0].count, 10),
          servicesCount: parseInt(sRes.rows[0].count, 10),
        },
      });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // To'liq ma'lumotlar bazasini JSON zaxira fayliga eksport qilish
  if (pathname === '/api/migrate/export' && req.method === 'GET') {
    try {
      const [pRes, aRes, payRes, dRes, sRes, staffRes, setRes] = await Promise.all([
        db.query('SELECT * FROM patients ORDER BY created_at ASC'),
        db.query('SELECT * FROM appointments ORDER BY created_at ASC'),
        db.query('SELECT * FROM payments ORDER BY created_at ASC'),
        db.query('SELECT * FROM doctors ORDER BY created_at ASC'),
        db.query('SELECT * FROM services ORDER BY created_at ASC'),
        db.query('SELECT id, name, role, avatar, avatar_color, title, phone FROM staff_members WHERE is_active = true'),
        db.query('SELECT * FROM clinic_settings WHERE id = \'default\''),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        counts: {
          patients: pRes.rows.length,
          appointments: aRes.rows.length,
          payments: payRes.rows.length,
          doctors: dRes.rows.length,
          services: sRes.rows.length,
        },
        patients: pRes.rows,
        appointments: aRes.rows,
        payments: payRes.rows,
        doctors: dRes.rows,
        services: sRes.rows,
        staff: staffRes.rows,
        settings: setRes.rows[0] || null,
      };

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="dentacare_backup_${new Date().toISOString().split('T')[0]}.json"`,
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(JSON.stringify(backup, null, 2));
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  // Admin boshlaydigan import funksiyasi (Takroriy yozuv yaratmasdan - ON CONFLICT DO UPDATE)
  if (pathname === '/api/migrate/import' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const { patients, appointments, payments, doctors, services, settings, staff } = payload;

      let importedPatients = 0;
      let importedAppointments = 0;
      let importedPayments = 0;
      let importedDoctors = 0;
      let importedServices = 0;

      await db.withTransaction(async (client) => {
        // 1. Shifokorlar
        if (Array.isArray(doctors)) {
          for (const d of doctors) {
            if (!d || !d.id || !d.fullName) continue;
            await client.query(
              `INSERT INTO doctors (id, full_name, specialty, phone, work_days, work_hours, is_active, avatar_color)
               VALUES ($1, $2, $3, $4, $5, $6, true, $7)
               ON CONFLICT (id) DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 specialty = EXCLUDED.specialty,
                 phone = EXCLUDED.phone,
                 work_days = EXCLUDED.work_days,
                 work_hours = EXCLUDED.work_hours,
                 avatar_color = EXCLUDED.avatar_color,
                 updated_at = NOW()`,
              [
                d.id,
                d.fullName,
                d.specialty || 'Stomatolog',
                d.phone || '+998 90 000 00 00',
                JSON.stringify(d.workDays || ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum']),
                JSON.stringify(d.workHours || { start: '09:00', end: '18:00' }),
                d.avatarColor || '#0D9488',
              ]
            );
            importedDoctors++;
          }
        }

        // 2. Xizmatlar
        if (Array.isArray(services)) {
          for (const s of services) {
            if (!s || !s.id || !s.name) continue;
            await client.query(
              `INSERT INTO services (id, name, category, price, duration_minutes, is_active, description)
               VALUES ($1, $2, $3, $4, $5, true, $6)
               ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 category = EXCLUDED.category,
                 price = EXCLUDED.price,
                 duration_minutes = EXCLUDED.duration_minutes,
                 description = EXCLUDED.description,
                 updated_at = NOW()`,
              [s.id, s.name, s.category || 'Konsultatsiya', s.price || 0, s.durationMinutes || 30, s.description || null]
            );
            importedServices++;
          }
        }

        // 3. Bemorlar
        if (Array.isArray(patients)) {
          for (const p of patients) {
            if (!p || !p.id || !p.fullName) continue;
            await client.query(
              `INSERT INTO patients (id, full_name, phone, gender, birth_date, address, total_visits, debt, notes, telegram_chat_id, telegram_username, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()))
               ON CONFLICT (id) DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 phone = EXCLUDED.phone,
                 gender = EXCLUDED.gender,
                 birth_date = EXCLUDED.birth_date,
                 address = EXCLUDED.address,
                 total_visits = EXCLUDED.total_visits,
                 debt = EXCLUDED.debt,
                 notes = EXCLUDED.notes,
                 telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, patients.telegram_chat_id),
                 telegram_username = COALESCE(EXCLUDED.telegram_username, patients.telegram_username),
                 updated_at = NOW()`,
              [
                p.id,
                p.fullName,
                p.phone || '+998 90 000 00 00',
                p.gender || 'Erkak',
                p.birthDate || null,
                p.address || null,
                p.totalVisits || 0,
                p.debt || 0,
                p.notes || null,
                p.telegramChatId || null,
                p.telegramUsername || null,
                p.createdAt || null,
              ]
            );
            importedPatients++;
          }
        }

        // 4. Qabullar
        if (Array.isArray(appointments)) {
          for (const a of appointments) {
            if (!a || !a.id || !a.patientId || !a.doctorId) continue;
            await client.query(
              `INSERT INTO appointments (
                id, patient_id, patient_name, patient_phone, doctor_id, doctor_name,
                service_id, service_name, service_price, date, time, duration_minutes,
                status, notes, paid_amount, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16::timestamptz, NOW()))
              ON CONFLICT (id) DO UPDATE SET
                patient_name = EXCLUDED.patient_name,
                patient_phone = EXCLUDED.patient_phone,
                doctor_name = EXCLUDED.doctor_name,
                service_name = EXCLUDED.service_name,
                service_price = EXCLUDED.service_price,
                date = EXCLUDED.date,
                time = EXCLUDED.time,
                duration_minutes = EXCLUDED.duration_minutes,
                status = EXCLUDED.status,
                notes = EXCLUDED.notes,
                paid_amount = EXCLUDED.paid_amount,
                updated_at = NOW()`,
              [
                a.id,
                a.patientId,
                a.patientName || 'Bemor',
                a.patientPhone || '',
                a.doctorId,
                a.doctorName || 'Shifokor',
                a.serviceId || null,
                a.serviceName || 'Muolaja',
                a.servicePrice || 0,
                a.date,
                a.time,
                a.durationMinutes || 30,
                a.status || 'Kutilmoqda',
                a.notes || null,
                a.paidAmount || 0,
                a.createdAt || null,
              ]
            );
            importedAppointments++;
          }
        }

        // 5. To'lovlar
        if (Array.isArray(payments)) {
          for (const py of payments) {
            if (!py || !py.id || !py.patientId) continue;
            const rNum = py.receiptNumber || `CH-${py.date ? py.date.slice(0, 4) : '2026'}-${Math.floor(1000 + Math.random() * 9000)}`;
            await client.query(
              `INSERT INTO payments (
                id, appointment_id, patient_id, patient_name, doctor_id, doctor_name,
                service_name, total_amount, paid_amount, debt_amount,
                payment_method, status, date, time, notes, receipt_number, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
              ON CONFLICT (id) DO UPDATE SET
                patient_name = EXCLUDED.patient_name,
                doctor_name = EXCLUDED.doctor_name,
                service_name = EXCLUDED.service_name,
                total_amount = EXCLUDED.total_amount,
                paid_amount = EXCLUDED.paid_amount,
                debt_amount = EXCLUDED.debt_amount,
                payment_method = EXCLUDED.payment_method,
                status = EXCLUDED.status,
                date = EXCLUDED.date,
                time = EXCLUDED.time,
                notes = EXCLUDED.notes,
                receipt_number = EXCLUDED.receipt_number,
                updated_at = NOW()`,
              [
                py.id,
                py.appointmentId || null,
                py.patientId,
                py.patientName || 'Bemor',
                py.doctorId || 'doc-1',
                py.doctorName || 'Shifokor',
                py.serviceName || 'Xizmat',
                py.totalAmount || 0,
                py.paidAmount || 0,
                py.debtAmount || 0,
                py.paymentMethod || 'Naqd',
                py.status || 'To‘landi',
                py.date,
                py.time,
                py.notes || null,
                rNum,
              ]
            );
            importedPayments++;
          }
        }
      });

      // Migratsiyadan keyingi solishtirish (Reconciliation)
      const afterStats = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM patients) as p_cnt,
          (SELECT COUNT(*) FROM appointments) as a_cnt,
          (SELECT COUNT(*) FROM payments) as py_cnt,
          (SELECT COALESCE(SUM(paid_amount), 0) FROM payments) as total_paid
      `);

      await auditLogger.log({
        action: 'DATA_MIGRATION_IMPORT',
        entityType: 'system',
        details: {
          importedPatients,
          importedAppointments,
          importedPayments,
          importedDoctors,
          importedServices,
        },
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Lokal ma’lumotlar markaziy PostgreSQL bazasiga muvaffaqiyatli ko‘chirildi!',
        imported: {
          patients: importedPatients,
          appointments: importedAppointments,
          payments: importedPayments,
          doctors: importedDoctors,
          services: importedServices,
        },
        databaseTotals: {
          patientsCount: parseInt(afterStats.rows[0].p_cnt, 10),
          appointmentsCount: parseInt(afterStats.rows[0].a_cnt, 10),
          paymentsCount: parseInt(afterStats.rows[0].py_cnt, 10),
          totalRevenue: parseInt(afterStats.rows[0].total_paid, 10),
        },
      });
    } catch (err) {
      return sendError(res, 500, 'Migratsiya xatosi: ' + err.message);
    }
  }

  // Not found for other /api routes
  return sendError(res, 404, `API marshruti topilmadi: ${req.method} ${pathname}`, 'NOT_FOUND');
}

module.exports = {
  handleApiRequest,
};
