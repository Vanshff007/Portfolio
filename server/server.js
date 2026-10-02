// API behind the portfolio:
//   POST /api/chat         AI assistant that answers questions about Vansh (Gemini, streamed text)
//   GET  /api/leetcode     LeetCode stats (LeetCode's GraphQL API blocks browser CORS)
//   GET  /api/now-playing  Spotify currently / last played track
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
// 'gemini-flash-latest' always points at Google's current Flash model (free tier friendly)
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// Tried in order when a model is overloaded (503) or rate limited (429)
const MODELS = [...new Set([MODEL, 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])];

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
        // Busy or out of quota: move to the next model, but only if nothing was sent yet
        const busy = err instanceof ApiError && (err.status === 503 || err.status === 429);
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
      userCalendar { streak totalActiveDays }
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
  return {
    total: ac.All, easy: ac.Easy, medium: ac.Medium, hard: ac.Hard,
    rating: c.rating ?? null, topPercentage: c.topPercentage ?? null, contests: c.attendedContestsCount ?? null,
    streak: data.matchedUser.userCalendar?.streak ?? null, activeDays: data.matchedUser.userCalendar?.totalActiveDays ?? null,
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

/* ── Spotify now playing ── */
const spotifyConfigured = () => process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REFRESH_TOKEN;
let spotifyToken = null, spotifyTokenExpires = 0;
async function spotifyAccessToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpires) return spotifyToken;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: process.env.SPOTIFY_REFRESH_TOKEN }),
  });
  if (!r.ok) throw new Error('Spotify token HTTP ' + r.status);
  const d = await r.json();
  spotifyToken = d.access_token;
  spotifyTokenExpires = Date.now() + (d.expires_in - 60) * 1000;
  return spotifyToken;
}
const trackInfo = (t, playing) => t && ({
  playing, title: t.name, artist: t.artists.map(a => a.name).join(', '),
  url: t.external_urls.spotify, albumArt: t.album.images.at(-1)?.url || null,
});
const getNowPlaying = cached(20 * 1000, async () => {
  const headers = { Authorization: 'Bearer ' + await spotifyAccessToken() };
  const now = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers });
  if (now.status === 200) {
    const d = await now.json();
    if (d.item && d.currently_playing_type === 'track') return trackInfo(d.item, d.is_playing);
  }
  const recent = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers });
  if (!recent.ok) return {};
  const d = await recent.json();
  return trackInfo(d.items?.[0]?.track, false) || {};
});
app.get('/api/now-playing', async (req, res) => {
  if (!spotifyConfigured()) return res.json({ configured: false });
  try {
    res.json({ configured: true, ...(await getNowPlaying()) });
  } catch (err) {
    console.error('Spotify error', err.message);
    res.json({ configured: true });
  }
});

app.listen(PORT, () => console.log(`Portfolio API on :${PORT} (chat ${ai ? 'on, ' + MODELS.join(' → ') : 'off: set GEMINI_API_KEY'})`));
