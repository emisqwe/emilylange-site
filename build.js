// Builds the site into _site/. No dependencies: run with `node build.js`.
// Content lives in content/ (edited through Pages CMS), images in src/images/.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const SITE_URL = 'https://www.emilylange.com';

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const site = readJSON('content/site.json');
const imageSources = fs.existsSync(path.join(ROOT, 'image-sources.json')) ? readJSON('image-sources.json') : {};

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s = '') => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

// Use the local copy of an image when it exists; otherwise fall back to where it came from.
function imgSrc(p) {
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  const local = path.join(ROOT, 'src', p.replace(/^\/+/, ''));
  if (fs.existsSync(local)) return p;
  return imageSources[p] || p;
}

// ---------- tiny markdown ----------
function inline(t) {
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(esc(c)) - 1}\u0000`);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src) => {
    // Videos use the same syntax as images: ![description](/images/project/clip.mp4)
    if (/\.(mp4|webm|mov)$/i.test(src)) {
      const poster = src.replace(/\.(mp4|webm|mov)$/i, '-poster.jpg');
      const hasPoster = fs.existsSync(path.join(ROOT, 'src', poster.replace(/^\/+/, '')));
      return `<video src="${esc(src)}"${hasPoster ? ` poster="${esc(poster)}"` : ''} autoplay muted loop playsinline preload="metadata" aria-label="${esc(alt)}"></video>`;
    }
    return `<img src="${esc(imgSrc(src))}" alt="${esc(alt)}" loading="lazy">`;
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, txt, href) => {
    const ext = /^https?:/.test(href) && !href.startsWith(SITE_URL);
    return `<a href="${esc(href)}"${ext ? ' rel="noopener"' : ''}>${txt}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  t = t.replace(/( {2,}|\\)\n/g, '<br>\n');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

function markdown(src = '') {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { blocks.push({ t: 'h', level: m[1].length, text: m[2].replace(/\s*#+\s*$/, '') }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: 'hr' }); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', text: buf.join('\n') }); continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const lm = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (lm) items.push(lm[2]); else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
        if (i < lines.length && !lines[i].trim() && i + 1 < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i + 1])) i++;
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items }); continue;
    }
    if (/^\s*</.test(line)) { // raw HTML block
      const buf = [];
      while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
      blocks.push({ t: 'html', text: buf.join('\n') }); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) buf.push(lines[i++]);
    const text = buf.join('\n');
    const imgOnly = buf.every((l) => /^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(l));
    blocks.push(imgOnly ? { t: 'fig', imgs: buf } : { t: 'p', text });
  }

  let html = '';
  for (let b = 0; b < blocks.length; b++) {
    const k = blocks[b];
    if (k.t === 'h') { const lv = Math.max(2, k.level); html += `<h${lv} id="${slugify(k.text.replace(/<[^>]+>/g, ''))}">${inline(k.text)}</h${lv}>\n`; }
    else if (k.t === 'hr') html += inkLine('ink-hr') + '\n';
    else if (k.t === 'quote') html += `<blockquote>${markdown(k.text)}</blockquote>\n`;
    else if (k.t === 'ul' || k.t === 'ol') html += `<${k.t}>${k.items.map((it) => `<li>${inline(it)}</li>`).join('')}</${k.t}>\n`;
    else if (k.t === 'html') html += k.text + '\n';
    else if (k.t === 'fig') {
      // An italic paragraph straight after an image becomes its caption.
      let cap = '';
      const next = blocks[b + 1];
      if (next && next.t === 'p' && /^\s*([*_])[^*_][\s\S]*\1\s*$/.test(next.text)) { cap = next.text.trim().slice(1, -1); b++; }
      const cls = k.imgs.length > 1 ? ` class="pair cols-${Math.min(k.imgs.length, 3)}"` : '';
      html += `<figure${cls}>${k.imgs.map((l) => inline(l.trim())).join('')}${cap ? `<figcaption>${inline(cap)}</figcaption>` : ''}</figure>\n`;
    } else html += `<p>${inline(k.text)}</p>\n`;
  }
  return html;
}

// ---------- projects ----------
const projDir = path.join(ROOT, 'content/projects');
const projects = fs.readdirSync(projDir).filter((f) => f.endsWith('.json'))
  .map((f) => {
    const p = JSON.parse(fs.readFileSync(path.join(projDir, f), 'utf8'));
    p.slug = slugify(p.slug || p.title || f.replace(/\.json$/, ''));
    p.url = `/work/${p.slug}/`;
    return p;
  })
  .filter((p) => p.published !== false)
  .map((p) => ({ ...p, self: /self/i.test(p.section || ''), hasPage: p.has_page !== false,
    soon: p.coming_soon ? String(p.coming_soon_text || '').trim() || 'Just wrapped this one. Hold on tight, the full story is coming soon.' : '' }))
  .sort((a, b) => (a.self - b.self) || (Number(a.order) || 999) - (Number(b.order) || 999) || String(a.title).localeCompare(b.title));

// Projects with their own case study page, in home-page order (used for Previous / Next).
const pages = projects.filter((p) => p.hasPage);
const ext = (url) => /^https?:/.test(url || '');

// ---------- templates ----------
const emailLink = (email) => {
  const enc = (s) => [...s].map((c) => `&#${c.charCodeAt(0)};`).join('');
  return `<a href="${enc('mailto:' + email)}">${enc(email)}</a>`;
};

// Hand-drawn ink line: a gently wandering path, slightly different every time it's used.
let lineSeed = 0;
function rng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function inkLine(cls = '') {
  // A filled ribbon rather than a stroke: the center drifts very slightly and the thickness swells and thins,
  // like a pen line, with softly tapered ends.
  const r = rng(++lineSeed * 7919);
  const wave = (f) => { const a = r() * 6.28, b = r() * 6.28; return (x) => Math.sin(x * f + a) * 0.6 + Math.sin(x * f * 2.3 + b) * 0.4; };
  const drift = wave(0.004 + r() * 0.003), swell = wave(0.006 + r() * 0.004);
  const top = [], bot = [];
  for (let x = 0; x <= 1200; x += 10) {
    const taper = Math.min(1, x / 40, (1200 - x) / 40);
    const c = 6 + drift(x) * 1.1;
    const w = (1.5 + swell(x) * 0.45) * (0.45 + 0.55 * taper);
    top.push(`${x} ${(c - w / 2).toFixed(2)}`);
    bot.push(`${x} ${(c + w / 2).toFixed(2)}`);
  }
  const d = 'M' + top.join(' L') + ' L' + bot.reverse().join(' L') + 'Z';
  return `<svg class="ink ${cls}" aria-hidden="true" viewBox="0 0 1200 12" preserveAspectRatio="none"><path d="${d}"/></svg>`;
}

function layout({ title, description, body, url = '/', image, bodyClass = '' }) {
  const full = title ? `${esc(title)} · ${esc(site.name)}` : esc(site.name);
  const ogImg = image ? imgSrc(image) : '';
  const ogAbs = ogImg && !/^https?:/.test(ogImg) ? SITE_URL + ogImg : ogImg;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${full}</title>
<meta name="description" content="${esc(description || site.description)}">
<link rel="canonical" href="${SITE_URL}${url}">
<meta property="og:title" content="${full}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:url" content="${SITE_URL}${url}">
<meta property="og:type" content="website">
${ogAbs ? `<meta property="og:image" content="${esc(ogAbs)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,300&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
<meta name="color-scheme" content="light dark">
<script>try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body id="top" class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="wordmark" href="/">${esc(site.name)}</a>
    <nav aria-label="Main">
      <a href="/#work">Work</a>
      <a href="/#about">About</a>
      ${site.resume_url ? `<a href="${esc(site.resume_url)}" target="_blank" rel="noopener">Resume</a>` : ''}
      <button class="theme-toggle" type="button" aria-label="Switch to dark mode">
        <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>
        <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>
      </button>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  ${contactSection()}
  <div class="wrap foot-bar">
    <p class="copy">© ${new Date().getFullYear()} ${esc(site.name)}</p>
    <ul class="foot-links">${footLinks()}</ul>
  </div>
</footer>
<script src="/assets/site.js" defer></script>
<a class="top-btn" href="#top" aria-label="Scroll back to top" data-tip="Scroll back to top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg></a>
</body>
</html>
`;
}

function footLinks() {
  return [
    site.email ? `<li>${emailLink(site.email)}</li>` : '',
    site.linkedin ? `<li><a href="${esc(site.linkedin)}" rel="noopener">LinkedIn</a></li>` : '',
    site.resume_url ? `<li><a href="${esc(site.resume_url)}" target="_blank" rel="noopener">Resume</a></li>` : '',
  ].join('');
}

function contactSection() {
  const key = String(site.form_key || '').trim();

  return `<section id="contact" class="contact wrap" aria-labelledby="contact-h">
    <h2 id="contact-h" class="section-h">${esc(site.contact_heading || 'Let’s connect')}</h2>
    <div class="contact-cols">
      <div class="contact-body">
        <div class="contact-text">
          ${markdown(site.contact_intro || '')}
        </div>
        <form id="contact-form" class="contact-form" action="https://api.web3forms.com/submit" method="POST" data-ready="${key ? 'yes' : 'no'}" novalidate>
          <input type="hidden" name="access_key" value="${esc(key)}">
          <input type="hidden" name="subject" value="New message from emilylange.com">
          <input type="hidden" name="from_name" value="emilylange.com">
          <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="field-row">
            <div class="field"><label for="cf-name">Name</label><input id="cf-name" name="name" type="text" autocomplete="name" required></div>
            <div class="field"><label for="cf-email">Email</label><input id="cf-email" name="email" type="email" autocomplete="email" required></div>
          </div>
          <div class="field"><label for="cf-topic">What’s up?</label>
            <select id="cf-topic" name="topic">
              <option>A design project</option>
              <option>Free website audit</option>
              <option>Just saying hi</option>
            </select></div>
          <div class="field" data-for="Free website audit"><label for="cf-site">Your website <span class="opt">(for audits)</span></label><input id="cf-site" name="website" type="url" inputmode="url" placeholder="https://"></div>
          <div class="field"><label for="cf-message">Message</label><textarea id="cf-message" name="message" rows="3" required></textarea></div>
          <button class="btn btn-solid" type="submit">${esc(site.form_button || 'Send message')}</button>
          <p class="form-status" role="status" aria-live="polite"></p>
        </form>
        ${site.audit_text ? `<div class="audit">
          <h3>${esc(site.audit_heading || 'Free website audit')}</h3>
          ${markdown(site.audit_text)}
          <p><a class="audit-link" href="#contact-form" data-topic="Free website audit">Request a free audit <span aria-hidden="true">→</span></a></p>
        </div>` : ''}
      </div>
    </div>
  </section>`;
}

function homePage() {
  const cardList = (list) => list.map((p) => {
    const href = p.hasPage ? p.url : p.live_url;
    const out = ext(href) ? ' rel="noopener"' : '';
    const img = p.cover ? `<img src="${esc(imgSrc(p.cover))}" alt="" loading="lazy">` : `<span aria-hidden="true">${esc(p.title)}</span>`;
    return `
    <li class="work-item">
      <div class="work-text">
        ${href ? `<a class="work-title" href="${esc(href)}"${out}>${esc(p.title)}</a>` : `<span class="work-title">${esc(p.title)}</span>`}
        ${p.summary ? `<p class="work-sum">${esc(p.summary)}</p>` : ''}
        ${p.soon ? `<p class="soon"><span class="soon-dot" aria-hidden="true"></span>${esc(p.soon)}</p>` : ''}
        ${p.live_url ? `<a class="work-live" href="${esc(p.live_url)}" rel="noopener">${esc(p.live_label || 'Visit site')}</a>` : ''}
      </div>
      ${href ? `<a class="thumb${p.cover ? '' : ' thumb-empty'}" href="${esc(href)}"${out} tabindex="-1" aria-hidden="true">${img}</a>` : `<span class="thumb${p.cover ? '' : ' thumb-empty'}">${img}</span>`}
    </li>`; }).join('');
  const selfList = projects.filter((p) => p.self);
  const body = `
<section class="hero wrap">
  <div class="hero-cols">
    <h1 class="hello">${esc(site.headline).replace(/product designer/i, (m) => m.replace(' ', '\u00a0'))}</h1>
    <div class="hero-text">${markdown(site.intro)}${site.intro_aside ? markdown(site.intro_aside) : ''}</div>
  </div>
</section>
<section id="work" class="work wrap" aria-labelledby="work-h">
  <h2 id="work-h" class="section-h">${esc(site.work_heading || 'Work')}</h2>
  <ul class="work-grid">${cardList(projects.filter((p) => !p.self))}
  </ul>
</section>
${selfList.length ? `<section id="self-launched" class="work side wrap" aria-labelledby="self-h">
  <h2 id="self-h" class="section-h">${esc(site.self_heading || 'Self-launched')}</h2>
  <ul class="work-grid">${cardList(selfList)}
  </ul>
</section>` : ''}
<section id="about" class="about wrap" aria-labelledby="about-h">
  <h2 id="about-h" class="section-h">${esc(site.about_heading || 'About')}</h2>
  ${site.about_photo ? `<img class="about-photo" src="${esc(imgSrc(site.about_photo))}" alt="${esc(site.about_photo_alt || '')}" loading="lazy">` : ''}
  <div class="about-text">
    ${markdown(site.about)}
    ${site.clients || (site.education || []).length ? `<dl class="facts">
      ${site.clients ? `<div><dt>${esc(site.clients_heading || 'Worked with')}</dt><dd>${esc(site.clients)}</dd></div>` : ''}
      ${(site.education || []).filter((e) => e && e.name).length ? `<div><dt>${esc(site.education_heading || 'Education')}</dt><dd>${site.education.filter((e) => e && e.name).map((e) =>
        `<span class="fact-line"><span class="fact-name">${e.link ? `<a href="${esc(e.link)}" rel="noopener">${esc(e.name)}</a>` : esc(e.name)}</span>${e.detail ? `, ${esc(e.detail)}` : ''}.</span>`).join('')}</dd></div>` : ''}
    </dl>` : ''}
  </div>
</section>`;
  return layout({ body, url: '/', image: projects[0] && projects[0].cover, bodyClass: 'home' });
}

function projectPage(p, i) {
  // Prev / next skip pages that are still "coming soon", and wrap around at the ends.
  const ready = pages.filter((q) => !q.soon || q === p);
  const k = ready.indexOf(p);
  const prev = ready[(k - 1 + ready.length) % ready.length], next = ready[(k + 1) % ready.length];
  const meta = (p.soon ? [] : [p.role, p.duration]).map((v) => String(v || '').trim()).filter(Boolean);
  const links = (p.links || []).filter((l) => l && l.url);
  if (p.live_url && !links.some((l) => l.url === p.live_url)) links.unshift({ label: p.live_label || 'Visit site', url: p.live_url });
  const body = `
<article class="case wrap">
  <header class="case-head">
    <h1>${esc(p.title)}</h1>
    ${meta.length ? `<p class="case-meta">${meta.map(esc).join('<br>')}</p>` : ''}
  </header>
  ${p.cover ? `<figure class="cover"><img src="${esc(imgSrc(p.cover))}" alt="${esc(p.cover_alt || '')}"></figure>` : ''}
  ${p.soon ? `<div class="lede"><p class="soon soon-lg"><span class="soon-dot" aria-hidden="true"></span>${esc(p.soon)}</p></div>` : p.intro ? `<div class="lede">${markdown(p.intro)}</div>` : ''}
  ${links.length ? `<p class="case-links">${links.map((l) => `<a class="btn" href="${esc(l.url)}" rel="noopener">${esc(l.label || l.url)}</a>`).join(' ')}</p>` : ''}
  ${p.soon ? '' : `<div class="prose">
    ${markdown(p.body)}
  </div>`}
  <nav class="work-nav" aria-label="More work">
    <a href="/">Back home</a>
    <span class="work-nav-pn"><a href="${prev.url}" title="Previous: ${esc(prev.title)}" rel="prev">prev</a> <span aria-hidden="true">/</span> <a href="${next.url}" title="Next: ${esc(next.title)}" rel="next">next</a></span>
  </nav>
</article>`;
  return layout({ title: p.title, description: p.summary, body, url: p.url, image: p.cover, bodyClass: 'case-page' });
}

function notFound() {
  return layout({ title: 'Page not found', url: '/404.html', bodyClass: 'nf', body: `
<section class="wrap nf-body">
  <h1>That page isn’t here.</h1>
  <p>It may have moved when this site was rebuilt. <a href="/#work">See all work</a> or go to the <a href="/">home page</a>.</p>
</section>` });
}

// ---------- write ----------
// Links that leave the site (other websites, the App Store, the resume PDF) open in a new tab.
function externalLinksInNewTab(html) {
  return html.replace(/<a\b([^>]*?)\shref="(https?:\/\/[^"]+)"([^>]*)>/gi, (m, before, href, after) => {
    if (/^https?:\/\/(www\.)?emilylange\.com(\/|$)/i.test(href)) return m;
    let attrs = before + after;
    if (!/\starget=/i.test(attrs)) attrs += ' target="_blank"';
    if (/\srel="/i.test(attrs)) {
      attrs = attrs.replace(/\srel="([^"]*)"/i, (r, v) => ` rel="${/noopener/.test(v) ? v : (v + ' noopener').trim()}"`);
    } else attrs += ' rel="noopener"';
    return `<a href="${href}"${attrs}>`;
  });
}
function write(rel, content) {
  if (rel.endsWith('.html')) content = externalLinksInNewTab(content);
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

fs.rmSync(OUT, { recursive: true, force: true });
write('index.html', homePage());
pages.forEach((p, i) => write(`work/${p.slug}/index.html`, projectPage(p, i)));
write('404.html', notFound());
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
copyDir(path.join(ROOT, 'src/images'), path.join(OUT, 'images'));

// Old Squarespace links keep working.
write('_redirects', [
  '/home / 301',
  '/work-1 /#work 301',
  '/work-1/mindful-digits /work/monsternums/ 301',
  '/work/mindful-digits/ /work/monsternums/ 301',
  '/work/mindful-digits /work/monsternums/ 301',
  '/work-1/* /work/:splat 301',
  '/work /#work 301',
].join('\n') + '\n');

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
${pages.map((p) => `<url><loc>${SITE_URL}${p.url}</loc></url>`).join('\n')}
</urlset>
`);
fs.copyFileSync(path.join(ROOT, 'assets/favicon.ico'), path.join(OUT, 'favicon.ico'));
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ${projects.length} projects into _site/`);
