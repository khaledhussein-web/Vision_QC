const stripTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const envBaseUrl = stripTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL || '');
export const API_BASE_URL = envBaseUrl || 'http://10.0.2.2:5000';

export const resolveBackendAssetUrl = (rawUrl) => {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  try {
    const api = new URL(API_BASE_URL);
    const asset = new URL(url);
    if (asset.hostname === 'localhost' || asset.hostname === '127.0.0.1') {
      asset.hostname = api.hostname;
      asset.port = api.port;
      asset.protocol = api.protocol;
    }
    return asset.toString();
  } catch (_error) {
    return url;
  }
};
