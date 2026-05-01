const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// -- Database
const pool = new Pool({
  user:       process.env.PGUSER     || 'admin',
  host:       process.env.PGHOST     || 'localhost',
  database:   process.env.PGDATABASE || 'nursing_db',
  password:   process.env.PGPASSWORD || 'admin123',
  port:       Number(process.env.PGPORT) || 5432,
  ssl: { rejectUnauthorized: false }  // <-- This is the magic line for Aiven
});

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * "indications" is a reserved keyword in PostgreSQL.
 * Every SQL statement that touches the column must use "indications" (with double quotes).
 * Failure to do so causes PostgreSQL to throw a silent error with an empty message,
 * which is why the API was returning {"error":""}.
 */

/**
 * Cleans a newline/semicolon-separated string into a short readable label
 * for use as a quiz answer option.
 * e.g. "Hipertensi\nAngina Kronik\nCAD" → "Hipertensi, Angina Kronik, CAD"
 */
function cleanOptionText(raw) {
  if (!raw) return '—';
  const items = raw.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return raw.trim();
  if (items.length === 1) return items[0];
  const shown = items.slice(0, 3).join(', ');
  return items.length > 3 ? shown + '…' : shown;
}

/**
 * Returns a random Malay question template for a medication name.
 */
function buildQuestion(medName) {
  const templates = [
    `Apakah kegunaan ${medName}?`,
    `Apakah indikasi utama bagi ${medName}?`,
    `${medName} digunakan untuk merawat apa?`,
    `Pilih kegunaan yang betul bagi ${medName}.`,
    `Apakah tujuan penggunaan ${medName} dalam rawatan perubatan?`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ── Basic routes ──────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('Pelayan API sedang berjalan'));

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /test-db]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// ── Medications CRUD ──────────────────────────────────────────────────────────

// GET all medications
// NOTE: "indications" is quoted because it is a PostgreSQL reserved keyword
app.get('/medications', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, "indications", side_effects, image_url FROM medications ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /medications]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// ADD medication
app.post('/medications', async (req, res) => {
  try {
    const { name, indications, side_effects, image_url } = req.body;

    const result = await pool.query(
      `INSERT INTO medications (name, "indications", side_effects, image_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, indications, side_effects, image_url ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /medications]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// UPDATE medication
app.put('/medications/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tidak sah' });

    const { name, indications, side_effects, image_url } = req.body;

    const result = await pool.query(
      `UPDATE medications
       SET name=$1, "indications"=$2, side_effects=$3, image_url=$4
       WHERE id=$5 RETURNING *`,
      [name, indications, side_effects, image_url ?? null, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Ubatan tidak dijumpai' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /medications/:id]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// DELETE medication
app.delete('/medications/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tidak sah' });

    const result = await pool.query(
      'DELETE FROM medications WHERE id=$1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Ubatan tidak dijumpai' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /medications/:id]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// ── Quiz route ────────────────────────────────────────────────────────────────

app.get('/quiz-mcq', async (req, res) => {
  try {
    // "indications" must be quoted — PostgreSQL reserved keyword
    const { rows: questionMeds } = await pool.query(
      `SELECT id, name, "indications" FROM medications
       WHERE "indications" IS NOT NULL AND TRIM("indications") <> ''
       ORDER BY RANDOM() LIMIT 5`
    );

    const { rows: allMeds } = await pool.query(
      `SELECT id, name, "indications" FROM medications
       WHERE "indications" IS NOT NULL AND TRIM("indications") <> ''`
    );

    if (questionMeds.length === 0) {
      return res.json([]);
    }

    const questions = questionMeds.map((med) => {
      const wrongMeds = allMeds
        .filter(m => m.id !== med.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const correctOption = cleanOptionText(med.indications);
      const wrongOptions  = wrongMeds.map(m => cleanOptionText(m.indications));

      // Shuffle all 4 options
      const options = [...wrongOptions, correctOption]
        .sort(() => 0.5 - Math.random());

      return {
        question:       buildQuestion(med.name),
        options,
        correct_answer: correctOption,
      };
    });

    res.json(questions);
  } catch (err) {
    console.error('[GET /quiz-mcq]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// ── Manual questions table ────────────────────────────────────────────────────

app.get('/questions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /questions]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

app.post('/questions', async (req, res) => {
  try {
    const { question, option_a, option_b, option_c, option_d, correct_answer, explanation } = req.body;
    const result = await pool.query(
      `INSERT INTO questions
         (question, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [question, option_a, option_b, option_c, option_d, correct_answer, explanation]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /questions]', err);
    res.status(500).json({ error: err.message || err.code || 'Ralat pangkalan data' });
  }
});

// ── Graceful shutdown (prevents port-in-use on restart) ───────────────────────
process.on('SIGINT', () => {
  console.log('\nPelayan dihentikan dengan selamat.');
  process.exit(0);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`✅ Pelayan berjalan di http://localhost:${PORT}`);
});