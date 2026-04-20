import crypto from 'node:crypto';

function pack(buffer) {
  return buffer.toString('base64url');
}

function unpack(value) {
  return Buffer.from(value, 'base64url');
}

export function encryptJson(payload, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${pack(iv)}.${pack(tag)}.${pack(encrypted)}`;
}

export function decryptJson(value, key) {
  const [ivPart, tagPart, encryptedPart] = String(value || '').split('.');

  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, unpack(ivPart));
  decipher.setAuthTag(unpack(tagPart));
  const decrypted = Buffer.concat([decipher.update(unpack(encryptedPart)), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function createPkcePair() {
  const verifier = pack(crypto.randomBytes(48));
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
