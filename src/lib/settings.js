// Settings persisted in chrome.storage.local. Used by the popup.
// src/content.js is a classic script and cannot import this file. It has a
// copy of resolveEngine(). Change both together.
// authMethod: 'oauth' (key from "Connect OpenRouter") or 'manual' (pasted key).
export const KEYS = ['engine', 'openrouterKey', 'model', 'authMethod', 'connectedAt'];
export const DEFAULTS = { engine: '', openrouterKey: '', model: '', authMethod: '', connectedAt: 0 };

// `engine` is written only when the user changes the toggle. Until then:
// users with a saved OpenRouter key and model keep OpenRouter, and everyone
// else gets the on-device model.
export function resolveEngine(s) {
  if (s && (s.engine === 'nano' || s.engine === 'openrouter')) return s.engine;
  return s && s.openrouterKey && s.model ? 'openrouter' : 'nano';
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(KEYS);
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

export function isConfigured(s) {
  return resolveEngine(s) === 'nano' || Boolean(s.openrouterKey && s.model);
}
