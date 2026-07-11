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
        resp = await chrome.runtime.sendMessage({ type: 'summarize', url, mode, fresh });
      } catch (e) {
        resp = { ok: false, curated: 'Extension error — reload the page', raw: String(e) };
      }

      btn.dataset.loading = '';
      btn.classList.remove('hn-sum-btn--loading');

      if (resp && resp.ok) {
        const data = { title: resp.title, summary: resp.summary, model: resp.model };
        writeCache(mode, url, data);
        expand(mode, data);
      } else {
        // collapse panel, mark the triggering button red, log real error only
        openMode = null;
        panelRow.style.display = 'none';
        setLabel('short');
        setLabel('long');
        console.error('[HN Summary]', (resp && resp.raw) || 'unknown error');
        showError(mode, (resp && resp.curated) || 'Error');
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
