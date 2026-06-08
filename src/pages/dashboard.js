/**
 * pages/dashboard.js
 * Analytics dashboard: KPI cards, top debtors, top purchasers.
 * (Home page handles company branding + recent activity.)
 */

import {
  getDashboardStats,
  getTopDebtors,
  getTopPurchasers,
} from '../services/db.js';

export async function renderDashboard(container) {
  container.innerHTML = `<div class="splash"><div class="splash-spinner"></div></div>`;

  let stats, debtors, purchasers;
  try {
    [stats, debtors, purchasers] = await Promise.all([
      getDashboardStats(),
      getTopDebtors(6),
      getTopPurchasers(6),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--clr-danger)">${err.message}</p></div>`;
    return;
  }

  container.innerHTML = `
    <!-- KPI Grid -->
    <div class="kpi-grid mb-24">
      ${kpiCard('Total Revenue', formatCurrency(stats.revenue), '💰', 'rgba(20,184,166,0.12)', 'var(--clr-primary)')}
      ${kpiCard('Outstanding Debt', formatCurrency(stats.outstandingDebt), '🔴', 'rgba(225,29,72,0.12)', 'var(--clr-rose)')}
      ${kpiCard('Cash Collected', formatCurrency(stats.cashCollected), '✅', 'rgba(16,185,129,0.12)', 'var(--clr-emerald)')}
    </div>

    <!-- Leaderboards -->
    <div class="two-col">

      <!-- Top Debtors -->
      <div class="card">
        <div class="section-header mb-16">
          <h3>🔴 Top Debtors</h3>
          <span class="badge badge-rose">${debtors.length} customers</span>
        </div>
        ${debtors.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">😊</div><h3>No debtors</h3><p>All balances are settled</p></div>`
      : `<div class="table-wrapper">
              <table>
                <thead><tr>
                  <th>Customer</th><th>Phone</th>
                  <th style="text-align:right">Balance Due</th>
                </tr></thead>
                <tbody>
                  ${debtors.map(c => `
                    <tr>
                      <td class="fw-bold">${esc(c.name)}</td>
                      <td class="text-muted">${esc(c.phone)}</td>
                      <td style="text-align:right">
                        <span class="badge badge-rose">₹${fmt(c.balance)}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
    }
      </div>

      <!-- Top Purchasers -->
      <div class="card">
        <div class="section-header mb-16">
          <h3>⭐ Top Purchasers</h3>
          <span class="badge badge-primary">${purchasers.length} customers</span>
        </div>
        ${purchasers.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🛒</div><h3>No sales yet</h3><p>Record your first transaction</p></div>`
      : `<div class="table-wrapper">
              <table>
                <thead><tr>
                  <th>Customer</th><th>Phone</th>
                  <th style="text-align:right">Lifetime Spend</th>
                </tr></thead>
                <tbody>
                  ${purchasers.filter(c => c.lifetime_spend > 0).map((c, i) => `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <div style="width:28px;height:28px;border-radius:8px;
                            background:${avatarColor(i)};display:flex;align-items:center;
                            justify-content:center;font-weight:800;font-size:12px;color:#fff;">
                            ${esc(c.name[0]).toUpperCase()}
                          </div>
                          <span class="fw-bold">${esc(c.name)}</span>
                        </div>
                      </td>
                      <td class="text-muted">${esc(c.phone)}</td>
                      <td style="text-align:right">
                        <span class="badge badge-primary">₹${fmt(c.lifetime_spend)}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
    }
      </div>
    </div>
  `;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function kpiCard(label, metric, icon, bg, color) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">
        <div class="kpi-label-icon" style="background:${bg}">${icon}</div>
        ${label}
      </div>
      <div class="kpi-metric" style="color:${color}">${metric}</div>
    </div>
  `;
}

function formatCurrency(val) {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
}

function fmt(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function avatarColor(i) {
  const colors = ['#14B8A6', '#6366f1', '#f59e0b', '#10b981', '#e11d48', '#8b5cf6'];
  return colors[i % colors.length];
}
