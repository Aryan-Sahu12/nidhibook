/**
 * pages/activities.js
 *
 * Activity Log segment: shows timeline of system events.
 */

import { getActivities } from '../services/db.js';

export async function renderActivities(container) {
    container.innerHTML = `<div class="splash"><div class="splash-spinner"></div></div>`;

    let activities;
    try {
        activities = await getActivities(100);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p style="color:var(--clr-danger)">${err.message}</p></div>`;
        return;
    }

    if (activities.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No activity log yet</h3>
        <p>Actions like creating customers or recording sales will appear here</p>
      </div>`;
        return;
    }

    container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="section-header" style="padding:24px 28px 16px;">
        <h3>🕔 System Activity Log</h3>
        <p class="text-muted text-sm">Showing last 100 events</p>
      </div>
      
      <div class="table-wrapper">
        <table style="border-top:1px solid var(--clr-border);">
          <thead><tr>
            <th>Date & Time</th>
            <th>Action</th>
            <th>Type</th>
            <th>Entity</th>
            <th>Details</th>
          </tr></thead>
          <tbody>
            ${activities.map(a => `
              <tr style="font-size:13px;">
                <td class="text-muted" style="white-space:nowrap;">${fmtDate(a.created_at)}</td>
                <td>
                  <span class="badge ${actionBadge(a.action)}">${esc(a.action)}</span>
                </td>
                <td class="fw-bold">${esc(a.entity_type)}</td>
                <td>${a.entity_name ? esc(a.entity_name) : `<span class="text-muted text-xs">ID: ${a.entity_id || '—'}</span>`}</td>
                <td class="text-sm text-muted" style="max-width:250px">${a.details ? esc(a.details) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function actionBadge(action) {
    if (action === 'CREATE') return 'badge-primary';
    if (action === 'UPDATE') return 'badge-muted';
    if (action === 'DELETE') return 'badge-rose';
    return '';
}

function fmtDate(iso) {
    try {
        return new Date(iso).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch { return iso; }
}

function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
