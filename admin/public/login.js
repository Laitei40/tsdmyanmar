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
      const res = await fetch('/api/auth/login', {
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
      window.location.href = '/';
    } catch {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });

  // Already logged in? Skip straight to the dashboard.
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((res) => { if (res.ok) window.location.href = '/'; })
    .catch(() => {});
})();
