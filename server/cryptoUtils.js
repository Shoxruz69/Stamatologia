const crypto = require('crypto');

/**
 * PIN kod yoki parolni PBKDF2 va unikal tuz (salt) yordamida xavfsiz heshlash
 * Format: "salt:hash"
 */
function hashPin(pin, salt = null) {
  if (typeof pin !== 'string') {
    pin = String(pin || '');
  }
  const cleanPin = pin.trim();
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(cleanPin, effectiveSalt, 10000, 64, 'sha512').toString('hex');
  return `${effectiveSalt}:${hash}`;
}

/**
 * Kiritilgan PIN kodni saqlangan hash bilan taqqoslash (timingSafeEqual orqali)
 */
function verifyPin(inputPin, storedHash) {
  if (!storedHash) return false;
  if (typeof inputPin !== 'string') {
    inputPin = String(inputPin || '');
  }
  const cleanPin = inputPin.trim();

  // Agar eski ochiq matndagi PIN bo'lsa (migratsiya paytida)
  if (!storedHash.includes(':')) {
    return cleanPin === storedHash.trim();
  }

  const [salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;

  const actualHash = crypto.pbkdf2Sync(cleanPin, salt, 10000, 64, 'sha512').toString('hex');
  const actualBuf = Buffer.from(actualHash, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');

  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Xavfsiz tasodifiy sessiya tokeni yaratish
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPin,
  verifyPin,
  generateSessionToken,
};
