/**
 * pages/dashboard.js
 *
 * Renders the main dashboard and provides full CRUD for users_local (SQLite).
 * Called by app.js when the user is authenticated.
 *
 * @param {import('firebase/auth').User} firebaseUser
 */

import { logoutUser } from '../services/firebase.js';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../services/db.js';
import { showToast } from '../components/toast.js';

/**
 * Render the dashboard page.
 * @param {object} firebaseUser — current Firebase user object
 */
export async function renderDashboard(firebaseUser) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="dashboard-layout">

      <!-- ── Top Navigation ─────────────────────────────── -->
      <nav class="topnav">
        <span class="topnav-brand">NidhiBook Desktop</span>
        <div class="topnav-right">
          <span class="topnav-user" id="nav-user-email">${escapeHtml(firebaseUser.email)}</span>
          <button class="btn btn-ghost btn-sm" id="logout-btn">Sign Out</button>
        </div>
      </nav>

      <!-- ── Main Content ───────────────────────────────── -->
      <main class="dashboard-content">

        <!-- Welcome card -->
        <div class="card">
          <h2>Welcome back 👋</h2>
          <p style="color:var(--clr-text-muted); margin-top:6px;">
            Signed in as <strong>${escapeHtml(firebaseUser.email)}</strong>.
            The local SQLite database is active and ready.
          </p>
        </div>

        <!-- CRUD section -->
        <div class="card">
          <div class="section-header">
            <h2>Local Users <span class="badge" id="user-count">0</span></h2>
          </div>

          <!-- Error banner -->
          <div id="crud-error" class="error-msg" style="margin-bottom:16px;"></div>

          <!-- Create / Update form -->
          <form id="user-form" novalidate>
            <input type="hidden" id="edit-id" value="" />
            <div class="crud-form">
              <div class="form-group">
                <label for="input-name">Name</label>
                <input type="text"  id="input-name"  placeholder="Full name" />
              </div>
              <div class="form-group">
                <label for="input-email">Email</label>
                <input type="email" id="input-email" placeholder="user@example.com" />
              </div>
              <div style="display:flex; gap:8px; align-items:flex-end;">
                <button type="submit" class="btn btn-primary" id="form-submit-btn">Add User</button>
                <button type="button" class="btn btn-ghost" id="form-cancel-btn" style="display:none;">Cancel</button>
              </div>
            </div>
          </form>

          <!-- Users table -->
          <div class="table-wrapper" id="table-wrapper">
            <div class="empty-state" id="empty-state" style="display:none;">
              No users yet. Add one above.
            </div>
            <table id="users-table" style="display:none;">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="users-tbody"></tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  `;

  // ── Element refs ─────────────────────────────────────────
  const logoutBtn   = document.getElementById('logout-btn');
  const userForm    = document.getElementById('user-form');
  const editIdEl    = document.getElementById('edit-id');
  const inputName   = document.getElementById('input-name');
  const inputEmail  = document.getElementById('input-email');
  const submitBtn   = document.getElementById('form-submit-btn');
  const cancelBtn   = document.getElementById('form-cancel-btn');
  const crudError   = document.getElementById('crud-error');
  const userCountEl = document.getElementById('user-count');
  const emptyState  = document.getElementById('empty-state');
  const usersTable  = document.getElementById('users-table');
  const usersTbody  = document.getElementById('users-tbody');

  // ── Helpers ──────────────────────────────────────────────
  function showCrudError(msg) {
    crudError.textContent = msg;
    crudError.classList.add('visible');
    setTimeout(() => crudError.classList.remove('visible'), 5000);
  }

  function resetForm() {
    editIdEl.value  = '';
    inputName.value = '';
    inputEmail.value= '';
    submitBtn.textContent = 'Add User';
    cancelBtn.style.display = 'none';
  }

  function populateEditForm(user) {
    editIdEl.value   = user.id;
    inputName.value  = user.name;
    inputEmail.value = user.email;
    submitBtn.textContent = 'Update User';
    cancelBtn.style.display = 'inline-flex';
    inputName.focus();
  }

  async function refreshTable() {
    try {
      const users = await getUsers();
      userCountEl.textContent = users.length;

      if (users.length === 0) {
        emptyState.style.display = 'block';
        usersTable.style.display = 'none';
        return;
      }

      emptyState.style.display = 'none';
      usersTable.style.display = 'table';

      usersTbody.innerHTML = users
        .map(
          (u) => `
          <tr>
            <td>${u.id}</td>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>
              <div class="table-actions">
                <button
                  class="btn btn-ghost btn-sm"
                  data-action="edit"
                  data-id="${u.id}"
                  data-name="${escapeHtml(u.name)}"
                  data-email="${escapeHtml(u.email)}"
                >
                  Edit
                </button>
                <button
                  class="btn btn-danger btn-sm"
                  data-action="delete"
                  data-id="${u.id}"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `
        )
        .join('');
    } catch (err) {
      showCrudError(err.message);
      showToast('Failed to load users from database.', 'error');
    }
  }

  // ── Event: Logout ────────────────────────────────────────
  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'Signing out…';
    try {
      await logoutUser();
      // onAuthChange in app.js will render the login page
    } catch (err) {
      showToast(`Logout failed: ${err.message}`, 'error');
      logoutBtn.disabled = false;
      logoutBtn.textContent = 'Sign Out';
    }
  });

  // ── Event: Form submit (create or update) ────────────────
  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name  = inputName.value.trim();
    const email = inputEmail.value.trim();

    if (!name)  { showCrudError('Name is required.'); return; }
    if (!email) { showCrudError('Email is required.'); return; }

    submitBtn.disabled = true;
    const editingId = editIdEl.value;

    try {
      if (editingId) {
        await updateUser(Number(editingId), name, email);
        showToast('User updated successfully.', 'success');
      } else {
        await createUser(name, email);
        showToast('User created successfully.', 'success');
      }
      resetForm();
      await refreshTable();
    } catch (err) {
      showCrudError(err.message);
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ── Event: Cancel edit ───────────────────────────────────
  cancelBtn.addEventListener('click', resetForm);

  // ── Event: Table actions (edit / delete) via delegation ──
  usersTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id     = Number(btn.dataset.id);

    if (action === 'edit') {
      populateEditForm({
        id,
        name:  btn.dataset.name,
        email: btn.dataset.email,
      });
    } else if (action === 'delete') {
      if (!confirm(`Delete user #${id}? This cannot be undone.`)) return;
      btn.disabled = true;
      try {
        await deleteUser(id);
        showToast('User deleted.', 'success');
        await refreshTable();
      } catch (err) {
        showCrudError(err.message);
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    }
  });

  // ── Initial data load ────────────────────────────────────
  await refreshTable();
}

// ── Utilities ───────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format an ISO date string for display.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
