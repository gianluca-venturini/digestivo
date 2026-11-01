// "Connect OpenRouter": the first half of OpenRouter's OAuth PKCE flow.
// Used by the popup. See plans/2026-10-31-openrouter-connect.md.
//
// The popup makes a secret (verifier) and saves it, then opens OpenRouter.
// OpenRouter sends the user back to news.ycombinator.com with ?code=…&state=….
// The content script there (src/content.js, finishConnect) checks `state`,
// sends the code and the verifier to OpenRouter, and saves the new key.
const OPENROUTER_AUTH = 'https://openrouter.ai/auth';
// The content script already runs on every HN page, on all browsers.
export const CALLBACK_URL = 'https://news.ycombinator.com/';
export const KEY_LABEL = 'HN Summary';

function base64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteCount) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteCount)));
}

async function sha256Challenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

// Saves the verifier, then returns the OpenRouter URL to open.
// Save first: the popup closes (and loses its memory) when the tab opens.
export async function startConnect() {
  const verifier = randomString(32); // 43 characters
  const state = randomString(16);
  const challenge = await sha256Challenge(verifier);
  await chrome.storage.local.set({ oauthPending: { verifier, state, createdAt: Date.now() } });
  const params = new URLSearchParams({
    callback_url: CALLBACK_URL,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    key_label: KEY_LABEL,
  });
  return `${OPENROUTER_AUTH}?${params}`;
}
