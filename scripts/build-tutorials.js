#!/usr/bin/env node
/* CEM tutorials builder.

   Usage:  node scripts/build-tutorials.js [sourceDir] [outputDir]
   Default: node scripts/build-tutorials.js tutorials _site/tutorials

   What it does
   1. Copies everything in tutorials/ to the output folder.
   2. Finds every top-level tutorial page (tutorials/*.html, except index.html).
   3. Reads each page's <title> (the part before " | ") and optional <meta> tags.
   4. Writes the tutorials hub page (index.html) with one button per tutorial.

   Never copied or listed: files or folders whose name starts with "_" or "." (use "_name.html" for a draft),
   and README files. No dependencies; plain Node.js. This file is used only by the web deploy workflow,
   it is not part of the Android app. */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(process.argv[2] || 'tutorials');
const OUT = path.resolve(process.argv[3] || path.join('_site', 'tutorials'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// File name -> URL path segment. A literal "&" is kept (valid in a URL path), so "signin&signup.html"
// is linked exactly as it is typed in the address bar.
const urlName = name => encodeURIComponent(name).replace(/%26/g, '&');

function pretty(file) {
  const s = file.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function metas(head) {
  const out = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const name = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (name && content) out[(name[1] ?? name[2]).toLowerCase()] = decode(content[1] ?? content[2]).trim();
  }
  return out;
}

function readInfo(file) {
  const html = fs.readFileSync(path.join(SRC, file), 'utf8');
  const end = html.search(/<\/head>/i);
  const head = end > 0 ? html.slice(0, end) : html;
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  let title = t ? decode(t[1]).replace(/\s+/g, ' ').trim().split(/\s+\|\s+/)[0].trim() : '';
  if (!title) {
    console.warn(`  ! ${file} has no <title>; using the file name`);
    title = pretty(file);
  }
  const m = metas(head);
  const order = parseFloat(m['tutorial-order']);
  return { file, title, desc: m.description || '', order: Number.isFinite(order) ? order : Infinity };
}

const card = (t, i) => `
<a class="card" href="${esc(urlName(t.file))}">
  <div class="thumb">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <svg class="art" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
      <rect x="122" y="16" width="76" height="160" rx="15" fill="#0b1020" stroke="#2a3358" stroke-width="2"/>
      <rect x="130" y="25" width="60" height="150" rx="9" fill="#f7f8fc"/>
      <rect x="137" y="34" width="22" height="5" rx="2.5" fill="#5948f5"/>
      <rect x="137" y="46" width="46" height="13" rx="4" fill="#fff" stroke="#e6e8f1"/>
      <rect x="137" y="66" width="46" height="13" rx="4" fill="#fff" stroke="#5948f5" stroke-width="1.5"/>
      <rect x="137" y="88" width="46" height="14" rx="4" fill="#5948f5"/>
      <circle class="rip" cx="165" cy="95" r="7" fill="rgba(255,181,71,.35)" stroke="#ffb547" stroke-width="2"/>
      <path class="cur" d="M0 0l7.5 19 2.6-7.9L18 8.5z" transform="translate(163 91)" fill="#fff" stroke="#10172b" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>
  </div>
  <div class="body">
    <span class="tag">Animated tutorial</span>
    <h2>${esc(t.title)}</h2>${t.desc ? `\n    <p>${esc(t.desc)}</p>` : ''}
    <span class="go">Watch tutorial <i aria-hidden="true">&rarr;</i></span>
  </div>
</a>`;

// ---------------------------------------------------------------------------------------------
if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  console.error(`Error: ${path.join(SRC, 'index.html')} (the hub template) is missing.`);
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(SRC, OUT, {
  recursive: true,
  filter: p => {
    if (p === SRC) return true;
    const n = path.basename(p);
    return !(n.startsWith('.') || n.startsWith('_') || /^readme(\.|$)/i.test(n));
  },
});

const pages = fs.readdirSync(SRC, { withFileTypes: true })
  .filter(e => e.isFile() && /\.html?$/i.test(e.name) && !/^index\.html?$/i.test(e.name) && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .map(e => readInfo(e.name))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));

const cards = pages.length
  ? pages.map(card).join('\n')
  : '\n<div class="empty"><b>No tutorials yet</b><span>New ones will show up here soon.</span></div>';
const count = `${pages.length} tutorial${pages.length === 1 ? '' : 's'}`;

let hub = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
for (const marker of ['<!--TUTORIAL_CARDS-->', '<!--TUTORIAL_COUNT-->']) {
  if (!hub.includes(marker)) {
    console.error(`Error: tutorials/index.html is missing the ${marker} placeholder.`);
    process.exit(1);
  }
}
hub = hub.replace('<!--TUTORIAL_CARDS-->', () => cards).replace('<!--TUTORIAL_COUNT-->', () => count);
fs.writeFileSync(path.join(OUT, 'index.html'), hub);

console.log(`Tutorials page built: ${count} -> ${path.relative(process.cwd(), OUT) || '.'}`);
pages.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2, '0')}  ${p.file}  ->  "${p.title}"`));
