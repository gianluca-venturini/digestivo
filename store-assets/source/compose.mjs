// Builds the 1280x800 annotated store screenshots from raw captures.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.OUT || 'out';
fs.mkdirSync(OUT, { recursive: true });
const slides = JSON.parse(fs.readFileSync('slides.json', 'utf8'));
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1280px;height:800px;overflow:hidden;background:#ff6600;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;color:#fff;position:relative}
.bgfx{position:absolute;inset:0;background:radial-gradient(circle at 85% -10%,#ff8a3d 0,#ff6600 55%,#f25a00 100%)}
h1{font-size:52px;line-height:1.08;font-weight:800;letter-spacing:-.5px}
.sub{font-size:25px;line-height:1.3;font-weight:500;opacity:.95;margin-top:12px}
.win{position:absolute;background:#f6f6ef;border-radius:14px 14px 0 0;box-shadow:0 24px 60px rgba(80,25,0,.35);overflow:hidden}
.bar{height:40px;background:#ececec;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid #d9d9d9}
.dot{width:12px;height:12px;border-radius:50%}
.url{margin-left:14px;flex:1;height:26px;border-radius:13px;background:#fff;color:#555;font-size:14px;display:flex;align-items:center;padding:0 14px}
.tb{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center}
.tb img{width:18px;height:18px;border-radius:3px}
.tb.on{background:#ffd9bf;box-shadow:0 0 0 2px #ff6600}
.shot{display:block}
.ring{position:absolute;border:3px solid #1a1a1a;border-radius:10px}
.tag{position:absolute;background:#1a1a1a;color:#fff;font-size:22px;font-weight:700;padding:9px 16px;border-radius:10px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.num{display:inline-flex;width:34px;height:34px;border-radius:50%;background:#1a1a1a;color:#fff;font-size:20px;font-weight:800;align-items:center;justify-content:center;flex:none}
.badge{position:absolute;box-shadow:0 0 0 4px #fff,0 4px 12px rgba(0,0,0,.3)}
ul.pts{list-style:none;margin-top:34px;display:flex;flex-direction:column;gap:20px}
ul.pts li{display:flex;gap:14px;align-items:flex-start;font-size:24px;line-height:1.3;font-weight:600}
ul.pts li span.t{padding-top:2px}
.pop{position:absolute;background:#f6f6ef;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);overflow:hidden}
.dim{position:absolute;inset:40px 0 0 0;background:rgba(40,20,0,.28)}
svg{position:absolute;inset:0;overflow:visible}
`;

function browserBar(url, icon) {
  return `<div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><div class="url">🔒&nbsp; ${url}</div>${icon ? `<div class="tb on"><img src="${img('extcopy/icons/48.png')}"></div>` : ''}</div>`;
}

function hnSlide(s) {
  const m = J(`raw/${s.raw}.json`);
  const W = 1152, L = 64, T = s.top || 196;
  const k = W / m.clip.width; // css px -> slide px
  const bx = (b, pad = 4) => ({ x: L + b.x * k - pad, y: T + 40 + b.y * k - pad, w: b.w * k + pad * 2, h: b.h * k + pad * 2 });
  const sb = bx(m.short), lb = bx(m.long), pb = bx(m.panel, 0);
  const both = { x: sb.x, y: sb.y, w: lb.x + lb.w - sb.x, h: sb.h };
  const ann = (s.ann || []).map((a) => {
    if (a.ring === 'buttons') return `<div class="ring" style="left:${both.x}px;top:${both.y}px;width:${both.w}px;height:${both.h}px"></div>`;
    if (a.ring === 'panel') return `<div class="ring" style="left:${L + 24}px;top:${pb.y - 4}px;width:${W - 48}px;height:${pb.h + 8}px;border-style:dashed;border-color:#ff6600"></div>`;
    if (a.tag) {
      const anchor = a.at === 'buttons' ? both : pb;
      const x = a.x != null ? a.x : anchor.x + anchor.w + 24;
      const y = a.y != null ? a.y : anchor.y + (a.dy || 0);
      let line = '';
      if (a.to) { const t = a.to === 'buttons' ? both : pb; const tx = a.tox != null ? a.tox : t.x + t.w; const ty = a.toy != null ? a.toy : t.y + t.h / 2; line = `<svg width="1280" height="800"><path d="M${x + 8} ${y + 22} L${tx + 4} ${ty}" stroke="#1a1a1a" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="${tx + 4}" cy="${ty}" r="6" fill="#1a1a1a"/></svg>`; }
      if (a.line) line = `<svg width="1280" height="800"><path d="${a.line}" stroke="#1a1a1a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
      return `${line}<div class="tag" style="left:${x}px;top:${y}px">${a.tag}</div>`;
    }
    return '';
  }).join('');
  return `<div class="bgfx"></div>
  <div style="position:absolute;left:64px;top:44px;right:64px"><h1>${s.h1}</h1><div class="sub">${s.sub}</div></div>
  <div class="win" style="left:${L}px;top:${T}px;width:${W}px;height:${800 - T + 20}px">${browserBar('news.ycombinator.com', true)}<img class="shot" style="width:${W}px" src="${img(`raw/${s.raw}.png`)}"></div>
  ${ann}`;
}

function popupSlide(s) {
  const m = J(`raw/${s.raw}.json`);
  const k = s.scale || 1.45;
  const PW = m.w * k, PH = m.h * k;
  const WL = 640, WT = 70; // browser window
  const PL = 1280 - 40 - PW - 30, PT = WT + 46; // popup position under the toolbar icon
  const badges = (s.points || []).map((p, i) => {
    if (!p.el || !m[p.el]) return '';
    const b = m[p.el];
    const x = PL + (p.side === 'right' ? (b.x + b.w) * k + 8 : b.x * k - 46);
    const y = PT + b.y * k + (b.h * k) / 2 - 17;
    return `<span class="num badge" style="left:${x}px;top:${y}px">${i + 1}</span>`;
  }).join('');
  const pts = (s.points || []).map((p, i) => `<li><span class="num">${i + 1}</span><span class="t">${p.text}</span></li>`).join('');
  return `<div class="bgfx"></div>
  <div class="win" style="left:${WL}px;top:${WT}px;width:${1280 - WL + 20}px;height:${800 - WT + 20}px">${browserBar('news.ycombinator.com', true)}
    <img class="shot" style="width:900px;opacity:.9" src="${img('raw/hn-buttons.png')}"><div class="dim"></div></div>
  <div class="pop" style="left:${PL}px;top:${PT}px;width:${PW}px;height:${PH}px"><img style="width:${PW}px" src="${img(`raw/${s.raw}.png`)}"></div>
  ${badges}
  <div style="position:absolute;left:64px;top:${s.top || 96}px;width:${Math.min(540, PL - 64 - 60)}px"><h1 style="font-size:${s.h1size||50}px">${s.h1}</h1><div class="sub">${s.sub}</div><ul class="pts">${pts}</ul></div>`;
}

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
for (const s of slides) {
  const body = s.kind === 'hn' ? hnSlide(s) : popupSlide(s);
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${s.file}`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  // half-size preview to check legibility at store thumbnail size
  const pv = await b.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
  await pv.setContent(`<body style="margin:0"><img style="width:640px;height:400px" src="${img(`${OUT}/${s.file}`)}"></body>`);
  await pv.screenshot({ path: `${OUT}/preview-${s.file}` }); await pv.close();
  console.log('wrote', s.file);
}
await b.close();
