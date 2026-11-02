const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const { Pool, types } = require('pg');

// PostgreSQL BIGINT (int8) va NUMERIC turlarini JavaScript soniga (Number) aylantirish
// Bu orqali satrlar qo'shilib ketishi va "5.00 000 025e+58" kabi eksponentsial xatolar butunlay bartaraf etiladi
types.setTypeParser(20, (val) => (val === null ? 0 : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? 0 : parseFloat(val)));

const { hashPin } = require('./cryptoUtils');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.lastError = null;
    this.initPromise = null;
  }

  getPoolConfig() {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.TARGET_DATABASE_URL;

    if (connectionString) {
      const isCloudOrRender =
        process.env.RENDER === 'true' ||
        process.env.NODE_ENV === 'production' ||
        (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'));

      const useSsl =
        process.env.DATABASE_SSL === 'false'
          ? false
          : isCloudOrRender || process.env.DATABASE_SSL === 'true';

      return {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.PGMAX || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
    }

    return {
      host: process.env.PGHOST || process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
      database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const config = this.getPoolConfig();
      const isSupabase =
        (config.connectionString && config.connectionString.includes('supabase')) ||
        Boolean(process.env.SUPABASE_DATABASE_URL);

      console.log(`[Supabase] Supabase ma’lumotlar bazasiga ulanish tekshirilmoqda...`);

      try {
        const tempPool = new Pool(config);
        const client = await tempPool.connect();
        const res = await client.query('SELECT NOW() as current_time, current_database() as db_name');
        client.release();

        this.pool = tempPool;
        this.isConnected = true;
        this.lastError = null;

        this.pool.on('error', (err) => {
          console.error('[Supabase] Ulanish pulida xatolik yuz berdi:', err.message);
          this.isConnected = false;
          this.lastError = err.message;
        });

        console.log(`[Supabase] Supabase PostgreSQL bazasi muvaffaqiyatli ulandi!`);
        console.log(`[Supabase] Baza: ${res.rows[0].db_name}, Server vaqti: ${res.rows[0].current_time}`);
      } catch (err) {
        console.error(`[Supabase] Supabase bazasiga ulanib bo‘lmadi:`, err.message);
        this.isConnected = false;
        this.lastError = `Supabase bazasiga ulanishda xatolik: ${err.message}. Render muhitida DATABASE_URL to‘g‘ri kiritilganini tekshiring.`;
        return false;
      }

      // Sxemani tekshirish
      try {
        await this.runMigrations();
      } catch (migErr) {
        console.error('[Supabase] Sxema tekshiruvida xatolik:', migErr.message);
      }

      // Boshlang'ich sozlamalar mavjudligini ta'minlash
      try {
        await this.seedInitialDataIfEmpty();
      } catch (seedErr) {
        console.error('[Supabase] Boshlang‘ich sozlamalarni tekshirishda xatolik:', seedErr.message);
      }

      return true;
    })();

    return this.initPromise;
  }

  isReady() {
    return this.isConnected && this.pool !== null;
  }

  async ping() {
    if (!this.isConnected || !this.pool) {
      return { connected: false, error: this.lastError || 'Supabase bazasi ulanmagan' };
    }
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1 as ping');
        this.isConnected = true;
        this.lastError = null;
        return { connected: true };
      } finally {
        client.release();
      }
    } catch (err) {
      this.isConnected = false;
      this.lastError = err.message;
      return { connected: false, error: err.message };
    }
  }

  getDbStatus() {
    return {
      connected: this.isConnected,
      engine: 'Supabase (PostgreSQL)',
      mode: 'Supabase Cloud Database',
      lastError: this.lastError,
      database: 'postgres',
      host: 'Supabase Cloud',
      port: 5432,
    };
  }

  async runMigrations() {
    const schemaFile = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaFile)) {
      return;
    }

    if (!this.pool) return;

    const sql = fs.readFileSync(schemaFile, 'utf8');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[Supabase] Sxema tekshiruvi xabari:', err.message);
    } finally {
      client.release();
    }
  }

  async query(text, params = []) {
    if (!this.isReady()) {
      throw new Error(`Supabase bazasi ulanmagan: ${this.lastError || 'Server tayyor emas'}`);
    }
    return this.pool.query(text, params);
  }

  async withTransaction(callback) {
    if (!this.isReady()) {
      throw new Error(`Supabase bazasi ulanmagan: ${this.lastError || 'Server tayyor emas'}`);
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

  async seedInitialDataIfEmpty() {
    try {
      const setRes = await this.query('SELECT COUNT(*) as cnt FROM clinic_settings WHERE id = $1', ['default']);
      if (parseInt(setRes.rows[0].cnt, 10) === 0) {
        await this.query(
          `INSERT INTO clinic_settings (id, name, tagline, address, phone, working_hours, default_appointment_duration, currency, tax_rate_percent)
           VALUES ('default', 'DentaCare Stomatologiya Markazi', 'Zamonaviy tish davolash va diagnostika klinikasi', '', '', 'Dush - Shan: 09:00 - 18:00', 30, 'so''m', 0)
           ON CONFLICT (id) DO NOTHING`
        );
      }
    } catch (err) {
      console.warn('[Supabase] Birlamchi sozlamalarni tekshirishda xatolik:', err.message);
    }
  }
}

const db = new DatabaseManager();
module.exports = db;
