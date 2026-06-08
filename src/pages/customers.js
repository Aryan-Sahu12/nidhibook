/**
 * pages/customers.js
 * Customer management: search, table, create/edit modal, balance badges.
 * Fixes: single event-delegate per render, debt guard on delete.
 */

import {
  getCustomers, searchCustomers,
  createCustomer, updateCustomer, deleteCustomer,
  getCustomerById, getCustomerTransactions, getCustomerLifetimeSpend,
} from '../services/db.js';
import { showToast } from '../components/toast.js';

let debounceTimer = null;
let tableDelegate = null;   // track listener so we can remove it

export async function renderCustomers(container) {
  container.innerHTML = `
    <div class="section-header mb-16">
      <div class="search-bar" style="width:320px;">
        <span class="search-icon">🔍</span>
        <input type="text" id="cust-search" placeholder="Search name, phone, aadhaar…" />
      </div>
      <button class="btn btn-primary" id="add-cust-btn">+ Add Customer</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="cust-table-area"></div>
    </div>
    <div id="cust-modal-area"></div>
    <div id="cust-profile-area"></div>
  `;

  document.getElementById('cust-search').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadTable(e.target.value.trim()), 300);
  });

  document.getElementById('add-cust-btn').addEventListener('click', () => {
    openCustomerModal(null);
  });

  await loadTable('');
}

async function loadTable(query) {
  const area = document.getElementById('cust-table-area');
  if (!area) return;

  let customers;
  try {
    customers = query ? await searchCustomers(query) : await getCustomers();
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><p style="color:var(--clr-danger)">${esc(err.message)}</p></div>`;
    return;
  }

  if (customers.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <h3>No customers yet</h3>
        <p>Click "Add Customer" to get started</p>
      </div>`;
    return;
  }

  area.innerHTML = `
    <table>
      <thead><tr>
        <th>Name</th>
        <th>Phone</th>
        <th>Aadhaar</th>
        <th>Address</th>
        <th style="text-align:right">Balance</th>
        <th>Actions</th>
      </tr></thead>
      <tbody id="cust-tbody">
        ${customers.map(c => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:32px;height:32px;border-radius:9px;
                  background:${avatarBg(c.name)};display:flex;align-items:center;
                  justify-content:center;color:#fff;font-weight:800;font-size:13px;flex-shrink:0;">
                  ${esc(c.name[0]).toUpperCase()}
                </div>
                <span class="fw-bold" style="cursor:pointer;color:var(--clr-primary)"
                  data-action="profile" data-id="${c.id}">${esc(c.name)}</span>
              </div>
            </td>
            <td class="text-muted">${esc(c.phone)}</td>
            <td class="text-muted text-sm">${c.aadhaar ? esc(c.aadhaar) : '—'}</td>
            <td class="text-muted text-sm" style="max-width:160px;white-space:normal;">${c.address ? esc(c.address) : '—'}</td>
            <td style="text-align:right">
              ${Number(c.balance) > 0
      ? `<span class="badge badge-rose">₹${fmt(c.balance)}</span>`
      : `<span class="badge badge-emerald">Clear</span>`}
            </td>
            <td>
              <div class="table-actions">
                <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${c.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-action="delete" data-id="${c.id}"
                  data-balance="${c.balance}" data-name="${esc(c.name)}">Delete</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Single delegate on tbody — removed and re-added each render to avoid stacking
  const tbody = document.getElementById('cust-tbody');
  if (tbody) {
    tbody.addEventListener('click', handleTableClick);
  }
}

async function handleTableClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  if (action === 'profile') {
    await openCustomerProfile(id);

  } else if (action === 'edit') {
    const c = await getCustomerById(id);
    if (c) openCustomerModal(c);

  } else if (action === 'delete') {
    const balance = Number(btn.dataset.balance) || 0;
    const name = btn.dataset.name || 'this customer';

    // Guard: cannot delete customer with outstanding debt
    if (balance > 0) {
      showToast(
        `Cannot delete ${name} — they have an outstanding balance of ₹${fmt(balance)}. Clear the debt first.`,
        'error',
        5000
      );
      return;
    }

    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;

    btn.disabled = true;
    try {
      await deleteCustomer(id);
      showToast('Customer deleted.', 'success');
      const searchVal = document.getElementById('cust-search')?.value || '';
      await loadTable(searchVal);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  }
}

function openCustomerModal(customer) {
  const area = document.getElementById('cust-modal-area');
  const isEdit = !!customer;

  area.innerHTML = `
    <div class="modal-backdrop" id="cust-modal-backdrop">
      <div class="modal" id="cust-modal">
        <div class="modal-header">
          <span class="modal-title">${isEdit ? 'Edit Customer' : 'Add Customer'}</span>
          <button class="modal-close" id="cust-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div id="cust-form-error" class="error-msg mb-12"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group"><label>Name *</label>
              <input type="text" id="cust-name" value="${isEdit ? esc(customer.name) : ''}" placeholder="Full name" /></div>
            <div class="form-group"><label>Phone *</label>
              <input type="tel" id="cust-phone" value="${isEdit ? esc(customer.phone) : ''}" placeholder="Mobile number" /></div>
            <div class="form-group"><label>Alternate Phone</label>
              <input type="tel" id="cust-alt-phone" value="${isEdit && customer.alternate_phone ? esc(customer.alternate_phone) : ''}" placeholder="Optional" /></div>
            <div class="form-group"><label>Aadhaar</label>
              <input type="text" id="cust-aadhaar" value="${isEdit && customer.aadhaar ? esc(customer.aadhaar) : ''}" placeholder="Aadhaar number" /></div>
          </div>
          <div class="form-group mt-16"><label>Address</label>
            <textarea id="cust-address" placeholder="Full address">${isEdit && customer.address ? esc(customer.address) : ''}</textarea></div>
          <div class="form-group mt-12"><label>Notes</label>
            <textarea id="cust-notes" placeholder="Additional notes">${isEdit && customer.notes ? esc(customer.notes) : ''}</textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="cust-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="cust-submit-btn">${isEdit ? 'Update' : 'Create'} Customer</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { area.innerHTML = ''; };
  area.querySelector('#cust-modal-close').addEventListener('click', close);
  area.querySelector('#cust-cancel-btn').addEventListener('click', close);
  area.querySelector('#cust-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'cust-modal-backdrop') close();
  });

  area.querySelector('#cust-submit-btn').addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const errEl = document.getElementById('cust-form-error');

    if (!name) { showFormError(errEl, 'Name is required.'); return; }
    if (!phone) { showFormError(errEl, 'Phone is required.'); return; }

    const data = {
      name, phone,
      alternate_phone: document.getElementById('cust-alt-phone').value.trim() || null,
      aadhaar: document.getElementById('cust-aadhaar').value.trim() || null,
      address: document.getElementById('cust-address').value.trim() || null,
      notes: document.getElementById('cust-notes').value.trim() || null,
    };

    const btn = document.getElementById('cust-submit-btn');
    btn.disabled = true;
    try {
      if (isEdit) {
        await updateCustomer(customer.id, data);
        showToast('Customer updated.', 'success');
      } else {
        await createCustomer(data);
        showToast('Customer created.', 'success');
      }
      close();
      const searchVal = document.getElementById('cust-search')?.value || '';
      await loadTable(searchVal);
    } catch (err) {
      showFormError(errEl, err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

async function openCustomerProfile(id) {
  const area = document.getElementById('cust-profile-area');
  let customer, transactions, lifetimeSpend;
  try {
    [customer, transactions, lifetimeSpend] = await Promise.all([
      getCustomerById(id),
      getCustomerTransactions(id),
      getCustomerLifetimeSpend(id),
    ]);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  area.innerHTML = `
    <div class="modal-backdrop" id="profile-modal-backdrop">
      <div class="modal modal-fullscreen" style="max-width:800px">
        <div class="modal-header">
          <div>
            <span class="modal-title">${esc(customer.name)}</span>
            <p class="text-muted text-sm mt-4">${esc(customer.phone)}</p>
          </div>
          <button class="modal-close" id="profile-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="three-col mb-20">
            <div class="kpi-card" style="padding:16px;">
              <div class="kpi-label">Lifetime Spend</div>
              <div class="kpi-metric text-primary" style="font-size:24px;">₹${fmt(lifetimeSpend)}</div>
            </div>
            <div class="kpi-card" style="padding:16px;">
              <div class="kpi-label">Outstanding Debt</div>
              <div class="kpi-metric" style="font-size:24px;color:${Number(customer.balance) > 0 ? 'var(--clr-rose)' : 'var(--clr-emerald)'}">
                ₹${fmt(customer.balance)}
              </div>
            </div>
            <div class="kpi-card" style="padding:16px;">
              <div class="kpi-label">Transactions</div>
              <div class="kpi-metric text-primary" style="font-size:24px;">${transactions.length}</div>
            </div>
          </div>

          <div class="split-layout" style="grid-template-columns:260px 1fr">
            <div class="card" style="padding:20px;">
              <h4 class="mb-12">Contact Info</h4>
              ${infoRow('📱 Phone', customer.phone)}
              ${infoRow('📞 Alt Phone', customer.alternate_phone || '—')}
              ${infoRow('🪪 Aadhaar', customer.aadhaar || '—')}
              ${infoRow('📍 Address', customer.address || '—')}
              ${customer.notes ? infoRow('📝 Notes', customer.notes) : ''}
            </div>
            <div>
              <h4 class="mb-12">Transaction Timeline</h4>
              ${transactions.length === 0
      ? `<div class="empty-state"><p>No transactions yet</p></div>`
      : `<div class="timeline scrollable" style="max-height:400px;">
                    ${transactions.map(tx => timelineItem(tx)).join('')}
                  </div>`}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const close = () => { area.innerHTML = ''; };
  area.querySelector('#profile-close').addEventListener('click', close);
  area.querySelector('#profile-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'profile-modal-backdrop') close();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timelineItem(tx) {
  const isSale = tx.type === 'SALE';
  return `
    <div class="timeline-item ${isSale ? '' : 'settlement'}">
      <div class="timeline-header">
        <span class="badge ${isSale ? 'badge-primary' : 'badge-emerald'}">
          ${isSale ? '🛒 Sale' : '✅ Settlement'}
        </span>
        <span class="timeline-date">${fmtDate(tx.created_at)}</span>
      </div>
      ${isSale ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span class="text-muted">${tx.items?.length || 0} item(s)</span>
          <span class="fw-bold text-primary">₹${fmt(tx.final_cost)}</span>
        </div>
        ${Number(tx.due_amount) > 0 ? `<div style="font-size:12px;color:var(--clr-rose);margin-top:4px;">Due: ₹${fmt(tx.due_amount)}</div>` : ''}
      ` : `
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span class="text-muted">Paid ₹${fmt(tx.amount_paid)}</span>
          <span class="badge badge-emerald">Debt Paid</span>
        </div>
      `}
    </div>
  `;
}

function infoRow(label, value) {
  return `
    <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--clr-border-2);font-size:13px;">
      <span class="text-muted" style="min-width:90px;">${label}</span>
      <span>${esc(String(value))}</span>
    </div>
  `;
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

function fmt(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(iso) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function avatarBg(name = '') {
  const colors = ['#14B8A6', '#6366f1', '#f59e0b', '#10b981', '#e11d48', '#8b5cf6'];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}
