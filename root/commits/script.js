// ════════════════════════════════════════════
// script.js — Commits screen logic
// Depends on: state.js
// ════════════════════════════════════════════

const OP_ICON_MAP = {
  create:  { icon: '＋', bg: 'rgba(212,151,59,.15)' },
  edit:    { icon: '✏',  bg: 'rgba(91,155,213,.2)'  },
  update:  { icon: '📝', bg: 'rgba(91,155,213,.15)' },
  rename:  { icon: 'Aa', bg: 'rgba(90,97,117,.1)'   },
  regroup: { icon: '⬡',  bg: 'rgba(42,140,126,.2)'  },
  map:     { icon: '🗺', bg: 'rgba(212,151,59,.15)'  },
  trash:   { icon: '🗑', bg: 'rgba(198,40,40,.2)'    },
  disable: { icon: '⊘',  bg: 'rgba(255,255,255,.08)' },
  import:  { icon: '📂', bg: 'rgba(212,151,59,.15)'  },
};

let selectedIndices = new Set();
let currentStateFilter = 'all';
let currentOpFilter    = 'all';
let currentSort        = 'newest';
let _toastTimer        = null;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    window.location.href = '../entry-management/crud.html';
    return;
  }
  bindNav();
  bindTabs();
  bindMenu();
  bindOptions();
  renderLogs();
  renderRemoved();
});

// ════════════════════════════════════════════
// NAV
// ════════════════════════════════════════════

function bindNav() {
  document.getElementById('crudBtn').addEventListener('click', () => {
    window.location.href = '../entry-management/crud.html';
  });
  document.getElementById('menuBtn').addEventListener('click', openMenu);
  document.getElementById('optionsBtn').addEventListener('click', openOptions);
  document.getElementById('pullDraftsBtn').addEventListener('click', () => showToast('↪ Pull from DB — coming soon'));
}

// ════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════

function bindTabs() {
  document.querySelectorAll('.crud-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.crud-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.crud-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      clearSelection();
    });
  });
}

// ════════════════════════════════════════════
// RENDER LOGS
// ════════════════════════════════════════════

function renderLogs() {
  let q = getQueue();

  // Filter
  if (currentStateFilter !== 'all') q = q.filter(a => a.state === currentStateFilter);
  if (currentOpFilter !== 'all')    q = q.filter(a => a.op === currentOpFilter);

  // Sort
  if (currentSort === 'newest') q = [...q].reverse();
  else if (currentSort === 'word_asc') q = [...q].sort((a,b) => a.word.localeCompare(b.word));

  const list  = document.getElementById('commitLogList');
  const empty = document.getElementById('logsEmpty');
  const count = document.getElementById('logsCount');
  list.innerHTML = '';

  const total = getQueue().length;
  count.textContent = total + ' action' + (total !== 1 ? 's' : '');

  if (q.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  q.forEach(action => {
    list.appendChild(buildLogItem(action));
  });
}

function buildLogItem(action) {
  const info      = OP_ICON_MAP[action.op] || OP_ICON_MAP.edit;
  const stateClass = 'state-' + action.state;
  const itemClass  = action.state === 'dropped' ? 'state-dropped-item' : action.state === 'published' ? 'state-published-item' : '';
  const time       = new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const el = document.createElement('div');
  el.className  = 'commit-log-item ' + itemClass;
  el.dataset.id = action.id;
  el.innerHTML  = `
    <div class="commit-item-header">
      <div class="commit-op-icon" style="background:${info.bg}">${info.icon}</div>
      <div class="commit-item-body">
        <div class="commit-item-word">${escHtml(action.word)}</div>
        <div class="commit-item-meta">${action.op.charAt(0).toUpperCase() + action.op.slice(1)} · ${time}</div>
      </div>
      <div class="commit-item-right">
        <span class="commit-state ${stateClass}">${action.state.charAt(0).toUpperCase() + action.state.slice(1)}</span>
        <div class="commit-check">✓</div>
      </div>
    </div>`;
  el.addEventListener('click', () => toggleItemSelect(el, action.id));
  return el;
}

function renderRemoved() {
  const removed = getRemoved();
  const list    = document.getElementById('removedList');
  const empty   = document.getElementById('removedEmpty');
  const count   = document.getElementById('removedCount');
  list.innerHTML = '';

  count.textContent = removed.length + ' removed';

  if (removed.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  removed.forEach(action => {
    const info = OP_ICON_MAP[action.op] || OP_ICON_MAP.edit;
    const time = new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const el   = document.createElement('div');
    el.className = 'commit-log-item state-dropped-item';
    el.innerHTML = `
      <div class="commit-item-header">
        <div class="commit-op-icon" style="background:${info.bg}">${info.icon}</div>
        <div class="commit-item-body">
          <div class="commit-item-word">${escHtml(action.word)}</div>
          <div class="commit-item-meta">${action.op} · Removed · ${time}</div>
        </div>
        <div class="commit-item-right">
          <span class="commit-state state-dropped">Removed</span>
        </div>
      </div>`;
    list.appendChild(el);
  });
}

// ════════════════════════════════════════════
// SELECTION
// ════════════════════════════════════════════

function toggleItemSelect(el, id) {
  if (selectedIndices.has(id)) {
    selectedIndices.delete(id);
    el.classList.remove('selected');
  } else {
    selectedIndices.add(id);
    el.classList.add('selected');
  }
  updateSelectionLabel();
}

function updateSelectionLabel() {
  const lbl = document.getElementById('commitsSelectedLabel');
  lbl.textContent = selectedIndices.size + ' selected';
  lbl.classList.toggle('show', selectedIndices.size > 0);
}

function clearSelection() {
  selectedIndices.clear();
  document.getElementById('commitsSelectedLabel').classList.remove('show');
}

// ════════════════════════════════════════════
// SEARCH
// ════════════════════════════════════════════

document.getElementById('logsSearch').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.commit-log-item').forEach(item => {
    const word = item.querySelector('.commit-item-word')?.textContent.toLowerCase() || '';
    const meta = item.querySelector('.commit-item-meta')?.textContent.toLowerCase() || '';
    item.style.display = (word.includes(q) || meta.includes(q)) ? '' : 'none';
  });
});

// ════════════════════════════════════════════
// MENU
// ════════════════════════════════════════════

function bindMenu() {
  document.getElementById('menuCloseBtn').addEventListener('click', closeMenu);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMenu);

  document.getElementById('menuPublishSelected').addEventListener('click', () => { closeMenu(); applyToSelected('published'); });
  document.getElementById('menuDraftSelected').addEventListener('click',   () => { closeMenu(); applyToSelected('draft'); });
  document.getElementById('menuDropSelected').addEventListener('click',    () => { closeMenu(); applyToSelected('dropped'); });
  document.getElementById('menuDeleteSelected').addEventListener('click',  () => { closeMenu(); deleteSelected(); });
  document.getElementById('menuPublishAll').addEventListener('click',      () => { closeMenu(); publishAll(); });
  document.getElementById('menuDiscardAll').addEventListener('click',      () => { closeMenu(); discardAll(); });
}

function openMenu()  {
  document.getElementById('sidebarOverlay').classList.add('open');
  document.getElementById('commitsMenuSidebar').classList.add('open');
}
function closeMenu() {
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.getElementById('commitsMenuSidebar').classList.remove('open');
}

// ════════════════════════════════════════════
// QUEUE OPERATIONS
// ════════════════════════════════════════════

function applyToSelected(newState) {
  if (selectedIndices.size === 0) { showToast('Select actions first'); return; }
  const q = getQueue();
  q.forEach(a => { if (selectedIndices.has(a.id)) a.state = newState; });
  saveQueue(q);
  clearSelection();
  renderLogs();
  showToast('State → ' + newState, newState === 'published' ? 'success' : '');
}

function deleteSelected() {
  if (selectedIndices.size === 0) { showToast('Select actions first'); return; }
  let q       = getQueue();
  const removed = getRemoved();
  const toMove  = q.filter(a => selectedIndices.has(a.id));
  q = q.filter(a => !selectedIndices.has(a.id));
  removed.push(...toMove);
  saveQueue(q);
  saveRemoved(removed);
  clearSelection();
  renderLogs();
  renderRemoved();
  showToast('🗑 Moved to Removed', 'error');
}

function publishAll() {
  const q = getQueue();
  q.forEach(a => { if (a.state !== 'dropped') a.state = 'published'; });
  saveQueue(q);
  renderLogs();
  showToast('✅ All non-dropped actions published', 'success');
}

function discardAll() {
  const q       = getQueue();
  const removed = getRemoved();
  removed.push(...q);
  saveRemoved(removed);
  saveQueue([]);
  clearSelection();
  renderLogs();
  renderRemoved();
  showToast('🗑 Queue discarded', 'error');
}

// ════════════════════════════════════════════
// OPTIONS
// ════════════════════════════════════════════

function bindOptions() {
  document.getElementById('optionsCloseBtn').addEventListener('click', closeOptions);
  document.getElementById('optionsApplyBtn').addEventListener('click', applyOptions);
  document.getElementById('optionsOverlay').addEventListener('click', closeOptions);
  document.getElementById('optionsResetBtn').addEventListener('click', resetOptions);

  // State chips — single
  document.getElementById('filterState').addEventListener('click', e => {
    const chip = e.target.closest('.opt-chip');
    if (!chip) return;
    document.querySelectorAll('#filterState .opt-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });

  // Op chips — single
  document.getElementById('filterOp').addEventListener('click', e => {
    const chip = e.target.closest('.opt-chip');
    if (!chip) return;
    document.querySelectorAll('#filterOp .opt-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });

  // Sort
  document.querySelectorAll('.sort-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.sort-option').forEach(s => s.classList.remove('active'));
      opt.classList.add('active');
    });
  });
}

function openOptions()  {
  document.getElementById('optionsOverlay').classList.add('open');
  document.getElementById('optionsSheet').classList.add('open');
}
function closeOptions() {
  document.getElementById('optionsOverlay').classList.remove('open');
  document.getElementById('optionsSheet').classList.remove('open');
}

function applyOptions() {
  const stateChip = document.querySelector('#filterState .opt-chip.active');
  currentStateFilter = stateChip?.dataset.value || 'all';

  const opChip = document.querySelector('#filterOp .opt-chip.active');
  currentOpFilter = opChip?.dataset.value || 'all';

  const sortOpt = document.querySelector('.sort-option.active');
  currentSort = sortOpt?.dataset.sort || 'newest';

  closeOptions();
  renderLogs();
}

function resetOptions() {
  currentStateFilter = 'all';
  currentOpFilter    = 'all';
  currentSort        = 'newest';
  document.querySelectorAll('#filterState .opt-chip').forEach((c,i) => c.classList.toggle('active', i===0));
  document.querySelectorAll('#filterOp .opt-chip').forEach((c,i)    => c.classList.toggle('active', i===0));
  document.querySelectorAll('.sort-option').forEach((s,i)           => s.classList.toggle('active', i===0));
  renderLogs();
  showToast('Options reset');
}

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type) {
  const el = document.getElementById('toastEl');
  el.textContent = msg;
  el.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
