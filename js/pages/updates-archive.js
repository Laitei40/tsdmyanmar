/*
 * updates-archive.js — full historical feed
 * - Renders all items grouped by year
 * - Supports search and category/year filters
 * - Reuses the shared news index loader
 */
(function(){
  const LIST_ID = 'archive-list';
  const YEAR_FILTER_ID = 'archive-year-filter';
  const CAT_FILTER_ID = 'archive-category-filter';
  const SEARCH_ID = 'archive-search';
  const LOADING_ID = 'archive-loading';

  function el(tag, props={}, ...children){
    const d = document.createElement(tag);
    Object.keys(props).forEach(k=>{
      if (k === 'class') d.className = props[k];
      else if (k === 'attrs') Object.entries(props.attrs).forEach(([a,v])=>d.setAttribute(a,v));
      else d[k] = props[k];
    });
    children.forEach(c=>{
      if (typeof c === 'string') d.appendChild(document.createTextNode(c)); else if (c) d.appendChild(c);
    });
    return d;
  }

  function formatDate(iso){
    try{ const d=new Date(iso); return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }catch(e){ return iso; }
  }

  function pickLangField(obj, lang){
    if (!obj) return '';
    const candidates = (lang === 'mrh') ? ['mrh','mara','en'] : [lang,'en'];
    for (let i=0;i<candidates.length;i++){ const k = candidates[i]; if (obj[k]) return obj[k]; }
    return '';
  }

  function normalizeItemLangKeys(item){
    if (!item || typeof item !== 'object') return;
    ['title','summary','body'].forEach(field => {
      const obj = item[field];
      if (!obj || typeof obj !== 'object') return;
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      Object.keys(obj).forEach(k => {
        const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i);
        if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; }
      });
    });
  }

  function buildCategory(it){
    if (it.category) return String(it.category);
    if (Array.isArray(it.categories) && it.categories.length) return String(it.categories[0]);
    return '';
  }

  function buildCard(it, lang){
    const title = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || 'Untitled');
    const summaryRaw = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
    const bodyRaw = (typeof it.body === 'string') ? it.body : (pickLangField(it.body, lang) || '');
    const summary = summaryRaw || bodyRaw;
    const href = '/update.html?id=' + encodeURIComponent(it.id || '');
    const ctaLabel = (window.I18N && window.I18N.read_more) || 'Read more';
    const category = buildCategory(it);

    const article = el('article',{class:'update-card archive-card reveal', attrs:{role:'article'}});
    const left = el('div',{class:'card-left'});
    left.appendChild(el('time',{class:'update-date', attrs:{datetime:it.date}}, formatDate(it.date)));
    if (category) left.appendChild(el('span',{class:'badge'}, category));

    const hdr = el('h3',{class:'update-title'}, title);
    const summ = summary ? el('p',{class:'update-summary'}, summary) : null;
    const actions = el('div',{class:'update-cta'}, el('a',{class:'btn-link', attrs:{href}}, ctaLabel));

    const main = el('div',{class:'card-main'});
    main.appendChild(hdr);
    if (summ) main.appendChild(summ);
    main.appendChild(actions);

    article.appendChild(left);
    article.appendChild(main);
    return article;
  }

  function renderGrouped(container, items, lang){
    container.innerHTML = '';
    if (!items.length){
      container.appendChild(el('div',{class:'empty-state'},
        el('h3',{}, (window.I18N && window.I18N.no_updates) || 'No updates yet'),
        el('p',{}, (window.I18N && window.I18N.no_updates_body) || 'We will publish archive items soon.')
      ));
      return;
    }

    const grouped = {};
    items.forEach(it=>{
      const y = (new Date(it.date)).getFullYear() || 'Unknown';
      (grouped[y] = grouped[y] || []).push(it);
    });
    Object.keys(grouped).sort((a,b)=>b-a).forEach(year=>{
      const header = el('h3',{class:'archive-year'}, String(year));
      container.appendChild(header);
      const block = el('div',{class:'archive-year-block', attrs:{role:'list'}});
      grouped[year].sort((a,b)=> new Date(b.date) - new Date(a.date)).forEach(it=>{
        block.appendChild(buildCard(it, lang));
      });
      container.appendChild(block);
    });

    requestAnimationFrame(()=>{
      const obs = new IntersectionObserver((entries,o)=>{
        entries.forEach(en=>{ if (en.isIntersecting){ en.target.classList.add('visible'); o.unobserve(en.target);} });
      },{threshold:0.08});
      container.querySelectorAll('.reveal').forEach(n=>obs.observe(n));
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const listEl = document.getElementById(LIST_ID);
    const yearEl = document.getElementById(YEAR_FILTER_ID);
    const catEl = document.getElementById(CAT_FILTER_ID);
    const searchEl = document.getElementById(SEARCH_ID);
    const loadingEl = document.getElementById(LOADING_ID);

    let yearFilter = '';
    let catFilter = '';
    let query = '';
    let allItems = [];

    async function load(){
      if (!listEl) return;
      try{
        loadingEl && (loadingEl.textContent = (window.I18N && window.I18N.loading) || 'Loading updates…');
        let data;
        try{
          data = await (window.tsdNews && window.tsdNews.fetchNewsIndex ? window.tsdNews.fetchNewsIndex() : Promise.reject(new Error('news helper missing')));
        }catch(e){
          console.error('archive load error', e);
          throw e;
        }
        let items = Array.isArray(data) ? data : (data.items || []);
        items.forEach(normalizeItemLangKeys);
        allItems = items;
        populateYears(items);
        render();
      }catch(e){
        if (listEl) listEl.innerHTML = '<p class="empty-state">Unable to load archive right now.</p>';
      } finally {
        loadingEl && (loadingEl.textContent = '');
      }
    }

    function populateYears(items){
      if (!yearEl) return;
      const years = Array.from(new Set(items.map(i=> new Date(i.date).getFullYear()))).sort((a,b)=>b-a);
      yearEl.innerHTML = '';
      yearEl.appendChild(el('option',{value:''}, 'All years'));
      years.forEach(y=> yearEl.appendChild(el('option',{value:y}, String(y))));
    }

    function applyFilters(items){
      const lang = (window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) || 'en';
      let filtered = items.slice();
      if (yearFilter) filtered = filtered.filter(it => (new Date(it.date)).getFullYear() === Number(yearFilter));
      if (catFilter){
        filtered = filtered.filter(it=>{
          if (it.category && String(it.category).toLowerCase() === catFilter) return true;
          if (Array.isArray(it.categories) && it.categories.map(c=>String(c).toLowerCase()).includes(catFilter)) return true;
          return false;
        });
      }
      if (query){
        const q = query.toLowerCase();
        filtered = filtered.filter(it=>{
          const title = (typeof it.title === 'string') ? it.title : (pickLangField(it.title, lang) || '');
          const summary = (typeof it.summary === 'string') ? it.summary : (pickLangField(it.summary, lang) || '');
          const body = (typeof it.body === 'string') ? it.body : (pickLangField(it.body, lang) || '');
          return (title+summary+body).toLowerCase().indexOf(q) !== -1;
        });
      }
      filtered.sort((a,b)=> new Date(b.date) - new Date(a.date));
      return { filtered, lang };
    }

    function render(){
      const { filtered, lang } = applyFilters(allItems);
      renderGrouped(listEl, filtered, lang);
    }

    if (yearEl){ yearEl.addEventListener('change', ()=>{ yearFilter = yearEl.value; render(); }); }
    if (catEl){ catEl.addEventListener('change', ()=>{ catFilter = (catEl.value || '').toLowerCase(); render(); }); }
    if (searchEl){
      let t=null;
      searchEl.addEventListener('input', ()=>{
        clearTimeout(t);
        t = setTimeout(()=>{ query = (searchEl.value || '').trim(); render(); }, 320);
      });
    }
    window.addEventListener('site:langchange', render);

    load();
  });
})();
