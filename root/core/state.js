// ════════════════════════════════════════════
// state.js — Shared state, queue mechanics
// Depends on: nothing. Load first.
// ════════════════════════════════════════════

const SOFT_LIMIT = 12;
const HARD_LIMIT = 16;

const LS_QUEUE   = 'dictCommitsQueue';
const LS_REMOVED = 'dictCommitsRemoved';
const LS_SESSION = 'dictAdminSession';

// ── Queue ──
function getQueue() {
  try { return JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); } catch { return []; }
}
function saveQueue(q) {
  localStorage.setItem(LS_QUEUE, JSON.stringify(q));
}

function getPendingCount() {
  return getQueue().filter(a => a.state === 'draft').length;
}

function pushCommit(commit) {
  const q = getQueue();
  const pending = q.filter(a => a.state === 'draft').length;
  if (pending >= HARD_LIMIT) return { ok: false, reason: 'hard_limit' };
  q.push(commit);
  saveQueue(q);
  if (pending + 1 >= SOFT_LIMIT) return { ok: true, reason: 'soft_limit' };
  return { ok: true };
}

function makeCommit(op, word, numid, extraData = {}) {
  return {
    id:        'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    op,
    word,
    numid:     numid ?? '',
    timestamp: new Date().toISOString(),
    state:     'draft',
    ...extraData
  };
}

// ── Removed ──
function getRemoved() {
  try { return JSON.parse(localStorage.getItem(LS_REMOVED) || '[]'); } catch { return []; }
}
function saveRemoved(r) {
  localStorage.setItem(LS_REMOVED, JSON.stringify(r));
}

// ── Session ──
function isLoggedIn() {
  return !!localStorage.getItem(LS_SESSION);
}
function setSession() {
  localStorage.setItem(LS_SESSION, '1');
}
function clearSession() {
  localStorage.removeItem(LS_SESSION);
}
