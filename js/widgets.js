/* ── Live widgets: GitHub activity, LeetCode, "currently", blog, visitors, guestbook ── */

// Small fetch-with-localStorage-cache helper
async function cachedJSON(key, url, ttlMs, opts) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.data;
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    store.set(key, { t: Date.now(), data });
    return data;
  } catch (e) {
    if (hit) return hit.data; // stale beats nothing
    throw e;
  }
}
const apiURL = path => SITE.apiBase ? SITE.apiBase.replace(/\/$/, '') + path : null;
// Run fn once the element is within ~1 screen of the viewport (saves requests on first load)
function whenNear(id, fn) {
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: '900px 0px' })
    .observe(document.getElementById(id));
}

/* ── Recent commits (GitHub commit search; also used by `git log` in the terminal) ── */
let commitsPromise = null;
function getRecentCommits() {
  commitsPromise = commitsPromise || cachedJSON('gh-commits-v1',
    `https://api.github.com/search/commits?q=author:${GH_USER}&sort=author-date&order=desc&per_page=20`, 30 * 60 * 1000,
    { headers: { Accept: 'application/vnd.github+json' } })
    .then(d => (d.items || []).map(i => ({ sha: i.sha, repo: i.repository.name, message: i.commit.message, date: i.commit.author.date, url: i.html_url })))
    .catch(e => { commitsPromise = null; throw e; });
  return commitsPromise;
}

/* ── Contribution heatmap shared by GitHub and LeetCode ──
   days: [{ date: 'YYYY-MM-DD', count, level 0-4 }], oldest first. Returns stats. */
function drawHeatmap(el, days, noun) {
  const offset = new Date(days[0].date + 'T00:00:00').getDay(); // align first column to Sunday
  el.innerHTML = '<i class="pad"></i>'.repeat(offset) + days.map(c =>
    `<i class="l${c.level}" title="${c.count} ${noun}${c.count === 1 ? '' : 's'} on ${new Date(c.date + 'T00:00:00').toDateString()}"></i>`).join('');
  el.parentElement.scrollLeft = el.parentElement.scrollWidth; // newest on the right, visible on phones
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count) streak++;
    else if (i < days.length - 1) break; // today may still be empty
  }
  let longest = 0, run = 0;
  for (const c of days) { run = c.count ? run + 1 : 0; longest = Math.max(longest, run); }
  return { total: days.reduce((a, c) => a + c.count, 0), active: days.filter(c => c.count).length, streak, longest };
}

/* ── GitHub panel: heatmap, languages, latest commits ── */
whenNear('activity', function () {
  const heat = document.getElementById('heatmap');
  const total = document.getElementById('heatTotal');

  cachedJSON('gh-contrib-v1', `https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`, 6 * 3600 * 1000)
    .then(d => {
      const { active, streak } = drawHeatmap(heat, d.contributions, 'contribution');
      total.innerHTML = `<b>${d.total.lastYear}</b> contributions in the last year · <b>${active}</b> active days · <b>${streak}</b>-day streak`;
    })
    .catch(() => { total.textContent = 'Contribution graph unavailable right now.'; heat.parentElement.hidden = true; });

  function renderLangs() {
    const counts = {};
    PROJECTS.forEach(p => { if (p.language) counts[p.language] = (counts[p.language] || 0) + 1; });
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!sum) return;
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    document.getElementById('langBar').innerHTML = rows.map(([l, n]) =>
      `<span style="flex:${n};background:${LANG_COLORS[l] || 'var(--muted)'}" title="${esc(l)}"></span>`).join('');
    document.getElementById('langList').innerHTML = rows.map(([l, n]) =>
      `<li><span class="lang-dot" style="--c:${LANG_COLORS[l] || 'var(--muted)'}">${esc(l)}</span><b>${Math.round(100 * n / sum)}%</b></li>`).join('');
  }
  if (PROJECTS.length) renderLangs();
  document.addEventListener('projects:ready', renderLangs);

  const list = document.getElementById('commitList');
  getRecentCommits()
    .then(commits => {
      list.innerHTML = commits.slice(0, 6).map(c => `
        <li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">
          <span class="commit-msg">${esc(c.message.split('\n')[0])}</span>
          <span class="commit-meta"><code>${esc(c.sha.slice(0, 7))}</code> ${esc(c.repo)} · ${timeAgo(c.date)}</span>
        </a></li>`).join('') || '<li class="muted">No recent public commits.</li>';
    })
    .catch(() => { list.innerHTML = '<li class="muted">Commits unavailable (GitHub rate limit). Try again later.</li>'; });
});

/* ── LeetCode card ── */
whenNear('activity', function () {
  const $ = id => document.getElementById(id);
  async function load() {
    const server = apiURL('/api/leetcode');
    if (server) {
      try { return await cachedJSON('lc-stats-v2', server, 3 * 3600 * 1000); } catch {}
    }
    // Public fallback API (no streak data)
    const base = `https://alfa-leetcode-api.onrender.com/${SITE.leetcodeUser}`;
    return cachedJSON('lc-stats-fallback-v1', base + '/solved', 6 * 3600 * 1000).then(async s => {
      const c = await cachedJSON('lc-contest-fallback-v1', base + '/contest', 6 * 3600 * 1000).catch(() => ({}));
      const cal = await cachedJSON('lc-calendar-fallback-v1', base + '/calendar', 6 * 3600 * 1000).catch(() => null);
      const calendar = cal && Object.fromEntries(Object.entries(JSON.parse(cal.submissionCalendar || '{}'))
        .map(([t, n]) => [new Date(t * 1000).toISOString().slice(0, 10), n]));
      return { total: s.solvedProblem, easy: s.easySolved, medium: s.mediumSolved, hard: s.hardSolved,
               rating: c.contestRating, topPercentage: c.contestTopPercentage, streak: cal?.streak ?? null, calendar };
    });
  }
  function ring(el, start, frac) {
    const C = 2 * Math.PI * 50;
    el.style.strokeDasharray = `${Math.max(0, frac * C - 3)} ${C}`;
    el.style.strokeDashoffset = -start * C;
  }
  function countTo(el, n) {
    if (reduceMotion || !n) { el.textContent = n ?? '–'; return; }
    el.dataset.count = n; el.dataset.suffix = ''; countUp(el);
  }
  // Both APIs down (the public one rate-limits): show the last known numbers from config
  load().catch(() => SITE.leetcodeFallback).then(d => {
    window.LC_STATS = d;
    const sum = d.easy + d.medium + d.hard || 1;
    ring($('ringEasy'), 0, d.easy / sum);
    ring($('ringMed'), d.easy / sum, d.medium / sum);
    ring($('ringHard'), (d.easy + d.medium) / sum, d.hard / sum);
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      $('lcPanel').classList.add('ring-in');
      countTo($('lcTotal'), d.total); countTo($('lcEasy'), d.easy); countTo($('lcMed'), d.medium); countTo($('lcHard'), d.hard);
      countTo($('lcRating'), d.rating ? Math.round(d.rating) : null);
    }, { threshold: 0.3 });
    obs.observe($('lcPanel'));
    $('lcTop').textContent = d.topPercentage ? d.topPercentage.toFixed(1) + '%' : '–';
    $('lcStreak').textContent = d.streak ?? '–';
    if (d.streak == null) $('lcStreak').parentElement.hidden = true;
    drawLeetCodeHeatmap(d.calendar);
  });

  // Last 365 days ending today (UTC, matching LeetCode's day boundaries)
  function drawLeetCodeHeatmap(calendar) {
    const el = $('lcHeatmap'), label = $('lcHeatTotal');
    if (!calendar) { label.textContent = 'Submission graph unavailable right now.'; el.parentElement.hidden = true; return; }
    const max = Math.max(1, ...Object.values(calendar));
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const days = Array.from({ length: 365 }, (_, i) => {
      const date = new Date(today - (364 - i) * 86400000).toISOString().slice(0, 10);
      const count = calendar[date] || 0;
      return { date, count, level: !count ? 0 : Math.min(4, Math.ceil(4 * count / max)) };
    });
    const { total, active, streak, longest } = drawHeatmap(el, days, 'submission');
    label.innerHTML = `<b>${total}</b> submissions in the last year · <b>${active}</b> active days · ` +
      (streak ? `<b>${streak}</b>-day streak · ` : '') + `longest streak <b>${longest}</b> days`;
  }
});

/* ── "Currently" widget + Spotify now playing ── */
(function () {
  const icons = { building: '⚒', learning: '◆', reading: '❏', grinding: '⚡' };
  document.getElementById('nowList').innerHTML = Object.entries(SITE.now).map(([k, v]) =>
    `<li><span class="now-k">${icons[k] || '•'} ${esc(k)}</span><span class="now-v">${esc(v)}</span></li>`).join('');

  const url = apiURL('/api/now-playing');
  if (!url) return;
  const box = document.getElementById('spotify');
  async function poll() {
    try {
      const r = await fetch(url);
      const d = await r.json();
      if (!d.configured) return;
      box.hidden = false;
      box.innerHTML = d.title ? `
        ${d.albumArt ? `<img src="${esc(d.albumArt)}" alt="" width="44" height="44">` : ''}
        <div><span class="now-k">${d.playing ? '<span class="eq"><i></i><i></i><i></i></span> listening to' : '♫ last played'}</span>
        <a class="now-v" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a>
        <span class="spot-artist">${esc(d.artist)}</span></div>` : '<span class="now-k">♫ not listening right now</span>';
      setTimeout(poll, d.playing ? 30000 : 120000);
    } catch { box.hidden = true; }
  }
  poll();
})();

/* ── Writing: latest Dev.to posts ── */
(function () {
  if (!SITE.devtoUser) return;
  const section = document.getElementById('writing');
  cachedJSON('devto-v1', `https://dev.to/api/articles?username=${encodeURIComponent(SITE.devtoUser)}&per_page=6`, 3 * 3600 * 1000)
    .then(posts => {
      if (!posts.length) return;
      document.getElementById('postsGrid').innerHTML = posts.map((p, i) => `
        <a class="post-card reveal" style="transition-delay:${i * 0.08}s" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
          <div class="post-meta">${esc(p.readable_publish_date)} · ${p.reading_time_minutes} min read</div>
          <h3 class="post-title">${esc(p.title)}</h3>
          <p class="post-desc">${esc(p.description)}</p>
          <div class="post-foot"><span>${p.tag_list.slice(0, 3).map(t => '#' + esc(t)).join(' ')}</span><span>♥ ${p.public_reactions_count} · 💬 ${p.comments_count}</span></div>
        </a>`).join('');
      section.hidden = false;
      observeReveal(section);
      if (!document.querySelector('#navLinks a[href="#writing"]')) {
        document.querySelector('#navLinks a[href="#skills"]').parentElement.insertAdjacentHTML('afterend', '<li><a href="#writing">Writing</a></li>');
      }
    })
    .catch(() => {});
})();

/* ── Visitor counter (counts once per browser session) ── */
(function () {
  let counted = false;
  try { counted = sessionStorage.getItem('visit-counted') === '1'; } catch {}
  const url = `https://abacus.jasoncameron.dev/${counted ? 'get' : 'hit'}/${SITE.counterNamespace}/visits`;
  fetch(url).then(r => r.json()).then(d => {
    if (typeof d.value !== 'number') return;
    try { sessionStorage.setItem('visit-counted', '1'); } catch {}
    window.VISITS = d.value.toLocaleString();
    document.getElementById('footVisits').textContent = `${window.VISITS} visits`;
    const el = document.getElementById('visitNum');
    el.dataset.count = d.value; el.dataset.suffix = '';
    el.textContent = window.VISITS;
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); countUp(el); } }).observe(el);
  }).catch(() => {});
})();

/* ── Guestbook (giscus), loaded only when the section is near the viewport ── */
(function () {
  const box = document.getElementById('giscusBox');
  const g = SITE.giscus;
  const giscusTheme = () => ({ light: 'light', dracula: 'dark_dimmed', matrix: 'dark_high_contrast', sunset: 'transparent_dark' }[currentTheme()] || 'transparent_dark');
  if (!g.repoId || !g.categoryId) {
    box.innerHTML = `<div class="giscus-setup"><b>Guestbook almost ready.</b> Enable Discussions on the repo, install the giscus app, then add <code>repoId</code> and <code>categoryId</code> to <code>SITE.giscus</code> in <code>js/config.js</code>.</div>`;
    return;
  }
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    o.disconnect();
    const s = document.createElement('script');
    Object.entries({
      src: 'https://giscus.app/client.js', 'data-repo': g.repo, 'data-repo-id': g.repoId, 'data-category': g.category,
      'data-category-id': g.categoryId, 'data-mapping': 'specific', 'data-term': 'Guestbook', 'data-strict': '1',
      'data-reactions-enabled': '1', 'data-emit-metadata': '0', 'data-input-position': 'top', 'data-theme': giscusTheme(),
      'data-lang': 'en', 'data-loading': 'lazy', crossorigin: 'anonymous', async: '',
    }).forEach(([k, v]) => s.setAttribute(k, v));
    box.appendChild(s);
  }, { rootMargin: '400px' }).observe(box);
  document.addEventListener('themechange', () => {
    box.querySelector('iframe.giscus-frame')?.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
  });
})();

/* ── Lighthouse badge in the footer ── */
(function () {
  const s = SITE.lighthouse;
  const vals = [s.performance, s.accessibility, s.bestPractices, s.seo];
  if (!vals.some(Boolean)) return;
  const badge = document.getElementById('lhBadge');
  const names = ['Performance', 'Accessibility', 'Best Practices', 'SEO'];
  badge.innerHTML = '<span class="lh-label">Lighthouse</span>' + vals.map((v, i) =>
    `<span class="lh-score ${v >= 90 ? 'good' : v >= 50 ? 'ok' : 'bad'}" title="${names[i]}: ${v}">${v}</span>`).join('');
  badge.hidden = false;
})();
