/**
 * Layout Component Loader
 * Dynamically loads header and footer components into pages
 * 
 * Usage: Include this script before other scripts in your HTML
 * Make sure you have:
 *   <div id="header"></div>  in your page where the header should appear
 *   <div id="footer"></div>  in your page where the footer should appear
 */
(function() {
  'use strict';

  /**
   * Load an HTML component into a container element
   * @param {string} componentPath - Path to the component HTML file
   * @param {string} containerId - ID of the container element
   * @returns {Promise<void>}
   */
  async function loadComponent(componentPath, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[Layout] Container #${containerId} not found`);
      return;
    }

    try {
      const response = await fetch(componentPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const html = await response.text();
      container.innerHTML = html;
    } catch (error) {
      console.error(`[Layout] Failed to load ${componentPath}:`, error);
      container.innerHTML = `<p style="color:red;">Failed to load ${containerId}</p>`;
    }
  }

  /**
   * Initialize layout components
   * Loads header and footer, then initializes their functionality
   */
  async function initLayout() {
    // Determine base path (for pages in subdirectories)
    const basePath = window.LAYOUT_BASE_PATH || '/';
    
    // Load components in parallel
    await Promise.all([
      loadComponent(`${basePath}components/header.html`, 'header'),
      loadComponent(`${basePath}components/footer.html`, 'footer')
    ]);

    // Dispatch event to signal components are loaded
    // Other scripts can listen for this to initialize their functionality
    document.dispatchEvent(new CustomEvent('layout:loaded'));
    
    // Initialize header functionality if available
    if (typeof window.initHeader === 'function') {
      window.initHeader();
    }

    // Initialize footer nav toggles if available
    if (typeof window.initFooterNav === 'function') {
      window.initFooterNav();
    }

    // Re-initialize i18n if available (to translate loaded components)
    if (typeof window.initI18n === 'function') {
      window.initI18n();
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayout);
  } else {
    initLayout();
  }

  // Expose for manual use if needed
  window.loadComponent = loadComponent;
  window.initLayout = initLayout;
})();
