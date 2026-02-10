/**
 * updates.js — Load and render the Updates & News feed
 *
 * Features:
 *  - Fetches news index from tsdNews helper (or static JSON fallback)
 *  - Renders a featured card for the latest item + a card grid for the rest
 *  - Client-side year/category filter, search, sort
 *  - Pagination via "Load more"
 *  - Intersection-observer reveal animation
 *  - Fully i18n and theme-aware
 */
(function () {
  'use strict';

  var CONTAINER_ID     = 'updates-list';
  var FILTER_ID        = 'updates-year-filter';
  var LOADING_MSG_ID   = 'updates-loading';
  var PAGE_SIZE        = 6;

  // ---- State ----
  var offset         = 0;
  var total          = 0;
  var query          = '';
  var yearFilter     = '';
  var categoryFilter = '';
  var sortOrder      = 'newest';
  var isLoading      = false;

  // ---- Helpers ----
  function el(tag, props) {
    var d = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') d.className = props[k];
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

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return iso; }
  }

  function pickLangField(obj, lang) {
    if (!obj) return '';
    var candidates = (lang === 'mrh') ? ['mrh', 'mara', 'en'] : [lang, 'en'];
    for (var i = 0; i < candidates.length; i++) { if (obj[candidates[i]]) return obj[candidates[i]]; }
    return '';
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

  function getLang() {
    return (window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) || 'en';
  }

  function i18n(key, fallback) {
    return (window.I18N && window.I18N[key]) || fallback;
  }

  function getItemImage(it) {
    // Try to extract a thumbnail URL from the item
    if (it.image) return it.image;
    if (it.thumbnail) return it.thumbnail;
    if (Array.isArray(it.images) && it.images.length) {
      var first = it.images[0];
      return (typeof first === 'string') ? first : (first.src || first.url || '');
    }
    return '';
  }

  // ---- Card builders ----

  /**
   * Build the featured (hero) card for the top / latest item.
   */
  function buildFeatured(it, lang) {
    var title    = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || 'Untitled');
    var summary  = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
    var ctaLabel = i18n('read_more', 'Read more');
    var href     = '/update.html?id=' + encodeURIComponent(it.id || '');
    var category = buildCategory(it) || i18n('latest_badge', 'Latest');
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

    var metaRow = el('div', { class: 'featured-meta' },
      el('span', { class: 'featured-chip' }, category),
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

  /**
   * Build a standard grid card.
   */
  function buildCard(it, lang) {
    var title      = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || 'Untitled');
    var summaryRaw = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
    var bodyRaw    = (typeof it.body === 'string') ? it.body : (pickLangField(it.body, lang) || '');
    var summary    = summaryRaw || bodyRaw;
    var ctaLabel   = i18n('read_more', 'Read more');
    var href       = '/update.html?id=' + encodeURIComponent(it.id || '');
    var category   = buildCategory(it);
    var imgUrl     = getItemImage(it);

    var article = el('article', { class: 'update-card reveal', attrs: { role: 'listitem' } });

    // Thumbnail
    if (imgUrl) {
      var thumb = el('img', { class: 'card-thumb', attrs: { src: imgUrl, alt: '', loading: 'lazy', decoding: 'async' } });
      thumb.onerror = function () { thumb.style.display = 'none'; };
      article.appendChild(thumb);
    }

    // Content wrapper
    var content = el('div', { class: 'card-content' });

    // Header row (badge + date)
    var header = el('div', { class: 'card-header' });
    if (category) header.appendChild(el('span', { class: 'badge' }, category));
    header.appendChild(el('time', { class: 'update-date', attrs: { datetime: it.date || '' } }, formatDate(it.date)));
    content.appendChild(header);

    // Title
    content.appendChild(el('h3', { class: 'update-title' }, title));

    // Summary
    if (summary) content.appendChild(el('p', { class: 'update-summary' }, summary));

    // CTA
    var cta = el('div', { class: 'update-cta' },
      el('a', { class: 'btn-link', attrs: { href: href } }, ctaLabel)
    );
    content.appendChild(cta);

    article.appendChild(content);
    return article;
  }

  // ---- Render helpers ----

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

    // Reveal animation via IntersectionObserver
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

  // ---- Main load ----

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
      if (reset) { offset = 0; total = 0; showSkeleton(container, 3); }

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

      // ---- Filters ----
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
          var t = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || '');
          var s = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
          return (t + s).toLowerCase().indexOf(q) !== -1;
        });
      }

      // ---- Sort ----
      if (sortOrder === 'oldest') items.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      else items.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

      total = items.length;

      // ---- Paginate ----
      var paged = items.slice(offset, offset + PAGE_SIZE);
      renderItems(container, paged, lang, !reset);
      offset += paged.length;

      // ---- Populate year filter on reset ----
      if (filter && reset) {
        var years = Array.from(new Set((Array.isArray(data) ? data : []).map(function (i) { return new Date(i.date).getFullYear(); }))).sort(function (a, b) { return b - a; });
        filter.innerHTML = '';
        filter.appendChild(el('option', { value: '' }, 'All years'));
        years.forEach(function (y) { filter.appendChild(el('option', { value: y }, String(y))); });
      }

      // ---- Load-more button state ----
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
      container.innerHTML = '<p class="empty-state">Unable to load updates. Please try again later.</p>';
      console.error('updates load error', err);
    } finally {
      isLoading = false;
    }
  }

  // ---- Wire up controls ----

  document.addEventListener('DOMContentLoaded', function () {
    var filter     = document.getElementById(FILTER_ID);
    var search     = document.getElementById('updates-search');
    var loadMore   = document.getElementById('updates-load-more');
    var categoryEl = document.getElementById('updates-category-filter');
    var sortEl     = document.getElementById('updates-sort');

    loadAndRender(true);

    // Re-render on language change
    window.addEventListener('site:langchange', function () { loadAndRender(true); });

    if (filter) filter.addEventListener('change', function () { yearFilter = filter.value; loadAndRender(true); });
    if (categoryEl) categoryEl.addEventListener('change', function () { categoryFilter = (categoryEl.value || '').toLowerCase(); loadAndRender(true); });
    if (sortEl) sortEl.addEventListener('change', function () { sortOrder = sortEl.value || 'newest'; loadAndRender(true); });

    // Debounced search
    if (search) {
      var t = null;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { query = (search.value || '').trim(); loadAndRender(true); }, 350);
      });
    }

    // Load more
    if (loadMore) {
      loadMore.addEventListener('click', function () { loadMore.classList.add('btn-loading'); loadAndRender(false); });
    }
  });
})();


