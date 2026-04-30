const API_BASE_URL = 'http://localhost:3000';

// ── State ─────────────────────────────────────────────────────────────────────
let questions    = [];
let currentIndex = 0;
let score        = 0;
let answered     = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

const byId = (id) => document.getElementById(id);

function updateScore() {
    const el = byId('score-pill');
    if (el) el.textContent = `${score} / ${questions.length}`;
}

function setFeedback(text = '', type = '') {
    const el = byId('feedback');
    if (!el) return;                      // null-guard — never throws
    el.textContent = text;
    el.className   = `feedback ${type}`;
}

function setExplanation(text = '') {
    const el = byId('explanation');
    if (!el) return;                      // null-guard — never throws
    el.textContent   = text;
    el.style.display = text ? 'block' : 'none';
}

function setProgress(text) {
    const el = byId('progress');
    if (el) el.textContent = text;
}

function updateProgressBar() {
    const el = byId('progress-bar');
    if (!el || !questions.length) return;
    el.style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
}

// ── Error card (big, unmissable) ──────────────────────────────────────────────
// Shows inside the choices area so it cannot be missed regardless of scroll
function showErrorCard(message) {
    setProgress('⚠️ Ralat');

    const choicesEl = byId('choices');
    if (choicesEl) {
        choicesEl.innerHTML = `
            <div style="
                text-align:center; padding:32px 24px;
                background:#fff1f2; border-radius:14px;
                border:1.5px solid #fca5a5; margin-top:8px;
            ">
                <div style="font-size:2.2rem; margin-bottom:12px;">⚠️</div>
                <div style="font-weight:700; color:#dc2626; font-size:1rem; margin-bottom:8px;">
                    Gagal memuatkan kuiz
                </div>
                <div style="font-size:0.85rem; color:#64748b; margin-bottom:20px; line-height:1.6;">
                    ${message}
                </div>
                <div style="
                    font-size:0.8rem; color:#94a3b8; margin-bottom:20px;
                    text-align:left; background:#f8fafc; border-radius:8px;
                    padding:12px 16px; border:1px solid #e4e9f0; line-height:1.8;
                ">
                    <strong style="display:block; margin-bottom:4px;">Langkah semakan:</strong>
                    1. Pastikan pelayan backend sedang berjalan<br>
                    2. Buka
                       <a href="http://localhost:3000/quiz-mcq" target="_blank"
                          style="color:#4f46e5; font-weight:600;">
                           localhost:3000/quiz-mcq
                       </a>
                       dalam tab baru<br>
                    3. Jika tiada respons: <code style="background:#e0e7ff;padding:1px 5px;border-radius:4px;">node server.js</code>
                </div>
                <button
                    onclick="fetchQuestions()"
                    style="
                        background:#4f46e5; color:white; border:none;
                        padding:10px 28px; border-radius:8px; font-weight:700;
                        cursor:pointer; font-size:0.88rem; font-family:inherit;
                    "
                >↺ Cuba Semula</button>
            </div>`;
    }

    const nextBtn = byId('next');
    if (nextBtn) nextBtn.disabled = true;
}

// ── Loading spinner ───────────────────────────────────────────────────────────
function showLoadingState() {
    setProgress('Memuatkan…');

    const questionEl = byId('question');
    if (questionEl) questionEl.textContent = '';

    const choicesEl = byId('choices');
    if (choicesEl) {
        choicesEl.innerHTML = `
            <div style="text-align:center; padding:48px 0; color:#94a3b8;">
                <div style="font-size:2rem; margin-bottom:12px; display:inline-block;
                            animation:spin 1s linear infinite;">⟳</div>
                <div style="font-size:0.9rem; font-weight:500;">Menjana soalan…</div>
            </div>`;
    }

    const nextBtn = byId('next');
    if (nextBtn) nextBtn.disabled = true;

    setFeedback();
    setExplanation();
}

// ── Normalize correct answer ──────────────────────────────────────────────────

function normalizeCorrectAnswer(q) {
    const raw = (q.correct_answer ?? '').toString().trim();

    if (Array.isArray(q.options)) {
        const idx = q.options.findIndex(o => o.toLowerCase() === raw.toLowerCase());
        return idx >= 0 ? String.fromCharCode(65 + idx) : '';
    }

    const upper = raw.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(upper)) return upper;

    const map = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    for (const key in map) {
        if ((map[key] ?? '').toLowerCase() === raw.toLowerCase()) return key;
    }

    return '';
}

// ── Render question ───────────────────────────────────────────────────────────

function renderQuestion() {
    if (!questions.length) {
        setProgress('Tiada soalan tersedia.');
        return;
    }

    const q       = questions[currentIndex];
    const correct = normalizeCorrectAnswer(q);

    answered = false;
    setFeedback();
    setExplanation();
    setProgress(`Soalan ${currentIndex + 1} daripada ${questions.length}`);
    updateProgressBar();

    const questionEl = byId('question');
    if (questionEl) questionEl.textContent = q.question;

    const choicesEl = byId('choices');
    if (!choicesEl) return;
    choicesEl.innerHTML = '';

    const items = Array.isArray(q.options)
        ? q.options.map((t, i) => ({ letter: String.fromCharCode(65 + i), text: t }))
        : ['a', 'b', 'c', 'd']
              .map((k, i) => ({ letter: String.fromCharCode(65 + i), text: q[`option_${k}`] }))
              .filter(x => x.text);

    items.forEach(({ letter, text }) => {
        const btn = document.createElement('button');
        btn.className   = 'choice';
        btn.textContent = `${letter}. ${text}`;
        btn.onclick     = () => handleAnswer(letter, text, correct, items);
        choicesEl.appendChild(btn);
    });

    const nextBtn = byId('next');
    if (nextBtn) nextBtn.disabled = true;
}

// ── Answer handler ────────────────────────────────────────────────────────────

function handleAnswer(selectedLetter, selectedText, correctLetter, items) {
    if (answered) return;
    answered = true;

    document.querySelectorAll('.choice').forEach(btn => {
        btn.disabled = true;
        const letter = btn.textContent[0];
        if (letter === correctLetter)                              btn.classList.add('correct');
        if (letter === selectedLetter && letter !== correctLetter) btn.classList.add('wrong');
    });

    if (selectedLetter === correctLetter) {
        score++;
        setFeedback('✅ Betul!', 'ok');
    } else {
        const correctText = items.find(i => i.letter === correctLetter)?.text;
        setFeedback(`❌ Salah! Jawapan betul: ${correctLetter}. ${correctText}`, 'err');
    }

    if (questions[currentIndex]?.explanation) {
        setExplanation(`💡 Penerangan: ${questions[currentIndex].explanation}`);
    }

    updateScore();
    const nextBtn = byId('next');
    if (nextBtn) nextBtn.disabled = false;
}

// ── Next ──────────────────────────────────────────────────────────────────────

function nextQuestion() {
    if (currentIndex >= questions.length - 1) {
        showFinalScreen();
        return;
    }
    currentIndex++;
    renderQuestion();
}

// ── Final screen ──────────────────────────────────────────────────────────────

function showFinalScreen() {
    const total = questions.length;
    const pct   = Math.round((score / total) * 100);

    let grade, emoji, color, bgColor, message;
    if (pct === 100) {
        grade = 'Sempurna!';        emoji = '🏆'; color = '#7c3aed'; bgColor = '#f5f3ff';
        message = 'Luar biasa — anda menjawab semua soalan dengan betul!';
    } else if (pct >= 80) {
        grade = 'Cemerlang';        emoji = '🌟'; color = '#059669'; bgColor = '#f0fdf4';
        message = 'Kerja yang baik! Anda bersedia dengan baik.';
    } else if (pct >= 60) {
        grade = 'Bagus';            emoji = '👍'; color = '#d97706'; bgColor = '#fffbeb';
        message = 'Usaha yang baik! Ulangkaji sedikit lagi dan anda pasti boleh.';
    } else if (pct >= 40) {
        grade = 'Cuba Lagi';        emoji = '📚'; color = '#2563eb'; bgColor = '#eff6ff';
        message = 'Jangan berputus asa — ulangkaji bahan dan cuba sekali lagi!';
    } else {
        grade = 'Perlu Diperbaiki'; emoji = '💪'; color = '#dc2626'; bgColor = '#fff1f2';
        message = 'Kembali semak nota anda dan beri peluang lagi!';
    }

    setFeedback();
    setExplanation();

    const questionEl = byId('question');
    if (questionEl) questionEl.textContent = '';

    setProgress('Keputusan');

    const nextBtn = byId('next');
    if (nextBtn) nextBtn.disabled = true;

    const progressBar = byId('progress-bar');
    if (progressBar) progressBar.style.width = '100%';

    const choicesEl = byId('choices');
    if (choicesEl) {
        choicesEl.innerHTML = `
            <div style="
                text-align:center; padding:40px 24px 32px;
                background:${bgColor}; border-radius:16px;
                border:1.5px solid ${color}33;
            ">
                <div style="font-size:3rem;line-height:1;margin-bottom:10px;">${emoji}</div>
                <div style="font-size:1.6rem;font-weight:700;color:${color};margin-bottom:6px;
                            font-family:'DM Serif Display',serif;">${grade}</div>
                <div style="font-size:0.9rem;color:#64748b;margin-bottom:28px;">${message}</div>
                <div style="
                    width:110px;height:110px;border-radius:50%;
                    border:5px solid ${color};background:white;
                    display:flex;flex-direction:column;
                    align-items:center;justify-content:center;
                    margin:0 auto 28px;box-shadow:0 4px 20px ${color}22;
                ">
                    <div style="font-size:2rem;font-weight:800;color:${color};line-height:1;">${pct}%</div>
                    <div style="font-size:0.72rem;color:#94a3b8;font-weight:600;margin-top:3px;">
                        ${score} daripada ${total}
                    </div>
                </div>
                <div style="height:1px;background:${color}22;margin:0 auto 24px;max-width:260px;"></div>
                <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
                    <div style="background:#dcfce7;color:#166534;border-radius:999px;
                                padding:8px 24px;font-size:0.88rem;font-weight:600;">
                        ✅ Betul &nbsp;${score}
                    </div>
                    <div style="background:#fee2e2;color:#991b1b;border-radius:999px;
                                padding:8px 24px;font-size:0.88rem;font-weight:600;">
                        ❌ Salah &nbsp;${total - score}
                    </div>
                </div>
            </div>`;
    }

    updateScore();
}

// ── Fetch questions ───────────────────────────────────────────────────────────

async function fetchQuestions() {
    showLoadingState();

    try {
        const res = await fetch(`${API_BASE_URL}/quiz-mcq`);

        // Read body text first so we can show it on error
        const bodyText = await res.text();

        if (!res.ok) {
            // Try to parse JSON error message
            let detail = `HTTP ${res.status}`;
            try {
                const parsed = JSON.parse(bodyText);
                if (parsed.error) detail += ` — ${parsed.error}`;
            } catch {}
            throw new Error(detail);
        }

        const data = JSON.parse(bodyText);

        if (!Array.isArray(data)) {
            throw new Error('Format respons tidak sah daripada pelayan.');
        }

        questions    = data;
        currentIndex = 0;
        score        = 0;

        if (questions.length === 0) {
            showErrorCard('Tiada soalan ditemui. Pastikan pangkalan data mempunyai ubatan dengan medan kegunaan.');
            updateScore();
            return;
        }

        updateScore();
        renderQuestion();

    } catch (err) {
        console.error('[Quiz] fetchQuestions gagal:', err);
        showErrorCard(err.message || 'Ralat tidak diketahui.');
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const nextBtn    = byId('next');
    const restartBtn = byId('restart');
    if (nextBtn)    nextBtn.onclick    = nextQuestion;
    if (restartBtn) restartBtn.onclick = fetchQuestions;
    fetchQuestions();
});