/**
 * pages/inventory.js
 * Product/inventory management: search, table, create/edit modal, auto-SKU.
 */

import {
  getProducts, searchProducts,
  createProduct, updateProduct, deleteProduct,
  getProductById, generateSku,
} from '../services/db.js';
import { showToast } from '../components/toast.js';

let debounceTimer = null;

export async function renderInventory(container) {
  container.innerHTML = `
    <div class="section-header mb-16">
      <div class="search-bar" style="width:320px;">
        <span class="search-icon">🔍</span>
        <input type="text" id="inv-search" placeholder="Search SKU, name, category…" />
      </div>
      <button class="btn btn-primary" id="add-prod-btn">+ Add Product</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="inv-table-area"></div>
    </div>
    <div id="inv-modal-area"></div>
  `;

  document.getElementById('inv-search').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadTable(e.target.value.trim()), 300);
  });

  document.getElementById('add-prod-btn').addEventListener('click', () => {
    openProductModal(null);
  });

  await loadTable('');
}

async function loadTable(query) {
  const area = document.getElementById('inv-table-area');
  if (!area) return;
  let products;
  try {
    products = query ? await searchProducts(query) : await getProducts();
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><p style="color:var(--clr-danger)">${err.message}</p></div>`;
    return;
  }

  if (products.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h3>No products yet</h3>
        <p>Click "Add Product" to add your first item</p>
      </div>`;
    return;
  }

  area.innerHTML = `
    <table>
      <thead><tr>
        <th>Name</th>
        <th>Category</th>
        <th>SKU</th>
        <th style="text-align:right">Wt/Unit (kg)</th>
        <th style="text-align:right">Price/Unit (₹)</th>
        <th>Actions</th>
      </tr></thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td class="fw-bold">${esc(p.name)}</td>
            <td class="text-muted">${p.category ? esc(p.category) : '—'}</td>
            <td><span class="badge badge-muted">${esc(p.sku)}</span></td>
            <td style="text-align:right">${fmt(p.weight_per_unit)}</td>
            <td style="text-align:right">₹${fmt(p.price_per_unit)}</td>
            <td>
              <div class="table-actions">
                <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${p.id}">Edit</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const tbody = area.querySelector('tbody');
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'edit') {
        const p = await getProductById(id);
        openProductModal(p);
      }
    });
  }
}

/**
 * Open the product creation/edit modal.
 * @param {Object} product — product object to edit (or null for new)
 * @param {Object} options — { onSuccess: function(newProduct), initialData: object }
 */
export function openProductModal(product, options = {}) {
  let area = document.getElementById('inv-modal-area');
  const isEdit = !!product;
  const initial = options.initialData || {};

  // If not on inventory page, use a temporary container
  if (!area) {
    area = document.createElement('div');
    area.id = 'temp-prod-modal-area';
    document.body.appendChild(area);
  }

  area.innerHTML = `
    <div class="modal-backdrop" id="prod-modal-backdrop">
      <div class="modal" id="prod-modal" style="max-width:560px;">
        <div class="modal-header">
          <span class="modal-title">${isEdit ? 'Edit Product' : 'Add Product'}</span>
          <button class="modal-close" id="prod-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div id="prod-form-error" class="error-msg mb-12"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${isEdit ? `
              <div class="form-group">
                <label>SKU</label>
                <input type="text" id="prod-sku" value="${esc(product.sku)}" readonly style="background:rgba(255,255,255,0.04);cursor:not-allowed;" />
              </div>
            ` : `<input type="hidden" id="prod-sku" value="" />`}
            <div class="form-group ${isEdit ? '' : 'span-2'}" style="${isEdit ? '' : 'grid-column:span 2'}"><label>Product Name *</label>
              <input type="text" id="prod-name" value="${isEdit ? esc(product.name) : esc(initial.name || '')}" placeholder="Complete name of product" /></div>
            <div class="form-group"><label>Category</label>
              <input type="text" id="prod-category" value="${isEdit && product.category ? esc(product.category) : esc(initial.category || '')}" placeholder="e.g. Grains, Pulses" /></div>
            <div class="form-group"><label>Weight per Unit (kg)</label>
              <input type="number" id="prod-weight" value="${isEdit ? product.weight_per_unit : ''}" placeholder="0.00" step="0.001" min="0" /></div>
            <div class="form-group" style="grid-column:span 2"><label>Price per Unit (₹)</label>
              <input type="number" id="prod-price" value="${isEdit ? product.price_per_unit : ''}" placeholder="0.00" step="0.01" min="0" /></div>
          </div>
          <div class="mt-12 text-muted text-sm" id="sku-preview">
            ${!isEdit ? 'SKU preview will appear as you type the name' : ''}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="prod-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="prod-submit-btn">${isEdit ? 'Update' : 'Create'} Product</button>
        </div>
      </div>
    </div>
  `;

  // Live SKU preview
  if (!isEdit) {
    document.getElementById('prod-name').addEventListener('input', (e) => {
      const preview = document.getElementById('sku-preview');
      if (!document.getElementById('prod-sku').value) {
        const auto = generateSku(e.target.value || 'PROD');
        preview.textContent = `Auto SKU: ${auto}`;
      }
    });
  }

  const close = () => {
    if (area.id === 'temp-prod-modal-area') area.remove();
    else area.innerHTML = '';
  };
  area.querySelector('#prod-modal-close').addEventListener('click', close);
  area.querySelector('#prod-cancel-btn').addEventListener('click', close);
  area.querySelector('#prod-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'prod-modal-backdrop') close();
  });

  area.querySelector('#prod-submit-btn').addEventListener('click', async () => {
    const name = document.getElementById('prod-name').value.trim();
    const errEl = document.getElementById('prod-form-error');
    if (!name) { showFormError(errEl, 'Product name is required.'); return; }

    const data = {
      sku: document.getElementById('prod-sku').value.trim(),
      name,
      category: document.getElementById('prod-category').value.trim() || null,
      weight_per_unit: parseFloat(document.getElementById('prod-weight').value) || 0,
      price_per_unit: parseFloat(document.getElementById('prod-price').value) || 0,
    };

    const btn = document.getElementById('prod-submit-btn');
    btn.disabled = true;
    try {
      if (isEdit) {
        await updateProduct(product.id, data);
        showToast('Product updated.', 'success');
        if (options.onSuccess) options.onSuccess({ ...data, id: product.id });
      } else {
        const result = await createProduct(data);
        showToast(`Product created. SKU: ${result.sku}`, 'success');
        if (options.onSuccess) options.onSuccess(result);
      }
      close();

      // Reload inventory table if present
      const searchBox = document.getElementById('inv-search');
      if (searchBox) await loadTable(searchBox.value || '');

    } catch (e) {
      showFormError(errEl, e.message);
    } finally {
      btn.disabled = false;
    }
  });
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

function fmt(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
