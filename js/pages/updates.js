/*
 * updates-page.js — Load and render the Updates & News feed
 * - Fetches `updates/data/updates.json`
 * - Renders a calm, accessible timeline
 * - Supports year filtering and expandable details (ARIA + keyboard)
 * - Minimal, dependency-free, optimized for low-bandwidth
 */
(function(){
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
        const left = el('div',{class:'card-left'});
        left.appendChild(el('time',{class:'update-date', attrs:{datetime:it.date}}, formatDate(it.date)));
        if (it.isLatest) left.appendChild(el('span',{class:'badge'}, (window.I18N && window.I18N.latest_badge) || 'Latest'));
        const hdr = el('h3',{class:'update-title'}, title);
        const summ = el('p',{class:'update-summary'}, summary);
        const actions = el('div',{class:'update-cta'});
        const ctaLabel = (window.I18N && window.I18N.read_more) || 'Read more';
        const href = '/update.html?id=' + encodeURIComponent(it.id || '');
        const cta = el('a',{class:'btn-link', attrs:{href}}, ctaLabel);
        actions.appendChild(cta);
        const main = el('div',{class:'card-main'});
        main.appendChild(hdr);
        if (summary) main.appendChild(summ);
        main.appendChild(actions);

        article.appendChild(left);
        article.appendChild(main);

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
  let categoryFilter = '';
  let sortOrder = 'newest';
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

      // Load static news index for current language, fallback to English per index
      let data;
      try{
        data = await (window.tsdNews && window.tsdNews.fetchNewsIndex ? window.tsdNews.fetchNewsIndex() : Promise.reject(new Error('news helper missing')));
      }catch(e){
        console.error('Failed to load news index', e);
        throw e;
      }

      // data expected to be an array of items
      let items = Array.isArray(data) ? data : (data.items || []);
      items.forEach(normalizeItemLangKeys);

      // Client-side filtering (year + category + query)
      if (yearFilter) items = items.filter(it => (new Date(it.date)).getFullYear() === Number(yearFilter));
      if (categoryFilter){
        items = items.filter(it => {
          if (!it) return false;
          if (it.category && String(it.category).toLowerCase() === categoryFilter) return true;
          if (Array.isArray(it.categories) && it.categories.map(c=>String(c).toLowerCase()).includes(categoryFilter)) return true;
          return false;
        });
      }
      if (query){
        const q = query.toLowerCase();
        items = items.filter(it => {
          const title = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || '');
          const summary = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
          const body = (typeof it.body === 'string') ? it.body : (pickLangField(it.body, lang) || '');
          return (title+summary+body).toLowerCase().indexOf(q) !== -1;
        });
      }

      // Sorting
      if (sortOrder === 'oldest') items.sort((a,b)=> new Date(a.date) - new Date(b.date)); else items.sort((a,b)=> new Date(b.date) - new Date(a.date));

      total = items.length;

      // paginate
      const paged = items.slice(offset, offset + PAGE_SIZE);

      if (reset){ container.innerHTML = ''; renderItems(container, paged, lang); }
      else { renderItems(container, paged, lang); }

      // update offset
      offset += paged.length;

      // build year filter when resetting
      const years = Array.from(new Set((Array.isArray(data)?data:[]).map(i=> new Date(i.date).getFullYear()))).sort((a,b)=>b-a);
      if (filter && reset){
        filter.innerHTML = '';
        const optAll = el('option',{value:''}, 'All years');
        filter.appendChild(optAll);
        years.forEach(y=>{ filter.appendChild(el('option',{value:y}, String(y))); });
      }

      // Load more button state
      if (loadMoreBtn){
        const loadMoreLabel = (window.I18N && window.I18N.load_more) || 'Load more';
        loadMoreBtn.textContent = loadMoreLabel;
        if (offset >= total){ loadMoreBtn.setAttribute('disabled','disabled'); loadMoreBtn.setAttribute('aria-disabled','true'); loadMoreBtn.classList.remove('btn-loading'); } else { loadMoreBtn.removeAttribute('disabled'); loadMoreBtn.setAttribute('aria-disabled','false'); loadMoreBtn.classList.remove('btn-loading'); }
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
    const categoryEl = document.getElementById('updates-category-filter');
    const sortEl = document.getElementById('updates-sort');

    // Initial load
    loadAndRender(true);

    // Re-load when site language changes
    window.addEventListener('site:langchange', ()=>{ loadAndRender(true); });

    // Year filter
    if (filter){
      filter.addEventListener('change', ()=>{ yearFilter = filter.value; loadAndRender(true); });
    }

    // Category filter
    if (categoryEl){
      categoryEl.addEventListener('change', ()=>{ categoryFilter = (categoryEl.value || '').toString().toLowerCase(); loadAndRender(true); });
    }

    // Sort
    if (sortEl){
      sortEl.addEventListener('change', ()=>{ sortOrder = sortEl.value || 'newest'; loadAndRender(true); });
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
      loadMoreBtn.addEventListener('click', ()=>{ loadMoreBtn.classList.add('btn-loading'); loadAndRender(false); });
    }
  });
})();


