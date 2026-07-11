// OpenRouter client. Used by the popup to populate the model picker.
// The public /models endpoint is CORS-enabled and needs no API key.
const OR_BASE = 'https://openrouter.ai/api/v1';

export async function listModels() {
  const res = await fetch(`${OR_BASE}/models`);
  if (!res.ok) throw new Error(`models ${res.status}`);
  const body = await res.json();
  return body.data || [];
}
