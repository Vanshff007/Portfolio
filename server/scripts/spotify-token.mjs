// One-time helper: gets a Spotify refresh token and saves it to server/.env.
// Usage (from server/): npm run spotify-token
// Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env, and the redirect URI
// http://127.0.0.1:8888/callback added to your app in the Spotify dashboard.
import fs from 'node:fs';
import http from 'node:http';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
process.loadEnvFile(envPath);
const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in server/.env first.');
  process.exit(1);
}

const REDIRECT = 'http://127.0.0.1:8888/callback';
const authURL = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id: id, response_type: 'code', redirect_uri: REDIRECT,
  scope: 'user-read-currently-playing user-read-recently-played',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  if (!code) {
    res.end('Spotify did not return a code: ' + (url.searchParams.get('error') || 'unknown error'));
    return finish(1, 'Authorization failed: ' + url.searchParams.get('error'));
  }
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT }),
  });
  const data = await r.json();
  if (!data.refresh_token) {
    res.end('Token exchange failed. Check the terminal.');
    return finish(1, 'Token exchange failed: ' + JSON.stringify(data));
  }
  // Replace the SPOTIFY_REFRESH_TOKEN line in .env (or add it)
  let env = fs.readFileSync(envPath, 'utf8');
  const line = `SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`;
  env = /^SPOTIFY_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^SPOTIFY_REFRESH_TOKEN=.*$/m, line) : env.trimEnd() + '\n' + line + '\n';
  fs.writeFileSync(envPath, env);
  res.end('Done! Refresh token saved to server/.env. You can close this tab.');
  finish(0, 'Saved SPOTIFY_REFRESH_TOKEN to server/.env');
});

function finish(code, msg) {
  console.log(msg);
  server.close();
  setTimeout(() => process.exit(code), 100);
}

server.listen(8888, '127.0.0.1', () => {
  console.log('Opening Spotify login in your browser. If it does not open, visit:\n' + authURL);
  const opener = process.platform === 'win32' ? `start "" "${authURL}"` : process.platform === 'darwin' ? `open "${authURL}"` : `xdg-open "${authURL}"`;
  exec(opener);
});
