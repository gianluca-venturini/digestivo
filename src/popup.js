import { getSettings, setSettings, resolveEngine } from './lib/settings.js';
import { listModels } from './lib/openrouter.js';
import { startConnect } from './lib/oauth.js';

const $ = (id) => document.getElementById(id);

// Same base options as NANO_BASE in content.js. Chrome checks the language
// options in availability() and create().
const NANO_BASE = {
  format: 'markdown',
  expectedInputLanguages: ['en', 'es', 'ja', 'de', 'fr'],
  outputLanguage: 'en',
};

const welcome = new URLSearchParams(location.search).has('welcome');
let modelsLoaded = false;
let stored = {};

async function init() {
  if (welcome) {
    document.body.classList.add('tab');
    $('welcome').hidden = false;
  }
  const s = await getSettings();
  stored = s;
  // Versions before 0.2.0 stored a Jina key. Delete it.
  chrome.storage.local.remove('jinaKey').catch(() => {});
  $('openrouterKey').value = s.openrouterKey || '';
  $('model').value = s.model || '';
  showConnection();
  const engine = resolveEngine(s);
  document.querySelector(`input[name="engine"][value="${engine}"]`).checked = true;
  showEngine(engine);
}

function showEngine(engine) {
  const nano = engine === 'nano';
  $('nanoFields').hidden = !nano;
  $('openrouterFields').hidden = nano;
  $('noteNano').hidden = !nano;
  $('noteOpenrouter').hidden = nano;
  if (nano) {
    showNanoStatus();
  } else if (!modelsLoaded) {
    // Load the model list only in OpenRouter mode: Nano mode makes no network call.
    modelsLoaded = true;
    populateModels();
  }
}

document.querySelectorAll('input[name="engine"]').forEach((radio) => {
  radio.addEventListener('change', async () => {
    if (!radio.checked) return;
    await setSettings({ engine: radio.value });
    showEngine(radio.value);
    flash($('engineSaved'));
  });
});

// ---- on-device model -------------------------------------------------------
async function nanoAvailability() {
  if (!('Summarizer' in self)) return 'unavailable';
  try {
    return await Summarizer.availability(NANO_BASE);
  } catch (e) {
    console.warn('[HN Summary] Summarizer.availability failed', e);
    return 'unavailable';
  }
}

function setNanoStatus(text, kind) {
  const el = $('nanoStatus');
  el.textContent = text;
  el.className = `nano-status${kind ? ` ${kind}` : ''}`;
}

async function showNanoStatus() {
  const state = await nanoAvailability();
  const row = $('nanoDownloadRow');
  if (state === 'available') {
    row.hidden = true;
    setNanoStatus('Ready on this device.', 'ok');
    if (welcome) {
      $('welcomeNext').innerHTML =
        'Everything is ready. Open <a href="https://news.ycombinator.com/" target="_blank" rel="noopener">Hacker News</a> and click <b>(+)</b> next to a story.';
    }
  } else if (state === 'downloadable' || state === 'downloading') {
    row.hidden = false;
    setNanoStatus(
      state === 'downloading'
        ? 'Chrome is downloading the on-device model. Click Download now to see the progress.'
        : 'Needs a one-time download of the on-device model.',
    );
  } else {
    row.hidden = true;
    setNanoStatus(
      'Not available in this browser or on this device. It needs Chrome 138 or newer on Windows, macOS, ' +
        'Linux, or a Chromebook Plus, 22 GB of free disk space, and a GPU with more than 4 GB of memory ' +
        '(or 16 GB of RAM). Select OpenRouter to get summaries.',
      'bad',
    );
    if (welcome) {
      $('welcomeNext').textContent = 'This browser cannot make summaries on the device. Select OpenRouter below and add a key.';
    }
  }
}

$('nanoDownload').addEventListener('click', async () => {
  const btn = $('nanoDownload');
  const bar = $('nanoProgress');
  btn.disabled = true;
  bar.hidden = false;
  setNanoStatus('Starting the download…');
  try {
    // create() starts the download. It needs this click (a user gesture).
    // Chrome continues the download if this page closes.
    const summarizer = await Summarizer.create({
      ...NANO_BASE,
      type: 'tldr',
      length: 'medium',
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          bar.value = e.loaded;
          setNanoStatus(
            e.loaded < 1 ? `Downloading the on-device model… ${Math.floor(e.loaded * 100)}%` : 'Loading the model…',
          );
        });
      },
    });
    summarizer.destroy();
    bar.hidden = true;
    btn.disabled = false;
    showNanoStatus();
  } catch (e) {
    console.error('[HN Summary] Summarizer.create failed', e);
    bar.hidden = true;
    btn.disabled = false;
    setNanoStatus(`The download failed: ${(e && e.message) || e}`, 'bad');
  }
});

// ---- OpenRouter --------------------------------------------------------------
async function populateModels() {
  try {
    const models = await listModels();
    const dl = $('models');
    dl.textContent = '';
    models
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.label = m.name || m.id;
        dl.appendChild(opt);
      });
    $('modelHint').textContent = `${models.length} models — type to search, or paste any slug`;
  } catch (e) {
    console.error('[HN Summary] model list failed', e);
    $('modelHint').textContent = 'Could not load model list — type a slug manually';
  }
}

// A key from "Connect OpenRouter" shows as "Connected". A pasted key shows in
// the key field, with the Connect button above it.
function showConnection() {
  const oauth = stored.authMethod === 'oauth' && Boolean(stored.openrouterKey);
  $('connected').hidden = !oauth;
  $('notConnected').hidden = oauth;
  $('connectedAt').textContent = oauth && stored.connectedAt
    ? ` (${new Date(stored.connectedAt).toLocaleDateString()})`
    : '';
}

$('connect').addEventListener('click', async () => {
  try {
    const url = await startConnect();
    if (chrome.tabs && chrome.tabs.create) {
      await chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
    // Close the popup. Keep the welcome page (a normal tab) open.
    if (!welcome) window.close();
  } catch (e) {
    console.error('[HN Summary] connect failed', e);
    $('connectStatus').textContent = `Could not open OpenRouter: ${(e && e.message) || e}. Paste a key below.`;
  }
});

$('disconnect').addEventListener('click', async () => {
  await chrome.storage.local.remove(['openrouterKey', 'authMethod', 'connectedAt']);
  stored = await getSettings();
  $('openrouterKey').value = '';
  showConnection();
  const status = $('connectStatus');
  status.textContent = 'Disconnected. To delete the key, go to ';
  const a = document.createElement('a');
  a.href = 'https://openrouter.ai/settings/keys';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'openrouter.ai/settings/keys';
  status.append(a, '.');
});

// The welcome page stays open while the user connects in another tab. Show
// changes from other tabs, so that Save does not write old values.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (!(changes.engine || changes.openrouterKey || changes.model || changes.authMethod || changes.connectedAt)) return;
  stored = await getSettings();
  if (changes.openrouterKey) $('openrouterKey').value = stored.openrouterKey || '';
  if (changes.model) $('model').value = stored.model || '';
  showConnection();
  if (changes.engine) {
    const engine = resolveEngine(stored);
    const radio = document.querySelector(`input[name="engine"][value="${engine}"]`);
    if (!radio.checked) {
      radio.checked = true;
      showEngine(engine);
    }
  }
});

$('save').addEventListener('click', async () => {
  const patch = { model: $('model').value.trim() };
  // When connected, the key field is hidden. Do not write the key then.
  if (!$('notConnected').hidden) {
    const key = $('openrouterKey').value.trim();
    patch.openrouterKey = key;
    // A key typed by hand replaces a connected key.
    if (key !== stored.openrouterKey) {
      patch.authMethod = key ? 'manual' : '';
      patch.connectedAt = 0;
    }
  }
  await setSettings(patch);
  stored = await getSettings();
  showConnection();
  flash($('status'));
});

function flash(el) {
  el.textContent = 'Saved ✓';
  el.className = 'status ok';
  setTimeout(() => {
    el.textContent = '';
    el.className = 'status';
  }, 1500);
}

init();
