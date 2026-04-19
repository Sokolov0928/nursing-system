const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const pool = new Pool({
  user: process.env.PGUSER || 'admin',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'nursing_db',
  password: process.env.PGPASSWORD || 'admin123',
  port: Number(process.env.PGPORT) || 5432,
});

// Basic test route
app.get('/', (req, res) => {
  res.send('API is running');
});

// DB test route
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all medications
app.get('/medications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medications');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD medication
app.post('/medications', async (req, res) => {
  try {
    const { name, usage, dosage, side_effects } = req.body;
    const result = await pool.query(
      'INSERT INTO medications (name, usage, dosage, side_effects) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, usage, dosage, side_effects]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE medication
app.put('/medications/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const { name, usage, dosage, side_effects } = req.body;
    const result = await pool.query(
      'UPDATE medications SET name=$1, usage=$2, dosage=$3, side_effects=$4 WHERE id=$5 RETURNING *',
      [name, usage, dosage, side_effects, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Medication not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE medication
app.delete('/medications/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await pool.query('DELETE FROM medications WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Medication not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
//               QUIZ ROUTES
// ==========================================

// Generate MCQ quiz from medications (5 random questions)
app.get('/quiz-mcq', async (req, res) => {
  try {
    const meds = await pool.query('SELECT * FROM medications ORDER BY RANDOM() LIMIT 5');
    const allMeds = await pool.query('SELECT * FROM medications');

    const questions = meds.rows.map((med) => {
      const wrongAnswers = allMeds.rows
        .filter(m => m.id !== med.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(m => m.usage);

      const options = [...wrongAnswers, med.usage].sort(() => 0.5 - Math.random());

      return {
        question: `What is the use of ${med.name}?`,
        options,
        correct_answer: med.usage,
      };
    });

    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all quiz questions
app.get('/questions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD a new quiz question
app.post('/questions', async (req, res) => {
  try {
    const { question, option_a, option_b, option_c, option_d, correct_answer, explanation } = req.body;
    
    const result = await pool.query(
      'INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer, explanation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [question, option_a, option_b, option_c, option_d, correct_answer, explanation]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START SERVER (Always at the bottom!)
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
// SERVER.JS