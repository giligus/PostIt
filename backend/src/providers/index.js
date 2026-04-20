import { linkedinProvider } from './linkedin.js';
import { metaProvider } from './meta.js';
import { tiktokProvider } from './tiktok.js';
import { xProvider } from './x.js';
import { youtubeProvider } from './youtube.js';

export const providerRegistry = {
  x: xProvider,
  linkedin: linkedinProvider,
  meta: metaProvider,
  tiktok: tiktokProvider,
  youtube: youtubeProvider
};

export function listProviderDefinitions() {
  return Object.values(providerRegistry).map((provider) => ({
    key: provider.key,
    displayName: provider.displayName,
    connectLabel: provider.connectLabel,
    publishSupport: provider.publishSupport,
    configured: provider.isConfigured(),
    missingConfig: provider.getMissingConfig(),
    notes: provider.notes
  }));
}
