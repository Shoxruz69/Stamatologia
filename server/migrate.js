require('dotenv').config();
const db = require('./db');

async function main() {
  console.log('--- DentaCare PostgreSQL Migratsiyasini Ishga Tushirish ---');
  const connected = await db.init();
  if (!connected) {
    console.error('Xatolik: PostgreSQL bazasiga ulanib bo‘lmadi.');
    process.exit(1);
  }

  console.log('Migratsiya muvaffaqiyatli yakunlandi!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migratsiya jarayonida kutilmagan xatolik:', err);
  process.exit(1);
});
