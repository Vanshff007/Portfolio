/* ── Theme colors for canvas/JS drawing (refreshed when the theme changes) ── */
const themeRGB = {};
function readThemeRGB() {
  const cs = getComputedStyle(document.documentElement);
  themeRGB.accent  = cs.getPropertyValue('--accent-rgb').trim();
  themeRGB.accent2 = cs.getPropertyValue('--accent2-rgb').trim();
  themeRGB.accent3 = cs.getPropertyValue('--accent3-rgb').trim();
  themeRGB.fg      = cs.getPropertyValue('--fg-rgb').trim();
}
readThemeRGB();
document.addEventListener('themechange', readThemeRGB);

/* ── Custom cursor ── */
const cursor = document.getElementById('cursor');
const ring   = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0, cursorRaf = 0;
// Move with `translate` (no layout) and only animate while the ring is catching up,
// so touch devices (cursor hidden) and an idle mouse cost nothing per frame
function animCursor() {
  cursor.style.translate = `${mx}px ${my}px`;
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  ring.style.translate = `${rx}px ${ry}px`;
  cursorRaf = Math.abs(mx - rx) + Math.abs(my - ry) > 0.5 ? requestAnimationFrame(animCursor) : 0;
}
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  if (!cursorRaf) cursorRaf = requestAnimationFrame(animCursor);
});
// Event delegation so elements added later (terminal, toasts) also get the hover state
const HOVER_SEL = 'a, button, input, textarea, .project-card, .skill-item, .tag';
document.addEventListener('mouseover', e => {
  if (!e.target.closest(HOVER_SEL)) return;
  cursor.style.transform = 'translate(-50%,-50%) scale(2)';
  ring.style.borderColor = `rgba(${themeRGB.accent},0.8)`;
  ring.style.width = ring.style.height = '50px';
});
document.addEventListener('mouseout', e => {
  const from = e.target.closest(HOVER_SEL);
  if (!from || (e.relatedTarget && from.contains(e.relatedTarget))) return;
  cursor.style.transform = 'translate(-50%,-50%) scale(1)';
  ring.style.borderColor = '';
  ring.style.width = ring.style.height = '36px';
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ── Text scramble for section titles ── */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';
function scramble(el) {
  const final = el.dataset.text || el.textContent;
  el.dataset.text = final;
  if (reduceMotion) return;
  let frame = 0;
  const total = 22;
  (function tick() {
    el.textContent = final.split('').map((ch, i) => {
      if (ch === ' ') return ' ';
      return frame / total > i / final.length ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }).join('');
    if (++frame <= total) requestAnimationFrame(tick);
    else el.textContent = final;
  })();
}

/* ── Count-up stats ── */
function countUp(el) {
  const target = +el.dataset.count, suffix = el.dataset.suffix || '';
  if (reduceMotion) return;
  const start = performance.now(), dur = 1200;
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

/* ── Scroll reveal ── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('visible');
    e.target.querySelectorAll('.section-title').forEach(scramble);
    e.target.querySelectorAll('[data-count]').forEach(countUp);
    revealObs.unobserve(e.target);
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
// For sections rendered after load (widgets, blog posts)
function observeReveal(root) { root.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObs.observe(el)); }

/* ── Skill bars ── */
const sbObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const t = e.target, w = t.style.width;
      t.style.width = '0';
      setTimeout(() => { t.style.width = w; }, 100);
      sbObs.unobserve(t);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.skill-bar').forEach(b => sbObs.observe(b));

/* ── Render wake-up launcher ──────────────────────────────────────
   FIX: Removed inline onclick. Using addEventListener instead —
   this avoids scope issues and works correctly even when the click
   originates from a child text node inside the button.
────────────────────────────────────────────────────────────────── */
const WAKE_MS = 8000;
let wakeTimer = null;

function closeWakeOverlay() {
  if (wakeTimer) { clearInterval(wakeTimer); wakeTimer = null; }
  document.getElementById('wakeOverlay').classList.remove('active');
  document.getElementById('wakeBar').style.width = '0%';
  document.getElementById('wakeMsg').textContent = 'Waking up server…';
}

function launchRender(targetUrl, pingUrl) {
  const overlay = document.getElementById('wakeOverlay');
  const bar     = document.getElementById('wakeBar');
  const msg     = document.getElementById('wakeMsg');

  overlay.classList.add('active');
  bar.style.width = '0%';
  msg.textContent = 'Waking up server…';

  // Fire-and-forget ping to wake the dyno
  fetch(pingUrl, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});

  const STATUS = [[0,'Waking up server…'],[3000,'Almost there — starting up…'],[6000,'Nearly ready…']];
  let elapsed = 0;
  const TICK  = 80;
  if (wakeTimer) clearInterval(wakeTimer);

  wakeTimer = setInterval(() => {
    elapsed += TICK;
    bar.style.width = Math.min((elapsed / WAKE_MS) * 100, 97) + '%';
    STATUS.forEach(([t, text]) => { if (elapsed >= t) msg.textContent = text; });

    if (elapsed >= WAKE_MS) {
      clearInterval(wakeTimer); wakeTimer = null;
      bar.style.width = '100%';
      setTimeout(() => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        closeWakeOverlay();
      }, 300);
    }
  }, TICK);
}

// Delegated so cards rendered later from GitHub data work too
document.addEventListener('click', e => {
  const btn = e.target.closest('.render-btn');
  if (!btn) return;
  e.stopPropagation();
  const url  = btn.dataset.renderUrl;
  const ping = btn.dataset.pingUrl || url;
  if (url) launchRender(url, ping);
});

// Overlay cancel: only close if user clicked the backdrop, not a child element
document.getElementById('wakeOverlay').addEventListener('click', closeWakeOverlay);
document.getElementById('wakeDismiss').addEventListener('click', e => {
  e.stopPropagation();
  closeWakeOverlay();
});

/* ── Mini toast ── */
const miniToast = document.getElementById('miniToast');
let miniToastTimer = null;
function flash(msg) {
  miniToast.textContent = msg;
  miniToast.classList.add('show');
  clearTimeout(miniToastTimer);
  miniToastTimer = setTimeout(() => miniToast.classList.remove('show'), 2200);
}

/* ── Scroll progress, back-to-top ── */
const progress = document.getElementById('scrollProgress');
const toTop    = document.getElementById('toTop');
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  toTop.classList.toggle('show', scrollY > innerHeight * 0.8);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();
toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

/* ── Active nav link ── */
const navLinks = document.querySelectorAll('#navLinks a');
const navObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('section[id]').forEach(s => navObs.observe(s));

/* ── Mobile menu ── */
const menuBtn = document.getElementById('menuBtn');
const navList = document.getElementById('navLinks');
function setMenu(open) {
  navList.classList.toggle('open', open);
  menuBtn.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open);
}
menuBtn.addEventListener('click', () => setMenu(!navList.classList.contains('open')));
navLinks.forEach(a => a.addEventListener('click', () => setMenu(false)));

/* ── Rotating hero word ── */
(function () {
  const el = document.getElementById('rotator');
  const words = ['Builds.', 'Ships.', 'Solves.', 'Creates.', 'Debugs.'];
  if (reduceMotion) return;
  let w = 0, i = words[0].length, deleting = true;
  setTimeout(function step() {
    const word = words[w];
    i += deleting ? -1 : 1;
    el.textContent = word.slice(0, i);
    let delay = deleting ? 55 : 110;
    if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
    else if (!deleting && i === words[w].length) { deleting = true; delay = 2200; }
    if (!deleting) el.textContent = words[w].slice(0, i);
    setTimeout(step, delay);
  }, 2600);
})();

/* ── Hero particle network ── */
(function () {
  const canvas = document.getElementById('heroCanvas');
  const hero   = document.getElementById('hero');
  const ctx    = canvas.getContext('2d');
  let W, H, dpr, pts = [], running = true;
  // Touch screens get one still frame: no cursor to react to, and it saves battery
  const still = reduceMotion || !finePointer;
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(90, Math.floor(W * H / 16000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      if (!still) {
        // gentle push away from the cursor
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 14000) { const f = 0.6 / Math.sqrt(d2 + 1); p.vx += dx * f * 0.05; p.vy += dy * f * 0.05; }
        p.vx *= 0.985; p.vy *= 0.985;
        if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.05;
        if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.05;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      ctx.fillStyle = `rgba(${themeRGB.accent},0.55)`;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, d = dx * dx + dy * dy;
        if (d < 13000) {
          ctx.strokeStyle = `rgba(${themeRGB.accent3},${0.22 * (1 - d / 13000)})`;
          ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
        }
      }
      const dx = pts[a].x - mouse.x, dy = pts[a].y - mouse.y, d = dx * dx + dy * dy;
      if (d < 26000) {
        ctx.strokeStyle = `rgba(${themeRGB.accent},${0.35 * (1 - d / 26000)})`;
        ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    if (running && !still) requestAnimationFrame(draw);
  }

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });
  new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was && pts.length) requestAnimationFrame(draw);
  }).observe(hero);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (still) draw(); }, 150); });
  // Start once the page has loaded and the main thread is idle, so the
  // particles don't compete with the hero text for first paint
  const start = () => { resize(); draw(); };
  const whenIdle = () => (window.requestIdleCallback || setTimeout)(start, { timeout: 1500 });
  if (document.readyState === 'complete') whenIdle(); else addEventListener('load', whenIdle, { once: true });
})();

/* ── Project card tilt + spotlight ── */
function bindTilt(card) {
  if (!finePointer || reduceMotion) return;
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', x * 100 + '%');
    card.style.setProperty('--my', y * 100 + '%');
    card.style.transition = 'border-color 0.3s, transform 0.08s';
    card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transition = '';
    card.style.transform = '';
  });
}
document.querySelectorAll('.project-card').forEach(bindTilt);

if (finePointer && !reduceMotion) {
  /* ── Magnetic buttons ── */
  document.querySelectorAll('.hero-ctas .btn, #submit-btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
}

/* ── Gmail button: also copy address to clipboard ── */
document.querySelector('.btn-gmail').addEventListener('click', () => {
  navigator.clipboard?.writeText('vansh31082005@gmail.com').then(() => flash('Email copied to clipboard ✓')).catch(() => {});
});

/* ── Contact form (Formspree) ── */
(function () {
  const form      = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submit-btn');
  const toast     = document.getElementById('formToast');
  const toastIcon = document.getElementById('toastIcon');
  const toastText = document.getElementById('toastText');
  let toastTimer  = null;

  function showToast(type, message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.className = 'form-toast show ' + type;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    toastText.textContent = message;
    toastTimer = setTimeout(() => { toast.className = 'form-toast'; }, 6000);
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nameVal  = form.querySelector('[name="name"]').value.trim();
    const emailVal = form.querySelector('[name="email"]').value.trim();
    const msgVal   = form.querySelector('[name="message"]').value.trim();
    const emailRe  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nameVal || !emailVal || !msgVal) {
      showToast('error', 'Please fill in all fields before sending.');
      return;
    }
    if (!emailRe.test(emailVal)) {
      showToast('error', "That email address doesn't look right.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (res.ok) {
        showToast('success', "Message sent! I'll get back to you soon.");
        form.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.errors?.[0]?.message || 'Something went wrong — try emailing me directly.');
      }
    } catch {
      showToast('error', 'Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  });
})();
