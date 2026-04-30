const fs = require('fs');
const path = require('path');

function cleanLine(s) {
  return (s ?? '')
    .toString()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function joinLines(lines) {
  return lines
    .map(cleanLine)
    .filter(Boolean)
    .join(' ')
    .replace(/\s*•\s*/g, '; ')
    .replace(/\s*\?\?\?\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBlocks(text) {
  // Split on lines like "1. Amlodipine"
  const re = /^\s*(\d+)\.\s*([^\r\n]+)\s*$/gm;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push({ idx: m.index, num: Number(m[1]), name: cleanLine(m[2]) });
  }

  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length;
    blocks.push({
      num: matches[i].num,
      name: matches[i].name,
      body: text.slice(start, end),
    });
  }
  return blocks;
}

function extractField(blockBody, fieldName) {
  // Returns lines after FIELDNAME until next known header.
  const lines = blockBody.split(/\r?\n/).map(cleanLine);
  const headers = [
    'NAMA',
    'GENERIC',
    'NAMA JENAMA',
    'KLASIFIKASI UBAT',
    'KLASIFIKASI',
    'UBAT',
    'INDIKASI',
    'KONTRAINDIKASI',
    'KESAN',
    'SAMPINGAN',
    'KESAN SAMPINGAN',
  ];

  const startIdx = lines.findIndex((l) => l === fieldName || l.startsWith(fieldName));
  if (startIdx === -1) return '';

  // capture inline content on same line after the header
  const firstLine = lines[startIdx];
  const inline = cleanLine(firstLine.replace(fieldName, ''));

  const captured = [];
  if (inline) captured.push(inline);

  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (/^\d+$/.test(l)) break; // stray page/item numbers
    if (headers.some((h) => l === h || l.startsWith(h))) break;
    // stop if looks like next numbered item
    if (/^\d+\.\s+/.test(l)) break;
    captured.push(l);
  }

  return joinLines(captured);
}

function extractIndikasiAndSideEffects(block) {
  const indikasi = extractField(block.body, 'INDIKASI');

  // Side effects sometimes appear as:
  // - "KESAN SAMPINGAN• ..." inline
  // - "KESAN" then "SAMPINGAN" on next line
  let sideEffects = extractField(block.body, 'KESAN SAMPINGAN');
  if (!sideEffects) {
    // If "KESAN" then "SAMPINGAN", start capture after "SAMPINGAN"
    const lines = block.body.split(/\r?\n/).map(cleanLine);
    const sIdx = lines.findIndex((l) => l === 'SAMPINGAN' || l.startsWith('SAMPINGAN '));
    if (sIdx !== -1) {
      const captured = [];
      const inline = cleanLine((lines[sIdx] || '').replace('SAMPINGAN', ''));
      if (inline) captured.push(inline);

      for (let i = sIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) continue;
        if (/^\d+$/.test(l)) break;
        if (l.startsWith('KONTRAINDIKASI')) break;
        if (/^\d+\.\s+/.test(l)) break;
        // stop at common headers
        if (l.startsWith('INDIKASI')) break;
        if (l.startsWith('NAMA JENAMA') || l.startsWith('KLASIFIKASI') || l === 'NAMA' || l === 'GENERIC') break;
        captured.push(l);
      }
      sideEffects = joinLines(captured);
    }
  }

  return { indikasi, sideEffects };
}

function sqlDollarQuote(s) {
  // Use a unique tag so content won't break dollar quotes.
  const tag = 'BUKUUBAT';
  return `$${tag}$${(s ?? '').toString()}$${tag}$`;
}

function main() {
  const filePath = path.join(__dirname, '..', 'data', 'buku_ubat_extracted.txt');
  const text = fs.readFileSync(filePath, 'utf8');
  const blocks = parseBlocks(text);

  const rows = blocks
    .map((b) => {
      const { indikasi, sideEffects } = extractIndikasiAndSideEffects(b);
      return {
        name: b.name,
        indications: indikasi,
        side_effects: sideEffects,
      };
    })
    .filter((r) => r.name);

  // Build an UPDATE FROM (VALUES ...) to fill missing fields.
  // Only set indications/side_effects if incoming value is non-empty.
  const valuesSql = rows
    .map((r) => `(${sqlDollarQuote(r.name)}, ${sqlDollarQuote(r.indications)}, ${sqlDollarQuote(r.side_effects)})`)
    .join(',\n  ');

  const sql = `
WITH incoming(name, indications, side_effects) AS (
  VALUES
  ${valuesSql}
),
updated AS (
  UPDATE medications m
  SET
    indications = CASE WHEN incoming.indications <> '' THEN incoming.indications ELSE m.indications END,
    side_effects = CASE WHEN incoming.side_effects <> '' THEN incoming.side_effects ELSE m.side_effects END
  FROM incoming
  WHERE lower(m.name) = lower(incoming.name)
  RETURNING m.id
)
SELECT
  (SELECT COUNT(*) FROM incoming) AS incoming_rows,
  (SELECT COUNT(*) FROM updated) AS updated_rows;
`.trim();

  process.stdout.write(sql + '\n');
}

main();

