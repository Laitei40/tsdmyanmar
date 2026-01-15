// JSON-backed i18n loader & data-i18n applier
// Requirements: use /i18n/en/common.json and /i18n/mrh/common.json, use ISO 'mrh' for Mara
const TSD_LANG_KEY = 'tsd_site_lang';
const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en','mrh','my'];

function normalizeLang(l){
  if (!l) return DEFAULT_LANG;
  // support legacy 'mara' token by migrating to 'mrh'
  if (l === 'mara') l = 'mrh';
  if (SUPPORTED_LANGS.indexOf(l) === -1) return DEFAULT_LANG;
  return l;
}

// Logo helpers — single source of truth for filename tokens
function getLogoToken(lang){
  lang = normalizeLang(lang);
  // Map site language codes to actual filename tokens present in /assets/images/logo/
  // Note: the repo contains `logo_mara.svg` for Mara (legacy name), so map `mrh` -> `mara`.
  const map = { 'en': 'en', 'mrh': 'mara', 'my': 'my' };
  return map[lang] || 'en';
}

// Build ordered logo filename candidates for a language.
// Prefer canonical names (logo_mrh/logo_my) then fall back to legacy filenames
// present in the repo (logo_mara/logo_mm).
function getLogoCandidates(lang){
  lang = normalizeLang(lang);
  const folder = '/assets/images/logo/';
  const list = [];
  if (lang === 'mrh'){
    // prefer canonical `logo_mrh.svg`, fallback to legacy `logo_mara.svg`
    list.push(folder + 'logo_mrh.svg');
    list.push(folder + 'logo_mara.svg');
  } else if (lang === 'my'){
    // prefer canonical `logo_my.svg`, fallback to legacy `logo_mm.svg`
    list.push(folder + 'logo_my.svg');
    list.push(folder + 'logo_mm.svg');
  } else {
    list.push(folder + 'logo_en.svg');
  }
  // generic fallback
  list.push(folder + 'logo.svg');
  return list;
}

function getSiteLang(){
  const raw = localStorage.getItem(TSD_LANG_KEY);
  return normalizeLang(raw || DEFAULT_LANG);
}

function setSiteLang(l){
  const lang = normalizeLang(l);
  localStorage.setItem(TSD_LANG_KEY, lang);
  // set html lang attribute (best-effort)
  try{ document.documentElement.lang = lang; }catch(e){}
  // load translations and apply immediately
  loadTranslations(lang).then(()=>{
    applySiteTranslations();
    window.dispatchEvent(new CustomEvent('site:langchange',{detail:{lang}}));
    // Ensure full page content (server-rendered or non-data-i18n) updates — reload.
    try{ setTimeout(function(){ location.reload(); }, 120); }catch(e){}
  }).catch(()=>{});
}

// Build list of candidate translation URLs for a given normalized lang
function getTranslationUrlsFor(lang){
  lang = normalizeLang(lang);
  // Preferred order:
  // 1. /i18n/{lang}/common.json
  // 2. /i18n/{baseLang}/common.json (if lang includes region variant)
  // 3. fallback to English
  const urls = [];
  const base = (lang || '').split(/[-_]/)[0];
  // First try language-specific variant folders (some generated content stores
  // translations under e.g. /my/i18n/my-MM/common.json or /mrh/i18n/mrh-MM/common.json)
  try{
    urls.push('/' + lang + '/i18n/' + lang + '-MM/common.json');
    urls.push('/' + lang + '/i18n/' + lang + '/common.json');
    urls.push('/' + base + '/i18n/' + lang + '/common.json');
  }catch(e){}

  // Then try the standard root i18n location
  urls.push('/i18n/' + lang + '/common.json');
  if (base && base !== lang) urls.push('/i18n/' + base + '/common.json');

  // Also try shortcuts like /{lang}/common.json
  urls.push('/' + lang + '/common.json');

  // Always fall back to root English index last
  if (lang !== 'en') urls.push('/i18n/en/common.json');
  return urls;
}

async function loadTranslations(lang){
  lang = normalizeLang(lang);
  const candidates = getTranslationUrlsFor(lang);
  for (let i = 0; i < candidates.length; i++){
    const url = candidates[i];
    try{
      console.debug('i18n: trying', url);
      const res = await fetch(url, {cache: 'no-cache'});
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      // Try to detect JSON even when content-type is missing or incorrect.
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const bodyText = await res.text();
      const first = (bodyText || '').trim().slice(0,2);
      if (ct.indexOf('application/json') === -1 && ct.indexOf('text/json') === -1 && first !== '{' && first !== '[' ){
        throw new Error('Not JSON');
      }
      var data;
      try{
        // strip BOM if present
        var clean = (bodyText || '').replace(/^\uFEFF/, '');
        data = JSON.parse(clean);
      }catch(e){ throw new Error('Invalid JSON'); }
      // window.I18N should be a simple key->string map
      window.I18N = Object.assign({}, data);
      return window.I18N;
    }catch(err){
      console.warn('i18n: failed to load', url, '- trying next fallback');
    }
  }
  // final fallback to English
  if (lang !== 'en') return loadTranslations('en');
  return window.I18N || {};
}

function applySiteTranslations(){
  try{
    const lang = getSiteLang();
    // Apply data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      let text = '';
      const val = (window.I18N && window.I18N[key]);
      if (typeof val === 'string') text = val;
      else if (val && typeof val === 'object') text = val[lang] || val.en || '';
      else text = '';

      if (text !== undefined){
        // If there is a child .brand-text, only update that node
        const child = el.querySelector && el.querySelector('.brand-text');
        if (child) child.textContent = text; else el.textContent = text;
      }
    });

    // Fallback: translate nav anchors and drop buttons when data-i18n not present (backwards compatible)
    if (window.I18N){
      document.querySelectorAll('#primary-nav a').forEach(a => {
        if (a.hasAttribute('data-i18n')) return;
        const href = a.getAttribute('href') || '';
        const name = href.split('/').pop().split('#')[0].split('?')[0].replace(/\.[a-z]+$/i,'');
        if (!name) return;
        const key = ('nav_' + name.replace(/[^a-z0-9]+/gi,'_').toLowerCase());
        if (window.I18N[key]) a.textContent = (typeof window.I18N[key] === 'string') ? window.I18N[key] : (window.I18N[key][lang] || window.I18N[key].en || a.textContent);
      });

      document.querySelectorAll('#primary-nav .drop-toggle').forEach(btn => {
        if (btn.hasAttribute('data-i18n')) return;
        const text = (btn.textContent || '').replace(/\+/g,'').trim();
        if (!text) return;
        const slug = text.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
        const key = 'header_' + slug;
        if (window.I18N[key]){
          const span = btn.querySelector('span');
          const newText = (typeof window.I18N[key] === 'string') ? window.I18N[key] : (window.I18N[key][lang] || window.I18N[key].en || text);
          if (btn.firstChild && btn.firstChild.nodeType === Node.TEXT_NODE){ btn.firstChild.textContent = newText + ' '; } else { btn.insertBefore(document.createTextNode(newText + ' '), span || null); }
        }
      });

      // support data-i18n-placeholder and ARIA labels
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        const val = window.I18N[key];
        if (typeof val === 'string') el.setAttribute('placeholder', val); else if (val && typeof val === 'object') el.setAttribute('placeholder', val[lang] || val.en || '');
      });

      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (!key) return;
        const val = window.I18N[key];
        if (typeof val === 'string') el.setAttribute('aria-label', val); else if (val && typeof val === 'object') el.setAttribute('aria-label', val[lang] || val.en || '');
      });
    }

    // Update logos / favicons and document title
    try{ updateLogos(); }catch(e){}

    try{
      const siteTitle = (window.I18N && window.I18N.site_title) || 'TSD Myanmar';
      if (document.title && document.title.includes('—')){
        const parts = document.title.split('—');
        document.title = siteTitle + ' — ' + parts.slice(1).join('—').trim();
      } else {
        document.title = siteTitle + (document.title ? ' — ' + document.title : '');
      }
    }catch(e){}

    console.debug('i18n: applied translations for', getSiteLang());
  }catch(e){ console.error('i18n apply error', e); }
}

function ensureLangSelector(){
  const sels = document.querySelectorAll('#site-lang-select');
  if (!sels || sels.length === 0) return;
  sels.forEach(sel=>{
    try{
      if (!sel.dataset.i18nAttached){
        // ensure options exist (safe, idempotent)
        sel.innerHTML = '<option value="en">English</option><option value="mrh">Mara</option><option value="my">Burmese</option>';
        sel.value = getSiteLang();

        const handler = (e)=>{
          const v = sel.value;
          setSiteLang(v);
        };
        sel.addEventListener('change', handler);
        sel.addEventListener('input', handler);
        sel.addEventListener('mousedown', e=>e.stopPropagation());
        sel.dataset.i18nAttached = '1';
      } else {
        sel.value = getSiteLang();
      }
    }catch(e){ console.error('i18n: init selector failed', e); }
  });
}

function updateLogos(){
  const lang = getSiteLang();
  const logoFolder = '/assets/images/logo/';
  // Map language codes to filename tokens. Keep language-to-logo simple:
  // en -> logo_en.svg, mrh -> logo_mrh.svg, my -> logo_my.svg
  const token = getLogoToken(lang);

  // Build candidates (prefer canonical names, include legacy fallbacks)
  const candidates = getLogoCandidates(lang);
  // Also include relative variants for environments that serve from subpaths
  const allCandidates = [];
  candidates.forEach(function(p){ allCandidates.push(p); allCandidates.push('.' + p); allCandidates.push('..' + p); });

  document.querySelectorAll('.brand-logo').forEach(function(img){
    try{
      img.setAttribute('alt', (window.I18N && window.I18N.site_title) || 'TSD Myanmar');
      (function tryNext(i){ if (i>=allCandidates.length) return; var src = allCandidates[i]; var t = new Image(); t.onload = function(){ img.src = src; }; t.onerror = function(){ tryNext(i+1); }; t.src = src; })(0);
    }catch(e){ console.error('i18n updateLogos err', e); }
  });
  try{ updateFavicons(); }catch(e){}
}

function updateFavicons(){
  const lang = getSiteLang();
  const logoFolder = '/assets/images/logo/';
  // Build favicon candidates aligned with logo candidates (canonical then legacy)
  const baseFavs = getLogoCandidates(lang).slice();
  // replace 'logo_*.svg' entries with favicon variants where appropriate
  // ensure favicon.svg is included as a final fallback
  baseFavs.push(logoFolder + 'favicon.svg');
  const candidates = [];
  baseFavs.forEach(n=>{ candidates.push(n); candidates.push('.' + n); candidates.push('..' + n); });

  let link = document.getElementById('site-favicon') || document.querySelector("link[rel~='icon']");
  if (!link){ link = document.createElement('link'); link.id = 'site-favicon'; link.rel = 'icon'; document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  try{ const siteTitle = (window.I18N && window.I18N.site_title) || 'TSD Myanmar'; link.title = siteTitle; link.setAttribute('title', siteTitle); link.setAttribute('aria-label', siteTitle); }catch(e){}

  (function tryNext(i){ if (i>=candidates.length) return; const src = candidates[i]; const t = new Image(); t.onload = function(){ try{ link.href = src; }catch(e){} }; t.onerror = function(){ tryNext(i+1); }; t.src = src; })(0);
}

// Initialize
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    // migrate any legacy key value
    const raw = localStorage.getItem(TSD_LANG_KEY);
    if (raw === 'mara'){ localStorage.setItem(TSD_LANG_KEY, 'mrh'); }

    const lang = getSiteLang();
    ensureLangSelector();
    loadTranslations(lang).then(()=>{ applySiteTranslations(); });

    // reapply briefly for dynamic keys
    setTimeout(()=>{ try{ applySiteTranslations(); }catch(e){} }, 150);

    const observer = new MutationObserver(()=>{ if (document.querySelector('#site-lang-select')) ensureLangSelector(); });
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('site:i18nready', ()=>{ loadTranslations(getSiteLang()).then(()=>applySiteTranslations()); });

  }catch(e){ console.error('i18n init', e); }
});

// public API
window.tsdI18n = { getSiteLang, setSiteLang, loadTranslations, applySiteTranslations };


