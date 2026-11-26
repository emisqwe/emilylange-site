// ---------- dark / light mode toggle ----------
(function () {
  var btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function current() { return root.dataset.theme || (mq.matches ? 'dark' : 'light'); }
  function label() {
    var dark = current() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  btn.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    label();
  });
  if (mq.addEventListener) mq.addEventListener('change', label);
  label();
})();

// Small extras: color-changing headline letters, and the contact form.

// ---------- headline: letters change color as the pointer passes over them ----------
(function () {
  var h1 = document.querySelector('.hello');
  if (!h1) return;
  // Edit these to change the colors the letters cycle through.
  var colors = ['#0d7a55', '#e0412b', '#1f45e0', '#d4306b', '#e9a514', '#5b3fe0'];
  var text = h1.textContent.trim();
  var next = 0;

  // Screen readers get the plain sentence; the letter spans are visual only.
  // The word named in the editor ("Colorful word in the headline") keeps one color per letter.
  var hl = (h1.getAttribute('data-highlight') || '').trim().toLowerCase();
  var visual = text.split(/([ \t\n]+)/).map(function (part) {
    if (/^[ \t\n]+$/.test(part)) return ' ';
    var bare = part.replace(/[^\p{L}\p{N}'’-]/gu, '').toLowerCase();
    var k = 0;
    return '<span class="w">' + Array.from(part).map(function (c) {
      var keep = hl && bare === hl && /[\p{L}\p{N}]/u.test(c);
      var style = keep ? ' style="color:' + colors[k++ % colors.length] + '" data-base="' + colors[(k - 1) % colors.length] + '"' : '';
      return '<span class="l"' + style + '>' + c.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
    }).join('') + '</span>';
  }).join('');
  h1.innerHTML = '<span class="sr-only"></span><span aria-hidden="true">' + visual + '</span>';
  h1.firstChild.textContent = text;

  function paint(el) {
    if (!el || !el.classList || !el.classList.contains('l')) return;
    el.style.transition = 'color .08s linear';
    el.style.color = colors[next++ % colors.length];
    clearTimeout(el._fade);
    el._fade = setTimeout(function () {
      el.style.transition = 'color 1.1s ease';
      el.style.color = el.getAttribute('data-base') || '';
    }, 300);
  }
  h1.addEventListener('pointerover', function (e) { paint(e.target); });
  // Fingers dragging across the headline on phones
  h1.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (t) paint(document.elementFromPoint(t.clientX, t.clientY));
  }, { passive: true });
})();

// ---------- contact arrow: an ink line with uneven weight that draws itself in ----------
(function () {
  var box = document.querySelector('.contact-doodle');
  if (!box) return;
  // A different ink color on every visit, from the headline letter colors (lighter versions in dark mode).
  var root = document.documentElement;
  var dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var inks = dark ? ['#3fb58a', '#ff6b55', '#7d95ff', '#f06a9b', '#f5c04a', '#9a86ff'] : ['#0d7a55', '#e0412b', '#1f45e0', '#d4306b', '#e9a514', '#5b3fe0'];
  var ink = Math.floor(Math.random() * inks.length);
  box.style.color = inks[ink];
  // Keep the same color, in the matching shade, when the theme is switched.
  var light = ['#0d7a55', '#e0412b', '#1f45e0', '#d4306b', '#e9a514', '#5b3fe0'], night = ['#3fb58a', '#ff6b55', '#7d95ff', '#f06a9b', '#f5c04a', '#9a86ff'];
  new MutationObserver(function () {
    var d = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    box.style.color = (d ? night : light)[ink];
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  var svg = box.querySelector('svg');
  var src = box.querySelector('.doodle-src');
  var head = box.querySelector('.doodle-head');
  if (!src.getTotalLength) return;
  var NS = 'http://www.w3.org/2000/svg';

  // Seeded random, so the line looks the same on every visit.
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  // Smooth wandering value from a few sine waves with random phases.
  function wave(freqs) {
    var ph = freqs.map(function () { return rnd() * 6.283; });
    return function (x) { var v = 0; freqs.forEach(function (f, i) { v += Math.sin(x * f[0] + ph[i]) * f[1]; }); return v; };
  }

  // Turn a path into a filled ribbon: the center drifts a little and the pen pressure swells and thins.
  function ribbon(el, base) {
    var len = el.getTotalLength();
    var steps = Math.max(12, Math.round(len / 3));
    var drift = wave([[0.021, 1.6], [0.057, 0.7], [0.19, 0.25]]);
    var press = wave([[0.013, 0.32], [0.041, 0.18], [0.11, 0.08]]);
    var L = [], R = [];
    for (var i = 0; i <= steps; i++) {
      var d = len * i / steps;
      var p = el.getPointAtLength(d);
      var q0 = el.getPointAtLength(Math.max(0, d - 1)), q1 = el.getPointAtLength(Math.min(len, d + 1));
      var tx = q1.x - q0.x, ty = q1.y - q0.y, m = Math.hypot(tx, ty) || 1;
      var nx = -ty / m, ny = tx / m;
      var t = i / steps;
      var taper = Math.min(1, t / 0.06, (1 - t) / 0.05);
      taper = 0.3 + 0.7 * Math.sqrt(Math.max(0, taper));
      var w = base * (1 + press(d)) * taper / 2;
      var c = drift(d);
      L.push((p.x + nx * (c + w)).toFixed(1) + ' ' + (p.y + ny * (c + w)).toFixed(1));
      R.push((p.x + nx * (c - w)).toFixed(1) + ' ' + (p.y + ny * (c - w)).toFixed(1));
    }
    var shape = document.createElementNS(NS, 'path');
    shape.setAttribute('d', 'M ' + L.join(' L ') + ' L ' + R.reverse().join(' L ') + ' Z');
    shape.setAttribute('class', 'ink');
    return shape;
  }

  // The head is two strokes, each drawn on its own like a pen would.
  var hp = head.getAttribute('d').match(/-?[\d.]+/g).map(Number);
  function line(x1, y1, x2, y2) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2); return p; }
  var strokes = [src, line(hp[0], hp[1], hp[2], hp[3]), line(hp[2], hp[3], hp[4], hp[5])];
  strokes.slice(1).forEach(function (p) { p.setAttribute('class', 'doodle-tmp'); svg.appendChild(p); });

  // A mask reveals the ink along the path for the draw-in.
  var mask = document.createElementNS(NS, 'mask');
  mask.setAttribute('id', 'doodle-mask');
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  var g = document.createElementNS(NS, 'g');
  g.setAttribute('mask', 'url(#doodle-mask)');
  var reveals = [];
  strokes.forEach(function (p, i) {
    g.appendChild(ribbon(p, i ? 2.6 : 3));
    var r = document.createElementNS(NS, 'path');
    r.setAttribute('d', p.getAttribute('d'));
    r.setAttribute('class', 'reveal');
    var l = p.getTotalLength() + 2;
    r.style.strokeDasharray = l;
    r.style.strokeDashoffset = 0;
    r._len = l;
    mask.appendChild(r);
    reveals.push(r);
  });
  svg.appendChild(mask);
  svg.appendChild(g);
  strokes.slice(1).forEach(function (p) { p.remove(); });
  box.classList.add('ready');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  reveals.forEach(function (r) { r.style.strokeDashoffset = r._len; });
  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    var times = [[0, 1300], [1250, 160], [1420, 160]];
    reveals.forEach(function (r, i) {
      r.style.transition = 'stroke-dashoffset ' + times[i][1] + 'ms cubic-bezier(.45,.05,.4,1) ' + times[i][0] + 'ms';
      r.style.strokeDashoffset = 0;
    });
  }, { threshold: 0.4 });
  io.observe(box);
})();

// ---------- "sent" moment: a letter swooshes out of the button ----------
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function unlockAudio() {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) { return null; }
}

// A soft "swoosh": a short burst of filtered noise that sweeps upward in pitch.
function playSwoosh(ctx) {
  if (!ctx) return;
  try {
    var dur = 0.85, now = ctx.currentTime;
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + dur);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(now); src.stop(now + dur);
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1200);
  } catch (e) {}
}

function sendOff(button, audio) {
  playSwoosh(audio);
  if (reduceMotion.matches) return;
  var r = button.getBoundingClientRect();
  var letter = document.createElement('span');
  letter.className = 'flying-letter';
  letter.setAttribute('aria-hidden', 'true');
  // Hand-drawn envelope: slightly wobbly edges and a flap that doesn't quite meet, like the ink lines on the site.
  letter.innerHTML = '<svg viewBox="0 0 48 36" width="54" height="40"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
    '<path fill="var(--paper)" d="M4.6 5.3C14.2 4.3 31.8 5.7 43.3 4.7c.9 8.4.2 17.9.8 26.6-11.9.9-28.8-.4-39.9.4.7-9.5-.4-18.1.4-26.4z"/>' +
    '<path d="M5.6 6.6c6.4 5.9 12.2 10.9 18.5 14.9 5.9-4.1 12.2-9.3 18.3-15.2"/>' +
    '<path d="M5.3 30.4c4.6-4.3 8.9-7.6 13.2-10.7M42.9 30.1c-4.4-3.9-8.5-7.1-12.7-10.2"/>' +
    '</g></svg>';
  letter.style.left = (r.left + r.width / 2 - 27) + 'px';
  letter.style.top = (r.top + r.height / 2 - 20) + 'px';
  document.body.appendChild(letter);
  button.classList.add('just-sent');
  setTimeout(function () { button.classList.remove('just-sent'); }, 500);
  letter.addEventListener('animationend', function () { letter.remove(); });
  setTimeout(function () { if (letter.parentNode) letter.remove(); }, 2200);
}

// ---------- contact form (sends through Web3Forms to your inbox) ----------
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var button = form.querySelector('button[type=submit]');
  var buttonLabel = button.textContent;
  var topic = form.querySelector('#cf-topic');
  var siteField = form.querySelector('[data-for="Free website audit"]');

  function syncTopic() { siteField.hidden = topic.value !== 'Free website audit'; }
  topic.addEventListener('change', syncTopic);
  syncTopic();

  // "Request a free audit" button picks the audit option and jumps to the form.
  document.querySelectorAll('[data-topic]').forEach(function (a) {
    a.addEventListener('click', function () {
      topic.value = a.getAttribute('data-topic');
      syncTopic();
      setTimeout(function () { form.querySelector('#cf-name').focus({ preventScroll: true }); }, 50);
    });
  });

  function say(msg, kind) { status.textContent = msg; status.dataset.kind = kind || ''; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.dataset.ready !== 'yes') {
      say('This form isn’t connected yet. Please use the email address on this page instead.', 'error');
      return;
    }
    var missing = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (f) { return !f.value.trim(); });
    var email = form.querySelector('#cf-email');
    if (missing.length) { say('Oops! I need some more info.', 'error'); missing[0].focus(); return; }
    if (!email.checkValidity()) { say('That email address looks incomplete. Please check it.', 'error'); email.focus(); return; }

    var data = Object.fromEntries(new FormData(form));
    if (data.topic === 'Free website audit') data.subject = 'Free audit request from emilylange.com';
    var audio = unlockAudio();   // must start inside the click so browsers allow the sound
    button.disabled = true; button.textContent = 'Sending…'; say('');

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.success) throw new Error(res.message || 'failed');
      sendOff(button, audio);
      form.reset(); syncTopic();
      say('Awesome. I’ll get back to you as soon as I can.', 'ok');
    }).catch(function () {
      say('Your message didn’t send. Please try again, or email me directly.', 'error');
    }).then(function () {
      button.disabled = false; button.textContent = buttonLabel;
    });
  });
})();

// ---------- case study videos: play like a silent GIF, but pause for visitors who reduce motion ----------
(function () {
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!mq.matches) return;
  document.querySelectorAll('.prose video').forEach(function (v) {
    v.removeAttribute('autoplay'); v.pause(); v.controls = true;
  });
})();

// ---------- floating scroll-to-top arrow: appears once you have scrolled down ----------
(function () {
  var btn = document.querySelector('.top-btn');
  if (!btn) return;
  function update() { btn.classList.toggle('show', window.scrollY > Math.max(400, window.innerHeight * 0.6)); }
  window.addEventListener('scroll', update, { passive: true });
  update();
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    btn.blur();
  });
})();

// ---------- section headings: faint grey, then a fresh color each time one pins to the top ----------
(function () {
  var heads = Array.prototype.slice.call(document.querySelectorAll('.section-h'));
  if (!heads.length) return;
  var root = document.documentElement;
  var day = ['#0d7a55', '#e0412b', '#1f45e0', '#d4306b', '#e9a514', '#5b3fe0'];
  var night = ['#3fb58a', '#ff6b55', '#7d95ff', '#f06a9b', '#f5c04a', '#9a86ff'];
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() { return root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && mq.matches); }
  var last = -1;
  function pick() {
    var i; do { i = Math.floor(Math.random() * day.length); } while (i === last);
    return (last = i);
  }
  function paint(h) { h.style.color = h._ink == null ? '' : (isDark() ? night : day)[h._ink]; }
  function check() {
    heads.forEach(function (h) {
      var top = h.getBoundingClientRect().top;
      var stuck = top <= 1 && top > -1 && window.scrollY > 0;
      if (stuck && h._ink == null) { h._ink = pick(); paint(h); }
      else if (!stuck && h._ink != null) { h._ink = null; paint(h); }
    });
  }
  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return; queued = true;
    requestAnimationFrame(function () { queued = false; check(); });
  }, { passive: true });
  new MutationObserver(function () { heads.forEach(paint); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  mq.addEventListener && mq.addEventListener('change', function () { heads.forEach(paint); });
  check();
})();
