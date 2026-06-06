/**
 * app.js — Application entry point and router
 *
 * Responsibilities:
 *  1. Initialize Firebase authentication
 *  2. Initialize the local SQLite database
 *  3. Listen for auth state changes
 *  4. Route between Login page and Dashboard
 */

import { initFirebase, onAuthChange } from './services/firebase.js';
import { initDb } from './services/db.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { showToast } from './components/toast.js';

/**
 * Bootstrap the application.
 */
async function bootstrap() {
  // 1. Initialize Firebase
  try {
    initFirebase();
  } catch (err) {
    console.error('[App] Firebase init failed:', err);
    showFatalError(
      'Firebase configuration error. Check your .env file and restart the application.',
      err
    );
    return;
  }

  // 2. Initialize SQLite database
  try {
    await initDb();
  } catch (err) {
    console.error('[App] Database init failed:', err);
    showFatalError(
      'Database initialization failed. The application cannot start.',
      err
    );
    return;
  }

  // 3. Subscribe to auth state — this fires immediately with the restored session
  //    (or null if not signed in) because Firebase uses local persistence.
  let isFirstRender = true;

  onAuthChange(async (user) => {
    if (user) {
      // Authenticated → Dashboard
      try {
        await renderDashboard(user);
        if (!isFirstRender) {
          showToast('Signed in successfully!', 'success');
        }
      } catch (err) {
        console.error('[App] Dashboard render error:', err);
        showToast(`Dashboard error: ${err.message}`, 'error');
      }
    } else {
      // Unauthenticated → Login
      renderLogin();
    }
    isFirstRender = false;
  });
}

/**
 * Render a full-screen fatal error message (non-recoverable state).
 * @param {string} message
 * @param {Error} [err]
 */
function showFatalError(message, err) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; min-height:100vh; padding:24px; gap:16px;
      text-align:center;
    ">
      <div style="font-size:40px;">⚠️</div>
      <h2 style="color:#fca5a5;">Application Error</h2>
      <p style="color:#94a3b8; max-width:480px;">${message}</p>
      ${err ? `<pre style="
        background:#1a1d27; border:1px solid #2e3250; border-radius:8px;
        padding:12px; font-size:11px; color:#94a3b8;
        max-width:640px; overflow:auto; text-align:left;
      ">${String(err)}</pre>` : ''}
    </div>
  `;
}

// Start the application
bootstrap();
