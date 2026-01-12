// Shared i18n selector and simple data-i18n applier
const TSD_LANG_KEY = 'tsd_site_lang';
const DEFAULT_LANG = 'en';

function getSiteLang(){
  return localStorage.getItem(TSD_LANG_KEY) || DEFAULT_LANG;
}

function setSiteLang(l){
  localStorage.setItem(TSD_LANG_KEY, l);
  document.documentElement.lang = l === 'my' ? 'my' : (l === 'mara' ? 'mara' : 'en');
}

function applySiteTranslations(){
  try{
    const lang = getSiteLang();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      try{
        // Look for a global I18N mapping (pages like updates may provide it)
        if (window.I18N && window.I18N[key]){
          const text = window.I18N[key][lang] || window.I18N[key].en || '';
          // If the element contains a child specifically for text (e.g. .brand-text),
          // update that child only so we don't remove images or other markup.
          let target = el;
          try{
            const child = el.querySelector && el.querySelector('.brand-text');
            if (child) target = child;
          }catch(err){ /* ignore */ }
          target.textContent = text;
        }
      }catch(e){
        console.error('i18n: failed to apply key', key, e);
      }
    });

    // Fallback: translate nav links and header buttons by deriving keys
    // from hrefs or visible text when explicit data-i18n attributes are missing.
    if (window.I18N){
      // Translate nav anchors (derive key from filename)
      document.querySelectorAll('#primary-nav a').forEach(a => {
        if (a.hasAttribute('data-i18n')) return;
        const href = a.getAttribute('href') || '';
        const name = href.split('/').pop().split('#')[0].split('?')[0].replace(/\.[a-z]+$/i,'');
        if (!name) return;
        const key = ('nav_' + name.replace(/[^a-z0-9]+/gi,'_').toLowerCase());
        if (window.I18N[key]){
          a.textContent = window.I18N[key][lang] || window.I18N[key].en || a.textContent;
        }
      });

      // Translate top-level header buttons (derive key from visible label)
      document.querySelectorAll('#primary-nav .drop-toggle').forEach(btn => {
        if (btn.hasAttribute('data-i18n')) return;
        const text = (btn.textContent || '').replace(/\+/g,'').trim();
        if (!text) return;
        const slug = text.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
        const key = 'header_' + slug;
        if (window.I18N[key]){
          // update only text node, preserve internal <span> (+)
          const span = btn.querySelector('span');
          const newText = (window.I18N[key][lang] || window.I18N[key].en || text) + ' ';
          if (btn.firstChild && btn.firstChild.nodeType === Node.TEXT_NODE){
            btn.firstChild.textContent = newText;
          } else {
            btn.insertBefore(document.createTextNode(newText), span || null);
          }
        }
      });
    }

    // Update logos after applying translations
    updateLogos();
    console.log('i18n: applied translations for', lang);
  } catch(err){
    console.error('i18n: applySiteTranslations error', err);
  }
}

function ensureLangSelector(){
  // support multiple selectors on the page (some templates may duplicate the control)
  const sels = document.querySelectorAll('#site-lang-select');
  if (!sels || sels.length === 0) return;
  sels.forEach(sel => {
    try{
      // avoid re-attaching handlers if already initialized
      if (sel.dataset.i18nAttached){
        sel.value = getSiteLang();
        return;
      }

      sel.value = getSiteLang();
      const handler = ()=>{
        try{
          const v = sel.value;
          setSiteLang(v);
          applySiteTranslations();
          // dispatch event so other scripts can react
          window.dispatchEvent(new CustomEvent('site:langchange',{detail:{lang:v}}));
          console.log('i18n: language changed to', v);
          // Reload page so all content is applied freshly (debounced to avoid duplicate reloads)
          if (!window.__tsdReloadPending){
            window.__tsdReloadPending = true;
            setTimeout(()=>{ try{ location.reload(); }catch(e){} }, 120);
          }
        }catch(e){ console.error('i18n: error in change handler', e); }
      };

      sel.addEventListener('change', handler);
      sel.addEventListener('input', handler);
      // stop mousedown propagation so the header/menu handlers don't steal focus on mobile
      sel.addEventListener('mousedown', (e)=>{ e.stopPropagation(); });
      sel.dataset.i18nAttached = '1';
    }catch(e){ console.error('i18n: failed to initialize selector', e); }
  });
} 

function updateLogos(){
  const lang = getSiteLang();
  const theme = (document.documentElement && (document.documentElement.getAttribute('data-theme') || window.__TSD_THEME)) || 'light';
  const base = (lang === 'my') ? 'logo_mm' : 'logo_en';
  // prefer theme-specific variant if available (e.g. logo_en_dark.svg), then fallback to base
  const names = [base + '_' + theme + '.svg', base + '.svg'];
  const candidates = [];
  names.forEach(n => {
    candidates.push('assets/images/' + n);
    candidates.push('./assets/images/' + n);
    candidates.push('../assets/images/' + n);
    candidates.push('/assets/images/' + n);
  });
  document.querySelectorAll('.brand-logo').forEach(img=>{
    try{
      img.setAttribute('alt','TSD Myanmar logo');
      // try candidates in order; set first that loads successfully
      (function tryNext(i){
        if (i >= candidates.length) return; // nothing worked
        const src = candidates[i];
        const tester = new Image();
        tester.onload = function(){ img.src = src; };
        tester.onerror = function(){ tryNext(i+1); };
        // start testing
        tester.src = src;
      })(0);
    }catch(e){ console.error('i18n: updateLogos error', e); }
  });
  // Also update favicons to match the selected language
  try{ updateFavicons(); }catch(e){ /* ignore */ }
}


function updateFavicons(){
  const lang = getSiteLang();
  const theme = (document.documentElement && (document.documentElement.getAttribute('data-theme') || window.__TSD_THEME)) || 'light';
  const base = (lang === 'my') ? 'logo_mm' : (lang === 'mara' ? 'logo_mara' : 'logo_en');
  const names = [base + '_' + theme + '.svg', base + '.svg'];
  const candidates = [];
  names.forEach(n => {
    candidates.push('assets/images/' + n);
    candidates.push('./assets/images/' + n);
    candidates.push('../assets/images/' + n);
    candidates.push('/assets/images/' + n);
  });

  // find or create link element
  let link = document.getElementById('site-favicon') || document.querySelector("link[rel~='icon']");
  if (!link){
    link = document.createElement('link');
    link.id = 'site-favicon';
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';

  (function tryNext(i){
    if (i >= candidates.length) return;
    const src = candidates[i];
    const tester = new Image();
    tester.onload = function(){ try{ link.href = src; }catch(e){} };
    tester.onerror = function(){ tryNext(i+1); };
    tester.src = src;
  })(0);
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Ensure html lang initially
  setSiteLang(getSiteLang());
  ensureLangSelector();
  applySiteTranslations();

  // Also schedule a short re-apply to catch dynamically-registered I18N keys
  setTimeout(()=>{ try{ applySiteTranslations(); }catch(e){} }, 150);

  // Observe DOM for added language selectors (some templates may insert header later)
  try{
    const observer = new MutationObserver((mutations)=>{
      if (document.querySelector('#site-lang-select')) ensureLangSelector();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }catch(e){ /* ignore */ }

  // When page-specific scripts register their I18N keys, they can dispatch this
  // event so translations are re-applied immediately.
  window.addEventListener('site:i18nready', ()=>{
    console.log('i18n: site:i18nready received — reapplying translations');
    try{ applySiteTranslations(); }catch(e){}
  });

  // Trigger a subtle logo animation on first paint without blocking interaction
  try{
    requestAnimationFrame(()=>{
      // Add class to start CSS-driven transition; harmless if missing
      document.querySelectorAll('.brand-logo').forEach(img=> img.classList.add('logo-animate'));
    });
  }catch(e){/* ignore */}
});

// expose helpers
window.tsdI18n = { getSiteLang, setSiteLang, applySiteTranslations };

// Base site translations for common keys (mara / en / my)
const BASE_I18N = {
  site_title: { mara: 'TSD Myanmar', en: 'TSD Myanmar', my: 'TSD Myanmar' },
  nav_home: { mara: 'Home', en: 'Home', my: 'ပင်မ' },
  nav_about: { mara: 'Eima Thatih', en: 'About', my: 'အကြောင်း' },
  nav_projects: { mara: 'Projects', en: 'Projects', my: 'ပရောဂျက်များ' },
  nav_impact: { mara: 'Impact', en: 'Impact', my: 'သက်ရောက်မှု' },
  nav_donate: { mara: 'Thluana', en: 'Donate', my: 'Donate' },
  nav_get_involved: { mara: 'Hlazy hlao', en: 'Get Involved', my: 'ပါဝင်ဆောင်ရွက်ရန်' },
  nav_contact: { mara: 'Contact', en: 'Contact', my: 'ဆက်သွယ်ရန်' },

  /* header buttons */
  header_about_us: { mara: 'Eima Thatih', en: 'About Us', my: 'အကြောင်း' },
  header_our_work: { mara: 'Eima Raityu', en: 'Our Work', my: 'လုပ်ငန်းများ' },
  header_news: { mara: 'Thatih', en: 'News', my: 'သတင်း' },
  header_get_involved: { mara: 'Hlazy hlao', en: 'Get Involved', my: 'ပါဝင်ဆောင်ရွက်ရန်' },

  /* dropdown items */
  nav_about_us: { mara: 'Eima Thatih', en: 'About Us', my: 'အကြောင်း' },
  nav_who_we_are: { mara: 'Ahia eima châ', en: 'Who We Are', my: 'ကျွန်ုပ်တို့ အကြောင်း' },
  nav_contact_us: { mara: 'Eima hnohta biatluana', en: 'Contact Us', my: 'ဆက်သွယ်ရန်' },

  nav_where_we_work: { mara: 'Khai liata e raityu eima hria', en: 'Where We Work', my: 'ကျွန်ုပ်တို့ လုပ်ငန်းနေရာများ' },
  nav_what_we_do: { mara: 'Khâpa e eima hria', en: 'What We Do', my: 'ကျွန်ုပ်တို့ လုပ်ဆောင်ချက်များ' },
  nav_our_approach: { mara: 'Eima raihriapa dâh', en: 'Our Approach', my: 'နည်းလမ်း' },
  nav_education: { mara: 'Chhuanohna', en: 'Education', my: 'ပညာရေး' },
  nav_food_security: { mara: 'Pati-pachina', en: 'Food Security', my: 'အစာလုံခြုံရေး' },
  nav_inclusion: { mara: 'Azydua hlaona', en: 'Inclusion', my: 'ပါဝင်မှု' },
  nav_relief_drr: { mara: 'Beidyutuhna nata Hmo-chhie thliapano dâh', en: 'Relief & DRR', my: 'ကယ်ဆယ်ရေး / DRR' },

  nav_updates: { mara: 'Thatih', en: 'Updates', my: 'အသစ်များ' },
  nav_updates_reports: { mara: 'Thatih thieh nata Report zy', en: 'Updates & Reports', my: 'အသစ်များနှင့် အစီရင်ခံစာ' },
  nav_how_to_get_involved: { mara: 'Kheihta e hlao theipa a châ', en: 'How to Get Involved', my: 'ပါဝင်နည်းများ' },
  nav_partnership: { mara: 'Raityuh-viapa dâh', en: 'Partnership', my: 'မိတ်ဖက်ဆက်ဆံရေး' },
  nav_education_ambassadors: { mara: 'Chuuna lâta thlatuhpa zy', en: 'Education Ambassadors', my: 'ပညာရေး သံတမန်' },
  nav_join_our_team: { mara: 'Eima hnohta raihria hlao la', en: 'Join our Team', my: 'အသင်းတွင် ပါဝင်ရန်' },

  about_title: { mara: 'About TSD Myanmar', en: 'About TSD Myanmar', my: 'TSD အကြောင်း' },
  projects_title: { mara: 'Projects', en: 'Projects', my: 'ပရောဂျက်များ' },
  impact_title: { mara: 'Impact & Reports', en: 'Impact & Reports', my: 'သက်ရောက်မှုနှင့် အစီရင်ခံစာ' },
  donate_title: { mara: 'Support / Donate', en: 'Support / Donate', my: 'ထောက်ခံမှု / ဒါနမှု' },
  get_involved_title: { mara: 'Volunteers & Partners', en: 'Volunteers & Partners', my: 'Volunteer များနှင့် မိတ်ဖက်များ' },
  contact_title: { mara: 'Contact', en: 'Contact', my: 'ဆက်သွယ်ရန်' }
};

window.I18N = Object.assign(window.I18N || {}, BASE_I18N);
