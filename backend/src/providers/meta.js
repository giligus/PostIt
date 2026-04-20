import { env } from '../config/env.js';
import { ApiError, fetchJson, formBody } from '../lib/http.js';

const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish'
];

function graphUrl(path) {
  return `https://graph.facebook.com/${env.metaGraphVersion}${path}`;
}

function redirectUri() {
  return `${env.appBaseUrl}/api/oauth/meta/callback`;
}

function pickInstagramTargets(pages) {
  return pages
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
      instagramAccountId: page.instagram_business_account.id,
      instagramUsername: page.instagram_business_account.username || ''
    }));
}

export const metaProvider = {
  key: 'meta',
  displayName: 'Facebook / Instagram',
  connectLabel: 'Connect Meta accounts',
  publishSupport: ['facebook-page-text', 'facebook-page-photo', 'instagram-image'],
  notes: [
    'Facebook Page publishing is supported now.',
    'Instagram publishing needs a Business or Creator account connected to a Facebook Page and a public image URL.'
  ],
  isConfigured() {
    return Boolean(env.metaAppId && env.metaAppSecret);
  },
  getMissingConfig() {
    return ['META_APP_ID', 'META_APP_SECRET'].filter((key) => !process.env[key]);
  },
  getAuthorizationUrl({ state }) {
    const url = new URL(`https://www.facebook.com/${env.metaGraphVersion}/dialog/oauth`);
    url.searchParams.set('client_id', env.metaAppId);
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES.join(','));
    return url.toString();
  },
  async exchangeCode({ code }) {
    const shortLived = await fetchJson(
      `${graphUrl('/oauth/access_token')}?${formBody({
        client_id: env.metaAppId,
        client_secret: env.metaAppSecret,
        redirect_uri: redirectUri(),
        code
      }).toString()}`
    );

    const longLived = await fetchJson(
      `${graphUrl('/oauth/access_token')}?${formBody({
        grant_type: 'fb_exchange_token',
        client_id: env.metaAppId,
        client_secret: env.metaAppSecret,
        fb_exchange_token: shortLived.data.access_token
      }).toString()}`
    );

    const me = await fetchJson(
      `${graphUrl('/me')}?${formBody({
        fields: 'id,name',
        access_token: longLived.data.access_token
      }).toString()}`
    );

    const pages = await fetchJson(
      `${graphUrl('/me/accounts')}?${formBody({
        fields: 'id,name,access_token,instagram_business_account{id,username}',
        limit: 100,
        access_token: longLived.data.access_token
      }).toString()}`
    );

    return {
      expiresAt: longLived.data.expires_in ? new Date(Date.now() + longLived.data.expires_in * 1000).toISOString() : null,
      scopes: SCOPES,
      summary: {
        accountId: me.data.id,
        displayName: me.data.name,
        pages: (pages.data.data || []).map((page) => ({
          id: page.id,
          name: page.name
        })),
        instagramAccounts: pickInstagramTargets(pages.data.data || [])
      },
      secrets: {
        userAccessToken: longLived.data.access_token,
        pages: (pages.data.data || []).map((page) => ({
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          instagramAccountId: page.instagram_business_account?.id || '',
          instagramUsername: page.instagram_business_account?.username || ''
        }))
      }
    };
  },
  async publish(integration, payload) {
    const targetId = String(payload.targetId || '').trim();

    if (!targetId) {
      throw new ApiError(400, 'Meta publishing needs a targetId (Facebook page or Instagram account)');
    }

    const page = integration.secrets.pages.find(
      (entry) => entry.pageId === targetId || entry.instagramAccountId === targetId
    );

    if (!page) {
      throw new ApiError(404, 'Target Meta page/account is not connected');
    }

    const trimmedText = payload.text?.trim() || '';

    if (page.instagramAccountId && page.instagramAccountId === targetId) {
      if (!payload.mediaUrl) {
        throw new ApiError(400, 'Instagram publishing currently requires a public mediaUrl');
      }

      const media = await fetchJson(
        `${graphUrl(`/${page.instagramAccountId}/media`)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formBody({
            image_url: payload.mediaUrl,
            caption: trimmedText,
            access_token: page.accessToken
          })
        }
      );

      const published = await fetchJson(
        `${graphUrl(`/${page.instagramAccountId}/media_publish`)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formBody({
            creation_id: media.data.id,
            access_token: page.accessToken
          })
        }
      );

      return {
        platform: 'instagram',
        postId: published.data.id,
        text: trimmedText
      };
    }

    const endpoint = payload.mediaUrl ? `/${page.pageId}/photos` : `/${page.pageId}/feed`;
    const body = payload.mediaUrl
      ? formBody({ url: payload.mediaUrl, caption: trimmedText, access_token: page.accessToken })
      : formBody({ message: trimmedText, access_token: page.accessToken });

    const created = await fetchJson(graphUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    return {
      platform: 'facebook',
      postId: created.data.post_id || created.data.id || '',
      text: trimmedText
    };
  }
};
