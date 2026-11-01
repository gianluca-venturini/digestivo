import { chromium } from 'playwright';
import fs from 'node:fs';
const TAG = process.env.TAG || 'Know before you click';
const OUT = process.env.OUT || 'out';
const CSS = `*{margin:0;padding:0;box-sizing:border-box}
body{background:#ff6600;color:#fff;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;overflow:hidden}
.bg{position:absolute;inset:0;background:radial-gradient(circle at 90% 0%,#ff8a3d 0,#ff6600 55%,#f05800 100%)}
.wrap{position:absolute;inset:0;display:flex;align-items:center}
.icon{background:#fff;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 8px 24px rgba(90,30,0,.25)}
.icon svg{display:block}
h1{font-weight:800;letter-spacing:-.5px;line-height:1}
.tag{font-weight:600;opacity:.96}
.pills{display:flex}
.pill{background:#fff;color:#ff6600;font-family:Verdana,Geneva,sans-serif;font-weight:bold;display:flex;align-items:center;justify-content:center}`;
const plus = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 10 10"><rect x="4" y="1.5" width="2" height="7" rx=".5" fill="#ff6600"/><rect x="1.5" y="4" width="7" height="2" rx=".5" fill="#ff6600"/></svg>`;
const small = `<div class="bg"></div><div class="wrap" style="flex-direction:column;justify-content:center;gap:14px;text-align:center">
  <div style="display:flex;align-items:center;gap:14px"><div class="icon" style="width:62px;height:62px;border-radius:14px">${plus(42)}</div><h1 style="font-size:50px">HN Summary</h1></div>
  <div class="tag" style="font-size:26px">${TAG}</div>
  <div class="pills" style="gap:14px;margin-top:4px"><div class="pill" style="font-size:26px;height:48px;padding:0 22px;border-radius:24px">(+)</div><div class="pill" style="font-size:26px;height:48px;padding:0 22px;border-radius:24px">(++)</div></div></div>`;
const marquee = `<div class="bg"></div><div class="wrap" style="padding:0 110px;gap:64px">
  <div class="icon" style="width:220px;height:220px;border-radius:48px">${plus(150)}</div>
  <div style="display:flex;flex-direction:column;gap:22px"><h1 style="font-size:120px">HN Summary</h1><div class="tag" style="font-size:52px">${TAG}</div>
  <div class="pills" style="gap:24px;margin-top:8px"><div class="pill" style="font-size:44px;height:84px;padding:0 38px;border-radius:42px">(+)</div><div class="pill" style="font-size:44px;height:84px;padding:0 38px;border-radius:42px">(++)</div></div></div></div>`;
const b = await chromium.launch();
for (const [name, w, h, body] of [['promo-small-440x280.png', 440, 280, small], ['promo-marquee-1400x560.png', 1400, 560, marquee]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style>${body}`);
  await p.screenshot({ path: `${OUT}/${name}` });
  const pv = await b.newPage({ viewport: { width: w / 2, height: h / 2 } });
  await pv.setContent(`<body style="margin:0;background:#eee"><img style="width:${w / 2}px" src="data:image/png;base64,${fs.readFileSync(`${OUT}/${name}`).toString('base64')}">`);
  await pv.screenshot({ path: `${OUT}/preview-${name}` });
}
await b.close(); console.log('ok');
