// Tests www/updater.js (the in-app update window) with a fake GitHub API and a fake native plugin.
// Run: npm install --no-save jsdom && node tests/test-updater.mjs
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../www/updater.js', import.meta.url), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, what, ms = 3000) {
  const t = Date.now();
  while (Date.now() - t < ms) { try { if (await fn()) return; } catch (e) {} await wait(10); }
  throw new Error('timed out waiting for: ' + what);
}

// ---- fakes ----
const asset = (name, size = 4_000_000, extra = {}) => ({ name, size, state: 'uploaded', browser_download_url: `https://github.com/real-debabrata/cem/releases/download/v/${name}`, ...extra });
const release = (tag, o = {}) => ({ tag_name: tag, draft: !!o.draft, prerelease: !!o.prerelease, body: o.body ?? '- Faster loading\n- Bug fixes',
  assets: o.assets ?? [asset(`campus-events-${tag}.apk`, o.size ?? 4_000_000, o.digest ? { digest: o.digest } : {})] });

function fakePlugin(o = {}) {
  const p = {
    calls: [], canInstall: o.canInstall ?? false, installed: o.installed ?? '3.14.0',
    s: { state: 'idle', downloaded: 0, total: 0, version: '', error: '', ...(o.status || {}) },
    snap() { return { ...p.s, canInstall: p.canInstall }; },
    async info() { p.calls.push('info'); return { versionName: p.installed, versionCode: 100, packageName: 'com.campus.events', canInstall: p.canInstall }; },
    async status() {
      p.calls.push('status');
      if (p.s.state === 'downloading') { p.s.downloaded = Math.min(p.s.total, p.s.downloaded + p.s.total / 4); if (p.s.downloaded >= p.s.total && !p.hold) p.s.state = 'ready'; }
      return p.snap();
    },
    async start(a) {
      p.calls.push('start'); p.lastStart = a;
      if (o.startReady) p.s = { state: 'ready', downloaded: a.size, total: a.size, version: a.version, error: '' };
      else if (o.failDownload) p.s = { state: 'error', downloaded: 0, total: a.size, version: a.version, error: o.failDownload };
      else p.s = { state: 'downloading', downloaded: 0, total: a.size, version: a.version, error: '' };
      return p.snap();
    },
    async cancel() { p.calls.push('cancel'); p.s = { state: 'idle', downloaded: 0, total: 0, version: '', error: '' }; return p.snap(); },
    async install() {
      p.calls.push('install');
      if (o.installError) throw new Error(o.installError);
      return p.canInstall ? { started: true, needsPermission: false } : { started: false, needsPermission: true };
    },
  };
  return p;
}

function boot({ native = true, plugin = fakePlugin(), releases = [release('v3.99.0')], fetchImpl, hasPlugin = true } = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { url: 'https://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window; const errors = []; w.addEventListener('error', e => errors.push(e.message));
  const fetches = []; const opened = [];
  w.fetch = fetchImpl || (async url => { fetches.push(url); return { ok: true, status: 200, json: async () => releases }; });
  if (fetchImpl) { const f = fetchImpl; w.fetch = async (...a) => { fetches.push(a[0]); return f(...a); }; }
  w.open = (...a) => { opened.push(a); return null; };
  const realSI = w.setInterval.bind(w); w.setInterval = (fn) => realSI(fn, 15);   // poll fast in tests
  w.Capacitor = { isNativePlatform: () => native, Plugins: hasPlugin ? { ApkUpdater: plugin } : {} };
  w.eval(SRC);
  const $ = s => w.document.querySelector(s);
  return { w, $, plugin, fetches, opened, errors, text: () => ($('#uv') ? $('#uv').textContent.replace(/\s+/g, ' ') : ''), click: a => $(`[data-up="${a}"]`).click(),
           visible: () => { w.document.dispatchEvent(new w.Event('visibilitychange')); } };
}

let n = 0; const ok = m => console.log('PASS ' + (++n) + ' ' + m);

// 1 ─ full happy path: newer release -> auto download -> ready -> Update -> permission -> installer
{
  const t = boot({ releases: [release('v3.99.0', { digest: 'sha256:' + 'ab'.repeat(32), body: '- New Events tab\n- **Faster** sync' })] });
  assert.equal(t.w.CEMUpdater.available(), true);
  t.w.CEMUpdater.open({ fallbackUrl: 'https://downloadcem.deba.indevs.in' });
  await until(() => /Downloading v3\.99\.0/.test(t.text()), 'download view');
  // JSON round-trip: the object lives in jsdom's realm, so compare plain data
  assert.deepEqual(JSON.parse(JSON.stringify(t.plugin.lastStart)), { url: 'https://github.com/real-debabrata/cem/releases/download/v/campus-events-v3.99.0.apk', version: '3.99.0', size: 4_000_000, sha256: 'ab'.repeat(32) });
  assert.match(t.text(), /New Events tab/); assert.match(t.$('#uv .uv-notes b').textContent, /Faster/);
  await until(() => /Update ready/.test(t.text()), 'ready view');
  assert.match(t.text(), /Installed: v3\.14\.0 · Latest: v3\.99\.0/);
  t.click('install');
  await until(() => /One-time permission/.test(t.text()), 'permission view');
  assert.equal(t.plugin.calls.filter(c => c === 'install').length, 1);
  t.plugin.canInstall = true; t.visible();                       // person allowed it in Settings and came back
  await until(() => /Confirm the update/.test(t.text()), 'installer view');
  assert.equal(t.plugin.calls.filter(c => c === 'install').length, 2);
  t.visible(); await until(() => /Update ready/.test(t.text()), 'ready again after installer dismissed');
  ok('happy path: fetch -> auto-download -> Update -> one-time permission -> installer -> back to Update if dismissed');
  assert.deepEqual(t.errors, []);
}

// 2 ─ release selection
{
  const t = boot({ releases: [release('v3.20.0', { prerelease: true }), release('v3.18.0', { assets: [{ name: 'notes.txt', state: 'uploaded', browser_download_url: 'https://x/notes.txt' }] }),
    release('v3.17.0', { draft: true }), release('v3.15.0'), release('v3.16.0'), release('v3.16.1', { assets: [asset('campus-events-v3.16.1.apk', 10, {}) , ].map(a => ({ ...a, state: 'open' })) })] });
  t.w.CEMUpdater.open(); await until(() => t.plugin.lastStart, 'start');
  assert.equal(t.plugin.lastStart.version, '3.16.0');
  ok('picks the highest published release that has a finished APK (skips prerelease, draft, no-APK, half-uploaded)');
}

// 3,4 ─ up to date / newer installed
for (const tag of ['v3.14.0', 'v3.10.0']) {
  const t = boot({ releases: [release(tag)] }); t.w.CEMUpdater.open();
  await until(() => /You are up to date/.test(t.text()), 'up to date');
  assert.ok(!t.plugin.calls.includes('start')); assert.match(t.text(), /v3\.14\.0/);
}
ok('same or older release on GitHub -> "You are up to date", nothing downloaded');

// 5 ─ offline then retry
{
  let offline = true;
  const t = boot({ fetchImpl: async () => { if (offline) throw new TypeError('Failed to fetch'); return { ok: true, status: 200, json: async () => [release('v3.99.0')] }; } });
  t.w.CEMUpdater.open(); await until(() => /No internet connection/.test(t.text()), 'offline message');
  offline = false; t.click('retry'); await until(() => /Downloading v3\.99\.0/.test(t.text()), 'retry works');
  ok('offline -> friendly error; Try again succeeds once online');
}

// 6 ─ GitHub rate limit
{
  const t = boot({ fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }) });
  t.w.CEMUpdater.open(); await until(() => /limiting requests/.test(t.text()), 'rate limit message');
  assert.ok(t.$('[data-up="web"]')); t.click('web'); assert.equal(t.opened.length, 1);
  ok('GitHub 403 rate limit -> clear message + "Open download page" fallback works');
}

// 7 ─ offline, but an update was already downloaded earlier
{
  const t = boot({ fetchImpl: async () => { throw new TypeError('x'); }, plugin: fakePlugin({ status: { state: 'ready', version: '3.99.0', total: 5, downloaded: 5 } }) });
  t.w.CEMUpdater.open(); await until(() => /Update ready/.test(t.text()), 'ready while offline');
  ok('no internet but file already downloaded -> still offers Update');
}

// 8 ─ resume a running download (no second start)
{
  const p = fakePlugin({ status: { state: 'downloading', version: '3.99.0', total: 4_000_000, downloaded: 1_000_000 } });
  const t = boot({ plugin: p }); t.w.CEMUpdater.open();
  await until(() => /Downloading v3\.99\.0/.test(t.text()), 'resumed view');
  assert.ok(!p.calls.includes('start')); await until(() => /Update ready/.test(t.text()), 'finishes');
  ok('reopening during a download resumes the progress view without restarting it');
}

// 9 ─ intact file already on the phone
{
  const t = boot({ plugin: fakePlugin({ startReady: true }) }); t.w.CEMUpdater.open();
  await until(() => /Update ready/.test(t.text()), 'ready'); ok('intact earlier download is reused (instant "Update ready")');
}

// 10 ─ cancel, then download again
{
  const p = fakePlugin(); p.hold = true;
  const t = boot({ plugin: p }); t.w.CEMUpdater.open(); await until(() => /Downloading/.test(t.text()), 'downloading');
  t.click('cancel'); await until(() => /Update available/.test(t.text()), 'idle view'); await wait(80);
  assert.equal(p.calls.filter(c => c === 'start').length, 1, 'cancel must not restart the download'); assert.ok(p.calls.includes('cancel'));
  p.hold = false; t.click('download'); await until(() => p.calls.filter(c => c === 'start').length === 2, 'second start');
  ok('Cancel stops the download and stays stopped; "Download now" starts again');
}

// 11 ─ APK without the native plugin
{
  const t = boot({ hasPlugin: false }); assert.equal(t.w.CEMUpdater.available(), false);
  t.w.CEMUpdater.open({ fallbackUrl: 'https://downloadcem.deba.indevs.in' }); await until(() => /Update by download once/.test(t.text()), 'legacy view');
  t.click('web'); assert.equal(t.opened[0][0], 'https://downloadcem.deba.indevs.in'); assert.equal(t.fetches.length, 0);
  ok('old APK without the native updater -> one-time "download once" help, links to the download page');
}

// 12 ─ website
{
  const t = boot({ native: false }); t.w.CEMUpdater.open();
  await wait(50); assert.equal(t.$('#uv'), null); assert.equal(t.fetches.length, 0); assert.equal(t.w.CEMUpdater.available(), false);
  ok('website: nothing opens, nothing is fetched');
}

// 13 ─ hostile release notes
{
  const t = boot({ releases: [release('v3.99.0', { body: '<img src=x onerror="window.__pwn=1"><script>window.__pwn=1</script>\n- <b onmouseover=1>x</b> **ok**' })] });
  t.w.CEMUpdater.open(); await until(() => /Downloading/.test(t.text()), 'view');
  assert.equal(t.$('#uv .uv-notes img'), null); assert.equal(t.$('#uv .uv-notes script'), null); assert.equal(t.$('#uv .uv-notes b[onmouseover]'), null);
  assert.equal(t.w.__pwn, undefined); assert.match(t.$('#uv .uv-notes').textContent, /<img src=x/);
  ok('release notes are escaped (no HTML/script injection)');
}

// 14 ─ native download failure, then retry
{
  const t = boot({ plugin: fakePlugin({ failDownload: 'The downloaded file is damaged (checksum mismatch). Please try again.' }) });
  t.w.CEMUpdater.open(); await until(() => /checksum mismatch/.test(t.text()), 'native error shown');
  t.click('retry'); await until(() => t.plugin.calls.filter(c => c === 'start').length === 2, 'retry starts again');
  ok('native download error is shown; Try again restarts');
}

// 15 ─ installer refuses (e.g. wrong signing key)
{
  const t = boot({ plugin: fakePlugin({ startReady: true, installError: 'This update is signed with a different key than the installed app.' }) });
  t.w.CEMUpdater.open(); await until(() => /Update ready/.test(t.text()), 'ready'); t.click('install');
  await until(() => /different key/.test(t.text()), 'install error shown'); ok('install error (e.g. different signing key) is shown clearly');
}

// 16 ─ caching (protects the 60-requests/hour GitHub limit on shared college Wi-Fi)
{
  const t = boot({ releases: [release('v3.14.0')] });
  t.w.CEMUpdater.open(); await until(() => /up to date/.test(t.text()), 'first'); t.click('close');
  t.w.CEMUpdater.open(); await until(() => /up to date/.test(t.text()), 'second'); assert.equal(t.fetches.length, 1, 'second open must use the cache');
  t.click('recheck'); await until(() => t.fetches.length === 2, '"Check again" bypasses the cache'); ok('5-minute cache; "Check again" forces a fresh request');
}

// 17 ─ closing
{
  const t = boot(); t.w.CEMUpdater.open(); await until(() => t.text().length > 0, 'open');
  t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape' })); assert.ok(t.$('#uv').classList.contains('hid'));
  t.w.CEMUpdater.open(); assert.ok(!t.$('#uv').classList.contains('hid')); t.$('#uv').click(); assert.ok(t.$('#uv').classList.contains('hid'));
  ok('Escape and tapping the backdrop close the window; it reopens');
}

console.log('\nALL ' + n + ' PASSED');
process.exit(0);
