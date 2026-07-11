import { getSettings, setSettings } from './lib/settings.js';
import { listModels } from './lib/openrouter.js';

const $ = (id) => document.getElementById(id);

async function init() {
  const s = await getSettings();
  $('jinaKey').value = s.jinaKey || '';
  $('openrouterKey').value = s.openrouterKey || '';
  $('model').value = s.model || '';
  populateModels();
}

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
    jinaKey: $('jinaKey').value.trim(),
    openrouterKey: $('openrouterKey').value.trim(),
    model: $('model').value.trim(),
  });
  const st = $('status');
  st.textContent = 'Saved ✓';
  st.className = 'status ok';
  setTimeout(() => {
    st.textContent = '';
    st.className = 'status';
  }, 1500);
});

init();
