// Tests the local-address checks in src/background.js: isPrivateHost() and
// the block-rule patterns. Run: node scripts/test-private-host.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const noop = () => {};
const chrome = {
  runtime: { id: 'x', onMessage: { addListener: noop }, onInstalled: { addListener: noop } },
  storage: { local: { remove: () => Promise.resolve(), setAccessLevel: () => Promise.resolve() } },
};
const ctx = { chrome, console, URL, TextDecoder, AbortController, setTimeout, clearTimeout, crypto: globalThis.crypto };
vm.createContext(ctx);
// `const` and `function` at the top level are not properties of the context. Export them.
vm.runInContext(
  readFileSync(new URL('../src/background.js', import.meta.url), 'utf8') +
    '\n;globalThis.__t = { isPrivateHost, LOCAL_BLOCK_PATTERNS };',
  ctx,
);
const { isPrivateHost, LOCAL_BLOCK_PATTERNS } = ctx.__t;
const regexes = LOCAL_BLOCK_PATTERNS.map((p) => new RegExp(p, 'i'));
const blockedByRules = (url) => regexes.some((r) => r.test(new URL(url).href));

const private_ = [
  'localhost', 'intranet', 'printer.local', 'a.internal', 'x.lan', 'router.home.arpa', 'localhost.',
  '0.0.0.0', '10.1.2.3', '127.0.0.1', '127.8.8.8', '100.64.0.1', '100.127.255.255', '169.254.169.254',
  '172.16.0.1', '172.31.255.255', '192.168.1.1', '198.18.0.1', '198.19.255.255', '224.0.0.1', '255.255.255.255',
  '[::]', '[::1]', '[fc00::1]', '[fd12:3456::1]', '[fe80::1]', '[ff02::1]',
  '[::7f00:1]', '[::a00:1]', '[::127.0.0.1]', '[::ffff:7f00:1]', '[::ffff:192.168.1.1]',
  '[64:ff9b::7f00:1]', '[64:ff9b::c0a8:101]', '[64:ff9b:1::1]', '[2002:7f00:1::1]',
];
const public_ = [
  'example.com', 'news.ycombinator.com', '8.8.8.8', '100.63.0.1', '100.128.0.1', '172.15.0.1', '172.32.0.1',
  '198.17.0.1', '198.20.0.1', '223.255.255.255', '1.1.1.1',
  '[2606:4700::1111]', '[2001:4860:4860::8888]', '[::ffff:8.8.8.8]', '[64:ff9b::808:808]', '[2002:808:808::1]',
];

let bad = 0;
const check = (name, got, want) => {
  if (got !== want) {
    bad++;
    console.error(`FAIL ${name}: got ${got}, want ${want}`);
  }
};
for (const h of private_) {
  check(`isPrivateHost(${h})`, isPrivateHost(new URL(`http://${h}/`).hostname), true);
  check(`rules block ${h}`, blockedByRules(`http://${h}/x?y=1`), true);
  check(`rules block ${h}:8080 with user`, blockedByRules(`https://user:pw@${h}:8080/`), true);
}
for (const h of public_) {
  check(`isPrivateHost(${h})`, isPrivateHost(new URL(`http://${h}/`).hostname), false);
}
// The rules are coarser for IPv6 (they refuse all non-global addresses). Only check IPv4 and names.
for (const h of public_.filter((x) => !x.startsWith('['))) {
  check(`rules allow ${h}`, blockedByRules(`https://${h}/path`), false);
}
check('rules allow a path that looks local', blockedByRules('https://example.com/127.0.0.1/localhost'), false);
check('rules allow an @ in the path', blockedByRules('https://example.com/a@10.0.0.1/'), false);
check('rules allow IPv6 global', blockedByRules('https://[2606:4700::1111]/'), false);

if (bad) {
  console.error(`${bad} failed`);
  process.exit(1);
}
console.log(`ok: ${private_.length} local and ${public_.length} public hosts`);
