const API_BASE_URL = 'http://localhost:3000';

let allMeds   = [];   // full list from API
let filtered  = [];   // after search filter
let activeId  = null; // currently displayed med ID (always Number)

// ── Utility ──────────────────────────────────────────────────────────────────

const byId = (id) => document.getElementById(id);

function normalize(s) {
  return (s ?? '').toString().toLowerCase();
}

// ── Counts / search display ───────────────────────────────────────────────────

function setCounts(query = '') {
  const pill = byId('count-pill');
  if (pill) pill.textContent = `${allMeds.length} med${allMeds.length !== 1 ? 's' : ''}`;

  // FIX #2: Only show "X of Y results" when user is actively searching
  const sc = byId('search-count');
  if (sc) {
    sc.textContent = query
      ? `${filtered.length} of ${allMeds.length} results`
      : '';
  }
}

// ── Search matching ───────────────────────────────────────────────────────────

function matches(med, q) {
  if (!q) return true;
  return (
    normalize(med.name).includes(q) ||
    normalize(med.usage).includes(q) ||
    normalize(med.dosage).includes(q) ||
    normalize(med.side_effects).includes(q)
  );
}

// ── List render ───────────────────────────────────────────────────────────────

function renderList(query = '') {
  const list = byId('med-list');
  if (!list) return;
  list.innerHTML = '';

  // FIX #8: Empty states for no data and no search results
  if (allMeds.length === 0) {
    list.innerHTML = `
      <div class="empty-list">
        <div class="icon">💊</div>
        <div>No medications in database.</div>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-list">
        <div class="icon">🔍</div>
        <div>No results for <strong>"${query}"</strong></div>
      </div>`;
    return;
  }

  filtered.forEach((m) => {
    const div = document.createElement('div');
    // FIX #3: Compare using Number() on both sides to avoid string vs number mismatch
    div.className = `item${Number(m.id) === activeId ? ' active' : ''}`;
    div.textContent = m.name;
    div.tabIndex = 0;
    div.addEventListener('click', () => selectMedication(Number(m.id)));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') selectMedication(Number(m.id));
    });
    list.appendChild(div);
  });

  // Scroll the active item into view in the sidebar
  const activeEl = list.querySelector('.item.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

// ── Hide / reveal logic ───────────────────────────────────────────────────────

function applyHideStates() {
  const hideUsage  = byId('hide-usage')?.checked;
  const hideDosage = byId('hide-dosage')?.checked;
  const hideSe     = byId('hide-se')?.checked;

  byId('card-usage')?.classList.toggle('hidden', Boolean(hideUsage));
  byId('card-dosage')?.classList.toggle('hidden', Boolean(hideDosage));
  byId('card-se')?.classList.toggle('hidden', Boolean(hideSe));
}

// ── Nav position label ────────────────────────────────────────────────────────

function updateNavButtons() {
  const idx     = filtered.findIndex(m => Number(m.id) === activeId);
  const total   = filtered.length;
  const navPos  = byId('nav-pos');
  const btnPrev = byId('btn-prev');
  const btnNext = byId('btn-next');

  if (idx === -1 || total === 0) {
    if (navPos)  navPos.textContent  = '—';
    if (btnPrev) btnPrev.disabled    = true;
    if (btnNext) btnNext.disabled    = true;
    return;
  }

  if (navPos)  navPos.textContent  = `${idx + 1} / ${total}`;
  if (btnPrev) btnPrev.disabled    = idx === 0;
  if (btnNext) btnNext.disabled    = idx === total - 1;
}

// ── Set card content ──────────────────────────────────────────────────────────

function setCard(med) {
  // FIX #3/#4: always store activeId as a Number
  activeId = med ? Number(med.id) : null;

  byId('card-name').textContent = med?.name ?? 'Pick a medication';
  byId('card-sub').textContent  = med
    ? `ID ${med.id} · ${filtered.findIndex(m => Number(m.id) === activeId) + 1} of ${filtered.length}`
    : 'Select from the list or press Random.';

  const detailBody = byId('detail-body');
  if (!detailBody) return;

  if (!med) {
    detailBody.innerHTML = `
      <div class="welcome">
        <div class="icon">💊</div>
        <p>Select a medication from the list<br>or press <strong>Random</strong> to get started.</p>
      </div>`;
    updateNavButtons();
    return;
  }

  // Build the three content sections
  detailBody.innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Usage <span style="font-weight:400;opacity:0.6;font-size:0.75rem;">(Indikasi)</span></h3>
      </div>
      <div id="card-usage" class="section-body ${med.usage ? '' : 'placeholder'}">
        ${med.usage ? med.usage : 'No usage data.'}
      </div>
    </div>
    <div class="section">
      <div class="section-header"><h3>Dosage</h3></div>
      <div id="card-dosage" class="section-body ${med.dosage ? '' : 'placeholder'}">
        ${med.dosage ? med.dosage : 'No dosage data.'}
      </div>
    </div>
    <div class="section">
      <div class="section-header"><h3>Side Effects</h3></div>
      <div id="card-se" class="section-body ${med.side_effects ? '' : 'placeholder'}">
        ${med.side_effects ? med.side_effects : 'No side effects listed.'}
      </div>
    </div>
  `;

  applyHideStates();
  renderList();
  updateNavButtons();
}

// ── Select by ID ──────────────────────────────────────────────────────────────

function selectMedication(id) {
  // FIX #3: cast to Number so "5" === 5 works regardless of backend type
  const med = allMeds.find(m => Number(m.id) === Number(id));
  if (med) setCard(med);
}

// ── Navigation (Prev / Next) ──────────────────────────────────────────────────

function navigateBy(delta) {
  if (!filtered.length) return;
  const idx = filtered.findIndex(m => Number(m.id) === activeId);
  const next = idx + delta;
  if (next >= 0 && next < filtered.length) {
    setCard(filtered[next]);
  }
}

// ── Random ────────────────────────────────────────────────────────────────────

function pickRandom() {
  if (!filtered.length) return;

  // FIX #6: avoid returning the same medication as the currently active one
  let candidates = filtered.filter(m => Number(m.id) !== activeId);

  // If only one medication exists, allow re-picking it
  if (candidates.length === 0) candidates = filtered;

  const med = candidates[Math.floor(Math.random() * candidates.length)];
  setCard(med);
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
  const list = byId('med-list');

  // FIX #7: Show skeleton while loading
  if (list) {
    list.innerHTML = [1, 2, 3, 4].map(() => `
      <div class="skel-item">
        <div class="skel-line" style="width:${55 + Math.random() * 35}%"></div>
      </div>
    `).join('');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/medications`);

    // FIX #1: Check response.ok before parsing — previously a 4xx/5xx was silently swallowed
    if (!res.ok) {
      throw new Error(`Server returned ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    allMeds  = Array.isArray(data) ? data : [];
    filtered = [...allMeds].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));

    setCounts();
    renderList();
  } catch (e) {
    console.error(e);
    allMeds  = [];
    filtered = [];
    setCounts();

    if (list) {
      list.innerHTML = `
        <div class="empty-list">
          <div class="icon">⚠️</div>
          <div>Failed to load.<br>
            <button onclick="load()" style="margin-top:10px;font-size:0.8rem;padding:6px 12px;">
              Try Again
            </button>
          </div>
        </div>`;
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Search
  const search   = byId('study-search');
  const clearBtn = byId('search-clear');
  let   lastQuery = '';

  if (search) {
    search.addEventListener('input', (e) => {
      const q = normalize(e.target?.value).trim();
      lastQuery = q;

      filtered = allMeds
        .filter(m => matches(m, q))
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));

      // FIX #4: use Number() in the check to avoid type mismatch
      if (activeId !== null && !filtered.some(m => Number(m.id) === activeId)) {
        activeId = null;
        setCard(null);
      }

      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      setCounts(q);
      renderList(q);
      updateNavButtons();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (search) search.value = '';
      lastQuery = '';
      clearBtn.style.display = 'none';
      filtered = [...allMeds].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
      setCounts('');
      renderList('');
      updateNavButtons();
      search?.focus();
    });
  }

  // Random
  byId('random')?.addEventListener('click', pickRandom);

  // Prev / Next
  byId('btn-prev')?.addEventListener('click', () => navigateBy(-1));
  byId('btn-next')?.addEventListener('click', () => navigateBy(+1));

  // Hide toggles
  ['hide-usage', 'hide-dosage', 'hide-se'].forEach(id => {
    byId(id)?.addEventListener('change', applyHideStates);
  });

  // FIX #5: Null-guard each checkbox before accessing .checked
  byId('reveal')?.addEventListener('click', () => {
    const u = byId('hide-usage');
    const d = byId('hide-dosage');
    const s = byId('hide-se');
    if (u) u.checked = false;
    if (d) d.checked = false;
    if (s) s.checked = false;
    applyHideStates();
  });

  load();
});