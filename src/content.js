// Injects + / ++ summary buttons into each Hacker News story, manages the
// per-button state machine, renders the inline summary panel, caches results
// in localStorage, and surfaces errors on the button that produced them.
(() => {
  'use strict';

  // [collapsed label, expanded label] per mode
  const LABEL = { short: ['(+)', '(-)'], long: ['(++)', '(--)'] };
  const TITLE = { short: 'Short summary', long: 'Long summary' };
  const DISABLED_TITLE = {
    openrouter: 'Connect OpenRouter (or paste a key) and pick a model in the extension settings to enable summaries.',
    nano: 'On-device AI is not available here. Choose OpenRouter in the extension settings.',
  };
  const DOWNLOAD_HINT = ' (the first click downloads the on-device model)';
  const NANO_LABEL = 'Gemini Nano (on device)';

  // OpenRouter app attribution (https://openrouter.ai/docs/app-attribution).
  // HTTP-Referer names the app and is required for the app rankings. Keep this
  // URL: if it changes, the ranking starts again from zero.
  const APP_URL = 'https://github.com/gianluca-venturini/digestivo';
  const APP_NAME = 'HN Summary';
  const APP_HEADERS = { 'HTTP-Referer': APP_URL, 'X-OpenRouter-Title': APP_NAME, 'X-Title': APP_NAME };
  const DEFAULT_MODEL = 'openai/gpt-4o-mini'; // same as src/lib/settings.js

  let settings = {};
  let configured = false;
  let nanoState = ''; // Summarizer.availability(): available | downloadable | downloading | unavailable
  const controllers = []; // one per story, for live enable/disable

  // ---- settings ----------------------------------------------------------
  // Copy of resolveEngine() in src/lib/settings.js (this classic script
  // cannot import it). Change both together.
  function resolveEngine(s) {
    if (s && (s.engine === 'nano' || s.engine === 'openrouter')) return s.engine;
    return s && s.openrouterKey && s.model ? 'openrouter' : 'nano';
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(['engine', 'openrouterKey', 'model']);
    settings = { ...stored, engine: resolveEngine(stored) };
    if (settings.engine === 'nano') {
      nanoState = await nanoAvailability();
      configured = nanoState !== 'unavailable';
    } else {
      configured = Boolean(settings.openrouterKey && settings.model);
    }
  }

  function buttonTitle(mode) {
    if (!configured) return DISABLED_TITLE[settings.engine] || DISABLED_TITLE.openrouter;
    if (settings.engine === 'nano' && nanoState !== 'available') return TITLE[mode] + DOWNLOAD_HINT;
    return TITLE[mode];
  }

  // Versions before 0.2.0 stored a Jina key. Delete it.
  try {
    Promise.resolve(chrome.storage.local.remove('jinaKey')).catch(() => {});
  } catch {
    /* ignore */
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.engine || changes.openrouterKey || changes.model) {
      loadSettings().then(() => controllers.forEach((c) => c.refresh()));
    }
  });

  // ---- localStorage cache (key on link + mode) ---------------------------
  const cacheKey = (mode, url) => `hnsum:${mode}:${url}`;
  function readCache(mode, url) {
    try {
      const raw = localStorage.getItem(cacheKey(mode, url));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeCache(mode, url, data) {
    try {
      localStorage.setItem(cacheKey(mode, url), JSON.stringify(data));
    } catch {
      /* quota / disabled storage — ignore, feature still works */
    }
  }

  // ---- helpers -----------------------------------------------------------
  const other = (mode) => (mode === 'short' ? 'long' : 'short');

  function resolveUrl(row) {
    const a = row.querySelector('span.titleline > a');
    if (!a) return null;
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) return href; // external article
    // self / text post (Ask HN, text Show HN, some jobs) -> summarize the discussion
    return row.id ? `https://news.ycombinator.com/item?id=${row.id}` : null;
  }

  // ---- summarization ------------------------------------------------------
  // 1. The background script fetches the article HTML (a content script
  //    cannot read other sites).
  // 2. This script extracts the text locally with Defuddle.
  // 3. This script summarizes the text with one of two engines:
  //    - nano: Chrome's built-in Summarizer API (Gemini Nano, on the device).
  //    - openrouter: OpenRouter, called directly (it sends CORS headers).
  // See plans/2026-10-31-on-device-summarizer.md.
  const MAX_CHARS = 24000;
  const PROMPTS = {
    short:
      'You summarize web pages for a Hacker News reader. Write a 2-3 sentence TL;DR of the content below. ' +
      'Be factual and neutral. No preamble, no "this article" — just the summary.',
    long:
      'You summarize web pages for a Hacker News reader. Summarize the content below as: one sentence of overview, ' +
      'then 4-7 concise bullet points (each starting with "- ") covering the key claims and takeaways. ' +
      'Be factual and neutral. No preamble.',
  };
  const MAX_TOKENS = { short: 1000, long: 2000 };

  function curateError({ stage, code, name } = {}) {
    if (stage === 'fetch') {
      if (name === 'NoBackground') {
        return 'Extension background is not running. Open the extension popup one time, then try again.';
      }
      if (name === 'Timeout') return 'The page took too long to load.';
      if (name === 'Network') return 'Network error. Check your connection.';
      if (name === 'Blocked') return 'Links to local network addresses are not supported.';
      if (name === 'BadUrl') return 'This link cannot be summarized.';
      if (name === 'NotHtml') return 'This link is not a web page (for example, a PDF).';
      if (code === 401 || code === 403) return 'The site blocked the request.';
      if (code === 404 || code === 410) return 'Page not found.';
      if (code === 429) return 'The site limits requests. Try again later.';
      return code ? `Could not fetch the page (HTTP ${code}).` : 'Could not fetch the page.';
    }
    if (stage === 'extract') return 'No article text found on the page.';
    if (name === 'NanoUnavailable') return DISABLED_TITLE.nano;
    if (name === 'NanoNeedsClick') return 'Click the button again to download the on-device model.';
    if (name === 'NanoCreate') return 'Could not start on-device AI. Try again, or choose OpenRouter in settings.';
    if (name === 'NanoLanguage') return 'On-device AI does not support this language. Choose OpenRouter in settings.';
    if (name === 'NanoFailed') return 'On-device AI could not summarize this page.';
    if (name === 'EmptyContent' && settings.engine === 'nano') return 'On-device AI returned no summary.';
    if (name === 'NetworkError') return 'Network error. Check your connection.';
    if (name === 'EmptyContent') return 'Model returned no summary — try another model';
    if (code === 401) return 'OpenRouter key rejected — connect again or check the key in settings';
    if (code === 402) return 'Out of OpenRouter credits';
    if (code === 429) return 'Rate limited — try again shortly';
    if (code === 502 || code === 503) return 'Model unavailable — try another model';
    return 'API error';
  }

  // ---- 1. fetch through the background -----------------------------------
  const REPLY_WAIT_MS = 25000; // background gives up after 20 s
  const pendingTabReplies = new Map(); // reqId -> resolve (reply method B)

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'hnsum:fetch-result') return;
    const resolve = pendingTabReplies.get(msg.reqId);
    if (resolve) resolve(msg.result);
  });

  const NO_BACKGROUND = { ok: false, name: 'NoBackground', status: 0 };

  function withTimeout(promise, ms) {
    let timer;
    const late = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ ...NO_BACKGROUND, raw: `No reply from the background after ${ms / 1000} s` }), ms);
    });
    return Promise.race([promise, late]).finally(() => clearTimeout(timer));
  }

  // Method A: the normal reply of sendMessage.
  function askWithReply(url, fresh) {
    let sent;
    try {
      sent = Promise.resolve(chrome.runtime.sendMessage({ type: 'hnsum:fetch', url, fresh }));
    } catch (e) {
      sent = Promise.reject(e);
    }
    return withTimeout(
      sent.then(
        (reply) => reply || { ...NO_BACKGROUND, empty: true, raw: 'The background sent an empty reply' },
        (e) => ({ ...NO_BACKGROUND, empty: true, raw: String(e) }),
      ),
      REPLY_WAIT_MS,
    );
  }

  // Method B: the background sends the result as a new message to this tab.
  function askWithTabMessage(url, fresh) {
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const arrived = new Promise((resolve) => pendingTabReplies.set(reqId, resolve));
    try {
      Promise.resolve(chrome.runtime.sendMessage({ type: 'hnsum:fetch', url, fresh, reply: 'tab', reqId })).catch(() => {});
    } catch {
      /* the timeout reports it */
    }
    return withTimeout(arrived, REPLY_WAIT_MS).finally(() => pendingTabReplies.delete(reqId));
  }

  async function fetchPage(url, fresh) {
    let page = await askWithReply(url, fresh);
    // An empty reply means the reply channel failed, not the fetch. Ask again
    // with method B. A timeout is not retried (the user already waited 25 s).
    if (!page.ok && page.empty) {
      console.warn('[HN Summary] normal reply failed, trying tab message:', page.raw);
      page = await askWithTabMessage(url, fresh);
    }
    if (!page.ok) {
      throw { stage: 'fetch', code: page.status || 0, name: page.name, raw: page.raw || page.name };
    }
    return page;
  }

  // ---- 2. extract the text locally ---------------------------------------
  // Defuddle must stay local (no network). Three locks make sure of this:
  //  - only parse() is called. Its network code is only in parseAsync().
  //  - the `fetch` option makes every extractor request fail.
  //  - DOMParser documents are inert: no scripts run, no images or frames load.
  // scripts/verify-vendor.sh checks the vendored file and these calls.
  const MIN_WORDS = 20;

  function blockedFetch(input) {
    console.error('[HN Summary] Defuddle tried to use the network. Blocked:', String(input && input.url ? input.url : input));
    return Promise.reject(new Error('Network is blocked during text extraction'));
  }

  const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE',
    'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
    'SECTION', 'TABLE', 'TR', 'UL',
  ]);
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'OBJECT']);

  // Parse with DOMParser (inert). Never put the HTML into the live HN page:
  // that would load its images and frames.
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out.push(child.nodeValue.replace(/\s+/g, ' '));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toUpperCase();
          if (SKIP_TAGS.has(tag)) continue;
          const block = BLOCK_TAGS.has(tag);
          if (block) out.push('\n');
          if (tag === 'LI') out.push('- ');
          if (/^H[1-6]$/.test(tag)) out.push('#'.repeat(Number(tag[1])) + ' ');
          walk(child);
          if (block) out.push('\n');
          if (tag === 'TD' || tag === 'TH') out.push(' ');
        }
      }
    };
    if (doc.body) walk(doc.body);
    return out
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function extract(page) {
    if (/text\/plain/i.test(page.contentType || '')) {
      return { title: '', content: page.html.trim() };
    }
    let title = '';
    let content = '';
    try {
      const doc = new DOMParser().parseFromString(page.html, 'text/html');
      title = doc.title || '';
      const result = new Defuddle(doc, {
        url: page.finalUrl, // else Defuddle sees the HN page URL and uses its HN extractor
        useAsync: false,
        removeImages: true,
        fetch: blockedFetch,
      }).parse();
      title = result.title || title;
      content = htmlToText(result.content || '');
    } catch (e) {
      throw { stage: 'extract', code: 0, name: 'NoContent', raw: `Defuddle failed on ${page.finalUrl}: ${String(e)}` };
    }
    const words = content.split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS) {
      throw { stage: 'extract', code: 0, name: 'NoContent', raw: `Only ${words} words found on ${page.finalUrl}` };
    }
    return { title, content };
  }

  async function fetchReadable(url, fresh) {
    const page = await fetchPage(url, fresh);
    return extract(page);
  }

  // ---- 3a. on-device engine (Chrome Summarizer API) ----------------------
  const NANO_BASE = {
    format: 'markdown',
    expectedInputLanguages: ['en', 'es', 'ja', 'de', 'fr'],
    outputLanguage: 'en',
  };
  const NANO_OPTIONS = {
    short: { type: 'tldr', length: 'medium' }, // 3 sentences at most
    long: { type: 'key-points', length: 'long' }, // 7 bullets at most
  };
  const NANO_FALLBACK_CHARS = 12000; // when measureInputUsage() is missing
  const nanoSummarizers = {}; // mode -> Promise<Summarizer>, kept for the page life
  const nanoProgressListeners = new Set();

  async function nanoAvailability() {
    if (!('Summarizer' in self)) return 'unavailable';
    try {
      return await Summarizer.availability(NANO_BASE);
    } catch (e) {
      console.warn('[HN Summary] Summarizer.availability failed', e);
      return 'unavailable';
    }
  }

  // Call this before the first `await` of a click. If the model is not
  // downloaded, create() needs the click (a user gesture), and Chrome keeps
  // the gesture valid for a few seconds only. The page fetch can take longer.
  function getNanoSummarizer(mode) {
    if (!('Summarizer' in self)) {
      return Promise.reject({ stage: 'summarize', name: 'NanoUnavailable', raw: 'No Summarizer API in this browser' });
    }
    if (!nanoSummarizers[mode]) {
      nanoSummarizers[mode] = Summarizer.create({
        ...NANO_BASE,
        ...NANO_OPTIONS[mode],
        sharedContext: 'An article linked from Hacker News. The reader is a software engineer.',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            nanoProgressListeners.forEach((listener) => listener(e.loaded));
          });
        },
      }).then(
        (summarizer) => {
          if (nanoState !== 'available') {
            nanoState = 'available';
            controllers.forEach((c) => c.refresh()); // remove the download hint
          }
          return summarizer;
        },
        (e) => {
          delete nanoSummarizers[mode]; // let the next click try again
          const name =
            e && e.name === 'NotAllowedError' ? 'NanoNeedsClick'
              : e && e.name === 'NotSupportedError' ? 'NanoLanguage'
                : 'NanoCreate';
          throw { stage: 'summarize', name, raw: `Summarizer.create: ${(e && e.name) || ''} ${String((e && e.message) || e)}` };
        },
      );
    }
    return nanoSummarizers[mode];
  }

  // Nano reads much less text than OpenRouter models. Cut the text until it fits.
  async function fitToQuota(summarizer, text, context) {
    const quota = summarizer.inputQuota;
    if (typeof summarizer.measureInputUsage !== 'function' || !Number.isFinite(quota)) {
      return text.slice(0, NANO_FALLBACK_CHARS);
    }
    let t = text;
    for (let i = 0; i < 4; i++) {
      const used = await summarizer.measureInputUsage(t, { context });
      if (used <= quota) return t;
      t = t.slice(0, Math.floor(t.length * (quota / used) * 0.9));
    }
    return t;
  }

  async function streamNano(summarizer, text, context, onText) {
    let out = '';
    for await (const chunk of summarizer.summarizeStreaming(text, { context })) {
      out += chunk; // each chunk is new text only
      onText(out);
    }
    return out;
  }

  async function summarizeWithNano(mode, title, content, summarizerPromise, ui) {
    const summarizer = await summarizerPromise;
    ui.onStatus('summarizing…');
    const context = title ? `Title: ${title}` : undefined;
    let out = '';
    try {
      let text = await fitToQuota(summarizer, content.slice(0, MAX_CHARS), context);
      try {
        out = await streamNano(summarizer, text, context, ui.onText);
      } catch (e) {
        if (!e || e.name !== 'QuotaExceededError') throw e;
        text = text.slice(0, Math.floor(text.length / 2));
        out = await streamNano(summarizer, text, context, ui.onText);
      }
    } catch (e) {
      // The model can be removed or updated while the page is open. Make a
      // new summarizer on the next click.
      delete nanoSummarizers[mode];
      const name = e && e.name === 'NotSupportedError' ? 'NanoLanguage' : 'NanoFailed';
      throw { stage: 'summarize', name, raw: `Summarizer: ${(e && e.name) || ''} ${String((e && e.message) || e)}` };
    }
    out = out.trim();
    if (!out) {
      throw { stage: 'summarize', name: 'EmptyContent', raw: 'Summarizer returned no text' };
    }
    return out;
  }

  // ---- 3b. OpenRouter engine ----------------------------------------------
  async function summarizeWithOpenRouter(mode, title, content) {
    const article = content.length > MAX_CHARS ? content.slice(0, MAX_CHARS) : content;
    let res;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          ...APP_HEADERS,
          Authorization: `Bearer ${settings.openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: PROMPTS[mode] || PROMPTS.short },
            { role: 'user', content: `${title}\n\n${article}` },
          ],
          max_tokens: MAX_TOKENS[mode] || MAX_TOKENS.short,
          temperature: 0.3,
          reasoning: { effort: 'low', exclude: true },
        }),
      });
    } catch (e) {
      throw { stage: 'summarize', code: 0, name: 'NetworkError', raw: String(e) };
    }
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON */ }
    if (!res.ok || !body || body.error) {
      const code = (body && body.error && body.error.code) || res.status;
      const msg = (body && body.error && body.error.message) || text.slice(0, 500);
      throw { stage: 'summarize', code, raw: `OpenRouter ${code}: ${msg}` };
    }
    const choice = body.choices && body.choices[0];
    const m = choice && choice.message;
    let out = '';
    if (m) {
      if (typeof m.content === 'string') out = m.content;
      else if (Array.isArray(m.content)) {
        out = m.content.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
      }
    }
    out = out.trim();
    if (!out) {
      throw {
        stage: 'summarize',
        code: res.status,
        name: 'EmptyContent',
        raw: `OpenRouter: empty content (finish_reason=${choice && choice.finish_reason}): ${text.slice(0, 300)}`,
      };
    }
    return out;
  }

  // ui: { onStatus(text), onProgress(loaded 0..1), onText(partial summary) }
  async function doSummarize(url, mode, fresh, ui) {
    if (!configured) {
      return { ok: false, stage: 'summarize', code: 0, curated: buttonTitle(mode), raw: 'not configured' };
    }
    const nano = settings.engine === 'nano';
    let summarizerPromise = null;
    if (nano) {
      nanoProgressListeners.add(ui.onProgress);
      // Start now, while the click is still a valid user gesture. The page
      // fetch and the model download then also run at the same time.
      summarizerPromise = getNanoSummarizer(mode);
      summarizerPromise.catch(() => {}); // the error is read after the fetch
    }
    try {
      const { title, content } = await fetchReadable(url, fresh);
      const summary = nano
        ? await summarizeWithNano(mode, title, content, summarizerPromise, ui)
        : await summarizeWithOpenRouter(mode, title, content);
      return { ok: true, title, summary, model: nano ? NANO_LABEL : settings.model };
    } catch (err) {
      const stage = (err && err.stage) || 'summarize';
      const code = (err && err.code) || 0;
      return {
        ok: false,
        stage,
        code,
        curated: curateError({ stage, code, name: err && err.name }),
        raw: (err && err.raw) || String(err),
      };
    } finally {
      if (nano) nanoProgressListeners.delete(ui.onProgress);
    }
  }

  // ---- per-story controller ----------------------------------------------
  function makeStory(subtextRow, subline, url) {
    // Inline panel row, aligned under the title (gutter spans rank+votelinks).
    const panelRow = document.createElement('tr');
    panelRow.className = 'hn-sum-row';
    panelRow.style.display = 'none';
    const gutter = document.createElement('td');
    gutter.colSpan = 2;
    const cell = document.createElement('td');
    cell.className = 'hn-sum-panel';
    panelRow.append(gutter, cell);
    subtextRow.after(panelRow);

    const buttons = {};
    let openMode = null; // 'short' | 'long' | null

    function setLabel(mode) {
      buttons[mode].textContent = LABEL[mode][openMode === mode ? 1 : 0];
    }

    function applyState(mode) {
      const btn = buttons[mode];
      btn.classList.toggle('hn-sum-btn--disabled', !configured);
      if (!configured || !btn.classList.contains('hn-sum-btn--error')) {
        btn.title = buttonTitle(mode);
      }
    }

    function clearError(mode) {
      buttons[mode].classList.remove('hn-sum-btn--error');
      buttons[mode].title = buttonTitle(mode);
    }
    function showError(mode, curated) {
      buttons[mode].classList.add('hn-sum-btn--error');
      buttons[mode].title = curated;
    }

    function collapse() {
      openMode = null;
      panelRow.style.display = 'none';
      setLabel('short');
      setLabel('long');
    }

    function renderLoading(text = 'summarizing…') {
      cell.textContent = '';
      const s = document.createElement('span');
      s.className = 'hn-sum-loading';
      s.textContent = text;
      cell.appendChild(s);
    }

    // Part of a summary while it arrives. No footer until the end.
    let partialFrame = 0;
    let partialText = '';
    function renderPartial(text) {
      partialText = text;
      if (partialFrame) return;
      partialFrame = requestAnimationFrame(() => {
        partialFrame = 0;
        cell.textContent = '';
        const body = document.createElement('div');
        body.className = 'hn-sum-body';
        body.innerHTML = hnsumRenderMarkdown(partialText); // safe: escaped in renderer
        cell.appendChild(body);
      });
    }
    function stopPartial() {
      if (partialFrame) cancelAnimationFrame(partialFrame);
      partialFrame = 0;
    }

    function renderSummary(mode, data) {
      cell.textContent = '';
      const body = document.createElement('div');
      body.className = 'hn-sum-body';
      body.innerHTML = hnsumRenderMarkdown(data.summary); // safe: escaped in renderer
      const foot = document.createElement('div');
      foot.className = 'hn-sum-foot';
      if (data.model) {
        const m = document.createElement('span');
        m.textContent = `via ${data.model}`;
        foot.append(m, document.createTextNode(' · '));
      }
      const refresh = document.createElement('a');
      refresh.className = 'hn-sum-link';
      refresh.textContent = '↻ refresh';
      refresh.addEventListener('click', (e) => {
        e.preventDefault();
        run(mode, true);
      });
      foot.appendChild(refresh);
      cell.append(body, foot);
    }

    function expand(mode, data) {
      openMode = mode;
      renderSummary(mode, data);
      panelRow.style.display = '';
      setLabel('short');
      setLabel('long');
    }

    async function run(mode, fresh) {
      const btn = buttons[mode];
      if (btn.dataset.loading === '1') return;

      if (!fresh) {
        const cached = readCache(mode, url);
        if (cached) {
          clearError(mode);
          expand(mode, cached);
          return;
        }
      }

      // enter loading state
      clearError(mode);
      btn.dataset.loading = '1';
      btn.classList.add('hn-sum-btn--loading');
      openMode = mode;
      btn.textContent = '…';
      setLabel(other(mode));
      renderLoading();
      panelRow.style.display = '';

      let textArrived = false;
      const ui = {
        onStatus(text) {
          if (!textArrived) renderLoading(text);
        },
        onProgress(loaded) {
          if (textArrived || nanoState === 'available') return;
          renderLoading(
            loaded < 1 ? `downloading on-device model… ${Math.floor(loaded * 100)}%` : 'loading on-device model…',
          );
        },
        onText(text) {
          textArrived = true;
          renderPartial(text);
        },
      };

      let resp;
      try {
        resp = await doSummarize(url, mode, fresh, ui);
      } catch (e) {
        resp = { ok: false, stage: 'summarize', code: 0, curated: 'Error', raw: String(e) };
      }
      stopPartial();

      btn.dataset.loading = '';
      btn.classList.remove('hn-sum-btn--loading');

      if (resp && resp.ok) {
        const data = { title: resp.title, summary: resp.summary, model: resp.model };
        writeCache(mode, url, data);
        expand(mode, data);
      } else {
        // collapse panel, mark the triggering button red, surface the error
        openMode = null;
        panelRow.style.display = 'none';
        setLabel('short');
        setLabel('long');
        const curated = (resp && resp.curated) || 'Error';
        const raw = (resp && resp.raw) || 'unknown error';
        console.error('[HN Summary]', raw);
        showError(mode, curated);
        // Also surface the raw error in an alert — visible on mobile where the
        // console isn't readily accessible (e.g. Orion iOS).
        alert(`[HN Summary] ${curated}\n\n${raw}`);
      }
    }

    function onClick(mode) {
      if (!configured) return; // no-op; tooltip already explains
      if (openMode === mode) {
        collapse(); // toggle contract
        return;
      }
      run(mode, false);
    }

    // build the two chips
    const group = document.createElement('span');
    group.className = 'hn-sum-group';
    group.appendChild(document.createTextNode(' | '));
    ['short', 'long'].forEach((mode, i) => {
      const btn = document.createElement('a');
      btn.className = 'hn-sum-btn';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.textContent = LABEL[mode][0];
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        onClick(mode);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(mode);
        }
      });
      buttons[mode] = btn;
      applyState(mode);
      if (i > 0) group.appendChild(document.createTextNode(' '));
      group.appendChild(btn);
    });
    subline.appendChild(group);

    return {
      refresh() {
        applyState('short');
        applyState('long');
      },
    };
  }

  // ---- "Connect OpenRouter": second half of the OAuth PKCE flow ----------
  // The popup (src/lib/oauth.js) saved `oauthPending` and opened OpenRouter.
  // OpenRouter sends the user back here with ?code=…&state=…. Anyone can post
  // an HN link with these parameters, so do nothing unless `state` is ours.
  const PENDING_MAX_AGE_MS = 15 * 60 * 1000;

  async function finishConnect() {
    let params;
    try {
      params = new URLSearchParams(location.search);
    } catch {
      return;
    }
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;

    let pending;
    try {
      ({ oauthPending: pending } = await chrome.storage.local.get('oauthPending'));
    } catch {
      return;
    }
    if (!pending || !pending.verifier || pending.state !== state) return;

    // One try only: a reload must not send the code again.
    await chrome.storage.local.remove('oauthPending');
    params.delete('code');
    params.delete('state');
    const rest = params.toString();
    history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);

    if (!(Date.now() - pending.createdAt < PENDING_MAX_AGE_MS)) {
      showBanner('error', 'The connection took too long. Open the extension and click Connect OpenRouter again.');
      return;
    }

    let res;
    let text = '';
    try {
      res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { ...APP_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: pending.verifier, code_challenge_method: 'S256' }),
      });
      text = await res.text();
    } catch (e) {
      console.error('[HN Summary] OpenRouter key exchange failed:', String(e));
      showBanner('error', 'Could not connect OpenRouter (network error). Try again, or paste a key in the extension settings.');
      return;
    }
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON */ }
    if (!res.ok || !body || typeof body.key !== 'string' || !body.key) {
      console.error(`[HN Summary] OpenRouter key exchange: HTTP ${res.status}: ${text.slice(0, 500)}`);
      showBanner('error', `Could not connect OpenRouter (HTTP ${res.status}). Try again, or paste a key in the extension settings.`);
      return;
    }

    const { model } = await chrome.storage.local.get('model');
    // The user asked for OpenRouter, so use it (the default engine is on-device).
    const patch = { engine: 'openrouter', openrouterKey: body.key, authMethod: 'oauth', connectedAt: Date.now() };
    if (!model) patch.model = DEFAULT_MODEL;
    await chrome.storage.local.set(patch);
    await loadSettings();
    controllers.forEach((c) => c.refresh());
    showBanner('ok', 'OpenRouter connected. Click (+) or (++) next to a story to summarize it.');
  }

  function showBanner(kind, text) {
    const old = document.querySelector('.hn-sum-banner');
    if (old) old.remove();
    const bar = document.createElement('div');
    bar.className = `hn-sum-banner hn-sum-banner--${kind}`;
    bar.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const msg = document.createElement('span');
    msg.textContent = `HN Summary: ${text}`;
    const close = document.createElement('a');
    close.className = 'hn-sum-banner-close';
    close.setAttribute('role', 'button');
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.preventDefault();
      bar.remove();
    });
    bar.append(msg, close);
    const main = document.getElementById('hnmain');
    if (main && main.parentNode) main.parentNode.insertBefore(bar, main);
    else document.body.prepend(bar);
  }

  // ---- injection ---------------------------------------------------------
  function injectAll() {
    document.querySelectorAll('tr.athing').forEach((row) => {
      if (row.dataset.hnSum) return;
      const subtextRow = row.nextElementSibling;
      if (!subtextRow) return;
      const subline =
        subtextRow.querySelector('td.subtext .subline') ||
        subtextRow.querySelector('td.subtext');
      if (!subline) return;
      const url = resolveUrl(row);
      if (!url) return;
      row.dataset.hnSum = '1';
      controllers.push(makeStory(subtextRow, subline, url));
    });
  }

  loadSettings()
    .then(injectAll)
    .then(finishConnect)
    .catch((e) => console.error('[HN Summary]', e));
})();
