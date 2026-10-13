const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PGlite } = require('@electric-sql/pglite');
const { hashPin } = require('./cryptoUtils');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.pglite = null;
    this.isEmbedded = false;
    this.isConnected = false;
    this.lastError = null;
    this.initPromise = null;
  }

  getPoolConfig() {
    if (process.env.DATABASE_URL) {
      const isCloudOrRender =
        process.env.RENDER === 'true' ||
        process.env.NODE_ENV === 'production' ||
        (!process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1'));

      const useSsl =
        process.env.DATABASE_SSL === 'false'
          ? false
          : isCloudOrRender || process.env.DATABASE_SSL === 'true';

      return {
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.PGMAX || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Bulutli/Render PostgreSQL ulanishi uchun 10s timeout
      };
    }

    return {
      host: process.env.PGHOST || process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
      database: process.env.PGDATABASE || process.env.DB_NAME || 'dentacare',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // 1. Birinchi navbatda tashqi/bulutli PostgreSQL (Render DATABASE_URL yoki Docker) ni tekshiramiz
      const config = this.getPoolConfig();
      const hostLabel = config.connectionString
        ? 'DATABASE_URL (Render/Cloud PostgreSQL)'
        : `${config.host}:${config.port}/${config.database}`;

      let connectedExternal = false;
      try {
        console.log(`[PostgreSQL] PostgreSQL serveriga ulanish tekshirilmoqda (${hostLabel})...`);
        const tempPool = new Pool(config);
        const client = await tempPool.connect();
        const res = await client.query('SELECT NOW() as current_time, current_database() as db_name, version()');
        client.release();

        this.pool = tempPool;
        this.isEmbedded = false;
        this.isConnected = true;
        this.lastError = null;
        connectedExternal = true;

        this.pool.on('error', (err) => {
          console.error('[PostgreSQL] Kutilmagan pul xatosi:', err.message);
          this.isConnected = false;
          this.lastError = err.message;
        });

        console.log(`[PostgreSQL] Baza muvaffaqiyatli ulandi! (${hostLabel})`);
        console.log(`[PostgreSQL] Baza nomi: ${res.rows[0].db_name}, Vaqt: ${res.rows[0].current_time}`);
      } catch (externalErr) {
        console.warn(`[PostgreSQL] Tashqi/Render PostgreSQL ga ulanmadi (${externalErr.message}).`);

        if (process.env.RENDER === 'true' || process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
          console.error(`[PostgreSQL] DIQQAT: Render ishlab chiqarish muhitida doimiy Render PostgreSQL bazasiga ulanish zarur!`);
          console.error(`[PostgreSQL] Render boshqaruv panelida 'DATABASE_URL' to‘g‘ri kiritilganligini tekshiring.`);
          this.isConnected = false;
          this.lastError = `Render PostgreSQL bazasiga ulanib bo‘lmadi: ${externalErr.message}. Iltimos, Render boshqaruv panelida DATABASE_URL sozlamasini tekshiring.`;
          return false;
        }

        console.log(`[PostgreSQL] Ichki zaxira PostgreSQL dvigateli (PGlite 18.6 WASM) ishga tushirilmoqda...`);
      }

      // 2. Agar tashqi baza bo'lmasa, mahalliy PGlite PostgreSQL dvigatelini ishga tushiramiz
      if (!connectedExternal) {
        try {
          const dataDir = path.join(__dirname, 'data', 'postgres_db');
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }

          this.pglite = new PGlite(dataDir);
          await this.pglite.waitReady;
          this.isEmbedded = true;
          this.isConnected = true;
          this.lastError = null;
          console.log(`[PostgreSQL] Doimiy PostgreSQL (PGlite) muvaffaqiyatli ishga tushdi!`);
          console.log(`[PostgreSQL] Saqlash katalogi: ${dataDir}`);
        } catch (embeddedErr) {
          this.isConnected = false;
          this.lastError = embeddedErr.message;
          console.error(`[PostgreSQL] PostgreSQL dvigatelini ishga tushirib bo‘lmadi:`, embeddedErr.message);
          return false;
        }
      }

      // 3. Sxema migratsiyasini bajarish
      try {
        await this.runMigrations();
      } catch (migErr) {
        console.error('[PostgreSQL] Sxema migratsiyasida xatolik:', migErr.message);
      }

      // 4. Boshlang'ich ma'lumotlarni tekshirish va tozalash
      try {
        await this.seedInitialDataIfEmpty();
      } catch (seedErr) {
        console.error('[PostgreSQL] Boshlang‘ich ma’lumotlarni kiritishda xatolik:', seedErr.message);
      }

      return true;
    })();

    return this.initPromise;
  }

  isReady() {
    return this.isConnected && (this.pool !== null || this.pglite !== null);
  }

  getDbStatus() {
    return {
      connected: this.isConnected,
      engine: 'PostgreSQL',
      mode: this.isEmbedded
        ? 'PostgreSQL (Embedded PGlite 18.6)'
        : (process.env.DATABASE_URL ? 'PostgreSQL (Render / Managed Cloud)' : 'PostgreSQL (External Server)'),
      lastError: this.lastError,
      database: this.isEmbedded ? 'dentacare (pglite)' : (process.env.PGDATABASE || process.env.DB_NAME || 'dentacare'),
      host: this.isEmbedded ? 'embedded' : (process.env.DATABASE_URL ? 'cloud-db' : (process.env.PGHOST || '127.0.0.1')),
      port: this.isEmbedded ? 3000 : parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
    };
  }

  async runMigrations() {
    const schemaFile = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaFile)) {
      console.warn('[PostgreSQL] schema.sql fayli topilmadi!');
      return;
    }

    const sql = fs.readFileSync(schemaFile, 'utf8');

    if (this.isEmbedded && this.pglite) {
      await this.pglite.exec(sql);
      console.log('[PostgreSQL] Sxema va jadvallar muvaffaqiyatli tekshirildi/yaratildi (PGlite).');
      return;
    }

    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('[PostgreSQL] Sxema va jadvallar muvaffaqiyatli tekshirildi/yaratildi (External Pool).');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[PostgreSQL] Sxema yaratishda xatolik:', err);
        throw err;
      } finally {
        client.release();
      }
    }
  }

  async query(text, params = []) {
    if (!this.isReady()) {
      throw new Error(`PostgreSQL bazasi ulanmagan: ${this.lastError || 'Server tayyor emas'}`);
    }

    if (this.isEmbedded && this.pglite) {
      return this.pglite.query(text, params);
    }

    return this.pool.query(text, params);
  }

  async withTransaction(callback) {
    if (!this.isReady()) {
      throw new Error(`PostgreSQL bazasi ulanmagan: ${this.lastError || 'Server tayyor emas'}`);
    }

    if (this.isEmbedded && this.pglite) {
      return this.pglite.transaction(async (tx) => {
        return callback(tx);
      });
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Baza bo'sh bo'lganda faqat tizim sozlamalari jadvalini tekshirish.
   * HAQIQIY ISHLATISH QOIDASI:
   * Hech qanday soxta demo bemorlar, qabullar, to'lovlar, demo shifokorlar,
   * soxta xizmatlar yoki standart PIN/parolli xodimlar avtomatik kiritilmaydi.
   * Klinika birinchi ishga tushirishda o'z adminini, shifokorlarini va xizmatlarini o'zi kiritadi.
   */
  async seedInitialDataIfEmpty() {
    try {
      // Faqat asosiy clinic_settings qatori mavjudligini ta'minlash (agar hali yaratilmagan bo'lsa)
      const setRes = await this.query('SELECT COUNT(*) as cnt FROM clinic_settings WHERE id = $1', ['default']);
      if (parseInt(setRes.rows[0].cnt, 10) === 0) {
        await this.query(
          `INSERT INTO clinic_settings (id, name, tagline, address, phone, working_hours, default_appointment_duration, currency, tax_rate_percent)
           VALUES ('default', 'DentaCare Stomatologiya Markazi', 'Zamonaviy tish davolash va diagnostika klinikasi', '', '', 'Dush - Shan: 09:00 - 18:00', 30, 'so''m', 0)
           ON CONFLICT (id) DO NOTHING`
        );
      }
    } catch (err) {
      console.warn('[PostgreSQL] Birlamchi sozlamalarni tekshirishda xatolik:', err.message);
    }
  }
}

const db = new DatabaseManager();
module.exports = db;
