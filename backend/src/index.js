import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { env } from './config/env.js';
import { requireUser } from './lib/auth.js';
import { ApiError } from './lib/http.js';
import { deleteIntegration, getIntegration, listStoredIntegrations, saveIntegration } from './lib/integration-store.js';
import { createOauthState, parseOauthState } from './lib/oauth-state.js';
import { listProviderDefinitions, providerRegistry } from './providers/index.js';

const app = express();

const publishSchema = z.object({
  provider: z.enum(['x', 'linkedin', 'meta', 'tiktok', 'youtube']),
  text: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  targetId: z.string().optional()
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.length === 0 || env.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

function getProviderOrThrow(providerKey) {
  const provider = providerRegistry[providerKey];
  if (!provider) {
    throw new ApiError(404, `Unknown provider: ${providerKey}`);
  }
  if (!provider.isConfigured()) {
    throw new ApiError(400, `${provider.displayName} is not configured`, provider.getMissingConfig());
  }
  return provider;
}

async function maybeRefresh(provider, integration, uid) {
  if (!integration.expiresAt || !provider.refresh) {
    return integration;
  }

  const expiresAt = new Date(integration.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > 5 * 60 * 1000) {
    return integration;
  }

  const refreshed = await provider.refresh(integration);
  await saveIntegration(uid, provider.key, {
    expiresAt: refreshed.expiresAt,
    scopes: refreshed.scopes,
    summary: refreshed.summary,
    secrets: refreshed.secrets
  });
  return refreshed;
}

function buildFrontendRedirect(providerKey, status, message = '') {
  const url = new URL(env.frontendBaseUrl);
  url.searchParams.set('integration', providerKey);
  url.searchParams.set('status', status);
  if (message) {
    url.searchParams.set('message', message);
  }
  return url.toString();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'postit-backend' });
});

app.get('/api/providers', requireUser, async (req, res, next) => {
  try {
    const stored = await listStoredIntegrations(req.user.uid);
    const providers = listProviderDefinitions().map((provider) => ({
      ...provider,
      connected: Boolean(stored[provider.key]),
      integration: stored[provider.key]?.summary || null,
      connectedAt: stored[provider.key]?.connectedAt || null,
      expiresAt: stored[provider.key]?.expiresAt || null
    }));

    res.json({ providers });
  } catch (error) {
    next(error);
  }
});

app.post('/api/integrations/:provider/connect', requireUser, async (req, res, next) => {
  try {
    const provider = getProviderOrThrow(req.params.provider);
    const prep = provider.prepareAuth ? await provider.prepareAuth() : {};
    const state = createOauthState({
      uid: req.user.uid,
      provider: provider.key,
      ...(prep.state || {})
    });
    const url = provider.getAuthorizationUrl({
      state,
      ...(prep.params || {})
    });
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/integrations/:provider', requireUser, async (req, res, next) => {
  try {
    getProviderOrThrow(req.params.provider);
    await deleteIntegration(req.user.uid, req.params.provider);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/oauth/:provider/callback', async (req, res) => {
  const providerKey = req.params.provider;

  try {
    const provider = getProviderOrThrow(providerKey);
    const { state, code, error, error_description: errorDescription } = req.query;

    if (error) {
      res.redirect(buildFrontendRedirect(providerKey, 'error', String(errorDescription || error)));
      return;
    }

    if (!state || !code) {
      throw new ApiError(400, 'Missing state or code');
    }

    const statePayload = parseOauthState(String(state));
    if (statePayload.provider !== provider.key) {
      throw new ApiError(400, 'OAuth provider mismatch');
    }

    const integration = await provider.exchangeCode({
      code: String(code),
      statePayload
    });

    await saveIntegration(statePayload.uid, provider.key, integration);
    res.redirect(buildFrontendRedirect(provider.key, 'connected'));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : error.message || 'OAuth callback failed';
    res.redirect(buildFrontendRedirect(providerKey, 'error', message));
  }
});

app.post('/api/publish', requireUser, async (req, res, next) => {
  try {
    const payload = publishSchema.parse(req.body);
    const provider = getProviderOrThrow(payload.provider);
    const stored = await getIntegration(req.user.uid, provider.key);

    if (!stored) {
      throw new ApiError(404, `${provider.displayName} is not connected for this user`);
    }

    const integration = await maybeRefresh(provider, stored, req.user.uid);
    const result = await provider.publish(integration, payload);
    res.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid request payload', details: error.flatten() });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message, details: error.details || null });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Internal server error', details: error.message || null });
});

app.listen(env.port, () => {
  console.log(`PostIt backend listening on ${env.port}`);
});
