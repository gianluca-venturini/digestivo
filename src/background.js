// Fetches the HTML of the article the user asked to summarize.
//
// Runs as a service worker in Chrome and as a background script in Orion,
// Firefox, and Safari (manifest declares both keys; see plans/2026-10-31-drop-jina.md).
// It must stay a classic script: no `import`, no `"type": "module"`.
//
// Only the fetch happens here. The content script parses the HTML, because a
// service worker has no DOMParser. Short jobs also avoid Orion iOS bug #8179.
'use strict';

const MAX_BYTES = 3 * 1024 * 1024; // read at most 3 MB of a page
const TIMEOUT_MS = 20000;
const ACCEPT = 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'hnsum:fetch') return;
  if (sender.id !== chrome.runtime.id || !sender.tab) return;
  if (sender.url && !isHnUrl(sender.url)) return;

  const work = fetchPage(msg.url, Boolean(msg.fresh));

  // Reply method B: send the result as a new message to the tab. The content
  // script asks for this only when the normal reply (method A) did not arrive.
  if (msg.reply === 'tab') {
    work.then((result) => {
      const options = typeof sender.frameId === 'number' ? { frameId: sender.frameId } : undefined;
      chrome.tabs.sendMessage(sender.tab.id, { type: 'hnsum:fetch-result', reqId: msg.reqId, result }, options);
    });
    return;
  }

  // Reply method A: the normal async reply. `return true` keeps the channel
  // open in all browsers (a returned Promise works only from Chrome 146).
  work.then(sendResponse);
  return true;
});

function isHnUrl(url) {
  try {
    return new URL(url).hostname === 'news.ycombinator.com';
  } catch {
    return false;
  }
}

// Anyone can post an HN link to a local address. The user's browser would
// fetch it and the text would go to OpenRouter, so refuse these hosts.
// Limit: a public name that resolves to a private address is not detected.
function isPrivateHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') && !h.includes(':')) return true; // localhost, intranet names
  if (/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(h)) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (h.includes(':')) {
    return h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  }
  return false;
}

function fail(name, status, raw) {
  return { ok: false, name, status: status || 0, raw: raw || name };
}

async function fetchPage(url, fresh) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return fail('BadUrl', 0, `Not a URL: ${String(url).slice(0, 200)}`);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return fail('BadUrl', 0, `Unsupported scheme: ${target.protocol}`);
  }
  if (isPrivateHost(target.hostname)) {
    return fail('Blocked', 0, `Refused local address: ${target.hostname}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.href, {
      method: 'GET',
      credentials: 'omit', // no cookies: no logged-in content, nothing personal sent
      cache: fresh ? 'no-store' : 'default',
      redirect: 'follow',
      headers: { Accept: ACCEPT },
      signal: controller.signal,
    });

    const finalUrl = res.url || target.href;
    try {
      if (isPrivateHost(new URL(finalUrl).hostname)) {
        return fail('Blocked', 0, `Redirect to local address refused: ${finalUrl}`);
      }
    } catch {
      /* keep target.href */
    }
    if (!res.ok) {
      return fail('Http', res.status, `HTTP ${[res.status, res.statusText].filter(Boolean).join(' ')} for ${finalUrl}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      return fail('NotHtml', res.status, `Content-Type ${contentType} for ${finalUrl}`);
    }

    const { bytes, truncated } = await readCapped(res, MAX_BYTES);
    const html = decode(bytes, pickCharset(contentType, bytes));
    return { ok: true, finalUrl, contentType: contentType || 'text/html', html, truncated };
  } catch (e) {
    if (e && e.name === 'AbortError') return fail('Timeout', 0, `No response after ${TIMEOUT_MS / 1000} s: ${target.href}`);
    return fail('Network', 0, String(e));
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res, max) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    const all = new Uint8Array(await res.arrayBuffer());
    return { bytes: all.subarray(0, max), truncated: all.length > max };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= max) {
      truncated = size > max;
      reader.cancel().catch(() => {});
      break;
    }
  }
  const out = new Uint8Array(Math.min(size, max));
  let offset = 0;
  for (const chunk of chunks) {
    const n = Math.min(chunk.length, out.length - offset);
    out.set(chunk.subarray(0, n), offset);
    offset += n;
    if (offset >= out.length) break;
  }
  return { bytes: out, truncated };
}

// res.text() always uses UTF-8 when the header has no charset. Many older
// pages declare their charset only in <meta>, so look there too.
function pickCharset(contentType, bytes) {
  const fromHeader = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType);
  if (fromHeader) return fromHeader[1];
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, 4096));
  const fromMeta = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head);
  return fromMeta ? fromMeta[1] : 'utf-8';
}

function decode(bytes, label) {
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
