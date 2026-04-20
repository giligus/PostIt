import { env } from '../config/env.js';
import { ApiError, fetchJson, formBody } from '../lib/http.js';

const SCOPES = ['user.info.basic', 'user.info.profile', 'video.upload'];

function redirectUri() {
  return `${env.appBaseUrl}/api/oauth/tiktok/callback`;
}

export const tiktokProvider = {
  key: 'tiktok',
  displayName: 'TikTok',
  connectLabel: 'Connect TikTok account',
  publishSupport: [],
  notes: [
    'OAuth and token storage are wired up.',
    'Posting still needs the dedicated TikTok upload pipeline and approved video scopes.'
  ],
  isConfigured() {
    return Boolean(env.tiktokClientKey && env.tiktokClientSecret);
  },
  getMissingConfig() {
    return ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'].filter((key) => !process.env[key]);
  },
  getAuthorizationUrl({ state }) {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', env.tiktokClientKey);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('state', state);
    return url.toString();
  },
  async exchangeCode({ code }) {
    const { data } = await fetchJson('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        client_key: env.tiktokClientKey,
        client_secret: env.tiktokClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri()
      })
    });

    const me = await fetchJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username', {
      headers: {
        Authorization: `Bearer ${data.access_token}`
      }
    });

    return {
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      scopes: String(data.scope || '').split(',').filter(Boolean),
      summary: {
        accountId: me.data.data.user.open_id,
        displayName: me.data.data.user.display_name || '',
        accountHandle: me.data.data.user.username ? `@${me.data.data.user.username}` : '',
        username: me.data.data.user.username || '',
        avatarUrl: me.data.data.user.avatar_url || ''
      },
      secrets: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        openId: data.open_id || ''
      }
    };
  },
  async refresh(integration) {
    if (!integration.secrets.refreshToken) {
      throw new ApiError(400, 'TikTok integration does not have a refresh token');
    }

    const { data } = await fetchJson('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        client_key: env.tiktokClientKey,
        client_secret: env.tiktokClientSecret,
        grant_type: 'refresh_token',
        refresh_token: integration.secrets.refreshToken
      })
    });

    return {
      ...integration,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : integration.expiresAt,
      scopes: String(data.scope || '').split(',').filter(Boolean),
      secrets: {
        ...integration.secrets,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || integration.secrets.refreshToken,
        openId: data.open_id || integration.secrets.openId
      }
    };
  },
  async publish() {
    throw new ApiError(501, 'TikTok posting is not wired yet. The connect flow is ready, but the video upload pipeline still needs to be built.');
  }
};
