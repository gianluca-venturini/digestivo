// OpenRouter client (OpenAI-compatible). Browser/extension calls are supported.
const OR_BASE = 'https://openrouter.ai/api/v1';

// Public, no key required — used by the popup to populate the model picker.
export async function listModels() {
  const res = await fetch(`${OR_BASE}/models`);
  if (!res.ok) throw new Error(`models ${res.status}`);
  const body = await res.json();
  return body.data || [];
}

// Summarize text. On failure throws { stage: 'summarize', code, raw }.
export async function summarize({ openrouterKey, model, system, user, maxTokens }) {
  let res;
  try {
    res = await fetch(`${OR_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://news.ycombinator.com/',
        'X-Title': 'HN Summary',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
        // Keep reasoning models (gpt-5, o-series, r1) from spending the whole
        // token budget on hidden reasoning and returning empty content.
        // Ignored by models that don't support reasoning.
        reasoning: { effort: 'low', exclude: true },
      }),
    });
  } catch (e) {
    throw { stage: 'summarize', code: 0, name: 'NetworkError', raw: String(e) };
  }

  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON */
  }

  if (!res.ok || !body || body.error) {
    const code = (body && body.error && body.error.code) || res.status;
    const msg = (body && body.error && body.error.message) || text.slice(0, 500);
    throw { stage: 'summarize', code, raw: `OpenRouter ${code}: ${msg}` };
  }

  const choice = body.choices && body.choices[0];
  const msg = choice && choice.message;
  let content = '';
  if (msg) {
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // some providers return content as an array of parts
      content = msg.content
        .map((p) => (typeof p === 'string' ? p : (p && p.text) || ''))
        .join('');
    }
  }
  content = content.trim();

  if (!content) {
    const finish = choice && choice.finish_reason;
    throw {
      stage: 'summarize',
      code: res.status,
      name: 'EmptyContent',
      raw: `OpenRouter: empty content (finish_reason=${finish}): ${text.slice(0, 300)}`,
    };
  }
  return content;
}
