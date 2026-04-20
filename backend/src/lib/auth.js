import { getFirebaseAuth } from './firebase-admin.js';

function readBearerToken(value) {
  if (!value || !value.startsWith('Bearer ')) {
    return '';
  }

  return value.slice('Bearer '.length).trim();
}

export async function requireUser(req, res, next) {
  const token = readBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Missing Firebase bearer token' });
    return;
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || ''
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid Firebase token', details: error.message });
  }
}
