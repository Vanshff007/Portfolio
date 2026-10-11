/* ── Shared helpers ── */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// localStorage can throw (private mode, blocked storage), so wrap every access
const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
function timeAgo(iso) {
  const d = (Date.now() - new Date(iso)) / 86400000;
  if (d < 1 / 24) return Math.max(1, Math.round(d * 1440)) + 'm ago';
  if (d < 1) return Math.round(d * 24) + 'h ago';
  if (d < 30) return Math.floor(d) + 'd ago';
  if (d < 365) return Math.floor(d / 30) + 'mo ago';
  return Math.floor(d / 365) + 'y ago';
}

/* ── Skill bars, built from SKILL_GROUPS ── */
document.getElementById('skillsBars').innerHTML = SKILL_GROUPS.map((g, i) => `
  <div class="skill-group reveal" style="transition-delay:${i * 0.1}s">
    <div class="skill-group-title">${esc(g.name)}</div>
    ${g.skills.map(([name, pct]) => `
      <div class="skill-item" data-skill="${esc(name)}"><span class="skill-name">${esc(name)}</span>
        <div class="skill-right"><span class="skill-pct">${pct}%</span><div class="skill-bar-wrap"><div class="skill-bar" style="transform:scaleX(${pct / 100})"></div></div></div>
      </div>`).join('')}
  </div>`).join('');

/* ── Journey timeline, built from TIMELINE ── */
document.getElementById('timeline').insertAdjacentHTML('beforeend', TIMELINE.map((t, i) => `
  <li class="tl-item reveal ${i % 2 ? 'right' : 'left'}">
    <span class="tl-dot" aria-hidden="true"></span>
    <div class="tl-card">
      <div class="tl-meta"><span class="tl-kind tl-${esc(t.kind.toLowerCase())}">${esc(t.kind)}</span><span>${esc(t.when)}</span></div>
      <h3 class="tl-title">${esc(t.title)}</h3>
      <p class="tl-text">${esc(t.text)}</p>
    </div>
  </li>`).join(''));
