import { getSettings, setSettings, resolveEngine } from './lib/settings.js';
import { listModels } from './lib/openrouter.js';

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

async function init() {
  if (welcome) {
    document.body.classList.add('tab');
    $('welcome').hidden = false;
  }
  const s = await getSettings();
  // Versions before 0.2.0 stored a Jina key. Delete it.
  chrome.storage.local.remove('jinaKey').catch(() => {});
  $('openrouterKey').value = s.openrouterKey || '';
  $('model').value = s.model || '';
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

$('save').addEventListener('click', async () => {
  await setSettings({
    openrouterKey: $('openrouterKey').value.trim(),
    model: $('model').value.trim(),
  });
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
