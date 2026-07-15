/**
 * mara.js — TSD Myanmar · Mara category directory + listing
 *
 * mara.html shows a directory of Mara topic cards by default. When the URL
 * carries a ?cat=mara_* query param, it instead shows a filtered article
 * listing for that one category (pulled from the shared news index).
 */
(function () {
  'use strict';

  var PAGE_SIZE = 9;

  var MARA_CATEGORIES = [
    { code: 'mara_history',       key: 'mara_cat_history',       fallback: 'History' },
    { code: 'mara_geography',     key: 'mara_cat_geography',     fallback: 'Geography' },
    { code: 'mara_villages',      key: 'mara_cat_villages',      fallback: 'Villages' },
    { code: 'mara_population',    key: 'mara_cat_population',    fallback: 'Population' },
    { code: 'mara_education',     key: 'mara_cat_education',     fallback: 'Education' },
    { code: 'mara_language',      key: 'mara_cat_language',      fallback: 'Language' },
    { code: 'mara_culture',       key: 'mara_cat_culture',       fallback: 'Culture' },
    { code: 'mara_organizations', key: 'mara_cat_organizations', fallback: 'Organizations' },
    { code: 'mara_statistics',    key: 'mara_cat_statistics',    fallback: 'Statistics' },
    { code: 'mara_global',        key: 'mara_cat_global',        fallback: 'Global Mara' }
  ];

  var offset    = 0;
  var total     = 0;
  var allItems  = [];
  var currentCat = null;

  // ── DOM helper ──
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

  function i18n(key, fallback) {
    return (window.I18N && window.I18N[key]) || fallback;
  }

  function getLang() {
    try { return (window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) || 'en'; }
    catch (e) { return 'en'; }
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

  function estimateReadTime(item, lang) {
    var text = stripHtml(pickLangField(item.body, lang) || pickLangField(item.summary, lang) || '');
    var words = text.split(/\s+/).filter(function (w) { return w.length > 0; }).length;
    return Math.max(1, Math.round(words / 200));
  }

  function findCategory(code) {
    for (var i = 0; i < MARA_CATEGORIES.length; i++) {
      if (MARA_CATEGORIES[i].code === code) return MARA_CATEGORIES[i];
    }
    return null;
  }

  function getCatLabel(cat) {
    return i18n(cat.key, cat.fallback);
  }

  function getCatFromQuery() {
    var params = new URLSearchParams(location.search);
    var cat = (params.get('cat') || '').toLowerCase();
    return findCategory(cat) ? cat : null;
  }

  // ── Card builder ──
  function buildCard(it, lang, catLabel) {
    var title      = pickLangField(it.title, lang) || 'Untitled';
    var summaryRaw = stripHtml(pickLangField(it.summary, lang) || '');
    var bodyRaw    = stripHtml(pickLangField(it.body, lang) || '');
    var summary    = summaryRaw || (bodyRaw.length > 180 ? bodyRaw.substring(0, 180) + '…' : bodyRaw);
    var href       = '/update.html?id=' + encodeURIComponent(it.id || '');
    var imgUrl     = getItemImage(it);
    var readMin    = estimateReadTime(it, lang);

    var article = el('article', { class: 'up-card reveal', attrs: { role: 'listitem' } });

    if (imgUrl) {
      var imgWrap = el('div', { class: 'up-card__img-wrap' });
      var img = el('img', { class: 'up-card__img', attrs: { src: imgUrl, alt: '', loading: 'lazy', decoding: 'async' } });
      img.onerror = function () { imgWrap.style.display = 'none'; };
      imgWrap.appendChild(img);
      article.appendChild(imgWrap);
    }

    var body = el('div', { class: 'up-card__body' });
    body.appendChild(el('span', { class: 'up-card__tag', attrs: { 'data-cat': buildCategory(it).toLowerCase() } }, catLabel));
    body.appendChild(el('h3', { class: 'up-card__title' }, title));
    if (summary) body.appendChild(el('p', { class: 'up-card__excerpt' }, summary));

    var footer = el('div', { class: 'up-card__footer' });
    footer.appendChild(el('time', { attrs: { datetime: it.date || '' } }, formatDate(it.date) + '  ·  ' + readMin + ' min'));
    footer.appendChild(el('a', { class: 'up-card__read', attrs: { href: href } }, i18n('read_more', 'Read')));
    body.appendChild(footer);

    article.appendChild(body);
    return article;
  }

  function renderEmpty(container) {
    container.innerHTML = '';
    container.appendChild(
      el('div', { class: 'empty-state' },
        el('h3', {}, i18n('no_updates', 'No updates yet')),
        el('p', {}, i18n('no_updates_body', 'Check back soon for the latest news and reports.'))
      )
    );
  }

  function renderItems(container, items, lang, catLabel, append) {
    if (!append) container.innerHTML = '';
    if (!items.length && !append) return renderEmpty(container);

    items.forEach(function (it) {
      container.appendChild(buildCard(it, lang, catLabel));
    });

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

  async function loadAndRenderListing(cat, reset) {
    var container = document.getElementById('mara-listing-grid');
    var loading   = document.getElementById('mara-loading');
    var loadMore  = document.getElementById('mara-load-more');
    if (!container) return;

    var lang = getLang();
    var catLabel = getCatLabel(cat);

    try {
      if (loading) loading.textContent = i18n('loading', 'Loading…');
      if (reset) { offset = 0; total = 0; showSkeleton(container, 6); }

      if (reset) {
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
        items = items.filter(function (it) { return hasLangContent(it, lang); });
        items = items.filter(function (it) { return buildCategory(it).toLowerCase() === cat.code; });
        items.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        allItems = items;
      }

      total = allItems.length;
      var paged = allItems.slice(offset, offset + PAGE_SIZE);
      renderItems(container, paged, lang, catLabel, !reset);
      offset += paged.length;

      if (loadMore) {
        loadMore.textContent = i18n('load_more', 'Load more');
        loadMore.classList.remove('btn-loading');
        if (offset >= total) loadMore.setAttribute('hidden', 'hidden');
        else loadMore.removeAttribute('hidden');
      }

      if (loading) loading.textContent = '';
    } catch (err) {
      if (loading) loading.textContent = 'Failed to load articles';
      container.innerHTML = '<div class="empty-state"><h3>Unable to load articles</h3><p>Please try again later.</p></div>';
      console.error('mara listing load error', err);
    }
  }

  function showListing(catCode) {
    var cat = findCategory(catCode);
    if (!cat) return;
    currentCat = cat;

    var categoriesSection = document.getElementById('mara-categories');
    var listingSection    = document.getElementById('mara-listing');
    var titleEl            = document.getElementById('mara-listing-title');
    if (categoriesSection) categoriesSection.hidden = true;
    if (listingSection) listingSection.hidden = false;
    if (titleEl) titleEl.textContent = getCatLabel(cat);

    loadAndRenderListing(cat, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var initialCat = getCatFromQuery();
    if (initialCat) showListing(initialCat);

    var loadMore = document.getElementById('mara-load-more');
    if (loadMore) {
      loadMore.addEventListener('click', function () {
        if (!currentCat) return;
        loadMore.classList.add('btn-loading');
        loadAndRenderListing(currentCat, false);
      });
    }

    window.addEventListener('site:langchange', function () {
      if (currentCat) loadAndRenderListing(currentCat, true);
    });
  });
})();
