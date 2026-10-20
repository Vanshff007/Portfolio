/* ── One-page summary (#brief) and the recruiter view ────────────
   The recruiter view hides the hero, games and effects and puts this
   summary first. Printing the page prints only this summary (see the
   print styles in features.css). The <head> script applies the saved
   view before first paint; this file builds the summary and the toggle.
────────────────────────────────────────────────────────────────── */
(function () {
  const root = document.documentElement;
  const body = document.getElementById('briefBody');
  const repoURL = name => `https://github.com/${GH_USER}/${name}`;
  const short = url => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  function projectsHTML() {
    return FEATURED_ORDER.slice(0, 3).map(name => {
      const info = PROJECT_INFO[name] || {};
      const live = PROJECTS.find(p => p.name === name);
      const demo = live?.demo;
      return `
        <li class="brief-project">
          <div class="brief-project-head"><b>${esc(info.title || name)}</b><span>${esc((info.tech || []).slice(0, 5).join(' · '))}</span></div>
          <p>${esc(info.desc || live?.desc || '')}</p>
          <div class="brief-project-links">
            ${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener noreferrer">Live demo</a>` : ''}
            <a href="${esc(repoURL(name))}" target="_blank" rel="noopener noreferrer">Source</a>
            <button type="button" class="link-btn" data-case="${esc(name)}">Case study</button>
          </div>
        </li>`;
    }).join('');
  }

  function render() {
    const contacts = [
      ['Email', `mailto:${SITE.email}`, SITE.email],
      ['LinkedIn', SITE.links.linkedin, short(SITE.links.linkedin)],
      ['GitHub', SITE.links.github, short(SITE.links.github)],
      ['LeetCode', SITE.links.leetcode, short(SITE.links.leetcode)],
    ];
    body.innerHTML = `
      <header class="brief-head">
        <div>
          <div class="brief-kicker">Recruiter view · one page</div>
          <h2 class="brief-name" id="briefName">${esc(SITE.name)}</h2>
          <p class="brief-role">${esc(BRIEF.role)}</p>
          <p class="brief-pitch">${esc(BRIEF.pitch)}</p>
        </div>
        <div class="brief-actions">
          <a class="btn btn-primary" href="${esc(SITE.resume)}" download="Vansh_Minhas_Resume.pdf" data-resume>Resume ↓</a>
          <a class="btn btn-ghost" href="#contact">Contact</a>
          <button class="btn btn-ghost" type="button" data-view="full">Full site</button>
        </div>
      </header>
      <div class="brief-grid">
        <div class="brief-col">
          <h3>Highlights</h3>
          <dl class="brief-facts">${BRIEF.highlights.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <h3>Skills</h3>
          <dl class="brief-facts">${SKILL_GROUPS.map(g => `<div><dt>${esc(g.name)}</dt><dd>${esc(g.skills.map(s => s[0]).join(', '))}</dd></div>`).join('')}</dl>
        </div>
        <div class="brief-col">
          <h3>Top projects</h3>
          <ul class="brief-projects">${projectsHTML()}</ul>
          <h3>Contact</h3>
          <ul class="brief-contact">${contacts.map(([k, href, label]) => `<li><span>${k}</span><a href="${esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}</a></li>`).join('')}</ul>
        </div>
      </div>`;
  }
  render();
  // Add live demo links once the GitHub data arrives
  document.addEventListener('projects:ready', render);

  const isRecruiter = () => root.classList.contains('recruiter');
  window.setView = function (view) {
    const on = view === 'recruiter';
    // Raw string (not JSON, so not store.set): the <head> script reads it before first paint
    try { localStorage.setItem('view', on ? 'recruiter' : 'full'); } catch {}
    withTransition(() => root.classList.toggle('recruiter', on));
    scrollTo({ top: 0, behavior: 'auto' });
    flash(on ? 'Recruiter view: the short version. "Full site" brings everything back.' : 'Full site. Have fun.');
  };
  window.isRecruiterView = isRecruiter;

  document.addEventListener('click', e => {
    const v = e.target.closest('[data-view="recruiter"], [data-view="full"]');
    if (v) { setView(v.dataset.view); return; }
    const c = e.target.closest('#briefBody [data-case]');
    if (c) {
      // Without GitHub data there is no case study, so go to the repo instead
      if (PROJECTS.some(p => p.name === c.dataset.case)) openProject(c.dataset.case);
      else open(repoURL(c.dataset.case), '_blank', 'noopener');
      return;
    }
    if (e.target.closest('#briefBody [data-resume]')) trackResume();
  });
})();
