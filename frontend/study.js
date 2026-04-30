const API_BASE_URL = 'https://nursing-system.onrender.com';

let allMeds  = [];   // full list from API
let filtered = [];   // after search filter
let activeId = null; // currently displayed med ID (always Number)

// ── Utility ───────────────────────────────────────────────────────────────────

const byId = (id) => document.getElementById(id);

function normalize(s) { return (s ?? '').toString().toLowerCase(); }

/** Escapes HTML special characters to prevent XSS. */
function escHtml(str) {
    return (str ?? '').toString()
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Splits a semicolon / newline-separated string into an HTML bullet list.
 * Used to render indications and side_effects in the detail card.
 */
function toBullets(str) {
    if (!str || !str.trim())
        return '<span style="color:#94a3b8;font-style:italic;">Tiada data</span>';

    const items = str.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);

    if (items.length === 1)
        return `<span>${escHtml(items[0])}</span>`;

    return `<ul style="margin:8px 0 0 18px;padding:0;list-style:disc;">${
        items.map(i => `<li style="margin-bottom:5px;line-height:1.55;">${escHtml(i)}</li>`).join('')
    }</ul>`;
}

// ── Counts / search display ───────────────────────────────────────────────────

function setCounts(query = '') {
    const pill = byId('count-pill');
    if (pill) pill.textContent = `${allMeds.length} med${allMeds.length !== 1 ? 's' : ''}`;

    const sc = byId('search-count');
    if (sc) sc.textContent = query ? `${filtered.length} of ${allMeds.length} results` : '';
}

// ── Search matching ───────────────────────────────────────────────────────────

function matches(med, q) {
    if (!q) return true;
    return (
        normalize(med.name).includes(q)         ||
        normalize(med.indications).includes(q)        ||
        normalize(med.side_effects).includes(q)
    );
}

// ── List render ───────────────────────────────────────────────────────────────

function renderList(query = '') {
    const list = byId('med-list');
    if (!list) return;
    list.innerHTML = '';

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
                <div>No results for <strong>"${escHtml(query)}"</strong></div>
            </div>`;
        return;
    }

    filtered.forEach((m) => {
        const div = document.createElement('div');
        div.className = `item${Number(m.id) === activeId ? ' active' : ''}`;
        div.textContent = m.name;
        div.tabIndex    = 0;
        div.addEventListener('click',   () => selectMedication(Number(m.id)));
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') selectMedication(Number(m.id));
        });
        list.appendChild(div);
    });

    list.querySelector('.item.active')?.scrollIntoView({ block: 'nearest' });
}

// ── Hide / reveal ─────────────────────────────────────────────────────────────

function applyHideStates() {
    byId('card-indications')?.classList.toggle('hidden', Boolean(byId('hide-indications')?.checked));
    byId('card-se')?.classList.toggle('hidden',    Boolean(byId('hide-se')?.checked));
}

// ── Nav buttons ───────────────────────────────────────────────────────────────

function updateNavButtons() {
    const idx     = filtered.findIndex(m => Number(m.id) === activeId);
    const total   = filtered.length;
    const navPos  = byId('nav-pos');
    const btnPrev = byId('btn-prev');
    const btnNext = byId('btn-next');

    if (idx === -1 || total === 0) {
        if (navPos)  navPos.textContent = '—';
        if (btnPrev) btnPrev.disabled   = true;
        if (btnNext) btnNext.disabled   = true;
        return;
    }

    if (navPos)  navPos.textContent = `${idx + 1} / ${total}`;
    if (btnPrev) btnPrev.disabled   = idx === 0;
    if (btnNext) btnNext.disabled   = idx === total - 1;
}

// ── Set card content ──────────────────────────────────────────────────────────

function setCard(med) {
    activeId = med ? Number(med.id) : null;

    const nameEl = byId('card-name');
    const subEl  = byId('card-sub');
    if (nameEl) nameEl.textContent = med?.name ?? 'Pick a medication';
    if (subEl)  subEl.textContent  = med
        ? `ID ${med.id} · ${filtered.findIndex(m => Number(m.id) === activeId) + 1} of ${filtered.length}`
        : 'Select from the list or press Random.';

    const body = byId('detail-body');
    if (!body) return;

    if (!med) {
        body.innerHTML = `
            <div class="welcome">
                <div class="icon">💊</div>
                <h3>Ready to study?</h3>
                <p>Select a medication from the list<br>or press <strong>Random</strong> to get started.</p>
            </div>`;
        updateNavButtons();
        return;
    }

    // Render indications and side_effects as bullet lists
    body.innerHTML = `
        <div class="section">
            <div class="section-label">Indications</div>
            <div id="card-indications" class="section-body">
                ${toBullets(med.indications)}
            </div>
        </div>
        <div class="section">
            <div class="section-label">Side Effects</div>
            <div id="card-se" class="section-body">
                ${toBullets(med.side_effects)}
            </div>
        </div>
    `;

    applyHideStates();
    renderList();
    updateNavButtons();
}

// ── Select by ID ──────────────────────────────────────────────────────────────

function selectMedication(id) {
    const med = allMeds.find(m => Number(m.id) === Number(id));
    if (med) setCard(med);
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigateBy(delta) {
    if (!filtered.length) return;
    const idx  = filtered.findIndex(m => Number(m.id) === activeId);
    const next = idx + delta;
    if (next >= 0 && next < filtered.length) setCard(filtered[next]);
}

// ── Random ────────────────────────────────────────────────────────────────────

function pickRandom() {
    if (!filtered.length) return;
    let pool = filtered.filter(m => Number(m.id) !== activeId);
    if (pool.length === 0) pool = filtered;
    setCard(pool[Math.floor(Math.random() * pool.length)]);
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
    const list = byId('med-list');

    if (list) {
        list.innerHTML = [1, 2, 3, 4].map(() => `
            <div class="skel-item">
                <div class="skel-line" style="width:${55 + Math.random() * 35}%"></div>
            </div>`).join('');
    }

    try {
        const res = await fetch(`${API_BASE_URL}/medications`);
        if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);

        const data = await res.json();
        allMeds  = Array.isArray(data) ? data : [];
        filtered = [...allMeds].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));

        setCounts();
        renderList();
    } catch (e) {
        console.error(e);
        allMeds = filtered = [];
        setCounts();
        if (list) {
            list.innerHTML = `
                <div class="empty-list">
                    <div class="icon">⚠️</div>
                    <div>Failed to load.<br>
                        <button onclick="load()" style="margin-top:10px;font-size:0.8rem;padding:6px 12px;">
                            ↺ Try Again
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

    search?.addEventListener('input', (e) => {
        const q = normalize(e.target.value).trim();

        filtered = allMeds
            .filter(m => matches(m, q))
            .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));

        if (activeId !== null && !filtered.some(m => Number(m.id) === activeId)) {
            activeId = null;
            setCard(null);
        }

        if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
        setCounts(q);
        renderList(q);
        updateNavButtons();
    });

    clearBtn?.addEventListener('click', () => {
        if (search) search.value = '';
        clearBtn.style.display = 'none';
        filtered = [...allMeds].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
        setCounts('');
        renderList('');
        updateNavButtons();
        search?.focus();
    });

    // Random / Prev / Next
    byId('random')?.addEventListener('click', pickRandom);
    byId('btn-prev')?.addEventListener('click', () => navigateBy(-1));
    byId('btn-next')?.addEventListener('click', () => navigateBy(+1));

    // Hide toggles — dosage removed
    ['hide-indications', 'hide-se'].forEach(id => {
        byId(id)?.addEventListener('change', applyHideStates);
    });

    // Reveal all
    byId('reveal')?.addEventListener('click', () => {
        const u = byId('hide-indications');
        const s = byId('hide-se');
        if (u) u.checked = false;
        if (s) s.checked = false;
        applyHideStates();
    });

    load();
});