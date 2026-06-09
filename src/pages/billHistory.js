/**
 * pages/billHistory.js
 * All transactions with expandable row details.
 */

import { getTransactionById, getTransactions, updateTransaction } from '../services/db.js';
import { showToast } from '../components/toast.js';

export async function renderBillHistory(container) {
  container.innerHTML = `<div class="splash"><div class="splash-spinner"></div></div>`;

  let transactions;
  try {
    transactions = await getTransactions({ limit: 200 });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--clr-danger)">${err.message}</p></div>`;
    return;
  }

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No transactions yet</h3>
        <p>Record a sale or settlement to see history</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <table>
        <thead><tr>
          <th>Date</th>
          <th>Customer</th>
          <th>Type</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:right">Paid</th>
          <th style="text-align:right">Due</th>
          <th></th>
        </tr></thead>
        <tbody id="bill-tbody">
          ${transactions.map(tx => `
            <tr class="bill-row" data-id="${tx.id}" style="cursor:pointer">
              <td class="text-muted text-sm">${fmtDate(tx.created_at)}</td>
              <td>
                <span class="fw-bold">${esc(tx.customer_name)}</span>
                <div class="text-muted text-xs">${esc(tx.customer_phone)}</div>
              </td>
              <td>
                <span class="badge ${tx.type === 'SALE' ? 'badge-primary' : 'badge-emerald'}">
                  ${tx.type === 'SALE' ? '🛒 Sale' : '✅ Settlement'}
                </span>
              </td>
              <td style="text-align:right" class="fw-bold">
                ${tx.type === 'SALE' ? `₹${fmt(tx.final_cost)}` : '—'}
              </td>
              <td style="text-align:right">₹${fmt(tx.amount_paid)}</td>
              <td style="text-align:right">
                ${Number(tx.due_amount) > 0
      ? `<span class="badge badge-rose">₹${fmt(tx.due_amount)}</span>`
      : `<span class="badge badge-emerald">Clear</span>`}
              </td>
              <td><span class="text-muted">▼</span></td>
            </tr>
            <tr class="expand-row" id="expand-${tx.id}">
              <td colspan="7">
                <div class="expand-inner" id="expand-inner-${tx.id}">
                  <div class="expand-content" id="expand-content-${tx.id}">
                    <div class="splash" style="min-height:60px;"><div class="splash-spinner"></div></div>
                  </div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Expandable rows
  const openRows = new Set();
  document.getElementById('bill-tbody').addEventListener('click', async (e) => {
    const row = e.target.closest('.bill-row');
    if (!row) return;
    const id = Number(row.dataset.id);
    const inner = document.getElementById(`expand-inner-${id}`);
    const content = document.getElementById(`expand-content-${id}`);
    const indicator = row.querySelector('span.text-muted');

    if (openRows.has(id)) {
      inner.classList.remove('open');
      openRows.delete(id);
      if (indicator) indicator.textContent = '▼';
    } else {
      inner.classList.add('open');
      openRows.add(id);
      if (indicator) indicator.textContent = '▲';
      // Load details
      try {
        const tx = await getTransactionById(id);
        content.innerHTML = renderExpandedDetails(tx);
        attachExpandListeners(id, tx, () => {
          // Update the row values in-place if possible, or just re-render table
          renderBillHistory(container);
        });
      } catch (err) {
        content.innerHTML = `<p style="color:var(--clr-danger)">${err.message}</p>`;
      }
    }
  });
}

function attachExpandListeners(id, tx, onSave) {
  const editBtn = document.getElementById(`edit-tx-btn-${id}`);
  const saveBtn = document.getElementById(`save-tx-btn-${id}`);
  const cancelBtn = document.getElementById(`cancel-tx-btn-${id}`);
  const viewArea = document.getElementById(`view-tx-area-${id}`);
  const editArea = document.getElementById(`edit-tx-area-${id}`);

  editBtn?.addEventListener('click', () => {
    viewArea.style.display = 'none';
    editArea.style.display = 'block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';
  });

  cancelBtn?.addEventListener('click', () => {
    viewArea.style.display = 'block';
    editArea.style.display = 'none';
    editBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  });

  saveBtn?.addEventListener('click', async () => {
    const amountPaid = parseFloat(document.getElementById(`edit-tx-paid-${id}`).value);
    const notes = document.getElementById(`edit-tx-notes-${id}`).value.trim();

    if (isNaN(amountPaid) || amountPaid < 0) {
      showToast('Invalid amount paid', 'error');
      return;
    }

    saveBtn.disabled = true;
    try {
      await updateTransaction(id, { amount_paid: amountPaid, notes });
      showToast('Transaction updated', 'success');
      onSave();
    } catch (err) {
      showToast(err.message, 'error');
      saveBtn.disabled = false;
    }
  });
}

function renderExpandedDetails(tx) {
  if (!tx) return '<p>Not found.</p>';

  const isSale = tx.type === 'SALE';
  return `
    <div style="display:grid;grid-template-columns:1fr 280px;gap:24px;">
      <!-- Left: Details -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;" class="mb-12">
            <h4 style="margin:0">${isSale ? 'Products' : 'Settlement Details'}</h4>
            <div id="tx-actions-${tx.id}">
                <button class="btn btn-ghost btn-xs" id="edit-tx-btn-${tx.id}">✎ Edit</button>
                <button class="btn btn-primary btn-xs" id="save-tx-btn-${tx.id}" style="display:none">Save</button>
                <button class="btn btn-ghost btn-xs" id="cancel-tx-btn-${tx.id}" style="display:none">Cancel</button>
            </div>
        </div>

        <div id="view-tx-area-${tx.id}">
            ${isSale && tx.items && tx.items.length > 0 ? `
            <table style="font-size:12px;">
                <thead><tr>
                <th>Product</th><th>SKU</th>
                <th style="text-align:right">Qty</th>
                <th style="text-align:right">Rate (₹)</th>
                <th style="text-align:right">Line Total</th>
                </tr></thead>
                <tbody>
                ${tx.items.map(item => {
    const lineTotal = (item.quantity * item.rate) - item.discount;
    return `<tr>
                    <td>${esc(item.product_name)}</td>
                    <td><span class="badge badge-muted">${esc(item.sku)}</span></td>
                    <td style="text-align:right">${fmt(item.quantity)}</td>
                    <td style="text-align:right">₹${fmt(item.rate)}</td>
                    <td style="text-align:right" class="fw-bold">₹${fmt(lineTotal)}</td>
                    </tr>`;
  }).join('')}
                </tbody>
            </table>
            ` : `
            <p class="text-muted">Amount paid: ₹${fmt(tx.amount_paid)}</p>
            `}
            ${tx.notes ? `<p class="text-muted mt-8"><strong>Notes:</strong> ${esc(tx.notes)}</p>` : ''}
        </div>

        <div id="edit-tx-area-${tx.id}" style="display:none">
            <div class="form-group mb-12">
                <label>Amount Paid (₹)</label>
                <input type="number" id="edit-tx-paid-${tx.id}" value="${tx.amount_paid}" step="0.01" min="0" />
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="edit-tx-notes-${tx.id}" style="height:80px;">${tx.notes || ''}</textarea>
            </div>
        </div>
      </div>

      <!-- Right: Bill Summary -->
      ${isSale ? `
        <div class="ledger-card" style="align-self:start;">
          <h4 class="mb-12">Bill Summary</h4>
          ${ledgerRow('Subtotal', `₹${fmt(tx.subtotal)}`)}
          ${Number(tx.transport_cost) > 0 ? ledgerRow(`Transport`, `₹${fmt(tx.transport_cost)}`) : ''}
          ${Number(tx.labour_cost) > 0 ? ledgerRow('Labour', `₹${fmt(tx.labour_cost)}`) : ''}
          ${Number(tx.other_cost) > 0 ? ledgerRow('Other', `₹${fmt(tx.other_cost)}`) : ''}
          ${Number(tx.global_discount) > 0 ? ledgerRow('Global Discount', `−₹${fmt(tx.global_discount)}`) : ''}
          <div class="ledger-row final-cost" style="margin-top:8px;">
            <span class="ledger-final-label">Final Cost</span>
            <span class="ledger-final-value" style="font-size:22px;">₹${fmt(tx.final_cost)}</span>
          </div>
          ${ledgerRow('Amount Paid', `₹${fmt(tx.amount_paid)}`)}
          <div class="ledger-row">
            <span class="ledger-label">Balance Due</span>
            <span class="${Number(tx.due_amount) > 0 ? 'ledger-due-value' : 'text-emerald'}" style="font-size:16px;font-weight:800;">
              ₹${fmt(tx.due_amount)}
            </span>
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

function fmt(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(iso) { try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } }
