document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('hero-slider');
  if (!container) return;

  const TRANSITION_MS = 3000; // fade duration
  const VISIBLE_MS = 4000; // visible time between transitions
  const totalIntervalFromAttr = parseFloat(container.getAttribute('data-interval'));
  const INTERVAL_MS = Number.isFinite(totalIntervalFromAttr) && totalIntervalFromAttr > 0
    ? Math.round(totalIntervalFromAttr * 1000)
    : TRANSITION_MS + VISIBLE_MS;

  // Minimal styles for the slider (keeps site look intact)
  const style = document.createElement('style');
  style.textContent = `
    #hero-slider{position:relative;width:100%;height:100%;min-height:220px}
    #hero-slider .slide{position:absolute;inset:0;opacity:0;transition:opacity ${TRANSITION_MS}ms ease;display:flex;align-items:center;justify-content:center}
    #hero-slider .slide img{width:100%;height:100%;object-fit:cover;display:block}
    #hero-slider .slide.active{opacity:1;z-index:2}
  `;
  document.head.appendChild(style);

  // Helper: parse a data attribute which may be JSON array or pipe-separated list
  function parseUrls(raw){
    let out = [];
    if (!raw) return out;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e){
      return raw.split('|').map(s => s.trim()).filter(Boolean);
    }
    return out;
  }

  function getUrlsForTheme(theme){
    // data-urls-light / data-urls-dark take priority, otherwise fallback to data-urls
    const lightRaw = container.getAttribute('data-urls-light') || '';
    const darkRaw = container.getAttribute('data-urls-dark') || '';
    if (theme === 'dark' && darkRaw) return parseUrls(darkRaw);
    if (theme === 'light' && lightRaw) return parseUrls(lightRaw);
    const raw = container.getAttribute('data-urls') || '';
    return parseUrls(raw);
  }

  // Build slides into container (clears previous)
  function buildSlides(urls){
    // clear
    container.innerHTML = '';
    if (!urls || !urls.length) urls = ['/assets/images/hero.jpeg'];
    urls = urls.slice(0, 8); // allow up to 8 images

    urls.forEach((u, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide' + (i === 0 ? ' active' : '');
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = container.getAttribute('data-alt') || 'Hero image';
      img.src = u;
      slide.appendChild(img);
      container.appendChild(slide);
    });

    // Auto-advance behavior (clears previous interval by storing on container)
    if (container._heroInterval) clearInterval(container._heroInterval);
    const slides = container.querySelectorAll('.slide');
    if (slides.length > 1) {
      let idx = 0;
      container._heroInterval = setInterval(() => {
        slides[idx].classList.remove('active');
        idx = (idx + 1) % slides.length;
        slides[idx].classList.add('active');
      }, INTERVAL_MS);
    }
  }

  // Initialize based on current theme
  const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
  buildSlides(getUrlsForTheme(initialTheme));

  // Listen for theme changes
  window.addEventListener('tsd:theme-changed', (e) => {
    const theme = (e && e.detail) ? e.detail : (document.documentElement.getAttribute('data-theme') || 'light');
    buildSlides(getUrlsForTheme(theme));
  });
});
