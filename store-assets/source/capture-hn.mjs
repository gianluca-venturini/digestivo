import { chromium } from 'playwright';
import fs from 'node:fs';
const ext = process.cwd() + '/extcopy';
const hnHtml = fs.readFileSync('hn.html', 'utf8');
const sums = JSON.parse(fs.readFileSync('summaries.json', 'utf8'));
const W = +process.env.W || 780;
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  viewport: { width: W, height: 900 }, deviceScaleFactor: 3,
});
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
await new Promise(r => setTimeout(r, 800));
await ctx.route('https://news.ycombinator.com/', r => r.fulfill({ body: hnHtml, contentType: 'text/html; charset=utf-8' }));
await sw.evaluate(async () => { await chrome.storage.local.clear(); await chrome.storage.local.set({ engine: 'openrouter', openrouterKey: 'sk-or-demo', model: 'anthropic/claude-sonnet-5.5' }); });
const p = await ctx.newPage();
await p.goto('https://news.ycombinator.com/');
await p.evaluate((s) => { for (const [u, d] of Object.entries(s)) localStorage.setItem(`hnsum:${d.mode}:${u}`, JSON.stringify({ title: d.title, summary: d.summary, model: d.model })); }, sums);
await p.reload(); await p.waitForSelector('.hn-sum-btn');
const rowOf = (u) => p.$(`tr.athing:has(.titleline > a[href="${u}"])`);
async function btns(u) { const r = await rowOf(u); return (await r.evaluateHandle(x => x.nextElementSibling)).asElement().$$('.hn-sum-btn'); }
async function box(h) { const b = await h.boundingBox(); const sy = await p.evaluate(() => scrollY); return { x: b.x, y: b.y + sy, w: b.width, h: b.height }; }
async function shot(name, u, mode, before, after) {
  const [s, l] = await btns(u);
  await (mode === 'short' ? s : l).click();
  await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.waitForTimeout(300);
  const row = await rowOf(u);
  const ids = await p.$$eval('tr.athing', rs => rs.map(r => r.id));
  const myId = await row.evaluate(r => r.id); const i = ids.indexOf(myId);
  const top = await box(await p.$(`tr.athing[id="${ids[Math.max(0, i - Math.max(0, before))]}"]`));
  const lastRow = await p.$(`tr.athing[id="${ids[i + after]}"]`);
  const bot = await box(await lastRow.evaluateHandle(r => r.nextElementSibling));
  const [s2, l2] = await btns(u);
  const panel = await row.evaluateHandle(r => r.nextElementSibling.nextElementSibling);
  // HN table edge
  const tbl = await box(await p.$('#hnmain'));
  const y0 = before < 0 ? tbl.y : top.y - 3; const clip = { x: tbl.x, y: y0, width: tbl.w, height: bot.y + bot.h + 6 - y0 };
  const rel = (b) => ({ x: b.x - clip.x, y: b.y - clip.y, w: b.w, h: b.h });
  const meta = { clip, short: rel(await box(s2)), long: rel(await box(l2)), panel: rel(await box(panel)), title: rel(await box(await row.$('.titleline'))) };
  await p.screenshot({ path: `raw/${name}.png`, clip, fullPage: true });
  fs.writeFileSync(`raw/${name}.json`, JSON.stringify(meta, null, 1));
  await (mode === 'short' ? s2 : l2).click(); // collapse again
  await p.mouse.move(2, 2);
}
const [u1, u2] = Object.keys(sums);
await shot('slide-short', u1, 'short', -1, 1);
await shot('slide-long', u2, 'long', 2, 2);
await ctx.close(); console.log('ok');
