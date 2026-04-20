import admin from 'firebase-admin';
import { env } from '../config/env.js';

let appInstance;

function createCredential() {
  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return admin.credential.cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey
    });
  }

  return admin.credential.applicationDefault();
}

export function getFirebaseApp() {
  if (!appInstance) {
    appInstance = admin.initializeApp({
      credential: createCredential(),
      projectId: env.firebaseProjectId || undefined
    });
  }

  return appInstance;
}

export function getFirestore() {
  return getFirebaseApp().firestore();
}

export function getFirebaseAuth() {
  return getFirebaseApp().auth();
}
