/**
 * updates.js — TSD Myanmar · News & Updates feed
 *
 * Clean minimal design — featured hero + 3-column card grid
 * Language selector, category pills, search, year/sort filters, pagination
 */
(function () {
  'use strict';

  var CONTAINER_ID   = 'updates-list';
  var FILTER_ID      = 'updates-year-filter';
  var LOADING_MSG_ID = 'updates-loading';
  var PAGE_SIZE      = 9;

  // ── State ──
  var offset         = 0;
  var total          = 0;
  var query          = '';
  var yearFilter     = '';
  var categoryFilter = '';
  var sortOrder      = 'newest';
  var isLoading      = false;
  var contentLang    = 'en';

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
  function getLang() { return contentLang; }

  function i18n(key, fallback) {
    return (window.I18N && window.I18N[key]) || fallback;
  }

  function pickLangField(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var candidates = (lang === 'mrh') ? ['mrh', 'mara', 'en'] : [lang, 'en'];
    for (var i = 0; i < candidates.length; i++) { if (obj[candidates[i]]) return obj[candidates[i]]; }
    var keys = Object.keys(obj);
    return keys.length ? obj[keys[0]] : '';
  }

  function normalizeItemLangKeys(item) {
    if (!item || typeof item !== 'object') return;
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

  function hasLangContent(item, lang) {
    var title = item.title;
    if (!title) return false;
    if (typeof title === 'string') return true;
    return !!(title[lang] && title[lang].trim());
  }

  var CAT_LABELS = { news: 'News', report: 'Report', announcement: 'Announcement', story: 'Story' };

  function estimateReadTime(item, lang) {
    var text = stripHtml(pickLangField(item.body, lang) || pickLangField(item.summary, lang) || '');
    var words = text.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    return Math.max(1, Math.round(words / 200));
  }

  // ═══════════════════════════════════════
  // LANGUAGE SELECTOR
  // ═══════════════════════════════════════
  function initLangSwitcher() {
    var btns = document.querySelectorAll('.lang-btn');
    if (!btns.length) return;

    btns.forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      btn.classList.toggle('active', lang === contentLang);
      btn.setAttribute('aria-pressed', lang === contentLang ? 'true' : 'false');
    });

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (!lang || lang === contentLang) return;

        btns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        contentLang = lang;
        loadAndRender(true);
      });
    });
  }

  // ═══════════════════════════════════════
  // FEATURED HERO BUILDER
  // ═══════════════════════════════════════
  function buildFeatured(it, lang) {
    var title    = pickLangField(it.title, lang) || 'Untitled';
    var summary  = stripHtml(pickLangField(it.summary, lang) || '');
    var href     = '/update.html?id=' + encodeURIComponent(it.id || '');
    var category = buildCategory(it);
    var catLabel = CAT_LABELS[category.toLowerCase()] || category || 'Update';
    var imgUrl   = getItemImage(it);
    var readMin  = estimateReadTime(it, lang);

    var link = el('a', { class: 'up-hero', attrs: { href: href } });

    // Image
    var imgWrap = el('div', { class: 'up-hero__img-wrap' });
    if (imgUrl) {
      var img = el('img', { class: 'up-hero__img', attrs: { src: imgUrl, alt: title, loading: 'eager', decoding: 'async' } });
      img.onerror = function () { img.style.display = 'none'; };
      imgWrap.appendChild(img);
    }
    link.appendChild(imgWrap);

    // Body
    var body = el('div', { class: 'up-hero__body' });
    body.appendChild(el('span', { class: 'up-hero__tag', attrs: { 'data-cat': category.toLowerCase() } }, catLabel));
    body.appendChild(el('h2', { class: 'up-hero__title' }, title));
    if (summary) body.appendChild(el('p', { class: 'up-hero__excerpt' }, summary));

    var meta = el('div', { class: 'up-hero__meta' });
    meta.appendChild(el('time', { attrs: { datetime: it.date || '' } }, formatDate(it.date)));
    meta.appendChild(el('span', { class: 'up-hero__dot' }));
    meta.appendChild(el('span', {}, readMin + ' min read'));
    body.appendChild(meta);

    body.appendChild(el('span', { class: 'up-hero__cta' }, i18n('read_more', 'Read article')));

    link.appendChild(body);
    return link;
  }

  // ═══════════════════════════════════════
  // CARD BUILDER
  // ═══════════════════════════════════════
  function buildCard(it, lang) {
    var title      = pickLangField(it.title, lang) || 'Untitled';
    var summaryRaw = stripHtml(pickLangField(it.summary, lang) || '');
    var bodyRaw    = stripHtml(pickLangField(it.body, lang) || '');
    var summary    = summaryRaw || (bodyRaw.length > 180 ? bodyRaw.substring(0, 180) + '…' : bodyRaw);
    var href       = '/update.html?id=' + encodeURIComponent(it.id || '');
    var category   = buildCategory(it);
    var catLabel   = CAT_LABELS[category.toLowerCase()] || category || 'Update';
    var imgUrl     = getItemImage(it);
    var readMin    = estimateReadTime(it, lang);

    var article = el('article', { class: 'up-card reveal', attrs: { role: 'listitem' } });

    // Image
    if (imgUrl) {
      var imgWrap = el('div', { class: 'up-card__img-wrap' });
      var img = el('img', { class: 'up-card__img', attrs: { src: imgUrl, alt: '', loading: 'lazy', decoding: 'async' } });
      img.onerror = function () { imgWrap.style.display = 'none'; };
      imgWrap.appendChild(img);
      article.appendChild(imgWrap);
    }

    // Body
    var body = el('div', { class: 'up-card__body' });
    body.appendChild(el('span', { class: 'up-card__tag', attrs: { 'data-cat': category.toLowerCase() } }, catLabel));
    body.appendChild(el('h3', { class: 'up-card__title' }, title));
    if (summary) body.appendChild(el('p', { class: 'up-card__excerpt' }, summary));

    // Footer
    var footer = el('div', { class: 'up-card__footer' });
    footer.appendChild(el('time', { attrs: { datetime: it.date || '' } }, formatDate(it.date) + '  ·  ' + readMin + ' min'));
    footer.appendChild(el('a', { class: 'up-card__read', attrs: { href: href } }, i18n('read_more', 'Read')));
    body.appendChild(footer);

    article.appendChild(body);
    return article;
  }

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  function renderEmpty(container) {
    container.innerHTML = '';
    container.appendChild(
      el('div', { class: 'empty-state' },
        el('h3', {}, i18n('no_updates', 'No updates yet')),
        el('p', {}, i18n('no_updates_body', 'Check back soon for the latest news and reports.'))
      )
    );
  }

  function renderItems(container, items, lang, append) {
    if (!append) container.innerHTML = '';
    if (!items.length && !append) return renderEmpty(container);

    items.forEach(function (it) {
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
      container.appendChild(el('div', { class: 'skeleton-card', attrs: { 'aria-hidden': 'true' } }));
    }
  }

  // ═══════════════════════════════════════
  // MAIN LOAD
  // ═══════════════════════════════════════
  async function loadAndRender(reset) {
    var container = document.getElementById(CONTAINER_ID);
    var filter    = document.getElementById(FILTER_ID);
    var loading   = document.getElementById(LOADING_MSG_ID);
    var loadMore  = document.getElementById('updates-load-more');
    var featured  = document.getElementById('up-featured');
    if (!container) return;

    if (isLoading) return;
    isLoading = true;

    try {
      if (loading) loading.textContent = i18n('loading', 'Loading…');
      var lang = getLang();
      if (reset) { offset = 0; total = 0; showSkeleton(container, 6); }

      // Fetch
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

      // ── Featured article (first load only, no filters active) ──
      var feedItems = items;
      if (featured && reset) {
        featured.innerHTML = '';
        if (items.length && !query && !yearFilter && !categoryFilter) {
          featured.appendChild(buildFeatured(items[0], lang));
          feedItems = items.slice(1); // rest go to grid
        } else {
          feedItems = items;
        }
      } else if (!reset) {
        feedItems = items;
      } else {
        feedItems = items; // filtered: skip featured
      }

      // ── Paginate ──
      var startIdx = reset ? 0 : offset;
      // On fresh reset with featured, skip first item for grid
      var gridItems = (reset && featured && items.length && !query && !yearFilter && !categoryFilter)
        ? items.slice(1)
        : items;
      total = gridItems.length;
      var paged = gridItems.slice(startIdx, startIdx + PAGE_SIZE);

      renderItems(container, paged, lang, !reset);
      offset = startIdx + paged.length;

      // ── Year filter ──
      if (filter && reset) {
        var allItems = Array.isArray(data) ? data : (data.items || []);
        allItems.forEach(normalizeItemLangKeys);
        var years = Array.from(new Set(allItems.map(function (i) { return new Date(i.date).getFullYear(); }))).filter(function(y) { return !isNaN(y); }).sort(function (a, b) { return b - a; });
        filter.innerHTML = '';
        filter.appendChild(el('option', { value: '' }, 'All years'));
        years.forEach(function (y) { filter.appendChild(el('option', { value: y }, String(y))); });
      }

      // ── Load-more ──
      if (loadMore) {
        loadMore.textContent = i18n('load_more', 'Load more');
        loadMore.classList.remove('btn-loading');
        if (offset >= total) loadMore.setAttribute('disabled', 'disabled');
        else loadMore.removeAttribute('disabled');
      }

      if (loading) loading.textContent = '';
      if (!gridItems.length && offset === 0) renderEmpty(container);

    } catch (err) {
      if (loading) loading.textContent = 'Failed to load updates';
      container.innerHTML = '<div class="empty-state"><h3>Unable to load updates</h3><p>Please try again later.</p></div>';
      console.error('updates load error', err);
    } finally {
      isLoading = false;
    }
  }

  // ═══════════════════════════════════════
  // CATEGORY PILLS
  // ═══════════════════════════════════════
  function initCategoryPills() {
    var pills = document.querySelectorAll('.up-pill');
    if (!pills.length) return;

    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var cat = pill.getAttribute('data-cat') || '';

        pills.forEach(function (p) { p.classList.remove('active'); p.setAttribute('aria-selected', 'false'); });
        pill.classList.add('active');
        pill.setAttribute('aria-selected', 'true');

        var catSelect = document.getElementById('updates-category-filter');
        if (catSelect) {
          catSelect.value = cat;
          catSelect.dispatchEvent(new Event('change'));
        } else {
          categoryFilter = cat.toLowerCase();
          loadAndRender(true);
        }
      });
    });
  }

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    var filter     = document.getElementById(FILTER_ID);
    var search     = document.getElementById('updates-search');
    var loadMore   = document.getElementById('updates-load-more');
    var categoryEl = document.getElementById('updates-category-filter');
    var sortEl     = document.getElementById('updates-sort');

    initLangSwitcher();
    initCategoryPills();
    loadAndRender(true);

    if (filter) filter.addEventListener('change', function () { yearFilter = filter.value; loadAndRender(true); });
    if (categoryEl) categoryEl.addEventListener('change', function () { categoryFilter = (categoryEl.value || '').toLowerCase(); loadAndRender(true); });
    if (sortEl) sortEl.addEventListener('change', function () { sortOrder = sortEl.value || 'newest'; loadAndRender(true); });

    if (search) {
      var t = null;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { query = (search.value || '').trim(); loadAndRender(true); }, 300);
      });
    }

    if (loadMore) {
      loadMore.addEventListener('click', function () { loadMore.classList.add('btn-loading'); loadAndRender(false); });
    }
  });
})();


