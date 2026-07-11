// Settings persisted in chrome.storage.local. Used by the service worker and popup.
export const KEYS = ['jinaKey', 'openrouterKey', 'model'];
export const DEFAULTS = { jinaKey: '', openrouterKey: '', model: '' };

export async function getSettings() {
  const stored = await chrome.storage.local.get(KEYS);
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

export function isConfigured(s) {
  return Boolean(s && s.jinaKey && s.openrouterKey && s.model);
}
