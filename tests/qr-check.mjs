import vm from 'node:vm'; import fs from 'node:fs'; import assert from 'node:assert/strict';
const ctx = vm.createContext({ window: {}, self: {}, console }); ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync('/home/claude/cem/www/qrcode.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('/home/claude/cem/www/vendor/jsQR.js', 'utf8'), ctx);
const qrcode = vm.runInContext('typeof qrcode!=="undefined"?qrcode:window.qrcode', ctx);
const jsQR = vm.runInContext('typeof jsQR!=="undefined"?jsQR:(self.jsQR||window.jsQR)', ctx);
const payload = 'CEM1:ABCDEF:tkt1aaaaaaaa';
const q = qrcode(0, 'M'); q.addData(payload); q.make();
// same arithmetic as qrPng() in mailer.js
const n = q.getModuleCount(), px = Math.max(4, Math.floor(264 / (n + 8))), m = 4 * px, s = n * px + 2 * m;
const rgba = new Uint8ClampedArray(s * s * 4).fill(255);
for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (q.isDark(i, j))
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) { const o = ((m + i * px + y) * s + m + j * px + x) * 4; rgba[o] = rgba[o + 1] = rgba[o + 2] = 0; }
const r = jsQR(rgba, s, s);
assert.equal(r.data, payload);
console.log(`QR ${n}x${n} modules, ${s}x${s}px image decodes to: ${r.data}`);
// and a downscaled copy, like a phone screen showing the email at 60%
const k = 0.6, t = Math.round(s * k), small = new Uint8ClampedArray(t * t * 4);
for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) { const o = (y * t + x) * 4, p = (Math.floor(y / k) * s + Math.floor(x / k)) * 4; small[o] = rgba[p]; small[o + 1] = rgba[p + 1]; small[o + 2] = rgba[p + 2]; small[o + 3] = 255; }
assert.equal(jsQR(small, t, t).data, payload); console.log('still decodes when shown smaller (' + t + 'px)');
