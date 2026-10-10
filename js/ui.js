/* ── Themes ── */
const THEMES = ['dark', 'light', 'dracula', 'matrix', 'sunset'];
function applyTheme(name) {
  withTransition(() => {
    if (name === 'dark') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.dispatchEvent(new CustomEvent('themechange', { detail: name }));
  });
}
function setTheme(name) {
  if (!THEMES.includes(name)) return false;
  // Raw string (not JSON): the inline <head> script reads it before first paint
  try { localStorage.setItem('theme', name); } catch {}
  applyTheme(name);
  return true;
}
// Until the visitor picks a theme, follow the system's light/dark setting as it changes
matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  if (!saved) applyTheme(e.matches ? 'light' : 'dark');
});
const currentTheme = () => document.documentElement.dataset.theme || 'dark';
document.getElementById('themeBtn').addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  setTheme(next);
  flash(`Theme: ${next}`);
  sfx('click');
});

/* ── Sound effects (Web Audio, off by default) ── */
let soundOn = false;
try { soundOn = localStorage.getItem('sound') === 'on'; } catch {}
let audioCtx = null;
function sfx(kind) {
  if (!soundOn) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const tones = { click: [880, 0.04, 'square', 0.03], hover: [1320, 0.02, 'sine', 0.015], key: [200 + Math.random() * 120, 0.025, 'square', 0.02],
                  open: [520, 0.09, 'triangle', 0.05], error: [160, 0.15, 'sawtooth', 0.04], success: [660, 0.12, 'triangle', 0.05] };
  const [freq, dur, type, vol] = tones[kind] || tones.click;
  const t = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t);
  if (kind === 'success') osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur);
}
const soundBtn = document.getElementById('soundBtn');
function setSound(on) {
  soundOn = on;
  try { localStorage.setItem('sound', on ? 'on' : 'off'); } catch {}
  soundBtn.setAttribute('aria-pressed', on);
  soundBtn.querySelector('span').textContent = on ? 'on' : 'off';
  if (on) sfx('success');
}
setSound(soundOn);
soundBtn.addEventListener('click', () => setSound(!soundOn));
document.addEventListener('click', e => { if (e.target.closest('button, a')) sfx('click'); });
let lastHover = null;
document.addEventListener('mouseover', e => {
  const el = e.target.closest('.btn, .filter-btn, .project-card, .social-btn, nav a');
  if (el && el !== lastHover) { lastHover = el; sfx('hover'); }
});

/* ── Resume download tracking ── */
document.getElementById('resumeBtn').addEventListener('click', trackResume);
function trackResume() {
  fetch(`https://abacus.jasoncameron.dev/hit/${SITE.counterNamespace}/resume-downloads`).catch(() => {});
}

/* ── Timeline line that draws as you scroll ── */
(function () {
  const list = document.getElementById('timeline');
  const fill = document.getElementById('timelineFill');
  // Item offsets are cached when the layout changes, so each scroll frame reads
  // one rect and then writes. Scroll work only runs while the timeline is on screen.
  let items = [], offsets = [], onScreen = false, queued = false;
  function measure() {
    items = [...list.querySelectorAll('.tl-item')];
    offsets = items.map(item => item.offsetTop); // untransformed, relative to the list
    update();
  }
  function update() {
    queued = false;
    const r = list.getBoundingClientRect();
    const line = innerHeight * 0.6;
    fill.style.transform = `scaleY(${Math.min(1, Math.max(0, (line - r.top) / r.height))})`;
    items.forEach((item, i) => item.classList.toggle('lit', r.top + offsets[i] + 24 < line));
  }
  function schedule() {
    if (onScreen && !queued) { queued = true; requestAnimationFrame(update); }
  }
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; update(); }).observe(list);
  new ResizeObserver(measure).observe(list);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
})();

/* ── Section scrolling helper (used by palette and terminal) ── */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return false;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  return true;
}

/* ── Command palette (Ctrl/Cmd + P) ── */
(function () {
  const overlay = document.getElementById('paletteOverlay');
  const input   = document.getElementById('paletteInput');
  const list    = document.getElementById('paletteList');
  let items = [], shown = [], active = 0, lastFocus = null;

  function buildItems() {
    const sections = [...document.querySelectorAll('main section[id]')].filter(s => !s.hidden && s.id !== 'hero')
      .map(s => ({ group: 'Go to', label: s.querySelector('.section-title')?.dataset.text || s.querySelector('.section-title')?.textContent || s.id, hint: '#' + s.id, run: () => scrollToSection(s.id) }));
    const projects = PROJECTS.map(p => ({ group: 'Projects', label: p.title, hint: p.tech.slice(0, 3).join(' · '), run: () => openProject(p.name) }));
    const links = [
      { group: 'Links', label: 'GitHub', hint: 'github.com/Vanshff007', run: () => open(SITE.links.github, '_blank', 'noopener') },
      { group: 'Links', label: 'LinkedIn', hint: 'in/vansh-minhas', run: () => open(SITE.links.linkedin, '_blank', 'noopener') },
      { group: 'Links', label: 'LeetCode', hint: 'idgaf_vansh', run: () => open(SITE.links.leetcode, '_blank', 'noopener') },
    ];
    const actions = [
      { group: 'Actions', label: 'Download resume', hint: 'PDF', run: () => { trackResume(); const a = document.createElement('a'); a.href = SITE.resume; a.download = 'Vansh_Minhas_Resume.pdf'; a.click(); } },
      { group: 'Actions', label: 'Copy email address', hint: SITE.email, run: () => navigator.clipboard?.writeText(SITE.email).then(() => flash('Email copied ✓')) },
      { group: 'Actions', label: 'Open terminal', hint: 'Ctrl K', run: () => window.openTerminal?.() },
      { group: 'Actions', label: 'Ask the AI about me', hint: 'chat', run: () => window.openChat?.(), when: () => !!SITE.apiBase },
      { group: 'Actions', label: `Sound effects: turn ${soundOn ? 'off' : 'on'}`, hint: '♪', run: () => setSound(!soundOn) },
      { group: 'Actions', label: 'Play Snake', hint: 'in the terminal', run: () => window.openTerminal?.('snake') },
      { group: 'Actions', label: 'Typing speed test', hint: 'in the terminal', run: () => window.openTerminal?.('typing') },
      { group: 'Actions', label: 'Play Pac-Man on my GitHub graph', hint: 'game', run: () => window.playHeatmapGame?.('pacman') },
      { group: 'Actions', label: 'Play Space Shooter on my LeetCode graph', hint: 'game', run: () => window.playHeatmapGame?.('shooter') },
      ...THEMES.map(t => ({ group: 'Theme', label: `Theme: ${t}`, hint: t === currentTheme() ? 'current' : '', run: () => setTheme(t) })),
    ].filter(a => !a.when || a.when());
    return [...sections, ...projects, ...actions, ...links];
  }

  // Subsequence fuzzy match; consecutive and word-start hits score higher
  function score(text, q) {
    if (!q) return 1;
    text = text.toLowerCase();
    let ti = 0, s = 0, streak = 0;
    for (const ch of q) {
      const i = text.indexOf(ch, ti);
      if (i < 0) return 0;
      streak = i === ti ? streak + 1 : 0;
      s += 1 + streak * 2 + (i === 0 || text[i - 1] === ' ' ? 3 : 0);
      ti = i + 1;
    }
    return s - text.length * 0.01;
  }

  function renderList() {
    const q = input.value.trim().toLowerCase();
    shown = items.map(it => ({ it, s: Math.max(score(it.label, q), score(it.group + ' ' + it.label, q) * 0.8) }))
      .filter(x => x.s > 0).sort((a, b) => q ? b.s - a.s : 0).map(x => x.it).slice(0, 40);
    active = Math.min(active, Math.max(0, shown.length - 1));
    let group = '';
    list.innerHTML = shown.length ? shown.map((it, i) => {
      const head = !q && it.group !== group ? `<li class="palette-group" role="presentation">${esc(group = it.group)}</li>` : '';
      return `${head}<li class="palette-item${i === active ? ' active' : ''}" role="option" aria-selected="${i === active}" data-i="${i}"><span>${esc(it.label)}</span><small>${esc(it.hint || (q ? it.group : ''))}</small></li>`;
    }).join('') : '<li class="palette-empty">No matches. Try "theme", "snake" or a project name.</li>';
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    items = buildItems();
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    input.value = ''; active = 0;
    renderList();
    setTimeout(() => input.focus(), 30);
    sfx('open');
  }
  function closePalette() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    lastFocus?.focus?.();
  }
  function choose(i) {
    const it = shown[i];
    if (!it) return;
    closePalette();
    setTimeout(it.run, 120);
  }
  window.openPalette = openPalette;

  input.addEventListener('input', () => { active = 0; renderList(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % shown.length; renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % shown.length; renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') closePalette();
  });
  list.addEventListener('click', e => { const li = e.target.closest('.palette-item'); if (li) choose(+li.dataset.i); });
  list.addEventListener('mousemove', e => {
    const li = e.target.closest('.palette-item');
    if (li && +li.dataset.i !== active) { active = +li.dataset.i; list.querySelectorAll('.palette-item').forEach(x => x.classList.toggle('active', x === li)); }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closePalette(); });
  document.getElementById('paletteToggle').addEventListener('click', openPalette);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      overlay.classList.contains('open') ? closePalette() : openPalette();
    }
  });
})();

/* ── Confetti ── */
function confetti(count = 160) {
  if (reduceMotion) return;
  const c = document.getElementById('confetti'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = [themeRGB.accent, themeRGB.accent2, themeRGB.accent3].map(rgb => `rgb(${rgb})`);
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (++frames < 200) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
  })();
}

/* ── Konami code: confetti + dev mode ── */
(function () {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0;
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    pos = e.key.toLowerCase() === code[pos].toLowerCase() ? pos + 1 : (e.key === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      const on = document.body.classList.toggle('dev-mode');
      confetti();
      sfx('success');
      flash(on ? '↑↑↓↓←→←→BA — dev mode unlocked. Layout grid visible.' : 'Dev mode off.');
      foundSecret('konami');
    }
  });
})();

/* ── Tab title while the visitor is on another tab ── */
(function () {
  const title = document.title;
  const away = ['Hey, over here 👋', 'Still hiring? 👀', 'vansh.dev misses you', 'One tab away from a great hire'];
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? away[Math.floor(Math.random() * away.length)] : title;
  });
})();
