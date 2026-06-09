/**
 * pages/transactionModal.js
 *
 * Fullscreen transaction modal: two modes — SALE and SETTLEMENT.
 * Implements all financial calculations and calls atomic db operations.
 */

import { getCustomers, getProducts, createSaleTransaction, createSettlementTransaction } from '../services/db.js';
import { showToast } from '../components/toast.js';
import { openProductModal } from './inventory.js';

/**
 * Open the transaction modal.
 * @param {Function} onSuccess  — called after successful transaction (e.g. refresh parent page)
 * @param {Object} options — optional { mode: 'SALE'|'SETTLEMENT', customerId: number }
 */
export function openTransactionModal(onSuccess, options = {}) {
  const area = document.createElement('div');
  area.id = 'tx-modal-root';
  document.body.appendChild(area);

  const close = () => {
    const backdrop = document.getElementById('tx-backdrop');
    if (backdrop) {
      backdrop.classList.add('closing');
      setTimeout(() => {
        area.remove();
      }, 200);
    } else {
      area.remove();
    }
  };

  area.innerHTML = `
    <div class="modal-backdrop" id="tx-backdrop">
      <div class="modal modal-fullscreen" id="tx-modal">
        <div class="modal-header">
          <div>
            <span class="modal-title">New Transaction</span>
            <p class="text-muted text-sm mt-4">Record a sale or debt settlement</p>
          </div>
          <button class="modal-close" id="tx-close-btn">✕</button>
        </div>

        <!-- Mode Switch -->
        <div style="padding:0 28px;">
          <div class="mode-switch" id="mode-switch">
            <button class="mode-btn active" data-mode="SALE" id="mode-sale-btn">🛒 Product Sale</button>
            <button class="mode-btn" data-mode="SETTLEMENT" id="mode-settlement-btn">✅ Settlement</button>
          </div>
        </div>

        <!-- Body -->
        <div id="tx-body" style="padding:0 28px 28px;"></div>
      </div>
    </div>
  `;

  document.getElementById('tx-close-btn').addEventListener('click', close);
  document.getElementById('tx-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'tx-backdrop') close();
  });

  let currentMode = options.mode || 'SALE';
  let customers = [];
  let products = [];

  // Load data
  Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
    customers = c;
    products = p;

    // Auto-select initial mode
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
    renderMode(currentMode);

    // Auto-fill settlement customer if requested
    if (currentMode === 'SETTLEMENT' && options.customerId) {
      const presetCust = customers.find(c => c.id === options.customerId);
      if (presetCust && Number(presetCust.balance) > 0) {
        // Synthesize the dropdown selection callback execution
        document.getElementById('sett-cust-search').value = presetCust.name;
        settlementCustomerId = presetCust.id;
        selectedCustomerBalance = Number(presetCust.balance);
        document.getElementById('sett-cust-selected').style.display = 'inline-flex';
        document.getElementById('sett-cust-selected').textContent = `✓ ${presetCust.name} — Debt: ₹${fmt(presetCust.balance)}`;
        document.getElementById('sett-balance-display').style.display = 'block';
        document.getElementById('sett-current-balance').textContent = `₹${fmt(presetCust.balance)}`;
        recalcSettlement();
      }
    }
  }).catch(err => {
    document.getElementById('tx-body').innerHTML =
      `<p style="color:var(--clr-danger);padding:20px">${err.message}</p>`;
  });

  // Mode switch
  document.getElementById('mode-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn || btn.dataset.mode === currentMode) return;
    currentMode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
    renderMode(currentMode);
  });

  // ─── RENDER FUNCTIONS ────────────────────────────────────────────────────────

  function renderMode(mode) {
    if (mode === 'SALE') renderSaleMode();
    else renderSettlementMode();
  }

  // ─── SALE MODE ────────────────────────────────────────────────────────────────

  let saleItems = [];   // [{productId, name, sku, quantity, rate, discount}]
  let saleCustomerId = null;

  function renderSaleMode() {
    saleItems = [];
    saleCustomerId = null;

    document.getElementById('tx-body').innerHTML = `
      <div class="tx-modal-body" style="padding:0;">
        <!-- LEFT COLUMN -->
        <div class="tx-col-left" style="display:flex;flex-direction:column;gap:20px;overflow-y:auto;max-height:70vh;padding-right:8px;">

          <!-- Customer Selector -->
          <div>
            <label class="form-group" style="margin-bottom:6px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--clr-text-muted);">Customer *</span>
            </label>
            <div class="dropdown-wrapper">
              <input type="text" id="sale-cust-search" placeholder="Search customer…" autocomplete="off" />
              <div class="dropdown-list" id="sale-cust-list" style="display:none;"></div>
            </div>
            <div id="sale-cust-selected" style="display:none;margin-top:8px;" class="badge badge-primary"></div>
          </div>

          <!-- Product Selector -->
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--clr-text-muted);margin-bottom:6px;display:block;">Add Product</label>
            <div class="dropdown-wrapper">
              <input type="text" id="sale-prod-search" placeholder="Search by name or SKU…" autocomplete="off" />
              <div class="dropdown-list" id="sale-prod-list" style="display:none;"></div>
            </div>
          </div>

          <!-- Selected Items -->
          <div id="sale-items-area">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--clr-text-muted);margin-bottom:8px;">
              Selected Items
            </div>
            <div id="sale-items-list">
              <div class="empty-state" style="padding:20px;text-align:center;color:var(--clr-text-faint);font-size:13px;">
                Add products above
              </div>
            </div>
          </div>

          <!-- Variables -->
          <div class="card" style="padding:16px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--clr-text-muted);margin-bottom:12px;">
              Additional Charges
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group"><label>Global Discount (₹)</label>
                <input type="number" id="s-global-discount" value="0" min="0" /></div>
              <div class="form-group"><label>Transport Cost (₹)</label>
                <input type="number" id="s-transport-cost" value="0" min="0" /></div>
              <div class="form-group"><label>Transport Source</label>
                <input type="text" id="s-transport-src" placeholder="City/Town" /></div>
              <div class="form-group"><label>Transport Destination</label>
                <input type="text" id="s-transport-dst" placeholder="City/Town" /></div>
              <div class="form-group"><label>Labour Cost (₹)</label>
                <input type="number" id="s-labour" value="0" min="0" /></div>
              <div class="form-group"><label>Commission (%)</label>
                <input type="number" id="s-commission" value="0" min="0" max="100" step="0.1" /></div>
              <div class="form-group" style="grid-column:span 2"><label>Other Cost (₹)</label>
                <input type="number" id="s-other" value="0" min="0" /></div>
            </div>
          </div>

          <!-- Payment -->
          <div class="card" style="padding:16px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--clr-text-muted);margin-bottom:12px;">
              Payment
            </div>
            <div class="form-group">
              <label>Amount Paid (₹)</label>
              <input type="number" id="s-amount-paid" value="0" min="0" style="font-size:18px;font-weight:700;" />
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Live Ledger -->
        <div class="tx-col-right" style="position:sticky;top:0;align-self:start;">
          <div class="ledger-card">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--clr-text-muted);margin-bottom:12px;">
              Live Ledger
            </div>
            ${ledgerRowHtml('Subtotal', 'ledger-subtotal')}
            ${ledgerRowHtml('Transport', 'ledger-transport')}
            ${ledgerRowHtml('Labour', 'ledger-labour')}
            ${ledgerRowHtml('Other', 'ledger-other')}
            ${ledgerRowHtml('Commission', 'ledger-commission')}
            ${ledgerRowHtml('Global Discount', 'ledger-discount')}
            <div class="divider" style="margin:8px 0;"></div>

            <div class="ledger-row final-cost">
              <span class="ledger-final-label">Final Cost</span>
              <span class="ledger-final-value" id="ledger-final-cost">₹0.00</span>
            </div>

            ${ledgerRowHtml('Amount Paid', 'ledger-paid')}

            <div class="ledger-row" style="margin-top:4px;">
              <span class="ledger-label" style="font-weight:700;">Balance Due</span>
              <span class="ledger-due-value" id="ledger-due-amount">₹0.00</span>
            </div>
          </div>

          <button class="btn btn-glow w-full mt-16" id="sale-submit-btn" style="width:100%;">
            Record Sale
          </button>
          <div id="sale-error" class="error-msg mt-8"></div>
        </div>
      </div>
    `;

    // ── Customer Autocomplete ───────────────────────────────────────────────
    setupDropdown(
      'sale-cust-search',
      'sale-cust-list',
      () => customers,
      (c) => ({ id: c.id, primary: c.name, secondary: `${c.phone}${Number(c.balance) > 0 ? ` • Owes ₹${fmt(c.balance)}` : ''}` }),
      (c) => {
        saleCustomerId = c.id;
        const el = document.getElementById('sale-cust-selected');
        el.style.display = 'inline-flex';
        el.textContent = `✓ ${c.name}`;
      }
    );

    // ── Product Autocomplete ────────────────────────────────────────────────
    setupDropdown(
      'sale-prod-search',
      'sale-prod-list',
      () => products,
      (p) => ({ id: p.id, primary: p.name, secondary: `SKU: ${p.sku} | ₹${fmt(p.price_per_unit)}/unit | ${fmt(p.weight_per_unit)}kg/unit` }),
      (p) => {
        addItem(p);
        document.getElementById('sale-prod-search').value = '';
      },
      {
        label: 'Add New Product',
        onAction: (q) => {
          openProductModal(null, {
            initialData: { name: q },
            onSuccess: (newProd) => {
              // 1. Update local products list (cache)
              if (!products.find(p => p.id === newProd.id)) {
                products.push(newProd);
              }

              // 2. Populate search field for visual feedback
              const searchInp = document.getElementById('sale-prod-search');
              if (searchInp) {
                searchInp.value = newProd.name;
              }

              // 3. Add to sale items list immediately
              addItem(newProd);
              showToast(`Added ${newProd.name} to transaction`, 'success');

              // 4. Clear search after a tiny delay and focus
              setTimeout(() => {
                if (searchInp) {
                  searchInp.value = '';
                  searchInp.focus();
                }
              }, 100);
            }
          });
        }
      }
    );

    // ── Live calculations on any input change ───────────────────────────────
    ['s-global-discount', 's-transport-cost', 's-labour', 's-commission', 's-other', 's-amount-paid'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', recalculate);
    });

    document.getElementById('sale-submit-btn').addEventListener('click', handleSaleSubmit);
  }

  function addItem(product) {
    // Avoid duplicates
    if (saleItems.find(i => i.productId === product.id)) {
      showToast('Product already added. Adjust quantity below.', 'info');
      return;
    }
    saleItems.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: 1,
      weight: product.weight_per_unit,
      rate: product.price_per_unit,
      discount: 0,
    });
    renderItemsList();
  }

  function renderItemsList() {
    const list = document.getElementById('sale-items-list');
    if (!list) return;

    if (saleItems.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;color:var(--clr-text-faint);font-size:13px;">Add products above</div>`;
      recalculate();
      return;
    }

    list.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 72px 80px 80px 32px;gap:6px;padding:6px 0;
        border-bottom:1px solid var(--clr-border);margin-bottom:4px;
        font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--clr-text-muted);">
        <span>Product</span><span style="text-align:right">Qty</span>
        <span style="text-align:right">Rate (₹)</span><span style="text-align:right">Disc (₹)</span><span></span>
      </div>
      ${saleItems.map((item, idx) => `
        <div class="item-row" data-idx="${idx}">
          <div>
            <div class="item-product-name">${esc(item.name)}</div>
            <div class="item-product-sku">${esc(item.sku)}</div>
          </div>
          <input class="item-input" type="number" min="0.001" step="0.001"
            value="${item.quantity}" data-field="quantity" data-idx="${idx}" />
          <input class="item-input" type="number" min="0" step="0.01"
            value="${item.rate}" data-field="rate" data-idx="${idx}" />
          <input class="item-input" type="number" min="0" step="0.01"
            value="${item.discount}" data-field="discount" data-idx="${idx}" />
          <button class="remove-item-btn" data-remove="${idx}">✕</button>
        </div>
      `).join('')}
    `;

    // Handle item field changes
    list.querySelectorAll('.item-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.dataset.idx);
        const field = inp.dataset.field;
        saleItems[idx][field] = parseFloat(inp.value) || 0;
        // Update weight from product per-unit * qty
        if (field === 'quantity') {
          const prod = products.find(p => p.id === saleItems[idx].productId);
          if (prod) saleItems[idx].weight = (prod.weight_per_unit || 0) * saleItems[idx].quantity;
        }
        recalculate();
      });
    });

    // Remove button
    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        saleItems.splice(Number(btn.dataset.remove), 1);
        renderItemsList();
      });
    });

    recalculate();
  }

  function recalculate() {
    const subtotal = saleItems.reduce((sum, item) => {
      return sum + Math.max(0, (item.quantity * item.rate) - item.discount);
    }, 0);

    const transportCost = parseFloat(document.getElementById('s-transport-cost')?.value) || 0;
    const labourCost = parseFloat(document.getElementById('s-labour')?.value) || 0;
    const otherCost = parseFloat(document.getElementById('s-other')?.value) || 0;
    const globalDiscount = parseFloat(document.getElementById('s-global-discount')?.value) || 0;
    const commissionPct = parseFloat(document.getElementById('s-commission')?.value) || 0;
    const amountPaid = parseFloat(document.getElementById('s-amount-paid')?.value) || 0;

    const grossTotal = subtotal + transportCost + labourCost + otherCost;
    const commissionAmount = grossTotal * (commissionPct / 100);
    const finalCost = Math.max(0, grossTotal - globalDiscount);
    const dueAmount = Math.max(0, finalCost - amountPaid);

    setText('ledger-subtotal', `₹${fmt(subtotal)}`);
    setText('ledger-transport', `₹${fmt(transportCost)}`);
    setText('ledger-labour', `₹${fmt(labourCost)}`);
    setText('ledger-other', `₹${fmt(otherCost)}`);
    setText('ledger-commission', `₹${fmt(commissionAmount)} (${commissionPct}%)`);
    setText('ledger-discount', `−₹${fmt(globalDiscount)}`);
    setText('ledger-final-cost', `₹${fmt(finalCost)}`);
    setText('ledger-paid', `₹${fmt(amountPaid)}`);
    setText('ledger-due-amount', `₹${fmt(dueAmount)}`);

    // Colorize due amount
    const dueEl = document.getElementById('ledger-due-amount');
    if (dueEl) dueEl.style.color = dueAmount > 0 ? 'var(--clr-rose)' : 'var(--clr-emerald)';
  }

  async function handleSaleSubmit() {
    const errEl = document.getElementById('sale-error');
    if (!saleCustomerId) { showFormError(errEl, 'Please select a customer.'); return; }
    if (saleItems.length === 0) { showFormError(errEl, 'Please add at least one product.'); return; }

    const subtotal = saleItems.reduce((s, i) => s + Math.max(0, (i.quantity * i.rate) - i.discount), 0);
    const transportCost = parseFloat(document.getElementById('s-transport-cost')?.value) || 0;
    const labourCost = parseFloat(document.getElementById('s-labour')?.value) || 0;
    const otherCost = parseFloat(document.getElementById('s-other')?.value) || 0;
    const globalDiscount = parseFloat(document.getElementById('s-global-discount')?.value) || 0;
    const commissionPct = parseFloat(document.getElementById('s-commission')?.value) || 0;
    const amountPaid = parseFloat(document.getElementById('s-amount-paid')?.value) || 0;
    const totalWeight = saleItems.reduce((s, i) => s + (i.weight || 0), 0);

    const grossTotal = subtotal + transportCost + labourCost + otherCost;
    const commissionAmount = grossTotal * (commissionPct / 100);
    const finalCost = Math.max(0, grossTotal - globalDiscount);
    const dueAmount = Math.max(0, finalCost - amountPaid);

    const btn = document.getElementById('sale-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Processing…';

    try {
      await createSaleTransaction({
        customerId: saleCustomerId,
        items: saleItems,
        totalWeight,
        subtotal,
        globalDiscount,
        finalCost,
        amountPaid,
        dueAmount,
        transportSource: document.getElementById('s-transport-src')?.value || null,
        transportDestination: document.getElementById('s-transport-dst')?.value || null,
        transportCost,
        labourCost,
        commissionPercentage: commissionPct,
        commissionAmount,
        otherCost,
      });
      showToast('Sale recorded successfully!', 'success');
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showFormError(errEl, err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Record Sale'; }
    }
  }

  // ─── SETTLEMENT MODE ──────────────────────────────────────────────────────────

  let settlementCustomerId = null;
  let selectedCustomerBalance = 0;

  function renderSettlementMode() {
    document.getElementById('tx-body').innerHTML = `
      <div style="max-width:520px;margin:0 auto;">

        <!-- Customer Selector -->
        <div class="form-group mb-20">
          <label>Customer with Outstanding Balance *</label>
          <div class="dropdown-wrapper">
            <input type="text" id="sett-cust-search" placeholder="Search debtor…" autocomplete="off" />
            <div class="dropdown-list" id="sett-cust-list" style="display:none;"></div>
          </div>
          <div id="sett-cust-selected" style="display:none;margin-top:8px;" class="badge badge-rose"></div>
        </div>

        <!-- Current Balance Preview -->
        <div class="ledger-card mb-20" id="sett-balance-display" style="display:none;">
          <div class="ledger-row">
            <span class="ledger-label">Current Balance (Debt)</span>
            <span class="ledger-due-value text-rose" id="sett-current-balance">₹0.00</span>
          </div>
          <div class="ledger-row">
            <span class="ledger-label">Paying Now</span>
            <span class="ledger-value text-emerald" id="sett-paying-now">₹0.00</span>
          </div>
          <div class="divider" style="margin:8px 0;"></div>
          <div class="ledger-row">
            <span class="ledger-label" style="font-weight:700;">Remaining After Settlement</span>
            <span class="ledger-due-value" id="sett-remaining">₹0.00</span>
          </div>
        </div>

        <!-- Amount -->
        <div class="form-group mb-16">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <label style="margin:0">Amount Being Paid (₹) *</label>
            <button class="btn btn-ghost btn-xs" id="sett-all-btn" style="color:var(--clr-primary); font-weight:600;">Settle All</button>
          </div>
          <input type="number" id="sett-amount" value="0" min="0" step="0.01"
            style="font-size:20px;font-weight:800;color:var(--clr-primary);" />
        </div>

        <!-- Notes -->
        <div class="form-group mb-24">
          <label>Notes (optional)</label>
          <textarea id="sett-notes" placeholder="Payment mode, reference number, etc."></textarea>
        </div>

        <button class="btn btn-glow" id="sett-submit-btn" style="width:100%;">
          Record Settlement
        </button>
        <div id="sett-error" class="error-msg mt-8"></div>
      </div>
    `;

    // Customer selector — filter to debtors only
    const debtors = customers.filter(c => Number(c.balance) > 0);
    setupDropdown(
      'sett-cust-search',
      'sett-cust-list',
      () => debtors.length > 0 ? debtors : customers,
      (c) => ({ id: c.id, primary: c.name, secondary: `${c.phone} • Owes ₹${fmt(c.balance)}` }),
      (c) => {
        settlementCustomerId = c.id;
        selectedCustomerBalance = Number(c.balance);
        document.getElementById('sett-cust-selected').style.display = 'inline-flex';
        document.getElementById('sett-cust-selected').textContent = `✓ ${c.name} — Debt: ₹${fmt(c.balance)}`;
        document.getElementById('sett-balance-display').style.display = 'block';
        document.getElementById('sett-current-balance').textContent = `₹${fmt(c.balance)}`;
        recalcSettlement();
      }
    );

    document.getElementById('sett-all-btn')?.addEventListener('click', () => {
      if (settlementCustomerId) {
        const amtInput = document.getElementById('sett-amount');
        if (amtInput) {
          amtInput.value = selectedCustomerBalance;
          recalcSettlement();
        }
      } else {
        showToast('Select a customer first', 'info');
      }
    });

    document.getElementById('sett-amount')?.addEventListener('input', recalcSettlement);
    document.getElementById('sett-submit-btn').addEventListener('click', handleSettlementSubmit);
  }

  function recalcSettlement() {
    const paying = parseFloat(document.getElementById('sett-amount')?.value) || 0;
    const remaining = Math.max(0, selectedCustomerBalance - paying);
    setText('sett-paying-now', `₹${fmt(paying)}`);
    setText('sett-remaining', `₹${fmt(remaining)}`);
    const remEl = document.getElementById('sett-remaining');
    if (remEl) remEl.style.color = remaining > 0 ? 'var(--clr-rose)' : 'var(--clr-emerald)';
  }

  async function handleSettlementSubmit() {
    const errEl = document.getElementById('sett-error');
    const amountPaid = parseFloat(document.getElementById('sett-amount')?.value) || 0;
    if (!settlementCustomerId) { showFormError(errEl, 'Please select a customer.'); return; }
    if (amountPaid <= 0) { showFormError(errEl, 'Amount must be greater than 0.'); return; }

    const btn = document.getElementById('sett-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Processing…';

    try {
      await createSettlementTransaction({
        customerId: settlementCustomerId,
        amountPaid,
        notes: document.getElementById('sett-notes')?.value || null,
      });
      showToast('Settlement recorded!', 'success');
      close();
      if (onSuccess) onSuccess();
    } catch (err) {
      showFormError(errEl, err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Record Settlement'; }
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  function setupDropdown(inputId, listId, getItems, makeOption, onSelect, actionConfig) {
    const inp = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!inp || !list) return;

    function renderList(query) {
      const all = getItems();
      const q = query.toLowerCase().trim();
      const filtered = q
        ? all.filter(i => {
          const opt = makeOption(i);
          return opt.primary.toLowerCase().includes(q) || opt.secondary.toLowerCase().includes(q);
        })
        : all.slice(0, 20);

      let html = filtered.map(item => {
        const opt = makeOption(item);
        return `
          <div class="dropdown-item" data-id="${opt.id}">
            <div class="dropdown-item-name">${esc(opt.primary)}</div>
            <div class="dropdown-item-sub">${esc(opt.secondary)}</div>
          </div>
        `;
      }).join('');

      if (actionConfig && q) {
        html += `
          <div class="dropdown-item action-item" id="${inputId}-action" style="border-top:1px solid var(--clr-border); background:rgba(20,184,166,0.05);">
            <div class="dropdown-item-name" style="color:var(--clr-primary);">+ ${actionConfig.label}: "${esc(query)}"</div>
            <div class="dropdown-item-sub">Create this product now</div>
          </div>
        `;
      }

      if (filtered.length === 0 && !actionConfig) {
        list.innerHTML = `<div class="dropdown-item text-muted">No results</div>`;
      } else {
        list.innerHTML = html;
      }
      list.style.display = 'block';

      if (actionConfig) {
        const actBtn = document.getElementById(`${inputId}-action`);
        actBtn?.addEventListener('mousedown', (e) => {
          e.preventDefault();
          list.style.display = 'none';
          actionConfig.onAction(query);
        });
      }

      list.querySelectorAll('.dropdown-item:not(.action-item)').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const id = Number(el.dataset.id);
          const found = getItems().find(i => i.id === id);
          if (found) {
            inp.value = makeOption(found).primary;
            list.style.display = 'none';
            onSelect(found);
          }
        });
      });
    }

    inp.addEventListener('input', () => renderList(inp.value));
    inp.addEventListener('focus', () => renderList(inp.value));
    inp.addEventListener('blur', () => setTimeout(() => { list.style.display = 'none'; }, 150));
  }

  function ledgerRowHtml(label, id) {
    return `
      <div class="ledger-row">
        <span class="ledger-label">${label}</span>
        <span class="ledger-value" id="${id}">₹0.00</span>
      </div>
    `;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showFormError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 5000);
  }
}

function fmt(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
