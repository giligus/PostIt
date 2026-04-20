import { env } from '../config/env.js';
import { ApiError, fetchJson, formBody } from '../lib/http.js';

const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

function redirectUri() {
  return `${env.appBaseUrl}/api/oauth/linkedin/callback`;
}

function linkedinVersionHeader() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export const linkedinProvider = {
  key: 'linkedin',
  displayName: 'LinkedIn',
  connectLabel: 'Connect LinkedIn account',
  publishSupport: ['text'],
  notes: [
    'Uses LinkedIn member posting via the Posts API.',
    'Organization posting usually needs extra permissions beyond this first backend cut.'
  ],
  isConfigured() {
    return Boolean(env.linkedinClientId && env.linkedinClientSecret);
  },
  getMissingConfig() {
    return ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'].filter((key) => !process.env[key]);
  },
  getAuthorizationUrl({ state }) {
    const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', env.linkedinClientId);
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES.join(' '));
    return url.toString();
  },
  async exchangeCode({ code }) {
    const { data } = await fetchJson('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        client_id: env.linkedinClientId,
        client_secret: env.linkedinClientSecret
      })
    });

    const me = await fetchJson('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${data.access_token}`
      }
    });

    const personId = me.data.sub;
    return {
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      scopes: String(data.scope || '').split(' ').filter(Boolean),
      summary: {
        accountId: personId,
        accountHandle: me.data.email || '',
        authorUrn: `urn:li:person:${personId}`,
        displayName: me.data.name || [me.data.given_name, me.data.family_name].filter(Boolean).join(' '),
        email: me.data.email || '',
        avatarUrl: me.data.picture || ''
      },
      secrets: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || ''
      }
    };
  },
  async publish(integration, payload) {
    if (!payload.text?.trim()) {
      throw new ApiError(400, 'LinkedIn publishing requires text');
    }

    const { response } = await fetchJson('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.secrets.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Linkedin-Version': linkedinVersionHeader()
      },
      body: JSON.stringify({
        author: integration.summary.authorUrn,
        commentary: payload.text.trim(),
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    });

    return {
      platform: 'linkedin',
      postId: response.headers.get('x-restli-id') || '',
      text: payload.text.trim()
    };
  }
};
