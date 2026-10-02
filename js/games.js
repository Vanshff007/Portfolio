/* ── Terminal games: snake and a typing speed test ── */
window.GAMES = {
  snake(t) {
    const W = 24, H = 14, CELL = 16;
    const best = store.get('snake-best', 0);
    t.print(`<span class="hl">SNAKE</span> — arrows/WASD to move, Esc to quit. Best: ${best}`);
    const wrap = t.print('', 'out game');
    const canvas = document.createElement('canvas');
    canvas.width = W * CELL; canvas.height = H * CELL;
    canvas.className = 'game-canvas';
    wrap.appendChild(canvas);
    const scoreLine = t.print('score: 0');
    const ctx = canvas.getContext('2d');
    // Touch: swipe on the canvas
    let touch = null;
    canvas.addEventListener('touchstart', e => { touch = e.touches[0]; }, { passive: true });
    canvas.addEventListener('touchend', e => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.clientX, dy = e.changedTouches[0].clientY - touch.clientY;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? [1, 0] : [-1, 0]) : (dy > 0 ? [0, 1] : [0, -1]));
    });

    let snake = [[6, 7], [5, 7], [4, 7]], dir = [1, 0], queue = [], food = spawn(), score = 0, timer, over = false;
    function spawn() {
      let f;
      do f = [Math.floor(Math.random() * W), Math.floor(Math.random() * H)];
      while (snake?.some(s => s[0] === f[0] && s[1] === f[1]));
      return f;
    }
    function turn(d) {
      const last = queue[queue.length - 1] || dir;
      if (d[0] !== -last[0] || d[1] !== -last[1]) queue.push(d);
    }
    function draw() {
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--term-bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = `rgba(${themeRGB.fg},0.04)`;
      for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H * CELL); ctx.stroke(); }
      for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W * CELL, y * CELL); ctx.stroke(); }
      ctx.fillStyle = `rgb(${themeRGB.accent2})`;
      ctx.fillRect(food[0] * CELL + 3, food[1] * CELL + 3, CELL - 6, CELL - 6);
      snake.forEach((s, i) => {
        ctx.fillStyle = `rgba(${themeRGB.accent},${1 - i / (snake.length + 4)})`;
        ctx.fillRect(s[0] * CELL + 1, s[1] * CELL + 1, CELL - 2, CELL - 2);
      });
    }
    function step() {
      if (queue.length) dir = queue.shift();
      const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
      if (head[0] < 0 || head[1] < 0 || head[0] >= W || head[1] >= H || snake.some(s => s[0] === head[0] && s[1] === head[1])) return end();
      snake.unshift(head);
      if (head[0] === food[0] && head[1] === food[1]) {
        score++; food = spawn(); sfx('success');
        scoreLine.textContent = 'score: ' + score;
        clearInterval(timer); timer = setInterval(step, Math.max(55, 130 - score * 4));
      } else snake.pop();
      draw();
    }
    function end() {
      if (over) return;
      over = true;
      clearInterval(timer);
      sfx('error');
      const newBest = score > best;
      if (newBest) store.set('snake-best', score);
      t.print(`<span class="${newBest ? 'hl' : 'err'}">Game over.</span> Score: ${score}${newBest ? ' — new best! 🏆' : ''}. Type <span class="hl">snake</span> to play again.`);
      program.stop();
    }
    const program = {
      key(e) {
        const k = e.key.toLowerCase();
        const map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
        if (map[k]) turn(map[k]); else return false;
      },
      stop() { clearInterval(timer); if (!over) { over = true; t.print(`Quit. Score: ${score}.`); } },
    };
    t.run(program);
    draw();
    timer = setInterval(step, 130);
  },

  typing(t) {
    const SENTENCES = [
      'real-time apps need the server to be the single source of truth',
      'first make it work then make it right then make it fast',
      'socket events fan out to every client in the room',
      'a good commit message explains why not what',
      'binary search cuts the problem in half on every step',
      'cache the response and respect the rate limit',
    ];
    const text = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    const best = store.get('typing-best', 0);
    t.print(`<span class="hl">TYPING TEST</span> — type the line below. Timer starts on your first key. Esc to quit. Best: ${best} WPM`);
    const line = t.print('', 'out typing-line');
    const stats = t.print('wpm: –  accuracy: –');
    let typed = '', start = 0, errors = 0, done = false;
    function render() {
      line.innerHTML = [...text].map((ch, i) => {
        if (i < typed.length) return `<span class="${typed[i] === ch ? 'ok' : 'bad'}">${esc(ch)}</span>`;
        return `<span class="${i === typed.length ? 'cur' : 'todo'}">${esc(ch)}</span>`;
      }).join('');
      if (start) {
        const mins = (Date.now() - start) / 60000;
        const correct = [...typed].filter((c, i) => c === text[i]).length;
        stats.textContent = `wpm: ${Math.round(correct / 5 / Math.max(mins, 1 / 60))}  accuracy: ${Math.round(100 * (1 - errors / Math.max(1, typed.length + errors)))}%`;
      }
    }
    const program = {
      key(e) {
        if (done || e.ctrlKey || e.metaKey) return false;
        if (e.key === 'Backspace') { typed = typed.slice(0, -1); render(); return; }
        if (e.key.length !== 1) return false;
        if (!start) start = Date.now();
        sfx('key');
        if (e.key !== text[typed.length]) errors++;
        typed += e.key;
        render();
        if (typed.length >= text.length) finish();
      },
      stop() { if (!done) { done = true; t.print('Quit.'); } },
    };
    function finish() {
      done = true;
      const mins = (Date.now() - start) / 60000;
      const correct = [...typed].filter((c, i) => c === text[i]).length;
      const wpm = Math.round(correct / 5 / mins);
      const acc = Math.round(100 * correct / text.length);
      const newBest = acc >= 90 && wpm > best;
      if (newBest) store.set('typing-best', wpm);
      t.print(`<span class="hl">${wpm} WPM</span> at ${acc}% accuracy.${newBest ? ' New best! 🏆' : acc < 90 ? ' (best only counts at 90%+ accuracy)' : ''} Type <span class="hl">typing</span> to go again.`);
      sfx('success');
      program.stop();
    }
    t.run(program);
    render();
  },
};
