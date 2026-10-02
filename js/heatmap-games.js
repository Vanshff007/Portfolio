/* ── Heatmap mini-games ──────────────────────────────────────────
   Pac-Man on the GitHub contribution graph (contributions are pellets)
   and a space shooter on the LeetCode graph (submissions are enemies).
   Both read the grid that drawHeatmap() stores on the heatmap element.
────────────────────────────────────────────────────────────────── */
(function () {
  const overlay = document.getElementById('gameOverlay');
  const canvas  = document.getElementById('gameCanvas');
  const ctx     = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const msgEl = $('gameMsg'), pad = $('gamePad');
  const SOURCES = { pacman: 'heatmap', shooter: 'lcHeatmap' };
  let game = null, raf = 0, last = 0, lastFocus = null;
  const view = { cell: 16, viewW: 0, viewH: 0, camX: 0 };
  const keys = { left: false, right: false, up: false, down: false, fire: false };
  const touch = () => matchMedia('(hover: none)').matches;

  /* ── Shared setup ── */
  // Turn a drawn heatmap into columns (weeks) x 7 rows of levels 0-4
  function gridFrom(el) {
    const h = el && el._heat;
    if (!h) return null;
    const cells = [...Array(h.offset).fill(null), ...h.days];
    const cols = Math.ceil(cells.length / 7);
    const grid = Array.from({ length: cols }, (_, c) => Array.from({ length: 7 }, (_, r) => cells[c * 7 + r]?.level ?? 0));
    return { cols, grid, rgb: getComputedStyle(el).getPropertyValue('--heat').trim() };
  }

  // Size the canvas: whole field if it fits, otherwise a window that scrolls with the player
  function fit(cols, rows) {
    const maxW = Math.min(innerWidth - 40, 1120), maxH = Math.max(160, innerHeight - (touch() ? 330 : 250));
    view.cell = Math.max(12, Math.floor(Math.min(maxW / cols, maxH / rows)));
    view.viewW = Math.min(cols, Math.floor(maxW / view.cell)) * view.cell;
    view.viewH = rows * view.cell;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = view.viewW * dpr; canvas.height = view.viewH * dpr;
    canvas.style.width = view.viewW + 'px'; canvas.style.height = view.viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function camera(focusX, cols) {
    const worldW = cols * view.cell;
    const target = Math.min(Math.max(focusX * view.cell - view.viewW / 2, 0), Math.max(0, worldW - view.viewW));
    view.camX += (target - view.camX) * 0.15;
  }

  function hud(score, lives) {
    $('gameScore').textContent = score;
    $('gameLives').textContent = '♥'.repeat(Math.max(0, lives)) || '–';
  }
  function message(html) { msgEl.innerHTML = html; msgEl.hidden = !html; }
  function saveBest(kind, score) {
    const best = store.get(kind + '-best', 0);
    if (score > best) store.set(kind + '-best', score);
    $('gameBest').textContent = Math.max(best, score);
    return score > best;
  }
  function endGame(won) {
    game.state = won ? 'win' : 'over';
    const newBest = saveBest(game.kind, game.score);
    sfx(won ? 'success' : 'error');
    if (won) confetti();
    message(`<b>${won ? 'You cleared the graph! 🎉' : 'Game over'}</b><span>Score ${game.score}${newBest ? ' · new best! 🏆' : ''}</span><span class="game-msg-sub">Press Enter or tap to play again</span>`);
  }

  /* ── Pac-Man ── */
  const PAC_POWERUPS = [
    { id: 'speed',  icon: '⚡', label: 'Speed',         ms: 6000, weight: 3 },
    { id: 'freeze', icon: '❄', label: 'Ghosts frozen', ms: 4000, weight: 3 },
    { id: 'magnet', icon: '🧲', label: 'Magnet',        ms: 6000, weight: 2 },
    { id: 'double', icon: '×2', label: 'Double points', ms: 8000, weight: 3 },
    { id: 'life',   icon: '♥', label: 'Extra life',    ms: 0,    weight: 1 },
  ];

  // Small seeded random generator, so the maze looks the same on every visit
  function seededRandom(seed) {
    return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Place short wall pieces on empty days only. A piece is kept only if every open
  // cell is still reachable, so no pellet is ever walled off.
  function buildWalls(cols, rows, pellets) {
    const walls = Array.from({ length: cols }, () => new Array(rows).fill(false));
    let seed = 7;
    pellets.forEach((col, x) => col.forEach((lv, y) => { seed = (seed * 31 + lv * (x * rows + y + 1)) | 0; }));
    const rand = seededRandom(seed);
    const isProtected = (x, y) => pellets[x][y] > 0 || (x <= 2 && y >= 2 && y <= 4) || (x >= cols - 3 && y >= 1 && y <= 5);
    const open = () => { let n = 0; for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (!walls[x][y]) n++; return n; };
    const reachable = () => {
      const seen = new Uint8Array(cols * rows), q = [[0, 3]];
      seen[3] = 1;
      let n = 0;
      while (q.length) {
        const [x, y] = q.pop(); n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || walls[nx][ny] || seen[nx * rows + ny]) continue;
          seen[nx * rows + ny] = 1; q.push([nx, ny]);
        }
      }
      return n;
    };
    let empty = 0;
    pellets.forEach((col, x) => col.forEach((lv, y) => { if (!isProtected(x, y)) empty++; }));
    const target = Math.floor(empty * 0.3);
    let placed = 0;
    for (let tries = 0; tries < cols * 8 && placed < target; tries++) {
      const horizontal = rand() < 0.6, len = 2 + Math.floor(rand() * (horizontal ? 3 : 2));
      const x0 = Math.floor(rand() * cols), y0 = Math.floor(rand() * rows);
      const cells = Array.from({ length: len }, (_, i) => horizontal ? [x0 + i, y0] : [x0, y0 + i]);
      if (cells.some(([x, y]) => x >= cols || y >= rows || walls[x][y] || isProtected(x, y))) continue;
      cells.forEach(([x, y]) => { walls[x][y] = true; });
      if (reachable() !== open()) cells.forEach(([x, y]) => { walls[x][y] = false; });
      else placed += len;
    }
    return walls;
  }

  function pacman(src) {
    const { cols, grid, rgb } = src, rows = 7;
    const PAC_STEP = 150, FAST_STEP = 95, GHOST_STEP = 150;
    const pellets = grid.map(col => col.slice());
    const walls = buildWalls(cols, rows, pellets);
    let left = pellets.flat().filter(Boolean).length;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const pac = { x: 0, y: 3, px: 0, py: 3, dir: [1, 0], next: [1, 0] };
    const ghostColors = [`rgb(${themeRGB.accent2})`, `rgb(${themeRGB.accent3})`, '#ff9f43', '#4dd0e1'];
    const HOMES = [[cols - 1, 1], [cols - 1, 5], [cols - 3, 3], [cols - 1, 3]];
    const ghosts = HOMES.slice(0, cols > 30 ? 4 : 3).map(([x, y], i) => ({ x, y, px: x, py: y, dir: [-1, 0], color: ghostColors[i], delay: 6 + i * 8, eaten: false, home: [x, y] }));
    let pacAcc = 0, ghostAcc = 0, gtick = 0, frightMs = 0, respawn = 0;
    let item = null, spawnIn = 5000, lastPowerText = '';
    const active = {}; // power-up id → ms left
    const g = { kind: 'pacman', state: 'ready', score: 0, lives: 3 };

    const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
    const free = (x, y) => inside(x, y) && !walls[x][y];
    const canMove = (o, d) => free(o.x + d[0], o.y + d[1]);
    function move(o, d) { o.px = o.x; o.py = o.y; o.x += d[0]; o.y += d[1]; }

    // Shortest-path distances through the maze from one cell (BFS)
    function distanceMap(tx, ty) {
      const dist = new Int16Array(cols * rows).fill(-1), q = [tx * rows + ty];
      dist[q[0]] = 0;
      for (let h = 0; h < q.length; h++) {
        const x = Math.floor(q[h] / rows), y = q[h] % rows;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = nx * rows + ny;
          if (!free(nx, ny) || dist[k] >= 0) continue;
          dist[k] = dist[q[h]] + 1; q.push(k);
        }
      }
      return dist;
    }

    function chooseDir(gh, i) {
      let opts = DIRS.filter(d => canMove(gh, d) && !(d[0] === -gh.dir[0] && d[1] === -gh.dir[1]));
      if (!opts.length) opts = DIRS.filter(d => canMove(gh, d));
      if (!opts.length) return [0, 0];
      const scared = frightMs > 0 && !gh.eaten;
      if (Math.random() < (scared ? 0.35 : 0.15)) return opts[Math.floor(Math.random() * opts.length)];
      // Each ghost aims a little differently (straight at you, ahead of you, behind you)
      const off = [0, 3, -2, 2][i];
      let tx = Math.min(cols - 1, Math.max(0, pac.x + pac.dir[0] * off)), ty = Math.min(rows - 1, Math.max(0, pac.y + pac.dir[1] * off));
      if (!free(tx, ty)) { tx = pac.x; ty = pac.y; }
      const dist = distanceMap(tx, ty);
      const d = o => dist[(gh.x + o[0]) * rows + gh.y + o[1]];
      return opts.reduce((best, o) => (scared ? d(o) > d(best) : d(o) < d(best)) ? o : best);
    }

    function resetPositions() {
      Object.assign(pac, { x: 0, y: 3, px: 0, py: 3, dir: [1, 0], next: [1, 0] });
      ghosts.forEach((gh, i) => Object.assign(gh, { x: gh.home[0], y: gh.home[1], px: gh.home[0], py: gh.home[1], dir: [-1, 0], delay: 6 + i * 8, eaten: false }));
      frightMs = 0; pacAcc = 0; ghostAcc = 0;
    }

    function collide() {
      for (const gh of ghosts) {
        const same = gh.x === pac.x && gh.y === pac.y;
        const swapped = gh.x === pac.px && gh.y === pac.py && gh.px === pac.x && gh.py === pac.y;
        if (!same && !swapped) continue;
        if (frightMs > 0 && gh.eaten) continue; // eaten ghosts are harmless until the power pellet wears off
        if (frightMs > 0) {
          g.score += 200 * (active.double ? 2 : 1); sfx('success');
          Object.assign(gh, { x: gh.home[0], y: gh.home[1], px: gh.home[0], py: gh.home[1], delay: 12, eaten: true });
        } else {
          g.lives--; sfx('error');
          hud(g.score, g.lives);
          if (g.lives <= 0) { endGame(false); return; }
          respawn = 900;
          resetPositions();
          return;
        }
      }
    }

    function eatAt(x, y) {
      const lv = pellets[x][y];
      if (!lv) return;
      pellets[x][y] = 0; left--;
      g.score += lv * 10 * (active.double ? 2 : 1);
      if (lv === 4) { frightMs = 6500; ghosts.forEach(gh => { gh.eaten = false; }); sfx('open'); } else sfx('key');
    }

    function pickUp() {
      if (!item || item.x !== pac.x || item.y !== pac.y) return;
      const p = item.type;
      if (p.id === 'life') g.lives = Math.min(5, g.lives + 1);
      else active[p.id] = p.ms;
      item = null;
      sfx('success');
      flash(`${p.icon} ${p.label}!`);
    }

    function pacStep() {
      if (canMove(pac, pac.next)) pac.dir = pac.next;
      if (canMove(pac, pac.dir)) move(pac, pac.dir); else { pac.px = pac.x; pac.py = pac.y; }
      eatAt(pac.x, pac.y);
      if (active.magnet) {
        for (let x = pac.x - 2; x <= pac.x + 2; x++) for (let y = pac.y - 2; y <= pac.y + 2; y++)
          if (inside(x, y) && Math.abs(x - pac.x) + Math.abs(y - pac.y) <= 2) eatAt(x, y);
      }
      pickUp();
      hud(g.score, g.lives);
      if (!left) { endGame(true); return; }
      collide();
    }

    function ghostStep() {
      gtick++;
      ghosts.forEach((gh, i) => {
        gh.px = gh.x; gh.py = gh.y;
        if (gh.delay > 0) { gh.delay--; return; }
        if (active.freeze) return;
        if (frightMs > 0 && !gh.eaten ? gtick % 2 : gtick % 5 === 0) return; // ghosts are a bit slower than you
        gh.dir = chooseDir(gh, i);
        move(gh, gh.dir);
      });
      collide();
    }

    function spawnItem() {
      const options = PAC_POWERUPS.filter(p => p.id !== 'life' || g.lives < 3);
      let r = Math.random() * options.reduce((a, p) => a + p.weight, 0), type = options[0];
      for (const p of options) { r -= p.weight; if (r <= 0) { type = p; break; } }
      const cells = [];
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++)
        if (free(x, y) && !pellets[x][y] && Math.abs(x - pac.x) + Math.abs(y - pac.y) >= 5 && !ghosts.some(gh => gh.x === x && gh.y === y)) cells.push([x, y]);
      if (!cells.length) return;
      const [x, y] = cells[Math.floor(Math.random() * cells.length)];
      item = { x, y, type, ttl: 8000 };
    }

    function updatePowerHud() {
      const text = Object.entries(active).map(([id, ms]) => `${PAC_POWERUPS.find(p => p.id === id).icon} ${Math.ceil(ms / 1000)}s`).join('  ');
      if (text !== lastPowerText) { $('gamePower').textContent = text; lastPowerText = text; }
    }

    g.input = d => { pac.next = d; };
    g.update = dt => {
      if (respawn > 0) { respawn = Math.max(0, respawn - dt); return; }
      for (const id in active) { active[id] -= dt; if (active[id] <= 0) delete active[id]; }
      updatePowerHud();
      if (frightMs > 0 && (frightMs -= dt) <= 0) { frightMs = 0; ghosts.forEach(gh => { gh.eaten = false; }); }
      if (item && (item.ttl -= dt) <= 0) item = null;
      if (!item && (spawnIn -= dt) <= 0) { spawnItem(); spawnIn = 9000 + Math.random() * 4000; }
      const step = active.speed ? FAST_STEP : PAC_STEP;
      pacAcc += dt;
      while (pacAcc >= step && g.state === 'play' && !respawn) { pacAcc -= step; pacStep(); }
      ghostAcc += dt;
      while (ghostAcc >= GHOST_STEP && g.state === 'play' && !respawn) { ghostAcc -= GHOST_STEP; ghostStep(); }
    };

    g.draw = t => {
      const c = view.cell;
      const lerp = (o, k) => Math.abs(o.x - o.px) + Math.abs(o.y - o.py) > 1 || respawn
        ? [o.x, o.y] // respawned: don't slide across the board
        : [o.px + (o.x - o.px) * k, o.py + (o.y - o.py) * k];
      const [pxf, pyf] = lerp(pac, Math.min(1, pacAcc / (active.speed ? FAST_STEP : PAC_STEP)));
      camera(pxf + 0.5, cols);
      ctx.clearRect(0, 0, view.viewW, view.viewH);
      ctx.save(); ctx.translate(-Math.round(view.camX), 0);

      // Floor and pellets
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        if (walls[x][y]) continue;
        ctx.fillStyle = `rgba(${themeRGB.fg},0.04)`;
        ctx.fillRect(x * c + 1.5, y * c + 1.5, c - 3, c - 3);
        const lv = pellets[x][y];
        if (!lv) continue;
        const pulse = lv === 4 ? 0.15 * Math.sin(t / 150) : 0;
        const s = c * (0.18 + 0.07 * lv + pulse);
        ctx.fillStyle = `rgba(${rgb},${0.45 + 0.14 * lv})`;
        if (lv === 4) { ctx.beginPath(); ctx.arc(x * c + c / 2, y * c + c / 2, s / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(x * c + (c - s) / 2, y * c + (c - s) / 2, s, s);
      }

      // Walls: thick rounded bars that join their neighbours, classic arcade style
      const inset = c * 0.2;
      ctx.fillStyle = `rgba(${themeRGB.accent3},0.75)`;
      ctx.shadowColor = `rgba(${themeRGB.accent3},0.6)`; ctx.shadowBlur = 6;
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        if (!walls[x][y]) continue;
        ctx.beginPath(); ctx.roundRect(x * c + inset, y * c + inset, c - 2 * inset, c - 2 * inset, c * 0.18); ctx.fill();
        if (x + 1 < cols && walls[x + 1][y]) ctx.fillRect(x * c + c - inset - 1, y * c + inset, 2 * inset + 2, c - 2 * inset);
        if (y + 1 < rows && walls[x][y + 1]) ctx.fillRect(x * c + inset, y * c + c - inset - 1, c - 2 * inset, 2 * inset + 2);
        // 2x2 blocks: fill the gap where four pieces meet
        if (x + 1 < cols && y + 1 < rows && walls[x + 1][y] && walls[x][y + 1] && walls[x + 1][y + 1]) ctx.fillRect(x * c + c - inset - 1, y * c + c - inset - 1, 2 * inset + 2, 2 * inset + 2);
      }
      ctx.shadowBlur = 0;

      // Power-up on the board (blinks before it disappears)
      if (item && !(item.ttl < 2000 && Math.floor(t / 150) % 2)) {
        const cx = item.x * c + c / 2, cy = item.y * c + c / 2, r = c * (0.42 + 0.05 * Math.sin(t / 180));
        ctx.fillStyle = `rgba(${themeRGB.accent},0.18)`;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(${themeRGB.accent},0.8)`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = `${Math.round(c * 0.55)}px "JetBrains Mono", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = item.type.id === 'life' ? '#ff4d6d' : '#fff';
        ctx.fillText(item.type.icon, cx, cy + 1);
      }

      // Pac-Man, with a speed trail and a magnet ring when active
      const angle = Math.atan2(pac.dir[1], pac.dir[0]);
      const mouth = 0.08 + 0.28 * Math.abs(Math.sin(t / 90));
      const pcx = pxf * c + c / 2, pcy = pyf * c + c / 2;
      if (active.magnet) {
        ctx.strokeStyle = `rgba(${rgb},${0.35 + 0.2 * Math.sin(t / 120)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, c * 2.2, 0, 7); ctx.stroke();
      }
      if (active.speed) {
        ctx.fillStyle = 'rgba(255,210,63,0.25)';
        ctx.beginPath(); ctx.arc(pcx - pac.dir[0] * c * 0.5, pcy - pac.dir[1] * c * 0.5, c * 0.3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(pcx, pcy);
      ctx.arc(pcx, pcy, c * 0.42, angle + mouth * Math.PI, angle - mouth * Math.PI + Math.PI * 2);
      ctx.fill();

      // Ghosts
      const gk = Math.min(1, ghostAcc / GHOST_STEP);
      ghosts.forEach(gh => {
        const [gx, gy] = active.freeze ? [gh.x, gh.y] : lerp(gh, gk), cx = gx * c + c / 2, top = gy * c + c * 0.12, r = c * 0.4;
        const scared = frightMs > 0 && !gh.eaten;
        ctx.globalAlpha = gh.eaten && frightMs > 0 ? 0.35 : 1;
        ctx.fillStyle = active.freeze ? '#a5d8ff' : scared ? (frightMs < 1800 && Math.floor(t / 120) % 2 ? '#ffffff' : '#3b5bdb') : gh.color;
        ctx.beginPath();
        ctx.arc(cx, top + r, r, Math.PI, 0);
        ctx.lineTo(cx + r, top + c * 0.82);
        for (let i = 0; i < 3; i++) ctx.lineTo(cx + r - (i + 0.5) * (2 * r / 3), top + c * (i % 2 ? 0.82 : 0.7));
        ctx.lineTo(cx - r, top + c * 0.82);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - r * 0.38, top + r * 0.9, r * 0.28, 0, 7); ctx.arc(cx + r * 0.38, top + r * 0.9, r * 0.28, 0, 7); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(cx - r * 0.38 + gh.dir[0] * r * 0.12, top + r * 0.9 + gh.dir[1] * r * 0.12, r * 0.13, 0, 7);
        ctx.arc(cx + r * 0.38 + gh.dir[0] * r * 0.12, top + r * 0.9 + gh.dir[1] * r * 0.12, r * 0.13, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    };
    g.rows = rows; g.cols = cols;
    g.hint = 'Eat every contribution. Big dots let you eat the ghosts. Grab power-ups: ⚡ speed, ❄ freeze, 🧲 magnet, ×2 points, ♥ life. ' + (touch() ? 'Use the buttons or swipe to move.' : 'Arrows / WASD to move.');
    return g;
  }

  /* ── Space shooter ── */
  function shooter(src) {
    const { cols, grid, rgb } = src, rows = 18, SHIP_Y = rows - 1.4;
    const enemies = new Map(); // key c*100+r → { c, r, hp, max }
    grid.forEach((col, c) => col.forEach((lv, r) => { if (lv) enemies.set(c * 100 + r, { c, r, hp: lv, max: lv }); }));
    const total = enemies.size;
    const stars = Array.from({ length: Math.floor(cols * 1.5) }, () => ({ x: Math.random() * cols, y: Math.random() * rows, s: Math.random() }));
    const ship = { x: cols / 2 };
    let bullets = [], bombs = [], parts = [], drop = 0, dropTimer = 0, cooldown = 0, inv = 0;
    const g = { kind: 'shooter', state: 'ready', score: 0, lives: 3 };

    function burst(x, y, color, n = 8) {
      for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02, life: 500, color });
    }
    function hit(e) {
      e.hp--;
      if (e.hp <= 0) {
        enemies.delete(e.c * 100 + e.r);
        g.score += e.max * 10;
        burst(e.c + 0.5, e.r + drop + 0.5, `rgb(${rgb})`, 10);
        sfx('success');
        hud(g.score, g.lives);
        if (!enemies.size) endGame(true);
      } else { burst(e.c + 0.5, e.r + drop + 0.5, `rgba(${rgb},0.6)`, 3); sfx('key'); }
    }

    g.update = dt => {
      // Formation creeps down; faster as it thins out
      dropTimer += dt;
      const dropEvery = 7000 - 3500 * (1 - enemies.size / total);
      if (dropTimer > dropEvery) { dropTimer = 0; drop++; }
      let lowest = 0;
      enemies.forEach(e => { lowest = Math.max(lowest, e.r + drop); });
      if (lowest >= SHIP_Y - 1) return endGame(false);

      ship.x = Math.min(cols - 0.5, Math.max(0.5, ship.x + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * dt * 0.02));
      cooldown -= dt; inv -= dt;
      if (keys.fire && cooldown <= 0) { bullets.push({ x: ship.x, y: SHIP_Y - 0.6 }); cooldown = 190; sfx('hover'); }

      bullets = bullets.filter(b => {
        const from = b.y; b.y -= dt * 0.032;
        for (let y = Math.floor(from); y >= Math.floor(b.y); y--) {
          const e = enemies.get(Math.floor(b.x) * 100 + (y - drop));
          if (e) { hit(e); return false; }
        }
        return b.y > -1;
      });

      // Bottom-most enemy in a random column fires now and then
      if (Math.random() < dt * 0.0011 * (1 + 2 * (1 - enemies.size / total)) && enemies.size) {
        const list = [...enemies.values()], pick = list[Math.floor(Math.random() * list.length)];
        let bottom = pick;
        enemies.forEach(e => { if (e.c === pick.c && e.r > bottom.r) bottom = e; });
        bombs.push({ x: bottom.c + 0.5, y: bottom.r + drop + 1 });
      }
      bombs = bombs.filter(b => {
        b.y += dt * 0.011;
        if (inv <= 0 && b.y > SHIP_Y - 0.5 && b.y < SHIP_Y + 0.6 && Math.abs(b.x - ship.x) < 0.7) {
          g.lives--; inv = 1500; sfx('error');
          burst(ship.x, SHIP_Y, '#ffd23f', 14);
          hud(g.score, g.lives);
          if (g.lives <= 0) endGame(false);
          return false;
        }
        return b.y < rows + 1;
      });
      parts = parts.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; return p.life > 0; });
      stars.forEach(s => { s.y += dt * 0.0012 * (0.5 + s.s); if (s.y > rows) { s.y = 0; s.x = Math.random() * cols; } });
    };

    g.draw = t => {
      const c = view.cell;
      camera(ship.x, cols);
      ctx.clearRect(0, 0, view.viewW, view.viewH);
      ctx.save(); ctx.translate(-Math.round(view.camX), 0);
      stars.forEach(s => { ctx.fillStyle = `rgba(${themeRGB.fg},${0.15 + 0.35 * s.s})`; ctx.fillRect(s.x * c, s.y * c, 1.5, 1.5); });
      enemies.forEach(e => {
        const x = e.c * c, y = (e.r + drop) * c;
        ctx.fillStyle = `rgba(${rgb},${0.3 + 0.17 * e.hp})`;
        ctx.fillRect(x + 1.5, y + 1.5, c - 3, c - 3);
        if (e.hp < e.max) { ctx.strokeStyle = `rgba(${themeRGB.fg},0.35)`; ctx.strokeRect(x + 2, y + 2, c - 4, c - 4); }
      });
      ctx.fillStyle = `rgb(${themeRGB.accent})`;
      bullets.forEach(b => ctx.fillRect(b.x * c - 1.5, b.y * c, 3, c * 0.6));
      ctx.fillStyle = `rgb(${themeRGB.accent2})`;
      bombs.forEach(b => { ctx.beginPath(); ctx.arc(b.x * c, b.y * c, c * 0.16, 0, 7); ctx.fill(); });
      parts.forEach(p => { ctx.globalAlpha = p.life / 500; ctx.fillStyle = p.color; ctx.fillRect(p.x * c - 2, p.y * c - 2, 4, 4); });
      ctx.globalAlpha = inv > 0 && Math.floor(t / 100) % 2 ? 0.3 : 1;
      // Ship with a flickering flame
      const sx = ship.x * c, sy = SHIP_Y * c;
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath(); ctx.moveTo(sx - c * 0.18, sy + c * 0.45); ctx.lineTo(sx, sy + c * (0.7 + 0.2 * Math.random())); ctx.lineTo(sx + c * 0.18, sy + c * 0.45); ctx.fill();
      ctx.fillStyle = `rgb(${themeRGB.accent})`;
      ctx.beginPath(); ctx.moveTo(sx, sy - c * 0.6); ctx.lineTo(sx + c * 0.55, sy + c * 0.45); ctx.lineTo(sx, sy + c * 0.2); ctx.lineTo(sx - c * 0.55, sy + c * 0.45); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    };
    g.rows = rows; g.cols = cols;
    g.hint = 'Destroy every submission before they reach you. Brighter blocks take more hits. ' + (touch() ? 'Hold FIRE and use the arrows.' : '← → / A D to move, Space to shoot.');
    return g;
  }

  /* ── Lifecycle ── */
  const TITLES = { pacman: 'Pac-Man · GitHub contributions', shooter: 'Space Shooter · LeetCode submissions' };
  function newGame(kind) {
    const src = gridFrom($(SOURCES[kind]));
    game = kind === 'pacman' ? pacman(src) : shooter(src);
    fit(game.cols, game.rows);
    view.camX = 0;
    Object.keys(keys).forEach(k => { keys[k] = false; });
    hud(0, 3);
    $('gamePower').textContent = '';
    $('gameBest').textContent = store.get(kind + '-best', 0);
    $('gameTitle').textContent = TITLES[kind];
    $('gameHint').textContent = game.hint;
    pad.innerHTML = kind === 'pacman'
      ? '<button data-dir="up" aria-label="Up">▲</button><button data-dir="left" aria-label="Left">◀</button><button data-dir="down" aria-label="Down">▼</button><button data-dir="right" aria-label="Right">▶</button>'
      : '<button data-key="left" aria-label="Move left">◀</button><button data-key="fire" class="fire" aria-label="Fire">FIRE</button><button data-key="right" aria-label="Move right">▶</button>';
    pad.className = 'game-pad ' + kind;
    message(`<b>${kind === 'pacman' ? 'Ready?' : 'Incoming!'}</b><span class="game-msg-sub">${touch() ? 'Tap to start' : 'Press any arrow key or Space to start'}</span>`);
  }
  function start() {
    if (!game || game.state !== 'ready') return;
    game.state = 'play'; message('');
  }

  async function open(kind) {
    let el = $(SOURCES[kind]);
    if (!el._heat) {
      // Graph not loaded yet (it loads when Activity is near): bring it into view and wait
      scrollToSection('activity');
      for (let i = 0; i < 50 && !el._heat; i++) await new Promise(r => setTimeout(r, 200));
      if (!el._heat) { flash('Graph is still loading, try again in a moment.'); return; }
    }
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    newGame(kind);
    canvas.focus();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    sfx('open');
  }
  function close() {
    if (!overlay.classList.contains('open')) return;
    if (game && game.state === 'play') saveBest(game.kind, game.score);
    cancelAnimationFrame(raf);
    game = null;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    lastFocus?.focus?.();
  }
  function loop(t) {
    const dt = Math.min(50, t - last); last = t;
    if (game) {
      if (game.state === 'play' && !document.hidden) game.update(dt);
      game.draw(t);
    }
    raf = requestAnimationFrame(loop);
  }
  window.playHeatmapGame = open;

  /* ── Input ── */
  const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', ' ': 'fire' };
  // Capture phase so the terminal, palette and Konami listeners don't see game keys
  addEventListener('keydown', e => {
    if (!overlay.classList.contains('open') || !game) return;
    e.stopImmediatePropagation();
    const k = KEYMAP[e.key.toLowerCase()];
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' && (game.state === 'over' || game.state === 'win')) { e.preventDefault(); newGame(game.kind); return; }
    if (e.key === 'Tab') return;
    if (!k) return;
    e.preventDefault();
    start();
    if (game.kind === 'pacman' && DIR[k]) game.input(DIR[k]);
    keys[k] = true;
  }, true);
  addEventListener('keyup', e => {
    const k = KEYMAP[e.key.toLowerCase()];
    if (k) keys[k] = false;
  }, true);

  // Touch: on-screen pad, tap to start/restart, swipe to steer Pac-Man
  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('button');
    if (!b || !game) return;
    e.preventDefault();
    start();
    if (b.dataset.dir) game.input?.(DIR[b.dataset.dir]);
    if (b.dataset.key) { keys[b.dataset.key] = true; b.setPointerCapture(e.pointerId); }
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => pad.addEventListener(type, e => {
    const b = e.target.closest('button');
    if (b?.dataset.key) keys[b.dataset.key] = false;
  }));
  let swipe = null;
  $('gameStage').addEventListener('pointerdown', e => {
    if (!game) return;
    if (game.state === 'over' || game.state === 'win') { newGame(game.kind); return; }
    start();
    swipe = { x: e.clientX, y: e.clientY };
  });
  $('gameStage').addEventListener('pointerup', e => {
    if (!swipe || !game?.input) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    game.input(Math.abs(dx) > Math.abs(dy) ? DIR[dx > 0 ? 'right' : 'left'] : DIR[dy > 0 ? 'down' : 'up']);
  });

  $('gameClose').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  addEventListener('resize', () => { if (game) fit(game.cols, game.rows); });

  // Click a graph (or its Play button) to start the matching game
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-play]');
    if (btn) { open(btn.dataset.play); return; }
    if (e.target.closest('#heatmap')) open('pacman');
    else if (e.target.closest('#lcHeatmap')) open('shooter');
  });
})();
