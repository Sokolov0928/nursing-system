const API_BASE_URL = 'http://localhost:3000';

let editingMedicationId = null;
let editingUnlocked = false;
let allMedications = [];
let searchQuery = '';

// ── Utility ──────────────────────────────────────────────────────────────────

const byId = (id) => document.getElementById(id);

// BUG FIX #1: Sanitize text before injecting into innerHTML to prevent XSS.
// Any field containing HTML tags (e.g. <script>, <img onerror=...>) is now safe.
function escHtml(str) {
    return (str ?? '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setAddStatus(message, kind) {
    const el = byId('add-status');
    if (!el) return;
    el.textContent = message || '';
    el.className = `status${kind ? ` ${kind}` : ''}`;
}

function normalizeText(s) {
    return (s ?? '').toString().toLowerCase();
}

function matchesSearch(med) {
    if (!searchQuery) return true;
    return (
        normalizeText(med.name).includes(searchQuery) ||
        normalizeText(med.usage).includes(searchQuery) ||
        normalizeText(med.dosage).includes(searchQuery) ||
        normalizeText(med.side_effects).includes(searchQuery)
    );
}

// BUG FIX #4: Only show search count when user is actually searching.
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

// ── API calls ─────────────────────────────────────────────────────────────────

async function addMedication(payload) {
    const response = await fetch(`${API_BASE_URL}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        let details = '';
        try { const d = await response.json(); details = d?.error ? ` (${d.error})` : ''; } catch {}
        throw new Error(`Failed to add medication${details}`);
    }
    return response.json();
}

async function updateMedication(id, payload) {
    const response = await fetch(`${API_BASE_URL}/medications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        let details = '';
        try { const d = await response.json(); details = d?.error ? ` (${d.error})` : ''; } catch {}
        throw new Error(`Failed to update medication${details}`);
    }
    return response.json();
}

async function deleteMedication(id) {
    const response = await fetch(`${API_BASE_URL}/medications/${id}`, { method: 'DELETE' });
    if (!response.ok) {
        let details = '';
        try { const d = await response.json(); details = d?.error ? ` (${d.error})` : ''; } catch {}
        throw new Error(`Failed to delete medication${details}`);
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
    if (submitBtn) submitBtn.textContent = 'Update Medication';

    if (byId('med-name'))         byId('med-name').value         = med.name         ?? '';
    if (byId('med-usage'))        byId('med-usage').value        = med.usage        ?? '';
    if (byId('med-dosage'))       byId('med-dosage').value       = med.dosage       ?? '';
    if (byId('med-side-effects')) byId('med-side-effects').value = med.side_effects ?? '';

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
    if (submitBtn) submitBtn.textContent = 'Save Medication';

    const form = byId('add-medication-form');
    if (form) form.reset();

    setAddStatus('', '');
}

function canShowCardActions() {
    return Boolean(editingUnlocked);
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderMedications() {
    const listContainer = byId('medication-list');
    if (!listContainer) return;

    const meds = allMedications.filter(matchesSearch);
    setSearchCount(meds.length, allMedications.length);

    listContainer.innerHTML = '';

    // BUG FIX #5: Empty states for both "no results" and "no medications"
    if (allMedications.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="icon">💊</div>
                <strong>No medications yet</strong>
                <p style="margin-top:6px;">Add your first medication using the form above.</p>
            </div>`;
        return;
    }

    if (meds.length === 0) {
        listContainer.innerHTML = `
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
        card.tabIndex = 0;

        // Staggered animation delay per card
        card.style.animationDelay = `${index * 40}ms`;

        // BUG FIX #1: All user-supplied fields go through escHtml() before innerHTML
        card.innerHTML = `
            <h3 class="med-title">${escHtml(med.name)}</h3>
            <div class="med-details">
                <p><strong>Usage:</strong> ${escHtml(med.usage)}</p>
                <p><strong>Dosage:</strong> ${escHtml(med.dosage)}</p>
                <p><strong>Side Effects:</strong> ${escHtml(med.side_effects)}</p>
                ${canShowCardActions() ? `
                <div class="card-actions">
                    <button class="btn-secondary" data-action="edit"   data-id="${escHtml(String(med.id))}">✏️ Edit</button>
                    <button class="btn-danger"    data-action="delete" data-id="${escHtml(String(med.id))}">🗑 Delete</button>
                </div>` : ''}
            </div>
        `;

        listContainer.appendChild(card);
    });
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadMedications() {
    const listContainer = byId('medication-list');
    if (!listContainer) return;

    // Show skeleton loaders while fetching
    listContainer.innerHTML = [1, 2, 3].map(() => `
        <div class="skeleton">
            <div class="skel-line title"></div>
            <div class="skel-line"></div>
            <div class="skel-line short"></div>
        </div>
    `).join('');

    try {
        const response = await fetch(`${API_BASE_URL}/medications`);

        // BUG FIX #3: Check response.ok before parsing JSON.
        // Previously a 4xx/5xx would silently fall through and break.
        if (!response.ok) {
            throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }

        const medications = await response.json();
        allMedications = Array.isArray(medications) ? medications : [];
        renderMedications();
    } catch (error) {
        console.error('Error fetching medications:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <strong>Failed to load medications</strong>
                <p style="margin-top:6px;">${escHtml(error.message)}</p>
                <button onclick="loadMedications()" style="margin-top:16px;">Try Again</button>
            </div>`;
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Search input
    const search = byId('med-search');
    const clearBtn = byId('search-clear');

    if (search) {
        search.addEventListener('input', (e) => {
            searchQuery = normalizeText(e.target?.value).trim();
            // Show/hide the clear (✕) button
            if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
            renderMedications();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (search) search.value = '';
            clearBtn.style.display = 'none';
            searchQuery = '';
            renderMedications();
            search?.focus();
        });
    }

    // Unlock editing checkbox
    const unlock = byId('unlock-editing');
    if (unlock) {
        unlock.addEventListener('change', (e) => {
            editingUnlocked = Boolean(e.target?.checked);
            if (!editingUnlocked) exitEditMode();
            renderMedications();
        });
    }

    // Form submit (add or update)
    const form = byId('add-medication-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            setAddStatus(editingMedicationId ? 'Updating…' : 'Saving…', '');

            const payload = {
                name:         byId('med-name')?.value?.trim(),
                usage:        byId('med-usage')?.value?.trim(),
                dosage:       byId('med-dosage')?.value?.trim(),
                side_effects: byId('med-side-effects')?.value?.trim(),
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
                    setAddStatus('Updated successfully.', 'ok');
                    exitEditMode();
                } else {
                    await addMedication(payload);
                    form.reset();
                    setAddStatus('Medication saved.', 'ok');
                }
                await loadMedications();
            } catch (err) {
                console.error(err);
                setAddStatus(err?.message || 'Failed to save.', 'err');
            }
        });
    }

    // Cancel edit
    const cancelBtn = byId('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', exitEditMode);

    // Card list: edit / delete / tap-to-toggle
    const listContainer = byId('medication-list');
    if (listContainer) {
        listContainer.addEventListener('click', async (e) => {
            const btn = e.target?.closest?.('button[data-action]');

            if (!btn) {
                // Tap a card (mobile friendly) to toggle details
                const card = e.target?.closest?.('.card');
                if (card) card.classList.toggle('is-open');
                return;
            }

            const action = btn.getAttribute('data-action');

            // BUG FIX #2: Cast both sides to Number to avoid string vs number
            // mismatch when backend returns IDs as strings (e.g. "5" !== 5).
            const id = Number(btn.getAttribute('data-id'));
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
                    // BUG FIX #2 (continued): use Number() on both sides here too
                    if (Number(editingMedicationId) === id) exitEditMode();
                    await loadMedications();
                } catch (err) {
                    console.error(err);
                    setAddStatus(err?.message || 'Failed to delete.', 'err');
                }
            }
        });
    }

    loadMedications();
});