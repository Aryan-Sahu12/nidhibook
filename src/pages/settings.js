/**
 * pages/settings.js
 *
 * Settings page: Business profile editing + Theme switcher.
 */

import { getBusinessInfo, openBusinessSetupModal } from './onboarding.js';

const THEME_KEY = 'nb_theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

export async function renderSettings(container) {
  const { name: bizName, logo: bizLogo } = getBusinessInfo();
  const currentTheme = getTheme();

  container.innerHTML = `
    <div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:24px;padding-bottom:40px;">

      <!-- Business Profile Card -->
      <div class="card" style="padding:28px;">
        <div style="margin-bottom:20px;">
          <h3 style="font-size:15px;font-weight:700;color:var(--clr-text);margin-bottom:4px;">Business Profile</h3>
          <p style="font-size:12px;color:var(--clr-text-muted);">Update your company name and logo</p>
        </div>

        <div style="display:flex;align-items:center;gap:20px;padding:20px;background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:var(--radius-sm);margin-bottom:20px;">
          ${bizLogo
      ? `<img src="${bizLogo}" alt="logo" style="width:56px;height:56px;border-radius:12px;object-fit:contain;border:1px solid var(--clr-border);background:rgba(255,255,255,0.04);padding:4px;flex-shrink:0;" />`
      : `<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,var(--clr-primary),#0891b2);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#fff;flex-shrink:0;">NB</div>`
    }
          <div>
            <div style="font-weight:700;font-size:16px;color:var(--clr-text);" id="settings-biz-name">${escHtml(bizName)}</div>
            <div style="font-size:12px;color:var(--clr-text-muted);margin-top:4px;">Business Name</div>
          </div>
        </div>

        <button class="btn btn-primary" id="settings-edit-profile-btn" style="width:100%;">
          ✏️  Edit Profile
        </button>
      </div>

      <!-- Appearance Card -->
      <div class="card" style="padding:28px;">
        <div style="margin-bottom:20px;">
          <h3 style="font-size:15px;font-weight:700;color:var(--clr-text);margin-bottom:4px;">Appearance</h3>
          <p style="font-size:12px;color:var(--clr-text-muted);">Choose your preferred theme</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <!-- Dark Theme Option -->
          <button class="theme-option ${currentTheme === 'dark' ? 'theme-active' : ''}" id="theme-dark-btn" data-theme="dark"
            style="padding:20px;border-radius:var(--radius);border:2px solid ${currentTheme === 'dark' ? 'var(--clr-primary)' : 'var(--clr-border)'};background:${currentTheme === 'dark' ? 'rgba(20,184,166,0.08)' : 'var(--clr-surface)'};cursor:pointer;text-align:left;transition:all 150ms ease;display:flex;flex-direction:column;gap:12px;">
            <div style="width:100%;height:48px;border-radius:8px;background:#0F172A;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:6px;padding:8px;">
              <div style="width:8px;height:8px;border-radius:50%;background:#14B8A6;"></div>
              <div style="flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,0.1);"></div>
              <div style="width:20px;height:4px;border-radius:4px;background:rgba(255,255,255,0.05);"></div>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--clr-text);">🌙 Dark</div>
              <div style="font-size:11px;color:var(--clr-text-muted);margin-top:2px;">Premium dark mode</div>
            </div>
            ${currentTheme === 'dark' ? `<div style="font-size:10px;font-weight:700;color:var(--clr-primary);text-transform:uppercase;letter-spacing:.06em;">✓ Active</div>` : ''}
          </button>

          <!-- Light Theme Option -->
          <button class="theme-option ${currentTheme === 'light' ? 'theme-active' : ''}" id="theme-light-btn" data-theme="light"
            style="padding:20px;border-radius:var(--radius);border:2px solid ${currentTheme === 'light' ? 'var(--clr-primary)' : 'var(--clr-border)'};background:${currentTheme === 'light' ? 'rgba(20,184,166,0.08)' : 'var(--clr-surface)'};cursor:pointer;text-align:left;transition:all 150ms ease;display:flex;flex-direction:column;gap:12px;">
            <div style="width:100%;height:48px;border-radius:8px;background:#F8FAFC;border:1px solid rgba(0,0,0,0.1);display:flex;align-items:center;gap:6px;padding:8px;">
              <div style="width:8px;height:8px;border-radius:50%;background:#14B8A6;"></div>
              <div style="flex:1;height:4px;border-radius:4px;background:rgba(0,0,0,0.1);"></div>
              <div style="width:20px;height:4px;border-radius:4px;background:rgba(0,0,0,0.05);"></div>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--clr-text);">☀️ Light</div>
              <div style="font-size:11px;color:var(--clr-text-muted);margin-top:2px;">Clean light mode</div>
            </div>
            ${currentTheme === 'light' ? `<div style="font-size:10px;font-weight:700;color:var(--clr-primary);text-transform:uppercase;letter-spacing:.06em;">✓ Active</div>` : ''}
          </button>
        </div>
      </div>

    </div>
  `;

  // ── Profile edit button ──────────────────────────────────────
  document.getElementById('settings-edit-profile-btn').addEventListener('click', () => {
    openBusinessSetupModal(() => {
      // Re-render the settings page to reflect the new profile
      renderSettings(container);
      // Also update sidebar if present
      const { name, logo } = getBusinessInfo();
      const nameEl = document.getElementById('sidebar-brand-name');
      const logoImg = document.getElementById('sidebar-logo-img');
      const logoPlaceholder = document.getElementById('sidebar-logo-placeholder');
      if (nameEl) nameEl.textContent = name;
      if (logo && logoImg) logoImg.src = logo;
      else if (logo && logoPlaceholder) {
        logoPlaceholder.outerHTML = `<img src="${logo}" id="sidebar-logo-img" alt="Logo" style="width:36px;height:36px;object-fit:contain;background:rgba(255,255,255,0.05);padding:3px;" />`;
      }
    });
  });

  // ── Theme buttons ────────────────────────────────────────────
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      // Re-render to update active state
      renderSettings(container);
    });
  });
}

function escHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
