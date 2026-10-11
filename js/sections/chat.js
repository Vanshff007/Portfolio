/* ── "Ask about me" AI chat. Talks to server/ (POST /api/chat, streamed text) ── */
(function () {
  if (!SITE.apiBase) return; // feature hidden until the server is deployed
  const base = SITE.apiBase.replace(/\/$/, '');
  const fab = document.getElementById('chatFab');
  const panel = document.getElementById('chatPanel');
  const log = document.getElementById('chatLog');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const suggest = document.getElementById('chatSuggest');
  const history = [];
  let busy = false, warmed = false;
  fab.hidden = false;

  function bubble(role, text = '') {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + role;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  // Light formatting: **bold** and bare links, applied to escaped text
  const format = t => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(https?:\/\/[^\s<)]*[^\s<).,;:!?'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  function openChat(question) {
    panel.hidden = false;
    fab.hidden = true;
    if (!log.children.length) bubble('bot', "Hi! I'm an AI assistant that knows Vansh's resume and projects. Ask me anything.");
    if (!warmed) { warmed = true; fetch(base + '/api/health').catch(() => {}); } // wake the Render instance early
    if (question) ask(question); else input.focus();
    sfx('open');
  }
  function closeChat() { panel.hidden = true; fab.hidden = false; fab.focus(); }
  window.openChat = openChat;

  async function ask(q) {
    q = q.trim();
    if (!q || busy) return;
    busy = true;
    suggest.hidden = true;
    bubble('user', q);
    history.push({ role: 'user', content: q });
    const out = bubble('bot typing', '');
    const slow = setTimeout(() => { if (!out.textContent) out.textContent = 'Waking up the server (free tier sleeps when idle)…'; }, 2500);
    let text = '';
    try {
      const res = await fetch(base + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? 'Too many questions — try again in a minute.' : 'Server error ' + res.status);
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        out.innerHTML = format(text);
        log.scrollTop = log.scrollHeight;
      }
      history.push({ role: 'assistant', content: text });
    } catch (e) {
      out.classList.add('error');
      out.textContent = e.message.startsWith('Too many') ? e.message : `Couldn't reach the assistant. Email Vansh at ${SITE.email} instead.`;
      history.pop();
    } finally {
      clearTimeout(slow);
      out.classList.remove('typing');
      busy = false;
      input.focus();
    }
  }

  fab.addEventListener('click', () => openChat());
  document.getElementById('chatClose').addEventListener('click', closeChat);
  form.addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
  suggest.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });
})();
