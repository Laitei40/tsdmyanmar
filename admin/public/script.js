/**
 * TSD News Dashboard — Vanilla JS
 * Pure ES6+ CRUD logic, no frameworks.
 *
 * Architecture:
 *   API module  →  fetch() wrappers for Cloudflare Worker endpoints
 *   State       →  plain variables (items, page, filters, form data)
 *   Render      →  DOM manipulation functions
 *   Events      →  delegated event listeners
 */

'use strict';

/* ══════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════ */

const API_BASE = '/api/news';

const LANGS = [
  { code: 'en',  label: 'English' },
  { code: 'mrh', label: 'Mara' },
  { code: 'my',  label: 'Burmese' },
];

const STATUS_COLORS = {
  published: '#22c55e',
  draft:     '#f59e0b',
  archived:  '#6b7280',
};

const PAGE_SIZE = 10;


/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */

let items     = [];
let total     = 0;
let page      = 0;
let loading   = false;

// Currently editing item (null = closed, { id: 0 } = create)
let editItem  = null;
let editEtag  = '';

// i18n form state  —  { en: '', mrh: '', my: '' }
let formTitle   = {};
let formSummary = {};
let formBody    = {};
let activeLang  = 'en';
let autoSlug    = true;

// Quill editor instance
let quill = null;


/* ══════════════════════════════════════════════
   API MODULE
   ══════════════════════════════════════════════ */

function apiHeaders(etag) {
  const h = { 'Content-Type': 'application/json' };
  if (etag) h['If-Match'] = etag;
  return h;
}

async function apiList(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const res = await fetch(`${API_BASE}?${qs}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

async function apiGet(id) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Get failed: ${res.status}`);
  const etag = res.headers.get('etag') || '';
  const body = await res.json();
  return { ...body, etag };
}

async function apiCreate(payload) {
  const res = await fetch(API_BASE, {
    method: 'POST', credentials: 'include',
    headers: apiHeaders(), body: JSON.stringify(payload),
  });
  if (res.status === 422) throw await res.json();
  if (res.status === 409) throw new Error('slug-conflict');
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return res.json();
}

async function apiUpdate(id, etag, payload) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT', credentials: 'include',
    headers: apiHeaders(etag), body: JSON.stringify(payload),
  });
  if (res.status === 422) throw await res.json();
  if (res.status === 409) throw new Error('etag-conflict');
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

async function apiDelete(id, etag) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE', credentials: 'include',
    headers: apiHeaders(etag),
  });
  if (res.status === 409) throw new Error('etag-conflict');
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}

async function apiStats() {
  const [pub, draft, arch] = await Promise.all([
    apiList({ status: 'published', limit: 1 }),
    apiList({ status: 'draft',     limit: 1 }),
    apiList({ status: 'archived',  limit: 1 }),
  ]);
  return {
    total:     pub.total + draft.total + arch.total,
    published: pub.total,
    draft:     draft.total,
    archived:  arch.total,
  };
}


/* ══════════════════════════════════════════════
   DOM HELPERS
   ══════════════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el)  { el.style.display = ''; }
function hide(el)  { el.style.display = 'none'; }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}


/* ══════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════ */

let toastCounter = 0;

function toast(text, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = text;
  const id = ++toastCounter;
  el.dataset.id = id;
  el.addEventListener('click', () => el.remove());
  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
}


/* ══════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════ */

async function loadStats() {
  try {
    const s = await apiStats();
    $('#stat-total').textContent     = s.total;
    $('#stat-published').textContent = s.published;
    $('#stat-draft').textContent     = s.draft;
    $('#stat-archived').textContent  = s.archived;
  } catch { /* stats are optional */ }
}


/* ══════════════════════════════════════════════
   TABLE RENDERING
   ══════════════════════════════════════════════ */

function statusBadgeHtml(status) {
  const c = STATUS_COLORS[status] || '#94a3b8';
  return `<span class="badge" style="background:${c}22;color:${c};border-color:${c}">${escapeHtml(status)}</span>`;
}

function langDotsHtml(item) {
  return LANGS.map(l => {
    const filled = item.title && item.title[l.code] ? ' filled' : '';
    return `<span class="lang-dot${filled}" title="${l.code.toUpperCase()}: ${filled ? '✓' : '—'}">${l.code.toUpperCase()}</span>`;
  }).join('');
}

function renderTable() {
  const area = $('#table-area');

  if (loading) {
    area.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>';
    return;
  }

  if (items.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        <p>No articles yet</p>
        <p class="muted">Click "+ New Article" to get started.</p>
      </div>`;
    return;
  }

  const rows = items.map(item => {
    const titleEn = (item.title && item.title.en) || '(untitled)';
    const imgCell = item.featured_image
      ? `<img src="${escapeHtml(item.featured_image)}" alt="" class="thumb" />`
      : `<div class="thumb thumb-placeholder"></div>`;
    const catBadge = item.category
      ? `<span class="badge badge-cat">${escapeHtml(item.category)}</span>`
      : '<span class="muted">—</span>';

    return `<tr data-id="${item.id}">
      <td class="col-img">${imgCell}</td>
      <td><span class="item-title">${escapeHtml(titleEn)}</span><span class="item-slug">/${escapeHtml(item.slug || '')}</span></td>
      <td class="cell-langs">${langDotsHtml(item)}</td>
      <td>${catBadge}</td>
      <td>${statusBadgeHtml(item.status)}</td>
      <td class="cell-date">${item.publish_date ? item.publish_date.slice(0, 10) : '—'}</td>
      <td class="col-actions">
        <button class="btn-icon btn-edit" title="Edit" data-id="${item.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger btn-delete" title="Delete" data-id="${item.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div class="news-table-wrap">
      <table class="news-table">
        <thead><tr>
          <th class="col-img"></th><th>Title</th><th>Langs</th>
          <th>Category</th><th>Status</th><th>Date</th><th class="col-actions">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}


/* ── Pagination ── */

function renderPagination() {
  const el = $('#pagination');
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total <= PAGE_SIZE) { hide(el); return; }

  show(el);
  $('#page-info').textContent = `${total} article${total !== 1 ? 's' : ''} — Page ${page + 1} of ${pages}`;
  $('#btn-prev').disabled = page === 0;
  $('#btn-next').disabled = (page + 1) >= pages;
}


/* ══════════════════════════════════════════════
   LOAD / REFRESH
   ══════════════════════════════════════════════ */

async function loadArticles(reset = false) {
  if (reset) page = 0;
  loading = true;
  renderTable();

  try {
    const data = await apiList({
      search:   $('#filter-search').value,
      status:   $('#filter-status').value,
      category: $('#filter-category').value,
      offset:   page * PAGE_SIZE,
      limit:    PAGE_SIZE,
    });
    items = data.items;
    total = data.total || data.items.length;
  } catch (e) {
    toast('Failed to load articles', 'error');
    console.error(e);
  } finally {
    loading = false;
    renderTable();
    renderPagination();
  }
}


/* ══════════════════════════════════════════════
   QUILL EDITOR
   ══════════════════════════════════════════════ */

function initQuill() {
  // Destroy previous instance if any
  const container = $('#editor-container');
  if (quill) {
    quill = null;
    container.innerHTML = '';
  }

  quill = new Quill('#editor-container', {
    theme: 'snow',
    placeholder: 'Write article content here…',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }],
        ['link'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean']
      ]
    }
  });
}

/* ══════════════════════════════════════════════
   MODAL / FORM
   ══════════════════════════════════════════════ */

function openModal(item) {
  editItem = item;
  editEtag = item.etag || '';
  const isNew = !item.id || item.id === 0;

  // Reset i18n state
  formTitle   = item.title   || {};
  formSummary = item.summary || {};
  formBody    = item.body    || {};
  activeLang  = 'en';
  autoSlug    = isNew;

  // Fill metadata inputs
  $('#inp-slug').value     = item.slug          || '';
  $('#inp-author').value   = item.author        || '';
  $('#inp-category').value = item.category      || '';
  $('#inp-status').value   = item.status        || 'draft';
  $('#inp-date').value     = item.publish_date  || new Date().toISOString().slice(0, 10);
  $('#inp-tags').value     = (item.tags || []).join(', ');
  $('#inp-image').value    = item.featured_image || '';

  // Form header
  $('#form-title').textContent = isNew ? 'Create Article' : 'Edit Article';
  $('#btn-submit').textContent = isNew ? 'Create' : 'Save Changes';

  // Hide error
  hide($('#form-error'));

  // Show modal
  show($('#modal-backdrop'));

  // Initialize Quill editor (must happen after modal is visible)
  initQuill();

  // Sync language fields
  syncLangUI();
  updateImagePreview();
}

function closeModal() {
  hide($('#modal-backdrop'));
  editItem = null;
  editEtag = '';
}

/** Save the currently visible i18n inputs into state before switching */
function saveCurrentLangInputs() {
  formTitle[activeLang]   = $('#inp-title').value;
  formSummary[activeLang] = $('#inp-summary').value;
  if (quill) {
    formBody[activeLang] = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
  }
}

/** Push the activeLang data into the inputs */
function syncLangUI() {
  // Update inputs
  $('#inp-title').value   = formTitle[activeLang]   || '';
  $('#inp-summary').value = formSummary[activeLang] || '';

  // Sync Quill editor content
  if (quill) {
    const html = formBody[activeLang] || '';
    quill.clipboard.dangerouslyPasteHTML(html);
  }

  // Update badges
  const badge = activeLang.toUpperCase();
  $('#badge-title').textContent   = badge;
  $('#badge-summary').textContent = badge;
  $('#badge-body').textContent    = badge;

  // Update lang tab active state
  $$('#lang-tabs .lang-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === activeLang);
  });

  // Update translation dots
  const dotMrh = $('#dot-mrh');
  const dotMy  = $('#dot-my');
  if (dotMrh) dotMrh.classList.toggle('hidden', !!(formTitle.mrh));
  if (dotMy)  dotMy.classList.toggle('hidden',  !!(formTitle.my));

  // Placeholder text
  if (activeLang === 'en') {
    $('#inp-title').placeholder = 'Article title (required)';
  } else {
    const langLabel = LANGS.find(l => l.code === activeLang)?.label || activeLang;
    $('#inp-title').placeholder = `Title in ${langLabel}`;
  }
}

function updateImagePreview() {
  const url = $('#inp-image').value.trim();
  const wrap = $('#image-preview');
  const img  = $('#image-preview-img');
  if (url) {
    img.src = url;
    img.onerror = () => hide(wrap);
    show(wrap);
  } else {
    hide(wrap);
  }
}

function showFormError(msg) {
  const el = $('#form-error');
  el.textContent = msg;
  show(el);
}


/* ── Save handler ── */

async function handleSave(e) {
  e.preventDefault();
  saveCurrentLangInputs();

  // Validation
  if (!formTitle.en?.trim())       { showFormError('English title is required.');   return; }
  if (!$('#inp-slug').value.trim()){ showFormError('Slug is required.');            return; }
  if (!$('#inp-author').value.trim()){ showFormError('Author is required.');        return; }
  if (!$('#inp-date').value)       { showFormError('Publish date is required.');    return; }

  // Check English body content (strip empty Quill markup)
  const enBody = (formBody.en || '').replace(/<p><br><\/p>/g, '').trim();
  if (!enBody)                     { showFormError('English content is required.'); return; }

  const tagsRaw = $('#inp-tags').value;
  const payload = {
    title:          formTitle,
    summary:        formSummary,
    body:           formBody,
    slug:           $('#inp-slug').value.trim(),
    category:       $('#inp-category').value || undefined,
    tags:           tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
    status:         $('#inp-status').value,
    publish_date:   $('#inp-date').value,
    featured_image: $('#inp-image').value.trim() || undefined,
    author:         $('#inp-author').value.trim(),
  };

  try {
    if (editItem?.id && editItem.id !== 0) {
      await apiUpdate(editItem.id, editEtag, payload);
      toast('Article updated', 'success');
    } else {
      await apiCreate(payload);
      toast('Article created', 'success');
    }
    closeModal();
    loadArticles(true);
    loadStats();
  } catch (e) {
    if (e.message === 'etag-conflict') {
      toast('Version conflict — reload and try again.', 'error');
    } else if (e.message === 'slug-conflict') {
      showFormError('Slug already in use. Choose a different one.');
    } else {
      toast('Save failed. Check required fields.', 'error');
    }
  }
}


/* ── Edit handler ── */

async function handleEdit(id) {
  try {
    const full = await apiGet(id);
    openModal(full);
  } catch {
    toast('Failed to load article details', 'error');
  }
}


/* ── Delete handler ── */

async function handleDelete(id) {
  const item = items.find(i => i.id === Number(id));
  const titleEn = item?.title?.en || 'this article';
  if (!confirm(`Delete "${titleEn}"?`)) return;

  try {
    const full = await apiGet(id);
    await apiDelete(id, full.etag);
    toast('Article deleted', 'success');
    loadArticles(true);
    loadStats();
  } catch (e) {
    toast(e.message === 'etag-conflict'
      ? 'Version conflict — refresh and try again.'
      : 'Delete failed', 'error');
  }
}


/* ══════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Initial load ── */
  loadArticles(true);
  loadStats();

  /* ── New article ── */
  $('#btn-new').addEventListener('click', () => {
    openModal({
      id: 0, title: {}, summary: {}, body: {},
      tags: [], status: 'draft', author: '', slug: '',
      publish_date: new Date().toISOString().slice(0, 10),
    });
  });

  /* ── Filter form ── */
  $('#filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadArticles(true);
  });

  // Instant filter when status or category dropdown changes
  $('#filter-status').addEventListener('change', () => loadArticles(true));
  $('#filter-category').addEventListener('change', () => loadArticles(true));

  $('#btn-reset').addEventListener('click', () => {
    $('#filter-search').value   = '';
    $('#filter-status').value   = '';
    $('#filter-category').value = '';
    loadArticles(true);
  });

  /* ── Pagination ── */
  $('#btn-prev').addEventListener('click', () => { page = Math.max(0, page - 1); loadArticles(); });
  $('#btn-next').addEventListener('click', () => { page += 1; loadArticles(); });

  /* ── Table actions (delegated) ── */
  $('#table-area').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) { handleEdit(editBtn.dataset.id); return; }

    const delBtn = e.target.closest('.btn-delete');
    if (delBtn)  { handleDelete(delBtn.dataset.id); return; }
  });

  /* ── Modal close ── */
  $('#btn-modal-close').addEventListener('click', closeModal);
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  /* ── Language tabs ── */
  $('#lang-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-tab');
    if (!btn) return;
    saveCurrentLangInputs();
    activeLang = btn.dataset.lang;
    syncLangUI();
  });

  /* ── Body edit/preview toggle — removed (Quill is WYSIWYG) ── */

  /* ── Auto-slug ── */
  $('#inp-title').addEventListener('input', () => {
    if (autoSlug && activeLang === 'en') {
      $('#inp-slug').value = slugify($('#inp-title').value);
    }
  });

  $('#inp-slug').addEventListener('input', () => { autoSlug = false; });

  $('#btn-auto-slug').addEventListener('click', () => {
    autoSlug = true;
    // Use English title regardless of current tab
    const enTitle = activeLang === 'en' ? $('#inp-title').value : (formTitle.en || '');
    $('#inp-slug').value = slugify(enTitle);
  });

  /* ── Image preview ── */
  $('#inp-image').addEventListener('input', updateImagePreview);

  /* ── Form submit ── */
  $('#news-form').addEventListener('submit', handleSave);
});
