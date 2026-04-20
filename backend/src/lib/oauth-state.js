import { env } from '../config/env.js';
import { decryptJson, encryptJson } from './crypto.js';

const TTL_MS = 10 * 60 * 1000;

export function createOauthState(payload) {
  return encryptJson(
    {
      ...payload,
      exp: Date.now() + TTL_MS
    },
    env.oauthStateSecret
  );
}

export function parseOauthState(value) {
  const payload = decryptJson(value, env.oauthStateSecret);

  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error('OAuth state expired');
  }

  return payload;
}
