Crowdin Configuration Checklist

1) Integrations → GitHub
  - Connect your repository (TSD repo).
  - Enable Auto-commit: ON.
  - Target branch: `main`.
  - Commit author: choose a bot/service user account.

2) Files → Verify file mappings (or confirm `crowdin.yml`):
  - Source pattern: `news/source/en/*.json`
  - Translation (export) pattern: `news/%locale%/%original_file_name%`
  - Confirm `preserve_hierarchy: true` is enabled.

3) Files → Settings for JSON files
  - File format: JSON.
  - Translate file names: OFF.
  - Allow editing of source text identifiers / keys: OFF.
  - Export only approved translations: ON (prevents drafts from being committed).

4) Project Settings → Languages
  - Add target languages: `mrh`, `my`, etc.
  - If Crowdin locale codes differ, add mappings in `crowdin.yml` under `language_mapping`.

5) Workflow & Safety
  - Commit message template: e.g. `Add Crowdin translations: %language%`.
  - Use a dedicated translations branch (optional) if you want manual review before merging to `main`.
  - Ensure webhooks or GitHub integration allow pushes from Crowdin to trigger Cloudflare Pages builds.

6) Testing (quick end-to-end)
  - Push a new `news/source/en/news-xxx.json` file to the repo.
  - In Crowdin, confirm the file appears under Sources.
  - Create/approve a translation for `mrh` (or mark as approved).
  - Confirm Crowdin auto-commits `news/mrh/news-xxx.json` to the `main` branch.
  - Verify Cloudflare Pages starts a build and the file is served at `/news/mrh/news-xxx.json`.

7) Notes to avoid mistakes
  - Do not enable file-name translation or allow translators to edit keys.
  - Keep article JSON schema stable (`slug`, `title`, `summary`, `body`, `date`).
  - Turn on Translation Memory & Glossary for consistency.
