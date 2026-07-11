// Background service worker: the only context that can make CORS-exempt
// cross-origin requests. Content scripts send it { type: 'summarize', ... }.
import { getSettings, isConfigured } from './lib/settings.js';
import { fetchReadable } from './lib/jina.js';
import { summarize } from './lib/openrouter.js';
import { curateError } from './lib/errors.js';
import { PROMPTS, MAX_TOKENS } from './lib/prompts.js';

const MAX_CHARS = 24000; // cap article text sent to the model, to control cost

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'summarize') return;
  handleSummarize(msg).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function handleSummarize({ url, mode, fresh }) {
  const settings = await getSettings();
  if (!isConfigured(settings)) {
    return { ok: false, stage: 'fetch', code: 0, curated: 'Add your API keys in settings', raw: 'not configured' };
  }

  try {
    const { title, content } = await fetchReadable(url, { jinaKey: settings.jinaKey, fresh });
    const article = content.length > MAX_CHARS ? content.slice(0, MAX_CHARS) : content;

    const summary = await summarize({
      openrouterKey: settings.openrouterKey,
      model: settings.model,
      system: PROMPTS[mode] || PROMPTS.short,
      user: `${title}\n\n${article}`,
      maxTokens: MAX_TOKENS[mode] || MAX_TOKENS.short,
    });

    return { ok: true, title, summary, model: settings.model };
  } catch (err) {
    const stage = err && err.stage ? err.stage : 'summarize';
    const code = err && err.code ? err.code : 0;
    const curated = curateError({ stage, code, name: err && err.name });
    const raw = (err && err.raw) || String(err);
    return { ok: false, stage, code, curated, raw };
  }
}
