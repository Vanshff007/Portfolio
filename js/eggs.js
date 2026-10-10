/* ── Easter eggs ──────────────────────────────────────────────────
   Hidden secrets. Each one found raises the level on the About player
   card; finding all of them turns the card legendary. Progress is kept
   in localStorage. The terminal eggs (rm, vim, matrix, hack) live in
   terminal.js and report here through foundSecret().
────────────────────────────────────────────────────────────────── */
const SECRETS = {
  konami:   ['Konami code',        'An old cheat code. The terminal has a hidden file about it.'],
  hire:     ['sudo hire-vansh',    'Ask the terminal for root access to my calendar.'],
  portrait: ['Poke the portrait',  'The portrait does not like being poked. Five times.'],
  logo:     ['Party mode',         'The logo counts your clicks. Seven is lucky.'],
  vansh:    ['Say my name',        'Type my first name anywhere on the page.'],
  tab:      ['Come back',          'Leave this tab, then return.'],
  idle:     ['Idle walker',        'Do nothing for a minute.'],
  bottom:   ['The very bottom',    'Scroll until there is nothing left.'],
  rm:       ['rm -rf /',           'Try to delete everything from the terminal.'],
  vim:      ['Escaped vim',        'Open the editor nobody can exit. Then exit it.'],
  matrix:   ['Enter the matrix',   'A terminal command named after a 1999 film.'],
  hack:     ['Hack the mainframe', 'A terminal command for movie hackers.'],
};
const SECRET_IDS = Object.keys(SECRETS);
const BASE_LEVEL = 4;
const foundSecrets = store.get('secrets', []).filter(id => SECRETS[id]);

/* ── Progress: toast, level and legendary card ── */
const secretToast = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'secret-toast' }));
secretToast.setAttribute('role', 'status');
let secretToastTimer = null;
function showSecretToast(html) {
  secretToast.innerHTML = html;
  secretToast.classList.add('show');
  clearTimeout(secretToastTimer);
  secretToastTimer = setTimeout(() => secretToast.classList.remove('show'), 4000);
}

const playerCard = document.getElementById('playerCard');
const playerLvl  = document.getElementById('playerLvl');
const playerRole = document.getElementById('playerRole');
const playerRoleText = playerRole.textContent;
function renderLevel() {
  const all = foundSecrets.length === SECRET_IDS.length;
  playerLvl.textContent = 'LVL ' + (BASE_LEVEL + foundSecrets.length);
  playerLvl.title = `${foundSecrets.length}/${SECRET_IDS.length} secrets found`;
  playerCard.classList.toggle('legendary', all);
  playerRole.textContent = all ? 'Class: Legendary' : playerRoleText;
}
renderLevel();

// Returns true the first time a secret is found
function foundSecret(id) {
  if (!SECRETS[id] || foundSecrets.includes(id)) return false;
  foundSecrets.push(id);
  store.set('secrets', foundSecrets);
  renderLevel();
  const all = foundSecrets.length === SECRET_IDS.length;
  showSecretToast(all
    ? `All ${SECRET_IDS.length} secrets found. <b>Player card is now legendary.</b>`
    : `Secret found: ${esc(SECRETS[id][0])} <b>${foundSecrets.length}/${SECRET_IDS.length}</b>`);
  sfx('success');
  if (all) confetti(260);
  return true;
}

/* ── Portrait: five quick clicks ── */
(function () {
  const portrait = document.getElementById('playerPortrait');
  const lines = ['Underrated. The sweater says so.', 'Stop poking. Start hiring.', 'I debug better than I pose.', 'Chai first, then code.', 'Ow.'];
  let clicks = 0, last = 0, bubble = null, timer = null;
  portrait.addEventListener('click', () => {
    const now = Date.now();
    clicks = now - last < 600 ? clicks + 1 : 1;
    last = now;
    if (clicks < 5) return;
    clicks = 0;
    portrait.classList.remove('poked'); void portrait.offsetWidth; portrait.classList.add('poked');
    bubble = bubble || portrait.appendChild(Object.assign(document.createElement('div'), { className: 'portrait-bubble' }));
    bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
    bubble.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => bubble.classList.remove('show'), 2600);
    foundSecret('portrait');
  });
})();

/* ── Logo: seven quick clicks start party mode ── */
(function () {
  let clicks = 0, last = 0, timer = null;
  document.querySelector('nav .logo').addEventListener('click', () => {
    const now = Date.now();
    clicks = now - last < 600 ? clicks + 1 : 1;
    last = now;
    if (clicks < 7) return;
    clicks = 0;
    document.documentElement.classList.add('party');
    clearTimeout(timer);
    timer = setTimeout(() => document.documentElement.classList.remove('party'), 10000);
    flash('Party mode: 10 seconds');
    foundSecret('logo');
  });
})();

/* ── Type "vansh" anywhere outside a text field ── */
(function () {
  const word = 'vansh';
  let typed = '';
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-word.length);
    if (typed !== word) return;
    typed = '';
    confetti(120);
    flash('You called? 👋');
    foundSecret('vansh');
  });
})();

/* ── Tab title while the visitor is away ── */
(function () {
  const title = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'Come back 👀' : title;
    if (!document.hidden) foundSecret('tab');
  });
})();

/* ── Idle for a minute: a small character walks across the bottom ── */
(function () {
  const IDLE = 60000;
  let last = Date.now();
  const active = () => { last = Date.now(); };
  ['mousemove', 'keydown', 'scroll', 'pointerdown'].forEach(t => addEventListener(t, active, { passive: true }));
  function walk() {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'walker' + (reduceMotion ? ' still' : '') }));
    el.setAttribute('aria-hidden', 'true');
    // Reduced motion: the character stands in the corner for a moment instead of walking
    if (reduceMotion) setTimeout(() => el.remove(), 6000);
    else el.addEventListener('animationend', e => { if (e.animationName === 'walkAcross') el.remove(); });
    foundSecret('idle');
  }
  (function check() {
    const idle = Date.now() - last;
    if (idle >= IDLE && !document.hidden) { walk(); last = Date.now(); }
    setTimeout(check, Math.max(1000, IDLE - (Date.now() - last)));
  })();
})();

/* ── Scrolled to the very bottom ── */
new IntersectionObserver(([e], o) => {
  if (!e.isIntersecting) return;
  o.disconnect();
  document.getElementById('footSecret').hidden = false;
  foundSecret('bottom');
}, { threshold: 0.9 }).observe(document.querySelector('footer'));

/* ── Used by the terminal: rm -rf / ── */
function fakeWipe() {
  if (reduceMotion) { flash('Everything deleted. Just kidding.'); return; }
  document.body.classList.add('wiped');
  setTimeout(() => {
    document.body.classList.remove('wiped');
    flash('Just kidding. Everything is restored.');
  }, 3200);
}

/* ── Used by the terminal: matrix ── */
function matrixRain(ms = 5000) {
  if (reduceMotion) { flash('Wake up, Neo…'); return; }
  const c = document.body.appendChild(Object.assign(document.createElement('canvas'), { className: 'matrix-rain' }));
  const ctx = c.getContext('2d'), size = 16;
  c.width = innerWidth; c.height = innerHeight;
  const drops = Array.from({ length: Math.ceil(c.width / size) }, () => Math.random() * -40);
  const chars = 'アイウエオカキクケコサシスセソ0123456789VANSH';
  const start = performance.now();
  let lastDraw = 0;
  ctx.font = size + 'px monospace';
  (function tick(now) {
    if (now - start > ms) { c.classList.add('out'); setTimeout(() => c.remove(), 600); return; }
    requestAnimationFrame(tick);
    if (now - lastDraw < 45) return; // ~22 steps per second, like the film
    lastDraw = now;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#00ff66';
    drops.forEach((y, i) => {
      ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
      drops[i] = y * size > c.height && Math.random() > 0.975 ? 0 : y + 1;
    });
  })(start);
}

/* ── Special days: a greeting, and a festive theme if the visitor has not picked one ── */
(function () {
  const pad = n => String(n).padStart(2, '0');
  const now = new Date(), md = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, ymd = `${now.getFullYear()}-${md}`;
  // Diwali follows the lunar calendar, so the dates are listed by year
  const DIWALI = ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26'];
  const day = DIWALI.includes(ymd) ? { msg: 'Happy Diwali 🪔', theme: 'sunset' }
    : SITE.birthday && SITE.birthday === md ? { msg: `It's ${SITE.name.split(' ')[0]}'s birthday today 🎂` }
    : null;
  if (!day) return;
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('theme'); } catch {}
  if (day.theme && !savedTheme) {
    // Not saved: the visitor's own choice, or the default, is back tomorrow
    document.documentElement.dataset.theme = day.theme;
    document.dispatchEvent(new CustomEvent('themechange', { detail: day.theme }));
  }
  addEventListener('load', () => setTimeout(() => { flash(day.msg); confetti(); }, 1500), { once: true });
})();
