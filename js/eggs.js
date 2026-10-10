/* ── Easter eggs ──────────────────────────────────────────────────
   Hidden secrets. Each one found raises the level on the About player
   card. Finding every secret in SECRETS turns the card legendary; the
   ones in BONUS only add levels. Progress is kept in localStorage.
   Terminal and game eggs live in terminal.js and games.js and report
   here through foundSecret().
────────────────────────────────────────────────────────────────── */
// id: [name, hint shown by the `achievements` command while locked]
const SECRETS = {
  konami:   ['Konami code',        'An old cheat code. The terminal has a hidden file about it.'],
  hire:     ['sudo hire-vansh',    'Ask the terminal for root access to my calendar.'],
  portrait: ['Poke the portrait',  'The portrait does not like being poked. Five times.'],
  logo:     ['Party mode',         'The logo counts your clicks. Seven is lucky.'],
  vansh:    ['Say my name',        'Type my first name anywhere on the page.'],
  idle:     ['Idle walker',        'Do nothing for a minute.'],
  rm:       ['rm -rf /',           'Try to delete everything from the terminal.'],
  vim:      ['Escaped vim',        'Open the editor nobody can exit. Then exit it.'],
  matrix:   ['Enter the matrix',   'A terminal command named after a 1999 film.'],
  hack:     ['Hack the mainframe', 'A terminal command for movie hackers.'],
};
const BONUS = {
  combo:     ['MERN combo',       'Equip React, Node.js and MongoDB, in that order.'],
  inspect:   ['Inspect item',     'Inventory rows have a hidden side. Double-click one.'],
  ready:     ['Player 1 ready',   'Hold the pointer on the name in the player card.'],
  saveimg:   ['Flattered',        'Right-click the portrait.'],
  drop:      ['Gravity',          'Click my first name in the hero three times.'],
  circle:    ['Going in circles', 'Draw circles with the mouse.'],
  maxskill:  ['Maxed out',        'Click one skill bar until it gives up.'],
  selectall: ['Copycat',          'Select everything on the page.'],
  night:     ['Night owl',        'Visit after midnight.'],
  print:     ['Old school',       'Print the page.'],
  lost:      ['Lost',             'Visit a page that does not exist.'],
  fortune:   ['Fortune',          'Ask the terminal for your fortune.'],
  answer:    ['The answer',       'The terminal knows the answer to everything. It is a number.'],
  curl:      ['curl hire.me',     'Fetch hire.me from the terminal.'],
  goldsnake: ['Golden snake',     'Score 20 in snake.'],
  speed:     ['Speed typist',     'Reach 80 WPM in the typing test.'],
};
const SECRET_IDS = Object.keys(SECRETS);
const BASE_LEVEL = 4;
const foundSecrets = store.get('secrets', []).filter(id => SECRETS[id] || BONUS[id]);
const countFound = table => Object.keys(table).filter(id => foundSecrets.includes(id)).length;

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
  const core = countFound(SECRETS), all = core === SECRET_IDS.length;
  playerLvl.textContent = 'LVL ' + (BASE_LEVEL + foundSecrets.length);
  playerLvl.title = `${core}/${SECRET_IDS.length} secrets, ${countFound(BONUS)}/${Object.keys(BONUS).length} bonus`;
  playerCard.classList.toggle('legendary', all);
  playerRole.textContent = all ? 'Class: Legendary' : playerRoleText;
}
renderLevel();

// Returns true the first time a secret is found
function foundSecret(id) {
  const table = SECRETS[id] ? SECRETS : BONUS[id] ? BONUS : null;
  if (!table || foundSecrets.includes(id)) return false;
  foundSecrets.push(id);
  store.set('secrets', foundSecrets);
  renderLevel();
  const total = Object.keys(table).length, n = countFound(table);
  const legendary = table === SECRETS && n === total;
  showSecretToast(legendary
    ? `All ${total} secrets found. <b>Player card is now legendary.</b>`
    : `${table === BONUS ? 'Bonus secret' : 'Secret found'}: ${esc(table[id][0])} <b>${n}/${total}</b>`);
  sfx('success');
  if (legendary) confetti(260);
  return true;
}

/* ── Portrait: five quick clicks, or a right-click ── */
(function () {
  const portrait = document.getElementById('playerPortrait');
  const lines = ['Underrated. The sweater says so.', 'Stop poking. Start hiring.', 'I debug better than I pose.', 'Chai first, then code.', 'Ow.'];
  let clicks = 0, last = 0, bubble = null, timer = null;
  function say(text) {
    bubble = bubble || portrait.appendChild(Object.assign(document.createElement('div'), { className: 'portrait-bubble' }));
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => bubble.classList.remove('show'), 2600);
  }
  portrait.addEventListener('click', () => {
    const now = Date.now();
    clicks = now - last < 600 ? clicks + 1 : 1;
    last = now;
    if (clicks < 5) return;
    clicks = 0;
    portrait.classList.remove('poked'); void portrait.offsetWidth; portrait.classList.add('poked');
    say(lines[Math.floor(Math.random() * lines.length)]);
    foundSecret('portrait');
  });
  // The browser's own menu still opens
  portrait.addEventListener('contextmenu', () => { say('Save image? Flattered.'); foundSecret('saveimg'); });
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

/* ── Keyboard: type "vansh", or select everything ── */
(function () {
  const word = 'vansh';
  let typed = '';
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || e.key.length !== 1) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      flash('Copying the whole portfolio? The resume is one click away.');
      foundSecret('selectall');
      return;
    }
    typed = (typed + e.key.toLowerCase()).slice(-word.length);
    if (typed !== word) return;
    typed = '';
    confetti(120);
    flash('You called? 👋');
    foundSecret('vansh');
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

/* ── Player card: tag combo, inventory flip, name hold ── */
(function () {
  // Equip three tags in order
  const order = ['React', 'Node.js', 'MongoDB'];
  const tags = playerCard.querySelector('.about-tags'), label = tags.previousElementSibling, labelText = label.textContent;
  let pos = 0, comboTimer = null;
  const mark = n => [...tags.children].forEach(t => t.classList.toggle('equipped', order.slice(0, n).includes(t.textContent)));
  tags.addEventListener('click', e => {
    const tag = e.target.closest('.tag');
    if (!tag) return;
    pos = tag.textContent === order[pos] ? pos + 1 : (tag.textContent === order[0] ? 1 : 0);
    mark(pos);
    if (pos < order.length) return;
    pos = 0;
    label.textContent = labelText + ' · Combo: MERN stack';
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { label.textContent = labelText; mark(0); }, 4000);
    foundSecret('combo');
  });

  // Double-click an inventory row to see its hidden side
  const hiddenStats = [['Chai consumed', '∞'], ['Bugs created', 'Classified'], ['Tabs open', 'Too many'], ['Sleep', 'Deprecated'], ['Stack Overflow visits', 'Redacted'], ['Coffee', '0. Chai only.']];
  const inv = playerCard.querySelector('.player-inv');
  inv.addEventListener('dblclick', e => {
    const row = e.target.closest('.player-inv > div');
    const side = row && hiddenStats[[...inv.children].indexOf(row)];
    if (!side) return;
    const [dt, dd] = row.children;
    if (row.dataset.front) {
      [dt.textContent, dd.textContent] = JSON.parse(row.dataset.front);
      delete row.dataset.front;
    } else {
      row.dataset.front = JSON.stringify([dt.textContent, dd.textContent]);
      [dt.textContent, dd.textContent] = side;
    }
    row.classList.toggle('flipped', !!row.dataset.front);
    foundSecret('inspect');
  });

  // Hold the pointer on the name for three seconds
  const name = playerCard.querySelector('.about-name'), nameText = name.textContent;
  let holdTimer = null, busy = false;
  const setName = text => { name.dataset.text = text; if (reduceMotion) name.textContent = text; else scramble(name); };
  name.addEventListener('mouseenter', () => {
    holdTimer = setTimeout(() => {
      if (busy) return;
      busy = true;
      setName('Player 1 Ready');
      foundSecret('ready');
      setTimeout(() => { setName(nameText); busy = false; }, 2600);
    }, 3000);
  });
  name.addEventListener('mouseleave', () => clearTimeout(holdTimer));
})();

/* ── Hero name: three quick clicks and the letters fall ── */
(function () {
  const el = document.getElementById('heroName'), text = el.textContent;
  let clicks = 0, last = 0, busy = false;
  el.addEventListener('click', () => {
    const now = Date.now();
    clicks = now - last < 600 ? clicks + 1 : 1;
    last = now;
    if (clicks < 3 || busy) return;
    clicks = 0;
    foundSecret('drop');
    if (reduceMotion) return;
    busy = true;
    el.innerHTML = [...text].map((ch, i) => `<span class="drop-letter" style="animation-delay:${i * 70}ms">${esc(ch)}</span>`).join('');
    setTimeout(() => { el.textContent = text; busy = false; }, 1700 + text.length * 70);
  });
})();

/* ── Draw two circles with the mouse: the cursor ring spins ── */
if (finePointer) (function () {
  let px, py, heading = null, turned = 0, lastT = 0;
  document.addEventListener('mousemove', e => {
    if (px === undefined || e.timeStamp - lastT > 250) { px = e.clientX; py = e.clientY; heading = null; turned = 0; lastT = e.timeStamp; return; }
    const dx = e.clientX - px, dy = e.clientY - py;
    if (dx * dx + dy * dy < 144) return; // one sample per 12px of travel
    const h = Math.atan2(dy, dx);
    if (heading !== null) {
      const d = Math.atan2(Math.sin(h - heading), Math.cos(h - heading)); // turn since the last sample, -π to π
      // Turning the same way adds up. A clear turn the other way starts over; small wobbles are ignored.
      if (turned && Math.sign(d) !== Math.sign(turned)) { if (Math.abs(d) > 0.5) turned = d; }
      else turned += d;
    }
    heading = h; px = e.clientX; py = e.clientY; lastT = e.timeStamp;
    if (Math.abs(turned) < Math.PI * 4) return;
    turned = 0;
    ring.classList.add('spin');
    ring.addEventListener('animationend', () => ring.classList.remove('spin'), { once: true });
    if (reduceMotion) setTimeout(() => ring.classList.remove('spin'), 1000);
    foundSecret('circle');
  });
})();

/* ── Skill bars: ten clicks on one bar max it out for a moment ── */
(function () {
  const counts = new WeakMap();
  // Capture phase, so a click on the bar does not also run the row's own click (filter projects)
  document.getElementById('skillsBars').addEventListener('click', e => {
    const right = e.target.closest('.skill-right');
    if (!right) return;
    e.stopPropagation();
    const n = (counts.get(right) || 0) + 1;
    counts.set(right, n % 10);
    if (n < 10) return;
    const bar = right.querySelector('.skill-bar'), pct = right.querySelector('.skill-pct');
    const was = [bar.style.transform, pct.textContent];
    bar.style.transform = 'scaleX(1)';
    pct.textContent = '100%';
    flash('100%. If only it was that easy.');
    setTimeout(() => { [bar.style.transform, pct.textContent] = was; }, 3000);
    foundSecret('maxskill');
  }, true);
})();

/* ── Printing the page, visiting at night, coming back from the 404 page ── */
addEventListener('beforeprint', () => foundSecret('print'));
addEventListener('load', () => setTimeout(() => {
  if (new Date().getHours() < 4) { flash('Up late? Me too. 🌙'); foundSecret('night'); }
  // 404.html sets this flag; the secret is awarded on the next visit to the real page
  if (store.get('visited-404')) foundSecret('lost');
}, 2500), { once: true });

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
