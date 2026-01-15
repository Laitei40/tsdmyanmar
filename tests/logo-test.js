// Logo fallback manual test instructions
// 1) Start a local server (from repo root):
//    python -m http.server 8788
// 2) Open http://127.0.0.1:8788 in your browser.
// 3) Initial load: confirm the header `.brand-logo` uses a language-specific
//    asset (e.g. `/assets/images/logo/logo_en.svg`). If that file is missing,
//    the site must display `/assets/images/logo/logo.svg` as the visible logo.
// 4) Runtime language switch: change the `#site-lang-select` and confirm the
//    logo updates in-place to the selected language's logo. If that language
//    file fails to load, the visible logo must remain `/assets/images/logo/logo.svg`.
// 5) Fallback simulation: to test fallback behavior, temporarily rename a
//    language-specific file (for example `logo_my.svg` -> `logo_my.svg.bak`) and
//    repeat step 4 — the site must show the default `/assets/images/logo/logo.svg`.
// Note: This is a manual test because the site interaction requires a browser
// environment and network conditions for accurate validation.

