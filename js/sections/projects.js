/* ── Projects: live from GitHub ──────────────────────────────────
   Config (GH_USER, PROJECT_INFO, FEATURED_ORDER…) lives in config.js.
   Fires a `projects:ready` event on document once PROJECTS is filled.
────────────────────────────────────────────────────────────────── */
let PROJECTS = [];

(function () {
  const grid   = document.getElementById('projectsGrid');
  const bar    = document.getElementById('filterBar');
  const status = document.getElementById('ghStatus');
  const CACHE_KEY = 'gh-projects-v4', TTL = 60 * 60 * 1000;

  const prettify = name => name.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase());
  const urlIn = text => (text || '').match(/https?:\/\/\S+/)?.[0];

  function toProject(repo, languages) {
    const info = PROJECT_INFO[repo.name] || {};
    const pagesUrl = repo.has_pages ? `https://${GH_USER.toLowerCase()}.github.io/${repo.name}/` : null;
    const demo = repo.homepage || urlIn(repo.description) || pagesUrl;
    const langs = Object.keys(languages || {});
    return {
      name: repo.name,
      title: info.title || prettify(repo.name),
      desc: info.desc || (repo.description || '').replace(/https?:\/\/\S+/g, '').trim() || 'No description yet. Check out the code on GitHub.',
      tech: info.tech || [...langs, ...(repo.topics || [])].slice(0, 6),
      category: info.category || (/Python|Jupyter/.test(repo.language) ? 'AI / ML' : 'Other'),
      language: repo.language,
      stars: repo.stargazers_count,
      updated: repo.pushed_at,
      repoUrl: repo.html_url,
      demo,
    };
  }

  async function fetchProjects() {
    const res = await fetch(`https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=pushed`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(res.status === 403 ? 'GitHub rate limit hit' : 'GitHub API error ' + res.status);
    const repos = (await res.json()).filter(r => !r.fork && !r.archived && r.size > 0 && !GH_EXCLUDE.includes(r.name));
    // Only look up languages for repos without a curated stack, to save API quota
    const list = await Promise.all(repos.map(async r => {
      let langs = null;
      if (!PROJECT_INFO[r.name]?.tech) {
        langs = await fetch(r.languages_url).then(x => x.ok ? x.json() : null).catch(() => null);
      }
      return toProject(r, langs);
    }));
    const rank = n => { const i = FEATURED_ORDER.indexOf(n); return i < 0 ? 999 : i; };
    return list.sort((a, b) => rank(a.name) - rank(b.name) || new Date(b.updated) - new Date(a.updated));
  }

  const isRender = url => /onrender\.com/.test(url || '');
  function demoLinkHTML(p) {
    if (!p.demo) return '';
    return `<a href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer" class="project-link">Live Demo</a>`;
  }

  function cardHTML(p, i) {
    return `
      <div class="project-card card-enter" data-name="${esc(p.name)}" data-category="${esc(p.category)}" style="animation-delay:${Math.min(i, 8) * 0.06}s">
        <div class="project-num">${String(i + 1).padStart(2, '0')} / ${i < 3 ? 'Featured' : esc(p.category)}${p.demo ? ' <span class="status-dot">Live</span>' : ''}</div>
        <div class="project-title">${esc(p.title)}</div>
        <p class="project-desc">${esc(p.desc)}</p>
        <div class="project-tech">${p.tech.map(t => `<span class="tech-chip">${esc(t)}</span>`).join('')}</div>
        <div class="project-meta">
          ${p.language ? `<span class="lang-dot" style="--c:${LANG_COLORS[p.language] || 'var(--muted)'}">${esc(p.language)}</span>` : ''}
          <span>★ ${p.stars}</span>
          <span>updated ${timeAgo(p.updated)}</span>
        </div>
        <div class="project-links">
          ${demoLinkHTML(p)}
          <a href="${esc(p.repoUrl)}" target="_blank" rel="noopener noreferrer" class="project-link gh">Source Code</a>
          <button class="project-link case" type="button">Case study</button>
        </div>
      </div>`;
  }

  function buildFilters() {
    const counts = PROJECTS.reduce((m, p) => (m[p.category] = (m[p.category] || 0) + 1, m), {});
    const cats = ['All', ...Object.keys(counts).sort()];
    bar.innerHTML = cats.map(c => `<button class="filter-btn${c === 'All' ? ' active' : ''}" role="tab" data-cat="${esc(c)}">${esc(c)}<sup>${c === 'All' ? PROJECTS.length : counts[c]}</sup></button>`).join('');
  }
  bar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filterProjects(btn.dataset.cat);
  });

  // Exposed so the skills graph can highlight matching cards
  window.filterProjects = function (cat, names) {
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    const cards = [...grid.querySelectorAll('.project-card')];
    const apply = () => cards.forEach(card => {
      const show = names ? names.includes(card.dataset.name) : cat === 'All' || card.dataset.category === cat;
      card.classList.toggle('hide', !show);
      card.classList.remove('card-enter');
    });
    if (withTransition(apply)) return;
    // No view transitions: replay the entrance, 60ms apart in visible order
    let n = 0;
    cards.filter(card => !card.classList.contains('hide')).forEach(card => {
      card.style.animationDelay = Math.min(n++, 8) * 0.06 + 's';
      void card.offsetWidth;
      card.classList.add('card-enter');
    });
  };

  function render(fromCache) {
    grid.innerHTML = PROJECTS.map(cardHTML).join('');
    grid.querySelectorAll('.project-card').forEach(bindTilt);
    buildFilters();
    status.innerHTML = `● ${PROJECTS.length} repos synced from <a href="https://github.com/${GH_USER}" target="_blank" rel="noopener noreferrer">github.com/${GH_USER}</a>${fromCache ? ' (cached)' : ''}`;
    // Keep the About stat in sync with the real project count
    const stat = document.getElementById('statProjects');
    if (stat) { stat.dataset.count = PROJECTS.length; stat.dataset.suffix = ''; stat.textContent = PROJECTS.length; }
    document.dispatchEvent(new CustomEvent('projects:ready'));
  }

  (async () => {
    const cached = store.get(CACHE_KEY);
    if (cached && Date.now() - cached.t < TTL) { PROJECTS = cached.data; render(true); return; }
    const fallbackHTML = grid.innerHTML;
    grid.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    try {
      PROJECTS = await fetchProjects();
      store.set(CACHE_KEY, { t: Date.now(), data: PROJECTS });
      render(false);
    } catch (err) {
      if (cached) { PROJECTS = cached.data; render(true); return; }
      // No data at all: restore the hand-written cards
      grid.innerHTML = fallbackHTML;
      grid.querySelectorAll('.project-card').forEach(c => { c.classList.add('visible'); bindTilt(c); });
      status.innerHTML = `Couldn't reach GitHub (${esc(err.message)}). <a href="https://github.com/${GH_USER}?tab=repositories" target="_blank" rel="noopener noreferrer">See all repos →</a>`;
    }
  })();

  /* ── Case-study modal ── */
  const modal = document.getElementById('projModal');
  const body  = document.getElementById('modalBody');
  let lastFocus = null;

  // Streamlit apps render client-side, so a screenshot only catches the loading spinner
  const isStreamlit = url => /streamlit\.app/.test(url || '');
  const shotURL = p => p.demo && !isRender(p.demo) && !isStreamlit(p.demo)
    ? `https://api.microlink.io/?url=${encodeURIComponent(p.demo)}&screenshot=true&meta=false&embed=screenshot.url`
    : `https://opengraph.githubassets.com/1/${GH_USER}/${p.name}`;
  const ogURL = p => `https://opengraph.githubassets.com/1/${GH_USER}/${p.name}`;

  window.openProject = function (name) {
    const p = PROJECTS.find(x => x.name === name);
    if (!p) return;
    const info = PROJECT_INFO[name] || {};
    const arch = info.arch || p.tech.slice(0, 4);
    body.innerHTML = `
      <div class="modal-kicker">${esc(p.category)} · ★ ${p.stars} · updated ${timeAgo(p.updated)}</div>
      <h2 class="modal-title" id="modalTitle">${esc(p.title)}</h2>
      <p class="modal-lead">${esc(p.desc)}</p>
      <figure class="modal-shot"><img src="${shotURL(p)}" alt="Screenshot of ${esc(p.title)}" loading="lazy" onerror="this.onerror=null;this.src='${ogURL(p)}'"></figure>
      ${info.problem ? `<h3>The problem</h3><p>${esc(info.problem)}</p>` : ''}
      <h3>Architecture</h3>
      <div class="arch" role="list">${arch.map((a, i) => `${i ? '<span class="arch-arrow" aria-hidden="true">→</span>' : ''}<span class="arch-node" role="listitem" style="--d:${i * 0.08}s">${esc(a)}</span>`).join('')}</div>
      ${info.challenges ? `<h3>Challenges</h3><ul class="modal-list">${info.challenges.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${info.outcome ? `<h3>Outcome</h3><p>${esc(info.outcome)}</p>` : ''}
      <h3>Stack</h3>
      <div class="project-tech">${p.tech.map(t => `<span class="tech-chip">${esc(t)}</span>`).join('')}</div>
      <div class="modal-actions">
        ${p.demo ? `<a class="btn btn-primary" href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer">Live Demo</a>` : ''}
        <a class="btn btn-ghost" href="${esc(p.repoUrl)}" target="_blank" rel="noopener noreferrer">Source Code ↗</a>
      </div>`;
    lastFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    document.getElementById('modalClose').focus();
    sfx('open');
  };
  function closeModal() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    lastFocus?.focus?.();
  }
  window.closeProject = closeModal;
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  grid.addEventListener('click', e => {
    if (e.target.closest('a')) return; // links keep their own behaviour
    const card = e.target.closest('.project-card[data-name]');
    if (card) openProject(card.dataset.name);
  });

  /* ── Hover preview of the live demo ── */
  if (!finePointer) return;
  const prev = document.getElementById('cardPreview');
  const img  = document.getElementById('cardPreviewImg');
  const label = document.getElementById('cardPreviewLabel');
  let current = null;
  grid.addEventListener('mouseover', e => {
    const card = e.target.closest('.project-card[data-name]');
    if (!card || card === current) return;
    current = card;
    const p = PROJECTS.find(x => x.name === card.dataset.name);
    if (!p) return;
    // Fall back to the GitHub card once, then hide the image (GitHub rate-limits it with 429s)
    img.hidden = false;
    img.onerror = () => {
      if (img.src !== ogURL(p)) img.src = ogURL(p);
      else { img.onerror = null; img.hidden = true; }
    };
    img.src = shotURL(p);
    label.textContent = p.demo ? (isRender(p.demo) ? 'Live on Render (may need to wake up)' : 'Live demo preview') : 'Code only, no live demo';
    prev.classList.add('show');
  });
  grid.addEventListener('mousemove', e => {
    if (!current) return;
    const w = 300, h = 210, pad = 18;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth) x = e.clientX - w - pad;
    if (y + h > innerHeight) y = e.clientY - h - pad;
    prev.style.transform = `translate(${x}px, ${y}px)`;
  });
  grid.addEventListener('mouseout', e => {
    if (current && !current.contains(e.relatedTarget)) { current = null; prev.classList.remove('show'); }
  });
})();
