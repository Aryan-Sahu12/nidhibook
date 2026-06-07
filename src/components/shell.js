/**
 * components/shell.js
 *
 * Renders the persistent application shell: sidebar + main area.
 * Page content is swapped via navigateTo() without full re-renders.
 */

import { logoutUser } from '../services/firebase.js';
import { showToast } from './toast.js';
import { renderDashboard } from '../pages/dashboard.js';
import { renderCustomers } from '../pages/customers.js';
import { renderInventory } from '../pages/inventory.js';
import { renderBillHistory } from '../pages/billHistory.js';
import { openTransactionModal } from '../pages/transactionModal.js';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '◈', },
    { id: 'customers', label: 'Customers', icon: '◉', },
    { id: 'inventory', label: 'Inventory', icon: '▦', },
    { id: 'bill-history', label: 'Bill History', icon: '◎', },
];

let currentPage = 'dashboard';
let currentUser = null;

/**
 * Render the global application shell.
 * Called once by app.js when user logs in.
 */
export async function renderShell(user) {
    currentUser = user;
    const app = document.getElementById('app');

    app.innerHTML = `
    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo">NB</div>
          <span class="sidebar-brand-text">NidhiBook</span>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav">
          ${NAV_ITEMS.map(item => `
            <button class="nav-item ${item.id === 'dashboard' ? 'active' : ''}"
              data-page="${item.id}" id="nav-${item.id}">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <button class="nav-item" id="logout-btn">
            <span class="nav-icon" id="logout-icon">⚙</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- Main area -->
      <div class="main-area">
        <header class="page-header" id="page-header">
          <div class="header-title">
            <h1 id="header-title-text">Dashboard</h1>
            <p id="header-subtitle-text">Welcome back, ${escapeHtml(user.email)}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-glow" id="record-tx-btn">
              + Record Transaction
            </button>
            <button class="btn btn-glass" id="header-logout-btn">
              Sign Out
            </button>
          </div>
        </header>

        <main class="page-content" id="page-main">
          <div class="splash">
            <div class="splash-spinner"></div>
          </div>
        </main>
      </div>
    </div>
  `;

    // Wire sidebar nav
    document.getElementById('sidebar-nav').addEventListener('click', async (e) => {
        const btn = e.target.closest('.nav-item[data-page]');
        if (!btn) return;
        await navigateTo(btn.dataset.page);
    });

    // Record transaction CTA
    document.getElementById('record-tx-btn').addEventListener('click', () => {
        openTransactionModal(async () => {
            await navigateTo(currentPage, true);
        });
    });

    // Logout buttons
    async function handleLogout() {
        try {
            await logoutUser();
        } catch (err) {
            showToast(`Logout failed: ${err.message}`, 'error');
        }
    }
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('header-logout-btn').addEventListener('click', handleLogout);

    // Initial page load
    await navigateTo('dashboard');
}

/**
 * Navigate to a page and update the sidebar active state.
 * @param {string} pageId
 * @param {boolean} force  — re-render even if already on this page
 */
export async function navigateTo(pageId, force = false) {
    if (pageId === currentPage && !force) return;
    currentPage = pageId;

    // Update sidebar active state
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageId);
    });

    // Update header
    const titles = {
        'dashboard': { title: 'Dashboard', sub: 'Executive overview & KPIs' },
        'customers': { title: 'Customers', sub: 'Manage your customer relationships' },
        'inventory': { title: 'Inventory', sub: 'Products and pricing' },
        'bill-history': { title: 'Bill History', sub: 'All transactions and settlements' },
    };
    const t = titles[pageId] || { title: pageId, sub: '' };
    document.getElementById('header-title-text').textContent = t.title;
    document.getElementById('header-subtitle-text').textContent = t.sub;

    // Animate out → swap content → animate in
    const main = document.getElementById('page-main');
    main.style.animation = 'none';

    // Render page
    switch (pageId) {
        case 'dashboard': await renderDashboard(main); break;
        case 'customers': await renderCustomers(main); break;
        case 'inventory': await renderInventory(main); break;
        case 'bill-history': await renderBillHistory(main); break;
        default:
            main.innerHTML = `<div class="empty-state"><p>Page not found.</p></div>`;
    }

    // Restart animation
    main.style.animation = '';
    main.offsetHeight; // reflow
    main.style.animation = 'pageIn 0.3s ease both';
}

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
