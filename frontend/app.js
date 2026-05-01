const API_BASE_URL = 'https://nursing-system.onrender.com';

let editingMedicationId = null;
let editingUnlocked     = false;
let allMedications      = [];
let searchQuery         = '';

// ── Utility ───────────────────────────────────────────────────────────────────

const byId = (id) => document.getElementById(id);

/** Escapes HTML special characters to prevent XSS. */
function escHtml(str) {
    return (str ?? '').toString()
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Converts a comma / semicolon / newline-separated string into an HTML
 * bullet list.  Single items skip the list wrapper.
 * Empty strings → italic dash placeholder.
 */
function toBullets(str) {
    if (!str || !str.trim())
        return '<span style="color:#94a3b8;font-style:italic;">—</span>';

    const items = str.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);

    if (items.length === 1)
        return `<span>${escHtml(items[0])}</span>`;

    return `<ul style="margin:6px 0 0 18px;padding:0;list-style:disc;">${
        items.map(i => `<li style="margin-bottom:4px;">${escHtml(i)}</li>`).join('')
    }</ul>`;
}

function setAddStatus(message, kind) {
    const el = byId('add-status');
    if (!el) return;
    el.textContent = message || '';
    el.className   = `status${kind ? ` ${kind}` : ''}`;
}

function normalizeText(s) { return (s ?? '').toString().toLowerCase(); }

function matchesSearch(med) {
    if (!searchQuery) return true;
    return (
        normalizeText(med.name).includes(searchQuery) ||
        normalizeText(med.indications).includes(searchQuery) ||
        normalizeText(med.side_effects).includes(searchQuery)
    );
}

function setSearchCount(visible, total) {
    const el = byId('search-count');
    if (!el) return;
    if (searchQuery && total > 0) {
        el.textContent = `${visible} of ${total} results`;
        el.classList.add('visible');
    } else {
        el.textContent = '';
        el.classList.remove('visible');
    }
}

// ── API ───────────────────────────────────────────────────────────────────────

async function addMedication(payload) {
    const res = await fetch(`${API_BASE_URL}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        let d = ''; try { d = (await res.json())?.error ?? ''; } catch {}
        throw new Error(`Failed to add medication${d ? ` (${d})` : ''}`);
    }
    return res.json();
}

async function updateMedication(id, payload) {
    const res = await fetch(`${API_BASE_URL}/medications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        let d = ''; try { d = (await res.json())?.error ?? ''; } catch {}
        throw new Error(`Failed to update medication${d ? ` (${d})` : ''}`);
    }
    return res.json();
}

async function deleteMedication(id) {
    const res = await fetch(`${API_BASE_URL}/medications/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        let d = ''; try { d = (await res.json())?.error ?? ''; } catch {}
        throw new Error(`Failed to delete medication${d ? ` (${d})` : ''}`);
    }
}

// ── Edit mode ─────────────────────────────────────────────────────────────────

function enterEditMode(med) {
    editingMedicationId = med.id;

    const title = byId('form-title');
    if (title) title.textContent = `Edit Medication (ID ${med.id})`;

    const cancelBtn = byId('cancel-edit');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    const submitBtn = byId('submit-btn');
    if (submitBtn) submitBtn.textContent = '💾 Update Medication';

    if (byId('med-name'))         byId('med-name').value         = med.name         ?? '';
    if (byId('med-indications'))        byId('med-indications').value        = med.indications        ?? '';
    if (byId('med-side-effects')) byId('med-side-effects').value = med.side_effects ?? '';
    if (byId('med-image')) {
        byId('med-image').value = med.image_url ?? '';
        updateImagePreview(med.image_url ?? '');
    }

    setAddStatus('Editing mode — click Update to save changes.', '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEditMode() {
    editingMedicationId = null;

    const title = byId('form-title');
    if (title) title.textContent = 'Add Medication';

    const cancelBtn = byId('cancel-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';

    const submitBtn = byId('submit-btn');
    if (submitBtn) submitBtn.textContent = '💾 Save Medication';

    const form = byId('add-medication-form');
    if (form) form.reset();

    updateImagePreview('');
    setAddStatus('', '');
}

function canShowCardActions() { return Boolean(editingUnlocked); }

// ── Image preview ─────────────────────────────────────────────────────────────

function updateImagePreview(url) {
    const preview = byId('img-preview');
    if (!preview) return;
    preview.innerHTML = url
        ? `<img src="${escHtml(url)}" alt="preview"
              style="width:100%;height:100%;object-fit:cover;border-radius:9px;"
              onerror="this.parentElement.innerHTML='💊'">`
        : '💊';
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderMedications() {
    const container = byId('medication-list');
    if (!container) return;

    const meds = allMedications.filter(matchesSearch);
    setSearchCount(meds.length, allMedications.length);
    container.innerHTML = '';

    if (allMedications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">💊</div>
                <strong>No medications yet</strong>
                <p style="margin-top:6px;">Add your first medication using the form above.</p>
            </div>`;
        return;
    }

    if (meds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🔍</div>
                <strong>No results for "${escHtml(searchQuery)}"</strong>
                <p style="margin-top:6px;">Try a different keyword or clear the search.</p>
            </div>`;
        return;
    }

    meds.forEach((med, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.tabIndex  = 0;
        card.style.animationDelay = `${index * 40}ms`;

        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
                ${med.image_url
                    ? `<img src="${escHtml(med.image_url)}" alt="${escHtml(med.name)}"
                           style="width:44px;height:44px;border-radius:10px;object-fit:cover;
                                  border:1px solid var(--border);flex-shrink:0;"
                           onerror="this.style.display='none'">`
                    : `<div style="width:44px;height:44px;border-radius:10px;background:var(--blue-light);
                                   display:flex;align-items:center;justify-content:center;
                                   font-size:1.3rem;flex-shrink:0;">💊</div>`
                }
                <h3 class="med-title">${escHtml(med.name)}</h3>
            </div>
            <div class="med-details">
                <div style="margin:6px 0 10px;">
                    <strong>Indications</strong>
                    ${toBullets(med.indications)}
                </div>
                <div>
                    <strong>Side Effects</strong>
                    ${toBullets(med.side_effects)}
                </div>
                ${canShowCardActions() ? `
                <div class="card-actions">
                    <button class="btn-secondary" data-action="edit"   data-id="${escHtml(String(med.id))}">✏️ Edit</button>
                    <button class="btn-danger"    data-action="delete" data-id="${escHtml(String(med.id))}">🗑 Delete</button>
                </div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadMedications() {
    const container = byId('medication-list');
    if (!container) return;

    container.innerHTML = [1, 2, 3].map(() => `
        <div class="skeleton">
            <div class="skel-line title"></div>
            <div class="skel-line"></div>
            <div class="skel-line short"></div>
        </div>`).join('');

    try {
        const res = await fetch(`${API_BASE_URL}/medications`);
        if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);

        const data = await res.json();
        allMedications = Array.isArray(data) ? data : [];
        renderMedications();
    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <strong>Failed to load medications</strong>
                <p style="margin-top:6px;">${escHtml(err.message)}</p>
                <button onclick="loadMedications()" style="margin-top:16px;">↺ Try Again</button>
            </div>`;
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Image preview
    byId('med-image')?.addEventListener('input', (e) => {
        updateImagePreview(e.target.value.trim());
    });

    // Search
    const search   = byId('med-search');
    const clearBtn = byId('search-clear');

    search?.addEventListener('input', (e) => {
        searchQuery = normalizeText(e.target.value).trim();
        if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
        renderMedications();
    });

    clearBtn?.addEventListener('click', () => {
        if (search) search.value = '';
        clearBtn.style.display = 'none';
        searchQuery = '';
        renderMedications();
        search?.focus();
    });

    // Unlock editing toggle
    byId('unlock-editing')?.addEventListener('change', (e) => {
        editingUnlocked = Boolean(e.target.checked);
        if (!editingUnlocked) exitEditMode();
        renderMedications();
    });

    // Form submit
    byId('add-medication-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        setAddStatus(editingMedicationId ? 'Updating…' : 'Saving…', '');

        const payload = {
            name:         byId('med-name')?.value?.trim(),
            indications:        byId('med-indications')?.value?.trim(),
            side_effects: byId('med-side-effects')?.value?.trim(),
            image_url:    byId('med-image')?.value?.trim() || null,
        };

        try {
            if (editingMedicationId) {
                if (!editingUnlocked) {
                    setAddStatus('Editing is locked. Enable "Unlock editing".', 'err');
                    return;
                }
                if (!confirm('Update this medication in the database?')) {
                    setAddStatus('Update cancelled.', '');
                    return;
                }
                await updateMedication(editingMedicationId, payload);
                setAddStatus('✅ Updated successfully.', 'ok');
                exitEditMode();
            } else {
                await addMedication(payload);
                byId('add-medication-form').reset();
                updateImagePreview('');
                setAddStatus('✅ Medication saved.', 'ok');
            }
            await loadMedications();
        } catch (err) {
            console.error(err);
            setAddStatus(err?.message || 'Failed to save.', 'err');
        }
    });

    // Cancel edit
    byId('cancel-edit')?.addEventListener('click', exitEditMode);

    // Card list delegation — edit / delete / tap-to-toggle
    byId('medication-list')?.addEventListener('click', async (e) => {
        const btn = e.target?.closest?.('button[data-action]');

        if (!btn) {
            e.target?.closest?.('.card')?.classList.toggle('is-open');
            return;
        }

        const action = btn.getAttribute('data-action');
        const id     = Number(btn.getAttribute('data-id'));
        if (!action || !Number.isFinite(id)) return;

        if (action === 'edit') {
            if (!editingUnlocked) {
                setAddStatus('Editing is locked. Enable "Unlock editing".', 'err');
                return;
            }
            const med = allMedications.find(m => Number(m.id) === id);
            if (med) enterEditMode(med);
        }

        if (action === 'delete') {
            if (!editingUnlocked) {
                setAddStatus('Editing is locked. Enable "Unlock editing".', 'err');
                return;
            }
            if (!confirm('Delete this medication? This cannot be undone.')) return;
            try {
                await deleteMedication(id);
                if (Number(editingMedicationId) === id) exitEditMode();
                await loadMedications();
            } catch (err) {
                console.error(err);
                setAddStatus(err?.message || 'Failed to delete.', 'err');
            }
        }
    });

    loadMedications();
});