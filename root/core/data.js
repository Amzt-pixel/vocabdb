// ════════════════════════════════════════════
// data.js — Data layer. CSV → dataList[]
// Depends on: nothing. Load before script.js.
// ════════════════════════════════════════════

const CSV_URL = 'https://raw.githubusercontent.com/Amzt-pixel/vocabdb/refs/heads/main/samplefdata2.csv';

const CATEGORY_MAP = { 1: 'Word', 2: 'Idiom', 3: 'Phrasal' };
const USAGE_MAP    = { 0: 'Common', 1: 'Unique', 2: 'Specific', 3: 'Colloquial', 4: 'Common', 5: 'Common', 6: 'Common' };

// The session snapshot — populated by loadData(), never written to directly
let dataList = [];
let lastSyncedAt = null;

// ── Public API ──

async function loadFromGitHub() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('Failed to fetch CSV: ' + res.status);
  const text = await res.text();
  return parseCSV(text);
}

function loadFromText(csvText) {
  return parseCSV(csvText);
}

function buildDataList(rows) {
  dataList = rows.map(row => normaliseRow(row));
  lastSyncedAt = new Date();
  return dataList;
}

// ── CSV Parsing ──

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  // Handles quoted fields with commas and escaped quotes
  const result = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

// ── Row normalisation ──

function normaliseRow(row) {
  const numid    = parseFloat(row['numid']) || 0;
  const category = parseInt(row['category']) || 1;
  const usage    = parseInt(row['usage']) || 0;
  const active   = row['active'] === 'true' || row['active'] === '1' || row['active'] === 'True';
  const review   = row['review_note'] === 'true' || row['review_note'] === '1' || row['review_note'] === 'True';

  return {
    uid:          parseInt(row['uid']) || 0,
    numid,
    word:         row['word'] || '',
    category,
    categoryLabel: CATEGORY_MAP[category] || 'Word',
    role:         row['role'] || '',
    definition1:  row['definition1'] || '',
    definition2:  row['definition2'] || '',
    example1:     row['example1'] || '',
    example2:     row['example2'] || '',
    example3:     row['example3'] || '',
    example4:     row['example4'] || '',
    example5:     row['example5'] || '',
    bengali_def:  row['bengali_def'] || '',
    bengali_ex1:  row['bengali_ex1'] || '',
    bengali_ex2:  row['bengali_ex2'] || '',
    bengali_ex3:  row['bengali_ex3'] || '',
    refword:      row['refword'] || '',
    usage,
    usageLabel:   USAGE_MAP[usage] || 'Common',
    review_note:  review,
    comment:      row['comment'] || '',
    creation_date: row['creation_date'] || '',
    active,

    // Derived flags for filtering
    isInvalid:    numid === 0,
    isInactive:   !active,
    hasDef:       !!(row['definition1']),
    hasExample:   !!(row['example1']),
    hasTranslation: !!(row['bengali_def']),
  };
}

// ── Filtering & Sorting ──

function applyFilters(entries, filters = {}) {
  let result = [...entries];

  // Category
  if (filters.category && filters.category !== 'all') {
    const catMap = { word: 1, idiom: 2, phrasal: 3 };
    const catVal = catMap[filters.category];
    if (catVal) result = result.filter(e => e.category === catVal);
  }

  // Usage/Label
  if (filters.usage && filters.usage !== 'all') {
    const uMap = { common: 0, unique: 1, specific: 2, colloquial: 3 };
    const uVal = uMap[filters.usage];
    if (uVal !== undefined) result = result.filter(e => e.usage === uVal);
  }

  // Condition flags
  if (filters.onlyDefs)        result = result.filter(e => e.hasDef);
  if (filters.reviewNote)      result = result.filter(e => e.review_note);
  if (filters.invalid)         result = result.filter(e => e.isInvalid);
  if (filters.inactive)        result = result.filter(e => e.isInactive);
  if (filters.hasTranslation)  result = result.filter(e => e.hasTranslation);
  if (filters.noExamples)      result = result.filter(e => !e.hasExample);

  // NumId range
  if (filters.numidMin !== undefined && filters.numidMin !== '') {
    result = result.filter(e => e.numid >= parseFloat(filters.numidMin));
  }
  if (filters.numidMax !== undefined && filters.numidMax !== '') {
    result = result.filter(e => e.numid <= parseFloat(filters.numidMax));
  }

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(e => e.word.toLowerCase().includes(q));
  }

  return result;
}

function applySort(entries, sortKey = 'word_asc') {
  const arr = [...entries];
  switch (sortKey) {
    case 'word_asc':     return arr.sort((a, b) => a.word.localeCompare(b.word));
    case 'word_desc':    return arr.sort((a, b) => b.word.localeCompare(a.word));
    case 'numid_asc':    return arr.sort((a, b) => a.numid - b.numid);
    case 'numid_desc':   return arr.sort((a, b) => b.numid - a.numid);
    case 'date_newest':  return arr.sort((a, b) => b.creation_date.localeCompare(a.creation_date));
    case 'date_oldest':  return arr.sort((a, b) => a.creation_date.localeCompare(b.creation_date));
    default:             return arr;
  }
}

// ── Lookup helpers ──

function getEntryByUid(uid) {
  return dataList.find(e => e.uid === uid) || null;
}

function searchEntries(query, limit = 20) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return dataList
    .filter(e => e.word.toLowerCase().includes(q))
    .slice(0, limit);
}

function getGroupMembers(numid) {
  // Returns all words sharing the same abs(numid)
  const abs = Math.abs(numid);
  return dataList.filter(e => Math.abs(e.numid) === abs);
}

// ── Tile metadata string ──
// Builds the compact meta line shown on each tile

function buildTileMeta(entry) {
  const parts = [];
  if (entry.usageLabel !== 'Common') parts.push(entry.usageLabel);
  if (entry.hasDef)         parts.push('D');
  if (entry.hasExample)     parts.push('E');
  if (entry.hasTranslation) parts.push('T');
  if (entry.bengali_ex1)    parts.push('TE');
  return parts;
}
