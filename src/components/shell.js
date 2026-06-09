/**
 * components/shell.js
 *
 * Application shell: onboarding check → sidebar + main area.
 * Page content is swapped via navigateTo() without full re-renders.
 *
 * Nav order: Home → CRM → Inventory → Bill History → Dashboard
 */

import { logoutUser } from '../services/firebase.js';
import { showToast } from './toast.js';
import { renderHome } from '../pages/home.js';
import { renderDashboard } from '../pages/dashboard.js';
import { renderCustomers } from '../pages/customers.js';
import { renderInventory } from '../pages/inventory.js';
import { renderBillHistory } from '../pages/billHistory.js';
import { renderActivities } from '../pages/activities.js';
import { renderSettings, applyTheme, getTheme } from '../pages/settings.js';
import { openTransactionModal } from '../pages/transactionModal.js';
import { renderOnboarding, isOnboarded, getBusinessInfo, openBusinessSetupModal } from '../pages/onboarding.js';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'customers', label: 'Customers', icon: '◉' },
  { id: 'inventory', label: 'Inventory', icon: '▦' },
  { id: 'bill-history', label: 'Bill History', icon: '◎' },
  { id: 'activities', label: 'Activities', icon: '🕔' },
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

let currentPage = null;   // null = no page rendered yet
let currentUser = null;

// ─────────────────────────────────────────────────────────────────────────────
// SHELL ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by app.js after Firebase auth succeeds.
 * Shows onboarding on first launch, then the main shell.
 */
export async function renderShell(user) {
  currentUser = user;

  // Apply saved theme before rendering
  applyTheme(getTheme());

  if (!isOnboarded()) {
    renderOnboarding(() => mountShell(user));
  } else {
    await mountShell(user);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHELL MOUNT
// ─────────────────────────────────────────────────────────────────────────────

async function mountShell(user) {
  const app = document.getElementById('app');
  const { name: bizName, logo: bizLogo } = getBusinessInfo();

  app.innerHTML = `
    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="sidebar" id="app-sidebar">

        <!-- Brand  -->
        <div class="sidebar-brand" id="sidebar-brand-btn" style="cursor:pointer" title="Edit Business Profile">
          ${bizLogo
      ? `<img src="${bizLogo}" id="sidebar-logo-img" alt="logo"
                style="width:36px;height:36px;border-radius:10px;object-fit:contain;
                  border:1px solid var(--clr-border);background:rgba(255,255,255,0.04);padding:3px;flex-shrink:0;" />`
      : `<div class="sidebar-logo" id="sidebar-logo-placeholder">NB</div>`
    }
          <span class="sidebar-brand-text" id="sidebar-brand-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(bizName)}
          </span>
        </div>

        <!-- Nav -->
        <nav class="sidebar-nav" id="sidebar-nav">
          ${NAV_ITEMS.map(item => `
            <button class="nav-item ${item.id === 'home' ? 'active' : ''}"
              data-page="${item.id}" id="nav-${item.id}">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </button>
          `).join('')}
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer">
          <button class="nav-item" id="logout-btn">
            <span class="nav-icon">⏻</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- Main area -->
      <div class="main-area">
        <header class="page-header" id="page-header">
          <div class="header-title">
            <h1 id="header-title-text">Home</h1>
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
          <div class="splash"><div class="splash-spinner"></div></div>
        </main>
      </div>
    </div>
  `;

  // ── Wire sidebar nav ─────────────────────────────────────────
  document.getElementById('sidebar-nav').addEventListener('click', async (e) => {
    const btn = e.target.closest('.nav-item[data-page]');
    if (!btn) return;
    await navigateTo(btn.dataset.page);
  });

  // ── Record Transaction CTA ───────────────────────────────────
  document.getElementById('record-tx-btn').addEventListener('click', () => {
    openTransactionModal(async () => {
      await navigateTo(currentPage, true);
    });
  });

  // ── Edit Profile Sidebar ─────────────────────────────────────
  document.getElementById('sidebar-brand-btn').addEventListener('click', () => {
    openBusinessSetupModal(async () => {
      const { name, logo } = getBusinessInfo();
      const nameEl = document.getElementById('sidebar-brand-name');
      const logoImg = document.getElementById('sidebar-logo-img');
      const logoPlaceholder = document.getElementById('sidebar-logo-placeholder');

      if (nameEl) nameEl.textContent = name;
      if (logo) {
        if (logoImg) logoImg.src = logo;
        else if (logoPlaceholder) {
          logoPlaceholder.outerHTML = `<img src="${logo}" id="sidebar-logo-img" alt="Logo" class="sidebar-logo" style="width:36px;height:36px;object-fit:contain;background:rgba(255,255,255,0.05);padding:3px;" />`;
        }
      }

      // Refresh home hero if on home page
      if (currentPage === 'home') {
        await navigateTo('home', true);
      }

      showToast('Profile updated successfully!', 'success');
    });
  });

  // ── Logout ───────────────────────────────────────────────────
  async function performLogout() {
    try {
      await logoutUser();
    } catch (err) {
      showToast(`Logout failed: ${err.message}`, 'error');
    }
  }

  function handleLogout() {
    // Show confirmation modal
    const overlay = document.createElement('div');
    overlay.id = 'logout-confirm-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;z-index:9999;
      animation:fadeIn 0.15s ease;
    `;
    overlay.innerHTML = `
      <div style="
        background:var(--clr-surface-solid);border:1px solid var(--clr-border);
        border-radius:16px;padding:32px;max-width:380px;width:90%;
        box-shadow:0 24px 80px rgba(0,0,0,0.5);text-align:center;
        animation:slideUp 0.2s ease;
      ">
        <div style="font-size:40px;margin-bottom:16px;">⏻</div>
        <h3 style="font-size:18px;font-weight:800;color:var(--clr-text);margin-bottom:8px;">Sign Out?</h3>
        <p style="font-size:13px;color:var(--clr-text-muted);margin-bottom:28px;line-height:1.6;">
          Are you sure you want to sign out of NidhiBook?
        </p>
        <div style="display:flex;gap:12px;">
          <button id="logout-cancel-btn" class="btn btn-ghost" style="flex:1;">Cancel</button>
          <button id="logout-confirm-btn" class="btn btn-danger" style="flex:1;">Sign Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const dismiss = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
    document.getElementById('logout-cancel-btn').addEventListener('click', dismiss);
    document.getElementById('logout-confirm-btn').addEventListener('click', async () => {
      dismiss();
      await performLogout();
    });
  }

  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('header-logout-btn').addEventListener('click', handleLogout);


  // ── Initial route ────────────────────────────────────────────
  await navigateTo('home', true);  // force=true bypasses the currentPage guard on first load
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_META = {
  'home': { title: 'Home', sub: 'Your business at a glance' },
  'customers': { title: 'Customers', sub: 'Manage your customer relationships' },
  'inventory': { title: 'Inventory', sub: 'Products and pricing' },
  'bill-history': { title: 'Bill History', sub: 'Transaction audit log' },
  'activities': { title: 'Activities', sub: 'System activity & event log' },
  'dashboard': { title: 'Dashboard', sub: 'Analytics and performance' },
  'settings': { title: 'Settings', sub: 'Profile & Appearance' },
};

export async function navigateTo(pageId, force = false) {
  if (pageId === currentPage && !force) return;
  currentPage = pageId;

  // Update active nav
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  // Update header text
  const meta = PAGE_META[pageId] || { title: pageId, sub: '' };
  const titleEl = document.getElementById('header-title-text');
  const subEl = document.getElementById('header-subtitle-text');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;

  // Swap page content with animation
  const main = document.getElementById('page-main');
  if (!main) return;
  main.style.animation = 'none';

  switch (pageId) {
    case 'home': await renderHome(main); break;
    case 'customers': await renderCustomers(main); break;
    case 'inventory': await renderInventory(main); break;
    case 'bill-history': await renderBillHistory(main); break;
    case 'activities': await renderActivities(main); break;
    case 'dashboard': await renderDashboard(main); break;
    case 'settings': await renderSettings(main); break;
    default:
      main.innerHTML = `<div class="empty-state"><p>Page not found.</p></div>`;
  }

  main.offsetHeight; // force reflow
  main.style.animation = 'pageIn 0.3s ease both';
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
