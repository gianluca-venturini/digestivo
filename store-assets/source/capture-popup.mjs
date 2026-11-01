import { chromium } from 'playwright';
import fs from 'node:fs';
const ext = process.cwd() + '/extcopy';
const hnHtml = fs.readFileSync('hn.html', 'utf8');
const sums = JSON.parse(fs.readFileSync('summaries.json', 'utf8'));
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  viewport: { width: 900, height: 760 }, deviceScaleFactor: 3,
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
await new Promise(r => setTimeout(r, 1000));
for (const pg of ctx.pages()) if (pg.url().includes('welcome')) await pg.close();
await ctx.route('https://news.ycombinator.com/', r => r.fulfill({ body: hnHtml, contentType: 'text/html; charset=utf-8' }));
const setStore = (obj) => sw.evaluate(async (o) => { await chrome.storage.local.clear(); await chrome.storage.local.set(o); }, obj);

// ---------- HN page ----------
{
await setStore({ engine: 'openrouter', openrouterKey: 'sk-or-demo', model: 'anthropic/claude-sonnet-5.5' });
const p = await ctx.newPage();
await p.goto('https://news.ycombinator.com/');
await p.evaluate((s) => { for (const [u, d] of Object.entries(s)) localStorage.setItem(`hnsum:${d.mode}:${u}`, JSON.stringify({ title: d.title, summary: d.summary, model: d.model })); }, sums);
await p.reload();
await p.waitForSelector('.hn-sum-btn');
await p.screenshot({ path: 'raw/hn-buttons.png' });
}
// ---------- popup ----------
const pop = await ctx.newPage();
await pop.setViewportSize({ width: 320, height: 600 });
async function shotPopup(name, store, nano, after) {
  await setStore(store);
  await pop.goto(`chrome-extension://${id}/src/popup.html?nano=${nano||''}`);
  
  await pop.waitForTimeout(1500);
  if (after) await after(pop);
  const wrap = await pop.$('.wrap');
  await wrap.screenshot({ path: `raw/${name}.png` });
  const wb = await wrap.boundingBox();
  const sel = { nano: 'label.choice:has(input[value=nano])', or: 'label.choice:has(input[value=openrouter])', nanoStatus: '#nanoStatus', connect: '#connect', key: '#openrouterKey', model: '#model', modelHint: '#modelHint', connected: '#connected', save: '#save', note: '.note:not([hidden])' };
  const out = { w: wb.width, h: wb.height };
  for (const [k, q] of Object.entries(sel)) { const e = await pop.$(q); const b = e && await e.boundingBox(); if (b) out[k] = { x: b.x - wb.x, y: b.y - wb.y, w: b.width, h: b.height }; }
  fs.writeFileSync(`raw/${name}.json`, JSON.stringify(out));
}
await shotPopup('popup-nano-ready', { engine: 'nano' }, 'available');
await shotPopup('popup-nano-download', { engine: 'nano' }, 'downloadable');
await shotPopup('popup-or-connect', { engine: 'openrouter' });
await shotPopup('popup-or-key', { engine: 'openrouter', openrouterKey: 'sk-or-v1-0000000000000000000000000000000000000000', authMethod: 'manual', model: 'anthropic/claude-sonnet-5.5' });
await shotPopup('popup-or-connected', { engine: 'openrouter', openrouterKey: 'sk-or-v1-x', authMethod: 'oauth', connectedAt: Date.parse('2026-11-01T12:00:00Z'), model: 'anthropic/claude-sonnet-5.5' });
await ctx.close();
console.log('done');
