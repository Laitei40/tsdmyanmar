/**
 * updates.js — TSD Myanmar · News & Updates feed
 *
 * Features:
 *  - Fetches from /api/news via tsdNews helper
 *  - Language selector (EN / မြန်မာ / Mara) — filters news content language only (does not change site UI)
 *  - Featured hero card + card grid
 *  - Client-side year/category filter, search, sort
 *  - Pagination via "Load more"
 *  - IntersectionObserver reveal animations
 *  - Category color-coded badges
 *  - Theme-aware, fully accessible
 */
(function () {
  'use strict';

  var CONTAINER_ID     = 'updates-list';
  var FILTER_ID        = 'updates-year-filter';
  var LOADING_MSG_ID   = 'updates-loading';
  var PAGE_SIZE        = 6;

  // ── State ──
  var offset         = 0;
  var total          = 0;
  var query          = '';
  var yearFilter     = '';
  var categoryFilter = '';
  var sortOrder      = 'newest';
  var isLoading      = false;
  var contentLang    = 'en'; // language for filtering news content only (not site UI)

  // ── DOM helpers ──
  function el(tag, props) {
    var d = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') d.className = props[k];
        else if (k === 'html') d.innerHTML = props[k];
        else if (k === 'attrs') Object.keys(props.attrs).forEach(function (a) { d.setAttribute(a, props.attrs[a]); });
        else d[k] = props[k];
      });
    }
    var children = Array.prototype.slice.call(arguments, 2);
    children.forEach(function (c) {
      if (typeof c === 'string') d.appendChild(document.createTextNode(c));
      else if (c) d.appendChild(c);
    });
    return d;
  }

  // ── Formatting ──
  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return iso; }
  }

  function stripHtml(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  // ── i18n helpers ──
  /** Returns the content language chosen via the on-page lang switcher (not the site UI language). */
  function getLang() {
    return contentLang;
  }

  function i18n(key, fallback) {
    return (window.I18N && window.I18N[key]) || fallback;
  }

  function pickLangField(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var candidates = (lang === 'mrh') ? ['mrh', 'mara', 'en'] : [lang, 'en'];
    for (var i = 0; i < candidates.length; i++) { if (obj[candidates[i]]) return obj[candidates[i]]; }
    // fallback to any available value
    var keys = Object.keys(obj);
    return keys.length ? obj[keys[0]] : '';
  }

  function normalizeItemLangKeys(item) {
    if (!item || typeof item !== 'object') return;
    // Ensure .date is always set (admin responses use publish_date)
    if (!item.date && item.publish_date) item.date = item.publish_date;
    ['title', 'summary', 'body'].forEach(function (field) {
      var obj = item[field];
      if (!obj || typeof obj !== 'object') return;
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      Object.keys(obj).forEach(function (k) {
        var m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i);
        if (m) { var base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; }
      });
    });
  }

  function buildCategory(it) {
    if (it.category) return String(it.category);
    if (Array.isArray(it.categories) && it.categories.length) return String(it.categories[0]);
    return '';
  }

  function getItemImage(it) {
    if (it.image) return it.image;
    if (it.thumbnail) return it.thumbnail;
    if (Array.isArray(it.images) && it.images.length) {
      var first = it.images[0];
      return (typeof first === 'string') ? first : (first.src || first.url || '');
    }
    return '';
  }

  /** Check if an item has non-empty content in a specific language (no fallback). */
  function hasLangContent(item, lang) {
    var title = item.title;
    if (!title) return false;
    if (typeof title === 'string') return true; // plain string = available
    return !!(title[lang] && title[lang].trim());
  }

  // Category display label map
  var CAT_LABELS = { news: 'News', report: 'Report', announcement: 'Announcement', story: 'Story' };

  // ═══════════════════════════════════════
  // LANGUAGE SELECTOR
  // ═══════════════════════════════════════
  function initLangSwitcher() {
    var btns = document.querySelectorAll('.lang-btn');
    if (!btns.length) return;

    // Set initial active state (default: EN)
    btns.forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      var isActive = lang === contentLang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Click handler — only filters news content language, does NOT change site UI language
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (!lang || lang === contentLang) return;

        // Update visual state immediately
        btns.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        // Update local content language and re-render
        contentLang = lang;
        loadAndRender(true);
      });
    });
  }

  // ═══════════════════════════════════════
  // CARD BUILDERS
  // ═══════════════════════════════════════

  /** Featured (hero) card */
  function buildFeatured(it, lang) {
    var title    = pickLangField(it.title, lang) || 'Untitled';
    var summary  = stripHtml(pickLangField(it.summary, lang) || '');
    var ctaLabel = i18n('read_more', 'Read more');
    var href     = '/update.html?id=' + encodeURIComponent(it.id || '');
    var category = buildCategory(it) || i18n('latest_badge', 'Latest');
    var catLabel = CAT_LABELS[category.toLowerCase()] || category;
    var imgUrl   = getItemImage(it);

    var card = el('article', { class: 'featured-card reveal', attrs: { role: 'listitem' } });

    // Image area
    var imageWrap = el('div', { class: 'featured-image-wrap' });
    if (imgUrl) {
      var img = el('img', { class: 'featured-image', attrs: { src: imgUrl, alt: title, loading: 'lazy', decoding: 'async' } });
      img.onerror = function () { img.style.display = 'none'; };
      imageWrap.appendChild(img);
    }
    card.appendChild(imageWrap);

    // Body
    var body = el('div', { class: 'featured-body' });

    var chip = el('span', { class: 'featured-chip', attrs: { 'data-cat': category.toLowerCase() } }, catLabel);
    var metaRow = el('div', { class: 'featured-meta' },
      chip,
      el('time', { class: 'featured-date', attrs: { datetime: it.date || '' } }, formatDate(it.date))
    );
    body.appendChild(metaRow);
    body.appendChild(el('h2', { class: 'featured-title' }, title));
    if (summary) body.appendChild(el('p', { class: 'featured-lead' }, summary));
    body.appendChild(el('div', { class: 'featured-actions' },
      el('a', { class: 'btn-primary', attrs: { href: href } }, ctaLabel)
    ));

    card.appendChild(body);
    return card;
  }

  /** Standard grid card */
  function buildCard(it, lang) {
    var title      = pickLangField(it.title, lang) || 'Untitled';
    var summaryRaw = stripHtml(pickLangField(it.summary, lang) || '');
    var bodyRaw    = stripHtml(pickLangField(it.body, lang) || '');
    var summary    = summaryRaw || (bodyRaw.length > 200 ? bodyRaw.substring(0, 200) + '…' : bodyRaw);
    var ctaLabel   = i18n('read_more', 'Read more');
    var href       = '/update.html?id=' + encodeURIComponent(it.id || '');
    var category   = buildCategory(it);
    var catLabel   = CAT_LABELS[category.toLowerCase()] || category;
    var imgUrl     = getItemImage(it);

    var article = el('article', { class: 'update-card reveal', attrs: { role: 'listitem' } });

    // Thumbnail
    if (imgUrl) {
      var thumbWrap = el('div', { class: 'card-thumb-wrap' });
      var thumb = el('img', { class: 'card-thumb', attrs: { src: imgUrl, alt: '', loading: 'lazy', decoding: 'async' } });
      thumb.onerror = function () { thumbWrap.style.display = 'none'; };
      thumbWrap.appendChild(thumb);
      article.appendChild(thumbWrap);
    }

    // Content
    var content = el('div', { class: 'card-content' });

    // Header row (badge + date)
    var header = el('div', { class: 'card-header' });
    if (catLabel) {
      var badge = el('span', { class: 'badge', attrs: { 'data-cat': category.toLowerCase() } }, catLabel);
      header.appendChild(badge);
    }
    header.appendChild(el('time', { class: 'update-date', attrs: { datetime: it.date || '' } }, formatDate(it.date)));
    content.appendChild(header);

    // Title
    content.appendChild(el('h3', { class: 'update-title' }, title));

    // Summary
    if (summary) content.appendChild(el('p', { class: 'update-summary' }, summary));

    // CTA
    content.appendChild(el('div', { class: 'update-cta' },
      el('a', { class: 'btn-link', attrs: { href: href } }, ctaLabel)
    ));

    article.appendChild(content);
    return article;
  }

  // ═══════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════

  function renderEmpty(container) {
    container.innerHTML = '';
    var title = i18n('no_updates', 'No updates yet');
    var body  = i18n('no_updates_body', 'Check back soon for the latest news and reports.');
    container.appendChild(
      el('div', { class: 'empty-state' },
        el('h3', {}, title),
        el('p', {}, body)
      )
    );
  }

  function renderItems(container, items, lang, append) {
    if (!append) container.innerHTML = '';
    if (!items.length && !append) return renderEmpty(container);

    var remaining = items.slice();

    // Show featured card only on fresh render
    if (!append && remaining.length) {
      container.appendChild(buildFeatured(remaining.shift(), lang));
    }

    remaining.forEach(function (it) {
      container.appendChild(buildCard(it, lang));
    });

    // Reveal animation
    requestAnimationFrame(function () {
      if (!('IntersectionObserver' in window)) {
        container.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('visible'); });
        return;
      }
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
        });
      }, { threshold: 0.06 });
      container.querySelectorAll('.reveal').forEach(function (n) { obs.observe(n); });
    });
  }

  function showSkeleton(container, count) {
    container.innerHTML = '';
    for (var i = 0; i < count; i++) {
      container.appendChild(el('div', { class: 'skeleton-card', attrs: { role: 'listitem', 'aria-hidden': 'true' } }));
    }
  }

  // ═══════════════════════════════════════
  // MAIN LOAD
  // ═══════════════════════════════════════

  async function loadAndRender(reset) {
    var container  = document.getElementById(CONTAINER_ID);
    var filter     = document.getElementById(FILTER_ID);
    var loading    = document.getElementById(LOADING_MSG_ID);
    var loadMore   = document.getElementById('updates-load-more');
    if (!container) return;

    if (isLoading) return;
    isLoading = true;

    try {
      if (loading) loading.textContent = i18n('loading', 'Loading…');

      var lang = getLang();
      if (reset) { offset = 0; total = 0; showSkeleton(container, 4); }

      // Fetch data
      var data;
      try {
        data = await (window.tsdNews && window.tsdNews.fetchNewsIndex
          ? window.tsdNews.fetchNewsIndex()
          : Promise.reject(new Error('news helper missing')));
      } catch (e) {
        console.error('Failed to load news index', e);
        throw e;
      }

      var items = Array.isArray(data) ? data : (data.items || []);
      items.forEach(normalizeItemLangKeys);

      // ── Filters ──
      // Language filter: only show articles that have content in the selected language
      items = items.filter(function (it) { return hasLangContent(it, lang); });

      if (yearFilter) items = items.filter(function (it) { return (new Date(it.date)).getFullYear() === Number(yearFilter); });
      if (categoryFilter) {
        items = items.filter(function (it) {
          if (it.category && String(it.category).toLowerCase() === categoryFilter) return true;
          if (Array.isArray(it.categories) && it.categories.map(function (c) { return String(c).toLowerCase(); }).indexOf(categoryFilter) !== -1) return true;
          return false;
        });
      }
      if (query) {
        var q = query.toLowerCase();
        items = items.filter(function (it) {
          var t = pickLangField(it.title, lang) || '';
          var s = pickLangField(it.summary, lang) || '';
          return (t + s).toLowerCase().indexOf(q) !== -1;
        });
      }

      // ── Sort ──
      if (sortOrder === 'oldest') items.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      else items.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

      total = items.length;

      // ── Paginate ──
      var paged = items.slice(offset, offset + PAGE_SIZE);
      renderItems(container, paged, lang, !reset);
      offset += paged.length;

      // ── Populate year filter on reset ──
      if (filter && reset) {
        var allItems = Array.isArray(data) ? data : (data.items || []);
        allItems.forEach(normalizeItemLangKeys);
        var years = Array.from(new Set(allItems.map(function (i) { return new Date(i.date).getFullYear(); }))).filter(function(y){ return !isNaN(y); }).sort(function (a, b) { return b - a; });
        filter.innerHTML = '';
        filter.appendChild(el('option', { value: '' }, 'All years'));
        years.forEach(function (y) { filter.appendChild(el('option', { value: y }, String(y))); });
      }

      // ── Load-more button state ──
      if (loadMore) {
        loadMore.textContent = i18n('load_more', 'Load more');
        loadMore.classList.remove('btn-loading');
        if (offset >= total) { loadMore.setAttribute('disabled', 'disabled'); }
        else { loadMore.removeAttribute('disabled'); }
      }

      if (loading) loading.textContent = '';
      if (!items.length && offset === 0) renderEmpty(container);

    } catch (err) {
      if (loading) loading.textContent = 'Failed to load updates';
      container.innerHTML = '<div class="empty-state"><h3>Unable to load updates</h3><p>Please try again later.</p></div>';
      console.error('updates load error', err);
    } finally {
      isLoading = false;
    }
  }

  // ═══════════════════════════════════════
  // WIRE EVERYTHING UP
  // ═══════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function () {
    var filter     = document.getElementById(FILTER_ID);
    var search     = document.getElementById('updates-search');
    var loadMore   = document.getElementById('updates-load-more');
    var categoryEl = document.getElementById('updates-category-filter');
    var sortEl     = document.getElementById('updates-sort');

    // Init language switcher
    initLangSwitcher();

    // Initial load
    loadAndRender(true);



    if (filter) filter.addEventListener('change', function () { yearFilter = filter.value; loadAndRender(true); });
    if (categoryEl) categoryEl.addEventListener('change', function () { categoryFilter = (categoryEl.value || '').toLowerCase(); loadAndRender(true); });
    if (sortEl) sortEl.addEventListener('change', function () { sortOrder = sortEl.value || 'newest'; loadAndRender(true); });

    // Debounced search
    if (search) {
      var t = null;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { query = (search.value || '').trim(); loadAndRender(true); }, 300);
      });
    }

    // Load more
    if (loadMore) {
      loadMore.addEventListener('click', function () { loadMore.classList.add('btn-loading'); loadAndRender(false); });
    }
  });
})();


