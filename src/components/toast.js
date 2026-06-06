/**
 * components/toast.js
 *
 * Lightweight toast notification helper.
 *
 * Usage:
 *   import { showToast } from './components/toast.js';
 *   showToast('Record saved!', 'success');
 *   showToast('Something went wrong', 'error');
 *   showToast('Loading…', 'info');
 */

/**
 * Display a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [durationMs=3500]
 */
export function showToast(message, type = 'info', durationMs = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
