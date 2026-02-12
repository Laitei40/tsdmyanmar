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
   CUSTOM QUILL BLOTS
   ══════════════════════════════════════════════ */
(function registerCustomBlots() {
  const Block     = Quill.import('blots/block');
  const BlockEmbed = Quill.import('blots/block/embed');
  const BaseImage = Quill.import('formats/image');

  /* ── Enhanced Image (preserves width, border, caption) ── */
  const IMG_ATTRS = ['alt','height','width','style','class','data-caption','data-border'];
  class EnhancedImage extends BaseImage {
    static formats(node) {
      return IMG_ATTRS.reduce((f, a) => {
        if (node.hasAttribute(a)) f[a] = node.getAttribute(a);
        return f;
      }, {});
    }
    format(name, value) {
      if (IMG_ATTRS.includes(name)) {
        if (value) this.domNode.setAttribute(name, value);
        else this.domNode.removeAttribute(name);
      } else {
        super.format(name, value);
      }
    }
  }
  EnhancedImage.blotName = 'image';
  EnhancedImage.tagName  = 'IMG';
  Quill.register(EnhancedImage, true);

  /* ── Poem block ── */
  class PoemBlock extends Block {}
  PoemBlock.blotName = 'poem';
  PoemBlock.tagName  = 'DIV';
  PoemBlock.className = 'poem-block';
  Quill.register(PoemBlock);

  /* ── Song / Lyrics block ── */
  class SongBlock extends Block {}
  SongBlock.blotName = 'song';
  SongBlock.tagName  = 'DIV';
  SongBlock.className = 'song-block';
  Quill.register(SongBlock);

  /* ── YouTube Video (overrides default video) ── */
  class VideoBlot extends BlockEmbed {
    static create(url) {
      const node = super.create();
      node.setAttribute('contenteditable', 'false');
      const iframe = document.createElement('iframe');
      iframe.setAttribute('src', url);
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      node.appendChild(iframe);
      return node;
    }
    static value(node) {
      const iframe = node.querySelector('iframe');
      return iframe ? iframe.getAttribute('src') : '';
    }
  }
  VideoBlot.blotName = 'video';
  VideoBlot.tagName  = 'DIV';
  VideoBlot.className = 'video-wrapper';
  Quill.register(VideoBlot, true);
})();


/* ══════════════════════════════════════════════
   API MODULE
   ══════════════════════════════════════════════ */

function apiHeaders(etag) {
  const h = { 'Content-Type': 'application/json' };
  if (etag) {
    // Send properly quoted ETag per HTTP spec; strip any existing quotes first
    const raw = etag.replace(/^"|"$/g, '').replace(/^W\//i, '');
    h['If-Match'] = `"${raw}"`;
  }
  return h;
}

async function apiList(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const res = await fetch(`${API_BASE}?${qs}`, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `List failed: ${res.status}`);
  }
  return res.json();
}

async function apiGet(id) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Get failed: ${res.status}`);
  const rawHeader = res.headers.get('etag') || '';
  // Strip quotes / W/ prefix that HTTP layer may add
  const headerEtag = rawHeader.replace(/^"|"$/g, '').replace(/^W\//i, '').trim();
  const body = await res.json();
  // Prefer etag from JSON body — Cloudflare CDN can strip/modify the ETag header
  const etag = body.etag || headerEtag;
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
    headers: apiHeaders(etag), body: JSON.stringify({ ...payload, _etag: etag }),
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
    body: JSON.stringify({ _etag: etag }),
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
    const titleEn = (item.title && (item.title.en || item.title.mrh || item.title.my || Object.values(item.title).find(v => v && v.trim()))) || '(untitled)';
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
  const container = $('#editor-container');

  // Destroy previous instance — remove stale toolbar siblings & reset container
  if (quill) {
    quill = null;
    const parent = container.parentNode;
    parent.querySelectorAll('.ql-toolbar').forEach(el => el.remove());
    container.className = '';          // strip Quill-added classes
    container.innerHTML = '';
  }

  quill = new Quill('#editor-container', {
    theme: 'snow',
    placeholder: 'Write article content here…',
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }, { align: [] }],
          ['bold', 'italic', 'underline', { color: [] }],
          ['link', 'image', 'video'],
          [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote', 'poem', 'song'],
          ['clean']
        ],
        handlers: {
          image: imageUploadHandler,
          video: youtubeHandler,
          poem()  { toggleBlockFormat('poem'); },
          song()  { toggleBlockFormat('song'); },
        }
      }
    }
  });

  // Label custom toolbar buttons (Quill creates empty buttons for custom formats)
  const tb = document.querySelector('.ql-toolbar');
  if (tb) {
    const poemBtn = tb.querySelector('.ql-poem');
    if (poemBtn) { poemBtn.setAttribute('title', 'Poem / verse'); }
    const songBtn = tb.querySelector('.ql-song');
    if (songBtn) { songBtn.setAttribute('title', 'Song / lyrics'); }
  }

  // Set up image click‐to‐configure toolbar
  setupImageToolbar();
}

/* ══════════════════════════════════════════════
   TOOLBAR HANDLERS
   ══════════════════════════════════════════════ */

/** Toggle a custom block format (poem / song) */
function toggleBlockFormat(format) {
  const range = quill.getSelection();
  if (!range) return;
  const fmt = quill.getFormat(range);
  quill.format(format, !fmt[format]);
}

/** YouTube — prompt for URL, validate, embed */
function youtubeHandler() {
  const url = prompt('Paste a YouTube video URL:');
  if (!url) return;
  const embedUrl = parseYouTubeUrl(url.trim());
  if (!embedUrl) {
    showFormError('Please enter a valid YouTube URL (e.g. https://youtube.com/watch?v=…)');
    return;
  }
  const range = quill.getSelection(true);
  quill.insertEmbed(range.index, 'video', embedUrl, Quill.sources.USER);
  quill.setSelection(range.index + 1);
}

function parseYouTubeUrl(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/* ── Image upload handler for Quill ── */

function imageUploadHandler() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    // Size check (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      showFormError('Image must be under 5 MB.');
      return;
    }

    // Show uploading indicator on the toolbar image button
    const btn = document.querySelector('.ql-toolbar .ql-image');
    const origHTML = btn?.innerHTML;
    if (btn) {
      btn.classList.add('uploading');
      btn.setAttribute('disabled', '');
    }

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`${API_BASE.replace('/news', '/images')}`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }

      const { url } = await res.json();

      // Insert image at current cursor position
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', url);
      quill.setSelection(range.index + 1);
    } catch (err) {
      showFormError(`Image upload failed: ${err.message}`);
    } finally {
      if (btn) {
        btn.classList.remove('uploading');
        btn.removeAttribute('disabled');
        if (origHTML) btn.innerHTML = origHTML;
      }
    }
  });

  input.click();
}

/* ══════════════════════════════════════════════
   IMAGE TOOLBAR (size / border / caption)
   ══════════════════════════════════════════════ */

function setupImageToolbar() {
  if (!quill) return;
  const editor = quill.root;

  editor.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
      e.stopPropagation();
      showImageToolbar(e.target);
    } else {
      hideImageToolbar();
    }
  });

  // Hide when clicking outside editor
  document.addEventListener('click', (e) => {
    const tb = $('#img-toolbar');
    if (!tb || tb.hidden) return;
    if (e.target.closest('#img-toolbar') || e.target.closest('.ql-editor')) return;
    hideImageToolbar();
  });
}

function showImageToolbar(img) {
  const tb = $('#img-toolbar');
  if (!tb) return;

  // Read current values
  const curWidth  = img.style.width || '100%';
  const curBorder = img.getAttribute('data-border') || 'none';
  const curCap    = img.getAttribute('data-caption') || '';

  // Active states
  tb.querySelectorAll('[data-size]').forEach(b =>
    b.classList.toggle('active', b.dataset.size === curWidth));
  tb.querySelectorAll('[data-border]').forEach(b =>
    b.classList.toggle('active', b.dataset.border === curBorder));

  const capInput = tb.querySelector('#img-caption-input');
  if (capInput) capInput.value = curCap;

  // Position fixed near the image
  const imgRect   = img.getBoundingClientRect();
  tb.style.top    = (imgRect.bottom + 6) + 'px';
  tb.style.left   = imgRect.left + 'px';
  tb.style.maxWidth = Math.max(imgRect.width, 320) + 'px';

  tb.hidden = false;
  tb._img = img;

  // Wire buttons (re-bind each time to reference correct img)
  tb.querySelectorAll('[data-size]').forEach(btn => {
    btn.onclick = () => {
      const blot = Quill.find(img);
      if (blot) blot.format('style', `width:${btn.dataset.size}`);
      else img.style.width = btn.dataset.size;
      tb.querySelectorAll('[data-size]').forEach(b =>
        b.classList.toggle('active', b === btn));
    };
  });

  tb.querySelectorAll('[data-border]').forEach(btn => {
    btn.onclick = () => {
      const blot = Quill.find(img);
      if (blot) blot.format('data-border', btn.dataset.border);
      else img.setAttribute('data-border', btn.dataset.border);
      tb.querySelectorAll('[data-border]').forEach(b =>
        b.classList.toggle('active', b === btn));
    };
  });

  if (capInput) {
    capInput.oninput = () => {
      const blot = Quill.find(img);
      if (blot) {
        blot.format('alt', capInput.value);
        blot.format('data-caption', capInput.value);
      } else {
        img.setAttribute('alt', capInput.value);
        img.setAttribute('data-caption', capInput.value);
      }
    };
  }
}

function hideImageToolbar() {
  const tb = $('#img-toolbar');
  if (tb) { tb.hidden = true; tb._img = null; }
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
  hideImageToolbar();
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
  const langLabel = LANGS.find(l => l.code === activeLang)?.label || activeLang;
  $('#inp-title').placeholder = `Article title in ${langLabel}`;
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

  // Validation — at least one language must have title + body
  const hasAnyTitle = Object.values(formTitle).some(v => v?.trim());
  if (!hasAnyTitle)                { showFormError('Title is required in at least one language.');  return; }
  if (!$('#inp-slug').value.trim()){ showFormError('Slug is required.');            return; }
  if (!$('#inp-author').value.trim()){ showFormError('Author is required.');        return; }
  if (!$('#inp-date').value)       { showFormError('Publish date is required.');    return; }

  // Check body content in at least one language (strip empty Quill markup)
  const hasAnyBody = Object.values(formBody).some(v =>
    (v || '').replace(/<p><br><\/p>/g, '').trim()
  );
  if (!hasAnyBody)                 { showFormError('Content is required in at least one language.'); return; }

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
    } else if (e.errors) {
      // Server returned 422 with validation errors
      const msgs = Object.values(e.errors).join('; ');
      showFormError(msgs || 'Validation failed.');
    } else {
      const msg = e.message || 'Save failed. Check required fields.';
      toast(msg, 'error');
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
  const titleEn = item?.title?.en || item?.title?.mrh || item?.title?.my || 'this article';
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
    if (autoSlug) {
      $('#inp-slug').value = slugify($('#inp-title').value);
    }
  });

  $('#inp-slug').addEventListener('input', () => { autoSlug = false; });

  $('#btn-auto-slug').addEventListener('click', () => {
    autoSlug = true;
    // Use current tab title, or first available title from any language
    saveCurrentLangInputs();
    const currentTitle = $('#inp-title').value.trim();
    const firstTitle = currentTitle || Object.values(formTitle).find(v => v?.trim()) || '';
    $('#inp-slug').value = slugify(firstTitle);
  });

  /* ── Image preview ── */
  $('#inp-image').addEventListener('input', updateImagePreview);

  /* ── Form submit ── */
  $('#news-form').addEventListener('submit', handleSave);
});
