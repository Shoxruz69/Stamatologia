require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./server/db');
const { handleApiRequest } = require('./server/apiRouter');
const smsProvider = require('./server/smsProvider');
const telegramBot = require('./server/telegramBot');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const server = http.createServer(async (req, res) => {
  // CORS sarlavhalari (Barcha lokal tarmoq / LAN mijozlari, planshetlar va brauzerlar uchun)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // ========================================================
  // 1. ASOSIY POSTGRESQL REST API ROUTELARI
  // ========================================================
  const postgresRoutes = [
    '/api/health',
    '/api/setup',
    '/api/auth/',
    '/api/staff',
    '/api/services',
    '/api/doctors',
    '/api/patients',
    '/api/appointments',
    '/api/payments',
    '/api/settings',
    '/api/migrate/',
    '/api/audit-logs',
  ];

  const isPostgresRoute = postgresRoutes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );

  if (isPostgresRoute) {
    try {
      await handleApiRequest(req, res, pathname, urlObj.searchParams);
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
      return;
    }
  }

  // ========================================================
  // 2. ORQAGA MOSLASHUVCHANLIK: /api/data (Legacy JSON zaxirasi)
  // ========================================================
  const CLINIC_DATA_FILE = path.join(__dirname, 'server', 'clinicData.json');

  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      if (fs.existsSync(CLINIC_DATA_FILE)) {
        const fileContent = fs.readFileSync(CLINIC_DATA_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fileContent);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, data: null }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: err.message }));
    }
    return;
  }

  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        let current = {};
        if (fs.existsSync(CLINIC_DATA_FILE)) {
          try {
            current = JSON.parse(fs.readFileSync(CLINIC_DATA_FILE, 'utf8') || '{}');
          } catch {}
        }
        const updated = {
          ...current,
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(CLINIC_DATA_FILE, JSON.stringify(updated, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, updatedAt: updated.updatedAt }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: err.message }));
      }
    });
    return;
  }

  // ========================================================
  // 3. TELEGRAM BOT API ROUTELARI
  // ========================================================
  if (pathname === '/api/telegram/status' && req.method === 'GET') {
    telegramBot
      .getBotInfo()
      .then((info) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(info));
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: err.message }));
      });
    return;
  }

  if (pathname === '/api/telegram/check-connection' && req.method === 'GET') {
    const patientId = urlObj.searchParams.get('patientId');
    telegramBot
      .checkPatientConnection(patientId)
      .then((conn) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(conn));
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ connected: false, message: err.message }));
      });
    return;
  }

  if (pathname === '/api/telegram/bind' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { patientId, chatId, username } = JSON.parse(body || '{}');
        const success = telegramBot.bindPatientManually(patientId, chatId, username);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, chatId }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/telegram/send' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await telegramBot.sendMessageToChat(payload.chatId, payload.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            code: 'SERVER_ERROR',
            message: `Telegram xatosi: ${err.message}`,
          })
        );
      }
    });
    return;
  }

  if (pathname === '/api/telegram/test' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await telegramBot.sendTestTelegram(payload.chatId, payload.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            code: 'SERVER_ERROR',
            message: `Test xatoligi: ${err.message}`,
          })
        );
      }
    });
    return;
  }

  // ========================================================
  // 4. SMS API ROUTELARI
  // ========================================================
  if (pathname === '/api/sms/status' && req.method === 'GET') {
    const status = smsProvider.getSmsStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  if (pathname === '/api/sms/send' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await smsProvider.sendSmsViaEskiz(payload.phone, payload.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            code: 'SERVER_ERROR',
            message: `Xatolik yuz berdi: ${err.message}`,
          })
        );
      }
    });
    return;
  }

  // ========================================================
  // 5. STATIK FAYLLARNI SERVIS QILISH (SPA Frontend)
  // ========================================================
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  } else {
    // Agar dist/ papkasi hali build qilinmagan bo'lsa (Expo dev server 8081 portda ishlayotgan paytda)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>DentaCare Backend Server</title><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc;">
          <h2>🏥 DentaCare Markaziy Backend API Server Faol</h2>
          <p>Port: <strong>${PORT}</strong></p>
          <p>PostgreSQL holati: <a href="/api/health" style="color: #38bdf8;">/api/health</a> orqali ko‘ring</p>
          <p>Expo Development Web interfeysi: <a href="http://localhost:8081" style="color: #34d399;">http://localhost:8081</a></p>
        </body>
      </html>
    `);
  }
});

// Serverni ishga tushirish va bazani ulash
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================`);
  console.log(`🏥 DentaCare Stomatologiya Markaziy Serveri Faol!`);
  console.log(`   Manzil (Local):   http://localhost:${PORT}`);
  console.log(`   Manzil (Tarmoq):  http://0.0.0.0:${PORT}`);
  console.log(`====================================================`);

  // PostgreSQL bazasini ishga tushirish
  await db.init();

  telegramBot.getBotInfo().then((info) => {
    if (info.ok) {
      console.log(`Telegram Bot faol: @${info.username} (${info.firstName})`);
    } else {
      console.log(`Telegram Bot holati:`, info.message);
    }
  });
});
