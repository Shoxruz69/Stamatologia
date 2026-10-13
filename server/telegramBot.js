const fs = require('fs');
const path = require('path');

// Oddiy .env o'quvchi
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
      console.warn('[Telegram Bot] .env o‘qishda xatolik:', e.message);
    }
  }
}

loadEnv();

const CONNECTIONS_FILE = path.join(__dirname, 'telegramConnections.json');

// Bemorlar va ularning Telegram Chat ID lari xotirasi
let patientConnections = {};

try {
  if (fs.existsSync(CONNECTIONS_FILE)) {
    patientConnections = JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8') || '{}');
  }
} catch {
  patientConnections = {};
}

function saveConnections() {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(patientConnections, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Telegram Bot] Bog‘lanishlarni saqlashda xatolik:', e.message);
  }
}

let botInfoCache = null;
let lastUpdateId = 0;

function getToken() {
  loadEnv();
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

/**
 * Bot haqidagi ma'lumotlarni olish
 */
async function getBotInfo() {
  const token = getToken();
  if (!token) {
    return { ok: false, message: 'TELEGRAM_BOT_TOKEN belgilanmagan' };
  }

  if (botInfoCache) return botInfoCache;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      botInfoCache = {
        ok: true,
        id: data.result.id,
        username: data.result.username || 'DentaCare0_bot',
        firstName: data.result.first_name || 'DentaCare',
      };
      return botInfoCache;
    }
    return { ok: false, message: data.description || 'Bot ma’lumotini olib bo‘lmadi' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Telegram Chatga xabar yuborish
 */
async function sendMessageToChat(chatId, text) {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      code: 'NOT_CONFIGURED',
      message: 'Telegram xizmati ulanmagan. Server .env faylida bot tokeni mavjud emas.',
    };
  }

  if (!chatId) {
    return {
      success: false,
      code: 'NO_CHAT_ID',
      message: 'Telegram ulanmagan: Bemorning Telegram Chat ID raqami mavjud emas.',
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (data.ok) {
      return {
        success: true,
        messageId: data.result?.message_id,
        chatId,
        message: 'Xabar Telegram orqali muvaffaqiyatli yuborildi',
      };
    } else {
      let errDesc = data.description || 'Noma’lum xato';
      if (errDesc.includes('chat not found') || errDesc.includes('bot was blocked')) {
        errDesc = 'Bemor botni bloklagan yoki chat topilmadi. Bemor botga kirib /start bosishi kerak.';
      }
      return {
        success: false,
        code: 'TELEGRAM_ERROR',
        message: `Telegram xatosi: ${errDesc}`,
      };
    }
  } catch (err) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Telegramga ulanishda tarmoq xatosi: ${err.message}`,
    };
  }
}

const START_WELCOME_MESSAGE =
  'Assalomu alaykum! Bu DentaCare qo‘llab-quvvatlash boti. Aloqa markazi: +998 88 732 55 15.';

/**
 * Telegramdan yangilanishlarni (updates) tekshirish va bemorlarni avtomatik bog'lash
 */
async function pollUpdates() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&limit=50&timeout=2`
    );
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.result)) return;

    for (const update of data.result) {
      if (update.update_id >= lastUpdateId) {
        lastUpdateId = update.update_id;
      }

      const msg = update.message;
      if (!msg || !msg.text) continue;

      const text = msg.text.trim();
      const chatId = msg.chat?.id;
      const from = msg.from || {};

      if (text.startsWith('/start')) {
        const payload = text.replace(/^\/start\s*/i, '').trim();

        if (payload) {
          const clean = payload
            .replace(/^patient_/i, '')
            .replace(/^pat_/i, '')
            .replace(/^pat-/i, '');

          const connData = {
            chatId: String(chatId),
            username: from.username ? `@${from.username}` : null,
            firstName: from.first_name || '',
            connectedAt: new Date().toISOString(),
          };

          // Turli formatdagi kalitlar bilan saqlash (to'liq mos kelish uchun)
          patientConnections[payload] = connData;
          patientConnections[clean] = connData;
          patientConnections[`pat-${clean}`] = connData;
          patientConnections[`pat_${clean}`] = connData;
          patientConnections[`patient_${clean}`] = connData;
          saveConnections();
        }

        // Foydalanuvchiga talab qilingan rasmiy xabarni yuborish
        await sendMessageToChat(chatId, START_WELCOME_MESSAGE);
      }
    }
  } catch (err) {
    // Silent fail in polling
  }
}

// Yangilanishlarni har 2 soniyada fonda avtomatik tekshirib turish
setInterval(() => {
  pollUpdates().catch(() => {});
}, 2000);

/**
 * Bemorning Telegram bog'langanligini tekshirish
 */
async function checkPatientConnection(patientId) {
  // Avval Telegramdan so'nggi Start xabarlarini tekshiramiz
  await pollUpdates();

  if (!patientId) return { connected: false };

  const idStr = String(patientId).trim();
  const clean = idStr
    .replace(/^patient_/i, '')
    .replace(/^pat_/i, '')
    .replace(/^pat-/i, '');

  if (patientConnections[idStr]) return { connected: true, ...patientConnections[idStr] };
  if (patientConnections[clean]) return { connected: true, ...patientConnections[clean] };
  if (patientConnections[`pat-${clean}`]) return { connected: true, ...patientConnections[`pat-${clean}`] };
  if (patientConnections[`pat_${clean}`]) return { connected: true, ...patientConnections[`pat_${clean}`] };
  if (patientConnections[`patient_${clean}`]) return { connected: true, ...patientConnections[`patient_${clean}`] };

  for (const [key, val] of Object.entries(patientConnections)) {
    const kClean = key
      .replace(/^patient_/i, '')
      .replace(/^pat_/i, '')
      .replace(/^pat-/i, '');
    if (kClean === clean) {
      return { connected: true, ...val };
    }
  }

  return { connected: false };
}

/**
 * Chat ID ni qo'lda bemorga biriktirish
 */
function bindPatientManually(patientId, chatId, username = '') {
  if (!patientId || !chatId) return false;
  patientConnections[patientId] = {
    chatId: String(chatId).trim(),
    username: username ? (username.startsWith('@') ? username : `@${username}`) : null,
    firstName: '',
    connectedAt: new Date().toISOString(),
  };
  saveConnections();

  // Tasdiq xabari yuborish
  sendMessageToChat(
    chatId,
    `🦷 <b>DentaCare Stomatologiya</b>\n\nAkkauntingiz bemor profiliga muvaffaqiyatli bog‘landi! Qabul eslatmalari shu yerga keladi.`
  ).catch(() => {});

  return true;
}

/**
 * Test xabar yuborish (Foydalanuvchining o'z akkauntiga)
 */
async function sendTestTelegram(chatId, customText) {
  const text =
    customText ||
    `🦷 <b>DentaCare Stomatologiya — Test Xabarnomasi</b>\n\nAssalomu alaykum!\nBu DentaCare klinika boshqaruv panelidan yuborilgan <b>test xabari</b>.\n\n✅ Telegram bot muvaffaqiyatli ishlamoqda va xabarlarni yetkazishga tayyor!\n\nVaqt: ${new Date().toLocaleTimeString('uz-UZ')}`;

  return await sendMessageToChat(chatId, text);
}

module.exports = {
  getBotInfo,
  sendMessageToChat,
  checkPatientConnection,
  bindPatientManually,
  sendTestTelegram,
  pollUpdates,
};
