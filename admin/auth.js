/**
 * auth.js — session bootstrap for admin pages (index.html, users.html).
 *
 * Loaded before the page's own script. Confirms a valid session via
 * GET /api/admin/auth/me, redirects to /admin/login.html if not authenticated,
 * otherwise stashes the user on window.currentUser, reveals the page, and
 * fires `tsd-auth-ready` so the page's own script can safely start rendering
 * role-aware UI. Also owns the header user-badge/logout and the forced
 * password-change gate (must_change_password).
 *
 * Runs immediately (no DOMContentLoaded wrapper) — this script tag sits at
 * the bottom of <body>, so the DOM it touches already exists by the time it runs.
 */
'use strict';

(function () {

  function $(sel) { return document.querySelector(sel); }

  async function fetchMe() {
    try {
      const res = await fetch('/api/admin/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  }

  function renderUserBadge(user) {
    const badge = $('#user-badge');
    const nameEl = $('#user-badge-name');
    const roleEl = $('#user-badge-role');
    const manageLink = $('#link-manage-users');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Admin' : 'Editor';
    if (badge) badge.hidden = false;
    if (manageLink) manageLink.hidden = user.role !== 'admin';
  }

  function wireLogout() {
    const btn = $('#btn-logout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try { await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
      finally { window.location.href = '/admin/login.html'; }
    });
  }

  function showForcePasswordModal() {
    const modal = $('#force-password-modal');
    if (modal) modal.hidden = false;
  }

  function wireForcePasswordForm() {
    const form = $('#force-password-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = $('#fp-error');
      errorEl.style.display = 'none';

      const currentPassword = $('#fp-current').value;
      const newPassword = $('#fp-new').value;
      const confirmPassword = $('#fp-confirm').value;

      if (newPassword.length < 10) {
        errorEl.textContent = 'New password must be at least 10 characters.';
        errorEl.style.display = 'block';
        return;
      }
      if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        const res = await fetch('/api/admin/auth/change-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          errorEl.textContent = data.error || 'Failed to change password.';
          errorEl.style.display = 'block';
          return;
        }
        window.location.href = '/admin/login.html';
      } catch {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
      }
    });
  }

  (async function init() {
    wireLogout();
    wireForcePasswordForm();

    const user = await fetchMe();
    if (!user) {
      window.location.href = '/admin/login.html';
      return;
    }

    window.currentUser = user;
    renderUserBadge(user);

    if (user.must_change_password) showForcePasswordModal();

    const shell = $('.app-shell');
    if (shell) shell.classList.remove('auth-pending');

    window.dispatchEvent(new CustomEvent('tsd-auth-ready', { detail: { user } }));
  })();

})();
