'use strict';

(function () {
  function $(sel) { return document.querySelector(sel); }

  const form = $('#login-form');
  const errorEl = $('#li-error');
  const submitBtn = $('#li-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: $('#li-email').value.trim(),
          password: $('#li-password').value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorEl.textContent = data.error || 'Login failed.';
        errorEl.style.display = 'block';
        return;
      }
      window.location.href = '/admin/';
    } catch {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });

  // Already logged in? Skip straight to the dashboard. Requires a real JSON
  // body with a user, not just a 200 — a non-JSON 200 (e.g. an unexpected
  // static-asset fallback) should never be treated as "logged in".
  fetch('/api/admin/auth/me', { credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && data.user) window.location.href = '/admin/';
    })
    .catch(() => {});
})();
