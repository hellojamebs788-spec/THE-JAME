/**
 * FinFlow — Personal Finance & Debt Tracker
 * script.js
 *
 * Architecture:
 *  - Connects to Supabase via REST API (no SDK needed for GitHub Pages)
 *  - Falls back to localStorage "demo mode" when no Supabase credentials exist
 *  - All CRUD operations go through the SupabaseClient wrapper
 *  - UI is rendered reactively after every data mutation
 */

'use strict';

// ══════════════════════════════════════════════════
// 1. CONFIGURATION — loaded from localStorage
// ══════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  supabaseUrl:     '',
  supabaseKey:     '',
  monthlySalary:   50000,
  fixedCosts:      15000,
  savingsTarget:   5000,
  currency:        '฿',
};

let CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem('finflow_config') || '{}') };

function saveConfig() {
  localStorage.setItem('finflow_config', JSON.stringify(CONFIG));
}

// ══════════════════════════════════════════════════
// 2. SUPABASE CLIENT (raw fetch — no SDK required)
// ══════════════════════════════════════════════════

/**
 * Thin Supabase REST client. Handles all CRUD via the PostgREST API.
 * Replace CONFIG.supabaseUrl / CONFIG.supabaseKey with your project values.
 */
const DB = {
  headers() {
    return {
      'Content-Type':  'application/json',
      'apikey':        CONFIG.supabaseKey,
      'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      'Prefer':        'return=representation',
    };
  },
  url(table, query = '') {
    return `${CONFIG.supabaseUrl}/rest/v1/${table}${query ? '?' + query : ''}`;
  },

  async getAll(table, query = '') {
    const r = await fetch(this.url(table, query), { headers: this.headers() });
    if (!r.ok) throw new Error(`GET ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },

  async insert(table, data) {
    const r = await fetch(this.url(table), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`INSERT ${table}: ${r.status} ${await r.text()}`);
    const result = await r.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async update(table, id, data) {
    const r = await fetch(this.url(table, `id=eq.${id}`), {
      method:  'PATCH',
      headers: this.headers(),
      body:    JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`UPDATE ${table}: ${r.status} ${await r.text()}`);
    const result = await r.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async delete(table, id) {
    const r = await fetch(this.url(table, `id=eq.${id}`), {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`DELETE ${table}: ${r.status} ${await r.text()}`);
    return true;
  },
};

// ══════════════════════════════════════════════════
// 3. DEMO MODE (localStorage fallback)
// When no Supabase credentials are set, data is
// stored locally so the app remains fully usable.
// ══════════════════════════════════════════════════

const DEMO = {
  _data: {
    transactions: JSON.parse(localStorage.getItem('ff_transactions') || '[]'),
    debts:        JSON.parse(localStorage.getItem('ff_debts')        || '[]'),
    savings:      JSON.parse(localStorage.getItem('ff_savings')      || '[]'),
  },
  _save(table) {
    localStorage.setItem(`ff_${table}`, JSON.stringify(this._data[table]));
  },
  async getAll(table) {
    return [...this._data[table]].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at));
  },
  async insert(table, data) {
    const row = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    this._data[table].unshift(row);
    this._save(table);
    return row;
  },
  async update(table, id, data) {
    const idx = this._data[table].findIndex(r => r.id === id);
    if (idx < 0) throw new Error('Not found');
    this._data[table][idx] = { ...this._data[table][idx], ...data };
    this._save(table);
    return this._data[table][idx];
  },
  async delete(table, id) {
    this._data[table] = this._data[table].filter(r => r.id !== id);
    this._save(table);
    return true;
  },
};

/** Determines which backend to use */
function getAdapter() {
  return (CONFIG.supabaseUrl && CONFIG.supabaseKey) ? DB : DEMO;
}

// ══════════════════════════════════════════════════
// 4. APP STATE
// ══════════════════════════════════════════════════

const STATE = {
  transactions: [],
  debts:        [],
  savings:      [],
  loading:      false,
  currentSection: 'dashboard',
};

// ══════════════════════════════════════════════════
// 5. HELPERS
// ══════════════════════════════════════════════════

const fmt = (n) =>
  `${CONFIG.currency}${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtPct = (n) => `${Math.round(n)}%`;

function today() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function todayDisplay() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

const CATEGORY_ICONS = {
  Food: '🍜', Transport: '🚗', Shopping: '🛍️', Bills: '📋',
  Health: '💊', Entertainment: '🎬', Salary: '💰', Investment: '📈',
  'Debt Payment': '💳', Other: '📦',
};

function calcDailyBudget() {
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const totalDebtPayments = STATE.debts.reduce((s, d) => s + Number(d.monthly_payment || 0), 0);
  const disposable = CONFIG.monthlySalary - CONFIG.fixedCosts - CONFIG.savingsTarget - totalDebtPayments;
  return Math.max(0, disposable / daysInMonth);
}

function todayTransactions() {
  const t = today();
  return STATE.transactions.filter(tx => tx.date === t && tx.type === 'expense');
}

function spentToday() {
  return todayTransactions().reduce((s, tx) => s + Number(tx.amount), 0);
}

function estimateMonthsDebtFree(debt) {
  const bal  = Number(debt.remaining_balance);
  const pmt  = Number(debt.monthly_payment);
  const rate = Number(debt.interest_rate) / 100 / 12;
  if (!pmt || pmt <= 0) return null;
  if (!rate) return Math.ceil(bal / pmt);
  // amortisation formula
  const months = -Math.log(1 - (rate * bal / pmt)) / Math.log(1 + rate);
  return isFinite(months) && months > 0 ? Math.ceil(months) : null;
}

function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t  = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 320); }, 3000);
}

function setConnectionStatus(status) {
  // status: 'connected' | 'error' | 'demo'
  const dot = document.getElementById('connectionDot');
  dot.className = 'connection-dot ' + status;
  const titles = { connected: 'Supabase connected', error: 'Supabase error — check settings', demo: 'Demo mode (localStorage)' };
  dot.title = titles[status] || '';
}

// ══════════════════════════════════════════════════
// 6. DATA LAYER — load & mutate
// ══════════════════════════════════════════════════

async function loadAll() {
  try {
    const adapter = getAdapter();
    const [transactions, debts, savings] = await Promise.all([
      adapter.getAll('transactions', adapter === DB ? 'order=date.desc,created_at.desc' : ''),
      adapter.getAll('debts'),
      adapter.getAll('savings'),
    ]);
    STATE.transactions = transactions;
    STATE.debts        = debts;
    STATE.savings      = savings;
    setConnectionStatus(adapter === DB ? 'connected' : 'demo');
    renderAll();
  } catch (err) {
    console.error('Load error:', err);
    setConnectionStatus('error');
    showToast('Could not load data. Check your Supabase settings.', 'error');
  }
}

async function saveTransaction(data) {
  const adapter = getAdapter();
  if (data.id) {
    const { id, ...rest } = data;
    await adapter.update('transactions', id, rest);
    showToast('Transaction updated', 'success');
  } else {
    await adapter.insert('transactions', data);
    showToast('Transaction added', 'success');
  }
  await loadAll();
}

async function deleteTransaction(id) {
  await getAdapter().delete('transactions', id);
  showToast('Transaction deleted', 'info');
  await loadAll();
}

async function saveDebt(data) {
  const adapter = getAdapter();
  if (data.id) {
    const { id, ...rest } = data;
    await adapter.update('debts', id, rest);
    showToast('Debt updated', 'success');
  } else {
    await adapter.insert('debts', data);
    showToast('Debt added', 'success');
  }
  await loadAll();
}

async function deleteDebt(id) {
  await getAdapter().delete('debts', id);
  showToast('Debt deleted', 'info');
  await loadAll();
}

async function saveSavingsGoal(data) {
  const adapter = getAdapter();
  if (data.id) {
    const { id, ...rest } = data;
    await adapter.update('savings', id, rest);
    showToast('Goal updated', 'success');
  } else {
    await adapter.insert('savings', data);
    showToast('Goal added', 'success');
  }
  await loadAll();
}

async function deleteSavingsGoal(id) {
  await getAdapter().delete('savings', id);
  showToast('Goal deleted', 'info');
  await loadAll();
}

// ══════════════════════════════════════════════════
// 7. RENDER FUNCTIONS
// ══════════════════════════════════════════════════

function renderAll() {
  renderDashboard();
  renderTransactionsTable();
  renderDebtsSection();
  renderSavingsSection();
}

// ── Dashboard ──
function renderDashboard() {
  const daily  = calcDailyBudget();
  const spent  = spentToday();
  const remain = Math.max(0, daily - spent);
  const pct    = daily > 0 ? Math.min((spent / daily) * 100, 100) : 0;
  const todayTx = todayTransactions();

  // Stat cards
  document.getElementById('dailyBudget').textContent   = fmt(remain);
  document.getElementById('spentToday').textContent    = fmt(spent);
  document.getElementById('txCountToday').textContent  = todayTx.length;

  const totalDebt = STATE.debts.reduce((s, d) => s + Number(d.remaining_balance), 0);
  const totalPmt  = STATE.debts.reduce((s, d) => s + Number(d.monthly_payment), 0);
  document.getElementById('totalDebtStat').textContent          = fmt(totalDebt);
  document.getElementById('debtMonthlyPaymentStat').textContent = `${fmt(totalPmt)} /month`;

  const totalSavings = STATE.savings.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalSavingsTarget = STATE.savings.reduce((s, g) => s + Number(g.target_amount), 0);
  document.getElementById('totalSavingsStat').textContent = fmt(totalSavings);
  document.getElementById('savingsTargetStat').textContent = `of ${fmt(totalSavingsTarget)} goal`;

  // Budget bar
  const fill   = document.getElementById('budgetBarFill');
  const status = document.getElementById('budgetStatus');
  fill.style.width = `${pct}%`;
  fill.classList.toggle('over', spent > daily);
  document.getElementById('budgetBarSpent').textContent = `${fmt(spent)} spent`;
  document.getElementById('budgetBarTotal').textContent = `${fmt(daily)} budget`;
  if (pct >= 100) { status.textContent = 'Over Budget'; status.className = 'card-badge danger'; }
  else if (pct >= 80) { status.textContent = 'Almost Full'; status.className = 'card-badge warn'; }
  else { status.textContent = 'On Track'; status.className = 'card-badge'; }

  // Recent transactions (last 5)
  const recentList = document.getElementById('recentTxList');
  const recent = [...STATE.transactions].slice(0, 5);
  recentList.innerHTML = recent.length
    ? recent.map(tx => txItemHTML(tx)).join('')
    : '<div class="empty-state">No transactions yet</div>';

  // Debt snapshot (dashboard)
  const dashDebts = document.getElementById('dashDebtList');
  dashDebts.innerHTML = STATE.debts.length
    ? STATE.debts.map(d => {
        const months = estimateMonthsDebtFree(d);
        return `<div class="mini-debt-item">
          <div class="mini-item-header">
            <span class="mini-item-name">${escHtml(d.name)}</span>
            <span class="mini-item-amount">${fmt(d.remaining_balance)}</span>
          </div>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, (d.monthly_payment / d.remaining_balance) * 100 * 12)}%"></div></div>
          <div class="mini-item-sub">${fmt(d.monthly_payment)}/mo${months ? ` · ~${months} months left` : ''}</div>
        </div>`;
      }).join('')
    : '<div class="empty-state">No debts tracked</div>';

  // Savings snapshot (dashboard)
  const dashSavings = document.getElementById('dashSavingsList');
  dashSavings.innerHTML = STATE.savings.length
    ? STATE.savings.map(g => {
        const pctG = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
        return `<div class="mini-savings-item">
          <div class="mini-item-header">
            <span class="mini-item-name">${escHtml(g.goal_name)}</span>
            <span class="mini-item-amount green">${fmt(g.current_amount)}</span>
          </div>
          <div class="mini-bar"><div class="mini-bar-fill green" style="width:${pctG}%"></div></div>
          <div class="mini-item-sub">${fmtPct(pctG)} of ${fmt(g.target_amount)}</div>
        </div>`;
      }).join('')
    : '<div class="empty-state">No savings goals</div>';
}

function txItemHTML(tx) {
  const icon = CATEGORY_ICONS[tx.category] || '📦';
  const sign = tx.type === 'income' ? '+' : '-';
  return `<div class="tx-item">
    <div class="tx-icon">${icon}</div>
    <div class="tx-meta">
      <div class="tx-desc">${escHtml(tx.description)}</div>
      <div class="tx-cat-date">${escHtml(tx.category)} · ${tx.date}</div>
    </div>
    <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
  </div>`;
}

// ── Transactions Table ──
function renderTransactionsTable() {
  const filterType  = document.getElementById('txFilter').value;
  const filterMonth = document.getElementById('txMonthFilter').value; // YYYY-MM

  let txs = [...STATE.transactions];
  if (filterType !== 'all') txs = txs.filter(tx => tx.type === filterType);
  if (filterMonth) txs = txs.filter(tx => tx.date && tx.date.startsWith(filterMonth));

  const tbody = document.getElementById('txTableBody');
  tbody.innerHTML = txs.length
    ? txs.map(tx => `
      <tr>
        <td class="mono">${tx.date}</td>
        <td>${escHtml(tx.description)}</td>
        <td>${escHtml(tx.category)}</td>
        <td><span class="badge-type ${tx.type}">${tx.type}</span></td>
        <td class="mono ${tx.type === 'income' ? 'success' : 'danger'}">${tx.type === 'income' ? '+' : '-'}${fmt(tx.amount)}</td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" onclick="editTx('${tx.id}')" title="Edit">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="btn-icon del" onclick="confirmDelete('transaction','${tx.id}')" title="Delete">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty-state">No transactions found</td></tr>`;
}

// ── Debts Section ──
function renderDebtsSection() {
  const total       = STATE.debts.reduce((s, d) => s + Number(d.remaining_balance), 0);
  const totalPmt    = STATE.debts.reduce((s, d) => s + Number(d.monthly_payment), 0);
  const avgRate     = STATE.debts.length
    ? STATE.debts.reduce((s, d) => s + Number(d.interest_rate), 0) / STATE.debts.length
    : 0;

  document.getElementById('totalDebtBig').textContent     = fmt(total);
  document.getElementById('totalMonthlyPayment').textContent = fmt(totalPmt);
  document.getElementById('avgInterestRate').textContent  = `${avgRate.toFixed(1)}%`;

  // Estimate overall debt-free: use longest debt
  const maxMonths = STATE.debts.reduce((max, d) => {
    const m = estimateMonthsDebtFree(d);
    return (m && m > max) ? m : max;
  }, 0);
  document.getElementById('debtFreeEstimate').textContent =
    maxMonths ? `${maxMonths} mo` : (STATE.debts.length ? '—' : 'Debt Free! 🎉');

  const container = document.getElementById('debtCardsContainer');
  container.innerHTML = STATE.debts.length
    ? STATE.debts.map(d => {
        const months = estimateMonthsDebtFree(d);
        const pctPaid = d.remaining_balance > 0
          ? Math.max(0, 100 - Math.min(100, (d.remaining_balance / (d.remaining_balance + d.monthly_payment * (months || 0))) * 100))
          : 100;
        return `<div class="debt-card">
          <div class="debt-card-header">
            <div class="debt-card-name">${escHtml(d.name)}</div>
            <div class="debt-card-actions">
              <button class="btn-icon" onclick="editDebt('${d.id}')" title="Edit">
                <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button class="btn-icon del" onclick="confirmDelete('debt','${d.id}')" title="Delete">
                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </div>
          <div class="debt-balance">${fmt(d.remaining_balance)}</div>
          <div class="debt-details">
            <div class="debt-detail-item">
              <span class="debt-detail-label">Rate</span>
              <span class="debt-detail-value">${d.interest_rate}%</span>
            </div>
            <div class="debt-detail-item">
              <span class="debt-detail-label">Monthly</span>
              <span class="debt-detail-value">${fmt(d.monthly_payment)}</span>
            </div>
            ${months ? `<div class="debt-detail-item">
              <span class="debt-detail-label">Est. payoff</span>
              <span class="debt-detail-value">${months} months</span>
            </div>` : ''}
          </div>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${pctPaid}%"></div></div>
          ${months ? `<div class="debt-timeline">~${Math.floor(months / 12)} yr ${months % 12} mo to debt-free</div>` : ''}
        </div>`;
      }).join('')
    : '<div class="empty-state">No debts added yet. Click "+ Add Debt" to get started.</div>';
}

// ── Savings Section ──
function renderSavingsSection() {
  const grid = document.getElementById('savingsGoalsGrid');
  grid.innerHTML = STATE.savings.length
    ? STATE.savings.map(g => {
        const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
        return `<div class="savings-goal-card">
          <div class="savings-card-header">
            <div class="savings-card-name">${escHtml(g.goal_name)}</div>
            <div style="display:flex;gap:4px">
              <button class="btn-icon" onclick="editSavings('${g.id}')" title="Edit">
                <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button class="btn-icon del" onclick="confirmDelete('savings','${g.id}')" title="Delete">
                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </div>
          <div class="savings-amounts">
            <div class="savings-current">${fmt(g.current_amount)}</div>
            <div class="savings-target">/ ${fmt(g.target_amount)}</div>
          </div>
          <div class="savings-bar"><div class="savings-bar-fill" style="width:${pct}%"></div></div>
          <div class="savings-pct">${fmtPct(pct)} complete${pct >= 100 ? ' 🎉' : ''}</div>
        </div>`;
      }).join('')
    : '<div class="empty-state">No savings goals yet. Click "+ Add Goal" to start saving.</div>';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════
// 8. MODAL HELPERS
// ══════════════════════════════════════════════════

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
// Close buttons
document.querySelectorAll('[data-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});

// ══════════════════════════════════════════════════
// 9. TRANSACTION MODAL LOGIC
// ══════════════════════════════════════════════════

document.getElementById('addTxBtn').addEventListener('click', () => {
  document.getElementById('txModalTitle').textContent = 'Add Transaction';
  document.getElementById('txId').value       = '';
  document.getElementById('txDesc').value     = '';
  document.getElementById('txAmount').value   = '';
  document.getElementById('txType').value     = 'expense';
  document.getElementById('txCategory').value = 'Food';
  document.getElementById('txDate').value     = today();
  openModal('txModal');
});

function editTx(id) {
  const tx = STATE.transactions.find(t => t.id === id);
  if (!tx) return;
  document.getElementById('txModalTitle').textContent = 'Edit Transaction';
  document.getElementById('txId').value       = tx.id;
  document.getElementById('txDesc').value     = tx.description;
  document.getElementById('txAmount').value   = tx.amount;
  document.getElementById('txType').value     = tx.type;
  document.getElementById('txCategory').value = tx.category;
  document.getElementById('txDate').value     = tx.date;
  openModal('txModal');
}

document.getElementById('saveTxBtn').addEventListener('click', async () => {
  const id     = document.getElementById('txId').value;
  const desc   = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const type   = document.getElementById('txType').value;
  const cat    = document.getElementById('txCategory').value;
  const date   = document.getElementById('txDate').value;

  if (!desc || !amount || !date) { showToast('Please fill all fields', 'error'); return; }

  const data = { description: desc, amount, type, category: cat, date };
  if (id) data.id = id;

  try {
    closeModal('txModal');
    await saveTransaction(data);
  } catch (err) {
    showToast('Error saving: ' + err.message, 'error');
  }
});

// ══════════════════════════════════════════════════
// 10. DEBT MODAL LOGIC
// ══════════════════════════════════════════════════

document.getElementById('addDebtBtn').addEventListener('click', () => {
  document.getElementById('debtModalTitle').textContent = 'Add Debt';
  document.getElementById('debtId').value      = '';
  document.getElementById('debtName').value    = '';
  document.getElementById('debtBalance').value = '';
  document.getElementById('debtRate').value    = '';
  document.getElementById('debtPayment').value = '';
  openModal('debtModal');
});

function editDebt(id) {
  const d = STATE.debts.find(x => x.id === id);
  if (!d) return;
  document.getElementById('debtModalTitle').textContent  = 'Edit Debt';
  document.getElementById('debtId').value      = d.id;
  document.getElementById('debtName').value    = d.name;
  document.getElementById('debtBalance').value = d.remaining_balance;
  document.getElementById('debtRate').value    = d.interest_rate;
  document.getElementById('debtPayment').value = d.monthly_payment;
  openModal('debtModal');
}

document.getElementById('saveDebtBtn').addEventListener('click', async () => {
  const id      = document.getElementById('debtId').value;
  const name    = document.getElementById('debtName').value.trim();
  const balance = parseFloat(document.getElementById('debtBalance').value);
  const rate    = parseFloat(document.getElementById('debtRate').value) || 0;
  const payment = parseFloat(document.getElementById('debtPayment').value);

  if (!name || !balance || !payment) { showToast('Please fill all fields', 'error'); return; }

  const data = { name, remaining_balance: balance, interest_rate: rate, monthly_payment: payment };
  if (id) data.id = id;

  try {
    closeModal('debtModal');
    await saveDebt(data);
  } catch (err) {
    showToast('Error saving: ' + err.message, 'error');
  }
});

// ══════════════════════════════════════════════════
// 11. SAVINGS MODAL LOGIC
// ══════════════════════════════════════════════════

document.getElementById('addSavingsBtn').addEventListener('click', () => {
  document.getElementById('savingsModalTitle').textContent = 'Add Savings Goal';
  document.getElementById('savingsId').value          = '';
  document.getElementById('savingsGoalName').value    = '';
  document.getElementById('savingsCurrent').value     = '';
  document.getElementById('savingsTarget').value      = '';
  openModal('savingsModal');
});

function editSavings(id) {
  const g = STATE.savings.find(x => x.id === id);
  if (!g) return;
  document.getElementById('savingsModalTitle').textContent = 'Edit Savings Goal';
  document.getElementById('savingsId').value          = g.id;
  document.getElementById('savingsGoalName').value    = g.goal_name;
  document.getElementById('savingsCurrent').value     = g.current_amount;
  document.getElementById('savingsTarget').value      = g.target_amount;
  openModal('savingsModal');
}

document.getElementById('saveSavingsBtn').addEventListener('click', async () => {
  const id      = document.getElementById('savingsId').value;
  const name    = document.getElementById('savingsGoalName').value.trim();
  const current = parseFloat(document.getElementById('savingsCurrent').value) || 0;
  const target  = parseFloat(document.getElementById('savingsTarget').value);

  if (!name || !target) { showToast('Please fill all fields', 'error'); return; }

  const data = { goal_name: name, current_amount: current, target_amount: target };
  if (id) data.id = id;

  try {
    closeModal('savingsModal');
    await saveSavingsGoal(data);
  } catch (err) {
    showToast('Error saving: ' + err.message, 'error');
  }
});

// ══════════════════════════════════════════════════
// 12. CONFIRM DELETE
// ══════════════════════════════════════════════════

let _pendingDelete = null;

function confirmDelete(type, id) {
  _pendingDelete = { type, id };
  const labels = { transaction: 'transaction', debt: 'debt', savings: 'savings goal' };
  document.getElementById('confirmMessage').textContent =
    `Are you sure you want to delete this ${labels[type] || 'item'}? This cannot be undone.`;
  openModal('confirmModal');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!_pendingDelete) return;
  closeModal('confirmModal');
  const { type, id } = _pendingDelete;
  _pendingDelete = null;
  try {
    if (type === 'transaction') await deleteTransaction(id);
    else if (type === 'debt')   await deleteDebt(id);
    else if (type === 'savings') await deleteSavingsGoal(id);
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
});

// ══════════════════════════════════════════════════
// 13. SETTINGS MODAL
// ══════════════════════════════════════════════════

document.getElementById('openSettings').addEventListener('click', () => {
  document.getElementById('settingsUrl').value          = CONFIG.supabaseUrl;
  document.getElementById('settingsKey').value          = CONFIG.supabaseKey;
  document.getElementById('settingsSalary').value       = CONFIG.monthlySalary;
  document.getElementById('settingsFixed').value        = CONFIG.fixedCosts;
  document.getElementById('settingsSavingsTarget').value = CONFIG.savingsTarget;
  document.getElementById('settingsCurrency').value     = CONFIG.currency;
  openModal('settingsModal');
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  CONFIG.supabaseUrl    = document.getElementById('settingsUrl').value.trim().replace(/\/$/, '');
  CONFIG.supabaseKey    = document.getElementById('settingsKey').value.trim();
  CONFIG.monthlySalary  = parseFloat(document.getElementById('settingsSalary').value)  || 50000;
  CONFIG.fixedCosts     = parseFloat(document.getElementById('settingsFixed').value)   || 15000;
  CONFIG.savingsTarget  = parseFloat(document.getElementById('settingsSavingsTarget').value) || 5000;
  CONFIG.currency       = document.getElementById('settingsCurrency').value || '฿';
  saveConfig();
  closeModal('settingsModal');
  showToast('Settings saved. Reconnecting…', 'info');
  await loadAll();
});

// ══════════════════════════════════════════════════
// 14. OCR SLIP UPLOAD (Simulated)
// ══════════════════════════════════════════════════

/**
 * simulateOCR(file) — MOCK OCR LOGIC
 *
 * This function returns fake parsed data to demonstrate the UX flow.
 *
 * ── TO INTEGRATE A REAL OCR API ──
 * Replace the body of this function with:
 *
 * Option A — Google Vision API:
 *   const base64 = await fileToBase64(file);
 *   const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=YOUR_API_KEY`, {
 *     method: 'POST',
 *     body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION' }] }] })
 *   });
 *   const data = await res.json();
 *   const text = data.responses[0].fullTextAnnotation.text;
 *   return parseSlipText(text); // write a parser for your bank format
 *
 * Option B — AWS Textract:
 *   Send the image to your serverless function that calls AWS Textract,
 *   then return structured { description, amount, date, category } back here.
 *
 * Option C — Mindee (bank slips specialist):
 *   const formData = new FormData();
 *   formData.append('document', file);
 *   const res = await fetch('https://api.mindee.net/v1/products/mindee/bank_account_statement/v1/predict', {
 *     method: 'POST', headers: { Authorization: 'Token YOUR_MINDEE_KEY' }, body: formData
 *   });
 *   const data = await res.json();
 *   return extractMindeeFields(data);
 */
async function simulateOCR(file) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 1200));

  // Generate mock data that looks realistic for a Thai bank slip
  const mockSlips = [
    { description: 'PromptPay Transfer — SCB', amount: 450, category: 'Other', date: today() },
    { description: 'KFC Central World', amount: 189, category: 'Food', date: today() },
    { description: 'BTS Rabbit Card Top Up', amount: 500, category: 'Transport', date: today() },
    { description: 'Grab — GrabFood', amount: 320, category: 'Food', date: today() },
    { description: 'Netflix Subscription', amount: 269, category: 'Entertainment', date: today() },
    { description: 'True Move H Bill Payment', amount: 599, category: 'Bills', date: today() },
  ];
  return mockSlips[Math.floor(Math.random() * mockSlips.length)];
}

let _ocrData = null;

const uploadZone   = document.getElementById('uploadZone');
const slipInput    = document.getElementById('slipFileInput');
const ocrResult    = document.getElementById('ocrResult');
const browseBtn    = document.getElementById('browseBtn');
const ocrFields    = document.getElementById('ocrFields');
const ocrSaveBtn   = document.getElementById('ocrSaveBtn');
const ocrEditBtn   = document.getElementById('ocrEditBtn');

browseBtn.addEventListener('click', () => slipInput.click());
uploadZone.addEventListener('click', e => { if (e.target !== browseBtn) slipInput.click(); });

['dragover', 'dragenter'].forEach(ev => {
  uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
});
['dragleave', 'drop'].forEach(ev => {
  uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); });
});
uploadZone.addEventListener('drop', e => processFile(e.dataTransfer.files[0]));
slipInput.addEventListener('change', e => processFile(e.target.files[0]));

async function processFile(file) {
  if (!file) return;
  ocrResult.style.display = 'none';
  ocrFields.innerHTML = '<div class="ocr-field"><span class="ocr-field-label">Scanning…</span></div>';
  ocrResult.style.display = 'block';

  try {
    _ocrData = await simulateOCR(file);
    ocrFields.innerHTML = `
      <div class="ocr-field">
        <span class="ocr-field-label">Description</span>
        <span class="ocr-field-value">${escHtml(_ocrData.description)}</span>
      </div>
      <div class="ocr-field">
        <span class="ocr-field-label">Amount</span>
        <span class="ocr-field-value">${fmt(_ocrData.amount)}</span>
      </div>
      <div class="ocr-field">
        <span class="ocr-field-label">Category</span>
        <span class="ocr-field-value">${_ocrData.category}</span>
      </div>
      <div class="ocr-field">
        <span class="ocr-field-label">Date</span>
        <span class="ocr-field-value">${_ocrData.date}</span>
      </div>`;
  } catch (err) {
    ocrFields.innerHTML = `<div class="ocr-field"><span class="ocr-field-label" style="color:var(--red)">OCR failed: ${err.message}</span></div>`;
  }
}

ocrSaveBtn.addEventListener('click', async () => {
  if (!_ocrData) return;
  try {
    await saveTransaction({ ..._ocrData, type: 'expense' });
    ocrResult.style.display = 'none';
    _ocrData = null;
    slipInput.value = '';
    showToast('Slip saved as transaction!', 'success');
    navigateTo('transactions');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
});

ocrEditBtn.addEventListener('click', () => {
  if (!_ocrData) return;
  document.getElementById('ocrEditDesc').value     = _ocrData.description;
  document.getElementById('ocrEditAmount').value   = _ocrData.amount;
  document.getElementById('ocrEditDate').value     = _ocrData.date;
  document.getElementById('ocrEditCategory').value = _ocrData.category;
  document.getElementById('ocrEditType').value     = 'expense';
  openModal('ocrEditModal');
});

document.getElementById('ocrConfirmSaveBtn').addEventListener('click', async () => {
  const data = {
    description: document.getElementById('ocrEditDesc').value.trim(),
    amount:      parseFloat(document.getElementById('ocrEditAmount').value),
    date:        document.getElementById('ocrEditDate').value,
    category:    document.getElementById('ocrEditCategory').value,
    type:        document.getElementById('ocrEditType').value,
  };
  if (!data.description || !data.amount) { showToast('Fill all fields', 'error'); return; }
  try {
    closeModal('ocrEditModal');
    await saveTransaction(data);
    ocrResult.style.display = 'none';
    _ocrData = null;
    navigateTo('transactions');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
});

// ══════════════════════════════════════════════════
// 15. NAVIGATION
// ══════════════════════════════════════════════════

const SECTION_TITLES = {
  dashboard:    'Dashboard',
  transactions: 'Transactions',
  debts:        'Debt Tracker',
  savings:      'Savings Goals',
  upload:       'Upload Slip',
};

function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-section="${section}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('sectionTitle').textContent = SECTION_TITLES[section] || section;
  STATE.currentSection = section;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.section));
});

// "View all →" links
document.querySelectorAll('.btn-text[data-section]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.section));
});

// ══════════════════════════════════════════════════
// 16. TRANSACTION FILTERS
// ══════════════════════════════════════════════════

document.getElementById('txFilter').addEventListener('change', renderTransactionsTable);
document.getElementById('txMonthFilter').addEventListener('change', renderTransactionsTable);

// ══════════════════════════════════════════════════
// 17. MOBILE SIDEBAR TOGGLE
// ══════════════════════════════════════════════════

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ══════════════════════════════════════════════════
// 18. INITIALISE
// ══════════════════════════════════════════════════

(async () => {
  // Set today's date display
  document.getElementById('todayDate').textContent = todayDisplay();

  // Set default month filter to current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('txMonthFilter').value = monthStr;

  // If no credentials, show demo mode hint
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    setConnectionStatus('demo');
    showToast('Running in demo mode. Open Settings to connect Supabase.', 'info');
  }

  await loadAll();
})();
