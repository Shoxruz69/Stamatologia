const fs = require('fs');
const path = require('path');

// Oddiy .env o'quvchi (tashqi kutubxonaga bog'lanib qolmaslik uchun)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key] && val) {
            process.env[key] = val.replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (e) {
      console.warn('[SMS Provider] .env o‘qishda xatolik:', e.message);
    }
  }
}

loadEnv();

let cachedEskizToken = null;
let tokenExpiresAt = 0;

/**
 * Telefon raqamini O'zbekiston formati (998XXXXXXXXX) ga normallashtirish
 */
function normalizeUzbekPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return digits;
  }
  if (digits.length === 9) {
    return '998' + digits;
  }
  return digits;
}

/**
 * Eskiz.uz provayderi ulanish holatini tekshirish
 */
function getSmsStatus() {
  loadEnv();
  const email = process.env.ESKIZ_EMAIL?.trim();
  const password = process.env.ESKIZ_PASSWORD?.trim();
  const from = process.env.ESKIZ_FROM?.trim() || '4546';

  const isConfigured = Boolean(email && password);

  let maskedEmail = null;
  if (email && email.includes('@')) {
    const [name, domain] = email.split('@');
    maskedEmail = `${name[0]}***@${domain}`;
  }

  return {
    configured: isConfigured,
    provider: 'Eskiz.uz',
    from,
    email: maskedEmail,
    message: isConfigured
      ? 'Eskiz.uz SMS provayderi sozlangan'
      : 'SMS xizmati ulanmagan. Iltimos, server sozlamalarida (.env) Eskiz.uz API kalitlarini kiriting.',
  };
}

/**
 * Eskiz.uz API dan Bearer Token olish
 */
async function getEskizToken() {
  loadEnv();
  const email = process.env.ESKIZ_EMAIL?.trim();
  const password = process.env.ESKIZ_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error('NOT_CONFIGURED');
  }

  // Keshdagi token hali amalda bo'lsa
  const now = Date.now();
  if (cachedEskizToken && tokenExpiresAt > now + 60000) {
    return cachedEskizToken;
  }

  const formData = new FormData();
  formData.append('email', email);
  formData.append('password', password);

  const response = await fetch('https://notify.eskiz.uz/api/auth/login', {
    method: 'POST',
    body: formData,
  });

  const resJson = await response.json().catch(() => ({}));

  if (!response.ok || !resJson?.data?.token) {
    const errMsg = resJson?.message || 'Eskiz avtorizatsiyadan o‘ta olmadi (login yoki parol noto‘g‘ri)';
    throw new Error(errMsg);
  }

  cachedEskizToken = resJson.data.token;
  // Eskiz tokeni taxminan 30 kun amal qiladi, biz 25 kunga keshlaymiz
  tokenExpiresAt = now + 25 * 24 * 60 * 60 * 1000;
  return cachedEskizToken;
}

/**
 * Haqiqiy SMS yuborish (Eskiz.uz orqali)
 */
async function sendSmsViaEskiz(phone, message) {
  loadEnv();
  const status = getSmsStatus();

  if (!status.configured) {
    return {
      success: false,
      code: 'NOT_CONFIGURED',
      message: 'SMS xizmati ulanmagan. Server .env faylida ESKIZ_EMAIL va ESKIZ_PASSWORD kiritilmagan.',
    };
  }

  const normalizedPhone = normalizeUzbekPhone(phone);
  if (!normalizedPhone || normalizedPhone.length !== 12 || !normalizedPhone.startsWith('998')) {
    return {
      success: false,
      code: 'INVALID_PHONE',
      message: `Noto‘g‘ri telefon raqami (${phone}). O‘zbekiston raqami 998XXXXXXXXX formatida bo‘lishi shart.`,
    };
  }

  if (!message || !message.trim()) {
    return {
      success: false,
      code: 'EMPTY_MESSAGE',
      message: 'SMS xabar matni bo‘sh bo‘lishi mumkin emas.',
    };
  }

  const from = process.env.ESKIZ_FROM?.trim() || '4546';

  try {
    let token = await getEskizToken();

    let sendFormData = new FormData();
    sendFormData.append('mobile_phone', normalizedPhone);
    sendFormData.append('message', message.trim());
    sendFormData.append('from', from);

    let sendRes = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: sendFormData,
    });

    // Agar token eskirgan bo'lsa (401), keshni tozalab bir marta qayta urinamiz
    if (sendRes.status === 401) {
      cachedEskizToken = null;
      token = await getEskizToken();

      sendFormData = new FormData();
      sendFormData.append('mobile_phone', normalizedPhone);
      sendFormData.append('message', message.trim());
      sendFormData.append('from', from);

      sendRes = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: sendFormData,
      });
    }

    const data = await sendRes.json().catch(() => ({}));

    if (!sendRes.ok) {
      const errMsg = data.message || `Eskiz API xatoligi (Status: ${sendRes.status})`;
      return {
        success: false,
        code: 'PROVIDER_ERROR',
        message: `SMS provayder xatosi: ${errMsg}`,
        raw: data,
      };
    }

    // Eskiz javobi tekshiruvi:
    // status: "waiting" yoki "success" yoki id mavjud bo'lsa
    if (data.status === 'waiting' || data.status === 'success' || data.id) {
      return {
        success: true,
        message: 'SMS provayder orqali muvaffaqiyatli yuborildi',
        id: data.id,
        phone: normalizedPhone,
      };
    } else {
      return {
        success: false,
        code: 'PROVIDER_REJECTED',
        message: data.message || 'Provayder xabarni qabul qilmadi.',
        raw: data,
      };
    }
  } catch (err) {
    if (err.message === 'NOT_CONFIGURED') {
      return {
        success: false,
        code: 'NOT_CONFIGURED',
        message: 'SMS xizmati ulanmagan. API ma’lumotlari sozlanmagan.',
      };
    }
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `SMS yuborishda tarmoq xatosi: ${err.message}`,
    };
  }
}

/**
 * Telegram orqali xabar yuborish
 */
async function sendTelegramMessage(message) {
  loadEnv();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return {
      success: false,
      code: 'NOT_CONFIGURED',
      message: 'Telegram xizmati ulanmagan. Telegram Bot Token va Chat ID sozlanmagan.',
    };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      return {
        success: true,
        message: 'Telegram orqali xabar yuborildi',
      };
    } else {
      return {
        success: false,
        code: 'TELEGRAM_ERROR',
        message: `Telegram xatosi: ${data.description || 'Noma‘lum xato'}`,
      };
    }
  } catch (err) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Telegram tarmoq xatosi: ${err.message}`,
    };
  }
}

module.exports = {
  getSmsStatus,
  sendSmsViaEskiz,
  sendTelegramMessage,
  normalizeUzbekPhone,
};
