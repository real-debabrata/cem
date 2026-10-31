// Tests www/themebars.js (theme colour behind the status bar / camera / navigation bar) with a fake native plugin.
// Run: npm install --no-save jsdom && node tests/test-themebars.mjs
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../www/themebars.js', import.meta.url), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

function boot({ app = true, withPlugin = true, html = '', bg = '#f6f7fb', dark = false, reject = false } = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, calls = [];
  w.document.documentElement.style.setProperty('--bg', bg);
  w.matchMedia = () => ({ matches: dark, addEventListener() {}, removeEventListener() {} });
  if (app) w.Capacitor = { isNativePlatform: () => true, Plugins: withPlugin ? { ThemeBars: { set: async a => { calls.push(a.color); if (reject) throw new Error('x'); return a; } } } : {} };
  w.eval(SRC);
  return { w, calls };
}

// 1) colour parsing
{
  const { w } = boot({ app: false });
  const h = w.CEMThemeBars.toHex;
  assert.equal(h('#abc'), '#aabbcc');
  assert.equal(h('#F6F7FB'), '#f6f7fb');
  assert.equal(h(' #10172B '), '#10172b');
  assert.equal(h('rgb(246, 247, 251)'), '#f6f7fb');
  assert.equal(h('rgba(16,23,43,1)'), '#10172b');
  assert.equal(h('rgb(16 23 43 / 50%)'), '#10172b');
  assert.equal(h('rgba(0,0,0,0)'), '', 'fully transparent is not a colour');
  assert.equal(h('color(srgb 1 1 1)'), '#ffffff');
  assert.equal(h(''), ''); assert.equal(h('red'), ''); assert.equal(h(null), '');
  console.log('ok  colour parsing');
}

// 2) website / no plugin: nothing is sent, nothing breaks
{
  const a = boot({ app: false }); await wait(50); assert.equal(a.calls.length, 0);
  const b = boot({ app: true, withPlugin: false }); await wait(50); assert.equal(b.calls.length, 0);
  console.log('ok  website and missing plugin do nothing');
}

// 3) app, no loading screen: sends the page colour
{
  const { calls } = boot({ bg: '#f6f7fb' }); await wait(30);
  assert.deepEqual(calls, ['#f6f7fb']);
  const d = boot({ bg: '#10172b' }); await wait(30);
  assert.deepEqual(d.calls, ['#10172b']);
  console.log('ok  page colour sent');
}

// 4) loading screen: navy first, page colour in the middle of the fade
{
  const { w, calls } = boot({ html: '<div id="splash"></div>', bg: '#f6f7fb' }); await wait(30);
  assert.deepEqual(calls, ['#10172b'], 'navy while the loading screen shows');
  w.document.getElementById('splash').classList.add('out'); await wait(400);
  assert.deepEqual(calls, ['#10172b', '#f6f7fb']);
  console.log('ok  loading screen then page colour');
}

// 5) theme change from the Profile menu is followed; same colour is not re-sent
{
  const { w, calls } = boot({ bg: '#f6f7fb' }); await wait(30);
  w.document.documentElement.style.setProperty('--bg', '#10172b');
  w.document.documentElement.setAttribute('data-theme', 'dark'); await wait(60);
  assert.deepEqual(calls, ['#f6f7fb', '#10172b']);
  w.document.documentElement.setAttribute('data-theme', 'dark'); w.document.documentElement.className = 'x'; await wait(60);
  assert.deepEqual(calls, ['#f6f7fb', '#10172b'], 'no duplicate');
  console.log('ok  theme change followed');
}

// 6) falls back to the body colour when --bg is missing; navy when nothing is known
{
  const dom = new JSDOM('<!DOCTYPE html><body style="background:rgb(14,20,38)"></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const calls = []; const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.Capacitor = { isNativePlatform: () => true, Plugins: { ThemeBars: { set: async a => { calls.push(a.color); } } } };
  w.eval(SRC); await wait(30);
  assert.deepEqual(calls, ['#0e1426']);
  const e = boot({ bg: '' }); await wait(30);   // --bg empty, body has no colour
  assert.deepEqual(e.calls, ['#10172b']);
  console.log('ok  fallbacks');
}

// 7) a failing native call never throws, and is retried on the next change
{
  const { w, calls } = boot({ reject: true }); await wait(30);
  assert.ok(calls.length >= 1, 'tried at least once');
  const n = calls.length;
  w.document.documentElement.setAttribute('data-theme', 'light'); await wait(60);
  assert.ok(calls.length > n, 'retried after a failure');
  console.log('ok  native failure is harmless');
}
console.log('\nall theme-bar tests passed');
