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
 * Open the business setup modal for editing profile (name/logo).
 * @param {Function} onSave — called after saving
 */
export function openBusinessSetupModal(onSave) {
    const area = document.createElement('div');
    area.id = 'ob-modal-root';
    document.body.appendChild(area);

    const { name: initialName, logo: initialLogo } = getBusinessInfo();

    area.innerHTML = `
    <div class="modal-backdrop" id="ob-backdrop">
      <div class="modal" style="max-width:480px;padding:32px;">
        <div style="text-align:center;margin-bottom:24px;">
           <span class="modal-title" style="font-size:24px;">Business Profile</span>
           <p class="text-muted text-sm mt-4">Update your branding</p>
        </div>

        <div id="ob-error" class="error-msg mb-16"></div>

        <div class="form-group mb-20">
          <label>Company Name *</label>
          <input type="text" id="ob-company-name" value="${initialName || ''}" placeholder="Enter company name" />
        </div>

        <div class="form-group mb-24">
          <label>Company Logo</label>
          <div id="ob-drop-zone" class="ob-drop-zone" style="height:140px;" data-logo="${initialLogo || ''}">
            ${initialLogo
            ? `<img src="${initialLogo}" style="max-height:80px;max-width:140px;border-radius:8px;" /><p class="text-xs text-muted mt-8">Click to change</p>`
            : `<div id="ob-drop-content">
                     <div style="font-size:32px;margin-bottom:4px;opacity:0.5;">🖼</div>
                     <p style="font-size:12px;color:var(--clr-text-muted);">Drag & drop or <span style="color:var(--clr-primary);cursor:pointer;" id="ob-browse-label">browse</span></p>
                   </div>`
        }
          </div>
          <input type="file" id="ob-file-input" accept="image/*" style="display:none;" />
        </div>

        <div style="display:flex;gap:12px;">
          <button class="btn btn-ghost flex-1" id="ob-cancel-btn">Cancel</button>
          <button class="btn btn-glow flex-1" id="ob-save-btn">Save Changes</button>
        </div>
      </div>
    </div>
  `;

    const close = () => area.remove();
    document.getElementById('ob-cancel-btn').addEventListener('click', close);
    document.getElementById('ob-backdrop').addEventListener('click', (e) => { if (e.target.id === 'ob-backdrop') close(); });

    const dropZone = document.getElementById('ob-drop-zone');
    const fileInput = document.getElementById('ob-file-input');

    const preview = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            dropZone.innerHTML = `<img src="${base64}" style="max-height:80px;max-width:140px;border-radius:8px;" /><p class="text-xs text-muted mt-8">Click to change</p>`;
            dropZone.dataset.logo = base64;
        };
        reader.readAsDataURL(file);
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) preview(fileInput.files[0]); });

    document.getElementById('ob-save-btn').addEventListener('click', async () => {
        const name = document.getElementById('ob-company-name').value.trim();
        if (!name) {
            const err = document.getElementById('ob-error');
            err.textContent = 'Name is required.';
            err.classList.add('visible');
            return;
        }
        localStorage.setItem(STORAGE_KEY_NAME, name);
        if (dropZone.dataset.logo) localStorage.setItem(STORAGE_KEY_LOGO, dropZone.dataset.logo);
        localStorage.setItem(STORAGE_KEY_DONE, '1');

        // Log profile update if db is available
        try {
            const { logActivity } = await import('../services/db.js');
            await logActivity('UPDATE', 'BUSINESS_PROFILE', null, name, 'Updated via sidebar');
        } catch (e) { }

        close();
        if (onSave) onSave();
    });
}

/**
 * Render the onboarding screen inside #app (original fullscreen version).
 * @param {Function} onComplete — called when user clicks "Save & Continue"
 */
export function renderOnboarding(onComplete) {
    const app = document.getElementById('app');

    app.innerHTML = `
    <div class="onboarding-wrapper">
      <div class="onboarding-glow"></div>
      <div class="onboarding-card card card-lg">
        <div style="text-align:center;margin-bottom:32px;">
          <div class="sidebar-logo" style="margin:0 auto 20px;width:52px;height:52px;font-size:20px;">NB</div>
          <h1 style="font-size:28px;letter-spacing:-0.04em;margin-bottom:8px;">Welcome to NidhiBook</h1>
          <p class="text-muted">Set up your business profile to get started</p>
        </div>
        <div id="ob-error" class="error-msg mb-16"></div>
        <div class="form-group mb-20">
          <label>Company Name *</label>
          <input type="text" id="ob-company-name" placeholder="Enter your company name" style="font-size:16px;padding:14px 16px;" />
        </div>
        <div class="form-group mb-24">
          <label>Company Logo <span class="text-muted text-sm">(optional)</span></label>
          <div id="ob-drop-zone" class="ob-drop-zone" tabindex="0" role="button">
            <div id="ob-drop-content">
              <div style="font-size:36px;margin-bottom:8px;opacity:0.5;">🖼</div>
              <p style="font-size:13px;color:var(--clr-text-muted);">Drag &amp; drop or <span style="color:var(--clr-primary);cursor:pointer;" id="ob-browse-label">browse file</span></p>
            </div>
          </div>
          <input type="file" id="ob-file-input" accept="image/*" style="display:none;" />
        </div>
        <button class="btn btn-glow" id="ob-save-btn" style="width:100%;font-size:15px;padding:14px;">Save &amp; Continue →</button>
      </div>
    </div>
  `;

    const dropZone = document.getElementById('ob-drop-zone');
    const fileInput = document.getElementById('ob-file-input');

    const preview = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            dropZone.innerHTML = `<img src="${base64}" style="max-height:100px;max-width:180px;border-radius:10px;object-fit:contain;" />`;
            dropZone.dataset.logo = base64;
        };
        reader.readAsDataURL(file);
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) preview(fileInput.files[0]); });

    document.getElementById('ob-save-btn').addEventListener('click', () => {
        const name = document.getElementById('ob-company-name').value.trim();
        if (!name) return;
        localStorage.setItem(STORAGE_KEY_NAME, name);
        if (dropZone.dataset.logo) localStorage.setItem(STORAGE_KEY_LOGO, dropZone.dataset.logo);
        localStorage.setItem(STORAGE_KEY_DONE, '1');
        onComplete();
    });
}
