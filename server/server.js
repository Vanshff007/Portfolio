// API behind the portfolio:
//   POST /api/chat         AI assistant that answers questions about Vansh (Gemini, streamed text)
//   GET  /api/leetcode     LeetCode stats (LeetCode's GraphQL API blocks browser CORS)
//   GET  /api/playlist     songs from my public Spotify playlist (for the shuffle player)
//   GET  /api/health       wake-up ping for Render's free tier
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GoogleGenAI, ApiError } from '@google/genai';

// Load server/.env if present (keys stay on this machine; .env is gitignored).
// On Render, set the variables in the dashboard instead.
try { process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url))); } catch {}

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://vanshff007.github.io,https://portfolio-8una.onrender.com,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(s => s.trim()).filter(Boolean);
const LEETCODE_USER = process.env.LEETCODE_USER || 'idgaf_vansh';
// Flash-Lite answers in ~1s and is plenty for short resume Q&A; the '-latest' alias
// always points at Google's current version (free tier friendly)
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
// Tried in order when a model is overloaded (503), rate limited (429) or retired (404)
const MODELS = [...new Set([MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-latest'])];

const profile = fs.readFileSync(new URL('./profile.md', import.meta.url), 'utf8');
const SYSTEM_PROMPT = `You are the assistant on Vansh Minhas's portfolio website. Visitors are usually recruiters, engineers or students who want to know about Vansh.

Answer only from the profile below. If the profile does not cover something, say you don't know and suggest emailing Vansh at vansh31082005@gmail.com. Never invent employers, dates, grades, numbers or projects. Do not share a phone number.

Keep answers short: 1 to 4 sentences, or a short list when the visitor asks for several items. Write in plain text; **bold** and bare URLs are the only formatting the chat window renders. Refer to Vansh in the third person. Be friendly and direct, and when it fits, point to a relevant project link.

If someone asks for something unrelated to Vansh (homework, general coding help, other topics), politely say you can only answer questions about Vansh and his work.

<profile>
${profile}
</profile>`;

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const app = express();
app.set('trust proxy', 1); // Render sits behind one proxy; needed for per-IP rate limits
app.use(express.json({ limit: '20kb' }));

// CORS: only the portfolio's own origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Fixed-window rate limiter, in memory (fine for one small instance)
function rateLimit(max, windowMs) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const n = (hits.get(req.ip) || 0) + 1;
    hits.set(req.ip, n);
    if (n > max) return res.status(429).json({ error: 'Too many requests, try again soon.' });
    next();
  };
}

// Tiny TTL cache for upstream APIs
function cached(ttlMs, fn) {
  let value = null, expires = 0, pending = null;
  return async () => {
    if (value && Date.now() < expires) return value;
    pending = pending || fn().then(v => { value = v; expires = Date.now() + ttlMs; return v; }).finally(() => { pending = null; });
    return pending;
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true, chat: !!ai }));

/* ── AI chat ── */
function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return false;
  return messages.every((m, i) =>
    m && typeof m.content === 'string' && m.content.trim() && m.content.length <= 1000 &&
    m.role === (i % 2 === 0 ? 'user' : 'assistant')) && messages.at(-1).role === 'user';
}

app.post('/api/chat', rateLimit(20, 10 * 60 * 1000), async (req, res) => {
  if (!ai) return res.status(503).json({ error: 'Chat is not configured.' });
  const { messages } = req.body || {};
  if (!validMessages(messages)) return res.status(400).json({ error: 'Invalid messages.' });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); }); // visitor disconnected mid-answer
  let wrote = false;
  try {
    // Gemini calls the assistant role "model"
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    for (const [i, model] of MODELS.entries()) {
      try {
        const stream = await ai.models.generateContentStream({
          model, contents,
          config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 1024, abortSignal: abort.signal },
        });
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) { wrote = true; res.write(text); }
        }
        break;
      } catch (err) {
        // Busy, out of quota or retired: move to the next model, but only if nothing was sent yet
        const busy = err instanceof ApiError && [404, 429, 503].includes(err.status);
        if (!busy || wrote || i === MODELS.length - 1 || abort.signal.aborted) throw err;
        console.warn(`Gemini ${model} returned ${err.status}, trying ${MODELS[i + 1]}`);
      }
    }
    if (!wrote) res.write("Sorry, I can't help with that. Ask me about Vansh's projects, skills or experience.");
    res.end();
  } catch (err) {
    if (abort.signal.aborted) return; // visitor closed the chat
    if (err instanceof ApiError) console.error('Gemini API error', err.status, err.message);
    else console.error('Chat error', err);
    if (!res.headersSent || !wrote) {
      if (!res.headersSent) res.status(502);
      res.end('The assistant is unavailable right now.');
    } else res.end();
  }
});

/* ── LeetCode stats ── */
const getLeetCode = cached(60 * 60 * 1000, async () => {
  const query = `query($u: String!) {
    matchedUser(username: $u) {
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      userCalendar { streak totalActiveDays submissionCalendar }
    }
    userContestRanking(username: $u) { rating globalRanking topPercentage attendedContestsCount }
  }`;
  const r = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
    body: JSON.stringify({ query, variables: { u: LEETCODE_USER } }),
  });
  if (!r.ok) throw new Error('LeetCode HTTP ' + r.status);
  const { data } = await r.json();
  const ac = Object.fromEntries(data.matchedUser.submitStatsGlobal.acSubmissionNum.map(x => [x.difficulty, x.count]));
  const c = data.userContestRanking || {};
  const cal = data.matchedUser.userCalendar;
  // LeetCode keys are unix timestamps at UTC midnight; send plain dates instead
  const calendar = Object.fromEntries(Object.entries(JSON.parse(cal?.submissionCalendar || '{}'))
    .map(([t, n]) => [new Date(t * 1000).toISOString().slice(0, 10), n]));
  return {
    total: ac.All, easy: ac.Easy, medium: ac.Medium, hard: ac.Hard,
    rating: c.rating ?? null, topPercentage: c.topPercentage ?? null, contests: c.attendedContestsCount ?? null,
    streak: cal?.streak ?? null, activeDays: cal?.totalActiveDays ?? null, calendar,
  };
});
app.get('/api/leetcode', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.json(await getLeetCode());
  } catch (err) {
    console.error('LeetCode error', err.message);
    res.status(502).json({ error: 'LeetCode unavailable' });
  }
});

/* ── Spotify playlist ── */
// Spotify only lists a playlist's songs to a logged-in user, so this uses my refresh
// token (get one with `npm run spotify-token`). Values are trimmed because stray
// spaces are easy to paste into a dashboard.
const env = k => (process.env[k] || '').trim();
const PLAYLIST_ID = env('SPOTIFY_PLAYLIST_ID') || '2tTUBBKblopXxly7czjFKv';
const spotifyConfigured = () => env('SPOTIFY_CLIENT_ID') && env('SPOTIFY_CLIENT_SECRET') && env('SPOTIFY_REFRESH_TOKEN');
let spotifyToken = null, spotifyTokenExpires = 0;
async function spotifyAccessToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpires) return spotifyToken;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${env('SPOTIFY_CLIENT_ID')}:${env('SPOTIFY_CLIENT_SECRET')}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env('SPOTIFY_REFRESH_TOKEN') }),
  });
  if (!r.ok) throw new Error('Spotify token HTTP ' + r.status + ' (check SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN)');
  const d = await r.json();
  spotifyToken = d.access_token;
  spotifyTokenExpires = Date.now() + (d.expires_in - 60) * 1000;
  return spotifyToken;
}
const getPlaylist = cached(60 * 60 * 1000, async () => {
  const headers = { Authorization: 'Bearer ' + await spotifyAccessToken() };
  const meta = await fetch(`https://api.spotify.com/v1/playlists/${PLAYLIST_ID}?fields=name,external_urls,images`, { headers });
  if (!meta.ok) throw new Error('Spotify playlist HTTP ' + meta.status);
  const p = await meta.json();
  // Spotify's newer API lists playlist entries under /items, each with an `item` field
  const tracks = [];
  for (let url = `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/items?limit=100`; url;) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error('Spotify playlist items HTTP ' + r.status);
    const page = await r.json();
    for (const entry of page.items) {
      const t = entry.item || entry.track;
      if (!t || t.type !== 'track' || t.is_local || t.is_playable === false) continue;
      tracks.push({ uri: t.uri, title: t.name, artist: t.artists.map(a => a.name).join(', '), url: t.external_urls.spotify, cover: t.album.images.at(-1)?.url || null });
    }
    url = page.next;
  }
  return { name: p.name, url: p.external_urls.spotify, cover: p.images?.[0]?.url || null, tracks };
});
app.get('/api/playlist', async (req, res) => {
  if (!spotifyConfigured()) return res.json({ configured: false });
  try {
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ configured: true, ...(await getPlaylist()) });
  } catch (err) {
    console.error('Spotify error', err.message);
    res.status(502).json({ configured: true, error: 'Spotify unavailable' });
  }
});

app.listen(PORT, () => console.log(`Portfolio API on :${PORT} (chat ${ai ? 'on, ' + MODELS.join(' → ') : 'off: set GEMINI_API_KEY'})`));
