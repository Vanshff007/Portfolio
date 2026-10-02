# vansh.dev — Portfolio

Personal portfolio of Vansh Minhas, a full-stack developer and CS student at USICT (GGSIPU). Hand-coded with plain HTML, CSS and JavaScript. No frameworks and no build step. A small optional Node server adds the AI assistant, live LeetCode stats and Spotify.

**Live:**
- GitHub Pages: https://vanshff007.github.io/Portfolio/
- Render: https://portfolio-8una.onrender.com

## Features

### Projects
- Loaded live from the GitHub API, so new repos appear automatically. Cached for 1 hour in the browser to stay within GitHub's rate limit (60 requests per hour per IP).
- Filters for All, Full-Stack, AI / ML and Frontend.
- **Case-study modal:** click a card (or "Case study") to see the problem, an architecture diagram, challenges, outcome, a screenshot and links.
- **Hover preview:** a screenshot of the live demo follows the cursor over each card (via microlink.io; GitHub's social preview image as fallback).
- Demos on Render's free tier open through a "waking up server" screen.

### Journey
An education, work and achievements timeline. The line draws itself as you scroll.

### Activity
- **GitHub:** contribution heatmap for the last year, streak, top languages and the latest commits.
- **LeetCode:** solved count with an Easy / Medium / Hard ring, contest rating, top percentage, max streak and a submission heatmap for the last year.
- **Play the graphs:** click the GitHub heatmap to play **Pac-Man** on it (contributions are pellets, the brightest ones are power pellets). The maze walls sit on empty days, and power-ups appear now and then: ⚡ speed, ❄ freeze ghosts, 🧲 magnet, ×2 points and ♥ extra life. Click the LeetCode heatmap to play a **Space Shooter** where each submission is an enemy block (brighter blocks take more hits). Keyboard and touch controls; best scores are saved.
- **Currently:** what I'm building, learning and reading, plus Spotify "now playing" when the server is set up.

### Skills
Switch between **Bars** and an interactive **Graph**. The graph links each skill to the projects that use it. Click a skill to highlight its projects, click a project to open its case study, and drag nodes around. Clicking a skill row in the bar view also filters the Projects section.

### Writing
Latest Dev.to posts. The section stays hidden until `SITE.devtoUser` is set.

### Guestbook
Visitor counter (abacus) and a guestbook powered by [giscus](https://giscus.app), which stores messages as GitHub Discussions.

### AI assistant
"Ask about me" chat that answers questions from my resume and projects. It uses the Gemini API through the Node server in `server/`, so the API key never reaches the browser. Also available as `ask <question>` in the terminal.

### Terminal (`Ctrl + K` or `` ` ``)

| Command | What it does |
|---|---|
| `help` | List all commands |
| `ls`, `cd`, `cat`, `pwd`, `tree` | Browse a small fake filesystem (`about.txt`, `projects/`, `skills.json`, `journey.log`, …) |
| `about`, `skills`, `contact`, `projects` | Print info |
| `open <n>` / `open github` | Open a project or profile |
| `case <n>` | Open a project's case study |
| `git log` | My latest real commits from GitHub |
| `neofetch` | System info, portfolio style |
| `resume` | Download my resume |
| `theme <name>` | Switch theme |
| `snake`, `typing` | Play snake or take a typing speed test (best scores are saved) |
| `pacman`, `shooter` | Play Pac-Man on my GitHub graph or the Space Shooter on my LeetCode graph |
| `sound on/off` | Toggle sound effects |
| `sudo hire-vansh` | Try it |
| `email`, `goto <section>`, `history`, `clear`, `exit` | The usual |

Supports command history (arrow keys) and Tab completion for commands and file names.

### Command palette (`Ctrl + P`)
Fuzzy search across sections, projects, links, themes and actions (download resume, copy email, open terminal, play snake, …).

### Themes
Dark (default), Light, Dracula, Matrix and Sunset. Use the ◐ button in the nav, the palette or `theme <name>`. The choice is saved.

### Extras
- Sound effects made with the Web Audio API, off by default (♪ button in the footer).
- Konami code (↑ ↑ ↓ ↓ ← → ← → B A) for confetti and a "dev mode" that outlines the layout grid.
- Resume button in the hero, with download tracking.
- Lighthouse score badge in the footer.
- Particle network hero, typing headline, 3D tilt cards, magnetic buttons, scramble text, custom cursor, scroll progress.
- Responsive, keyboard friendly and respects `prefers-reduced-motion`.

## Project structure

```
index.html          Page markup
css/style.css       Base styles and layout
css/features.css    Themes and styles for the newer features
js/config.js        All editable content: links, projects, timeline, skills, feature switches
js/render.js        Shared helpers; builds skill bars and the timeline from config
js/core.js          Cursor, scroll effects, hero canvas, contact form
js/projects.js      GitHub projects, case-study modal, hover preview
js/ui.js            Themes, sound, command palette, Konami code, confetti
js/terminal.js      Terminal and fake filesystem
js/games.js         Snake and typing test
js/heatmap-games.js Pac-Man and Space Shooter played on the heatmaps
js/widgets.js       GitHub, LeetCode, "currently", Dev.to, visitor counter, giscus, Lighthouse badge
js/skills-graph.js  Skills graph
js/chat.js          AI chat window
assets/             Resume PDF and favicon
server/             Optional Node API (AI chat, LeetCode, Spotify)
```

## Configuration

Everything you would normally edit is in `js/config.js`:

- `SITE.apiBase`: URL of the deployed server, for example `https://vansh-portfolio-api.onrender.com`. Empty hides the AI chat and Spotify, and LeetCode stats come from a public fallback API (which rate-limits, so the card may show the saved numbers in `SITE.leetcodeFallback`).
- `SITE.devtoUser`: your Dev.to username, to show the Writing section.
- `SITE.giscus`: guestbook settings (see below).
- `SITE.now`: the "Currently" lines.
- `SITE.lighthouse`: the scores shown in the footer badge.
- `TIMELINE`, `SKILL_GROUPS`: the Journey and Skills content.
- `GH_USER`, `GH_EXCLUDE`, `PROJECT_INFO`, `FEATURED_ORDER`: the projects list and case studies. `PROJECT_INFO` adds curated titles, stacks and case-study text (`problem`, `arch`, `challenges`, `outcome`), since the GitHub API only reports languages.

After changing the projects config, bump `CACHE_KEY` in `js/projects.js` (for example `gh-projects-v3` to `gh-projects-v4`) so returning visitors get the new list right away.

### Guestbook setup (once)
1. In the repo on GitHub, open **Settings → General → Features** and enable **Discussions**.
2. Create a discussion category named `Guestbook` (type: Announcement works well, so only giscus can create the thread).
3. Install the [giscus app](https://github.com/apps/giscus) on the repo.
4. Open https://giscus.app, enter `Vanshff007/Portfolio`, choose the `Guestbook` category, and copy `data-repo-id` and `data-category-id` into `SITE.giscus` in `js/config.js`.

## Server (AI chat, LeetCode, Spotify)

The server lives in `server/`. It needs Node 20 or newer.

```bash
cd server
npm install
cp .env.example .env   # then fill in GEMINI_API_KEY
npm run dev            # http://localhost:3000
```

Endpoints: `POST /api/chat`, `GET /api/leetcode`, `GET /api/now-playing`, `GET /api/health`. The chat uses `gemini-flash-lite-latest` with fallbacks (override with `GEMINI_MODEL`) and answers only from `server/profile.md`; edit that file to change what the assistant knows. CORS is limited to `ALLOWED_ORIGINS`, and the chat is rate limited to 20 questions per 10 minutes per IP.

### Deploy on Render
1. **New → Web Service**, connect this repo, and set **Root Directory** to `server`.
2. Build command `npm install`, start command `npm start`.
3. Add the environment variables from `.env.example` (at least `GEMINI_API_KEY`).
4. Put the service URL in `SITE.apiBase` in `js/config.js`.

The free tier sleeps when idle; the chat window pings `/api/health` when opened so the server starts waking up early.

### Spotify (optional)
1. Create an app at https://developer.spotify.com/dashboard. Under **Redirect URIs** add `http://127.0.0.1:8888/callback`, and tick **Web API**.
2. Put the app's `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `server/.env`.
3. Run `npm run spotify-token` in `server/`. Your browser opens Spotify; approve, and the script saves `SPOTIFY_REFRESH_TOKEN` to `server/.env`.
4. On Render, add the same three `SPOTIFY_*` variables.

## Running locally

Serve the folder with any static server (some features use `fetch`, which needs `http://` rather than `file://`):

```bash
python -m http.server 5500
```

Then open http://localhost:5500.

## Tech

HTML, CSS, vanilla JavaScript, Canvas API, Web Audio API, GitHub REST API, LeetCode GraphQL, Dev.to API, giscus, Formspree, Node.js, Express, Gemini API.

## License

The code is released under the [MIT License](LICENSE). You're welcome to reuse it for your own portfolio; a link back is appreciated.

Personal content is not covered by the license: my resume (`assets/resume.pdf`), the text in `js/config.js` and `server/profile.md` about me and my projects, and my name and photos. Please replace these with your own.
