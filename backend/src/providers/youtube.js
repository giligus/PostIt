import { env } from '../config/env.js';
import { ApiError, fetchJson, formBody } from '../lib/http.js';

const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/youtube.upload'];

function redirectUri() {
  return `${env.appBaseUrl}/api/oauth/youtube/callback`;
}

export const youtubeProvider = {
  key: 'youtube',
  displayName: 'YouTube',
  connectLabel: 'Connect YouTube account',
  publishSupport: [],
  notes: [
    'OAuth and token storage are wired up.',
    'Actual video uploads need a resumable upload pipeline and frontend file handling next.'
  ],
  isConfigured() {
    return Boolean(env.googleClientId && env.googleClientSecret);
  },
  getMissingConfig() {
    return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].filter((key) => !process.env[key]);
  },
  getAuthorizationUrl({ state }) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.googleClientId);
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return url.toString();
  },
  async exchangeCode({ code }) {
    const { data } = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code'
      })
    });

    const me = await fetchJson('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${data.access_token}`
      }
    });

    return {
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      scopes: String(data.scope || '').split(' ').filter(Boolean),
      summary: {
        accountId: me.data.sub,
        displayName: me.data.name || '',
        accountHandle: me.data.email || '',
        email: me.data.email || '',
        avatarUrl: me.data.picture || ''
      },
      secrets: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        tokenType: data.token_type || 'Bearer'
      }
    };
  },
  async refresh(integration) {
    if (!integration.secrets.refreshToken) {
      throw new ApiError(400, 'YouTube integration does not have a refresh token');
    }

    const { data } = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        refresh_token: integration.secrets.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    return {
      ...integration,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : integration.expiresAt,
      scopes: integration.scopes,
      secrets: {
        ...integration.secrets,
        accessToken: data.access_token
      }
    };
  },
  async publish() {
    throw new ApiError(501, 'YouTube publishing is not wired yet. The OAuth flow is ready, but the resumable video upload pipeline still needs to be built.');
  }
};
