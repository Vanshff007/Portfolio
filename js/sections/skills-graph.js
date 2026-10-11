/* ── Skills: bars / graph toggle and a force-directed skill → project graph ── */
(function () {
  const barsEl  = document.getElementById('skillsBars');
  const wrap    = document.getElementById('skillsGraphWrap');
  const canvas  = document.getElementById('skillsGraph');
  const info    = document.getElementById('graphInfo');
  const ctx     = canvas.getContext('2d');
  const tabs    = document.querySelectorAll('#skills [data-view]');
  let nodes = [], edges = [], W = 0, H = 0, dpr = 1, running = false, visible = false, built = false;
  let selected = null, hover = null, drag = null, alpha = 1;

  tabs.forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
  function setView(view) {
    tabs.forEach(t => { const on = t.dataset.view === view; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    barsEl.hidden = view !== 'bars';
    wrap.hidden = view !== 'graph';
    if (view === 'graph') { if (!built) build(); resize(); alpha = 1; start(); }
  }

  const usesSkill = (p, skill) => {
    const aliases = (SKILL_ALIASES[skill] || [skill]).map(a => a.toLowerCase());
    return p.tech.some(t => aliases.some(a => t.toLowerCase().includes(a)));
  };

  function build() {
    const projects = PROJECTS.length ? PROJECTS : [];
    nodes = []; edges = [];
    SKILL_GROUPS.forEach((g, gi) => g.skills.forEach(([name]) => nodes.push({ id: name, type: 'skill', group: gi, r: 5 })));
    projects.forEach(p => nodes.push({ id: p.name, label: p.title, type: 'project', r: 9 }));
    nodes.forEach(n => {
      if (n.type !== 'skill') return;
      projects.forEach(p => { if (usesSkill(p, n.id)) edges.push([n, nodes.find(x => x.id === p.name)]); });
    });
    nodes.forEach(n => {
      n.deg = edges.filter(e => e[0] === n || e[1] === n).length;
      if (n.type === 'skill') n.r = 4 + Math.min(n.deg, 5) * 1.3;
      n.x = Math.random() * 600; n.y = Math.random() * 400; n.vx = n.vy = 0;
    });
    built = projects.length > 0;
  }
  document.addEventListener('projects:ready', () => { built = false; if (!wrap.hidden) { build(); resize(); alpha = 1; start(); } });

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = wrap.clientWidth; H = Math.max(380, Math.min(560, W * 0.6));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes.forEach(n => { n.x = Math.min(Math.max(n.x, 20), W - 20); n.y = Math.min(Math.max(n.y, 20), H - 20); });
  }
  addEventListener('resize', () => { if (!wrap.hidden) resize(); });

  function tick() {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1;
      const f = 2600 / d2 * alpha;
      const d = Math.sqrt(d2); dx /= d; dy /= d;
      a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
    }
    // Springs along edges
    for (const [a, b] of edges) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 140) * 0.01 * alpha;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const n of nodes) {
      // Gentle pull to the center; projects pulled harder so they sit in the middle
      const k = n.type === 'project' ? 0.004 : n.deg ? 0.0015 : 0.003;
      n.vx += (W / 2 - n.x) * k * alpha; n.vy += (H / 2 - n.y) * k * alpha;
      if (n === drag) { n.vx = n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x = Math.min(Math.max(n.x + n.vx, n.r + 4), W - n.r - 4);
      n.y = Math.min(Math.max(n.y + n.vy, n.r + 4), H - n.r - 4);
    }
    alpha = Math.max(alpha * 0.995, drag ? 0.3 : 0.02);
  }

  const linked = n => n ? new Set(edges.filter(e => e[0] === n || e[1] === n).flatMap(e => e)) : null;
  const GROUP_RGB = () => [themeRGB.accent, themeRGB.accent3, themeRGB.accent2, themeRGB.accent, themeRGB.accent3];

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const focus = selected || hover, near = linked(focus);
    for (const [a, b] of edges) {
      const on = focus && (a === focus || b === focus);
      ctx.strokeStyle = on ? `rgba(${themeRGB.accent},0.75)` : `rgba(${themeRGB.fg},${focus ? 0.04 : 0.1})`;
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const n of nodes) {
      const dim = near && !near.has(n) && n !== focus;
      const rgb = n.type === 'project' ? themeRGB.fg : GROUP_RGB()[n.group];
      ctx.globalAlpha = dim ? 0.18 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (n === focus ? 3 : 0), 0, Math.PI * 2);
      if (n.type === 'project') {
        ctx.fillStyle = `rgba(${themeRGB.accent3},0.25)`; ctx.fill();
        ctx.strokeStyle = `rgb(${themeRGB.accent3})`; ctx.lineWidth = 2; ctx.stroke();
      } else { ctx.fillStyle = `rgb(${rgb})`; ctx.fill(); }
      const showLabel = n.type === 'project' || n === focus || (near && near.has(n)) || (!focus && n.deg >= 2);
      if (showLabel) {
        ctx.fillStyle = n.type === 'project' ? `rgb(${themeRGB.fg})` : `rgba(${themeRGB.fg},0.8)`;
        ctx.font = n.type === 'project' ? 'bold 12px "Syne", sans-serif' : '11px "JetBrains Mono", monospace';
        ctx.fillText(n.label || n.id, n.x, n.y - n.r - 6);
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (!running) return;
    if (!reduceMotion || drag) tick();
    draw();
    requestAnimationFrame(loop);
  }
  function start() {
    if (running || !visible || wrap.hidden) return;
    running = true;
    if (reduceMotion) for (let i = 0; i < 300; i++) tick(); // settle instantly, no animation
    loop();
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else running = false; }).observe(wrap);

  /* ── Interaction ── */
  function pick(e) {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 400;
    for (const n of nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < Math.max(bd, (n.r + 6) ** 2) && d < bd) { best = n; bd = d; } }
    return { node: best, x, y };
  }
  let downAt = null;
  canvas.addEventListener('pointerdown', e => {
    const { node } = pick(e);
    downAt = { x: e.clientX, y: e.clientY, node };
    if (node) { drag = node; canvas.setPointerCapture(e.pointerId); alpha = Math.max(alpha, 0.3); }
  });
  canvas.addEventListener('pointermove', e => {
    const { node, x, y } = pick(e);
    if (drag) { drag.x = x; drag.y = y; return; }
    if (node !== hover) { hover = node; canvas.style.cursor = node ? 'pointer' : 'default'; }
  });
  canvas.addEventListener('pointerup', e => {
    const moved = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5;
    const node = downAt?.node;
    drag = null; downAt = null;
    if (moved) return;
    if (!node) { select(null); return; }
    if (node.type === 'project') openProject(node.id);
    else select(node === selected ? null : node);
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });

  function select(n) {
    selected = n;
    sfx('click');
    if (!n) { info.innerHTML = 'Click a skill node. Drag to move nodes.'; return; }
    const projects = [...(linked(n) || [])].filter(x => x.type === 'project');
    info.innerHTML = projects.length
      ? `<b>${esc(n.id)}</b> is used in ${projects.length} project${projects.length > 1 ? 's' : ''}: ${projects.map(p => esc(p.label)).join(', ')}.
         <button class="graph-show" id="graphShow">Show in Projects →</button>`
      : `<b>${esc(n.id)}</b> — used outside these public repos (coursework, internship, contests).`;
    document.getElementById('graphShow')?.addEventListener('click', () => {
      filterProjects(null, projects.map(p => p.id));
      scrollToSection('projects');
      flash(`Showing projects that use ${n.id}`);
    });
  }

  // Bars view: clicking a skill row also highlights matching projects
  barsEl.addEventListener('click', e => {
    const row = e.target.closest('.skill-item');
    if (!row || !PROJECTS.length) return;
    const names = PROJECTS.filter(p => usesSkill(p, row.dataset.skill)).map(p => p.name);
    if (!names.length) { flash(`${row.dataset.skill}: used outside these public repos`); return; }
    filterProjects(null, names);
    scrollToSection('projects');
    flash(`${names.length} project${names.length > 1 ? 's' : ''} use ${row.dataset.skill}`);
  });
})();
