/**
 * pages/login.js
 *
 * Returns the login page HTML string and wires up the form.
 * Called by app.js when the user is not authenticated.
 */

import { loginUser } from '../services/firebase.js';
import { showToast } from '../components/toast.js';

/**
 * Render the login page into #app and attach event listeners.
 */
export function renderLogin() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-wrapper">
      <div class="card login-card">
        <div class="login-header">
          <h1>NidhiBook Desktop</h1>
          <p>Sign in to your account to continue</p>
        </div>

        <form class="login-form" id="login-form" novalidate>
          <div id="login-error" class="error-msg" role="alert"></div>

          <div class="form-group">
            <label for="login-email">Email address</label>
            <input
              type="email"
              id="login-email"
              name="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              name="password"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary" id="login-submit-btn">
            Sign In
          </button>
        </form>
      </div>
    </div>
  `;

  // ── Wire up form ─────────────────────────────────────────
  const form      = document.getElementById('login-form');
  const emailEl   = document.getElementById('login-email');
  const passwordEl= document.getElementById('login-password');
  const errorEl   = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Signing in…' : 'Sign In';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email    = emailEl.value.trim();
    const password = passwordEl.value;

    // Basic client-side validation
    if (!email) { showError('Please enter your email address.'); return; }
    if (!password) { showError('Please enter your password.'); return; }

    setLoading(true);
    try {
      await loginUser(email, password);
      // onAuthChange in app.js will detect the new user and render the dashboard
    } catch (err) {
      setLoading(false);
      showError(mapFirebaseError(err));
    }
  });
}

/**
 * Map Firebase auth error codes to user-friendly messages.
 * @param {Error} err
 * @returns {string}
 */
function mapFirebaseError(err) {
  const code = err.code || '';
  const map = {
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-disabled':          'This account has been disabled. Contact support.',
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Invalid credentials. Please check your email and password.',
    'auth/too-many-requests':      'Too many failed attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
  };
  return map[code] || `Login failed: ${err.message || 'Unknown error'}`;
}
