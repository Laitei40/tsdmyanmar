/*
 * updates-page.js — Load and render the Updates & News feed
 * - Fetches `updates/data/updates.json`
 * - Renders a calm, accessible timeline
 * - Supports year filtering and expandable details (ARIA + keyboard)
 * - Minimal, dependency-free, optimized for low-bandwidth
 */
(function(){
  const DATA_PATH = '/api/updates?lang=mrh&limit=1000';
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
    container.appendChild(el('div',{class:'empty-state'},
      el('h3',{},'No updates yet'),
      el('p',{},'We publish regular updates about our programs and finance reports. Check back soon or subscribe to our mailing list for alerts.')
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

  function renderItems(container, items, lang){
    container.innerHTML = '';
    if (!items.length) return renderEmpty(container);

    // Group by year and render in descending order
    const grouped = groupByYear(items);
    const years = Object.keys(grouped).sort((a,b)=>b-a);
    years.forEach(year=>{
      const yearHeader = el('h3',{class:'year'},year);
      container.appendChild(yearHeader);
      grouped[year].sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(it=>{
        const title = pickLangField(it.title, lang) || 'Untitled';
        const summary = pickLangField(it.summary, lang) || '';
        const body = pickLangField(it.body, lang) || '';
        const article = el('article',{class:'timeline-item reveal', attrs:{role:'article'}});
        const hdr = el('header',{}, el('h3',{}, title), el('time', {attrs:{datetime:it.date}}, formatDate(it.date)) );
        const summ = el('div',{class:'summary'}, summary);
        const actions = el('div',{class:'update-actions'});
        const btn = el('button',{class:'btn-plain', attrs:{'aria-expanded':'false','aria-controls':'more-'+it.id}}, 'Read more');
        actions.appendChild(btn);
        const more = el('div',{class:'more', attrs:{id:'more-'+it.id,'aria-hidden':'true'}}, el('div',{class:'body'}, body));

        article.appendChild(hdr);
        if (summary) article.appendChild(summ);
        article.appendChild(actions);
        article.appendChild(more);
        container.appendChild(article);

        // wire button
        btn.addEventListener('click', ()=>{
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!expanded));
          if (!expanded) openPanel(more); else closePanel(more);
        });
        // allow keyboard toggling (Space/Enter)
        btn.addEventListener('keydown', (e)=>{
          if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); btn.click(); }
        });
      });
    });

    // reveal on scroll (simple IntersectionObserver)
    requestAnimationFrame(()=>{
      const obs = new IntersectionObserver((entries, o)=>{
        entries.forEach(en=>{
          if (en.isIntersecting){ en.target.classList.add('visible'); o.unobserve(en.target); }
        });
      },{threshold:0.08});
      container.querySelectorAll('.reveal').forEach(n=>obs.observe(n));
    });
  }

  // Load + filter
  async function loadAndRender(){
    const container = document.getElementById(CONTAINER_ID);
    const filter = document.getElementById(FILTER_ID);
    const loading = document.getElementById(LOADING_MSG_ID);
    if (!container) return;
    try{
      loading && (loading.textContent = 'Loading updates…');
      const res = await fetch(DATA_PATH, {cache:'no-cache'});
      if (!res.ok) throw new Error('Network response ' + res.status);
      const data = await res.json();
      // API returns { items, total }
      const items = Array.isArray(data) ? data : (data.items || []);
      const lang = 'mrh';

      // optionally mark latest update
      items.sort((a,b)=> new Date(b.date) - new Date(a.date));
      if (items.length) items[0].isLatest = true;

      renderItems(container, items, lang);

      // build year filter
      const years = Array.from(new Set(items.map(i=> new Date(i.date).getFullYear()))).sort((a,b)=>b-a);
      if (filter){
        // clear existing options, add 'All' + year options
        filter.innerHTML = '';
        const optAll = el('option',{value:''}, 'All years');
        filter.appendChild(optAll);
        years.forEach(y=>{ filter.appendChild(el('option',{value:y}, String(y))); });
        filter.addEventListener('change', ()=>{
          const v = filter.value;
          if (!v) return renderItems(container, items, lang);
          const filtered = items.filter(i=> String(new Date(i.date).getFullYear()) === v);
          renderItems(container, filtered, lang);
        });
      }

      loading && (loading.textContent = '');
      // if no items
      if (!items.length) renderEmpty(container);

    }catch(err){
      if (loading) loading.textContent = 'Failed to load updates';
      container.innerHTML = '<p class="empty-state">Unable to load updates at this time. Please try again later.</p>';
      console.error('updates load error', err);
    }
  }

  // Wire language change to re-render
  document.addEventListener('DOMContentLoaded', ()=>{
    loadAndRender();
    window.addEventListener('site:langchange', ()=>{ loadAndRender(); });
  });
})();


