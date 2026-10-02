/* ════════════════════════════════════════════════════════════════
   Site config. Edit this file to change content; the other scripts
   only read from it.
   ════════════════════════════════════════════════════════════════ */

const SITE = {
  name: 'Vansh Minhas',
  email: 'vansh31082005@gmail.com',
  resume: 'assets/resume.pdf',
  links: {
    github:   'https://github.com/Vanshff007',
    linkedin: 'https://www.linkedin.com/in/vansh-minhas-913b1a291/',
    leetcode: 'https://leetcode.com/u/idgaf_vansh/',
  },
  leetcodeUser: 'idgaf_vansh',
  // Shown only when the live LeetCode APIs are unreachable. Update now and then.
  leetcodeFallback: { total: 505, easy: 326, medium: 169, hard: 10, rating: 1743, topPercentage: 11.17, streak: null },

  // Base URL of the Node server in server/. Set to '' to hide the features that
  // need it (AI chat, Spotify); LeetCode then uses a public fallback API.
  // Deployed on Render. On localhost it uses the server from `npm run dev` in server/.
  apiBase: ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3000' : 'https://portfolio-api-46jx.onrender.com',

  // The Spotify player always starts with this song (title from the playlist), then shuffles.
  firstSong: 'No One Noticed',

  // Giscus guestbook (https://giscus.app). Fill in repoId and categoryId
  // from the giscus.app setup page. Empty = guestbook shows a setup note.
  giscus: {
    repo: 'Vanshff007/Portfolio',
    repoId: 'R_kgDOR7erww',
    category: 'Announcements', // only maintainers and giscus can start threads here
    categoryId: 'DIC_kwDOR7erw84DG452',
  },

  // Namespace for the free visitor counter (abacus.jasoncameron.dev).
  counterNamespace: 'vanshff007-portfolio-v3',

  // "Currently" widget. Edit freely.
  now: {
    building: 'CodeArena — real-time 1v1 coding battles',
    learning: 'System design and distributed systems',
    reading:  'Designing Data-Intensive Applications',
    grinding: 'LeetCode contests, aiming for Knight badge',
  },

  // Lighthouse scores shown in the footer. Re-run Lighthouse and update.
  lighthouse: { performance: 86, accessibility: 100, bestPractices: 100, seo: 100 },
};

/* ── Journey timeline (oldest first, read top to bottom) ── */
const TIMELINE = [
  { when: '2021 – 2023', title: 'Class XII (CBSE), Delhi Public School Ranipur', kind: 'Education',
    text: 'Senior secondary education in Haridwar. Scored 90.8%.' },
  { when: '2023 – 2027', title: 'B.Tech Computer Science, USICT (GGSIPU)', kind: 'Education',
    text: 'University School of Information, Communication and Technology, New Delhi. CGPA 7.8.' },
  { when: 'Ongoing', title: '505+ LeetCode problems, 1743 contest rating', kind: 'Achievement',
    text: 'Consistent problem solving across arrays, graphs, DP and greedy. Top 11% in LeetCode contests.' },
  { when: '2025', title: 'Hackathons and contests', kind: 'Achievement',
    text: '3rd place at the Hack-O-Knight Hackathon. Rank 2463 in the Amazon ML Challenge. Rank 1073 in CodeChef Starters 234. Participated in Zomathon 2026.' },
  { when: 'Jul – Sep 2025', title: 'MERN Stack Web Development Intern, Coding Samurai', kind: 'Work',
    text: 'Built a real-time chat app and a blogging platform with Next.js and Express.js. Implemented REST APIs, secure authentication and database integration, and handled debugging and deployment on Vercel.' },
  { when: '2025 – 2026', title: 'Executive Member, ACM-ICPC Club USICT', kind: 'Leadership',
    text: 'Mentored first-year students in DSA bootcamps, teaching graph traversal (BFS, DFS) with live coding. Helped run coding and competitive programming events.' },
];

/* ── Projects ─────────────────────────────────────────────────────
   Repo list, stars, dates and links come from the GitHub API.
   PROJECT_INFO adds curated titles, descriptions and stacks, since the
   API only reports languages (not frameworks). The optional case-study
   fields (problem, arch, challenges, outcome) fill the project modal.
   `arch` is a list of layers drawn left to right as a diagram.
   New repos still show up automatically using their GitHub data.
────────────────────────────────────────────────────────────────── */
const GH_USER = 'Vanshff007';
const GH_EXCLUDE = ['Vanshff007', 'tic-tac-toe-firebase', 'CodeArena', 'my-portfolio', 'code-together', 'Tic-Tac-Toe', 'To-do-app']; // profile README, empty repo, early stub, old portfolio, hidden by choice
const PROJECT_INFO = {
  'Code_Arena': {
    title: 'CodeArena', category: 'Full-Stack',
    desc: 'Real-time 1v1 competitive coding battles: two players get the same problem and the first correct submission wins. Sandboxed execution in Docker (C++, Java, Python), JWT auth, leaderboards, match history and a skill radar.',
    tech: ['React', 'Vite', 'Tailwind', 'Monaco Editor', 'Node.js', 'Express', 'Socket.io', 'MongoDB', 'Docker', 'JWT', 'Vitest'],
    problem: 'Practice platforms are solitary. CodeArena makes problem solving competitive: two players race on the same problem in real time, and ratings track who improves.',
    arch: ['React + Monaco', 'Socket.io', 'Express API', 'Docker sandbox', 'MongoDB'],
    challenges: [
      'Running untrusted code safely: each submission runs in a resource-limited Docker container with timeouts.',
      'Keeping both players in sync: match state lives on the server and is pushed over Socket.io.',
      'Fair matchmaking based on rating and shared problem-solving topics.',
    ],
    outcome: 'Full match loop working end to end, with JWT auth, leaderboards, match history and tests in Vitest.',
  },
  'paint-together': {
    title: 'Paint Together', category: 'Full-Stack',
    desc: 'Real-time collaborative drawing app. Draw, chat and see live cursors on a shared canvas, with room-based sessions, undo history and persistent rooms.',
    tech: ['JavaScript', 'Canvas API', 'Node.js', 'Express', 'Socket.io', 'MongoDB'],
    problem: 'Sketching ideas together online usually needs a heavy whiteboard tool. Paint Together is a light, instant shared canvas: share a room link and draw.',
    arch: ['Canvas client', 'Socket.io', 'Node + Express', 'MongoDB'],
    challenges: [
      'Several users drawing at once with no crossed strokes, synced over Socket.io.',
      'Canvases survive server restarts: rooms autosave to MongoDB.',
      'Shared undo and redo with a 30-step history per room.',
    ],
    outcome: 'Live on Render with rooms, live cursors, chat, host controls and tests using node:test.',
  },
  'RAG_Application': {
    title: 'RAG Application', category: 'AI / ML',
    desc: 'Ask questions about your own PDF, TXT or DOCX files. Uses query expansion and FAISS vector search with NVIDIA embedding and LLM APIs, plus a strict document-only mode.',
    tech: ['Python', 'Streamlit', 'FAISS', 'FastEmbed', 'LangChain', 'NVIDIA API'],
    problem: 'LLMs answer confidently even when a document does not support the answer. This app grounds answers in your own files.',
    arch: ['Streamlit UI', 'Chunk + embed', 'FAISS index', 'Query expansion', 'LLM answer'],
    challenges: [
      'Better recall with query expansion: the question is rewritten into several searches.',
      'A document-only mode restricts answers to the uploaded files; the hybrid mode falls back to general knowledge.',
    ],
    outcome: 'Works with PDF, TXT and DOCX uploads through a simple Streamlit interface.',
  },
  'Hate-Speech-Classifier': {
    title: 'Hate Speech Classifier', category: 'AI / ML',
    desc: 'Multi-label hate speech classifier built on a Bidirectional LSTM, with EDA notebooks and a Streamlit web app for live predictions.',
    tech: ['Python', 'TensorFlow', 'Bi-LSTM', 'NLTK', 'scikit-learn', 'Pandas', 'Streamlit'],
    problem: 'Moderating text at scale needs a model that flags several kinds of toxic content at once, not a single yes/no.',
    arch: ['Text cleaning (NLTK)', 'Tokenize + pad', 'Bi-LSTM', 'Multi-label output', 'Streamlit app'],
    challenges: [
      'Six labels at once: toxic, severe toxic, obscene, threat, insult and identity hate.',
      'Trained on the Jigsaw Toxic Comment dataset, with a Bidirectional LSTM reading text in both directions.',
    ],
    outcome: 'EDA notebooks plus a Streamlit app for live predictions.',
  },
  'Portfolio': {
    title: 'Portfolio', category: 'Frontend',
    desc: 'This site. Hand-coded portfolio with live GitHub data, an interactive terminal and canvas effects.',
    tech: ['HTML', 'CSS', 'JavaScript', 'GitHub API', 'Node.js', 'Gemini API'],
    problem: 'A portfolio that shows how I build, not only what I built.',
    arch: ['Static HTML/CSS/JS', 'GitHub + LeetCode APIs', 'Node server', 'Gemini API'],
    challenges: [
      'No framework and no build step, but still organized and fast.',
      'Staying within GitHub\'s unauthenticated rate limit with local caching.',
    ],
    outcome: 'Terminal, command palette, themes, games, live stats and an AI assistant.',
  },
};
const FEATURED_ORDER = ['Code_Arena', 'paint-together', 'RAG_Application', 'Hate-Speech-Classifier', 'Portfolio'];
const LANG_COLORS = { JavaScript: '#f1e05a', Python: '#3572A5', HTML: '#e34c26', CSS: '#663399', 'Jupyter Notebook': '#DA5B0B', TypeScript: '#3178c6', Java: '#b07219', 'C++': '#f34b7d' };

/* ── Skills shown in the bar view and the graph view ── */
const SKILL_GROUPS = [
  { name: 'Frontend', skills: [['HTML / CSS', 90], ['JavaScript', 88], ['React', 80], ['Next.js', 70], ['Tailwind CSS', 75], ['Canvas API', 78]] },
  { name: 'Backend & Realtime', skills: [['Node.js / Express', 82], ['Socket.io', 85], ['REST APIs', 80], ['JWT Auth & Security', 72]] },
  { name: 'Data & DevOps', skills: [['MongoDB / Mongoose', 78], ['MySQL', 65], ['Firebase', 70], ['Docker', 62], ['GitHub Actions CI', 60]] },
  { name: 'AI / ML', skills: [['Python', 78], ['TensorFlow / Keras', 68], ['NLP (LSTM, NLTK)', 68], ['RAG & Vector Search', 70], ['Streamlit', 75]] },
  { name: 'CS Fundamentals', skills: [['C / C++', 80], ['DSA', 80], ['Problem Solving', 82]] },
];
// Maps a skill name to the tech chips in PROJECT_INFO that count as using it
const SKILL_ALIASES = {
  'HTML / CSS': ['HTML', 'CSS'], 'JavaScript': ['JavaScript'], 'React': ['React'], 'Tailwind CSS': ['Tailwind'],
  'Canvas API': ['Canvas API'], 'Node.js / Express': ['Node.js', 'Express'], 'Socket.io': ['Socket.io'],
  'JWT Auth & Security': ['JWT'], 'MongoDB / Mongoose': ['MongoDB'], 'Firebase': ['Firebase'], 'Docker': ['Docker'],
  'Python': ['Python'], 'TensorFlow / Keras': ['TensorFlow'], 'NLP (LSTM, NLTK)': ['NLTK', 'Bi-LSTM'],
  'RAG & Vector Search': ['FAISS', 'LangChain', 'FastEmbed'], 'Streamlit': ['Streamlit'], 'REST APIs': ['Express'],
};
