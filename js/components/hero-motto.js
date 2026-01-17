// Typewriter for hero motto (i18n-aware)
(function(){
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

  document.addEventListener('DOMContentLoaded', function(){
    const dynamic = document.querySelector('.hero-motto .hero-motto-dynamic');
    if(!dynamic) return;

    const i18nKey = dynamic.getAttribute('data-i18n-words');
    const wrap = dynamic.querySelector('.typewrap');
    if(!wrap) return;

    // helper to resolve words from i18n or data-words fallback
    function resolveWords(){
      // try i18n key first
      if (i18nKey && window.I18N && window.I18N[i18nKey]){
        const v = window.I18N[i18nKey];
        // support an array directly
        if (Array.isArray(v) && v.length) return v.slice();
        // support object that contains language keys
        if (v && typeof v === 'object'){
          const lang = (window && window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) ? window.tsdI18n.getSiteLang() : 'en';
          if (Array.isArray(v[lang])) return v[lang].slice();
          if (Array.isArray(v.en)) return v.en.slice();
          if (typeof v[lang] === 'string') return [v[lang]];
          if (typeof v.en === 'string') return [v.en];
        }
      }

      // fallback: try data-words attribute (legacy)
      try{
        const raw = dynamic.getAttribute('data-words');
        if (raw){
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) return parsed.slice();
        }
      }catch(e){}

      // final fallback
      return ["Together we can do more","Together we can do better","Together we can build a sustainable future"];
    }

    let words = resolveWords();

    // Respect reduced motion
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      wrap.textContent = words[0];
      return;
    }

    const typeSpeed = 80;
    const deleteSpeed = 40;
    const pauseAfter = 1400;
    let idx = 0;
    let generation = 0; // bumped when words change

    async function typeWord(word){
      wrap.textContent = '';
      for(let i=0;i<word.length;i++){
        wrap.textContent += word.charAt(i);
        await sleep(typeSpeed);
      }
      await sleep(pauseAfter);
      for(let i=word.length;i>=0;i--){
        wrap.textContent = word.slice(0,i);
        await sleep(deleteSpeed);
      }
    }

    // main loop (respects updated 'words' if language changes)
    (async function loop(myGen){
      await sleep(400);
      while(true){
        // if words were updated, restart loop to avoid stale index
        if (myGen !== generation) return loop(generation);
        const w = words[idx % words.length] || words[0];
        await typeWord(w);
        idx = (idx + 1) % Math.max(1, words.length);
      }
    })(generation);

    // update words when translations change
    window.addEventListener('site:langchange', ()=>{
      const newWords = resolveWords();
      // blunt replacement: update words array, reset index, bump generation
      words = newWords;
      idx = 0;
      generation++;
      // if reduced-motion now requested, make sure we show first word
      if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        wrap.textContent = words[0];
      }
    });
  });
})();
