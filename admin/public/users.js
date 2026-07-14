/**
 * users.js — Manage Users screen (Admin only).
 *
 * Mirrors the CRUD/modal patterns already used in script.js for articles,
 * but for admin_users. Waits for auth.js's `tsd-auth-ready` event before
 * doing anything, then redirects non-admins back to the dashboard (cosmetic —
 * the server enforces this on every /api/auth/users* route regardless).
 */
'use strict';

const API_BASE = '/api/auth/users';

let items = [];
let editingId = null; // null = create mode

const $ = (sel) => document.querySelector(sel);

function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

let toastCounter = 0;
function toast(text, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = text;
  el.dataset.id = ++toastCounter;
  el.addEventListener('click', () => el.remove());
  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
}

/* ══════════════════════════════════════
   API
   ══════════════════════════════════════ */

async function apiList() {
  const res = await fetch(API_BASE, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

async function apiCreate(payload) {
  const res = await fetch(API_BASE, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Create failed: ${res.status}`), data);
  return data;
}

async function apiUpdate(id, payload) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Update failed: ${res.status}`), data);
  return data;
}

async function apiDelete(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Delete failed: ${res.status}`);
  return data;
}

async function apiResetPassword(id) {
  const res = await fetch(`${API_BASE}/reset-password`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(id) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Reset failed: ${res.status}`);
  return data;
}

/* ══════════════════════════════════════
   Rendering
   ══════════════════════════════════════ */

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

function renderTable() {
  const area = $('#users-table-area');

  if (!items.length) {
    area.innerHTML = `
      <div class="empty-state">
        <p>No users yet</p>
        <p class="muted">Click "+ New User" to add an Admin or Editor.</p>
      </div>`;
    return;
  }

  const rows = items.map((u) => {
    const isSelf = window.currentUser && u.id === window.currentUser.id;
    const statusBadge = u.disabled
      ? '<span class="badge badge-disabled">Disabled</span>'
      : '<span class="badge" style="background:var(--green-soft);color:var(--green)">Active</span>';
    const pendingBadge = u.must_change_password
      ? '<span class="badge" style="background:var(--amber-soft);color:var(--amber);margin-left:4px">Pending setup</span>'
      : '';

    return `<tr data-id="${u.id}">
      <td><span class="item-title">${escapeHtml(u.name)}${isSelf ? ' <span class="muted" style="display:inline">(you)</span>' : ''}</span><span class="item-slug">${escapeHtml(u.email)}</span></td>
      <td class="col-role"><span class="badge badge-role" data-role="${u.role}">${u.role}</span></td>
      <td>${statusBadge}${pendingBadge}</td>
      <td class="cell-date">${fmtDate(u.last_login_at)}</td>
      <td class="col-actions">
        <button class="btn-icon btn-edit-user" title="Edit" data-id="${u.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-reset-password" title="Reset password" data-id="${u.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5 18 5l3 3-2.5 2.5"/></svg>
        </button>
        ${isSelf ? '' : `
        <button class="btn-icon danger btn-delete-user" title="Delete" data-id="${u.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>`}
      </td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div class="news-table-wrap">
      <table class="news-table users-table">
        <thead><tr>
          <th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th class="col-actions">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function loadUsers() {
  const area = $('#users-table-area');
  area.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>';
  try {
    const data = await apiList();
    items = data.items || [];
    renderTable();
  } catch (e) {
    console.error(e);
    area.innerHTML = '<div class="empty-state"><p>Unable to load users</p></div>';
  }
}

/* ══════════════════════════════════════
   Create / Edit modal
   ══════════════════════════════════════ */

function openUserModal(user) {
  editingId = user ? user.id : null;
  const isSelf = window.currentUser && editingId === window.currentUser.id;

  $('#uf-name').value = user ? user.name : '';
  $('#uf-email').value = user ? user.email : '';
  $('#uf-role').value = user ? user.role : 'editor';
  $('#uf-role').disabled = isSelf;

  const disabledField = $('#uf-disabled-field');
  if (user) {
    show(disabledField);
    $('#uf-disabled').value = user.disabled ? '1' : '0';
    $('#uf-disabled').disabled = isSelf;
  } else {
    hide(disabledField);
  }

  $('#user-form-title').textContent = user ? 'Edit User' : 'New User';
  $('#btn-user-submit').textContent = user ? 'Save Changes' : 'Create';
  hide($('#user-form-error'));
  show($('#user-modal-backdrop'));
}

function closeUserModal() {
  hide($('#user-modal-backdrop'));
  editingId = null;
}

function showUserFormError(msg) {
  const el = $('#user-form-error');
  el.textContent = msg;
  show(el);
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const name = $('#uf-name').value.trim();
  const email = $('#uf-email').value.trim();
  const role = $('#uf-role').value;

  if (!name) return showUserFormError('Name is required.');
  if (!email) return showUserFormError('Email is required.');

  try {
    if (editingId) {
      const payload = { name, email };
      if (!$('#uf-role').disabled) payload.role = role;
      if (!$('#uf-disabled').disabled) payload.disabled = $('#uf-disabled').value === '1';
      await apiUpdate(editingId, payload);
      toast('User updated', 'success');
      closeUserModal();
      loadUsers();
    } else {
      const result = await apiCreate({ name, email, role });
      toast('User created', 'success');
      closeUserModal();
      loadUsers();
      showTempPassword(result.temp_password);
    }
  } catch (err) {
    if (err.errors) showUserFormError(Object.values(err.errors).join('; '));
    else showUserFormError(err.message || 'Save failed.');
  }
}

/* ══════════════════════════════════════
   Temp password modal
   ══════════════════════════════════════ */

function showTempPassword(password) {
  $('#temp-password-value').textContent = password;
  show($('#temp-password-modal'));
}

function closeTempPasswordModal() {
  hide($('#temp-password-modal'));
  $('#temp-password-value').textContent = '';
}

/* ══════════════════════════════════════
   Actions
   ══════════════════════════════════════ */

async function handleDeleteUser(id) {
  const u = items.find((i) => i.id === Number(id));
  if (!confirm(`Delete "${u ? u.name : 'this user'}"? This cannot be undone.`)) return;
  try {
    await apiDelete(id);
    toast('User deleted', 'success');
    loadUsers();
  } catch (e) {
    toast(e.message || 'Delete failed', 'error');
  }
}

async function handleResetPassword(id) {
  const u = items.find((i) => i.id === Number(id));
  if (!confirm(`Generate a new temporary password for "${u ? u.name : 'this user'}"? They will be signed out and required to set a new password.`)) return;
  try {
    const result = await apiResetPassword(id);
    toast('Password reset', 'success');
    loadUsers();
    showTempPassword(result.temp_password);
  } catch (e) {
    toast(e.message || 'Reset failed', 'error');
  }
}

/* ══════════════════════════════════════
   Init — waits for auth.js
   ══════════════════════════════════════ */

window.addEventListener('tsd-auth-ready', (e) => {
  const user = e.detail.user;
  if (user.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  loadUsers();

  $('#btn-new-user').addEventListener('click', () => openUserModal(null));
  $('#btn-user-modal-close').addEventListener('click', closeUserModal);
  $('#btn-user-cancel').addEventListener('click', closeUserModal);
  $('#user-modal-backdrop').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) closeUserModal(); });
  $('#user-form').addEventListener('submit', handleUserFormSubmit);

  $('#btn-temp-password-close').addEventListener('click', closeTempPasswordModal);
  $('#btn-temp-password-done').addEventListener('click', closeTempPasswordModal);
  $('#temp-password-modal').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) closeTempPasswordModal(); });

  $('#users-table-area').addEventListener('click', (ev) => {
    const editBtn = ev.target.closest('.btn-edit-user');
    if (editBtn) { const u = items.find((i) => i.id === Number(editBtn.dataset.id)); if (u) openUserModal(u); return; }

    const resetBtn = ev.target.closest('.btn-reset-password');
    if (resetBtn) { handleResetPassword(resetBtn.dataset.id); return; }

    const delBtn = ev.target.closest('.btn-delete-user');
    if (delBtn) { handleDeleteUser(delBtn.dataset.id); return; }
  });
});
