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
    throw new Error(`GitHub API error ${response.status}`);
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
  languageSelect.innerHTML = '<option value="all">All languages</option>';
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
    <article class="github-stat"><h3>Public repositories</h3><p>${repos.length}</p></article>
    <article class="github-stat"><h3>Total stars</h3><p>${totalStars}</p></article>
    <article class="github-stat"><h3>Total forks</h3><p>${totalForks}</p></article>
    <article class="github-stat"><h3>Languages detected</h3><p>${languages}</p></article>
    <article class="github-stat"><h3>Active (14d)</h3><p>${recentPushes}</p></article>
    <article class="github-stat"><h3>Push days (tracked)</h3><p>${streakApprox}</p></article>
  `;

  if (activityContainer) {
    const heatmap = buildHeatmap(repos);
    const activityItems = (events || [])
      .slice(0, 6)
      .map((evt) => {
        const repoName = evt.repo?.name || 'repository';
        const action = evt.type.replace('Event', '');
        return `<article class="activity-card"><h3>${action}</h3><p>${repoName} · ${formatDate(evt.created_at)}</p></article>`;
      })
      .join('');

    activityContainer.innerHTML = `
      <article class="activity-card">
        <h3>Contribution heatmap</h3>
        <p class="muted small">Derived from repository push dates (GitHub Pages–friendly).</p>
        <div class="heatmap">${heatmap}</div>
      </article>
      ${activityItems}
    `;
  }
};

const buildHeatmap = (repos) => {
  const buckets = Array.from({ length: 12 * 7 }, () => 0);
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
      const alpha = 0.12 + intensity * 0.75;
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
      <p class="pinned-badge">Pinned spotlight</p>
      <h3>${repo.name}</h3>
      <p>${repo.description || 'No description available'}</p>
      <div class="github-meta">
        <span>${repo.stargazers_count || 0} stars</span>
        <span>${repo.forks_count || 0} forks</span>
        <span>${repo.language || 'n/a'}</span>
        <span>${formatDate(repo.updated_at)}</span>
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
        <span>${repo.stargazers_count || 0} stars</span>
        <span>${repo.forks_count || 0} forks</span>
        <span>${repo.language || 'n/a'}</span>
        <span>${formatDate(repo.updated_at)}</span>
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
        'GitHub data could not be refreshed. Cached results may be shown; try again shortly.';
    }
    if (!cached && repoList) {
      repoList.innerHTML = '<p class="error-message">Unable to load repositories right now.</p>';
    }
  }
};

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-list');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach((link) =>
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    })
  );
}

const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('active');
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -5% 0px' }
);
revealEls.forEach((el) => io.observe(el));

if (searchInput) searchInput.addEventListener('input', applyFilters);
if (languageSelect) languageSelect.addEventListener('change', applyFilters);

loadGithubData();
