Cloudflare D1 integration for Updates & News

Overview
- We'll serve the Updates feed from a Cloudflare D1 database via a Pages Function at `/api/updates`.
- The client will fetch `/api/updates` and expects the D1-backed API to be the authoritative source for updates (no static fallback).

Steps to set up D1 and seed data
1. Create a D1 database in Cloudflare (Dashboard → Workers & D1 → Create database).
2. Use `wrangler` to connect and run the seed SQL:
   - Install wrangler: `npm install -g wrangler`
   - Authenticate: `wrangler login`
   - Use the seed SQL file: `wrangler d1 execute <DB_NAME> --file scripts/seed_updates.sql` (or paste SQL into the D1 UI query console).
   - If your Cloudflare database name is `tsd_updates`, you can seed remote with:
     `wrangler d1 execute tsd_updates --file scripts/seed_updates.sql --remote`
   - Or use the provided helper script: `./scripts/seed_d1.ps1 -DbName tsd_updates` (add `-UseRemote` to force remote)
3. Bind the D1 database to Pages as an environment variable named `UPDATES_DB` (Pages → Functions → Environment variables & Bindings → Add D1 binding with name `UPDATES_DB`).

   Example `wrangler.toml` snippet to bind `tsd_updates` to `UPDATES_DB`:

```toml
[[d1_databases]]
binding = "UPDATES_DB"
database_name = "tsd_updates"
```

If you add the binding to `wrangler.toml`, local `wrangler d1 execute UPDATES_DB --file scripts/seed_updates.sql` will work without `--remote`.

Deployment
- The Pages Function `functions/api/updates.js` will be deployed with your Pages site. Ensure the D1 binding is configured for the environment (production branch).
- After deployment, verify: `https://<your-site>/api/updates` returns JSON of updates. You can request a localized feed with `https://<your-site>/api/updates?lang=mrh` (supported: `en`, `my`, `mrh`) — the API will return title/summary/body as strings in the requested language and fall back to other languages when needed.

Notes
- Ensure the D1 table matches the seed SQL: `updates(id INTEGER PRIMARY KEY, date TEXT, title TEXT, summary TEXT, body TEXT)`.
- Title/summary/body are stored as JSON strings so the client can present language variants.
- Caching: the function sets a short Cache-Control header so the CDN will cache responses briefly (30s). Adjust as needed.
