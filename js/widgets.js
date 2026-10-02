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
  el._heat = { days, offset }; // read by the heatmap games
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

/* ── "Currently" widget ── */
(function () {
  const icons = { building: '⚒', learning: '◆', reading: '❏', grinding: '⚡' };
  document.getElementById('nowList').innerHTML = Object.entries(SITE.now).map(([k, v]) =>
    `<li><span class="now-k">${icons[k] || '•'} ${esc(k)}</span><span class="now-v">${esc(v)}</span></li>`).join('');
})();

/* ── Spotify player ──────────────────────────────────────────────
   Songs come from my public playlist (server /api/playlist), played through
   Spotify's official embed. It tries to start as soon as the page has loaded;
   most browsers block sound until the visitor interacts, so if that is blocked
   it starts on their first click, tap or key press anywhere on the page.
   SITE.firstSong plays first, then the rest in random order. The embed lives in a
   floating mini player (Spotify only loads embeds that are on screen), so it
   can be paused from anywhere; if the visitor pauses or closes it, it won't
   autostart again this visit. Logged-out visitors hear 30-second previews.
────────────────────────────────────────────────────────────────── */
(function () {
  const url = apiURL('/api/playlist');
  if (!url) return;
  const box = document.getElementById('spotify');
  const mini = document.getElementById('miniPlayer');
  let tracks = [], queue = [], current = null, controller = null, embedLoading = null;
  let playing = false, wantPlay = false, ended = false, announced = false;
  const OFF_KEY = 'music-off';
  const isOff = () => { try { return sessionStorage.getItem(OFF_KEY) === '1'; } catch { return false; } };
  const setOff = v => { try { v ? sessionStorage.setItem(OFF_KEY, '1') : sessionStorage.removeItem(OFF_KEY); } catch {} };

  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  // First song is fixed; after that, a shuffled order with no repeats until all have played
  function nextTrack() {
    if (!current) {
      const first = tracks.find(t => norm(t.title) === norm(SITE.firstSong || ''));
      if (first) return first;
    }
    if (!queue.length) {
      queue = tracks.filter(t => t !== current).sort(() => Math.random() - 0.5);
      if (!queue.length) queue = tracks.slice();
    }
    return queue.shift();
  }

  function show(t) {
    current = t;
    document.getElementById('plTitle').textContent = t.title;
    document.getElementById('plArtist').textContent = t.artist;
  }
  function setPlaying(v) {
    playing = v;
    document.getElementById('plPlay').innerHTML = v ? '⏸ Pause' : '▶ Play';
    if (v && !announced) {
      announced = true;
      flash(`🎧 Playing "${current.title}" from my playlist. Pause anytime, bottom left.`);
    }
  }

  function loadEmbedAPI() {
    return new Promise(resolve => {
      if (window.SpotifyIframeApi) return resolve(window.SpotifyIframeApi);
      window.onSpotifyIframeApiReady = api => { window.SpotifyIframeApi = api; resolve(api); };
      const s = document.createElement('script');
      s.src = 'https://open.spotify.com/embed/iframe-api/v1';
      s.async = true;
      document.head.appendChild(s);
    });
  }
  // The embed is heavy, so it only loads when music is first wanted
  function ensureEmbed() {
    embedLoading = embedLoading || loadEmbedAPI().then(api => new Promise(resolve => {
      api.createController(document.getElementById('plEmbed'), { uri: current.uri, width: '100%', height: 80 }, c => {
        controller = c;
        c.addListener('ready', () => { if (wantPlay) { wantPlay = false; c.play(); } });
        c.addListener('playback_update', e => {
          const { isPaused, isBuffering, position, duration } = e.data;
          if (!isBuffering) {
            // Pausing in Spotify's own button counts too: no autostart again this visit
            if (playing && isPaused && position < duration - 800) setOff(true);
            if (!isPaused) setOff(false);
            setPlaying(!isPaused);
          }
          // A song that reaches its end (full track or 30s preview) moves on to a random one
          if (!ended && duration > 0 && position >= duration - 800 && (isPaused || position >= duration)) {
            ended = true;
            setTimeout(() => playTrack(nextTrack()), 600);
          }
        });
        resolve(c);
      });
    }));
    return embedLoading;
  }

  async function playTrack(t) {
    show(t);
    ended = false;
    mini.hidden = false;
    const fresh = !controller;
    wantPlay = true;
    const c = await ensureEmbed();
    if (!fresh) c.loadUri(t.uri);
    // Fallback in case "ready" already fired before we asked to play
    setTimeout(() => { if (wantPlay) { wantPlay = false; c.play(); } }, 1500);
  }
  function toggle() {
    if (!controller || mini.hidden) { setOff(false); playTrack(current); return; }
    setOff(playing); // pausing turns autostart off for this visit
    controller.togglePlay();
  }
  function next() { setOff(false); playTrack(nextTrack()); }

  cachedJSON('spotify-playlist-v2', url, 10 * 60 * 1000).then(d => {
    if (!d.configured || !d.tracks?.length) return;
    tracks = d.tracks;
    box.hidden = false;
    box.innerHTML = `
      <div class="pl-head">
        ${d.cover ? `<img src="${esc(d.cover)}" alt="" width="52" height="52" loading="lazy">` : ''}
        <div class="pl-meta">
          <span class="now-k">🎧 my playlist · <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.name)}</a> · ${tracks.length} songs</span>
          <span class="now-v" id="plTitle"></span>
          <span class="spot-artist" id="plArtist"></span>
        </div>
        <div class="pl-btns">
          <button class="pl-shuffle" id="plPlay" type="button">▶ Play</button>
          <button class="pl-next" id="plNext" type="button" aria-label="Next random song" title="Next random song">⏭</button>
        </div>
      </div>
      <p class="pl-note">Plays in the mini player at the bottom left.</p>`;
    show(nextTrack());
    document.getElementById('plPlay').addEventListener('click', e => { e.stopPropagation(); toggle(); });
    document.getElementById('plNext').addEventListener('click', e => { e.stopPropagation(); next(); });
    mini.querySelector('.mp-next').addEventListener('click', e => { e.stopPropagation(); next(); });
    mini.querySelector('.mp-close').addEventListener('click', e => {
      e.stopPropagation();
      setOff(true);
      if (playing) controller?.togglePlay();
      setPlaying(false);
      mini.hidden = true;
    });

    if (isOff()) return;
    // 1) Try right after the page has loaded (kept off the critical path). Works where
    //    the browser allows autoplay with sound for this site.
    const tryNow = () => { if (!isOff() && !controller) playTrack(current); };
    if (document.readyState === 'complete') setTimeout(tryNow, 1500);
    else addEventListener('load', () => setTimeout(tryNow, 1500), { once: true });
    // 2) Otherwise start on the visitor's first interaction, which browsers do allow
    const start = e => {
      if (e.target.closest?.('#miniPlayer, #spotify')) return; // those controls handle it themselves
      ['pointerdown', 'keydown'].forEach(t => removeEventListener(t, start, true));
      if (isOff() || playing) return;
      if (controller && !mini.hidden) controller.play(); else playTrack(current);
    };
    ['pointerdown', 'keydown'].forEach(t => addEventListener(t, start, true));
  }).catch(() => { box.hidden = true; });
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
