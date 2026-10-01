# vansh.dev — Portfolio

Personal portfolio of Vansh Minhas, a full-stack developer and CS student at GGSIPU. Hand-coded in a single `index.html` with plain HTML, CSS and JavaScript. No frameworks and no build step.

**Live:**
- GitHub Pages: https://vanshff007.github.io/Portfolio/
- Render: https://portfolio-8una.onrender.com

## Features

### Projects loaded live from GitHub
- The Projects section fetches public repos from the GitHub API on page load, so new repos appear automatically.
- Each card shows a description, tech stack, main language, stars, last-updated time, a live demo link (when one exists) and a source code link.
- Demo links come from the repo's website field, a URL in its description, or its GitHub Pages site.
- Filter buttons switch between All, Full-Stack, AI / ML and Frontend.
- Results are cached in the visitor's browser for 1 hour to stay within GitHub's unauthenticated rate limit (60 requests per hour per IP).
- Loading skeletons show while data loads. If GitHub is unreachable, static fallback cards are shown instead.
- Demos hosted on Render's free tier open through a "waking up server" screen, because the server sleeps when idle.

### Interactive terminal
Press `Ctrl + K`, the `` ` `` key, or the `>_` button in the nav to open a shell-style terminal.

| Command | What it does |
|---|---|
| `help` | List all commands |
| `about`, `skills`, `contact` | Print info about me |
| `projects` | List projects (synced from GitHub) |
| `open <n>` | Open project number `n` |
| `open github` / `linkedin` / `leetcode` | Open a profile |
| `email` | Copy my email address |
| `goto <section>` | Scroll to a section |
| `clear`, `exit` | Clear or close the terminal |

Supports command history (arrow keys) and Tab completion.

### Visual effects
- Particle network in the hero that reacts to the mouse.
- Typing headline that cycles through Builds., Ships., Solves., Creates. and Debugs.
- 3D tilt and cursor-following glow on project cards.
- Buttons that drift toward the cursor.
- Scrambled-text reveal on section titles and count-up stats.
- Custom cursor, scroll progress bar, active nav link highlighting and a back-to-top button.

### Accessibility and responsiveness
- Responsive layout with a hamburger menu on small screens.
- Native cursor on touch devices.
- Respects the `prefers-reduced-motion` setting.

### Contact
- Contact form powered by [Formspree](https://formspree.io), with validation and success/error messages.
- Links to Gmail, GitHub, LinkedIn and LeetCode. Clicking the Gmail button also copies the address.

## Customizing the projects list

The projects config lives in the `<script>` block of `index.html`:

- `GH_USER`: the GitHub username to load repos from.
- `GH_EXCLUDE`: repos to hide.
- `PROJECT_INFO`: curated title, description, category and tech stack for each repo. The GitHub API only reports languages, not frameworks, so this fills the gap. Repos without an entry use their GitHub description and languages.
- `FEATURED_ORDER`: the display order. The first three are labeled "Featured".

After changing the config, bump `CACHE_KEY` (for example, `gh-projects-v2` to `gh-projects-v3`) so returning visitors get the new list right away.

## Running locally

Open `index.html` in a browser. Nothing to install.

## Tech

HTML, CSS, vanilla JavaScript, Canvas API, GitHub REST API, Formspree.
