// Helper to fetch updates from D1 API with static JSON fallback
// Uses existing window.tsdI18n.getSiteLang() to resolve current language
(function(){
  async function tryFetchJson(url){
    const res = await fetch(url, {cache: 'no-cache'});
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    return res.json();
  }

  function getLang(){
    try{ return (window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) || 'en'; }
    catch(e){ return 'en'; }
  }

  async function fetchFromApi(articleId, lang){
    const apiUrl = '/api/news/' + encodeURIComponent(articleId) + '?lang=' + encodeURIComponent(lang);
    const res = await fetch(apiUrl, {cache:'no-cache'});
    if (!res.ok) throw new Error('API fetch failed: ' + res.status);
    return res.json();
  }

  async function fetchNewsJson(articleId){
    const lang = getLang();
    // 1) Try D1-backed API
    try{
      return await fetchFromApi(articleId, lang);
    }catch(e){
      console.warn('API fetch failed, falling back to static JSON', e);
    }

    // 2) Fallback to static JSON per language, then English
    const tryFor = async (l) => {
      const url = '/news/' + encodeURIComponent(l) + '/' + encodeURIComponent(articleId) + '.json';
      return tryFetchJson(url);
    };
    try { return await tryFor(lang); }
    catch (e) {
      if (lang !== 'en') return tryFor('en');
      throw e;
    }
  }

  async function fetchAllFromApi(){
    const pageSize = 40;
    let offset = 0;
    let items = [];
    let total = null;
    let pages = 0;
    const maxPages = 15; // guardrail
    while (pages < maxPages){
      pages++;
      // Don't send lang — return full i18n objects so client-side language filtering works
      const url = '/api/news?limit=' + pageSize + '&offset=' + offset;
      const res = await fetch(url, {cache:'no-cache'});
      if (!res.ok) throw new Error('API index fetch failed: ' + res.status);
      const data = await res.json();
      const batch = Array.isArray(data.items) ? data.items : [];
      items = items.concat(batch);
      total = (data && typeof data.total === 'number') ? data.total : items.length;
      offset += batch.length;
      if (offset >= total || batch.length === 0) break;
    }
    return items;
  }

  async function fetchNewsIndex(){
    // 1) Try D1 API (paged) — returns full i18n objects for client-side filtering
    try{
      return await fetchAllFromApi();
    }catch(e){
      console.warn('API index fetch failed, falling back to static JSON', e);
    }

    // 2) Fallback to static news index
    const lang = getLang();
    const tryFor = async (l) => {
      const url = '/news/' + encodeURIComponent(l) + '/index.json';
      return tryFetchJson(url);
    };
    try{
      return await tryFor(lang);
    }catch(e){
      if (lang !== 'en') return tryFor('en');
      throw e;
    }
  }

  window.tsdNews = { fetchNewsJson, fetchNewsIndex };
})();

  // Renderer: build DOM for article JSON (images, galleries, videos, paragraphs)
  (function(){
    function isExternalUrl(url){
      try{ const u = new URL(url, location.href); return u.origin !== location.origin; }catch(e){ return false; }
    }

    function createLink(url, text){
      const a = document.createElement('a');
      a.href = url;
      a.textContent = text || url;
      if (isExternalUrl(url)){
        a.target = '_blank'; a.rel = 'noopener noreferrer';
      }
      a.className = 'article-link';
      return a;
    }

    function linkifyTextToFragment(text){
      const frag = document.createDocumentFragment();
      if (!text) return frag;
      const urlRe = /https?:\/\/[\w\-\.\~\/:?#\[\]@!$&'()*+,;=%]+/g;
      let lastIndex = 0; let m;
      while ((m = urlRe.exec(text)) !== null){
        const before = text.slice(lastIndex, m.index);
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(createLink(m[0]));
        lastIndex = m.index + m[0].length;
      }
      const tail = text.slice(lastIndex);
      if (tail) frag.appendChild(document.createTextNode(tail));
      return frag;
    }

    function renderParagraph(block){
      const p = document.createElement('p');
      if (block.url){
        const a = createLink(block.url, block.text || block.url);
        p.appendChild(a);
      } else if (block.text){
        p.appendChild(linkifyTextToFragment(block.text));
      }
      return p;
    }

    function createFigure(img){
      const fig = document.createElement('figure'); fig.className = 'media-figure';
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = img.src; image.alt = img.alt || '';
      image.setAttribute('role','img');
      image.style.width = '100%';
      image.style.height = 'auto';
      fig.appendChild(image);
      if (img.caption){ const cap = document.createElement('figcaption'); cap.className='media-caption'; cap.textContent = img.caption; fig.appendChild(cap); }
      return fig;
    }

    function renderGallery(images){
      const wrap = document.createElement('div'); wrap.className = 'media-gallery';
      images.forEach(img=> wrap.appendChild(createFigure(img)));
      return wrap;
    }

    function extractYouTubeId(url){
      try{
        const u = new URL(url);
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
        if (u.hostname === 'youtu.be') return u.pathname.slice(1);
      }catch(e){}
      return null;
    }

    function createLazyYouTubeEmbed(video){
      const id = extractYouTubeId(video.url);
      const container = document.createElement('div'); container.className = 'video-embed lazy-video';
      const aspect = document.createElement('div'); aspect.className = 'video-wrapper';
      // poster thumbnail
        if (id) {
        const thumb = document.createElement('button'); thumb.type='button'; thumb.className='video-poster';
        thumb.setAttribute('aria-label', 'Play video: ' + (video.title || ''));
        const img = document.createElement('img'); img.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; img.alt = video.title || 'Video thumbnail'; img.loading='lazy'; img.decoding='async'; img.className='video-thumb';
        thumb.appendChild(img);
        const play = document.createElement('span'); play.className='video-play'; play.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true"><path d="M8 5v14l11-7z" fill="rgba(255,255,255,0.9)"/></svg>';
        thumb.appendChild(play);
        thumb.addEventListener('click', ()=>{
          const iframe = document.createElement('iframe');
          iframe.width = '560'; iframe.height = '315';
              iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&autoplay=1';
          iframe.title = video.title || 'YouTube video';
          iframe.setAttribute('frameborder','0'); iframe.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
          iframe.allowFullscreen = true;
          aspect.replaceChild(iframe, thumb);
        });
        aspect.appendChild(thumb);
      }
      container.appendChild(aspect);
      if (video.title){ const cap = document.createElement('div'); cap.className='media-caption'; cap.textContent = video.title; container.appendChild(cap); }
      return container;
    }

    // Main renderer: accepts article object and target DOM node
    function renderArticle(article, target){
      if (!target) return;
      target.innerHTML = '';
      // If structured content is provided, use it (ordered)
      const hasBodyBlocks = Array.isArray(article.body_blocks) && article.body_blocks.length;
      if (hasBodyBlocks){
        article.body_blocks.forEach(block=>{
          if (!block) return;
          if (block.type === 'paragraph') target.appendChild(renderParagraph(block));
          else if (block.type === 'image') target.appendChild(createFigure(block));
          else if (block.type === 'gallery' && Array.isArray(block.items)) target.appendChild(renderGallery(block.items));
          else if (block.type === 'video' && block.url) target.appendChild(createLazyYouTubeEmbed(block));
        });
      } else {
        // Fallbacks: body_html > body string
        if (article.body_html){
          // preserve existing HTML but ensure links have security attrs
          const wrapper = document.createElement('div'); wrapper.innerHTML = article.body_html;
          // enhance anchors
          wrapper.querySelectorAll('a[href]').forEach(a=>{
            try{ const u = new URL(a.href, location.href); if (u.origin !== location.origin){ a.target='_blank'; a.rel='noopener noreferrer'; } }catch(e){}
          });
          // Remove any raw iframes for safety (we prefer structured videos)
          wrapper.querySelectorAll('iframe').forEach(ifr=> ifr.parentNode && ifr.parentNode.removeChild(ifr));
          target.appendChild(wrapper);
        } else if (article.body){
          const p = document.createElement('p'); p.appendChild(linkifyTextToFragment(article.body)); target.appendChild(p);
        }
        // append top-level images/videos if present
        if (Array.isArray(article.images) && article.images.length){
          // if single image, render figure; if multiple, render gallery
          if (article.images.length === 1) target.appendChild(createFigure(article.images[0])); else target.appendChild(renderGallery(article.images));
        }
        if (Array.isArray(article.videos) && article.videos.length){
          article.videos.forEach(v=>{ if (v.type === 'youtube' && v.url) target.appendChild(createLazyYouTubeEmbed(v)); });
        }
      }
      // If the structured body didn't include media blocks, also append any top-level images/videos
      const bodyHasMediaBlocks = hasBodyBlocks && article.body_blocks.some(b=> ['image','gallery','video'].includes(b.type));
      if (!bodyHasMediaBlocks) {
        if (Array.isArray(article.images) && article.images.length){
          if (article.images.length === 1) target.appendChild(createFigure(article.images[0])); else target.appendChild(renderGallery(article.images));
        }
        if (Array.isArray(article.videos) && article.videos.length){
          article.videos.forEach(v=>{ if (v.type === 'youtube' && v.url) target.appendChild(createLazyYouTubeEmbed(v)); });
        }
      }
    }

    // expose renderer
    window.tsdNews = window.tsdNews || {};
    window.tsdNews.renderArticle = renderArticle;
  })();
