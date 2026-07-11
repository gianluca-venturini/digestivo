// Jina Reader client. Fetches clean article text.
// On failure throws { stage: 'fetch', code, name?, raw }.
const JINA_BASE = 'https://r.jina.ai/';

export async function fetchReadable(url, { jinaKey, fresh = false } = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Return-Format': 'markdown',
    'X-Retain-Images': 'none',
    'X-Timeout': '20',
  };
  if (jinaKey) headers.Authorization = `Bearer ${jinaKey}`;
  if (fresh) headers['X-No-Cache'] = 'true';

  let res;
  try {
    res = await fetch(JINA_BASE + url, { method: 'GET', headers });
  } catch (e) {
    throw { stage: 'fetch', code: 0, name: 'NetworkError', raw: String(e) };
  }

  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }

  if (!res.ok || !body || body.code >= 400 || !body.data) {
    const code = (body && body.code) || res.status;
    throw {
      stage: 'fetch',
      code,
      name: body && body.name,
      raw: `Jina ${code}: ${(body && body.message) || text.slice(0, 500)}`,
    };
  }

  return { title: body.data.title || '', content: body.data.content || '' };
}
