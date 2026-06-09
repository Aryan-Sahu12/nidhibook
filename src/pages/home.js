/**
 * pages/home.js
 *
 * Home page — default landing after login.
 * Shows business branding hero + recent transactions + recently sold products.
 */

import { getRecentTransactions, getRecentlySoldProducts, getTransactionById } from '../services/db.js';
import { getBusinessInfo } from './onboarding.js';
import { navigateTo } from '../components/shell.js';

export async function renderHome(container) {
    const { name: bizName, logo: bizLogo } = getBusinessInfo();

    container.innerHTML = `<div class="splash" style="min-height:200px;"><div class="splash-spinner"></div></div>`;

    let recentTxns, recentProducts;
    try {
        [recentTxns, recentProducts] = await Promise.all([
            getRecentTransactions(8),
            getRecentlySoldProducts(8),
        ]);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p style="color:var(--clr-danger)">${err.message}</p></div>`;
        return;
    }

    container.innerHTML = `
    <!-- Business Hero -->
    <div class="home-hero card mb-24" style="position:relative;overflow:hidden;padding:36px 40px;">
      <!-- Subtle teal glow inside card -->
      <div style="position:absolute;top:-80px;right:-80px;width:300px;height:300px;
        background:radial-gradient(circle,rgba(20,184,166,0.12) 0%,transparent 70%);
        pointer-events:none;"></div>

      <div style="display:flex;align-items:center;gap:20px;position:relative;z-index:1;">
        ${bizLogo
            ? `<img src="${bizLogo}" alt="Company Logo"
              style="width:72px;height:72px;border-radius:16px;object-fit:contain;
                border:1px solid var(--clr-border);background:rgba(255,255,255,0.04);padding:6px;" />`
            : `<div class="sidebar-logo" style="width:72px;height:72px;border-radius:16px;
              font-size:28px;letter-spacing:-2px;flex-shrink:0;">NB</div>`
        }
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
            letter-spacing:0.12em;color:var(--clr-primary);margin-bottom:6px;">
            Your Business
          </div>
          <h1 style="font-size:34px;font-weight:900;letter-spacing:-0.04em;
            background:linear-gradient(135deg,#F8FAFC,#14B8A6);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;
            background-clip:text;line-height:1.1;">
            ${esc(bizName)}
          </h1>
        </div>
      </div>
    </div>

    <!-- Two-column body -->
    <div class="two-col" style="align-items:start;">

      <!-- Recent Transactions -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="section-header" style="padding:20px 20px 16px;">
          <h3>🕐 Recent Transactions</h3>
          <button class="btn btn-ghost btn-xs" id="home-view-all-btn">View All</button>
        </div>
        ${recentTxns.length === 0
            ? `<div class="empty-state" style="padding:40px 20px;">
               <div class="empty-state-icon">📋</div>
               <h3>No transactions yet</h3>
               <p>Use "Record Transaction" to get started</p>
             </div>`
            : `<div class="table-wrapper">
              <table>
                <thead><tr>
                  <th>Customer</th><th>Type</th>
                  <th style="text-align:right">Amount</th><th>Date</th>
                </tr></thead>
                <tbody>
                  ${recentTxns.map(tx => `
                    <tr class="home-tx-row" data-id="${tx.id}" style="cursor:pointer;">
                      <td class="fw-bold">${esc(tx.customer_name)}</td>
                      <td>
                        <span class="badge ${tx.type === 'SALE' ? 'badge-primary' : 'badge-emerald'}">
                          ${tx.type === 'SALE' ? '🛒 Sale' : '✅ Settlement'}
                        </span>
                      </td>
                      <td style="text-align:right;font-variant-numeric:tabular-nums;">
                        ${tx.type === 'SALE'
                    ? `<span class="fw-bold text-primary">₹${fmt(tx.final_cost)}</span>`
                    : `<span class="fw-bold text-emerald">₹${fmt(tx.amount_paid)}</span>`}
                      </td>
                      <td class="text-muted text-sm" style="display:flex;justify-content:space-between;align-items:center">
                        ${fmtDateShort(tx.created_at)}
                        <span>▼</span>
                      </td>
                    </tr>
                    <tr class="expand-row" id="home-expand-${tx.id}">
                      <td colspan="4">
                        <div class="expand-inner" id="home-expand-inner-${tx.id}">
                          <div class="expand-content" id="home-expand-content-${tx.id}">
                            <div class="splash" style="min-height:60px;"><div class="splash-spinner"></div></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>

      <!-- Recently Sold Products -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="section-header" style="padding:20px 20px 16px;">
          <h3>📦 Recently Sold Products</h3>
          <button class="btn btn-ghost btn-xs" id="home-view-inv-btn">View Inventory</button>
        </div>
        ${recentProducts.length === 0
            ? `<div class="empty-state" style="padding:40px 20px;">
               <div class="empty-state-icon">🛒</div>
               <h3>No products sold yet</h3>
               <p>Add products in Inventory and record a sale</p>
             </div>`
            : `<div class="table-wrapper">
              <table>
                <thead><tr>
                  <th>Product</th><th>SKU</th>
                  <th style="text-align:right">Qty Sold</th><th>Last Sold</th>
                </tr></thead>
                <tbody>
                  ${recentProducts.map(p => `
                    <tr class="home-prod-row" style="cursor:pointer;">
                      <td class="fw-bold">${esc(p.name)}</td>
                      <td><span class="badge badge-muted">${esc(p.sku)}</span></td>
                      <td style="text-align:right;font-variant-numeric:tabular-nums;">${fmt(p.total_qty)}</td>
                      <td class="text-muted text-sm">${fmtDateShort(p.last_sold_at)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>
  `;

    // Navigation shortcuts
    document.getElementById('home-view-all-btn')?.addEventListener('click', () => navigateTo('bill-history'));
    document.getElementById('home-view-inv-btn')?.addEventListener('click', () => navigateTo('inventory'));

    // Expandable transaction rows
    const openRows = new Set();
    container.querySelector('.card:first-child .table-wrapper tbody')?.addEventListener('click', async (e) => {
        const row = e.target.closest('.home-tx-row');
        if (!row) return;
        const id = Number(row.dataset.id);
        const inner = document.getElementById(`home-expand-inner-${id}`);
        const content = document.getElementById(`home-expand-content-${id}`);
        const indicator = row.querySelector('.text-muted span');

        if (openRows.has(id)) {
            inner.classList.remove('open');
            openRows.delete(id);
            if (indicator) indicator.textContent = '▼';
        } else {
            inner.classList.add('open');
            openRows.add(id);
            if (indicator) indicator.textContent = '▲';
            try {
                const tx = await getTransactionById(id);
                content.innerHTML = renderExpandedDetails(tx);
            } catch (err) {
                content.innerHTML = `<p style="color:var(--clr-danger)">${err.message}</p>`;
            }
        }
    });
}

function fmt(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDateShort(iso) {
    try {
        return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
}

function renderExpandedDetails(tx) {
    if (!tx) return '<p>Not found.</p>';

    const isSale = tx.type === 'SALE';
    return `
    <div style="display:grid;grid-template-columns:1fr 280px;gap:24px;">
      <!-- Left: Items -->
      <div>
        <h4 class="mb-12">${isSale ? 'Products' : 'Settlement Details'}</h4>
        ${isSale && tx.items && tx.items.length > 0 ? `
          <table style="font-size:12px;">
            <thead><tr>
              <th>Product</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:right">Rate (₹)</th>
              <th style="text-align:right">Total</th>
            </tr></thead>
            <tbody>
              ${tx.items.map(item => {
        const lineTotal = (item.quantity * item.rate) - item.discount;
        return `<tr>
                  <td>${esc(item.product_name)}</td>
                  <td style="text-align:right">${fmt(item.quantity)}</td>
                  <td style="text-align:right">₹${fmt(item.rate)}</td>
                  <td style="text-align:right" class="fw-bold">₹${fmt(lineTotal)}</td>
                </tr>`;
    }).join('')}
            </tbody>
          </table>
        ` : `
          <p class="text-muted">Amount paid: ₹${fmt(tx.amount_paid)}</p>
          ${tx.notes ? `<p class="text-muted mt-8">Notes: ${esc(tx.notes)}</p>` : ''}
        `}
      </div>

      <!-- Right: Summary -->
      ${isSale ? `
        <div class="ledger-card" style="align-self:start;">
          <h4 class="mb-12">Bill Summary</h4>
          ${ledgerRow('Subtotal', `₹${fmt(tx.subtotal)}`)}
          ${Number(tx.global_discount) > 0 ? ledgerRow('Discount', `−₹${fmt(tx.global_discount)}`) : ''}
          <div class="ledger-row final-cost" style="margin-top:8px;">
            <span class="ledger-final-label">Final Cost</span>
            <span class="ledger-final-value" style="font-size:22px;">₹${fmt(tx.final_cost)}</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function ledgerRow(label, value) {
    return `
    <div class="ledger-row">
      <span class="ledger-label">${label}</span>
      <span class="ledger-value">${value}</span>
    </div>
  `;
}
