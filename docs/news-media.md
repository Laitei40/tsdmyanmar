# News & Updates — Media Schema

This document describes the optional media fields and structured content supported by the News JSON format.

Supported fields (optional):

- `images`: array of image objects
  - `src` (string): public CDN URL (Cloudflare R2 + CDN recommended)
  - `alt` (string): descriptive alt text (required for accessibility)
  - `caption` (string): optional caption text

- `videos`: array of video objects
  - `type` (string): currently `youtube`
  - `url` (string): public YouTube URL (no raw iframe)
  - `title` (string): accessible title for the video

- `body_blocks`: ordered array of content blocks (preferred for structured content)
  - Block types:
    - `paragraph`: { type: "paragraph", text: "...", url?: "..." }
      - If `url` provided, the paragraph is rendered as a single clickable link.
      - Otherwise plain text is rendered with auto-linking for any HTTP/HTTPS URLs.
    - `image`: { type: "image", src: "...", alt: "...", caption?: "..." }
    - `gallery`: { type: "gallery", items: [ {src,alt,caption}, ... ] }
    - `video`: { type: "video", url: "https://www.youtube.com/watch?v=...", title: "..." }

Backward compatibility

- If `body_html` exists, it will be inserted (but raw iframes are removed for security).
- If only `body` (string) exists, the renderer will auto-link HTTP/HTTPS URLs.
- Top-level `images` and `videos` arrays are appended after textual content when `body_blocks` are not present.

Rendering rules

- External links open in a new tab with `rel="noopener noreferrer"`.
- Images use `loading="lazy"` and `decoding="async"`.
- Galleries display as a single-column stack on small screens and a 2-column grid on wider screens.
- YouTube videos are lazy-loaded via a clickable poster and embedded using `https://www.youtube-nocookie.com/embed/`.
- All images must include meaningful `alt` text for accessibility.

Example (minimal):

```
{
  "id": "news-002",
  "title": "Example",
  "date": "2026-01-01",
  "body_blocks": [
    { "type": "paragraph", "text": "Read the report:", "url": "https://example.org/report" },
    { "type": "image", "src": "https://cdn.tsdmyanmar.org/news/example.jpg", "alt": "Example image" },
    { "type": "video", "url": "https://www.youtube.com/watch?v=ABC123", "title": "Video" }
  ]
}
```

Notes on Cloudflare R2

- Store images in a public bucket and serve them through Cloudflare's CDN domain (no credentials in frontend).
- Use appropriate image sizes and caching headers at upload time to optimize bandwidth.

If you want, I can add a small CLI script to validate JSON files against these rules, but per constraints I won't add Node tooling unless you request it.
