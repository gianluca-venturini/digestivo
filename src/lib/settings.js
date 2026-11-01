// Settings persisted in chrome.storage.local. Used by the popup.
export const KEYS = ['openrouterKey', 'model'];
export const DEFAULTS = { openrouterKey: '', model: '' };

export async function getSettings() {
  const stored = await chrome.storage.local.get(KEYS);
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

export function isConfigured(s) {
  return Boolean(s && s.openrouterKey && s.model);
}
