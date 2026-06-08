/**
 * pages/onboarding.js
 *
 * One-time business setup screen shown after first login.
 * Stores company name and logo (base64) in localStorage.
 * Keys: nb_company_name, nb_company_logo, nb_onboarded
 */

export const STORAGE_KEY_NAME = 'nb_company_name';
export const STORAGE_KEY_LOGO = 'nb_company_logo';
export const STORAGE_KEY_DONE = 'nb_onboarded';

/** Returns true if the user has already completed onboarding. */
export function isOnboarded() {
    return localStorage.getItem(STORAGE_KEY_DONE) === '1';
}

/** Return stored business info (may be null). */
export function getBusinessInfo() {
    return {
        name: localStorage.getItem(STORAGE_KEY_NAME) || 'My Business',
        logo: localStorage.getItem(STORAGE_KEY_LOGO) || null,
    };
}

/**
 * Render the onboarding screen inside #app.
 * @param {Function} onComplete — called when user clicks "Save & Continue"
 */
export function renderOnboarding(onComplete) {
    const app = document.getElementById('app');

    app.innerHTML = `
    <div class="onboarding-wrapper">
      <!-- Radial glow -->
      <div class="onboarding-glow"></div>

      <div class="onboarding-card card card-lg">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:32px;">
          <div class="sidebar-logo" style="margin:0 auto 20px;width:52px;height:52px;font-size:20px;">NB</div>
          <h1 style="font-size:28px;letter-spacing:-0.04em;margin-bottom:8px;">Welcome to NidhiBook</h1>
          <p class="text-muted">Set up your business profile to get started</p>
        </div>

        <div id="ob-error" class="error-msg mb-16"></div>

        <!-- Company Name -->
        <div class="form-group mb-20">
          <label>Company Name *</label>
          <input
            type="text"
            id="ob-company-name"
            placeholder="Enter your company name"
            style="font-size:16px;padding:14px 16px;"
            autocomplete="organization"
          />
        </div>

        <!-- Logo upload -->
        <div class="form-group mb-24">
          <label>Company Logo <span class="text-muted text-sm">(optional)</span></label>
          <div
            id="ob-drop-zone"
            class="ob-drop-zone"
            tabindex="0"
            role="button"
            aria-label="Upload logo"
          >
            <div id="ob-drop-content">
              <div style="font-size:36px;margin-bottom:8px;opacity:0.5;">🖼</div>
              <p style="font-size:13px;color:var(--clr-text-muted);">Drag &amp; drop or <span style="color:var(--clr-primary);cursor:pointer;" id="ob-browse-label">browse file</span></p>
              <p class="text-xs text-muted mt-4">PNG, JPG, SVG • max 2 MB</p>
            </div>
          </div>
          <input type="file" id="ob-file-input" accept="image/*" style="display:none;" />
        </div>

        <!-- CTA -->
        <button class="btn btn-glow" id="ob-save-btn" style="width:100%;font-size:15px;padding:14px;">
          Save &amp; Continue →
        </button>
      </div>
    </div>
  `;

    // ── Logo Upload Logic ──────────────────────────────────────────

    const dropZone = document.getElementById('ob-drop-zone');
    const fileInput = document.getElementById('ob-file-input');

    function previewFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showObError('Please upload a valid image file.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showObError('Image must be under 2 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            dropZone.innerHTML = `
        <img src="${base64}" id="ob-logo-preview"
          style="max-height:100px;max-width:180px;border-radius:10px;object-fit:contain;" />
        <p class="text-xs text-muted mt-8" style="cursor:pointer;">Click to change</p>
      `;
            dropZone.dataset.logo = base64;
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('ob-browse-label').addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) previewFile(fileInput.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files[0]) previewFile(e.dataTransfer.files[0]);
    });

    // ── Save ──────────────────────────────────────────────────────

    document.getElementById('ob-save-btn').addEventListener('click', () => {
        const name = document.getElementById('ob-company-name').value.trim();
        if (!name) {
            showObError('Company name is required.');
            document.getElementById('ob-company-name').focus();
            return;
        }

        localStorage.setItem(STORAGE_KEY_NAME, name);
        const logo = dropZone.dataset.logo || null;
        if (logo) localStorage.setItem(STORAGE_KEY_LOGO, logo);
        localStorage.setItem(STORAGE_KEY_DONE, '1');

        onComplete();
    });

    function showObError(msg) {
        const el = document.getElementById('ob-error');
        el.textContent = msg;
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 4000);
    }
}
