/* ── Interactive terminal with a small fake filesystem ──
   Games (games.js) take over the keyboard through term.run(program). */
const term = (function () {
  const overlay = document.getElementById('termOverlay');
  const body    = document.getElementById('termBody');
  const input   = document.getElementById('termInput');
  const prompt  = document.getElementById('termPrompt');
  const history = store.get('term-history', []);
  let hIdx = history.length, booted = false, cwd = '~', program = null;
  const bootTime = Date.now();

  function print(html, cls = 'out') {
    const line = document.createElement('div');
    line.className = 'term-line ' + cls;
    line.innerHTML = html;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
    return line;
  }
  const err = msg => { print(msg, 'err'); sfx('error'); };
  const promptText = () => `vansh@dev:${cwd}$`;

  function goTo(id) {
    close();
    setTimeout(() => scrollToSection(id), 200);
  }

  /* ── Filesystem: directories are objects, files are functions that print ── */
  const FILES = {
    'about.txt': () => COMMANDS.about(),
    'contact.md': () => COMMANDS.contact(),
    'skills.json': () => print(esc(JSON.stringify(Object.fromEntries(SKILL_GROUPS.map(g => [g.name, g.skills.map(s => s[0])])), null, 2))),
    'resume.pdf': () => print('Binary file. Run <span class="hl">resume</span> to download it.'),
    'journey.log': () => TIMELINE.forEach(t => print(`<span class="hl">${esc(t.when.padEnd(16))}</span>${esc(t.title)}`)),
    '.secrets': () => print('↑ ↑ ↓ ↓ ← → ← → B A\nTry it on the page, outside the terminal.', 'out'),
  };
  function tree() {
    const projects = {};
    PROJECTS.forEach((p, i) => { projects[p.name + '.md'] = () => printProject(p, i); });
    return { ...FILES, 'projects': projects };
  }
  function resolve(path = '') {
    const parts = (path.startsWith('~') || path.startsWith('/') ? path.replace(/^~\/?|^\/home\/vansh\/?|^\//, '') : (cwd === '~' ? '' : cwd.slice(2) + '/') + path)
      .split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') stack.pop(); else stack.push(part);
    }
    let node = tree();
    for (const part of stack) {
      if (typeof node !== 'object' || !(part in node)) {
        // case-insensitive match helps on phones
        const key = typeof node === 'object' && Object.keys(node).find(k => k.toLowerCase() === part.toLowerCase());
        if (!key) return { node: null };
        node = node[key];
      } else node = node[part];
    }
    return { node, path: '~' + (stack.length ? '/' + stack.join('/') : '') };
  }
  function printProject(p, i) {
    print(`<span class="hl"># ${esc(p.title)}</span>  <span class="hl2">[${esc(p.category)}]</span>
${esc(p.desc)}
stack:  ${p.tech.map(esc).join(' · ')}
repo:   <a href="${esc(p.repoUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.repoUrl.replace('https://', ''))}</a>${p.demo ? `\ndemo:   <a href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer">${esc(p.demo.replace('https://', ''))}</a>` : ''}
Run <span class="hl">open ${i + 1}</span> to launch, or <span class="hl">case ${i + 1}</span> for the case study.`);
  }

  const ART = [
    '  __      ____  __ ',
    '  \\ \\    / /  \\/  |',
    '   \\ \\  / /| \\  / |',
    '    \\ \\/ / | |\\/| |',
    '     \\  /  | |  | |',
    '      \\/   |_|  |_|',
  ];

  const COMMANDS = {
    help: () => print(
`<span class="hl2">navigation</span>
  <span class="hl">ls</span> [dir]      list files        <span class="hl">cd</span> &lt;dir&gt;     change directory
  <span class="hl">cat</span> &lt;file&gt;    print a file      <span class="hl">pwd</span>, <span class="hl">tree</span>   where am I / everything
  <span class="hl">goto</span> &lt;section&gt; scroll the page   (${[...document.querySelectorAll('main section[id]')].filter(s => !s.hidden && s.id !== 'hero').map(s => s.id).join(', ')})
<span class="hl2">about me</span>
  <span class="hl">about</span>, <span class="hl">skills</span>, <span class="hl">contact</span>, <span class="hl">projects</span>, <span class="hl">neofetch</span>
  <span class="hl">open</span> &lt;n|github|linkedin|leetcode&gt;   <span class="hl">case</span> &lt;n&gt;  project case study
  <span class="hl">git log</span>       my latest real commits
  <span class="hl">resume</span>        download my resume   <span class="hl">email</span>  copy my email
${SITE.apiBase ? '  <span class="hl">ask</span> &lt;question&gt; ask the AI about me\n' : ''}<span class="hl2">fun</span>
  <span class="hl">snake</span>         play snake            <span class="hl">typing</span>  typing speed test
  <span class="hl">pacman</span>        Pac-Man on my GitHub graph   <span class="hl">shooter</span>  shoot my LeetCode graph
  <span class="hl">matrix</span>, <span class="hl">hack</span>, <span class="hl">vim</span>            <span class="hl">achievements</span>  secrets you have found
  <span class="hl">theme</span> [name]  ${THEMES.join(' | ')}
  <span class="hl">sound</span> on|off  <span class="hl">sudo hire-vansh</span>   <span class="hl">whoami</span>, <span class="hl">date</span>, <span class="hl">echo</span>, <span class="hl">history</span>, <span class="hl">clear</span>, <span class="hl">exit</span>`),
    about: () => print(
`<span class="hl">Vansh Minhas</span> — Full-Stack Developer
B.Tech CSE at USICT (GGSIPU), 2023 – 2027.
Ex-MERN intern at Coding Samurai. ACM-ICPC club executive.
I build web apps that solve real problems, from real-time
collaborative tools to scalable backends. Fuel: chai.`),
    projects: () => {
      if (!PROJECTS.length) { err('Still loading from GitHub… try again in a second.'); return; }
      PROJECTS.forEach((p, i) => print(`<span class="hl">[${i + 1}] ${esc(p.title)}</span>${p.demo ? '' : '  (code only)'}
    <span class="hl2">${p.tech.slice(0, 5).map(esc).join(' · ')}</span>`));
      print('Type <span class="hl">open &lt;n&gt;</span> to launch a demo, <span class="hl">case &lt;n&gt;</span> for details.');
    },
    skills: () => print(SKILL_GROUPS.map(g => `<span class="hl">${esc(g.name.toLowerCase().padEnd(20))}</span>${g.skills.map(s => esc(s[0])).join(' · ')}`).join('\n')),
    contact: () => print(
`email     <span class="hl">${SITE.email}</span>
github    <span class="hl">github.com/Vanshff007</span>
linkedin  <span class="hl">in/vansh-minhas</span>
leetcode  <span class="hl">idgaf_vansh</span>
Type <span class="hl">email</span> to copy, or <span class="hl">open github</span>.`),
    whoami: () => print('visitor — but you could be a collaborator. type <span class="hl">contact</span>.'),
    date:   () => print(new Date().toString()),
    echo:   (args, raw) => print(esc(raw.replace(/^echo\s*/i, ''))),
    clear:  () => { body.innerHTML = ''; },
    exit:   () => close(),
    history: () => print(history.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n') || 'No history yet.'),
    pwd:    () => print(cwd.replace('~', '/home/vansh')),
    ls: ([arg]) => {
      const all = arg === '-a' || arg === '-la';
      const { node } = resolve(all ? '' : arg);
      if (node === null) return err(`ls: cannot access '${esc(arg)}': No such file or directory`);
      if (typeof node === 'function') return print(esc(arg));
      print(Object.keys(node).filter(k => all || !k.startsWith('.'))
        .map(k => typeof node[k] === 'object' ? `<span class="hl2">${esc(k)}/</span>` : esc(k)).join('  ') || '(empty)');
    },
    cd: ([arg = '~']) => {
      const { node, path } = resolve(arg);
      if (node === null) return err(`cd: no such file or directory: ${esc(arg)}`);
      if (typeof node === 'function') return err(`cd: not a directory: ${esc(arg)}`);
      cwd = path;
      prompt.textContent = promptText();
    },
    cat: ([arg]) => {
      if (!arg) return err('usage: cat &lt;file&gt;');
      const { node } = resolve(arg);
      if (node === null) return err(`cat: ${esc(arg)}: No such file or directory`);
      if (typeof node === 'object') return err(`cat: ${esc(arg)}: Is a directory`);
      node();
    },
    tree: () => {
      const walk = (node, pre) => Object.keys(node).forEach((k, i, arr) => {
        const last = i === arr.length - 1, isDir = typeof node[k] === 'object';
        print(`${pre}${last ? '└── ' : '├── '}${isDir ? `<span class="hl2">${esc(k)}/</span>` : esc(k)}`);
        if (isDir) walk(node[k], pre + (last ? '    ' : '│   '));
      });
      print('<span class="hl2">~</span>');
      walk(tree(), '');
    },
    email: () => {
      navigator.clipboard?.writeText(SITE.email)
        .then(() => print(`Copied <span class="hl">${SITE.email}</span> to clipboard ✓`))
        .catch(() => print(`Clipboard blocked — here it is: <span class="hl">${SITE.email}</span>`));
    },
    resume: () => {
      trackResume();
      const a = document.createElement('a'); a.href = SITE.resume; a.download = 'Vansh_Minhas_Resume.pdf'; a.click();
      print('Downloading <span class="hl">Vansh_Minhas_Resume.pdf</span>… ✓');
    },
    open: ([what]) => {
      if (SITE.links[what]) { window.open(SITE.links[what], '_blank', 'noopener,noreferrer'); print(`Opening ${what}…`); return; }
      const p = PROJECTS[parseInt(what, 10) - 1];
      if (p) {
        window.open(p.demo || p.repoUrl, '_blank', 'noopener,noreferrer');
        print(`Opening ${esc(p.title)}${p.demo ? '' : ' (source code)'}…`);
        return;
      }
      err('Usage: open github | linkedin | leetcode | &lt;project number&gt;');
    },
    case: ([n]) => {
      const p = PROJECTS[parseInt(n, 10) - 1];
      if (!p) return err('Usage: case &lt;project number&gt; — see <span class="hl">projects</span>');
      close(); setTimeout(() => openProject(p.name), 200);
    },
    goto: ([where]) => {
      const s = document.getElementById(where);
      if (s && s.tagName === 'SECTION' && !s.hidden) goTo(where);
      else err('Usage: goto &lt;section&gt; — see <span class="hl">help</span>');
    },
    theme: ([name]) => {
      if (!name) return print(`current: <span class="hl">${currentTheme()}</span>\navailable: ${THEMES.join(', ')}`);
      if (setTheme(name)) print(`Theme set to <span class="hl">${esc(name)}</span> ✓`);
      else err(`theme: unknown theme '${esc(name)}'. Try: ${THEMES.join(', ')}`);
    },
    sound: ([v]) => {
      if (v !== 'on' && v !== 'off') return print(`sound is <span class="hl">${soundOn ? 'on' : 'off'}</span>. Usage: sound on | off`);
      setSound(v === 'on'); print(`Sound effects ${v}.`);
    },
    sudo: ([what]) => {
      if (what === 'hire-vansh' || what === 'hire') {
        print('[sudo] password for recruiter: ********');
        setTimeout(() => print('Verifying credentials… <span class="hl">ok</span>'), 400);
        setTimeout(() => print('Checking skills: React ✓ Node.js ✓ Socket.io ✓ DSA (505+ problems) ✓'), 900);
        setTimeout(() => {
          print('<span class="hl">Access granted.</span> Vansh is now available for your team. 🎉\nOpening the contact form…');
          confetti(); sfx('success');
          foundSecret('hire');
          setTimeout(() => goTo('contact'), 900);
        }, 1500);
        return;
      }
      err('Nice try. This incident will be reported to the chai committee.\n(hint: <span class="hl">sudo hire-vansh</span>)');
    },
    git: async ([sub]) => {
      if (sub !== 'log') return err(`git: '${esc(sub || '')}' is not supported here. Try <span class="hl">git log</span>.`);
      const line = print('Fetching commits from GitHub…');
      try {
        const commits = await getRecentCommits();
        line.remove();
        if (!commits.length) return print('No public commits in the last 90 days.');
        commits.slice(0, 10).forEach(c => print(
`<span class="hl2">commit ${esc(c.sha.slice(0, 7))}</span>  <span class="hl">(${esc(c.repo)})</span>
    ${esc(c.message.split('\n')[0])}   <span class="dim">${timeAgo(c.date)}</span>`));
      } catch (e) { line.remove(); err('git: could not reach GitHub (' + esc(e.message) + ')'); }
    },
    neofetch: () => {
      const lc = window.LC_STATS;
      const up = Math.floor((Date.now() - bootTime) / 1000);
      const info = [
        '<span class="hl">vansh</span>@<span class="hl">dev</span>',
        '─────────────',
        `<span class="hl">OS</span>: Portfolio OS (vanilla JS, no build)`,
        `<span class="hl">Host</span>: ${esc(location.host || 'localhost')}`,
        `<span class="hl">Uptime</span>: ${Math.floor(up / 60)}m ${up % 60}s`,
        `<span class="hl">Shell</span>: vsh 2.0`,
        `<span class="hl">Theme</span>: ${currentTheme()}`,
        `<span class="hl">Resolution</span>: ${innerWidth}x${innerHeight}`,
        `<span class="hl">Projects</span>: ${PROJECTS.length || '…'}`,
        `<span class="hl">LeetCode</span>: ${lc ? `${lc.total} solved · ${lc.rating ? Math.round(lc.rating) + ' rating' : ''}` : '505+ solved'}`,
        `<span class="hl">Stack</span>: React · Node · Socket.io · MongoDB`,
        `<span class="hl">Visitors</span>: ${window.VISITS ?? '…'}`,
        '',
        ['accent', 'accent2', 'accent3', 'fg'].map(k => `<span style="background:rgb(${themeRGB[k]})">   </span>`).join(''),
      ];
      print(Array.from({ length: Math.max(ART.length, info.length) }, (_, i) =>
        `<span class="hl">${esc((ART[i] || '').padEnd(22))}</span>${info[i] || ''}`).join('\n'));
    },
    ask: (args, raw) => {
      const q = raw.replace(/^ask\s*/i, '').trim();
      if (!SITE.apiBase) return err('ask: the AI server is not configured yet.');
      if (!q) return err('usage: ask &lt;question&gt;');
      close(); window.openChat?.(q);
    },
    snake:  () => window.GAMES?.snake(term),
    pacman: () => { close(); setTimeout(() => window.playHeatmapGame?.('pacman'), 200); },
    shooter: () => { close(); setTimeout(() => window.playHeatmapGame?.('shooter'), 200); },
    typing: () => window.GAMES?.typing(term),
    achievements: () => {
      const list = (title, table) => {
        const ids = Object.keys(table);
        print(`<span class="hl2">${title}</span>  ${countFound(table)}/${ids.length}`);
        ids.forEach(id => print(foundSecrets.includes(id) ? `  <span class="hl">✓ ${esc(table[id][0])}</span>` : `  <span class="dim">☐ ???  ${esc(table[id][1])}</span>`));
      };
      print(`player level <span class="hl">${BASE_LEVEL + foundSecrets.length}</span>`);
      list('secrets', SECRETS);
      list('bonus', BONUS);
    },
    fortune: () => {
      const fortunes = [
        'It works on my machine. Ship the machine.',
        'There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
        'A senior developer is a junior developer who has broken production more times.',
        'Weeks of coding can save you hours of planning.',
        'The bug is never in the compiler. Today it is still not in the compiler.',
        'You will mass-rename a variable and regret it within the hour.',
        'First, solve the problem. Then, write the code.',
        '99 little bugs in the code. Take one down, patch it around. 127 little bugs in the code.',
      ];
      print(fortunes[Math.floor(Math.random() * fortunes.length)]);
      foundSecret('fortune');
    },
    42: () => { print('The answer to life, the universe and everything. Now, what was the question?'); foundSecret('answer'); },
    curl: ([url]) => {
      if (!url) return err('curl: try <span class="hl">curl hire.me</span>');
      if (!/^(https?:[/][/])?hire[.]me[/]?$/.test(url)) return err(`curl: (6) Could not resolve host: ${esc(url)}`);
      print(`HTTP/1.1 <span class="hl">200 OK</span>
content-type: application/json
x-powered-by: chai

${esc(JSON.stringify({ available: true, role: 'Full-Stack Developer', email: SITE.email, github: SITE.links.github }, null, 2))}`);
      foundSecret('curl');
    },
    rm: args => {
      if (!(args.includes('/') && args.some(a => /^-\w*r\w*$/.test(a)))) return err('rm: permission denied. (you would need something more reckless)');
      const targets = ['/home/vansh/projects', '/home/vansh/skills', '/home/vansh/resume.pdf', '/usr/bin/chai', '/'];
      targets.forEach((t, i) => setTimeout(() => print(`removed '${t}'`), i * 220));
      setTimeout(() => { close(); fakeWipe(); foundSecret('rm'); }, targets.length * 220 + 300);
    },
    vim: () => {
      // A terminal program: it owns the keyboard, and only :q! gets out
      const screen = print(`~
~              VIM - Vi IMproved
~
~        type  :q&lt;Enter&gt;  to exit (allegedly)
~
~`);
      const status = print('-- NORMAL --', 'cmd');
      let cmd = null, tries = 0;
      const fail = msg => { status.innerHTML = `<span class="hl2">${msg}</span>${++tries >= 5 ? '   <span class="dim">hint: the editor wants to be forced. :q!</span>' : ''}`; cmd = null; };
      const prog = {
        trap: true, // Escape and Ctrl+C go to the program instead of stopping it
        key(e) {
          if (e.key === 'Escape') return fail('-- NORMAL --  Esc will not save you.');
          if (cmd === null) {
            if (e.key === ':') { cmd = ':'; status.textContent = cmd; }
            else if (e.key.length === 1) fail('E492: Not an editor command. Try a colon.');
            return;
          }
          if (e.key === 'Backspace') cmd = cmd.slice(0, -1) || null;
          else if (e.key.length === 1) cmd += e.key;
          else if (e.key === 'Enter') {
            if (cmd === ':q!') {
              prog.stop();
              print('You escaped vim. Few do.');
              foundSecret('vim');
            } else if (/^:(q|wq|x|w|qa)$/.test(cmd)) fail('E37: No write since last change (add ! to override)');
            else fail(`E492: Not an editor command: ${esc(cmd.slice(1))}`);
            return;
          }
          status.textContent = cmd ?? '-- NORMAL --';
        },
        stop() { screen.remove(); status.remove(); },
      };
      term.run(prog);
    },
    matrix: () => { close(); setTimeout(matrixRain, 200); foundSecret('matrix'); },
    hack: () => {
      const steps = ['Bypassing firewall', 'Cracking 2048-bit chai', 'Downloading more RAM', 'Accessing mainframe'];
      steps.forEach((label, s) => {
        setTimeout(() => {
          const line = print('');
          let pct = 0;
          const timer = setInterval(() => {
            pct = Math.min(100, pct + 10 + Math.floor(Math.random() * 15));
            const fill = Math.round(pct / 5);
            line.innerHTML = `${label.padEnd(24)}[<span class="hl">${'#'.repeat(fill)}</span>${'.'.repeat(20 - fill)}] ${pct}%`;
            if (pct === 100) clearInterval(timer);
          }, 70);
        }, s * 750);
      });
      setTimeout(() => {
        print(`<span class="hl">ACCESS GRANTED.</span> 1 classified file found: resume.pdf
Run <span class="hl">resume</span> to exfiltrate it.`);
        foundSecret('hack');
      }, steps.length * 750 + 300);
    },
    man:    ([c]) => c && COMMANDS[c] ? print(`${esc(c)}: see <span class="hl">help</span> — this shell is too small for man pages.`) : err('What manual page do you want?'),
  };
  COMMANDS.dir = COMMANDS.ls;
  COMMANDS.cls = COMMANDS.clear;
  COMMANDS.vi = COMMANDS.vim;
  COMMANDS.secrets = COMMANDS.achievements;

  function run(raw) {
    const line = raw.trim();
    print(`<span class="term-ps">${esc(promptText())}</span> ${esc(line)}`, 'cmd');
    if (!line) return;
    history.push(line); hIdx = history.length;
    store.set('term-history', history.slice(-50));
    const [cmd, ...args] = line.split(/\s+/);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (fn) fn(args.map(a => a.toLowerCase()), line);
    else err(`command not found: ${esc(cmd)} — try <span class="hl">help</span>`);
  }

  function open(cmd) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    if (!booted) {
      booted = true;
      print('Welcome to <span class="hl">vansh.dev</span> — interactive shell v2.0');
      print('Type <span class="hl">help</span> to see what you can do. Try <span class="hl">neofetch</span> or <span class="hl">snake</span>.');
    }
    if (typeof cmd === 'string') run(cmd);
    setTimeout(() => (program ? body : input).focus(), 50);
    sfx('open');
  }
  function close() {
    program?.stop?.();
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    input.blur();
  }
  window.openTerminal = open;

  input.addEventListener('keydown', e => {
    if (e.key.length === 1) sfx('key');
    if (e.key === 'Enter') { run(input.value); input.value = ''; }
    else if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const val = input.value, sp = val.lastIndexOf(' ');
      if (sp < 0) {
        const match = Object.keys(COMMANDS).filter(c => c.startsWith(val.trim()));
        if (match.length === 1) input.value = match[0] + ' ';
        else if (match.length > 1) print(match.join('  '));
        return;
      }
      // Complete file and directory names
      const partial = val.slice(sp + 1), dirPart = partial.includes('/') ? partial.slice(0, partial.lastIndexOf('/') + 1) : '';
      const { node } = resolve(dirPart || '.');
      if (!node || typeof node !== 'object') return;
      const base = partial.slice(dirPart.length);
      const match = Object.keys(node).filter(k => k.toLowerCase().startsWith(base.toLowerCase()));
      if (match.length === 1) input.value = val.slice(0, sp + 1) + dirPart + match[0] + (typeof node[match[0]] === 'object' ? '/' : ' ');
      else if (match.length > 1) print(match.join('  '));
    }
  });

  document.getElementById('termToggle').addEventListener('click', () => open());
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (program && overlay.classList.contains('open')) {
      if (!program.trap && (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'c'))) { e.preventDefault(); program.stop(); return; }
      if (program.key(e) !== false) e.preventDefault();
      return;
    }
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement !== input;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay.classList.contains('open') ? close() : open(); }
    else if (e.key === '`' && !typing && !overlay.classList.contains('open')) { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  // API for games: they draw into the terminal body and own the keyboard until stop()
  return {
    print, err, body,
    run(p) {
      program = p;
      input.disabled = true;
      body.tabIndex = -1; body.focus();
      const stop = p.stop;
      p.stop = () => { if (program !== p) return; program = null; stop?.(); input.disabled = false; input.focus(); };
    },
  };
})();
