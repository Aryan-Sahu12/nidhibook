/**
 * app.js — Application entry point and router
 *
 * Responsibilities:
 *  1. Initialize Firebase authentication
 *  2. Initialize the local SQLite database
 *  3. Listen for auth state changes
 *  4. Route between Login page and main Shell (sidebar + pages)
 */

import { initFirebase, onAuthChange } from './services/firebase.js';
import { initDb } from './services/db.js';
import { renderLogin } from './pages/login.js';
import { renderShell } from './components/shell.js';
import { showToast } from './components/toast.js';

async function bootstrap() {
  try {
    initFirebase();
  } catch (err) {
    showFatalError('Firebase configuration error. Check your .env file and restart.', err);
    return;
  }

  try {
    await initDb();
  } catch (err) {
    showFatalError('Database initialization failed. The application cannot start.', err);
    return;
  }

  let isFirstRender = true;

  onAuthChange(async (user) => {
    if (user) {
      try {
        await renderShell(user);
        if (!isFirstRender) showToast('Signed in successfully!', 'success');
      } catch (err) {
        console.error('[App] Shell render error:', err);
        showToast(`Dashboard error: ${err.message}`, 'error');
      }
    } else {
      renderLogin();
    }
    isFirstRender = false;
  });
}

function showFatalError(message, err) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:100vh;padding:24px;gap:16px;text-align:center;">
      <div style="font-size:40px;">⚠️</div>
      <h2 style="color:#fda4af;">Application Error</h2>
      <p style="color:#94a3b8;max-width:480px;">${message}</p>
      ${err ? `<pre style="background:#1a1d27;border:1px solid #2e3250;border-radius:8px;
        padding:12px;font-size:11px;color:#94a3b8;max-width:640px;overflow:auto;text-align:left;">
        ${String(err)}</pre>` : ''}
    </div>
  `;
}

bootstrap();
