// Loads the REAL app (www/index.html + every script) and checks how the in-app update is wired into the profile menu.
// Run: npm install --no-save jsdom && node tests/test-update-menu.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const www = fileURLToPath(new URL('../www/', import.meta.url));
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, what, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch (e) {} await wait(15); } throw new Error('timed out waiting for: ' + what); }

async function boot({ native, firestoreLatest }) {
  const plugin = { calls: [], s: { state: 'idle', downloaded: 0, total: 0, version: '', error: '' },
    async info() { return { versionName: '3.14.0', versionCode: 1, packageName: 'com.campus.events', canInstall: true }; },
    async status() { this.calls.push('status'); return { ...this.s, canInstall: true }; },
    async start(a) { this.calls.push('start'); this.s = { state: 'downloading', downloaded: 1, total: a.size, version: a.version, error: '' }; return { ...this.s, canInstall: true }; },
    async cancel() { this.calls.push('cancel'); return { state: 'idle', canInstall: true }; }, async install() { return { started: true }; } };
  const opened = []; const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = await JSDOM.fromFile(www + 'index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, set fillStyle(v) {} });
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      const mem = new Map();
      if (firestoreLatest) mem.set('campus-ver', JSON.stringify({ t: Date.now(), latest: firestoreLatest, notes: 'Big update' }));   // what the Firestore check would have stored
      Object.defineProperty(w, 'localStorage', { value: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() } });
      w.scrollTo = () => {};
      w.open = (...a) => { opened.push(a); return null; };
      w.fetch = async url => { if (String(url).includes('api.github.com')) return { ok: true, status: 200, json: async () => [{ tag_name: 'v9.9.9', draft: false, prerelease: false, body: '- Shiny', assets: [{ name: 'campus-events-v9.9.9.apk', size: 5_000_000, state: 'uploaded', browser_download_url: 'https://github.com/real-debabrata/cem/releases/download/v9.9.9/campus-events-v9.9.9.apk' }] }] }; throw new TypeError('no network in test'); };
      if (native) w.Capacitor = { isNativePlatform: () => true, Plugins: { ApkUpdater: plugin } };
    } });
  const w = dom.window;
  await new Promise(r => w.addEventListener('load', r)); await wait(400);
  return { w, plugin, opened, $: s => w.document.querySelector(s), menuItems: () => [...w.document.querySelectorAll('#um button')].map(b => b.textContent.trim().replace(/\s+/g, ' ')) };
}
let n = 0; const ok = m => console.log('PASS ' + (++n) + ' ' + m);

// website: no update entry at all
{
  const t = await boot({ native: false });
  assert.equal(typeof t.w.CEMUpdater, 'object'); assert.equal(t.w.CEMUpdater.available(), false);
  t.$('#av').click(); assert.ok(t.menuItems().length > 3, 'menu opened');
  assert.ok(!t.menuItems().some(x => /Update app/.test(x)), 'no Update app on the website');
  assert.ok(t.menuItems().some(x => /About & updates/.test(x)));
  ok('website: profile menu has no "Update app" entry (About & updates unchanged)');
}

// Android app: entry exists, opens the in-app updater, which fetches + downloads
{
  const t = await boot({ native: true });
  t.$('#av').click();
  const items = t.menuItems(); assert.ok(items.includes('Update app'), 'items: ' + items.join(' | '));
  assert.ok(items.indexOf('Update app') < items.findIndex(x => /About & updates/.test(x)), 'sits just above About & updates');
  t.$('#um [data-u="appupd"]').click();
  assert.ok(t.$('#um').classList.contains('hid'), 'menu closes');
  await until(() => /Downloading v9\.9\.9/.test(t.$('#uv') ? t.$('#uv').textContent : ''), 'in-app updater shows the download');
  assert.ok(t.plugin.calls.includes('start')); assert.equal(t.opened.length, 0, 'must NOT open the browser');
  ok('Android app: profile menu > "Update app" opens the in-app updater and starts the download (browser not used)');
}

// Android app with a newer version known from Firestore: badge + old banner/About buttons go through the same flow
{
  const t = await boot({ native: true, firestoreLatest: '9.9.9' });
  t.$('#av').click(); assert.ok(t.menuItems().includes('Update app New'), t.menuItems().join(' | '));
  t.$('#av').click();   // close menu again
  const banner = t.$('#ub'); assert.ok(banner && !banner.classList.contains('hid'), 'update banner visible');
  banner.querySelector('[data-u="upd"]').click();
  await until(() => /Downloading v9\.9\.9/.test(t.$('#uv') ? t.$('#uv').textContent : ''), 'banner Update opens in-app updater');
  assert.equal(t.opened.length, 0);
  ok('"New" badge shows; the banner\'s Update button uses the in-app updater instead of the browser');
}
console.log('\nALL ' + n + ' PASSED'); process.exit(0);
