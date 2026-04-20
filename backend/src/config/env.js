import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  APP_BASE_URL: z.string().url(),
  FRONTEND_BASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default(''),
  OAUTH_STATE_SECRET: z.string().min(16),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(16),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v23.0'),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional()
});

function parseKey(raw, label) {
  if (!raw) {
    throw new Error(`${label} is required`);
  }

  const trimmed = raw.trim();
  const isHex = /^[a-f0-9]{64}$/i.test(trimmed);
  const buffer = isHex ? Buffer.from(trimmed, 'hex') : Buffer.from(trimmed, 'base64');

  if (buffer.length !== 32) {
    throw new Error(`${label} must decode to exactly 32 bytes`);
  }

  return buffer;
}

const parsed = schema.parse(process.env);

export const env = {
  port: parsed.PORT,
  appBaseUrl: parsed.APP_BASE_URL.replace(/\/$/, ''),
  frontendBaseUrl: parsed.FRONTEND_BASE_URL.replace(/\/$/, ''),
  allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean),
  oauthStateSecret: parseKey(parsed.OAUTH_STATE_SECRET, 'OAUTH_STATE_SECRET'),
  integrationEncryptionKey: parseKey(parsed.INTEGRATION_ENCRYPTION_KEY, 'INTEGRATION_ENCRYPTION_KEY'),
  firebaseProjectId: parsed.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: parsed.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: parsed.FIREBASE_PRIVATE_KEY ? parsed.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  xClientId: parsed.X_CLIENT_ID || '',
  xClientSecret: parsed.X_CLIENT_SECRET || '',
  linkedinClientId: parsed.LINKEDIN_CLIENT_ID || '',
  linkedinClientSecret: parsed.LINKEDIN_CLIENT_SECRET || '',
  metaAppId: parsed.META_APP_ID || '',
  metaAppSecret: parsed.META_APP_SECRET || '',
  metaGraphVersion: parsed.META_GRAPH_VERSION,
  tiktokClientKey: parsed.TIKTOK_CLIENT_KEY || '',
  tiktokClientSecret: parsed.TIKTOK_CLIENT_SECRET || '',
  googleClientId: parsed.GOOGLE_CLIENT_ID || '',
  googleClientSecret: parsed.GOOGLE_CLIENT_SECRET || ''
};
