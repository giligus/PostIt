import { env } from '../config/env.js';
import { decryptJson, encryptJson } from './crypto.js';
import { getFirestore } from './firebase-admin.js';

function docRef(uid, provider) {
  return getFirestore().collection('users').doc(uid).collection('integrations').doc(provider);
}

export async function saveIntegration(uid, provider, record) {
  await docRef(uid, provider).set(
    {
      provider,
      connectedAt: record.connectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: record.expiresAt || null,
      scopes: record.scopes || [],
      summary: record.summary || {},
      secrets: encryptJson(record.secrets || {}, env.integrationEncryptionKey)
    },
    { merge: true }
  );
}

export async function getIntegration(uid, provider) {
  const snapshot = await docRef(uid, provider).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();
  return {
    ...data,
    secrets: decryptJson(data.secrets, env.integrationEncryptionKey)
  };
}

export async function listStoredIntegrations(uid) {
  const snapshot = await getFirestore().collection('users').doc(uid).collection('integrations').get();
  const result = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    result[doc.id] = {
      provider: doc.id,
      connectedAt: data.connectedAt || null,
      updatedAt: data.updatedAt || null,
      expiresAt: data.expiresAt || null,
      scopes: data.scopes || [],
      summary: data.summary || {}
    };
  });

  return result;
}

export async function deleteIntegration(uid, provider) {
  await docRef(uid, provider).delete();
}
