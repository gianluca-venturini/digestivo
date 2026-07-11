// Injects + / ++ summary buttons into each Hacker News story, manages the
// per-button state machine, renders the inline summary panel, caches results
// in localStorage, and surfaces errors on the button that produced them.
(() => {
  'use strict';

  // [collapsed label, expanded label] per mode
  const LABEL = { short: ['(+)', '(-)'], long: ['(++)', '(--)'] };
  const TITLE = { short: 'Short summary', long: 'Long summary' };
  const DISABLED_TITLE =
    'Add your Jina and OpenRouter API keys and pick a model in the extension settings to enable summaries.';

  let settings = {};
  let configured = false;
  const controllers = []; // one per story, for live enable/disable

  // ---- settings ----------------------------------------------------------
  async function loadSettings() {
    settings = await chrome.storage.local.get(['jinaKey', 'openrouterKey', 'model']);
    configured = Boolean(settings.jinaKey && settings.openrouterKey && settings.model);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.jinaKey || changes.openrouterKey || changes.model) {
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

  // ---- summarization (runs in the content script) ------------------------
  // Both Jina and OpenRouter are CORS-enabled, so we fetch directly here.
  // (A background service worker isn't reliable across browsers — notably
  // Orion iOS doesn't run the MV3 worker — so we don't depend on one.)
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
    if (name === 'NetworkError' || code === 0) return 'Network error — check your connection';
    if (stage === 'fetch') {
      if (code === 401) return 'Jina key rejected — check it in settings';
      if (code === 429) return 'Jina rate limit — try again shortly';
      return "Couldn't fetch the page";
    }
    if (name === 'EmptyContent') return 'Model returned no summary — try another model';
    if (code === 401) return 'OpenRouter key rejected — check it in settings';
    if (code === 402) return 'Out of OpenRouter credits';
    if (code === 429) return 'Rate limited — try again shortly';
    if (code === 502 || code === 503) return 'Model unavailable — try another model';
    return 'API error';
  }

  async function fetchReadable(url, fresh) {
    const headers = {
      Accept: 'application/json',
      'X-Return-Format': 'markdown',
      'X-Retain-Images': 'none',
      'X-Timeout': '20',
    };
    if (settings.jinaKey) headers.Authorization = `Bearer ${settings.jinaKey}`;
    if (fresh) headers['X-No-Cache'] = 'true';

    let res;
    try {
      res = await fetch('https://r.jina.ai/' + url, { method: 'GET', headers });
    } catch (e) {
      throw { stage: 'fetch', code: 0, name: 'NetworkError', raw: String(e) };
    }
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON error page */ }
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

  async function summarizeText(mode, title, content) {
    const article = content.length > MAX_CHARS ? content.slice(0, MAX_CHARS) : content;
    let res;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://news.ycombinator.com/',
          'X-Title': 'HN Summary',
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

  async function doSummarize(url, mode, fresh) {
    if (!configured) {
      return { ok: false, stage: 'fetch', code: 0, curated: 'Add your API keys in settings', raw: 'not configured' };
    }
    try {
      const { title, content } = await fetchReadable(url, fresh);
      const summary = await summarizeText(mode, title, content);
      return { ok: true, title, summary, model: settings.model };
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
      if (!configured) {
        btn.title = DISABLED_TITLE;
      } else if (!btn.classList.contains('hn-sum-btn--error')) {
        btn.title = TITLE[mode];
      }
    }

    function clearError(mode) {
      buttons[mode].classList.remove('hn-sum-btn--error');
      buttons[mode].title = TITLE[mode];
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

    function renderLoading() {
      cell.textContent = '';
      const s = document.createElement('span');
      s.className = 'hn-sum-loading';
      s.textContent = 'summarizing…';
      cell.appendChild(s);
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

      let resp;
      try {
        resp = await doSummarize(url, mode, fresh);
      } catch (e) {
        resp = { ok: false, stage: 'summarize', code: 0, curated: 'Error', raw: String(e) };
      }

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

  loadSettings().then(injectAll);
})();
