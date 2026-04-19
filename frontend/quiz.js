const API_BASE_URL = 'http://localhost:3000';

// --- STATE ---
let questions = [];
let currentIndex = 0;
let score = 0;
let answered = false;

// --- HELPERS ---
const byId = (id) => document.getElementById(id);

function updateScore() {
  byId('score-pill').textContent = `Score: ${score} / ${questions.length}`;
}

function setFeedback(text = '', type = '') {
  const el = byId('feedback');
  el.textContent = text;
  el.className = `feedback ${type}`;
}

function setExplanation(text = '') {
  const el = byId('explanation');
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

function setProgress() {
  byId('progress').textContent = `Question ${currentIndex + 1} of ${questions.length}`;
}

// --- NORMALIZE ANSWER ---
function normalizeCorrectAnswer(q) {
  const raw = (q.correct_answer ?? '').toString().trim();

  if (Array.isArray(q.options)) {
    const idx = q.options.findIndex(
      o => o.toLowerCase() === raw.toLowerCase()
    );
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

// --- PROGRESS BAR ---
function updateProgressBar() {
  const percent = ((currentIndex + 1) / questions.length) * 100;
  byId('progress-bar').style.width = percent + '%';
}

// --- RENDER ---
function renderQuestion() {
  if (!questions.length) {
    byId('progress').textContent = 'No questions available.';
    return;
  }

  const q = questions[currentIndex];
  const correct = normalizeCorrectAnswer(q);

  answered = false;
  setFeedback();
  setExplanation();
  setProgress();
  updateProgressBar();

  byId('question').textContent = q.question;

  const choicesEl = byId('choices');
  choicesEl.innerHTML = '';

  const items = Array.isArray(q.options)
    ? q.options.map((t, i) => ({ letter: String.fromCharCode(65 + i), text: t }))
    : ['a', 'b', 'c', 'd']
        .map((k, i) => ({ letter: String.fromCharCode(65 + i), text: q[`option_${k}`] }))
        .filter(x => x.text);

  items.forEach(({ letter, text }) => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = `${letter}. ${text}`;
    btn.onclick = () => handleAnswer(letter, text, correct, items);
    choicesEl.appendChild(btn);
  });

  byId('next').disabled = true;
}

// --- ANSWER HANDLER ---
function handleAnswer(selectedLetter, selectedText, correctLetter, items) {
  if (answered) return;
  answered = true;

  document.querySelectorAll('.choice').forEach(btn => {
    btn.disabled = true;
    const letter = btn.textContent[0];
    if (letter === correctLetter) btn.classList.add('correct');
    if (letter === selectedLetter && letter !== correctLetter) btn.classList.add('wrong');
  });

  if (selectedLetter === correctLetter) {
    score++;
    setFeedback('✅ Correct!', 'ok');
  } else {
    const correctText = items.find(i => i.letter === correctLetter)?.text;
    setFeedback(`❌ Wrong! Correct: ${correctLetter}. ${correctText}`, 'err');
  }

  if (questions[currentIndex].explanation) {
    setExplanation(`Explanation: ${questions[currentIndex].explanation}`);
  }

  updateScore();
  byId('next').disabled = false;
}

// --- NEXT ---
function nextQuestion() {
  if (currentIndex >= questions.length - 1) {
    showFinalScreen();
    return;
  }
  currentIndex++;
  renderQuestion();
}

// --- FINAL SCREEN ---
function showFinalScreen() {
  const total = questions.length;
  const pct = Math.round((score / total) * 100);

  let grade, emoji, color, bgColor, message;
  if (pct === 100) {
    grade = 'Perfect!';    emoji = '🏆'; color = '#7c3aed'; bgColor = '#f5f3ff';
    message = 'Flawless — you nailed every single question!';
  } else if (pct >= 80) {
    grade = 'Excellent';   emoji = '🌟'; color = '#059669'; bgColor = '#f0fdf4';
    message = "Outstanding work! You're well prepared.";
  } else if (pct >= 60) {
    grade = 'Good Job';    emoji = '👍'; color = '#d97706'; bgColor = '#fffbeb';
    message = "Solid effort! A bit more review and you'll ace it.";
  } else if (pct >= 40) {
    grade = 'Keep Trying'; emoji = '📚'; color = '#2563eb'; bgColor = '#eff6ff';
    message = "Don't give up — review the material and try again!";
  } else {
    grade = 'Needs Work';  emoji = '💪'; color = '#dc2626'; bgColor = '#fff1f2';
    message = "Go back to your notes and give it another shot!";
  }

  // Clear ALL remnants from the last question
  setFeedback();
  setExplanation();
  byId('question').textContent = '';  // ← was missing: clears the last question title
  byId('progress').textContent = 'Results';
  byId('next').disabled = true;
  byId('progress-bar').style.width = '100%';

  byId('choices').innerHTML = `
    <div style="
      text-align: center;
      padding: 40px 24px 32px;
      background: ${bgColor};
      border-radius: 16px;
      border: 1.5px solid ${color}33;
    ">
      <div style="font-size: 3rem; line-height: 1; margin-bottom: 10px;">${emoji}</div>
      <div style="font-size: 1.6rem; font-weight: 700; color: ${color}; margin-bottom: 6px;">${grade}</div>
      <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 28px;">${message}</div>

      <div style="
        width: 110px; height: 110px;
        border-radius: 50%;
        border: 5px solid ${color};
        background: white;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        margin: 0 auto 28px;
        box-shadow: 0 4px 20px ${color}22;
      ">
        <div style="font-size: 2rem; font-weight: 800; color: ${color}; line-height: 1;">${pct}%</div>
        <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 600; margin-top: 3px;">${score} of ${total}</div>
      </div>

      <div style="height: 1px; background: ${color}22; margin: 0 auto 24px; max-width: 260px;"></div>

      <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
        <div style="
          background: #dcfce7; color: #166534;
          border-radius: 999px; padding: 8px 24px;
          font-size: 0.88rem; font-weight: 600;
        ">✅ Correct &nbsp; ${score}</div>
        <div style="
          background: #fee2e2; color: #991b1b;
          border-radius: 999px; padding: 8px 24px;
          font-size: 0.88rem; font-weight: 600;
        ">❌ Wrong &nbsp; ${total - score}</div>
      </div>
    </div>
  `;

  updateScore();
}

// --- FETCH ---
async function fetchQuestions() {
  try {
    byId('progress').textContent = 'Loading...';

    const res = await fetch(`${API_BASE_URL}/quiz-mcq`);
    const data = await res.json();

    questions = data || [];
    currentIndex = 0;
    score = 0;

    updateScore();
    renderQuestion();
  } catch (err) {
    console.error(err);
    byId('progress').textContent = '⚠️ Failed to load quiz.';
  }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  byId('next').onclick = nextQuestion;
  byId('restart').onclick = fetchQuestions;
  fetchQuestions();
});