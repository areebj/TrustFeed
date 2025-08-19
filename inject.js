// inject.js — page-context UI for the Trust Feed widget (POC)

// 0) Idempotency: if already injected, do nothing
if (document.getElementById('tf-widget-root')) {
  // Already present on the page — exit quietly
  // (This protects against duplicate injections on SPAs or double calls)
} else {
  (function () {
    // 1) Read settings from <html data-*> with safe fallbacks
    //    (Service worker sets these *after* injection in our POC; we’ll also observe changes.)
    const rootEl = document.documentElement;

    function readSettings() {
      return {
        siteId: rootEl.dataset.tfSiteId || 'tf_demo_site',
        color: rootEl.dataset.tfColor || '#5b7cfa'
      };
    }

    let settings = readSettings();

    // 2) Create a host element and attach a Shadow DOM to isolate styles
    const host = document.createElement('div');
    host.id = 'tf-widget-root';
    host.style.all = 'initial'; // reset any inherited styles from the page
    host.style.position = 'fixed';
    host.style.right = '18px';
    host.style.bottom = '18px';
    host.style.zIndex = '2147483647'; // top-most
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // 3) Base styles (scoped to Shadow DOM)
    const style = document.createElement('style');
    style.textContent = `
      :host { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .btn { background: ${settings.color}; color:#fff; border:0; padding:10px 14px; border-radius:9999px;
             box-shadow:0 8px 24px rgba(0,0,0,.18); cursor:pointer; font-weight:600; }
      .btn:focus { outline: 2px solid #fff4; outline-offset: 2px; }
      .overlay { position:fixed; inset:0; background:rgba(10,12,24,.60); display:none; }
      .modal { position:fixed; right:24px; bottom:24px; width:360px; max-width:calc(100vw - 32px);
               background:#1b2040; color:#f2f3f8; border-radius:14px; border:1px solid #2e356e; padding:16px; display:none; }
      .hdr { font-weight:700; margin-bottom:10px; font-size:15px; }
      .row { margin:10px 0; }
      .input, .textarea { width:100%; background:#111538; border:1px solid #2a2f5f; color:#cfd3f1; border-radius:10px; padding:10px; }
      .textarea { height:90px; resize:vertical; }
      .hint { color:#9aa1c6; font-size:12px; margin-top:4px; }
      .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
      .btn-secondary { background:#111538; color:#cfd3f1; }
      .faces { display:flex; gap:8px; font-size:20px; user-select: none; }
      .faces [data-rate] { cursor: pointer; transition: transform .12s ease; }
      .faces [data-rate].sel { transform: scale(1.2); }

      .hidden { display:none !important; }

      .thanks { text-align:center; padding:26px 10px; }
      .check { width:56px; height:56px; border-radius:50%; margin:0 auto 12px; background:rgba(71,209,140,.2);
               display:flex; align-items:center; justify-content:center; font-size:28px; color:#47d18c; }
      .coupon { margin:14px auto 8px; padding:10px; text-align:center; width:100%; border-radius:10px;
                background:#13204a; border:1px solid #2a3b78; color:#cfe3ff; }
      .cta { background:${settings.color}; color:#fff; border:0; padding:10px 12px; border-radius:10px; width:100%; font-weight:700; margin-top:10px; cursor:pointer; }
    `;
    shadow.appendChild(style);

    // 4) Floating trigger button
    const trigger = document.createElement('button');
    trigger.className = 'btn';
    trigger.type = 'button';
    trigger.textContent = 'Feedback';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    shadow.appendChild(trigger);

    // 5) Overlay + modal container
    const overlay = document.createElement('div'); overlay.className = 'overlay';
    const modal = document.createElement('div');   modal.className   = 'modal';
    shadow.appendChild(overlay);
    shadow.appendChild(modal);

    // 6) Modal content: form view
    const formView = document.createElement('div');
    formView.innerHTML = `
      <div class="hdr">How was your experience?</div>
      <div class="row faces" id="tfFaces" aria-label="Quick rating">
        <span role="button" tabindex="0" data-rate="1" aria-label="Very bad">😠</span>
        <span role="button" tabindex="0" data-rate="2" aria-label="Bad">🙁</span>
        <span role="button" tabindex="0" data-rate="3" aria-label="Okay">😐</span>
        <span role="button" tabindex="0" data-rate="4" aria-label="Good">🙂</span>
        <span role="button" tabindex="0" data-rate="5" aria-label="Excellent">🤩</span>
      </div>
      <div class="row">
        <input class="input" id="tfName" placeholder="Name (optional)" />
      </div>
      <div class="row">
        <input class="input" id="tfEmail" placeholder="Email (kept private)" />
        <div class="hint">We never display your email publicly.</div>
      </div>
      <div class="row">
        <textarea class="textarea" id="tfText" placeholder="Tell us more…"></textarea>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" id="tfCancel" type="button">Cancel</button>
        <button class="btn" id="tfSubmit" type="button">Submit</button>
      </div>
    `;

    // 7) Modal content: thank-you view
    const thanksView = document.createElement('div');
    thanksView.className = 'thanks hidden';
    thanksView.innerHTML = `
      <div class="check">✓</div>
      <div class="hdr">Thanks for the feedback!</div>
      <div class="hint">Your review helps this business improve.</div>
      <div class="coupon">Here’s 10% off next time:<br><b>CAPPUCCINO10</b></div>
      <button class="cta" id="tfView" type="button">View this business’s reviews →</button>
    `;

    modal.appendChild(formView);
    modal.appendChild(thanksView);

    // 8) State + a few helpers
    let rating = 0;

    function openModal() {
      overlay.style.display = 'block';
      modal.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');
      // focus first input for accessibility
      const first = formView.querySelector('#tfName');
      if (first) first.focus();
    }
    function closeModal() {
      overlay.style.display = 'none';
      modal.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }

    // 9) Wire interactions
    trigger.addEventListener('click', openModal);
    overlay.addEventListener('click', closeModal);

    // ESC to close (inside shadow)
    shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Click/keyboard on rating
    formView.querySelector('#tfFaces').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rate]');
      if (!btn) return;
      setRating(btn.getAttribute('data-rate'));
    });
    formView.querySelectorAll('#tfFaces [data-rate]').forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setRating(el.getAttribute('data-rate'));
        }
      });
    });
    function setRating(val) {
      rating = Number(val) || 0;
      formView.querySelectorAll('#tfFaces [data-rate]').forEach(el => el.classList.remove('sel'));
      const active = formView.querySelector(`#tfFaces [data-rate="${rating}"]`);
      if (active) active.classList.add('sel');
    }

    // Cancel
    formView.querySelector('#tfCancel').addEventListener('click', closeModal);

    // Submit (POC — no backend, just show thanks)
    formView.querySelector('#tfSubmit').addEventListener('click', async () => {
      const name = formView.querySelector('#tfName').value.trim();
      const email = formView.querySelector('#tfEmail').value.trim();
      const text = formView.querySelector('#tfText').value.trim();

      // ======= Real backend goes here (example) =======
      // try {
      //   const res = await fetch('https://api.yourdomain.com/widget/reviews', {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       'Authorization': 'Bearer <short-lived-JWT>'
      //     },
      //     body: JSON.stringify({
      //       site_id: settings.siteId,
      //       rating,
      //       text,
      //       contact: { name, email }
      //     })
      //   });
      //   if (!res.ok) throw new Error('Submit failed');
      // } catch (err) {
      //   alert('Submission failed. Please try again.');
      //   return;
      // }
      // ================================================

      // POC behavior: swap to thank-you view
      formView.classList.add('hidden');
      thanksView.classList.remove('hidden');
    });

    // Thank-you CTA
    thanksView.querySelector('#tfView').addEventListener('click', () => {
      // In production, navigate to your public profile page for this site:
      // window.open(`https://trustfeed.app/b/${encodeURIComponent(settings.siteId)}`, '_blank');
      closeModal();
    });

    // 10) Observe <html data-*> so theme can update if SW writes later
    const mo = new MutationObserver(() => {
      const next = readSettings();
      // If color changed, update button + CTA backgrounds
      if (next.color !== settings.color) {
        settings = next;
        // Rebuild the color-dependent CSS quickly
        style.textContent = style.textContent
          .replaceAll(/background:\s*#[0-9a-fA-F]{3,8}/g, (m) => m) // keep other bg rules
          .replaceAll(/(\.btn\s*\{[^}]*background:\s*)([^;]+)(;)/, `$1${settings.color}$3`)
          .replaceAll(/(\.cta\s*\{[^}]*background:\s*)([^;]+)(;)/, `$1${settings.color}$3`);
      } else {
        settings = next;
      }
    });
    mo.observe(rootEl, { attributes: true, attributeFilter: ['data-tf-site-id', 'data-tf-color'] });
  })();
}