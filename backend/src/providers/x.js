import { env } from '../config/env.js';
import { createPkcePair } from '../lib/crypto.js';
import { ApiError, fetchJson, formBody } from '../lib/http.js';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];

function redirectUri() {
  return `${env.appBaseUrl}/api/oauth/x/callback`;
}

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${env.xClientId}:${env.xClientSecret}`).toString('base64')}`;
}

export const xProvider = {
  key: 'x',
  displayName: 'X',
  connectLabel: 'Connect X account',
  publishSupport: ['text'],
  notes: [
    'Requires an approved X developer app and exact-match callback URL.',
    'This first pass publishes text posts only.'
  ],
  isConfigured() {
    return Boolean(env.xClientId && env.xClientSecret);
  },
  getMissingConfig() {
    return [
      !env.xClientId ? 'X_CLIENT_ID' : '',
      !env.xClientSecret ? 'X_CLIENT_SECRET' : ''
    ].filter(Boolean);
  },
  prepareAuth() {
    const { verifier, challenge } = createPkcePair();
    return {
      state: { codeVerifier: verifier },
      params: { codeChallenge: challenge }
    };
  },
  getAuthorizationUrl({ state, codeChallenge }) {
    const url = new URL('https://x.com/i/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', env.xClientId);
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  },
  async exchangeCode({ code, statePayload }) {
    const { data } = await fetchJson('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(),
        code_verifier: statePayload.codeVerifier
      })
    });

    const me = await fetchJson('https://api.x.com/2/users/me?user.fields=username,name,profile_image_url', {
      headers: {
        Authorization: `Bearer ${data.access_token}`
      }
    });

    return {
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      scopes: String(data.scope || '').split(' ').filter(Boolean),
      summary: {
        accountId: me.data.data.id,
        accountHandle: `@${me.data.data.username}`,
        displayName: me.data.data.name,
        username: me.data.data.username,
        avatarUrl: me.data.data.profile_image_url || ''
      },
      secrets: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        tokenType: data.token_type || 'bearer'
      }
    };
  },
  async refresh(integration) {
    if (!integration.secrets.refreshToken) {
      throw new ApiError(400, 'X integration does not have a refresh token');
    }

    const { data } = await fetchJson('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        refresh_token: integration.secrets.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    return {
      ...integration,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : integration.expiresAt,
      scopes: String(data.scope || '').split(' ').filter(Boolean),
      secrets: {
        ...integration.secrets,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || integration.secrets.refreshToken
      }
    };
  },
  async publish(integration, payload) {
    if (!payload.text?.trim()) {
      throw new ApiError(400, 'X publishing requires text');
    }

    const { data } = await fetchJson('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.secrets.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: payload.text.trim()
      })
    });

    return {
      platform: 'x',
      postId: data.data.id,
      text: data.data.text,
      url: integration.summary.username ? `https://x.com/${integration.summary.username}/status/${data.data.id}` : ''
    };
  }
};
