/*
 * updates-page.js — Load and render the Updates & News feed
 * - Fetches `updates/data/updates.json`
 * - Renders a calm, accessible timeline
 * - Supports year filtering and expandable details (ARIA + keyboard)
 * - Minimal, dependency-free, optimized for low-bandwidth
 */
(function(){
  const API_PATH = '/api/updates';
  const FALLBACK_PATH = 'assets/documents/reports/updates.json';
  const CONTAINER_ID = 'updates-list';
  const FILTER_ID = 'updates-year-filter';
  const LOADING_MSG_ID = 'updates-loading';

  // Utils
  function el(tag, props={}, ...children){
    const d = document.createElement(tag);
    Object.keys(props).forEach(k=>{
      if (k === 'class') d.className = props[k]; else if (k === 'attrs') {
        Object.entries(props.attrs).forEach(([a,v])=>d.setAttribute(a,v));
      } else d[k]=props[k];
    });
    children.forEach(c=>{ if (typeof c === 'string') d.appendChild(document.createTextNode(c)); else if (c) d.appendChild(c)});
    return d;
  }

  function formatDate(iso){
    try{ const d=new Date(iso); return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }catch(e){ return iso }
  }

  function groupByYear(items){
    const map = {};
    items.forEach(it=>{
      const y = (new Date(it.date)).getFullYear() || 'Unknown';
      (map[y] = map[y]||[]).push(it);
    });
    return map;
  }

  // Accessible expand/collapse: set max-height to scrollHeight for animation
  function openPanel(panel){
    panel.classList.add('open');
    const height = panel.scrollHeight;
    panel.style.maxHeight = height + 'px';
    panel.setAttribute('aria-hidden','false');
  }
  function closePanel(panel){
    panel.style.maxHeight = '0px';
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  }

  // Render functions
  function renderEmpty(container){
    container.innerHTML = '';
    const title = (window.I18N && window.I18N.no_updates) || 'No updates yet';
    const body = (window.I18N && window.I18N.no_updates_body) || 'We publish regular updates about our programs and finance reports. Check back soon or subscribe to our mailing list for alerts.';
    container.appendChild(el('div',{class:'empty-state'},
      el('h3',{}, title),
      el('p',{}, body)
    ));
  }

  // Helper to pick field by language with legacy 'mara' fallback for 'mrh'
  function pickLangField(obj, lang){
    if (!obj) return '';
    const candidates = (lang === 'mrh') ? ['mrh', 'mara', 'en'] : [lang, 'en'];
    for (let i = 0; i < candidates.length; i++){
      const k = candidates[i];
      if (obj[k]) return obj[k];
    }
    return '';
  }

  // Normalize per-item language keys to handle legacy and locale-variant keys
  // - copies `mara` -> `mrh` when present
  // - copies variant keys like `mrh-MM` or `my-MM` -> base codes `mrh`/`my`
  function normalizeItemLangKeys(item){
    if (!item || typeof item !== 'object') return;
    ['title','summary','body'].forEach(field => {
      const obj = item[field];
      if (!obj || typeof obj !== 'object') return;
      // Legacy: mara -> mrh
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      // Variant keys: copy base locale from variants like 'mrh-MM' -> 'mrh'
      Object.keys(obj).forEach(k => {
        const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i);
        if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; }
      });
    });
  }

  function renderItems(container, items, lang){
    // Render a grouped list (year headers) using list items for accessibility
    container.innerHTML = '';
    if (!items.length) return renderEmpty(container);

    const grouped = groupByYear(items);
    const years = Object.keys(grouped).sort((a,b)=>b-a);
    years.forEach(year=>{
      const yearHeader = el('h3',{class:'year'},year);
      container.appendChild(yearHeader);
      const list = el('ul',{class:'updates-list-inner', attrs:{role:'list'}});
      grouped[year].sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(it=>{
        const title = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || 'Untitled');
        const summary = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
        const body = (typeof it.body === 'string') ? it.body : (pickLangField(it.body, lang) || '');

        const article = el('article',{class:'update-card reveal', attrs:{role:'article'}});
        const meta = el('div',{class:'update-meta'}, el('time',{class:'update-date', attrs:{datetime:it.date}}, formatDate(it.date)), (it.isLatest? el('span',{class:'badge'},'Latest'): null));
        const hdr = el('h3',{class:'update-title'}, title);
        const summ = el('p',{class:'update-summary'}, summary);
        const actions = el('div',{class:'update-cta'});
        const cta = el('a',{class:'btn-link', attrs:{href: 'updates/'+(it.id || '')+'.html'}}, 'Read more');
        actions.appendChild(cta);

        article.appendChild(meta);
        article.appendChild(hdr);
        if (summary) article.appendChild(summ);
        article.appendChild(actions);

        const li = el('li',{}, article);
        list.appendChild(li);
      });
      container.appendChild(list);
    });

    // Simple reveal animation using IntersectionObserver
    requestAnimationFrame(()=>{
      const obs = new IntersectionObserver((entries, o)=>{
        entries.forEach(en=>{ if (en.isIntersecting){ en.target.classList.add('visible'); o.unobserve(en.target); } });
      },{threshold:0.08});
      container.querySelectorAll('.reveal').forEach(n=>obs.observe(n));
    });
  }

  // Paging + filter state
  const PAGE_SIZE = 6;
  let offset = 0;
  let total = 0;
  let query = '';
  let yearFilter = '';
  let isLoading = false;

  function showSkeleton(container, count){
    container.innerHTML = '';
    for (let i=0;i<count;i++){ const li = el('li',{class:'skeleton-card', attrs:{role:'listitem','aria-hidden':'true'}}); container.appendChild(li); }
  }

  // Load + filter
  async function loadAndRender(reset){
    const container = document.getElementById(CONTAINER_ID);
    const filter = document.getElementById(FILTER_ID);
    const loading = document.getElementById(LOADING_MSG_ID);
    const loadMoreBtn = document.getElementById('updates-load-more');
    if (!container) return;

    try{
      if (isLoading) return;
      isLoading = true;
      const loadingLabel = (window.I18N && window.I18N.loading) || 'Loading updates…';
      loading && (loading.textContent = loadingLabel);

      // determine lang early
      const lang = (window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) || 'en';

      if (reset){ offset = 0; total = 0; }

      // show skeletons for perceived speed
      showSkeleton(container, 3);

      // Build query params
      const params = new URLSearchParams();
      params.set('lang', lang);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (query) params.set('q', query);
      if (yearFilter) params.set('year', String(yearFilter));

      let res;
      try{ res = await fetch(API_PATH + '?' + params.toString(), {cache:'no-cache'}); if (!res.ok) throw new Error('API fetch ' + res.status); }
      catch(apiErr){ console.warn('Updates API failed, falling back to static JSON', apiErr); res = await fetch(FALLBACK_PATH, {cache:'no-cache'}); }

      if (!res.ok) throw new Error('Network response ' + res.status);
      const data = await res.json();
      // API returns { items: [...], total: N } when paged; fallback may return array
      const items = Array.isArray(data) ? data : (data.items || []);
      total = (typeof data.total === 'number') ? data.total : (items.length + offset);

      items.forEach(normalizeItemLangKeys);

      // optionally mark latest update (only on first page)
      if (offset === 0 && items.length) items[0].isLatest = true;

      // render: append or replace
      if (reset){ container.innerHTML = ''; renderItems(container, items, lang); }
      else { renderItems(container, items, lang); }

      // update offset
      offset += items.length;

      // build year filter using total results from server (we still calculate from loaded items as fallback)
      const years = Array.from(new Set(items.map(i=> new Date(i.date).getFullYear()))).sort((a,b)=>b-a);
      if (filter && reset){
        // clear existing options, add 'All' + year options
        filter.innerHTML = '';
        const optAll = el('option',{value:''}, 'All years');
        filter.appendChild(optAll);
        years.forEach(y=>{ filter.appendChild(el('option',{value:y}, String(y))); });
      }

      // Load more button state
      if (loadMoreBtn){
        const loadMoreLabel = (window.I18N && window.I18N.load_more) || 'Load more';
        loadMoreBtn.textContent = loadMoreLabel;
        if (offset >= total) loadMoreBtn.setAttribute('disabled','disabled'); else loadMoreBtn.removeAttribute('disabled');
      }

      loading && (loading.textContent = '');
      if (!items.length && offset === 0) renderEmpty(container);

    }catch(err){
      if (loading) loading.textContent = 'Failed to load updates';
      container.innerHTML = '<p class="empty-state">Unable to load updates at this time. Please try again later.</p>';
      console.error('updates load error', err);
    } finally { isLoading = false; }
  }

  // Wire language change and UI controls
  document.addEventListener('DOMContentLoaded', ()=>{
    const filter = document.getElementById(FILTER_ID);
    const search = document.getElementById('updates-search');
    const loadMoreBtn = document.getElementById('updates-load-more');

    // Initial load
    loadAndRender(true);

    // Re-load when site language changes
    window.addEventListener('site:langchange', ()=>{ loadAndRender(true); });

    // Year filter
    if (filter){
      filter.addEventListener('change', ()=>{ yearFilter = filter.value; loadAndRender(true); });
    }

    // Debounced search
    if (search){
      let t = null;
      search.addEventListener('input', (e)=>{
        clearTimeout(t);
        t = setTimeout(()=>{ query = (search.value || '').trim(); loadAndRender(true); }, 350);
      });
    }

    // Load more
    if (loadMoreBtn){
      loadMoreBtn.addEventListener('click', ()=>{ loadAndRender(false); });
    }
  });
})();


