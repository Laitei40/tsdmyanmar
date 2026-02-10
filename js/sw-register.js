/**
 * TSD Myanmar — Service Worker Registration
 * Registers sw.js and handles update + offline-ready events.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      // Check for SW updates every 30 minutes while the page is open
      setInterval(function () { reg.update(); }, 30 * 60 * 1000);

      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // A new version is available — show a subtle toast
            showOfflineToast('Site updated — refresh for the latest version.', 'update');
          }
        });
      });

      // If the SW is already active and controlling, the page is available offline
      if (reg.active && navigator.serviceWorker.controller) {
        console.log('[TSD] Offline-ready: pages are cached for offline use.');
      }
    }).catch(function (err) {
      console.warn('[TSD] SW registration failed:', err);
    });
  });

  // Listen for connectivity changes
  window.addEventListener('online', function () {
    showOfflineToast('You are back online.', 'online');
  });

  window.addEventListener('offline', function () {
    showOfflineToast('You are offline — cached pages are still available.', 'offline');
  });

  /**
   * Show a small non-blocking toast notification.
   * @param {string} message
   * @param {'offline'|'online'|'update'} type
   */
  function showOfflineToast(message, type) {
    // Remove any existing toast first
    var existing = document.getElementById('tsd-sw-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'tsd-sw-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    // Inline styles so it works without extra CSS
    var bg = type === 'offline' ? '#e65100' : type === 'online' ? '#2e7d32' : '#1565c0';
    toast.style.cssText =
      'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);' +
      'background:' + bg + ';color:#fff;padding:.75rem 1.5rem;border-radius:8px;' +
      'font-size:.875rem;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,.25);' +
      'transition:opacity .4s ease;opacity:0;pointer-events:none;' +
      'max-width:90vw;text-align:center;';

    document.body.appendChild(toast);

    // Fade in
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
    });

    // Auto-dismiss after 4 seconds
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 500);
    }, 4000);
  }
})();
