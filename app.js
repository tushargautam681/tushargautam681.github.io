const username = 'tushargautam681'; // GitHub username (original integration preserved)
const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`;
const eventsUrl = `https://api.github.com/users/${username}/events/public?per_page=30`;

const repoList = document.getElementById('repo-list');
const statsContainer = document.getElementById('github-stats');
const activityContainer = document.getElementById('github-activity');
const errorBox = document.getElementById('github-error');
const searchInput = document.getElementById('repo-search');
const languageSelect = document.getElementById('language-filter');

const CACHE_KEY = `github_repos_cache_${username}`;
const CACHE_TTL_MS = 10 * 60 * 1000;

let allRepos = [];

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expiresAt || Date.now() > parsed.expiresAt) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = (data) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, data })
    );
  } catch {
    // ignore storage failures
  }
};

const skeletonMarkup = () =>
  Array.from({ length: 6 })
    .map(() => '<div class="skeleton"></div>')
    .join('');

const renderSkeletons = () => {
  if (repoList) repoList.innerHTML = skeletonMarkup();
  if (statsContainer) statsContainer.innerHTML = skeletonMarkup();
  if (activityContainer) activityContainer.innerHTML = skeletonMarkup();
};

const safeFetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    const message = `GitHub API error ${response.status}`;
    throw new Error(message);
  }
  return response.json();
};

const formatDate = (iso) => {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const buildLanguageOptions = (repos) => {
  if (!languageSelect) return;
  const langs = new Set();
  repos.forEach((repo) => {
    if (repo.language) langs.add(repo.language);
  });
  const sorted = Array.from(langs).sort((a, b) => a.localeCompare(b));
  languageSelect.innerHTML = '<option value="all">All Languages</option>';
  sorted.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    languageSelect.appendChild(opt);
  });
};

const renderStats = (repos, events) => {
  if (!statsContainer) return;
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
  const languages = new Set(repos.map((r) => r.language).filter(Boolean)).size;
  const recentPushes = repos.filter((r) => {
    const pushed = new Date(r.pushed_at);
    return Date.now() - pushed.getTime() < 1000 * 60 * 60 * 24 * 14;
  }).length;

  const pushDays = new Set();
  repos.forEach((repo) => {
    if (!repo.pushed_at) return;
    pushDays.add(new Date(repo.pushed_at).toDateString());
  });
  const streakApprox = pushDays.size;

  statsContainer.innerHTML = `
    <article class="github-stat"><h3>Public Repositories</h3><p>${repos.length}</p></article>
    <article class="github-stat"><h3>Total Stars</h3><p>${totalStars}</p></article>
    <article class="github-stat"><h3>Total Forks</h3><p>${totalForks}</p></article>
    <article class="github-stat"><h3>Languages Detected</h3><p>${languages}</p></article>
    <article class="github-stat"><h3>Active (14d)</h3><p>${recentPushes}</p></article>
    <article class="github-stat"><h3>Push Days (tracked)</h3><p>${streakApprox}</p></article>
  `;

  if (activityContainer) {
    const heatmap = buildHeatmap(repos);
    const activityItems = (events || [])
      .slice(0, 6)
      .map((evt) => {
        const repoName = evt.repo?.name || 'repository';
        const action = evt.type.replace('Event', '');
        return `<article class="activity-card"><h3>${action}</h3><p>${repoName} • ${formatDate(evt.created_at)}</p></article>`;
      })
      .join('');

    activityContainer.innerHTML = `
      <article class="activity-card">
        <h3>Contribution Heatmap</h3>
        <p>Derived from repository push activity (GitHub Pages safe).</p>
        <div class="heatmap">${heatmap}</div>
      </article>
      ${activityItems}
    `;
  }
};

const buildHeatmap = (repos) => {
  const weeks = 12;
  const days = 7;
  const buckets = Array.from({ length: weeks * days }, () => 0);
  repos.forEach((repo) => {
    if (!repo.pushed_at) return;
    const pushed = new Date(repo.pushed_at).getTime();
    const idx = Math.min(
      buckets.length - 1,
      Math.floor((Date.now() - pushed) / (1000 * 60 * 60 * 24))
    );
    if (idx >= 0 && idx < buckets.length) buckets[idx] += 1;
  });
  const max = Math.max(...buckets, 1);
  return buckets
    .map((count) => {
      const intensity = Math.min(1, count / max);
      const alpha = 0.15 + intensity * 0.85;
      return `<span style="background:rgba(0,229,255,${alpha.toFixed(2)})"></span>`;
    })
    .join('');
};

const renderRepos = (repos) => {
  if (!repoList) return;
  repoList.innerHTML = '';

  const pinned = [...repos]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 3);

  pinned.forEach((repo) => {
    const card = document.createElement('article');
    card.className = 'github-card';
    card.innerHTML = `
      <p style="color:#00e5ff;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;">Pinned Spotlight</p>
      <h3>${repo.name}</h3>
      <p>${repo.description || 'No description available'}</p>
      <div class="github-meta">
        <span>⭐ ${repo.stargazers_count || 0}</span>
        <span>🍴 ${repo.forks_count || 0}</span>
        <span>${repo.language || 'Language n/a'}</span>
        <span>Updated ${formatDate(repo.updated_at)}</span>
      </div>
      <a class="repo-link" href="${repo.html_url}" target="_blank" rel="noreferrer">Open repository →</a>
    `;
    repoList.appendChild(card);
  });

  const pinnedNames = new Set(pinned.map((r) => r.name));
  repos.forEach((repo) => {
    if (pinnedNames.has(repo.name)) return;
    const card = document.createElement('article');
    card.className = 'github-card';
    card.innerHTML = `
      <h3>${repo.name}</h3>
      <p>${repo.description || 'No description available'}</p>
      <div class="github-meta">
        <span>⭐ ${repo.stargazers_count || 0}</span>
        <span>🍴 ${repo.forks_count || 0}</span>
        <span>${repo.language || 'Language n/a'}</span>
        <span>Updated ${formatDate(repo.updated_at)}</span>
      </div>
      <a class="repo-link" href="${repo.html_url}" target="_blank" rel="noreferrer">View on GitHub →</a>
    `;
    repoList.appendChild(card);
  });
};

const applyFilters = () => {
  const term = (searchInput?.value || '').toLowerCase();
  const lang = languageSelect?.value || 'all';
  const filtered = allRepos.filter((repo) => {
    const matchesLang = lang === 'all' || repo.language === lang;
    const matchesTerm =
      !term ||
      repo.name.toLowerCase().includes(term) ||
      (repo.description || '').toLowerCase().includes(term);
    return matchesLang && matchesTerm;
  });
  renderRepos(filtered);
};

const loadGithubData = async () => {
  renderSkeletons();
  if (errorBox) errorBox.textContent = '';

  const cached = readCache();
  if (cached) {
    allRepos = cached;
    buildLanguageOptions(allRepos);
    renderStats(allRepos, []);
    applyFilters();
  }

  try {
    const [repos, events] = await Promise.all([safeFetchJson(reposUrl), safeFetchJson(eventsUrl)]);
    allRepos = repos;
    writeCache(repos);
    buildLanguageOptions(allRepos);
    renderStats(allRepos, events);
    applyFilters();
  } catch (err) {
    console.error('GitHub fetch failed:', err);
    if (errorBox) {
      errorBox.textContent =
        'GitHub data could not be refreshed. Showing cached results if available, otherwise please retry shortly.';
    }
    if (!cached && repoList) {
      repoList.innerHTML = '<p class="error-message">Unable to load repositories right now.</p>';
    }
  }
};

// Navigation + interactions
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-list');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach((link) =>
    link.addEventListener('click', () => nav.classList.remove('open'))
  );
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('active');
    });
  },
  { threshold: 0.2 }
);
revealEls.forEach((el) => io.observe(el));

// Custom cursor + parallax orbs
const dot = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
const orbs = document.querySelectorAll('.bg-orb');
let mouseX = 0;
let mouseY = 0;
let ringX = 0;
let ringY = 0;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (dot) {
    dot.style.left = `${mouseX}px`;
    dot.style.top = `${mouseY}px`;
  }
  orbs.forEach((orb, idx) => {
    const depth = idx + 1;
    const x = (window.innerWidth / 2 - mouseX) / (40 / depth);
    const y = (window.innerHeight / 2 - mouseY) / (40 / depth);
    orb.style.transform = `translate(${x}px, ${y}px)`;
  });
});

const animateRing = () => {
  ringX += (mouseX - ringX) * 0.18;
  ringY += (mouseY - ringY) * 0.18;
  if (ring) {
    ring.style.left = `${ringX}px`;
    ring.style.top = `${ringY}px`;
  }
  requestAnimationFrame(animateRing);
};
animateRing();

// Magnetic buttons
document.querySelectorAll('.magnetic').forEach((btn) => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translate(0, 0)';
  });
});

if (searchInput) searchInput.addEventListener('input', applyFilters);
if (languageSelect) languageSelect.addEventListener('change', applyFilters);

loadGithubData();
