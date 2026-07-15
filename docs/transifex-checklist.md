Transifex Configuration Checklist

1) Integrations → GitHub
  - Connect your repository (TSD repo) via the Transifex GitHub integration or GitHub Actions.
  - Enable auto-commit of translations back to the repo.
  - Target branch: `main`.
  - Commit author: choose a bot/service user account.

2) Integrations → GitHub → "Add a path to your YAML configuration file" → point it at `transifex.yml`:
  - `git: filters:` entry for news articles — `filter_type: dir`, `source_file_dir: news-content/source/en`, `translation_files_expression: 'news-content/translations/<lang>'`.
  - `git: filters:` entry for shared UI strings — `filter_type: file`, `source_file: i18n/en/common.json`, `translation_files_expression: 'i18n/<lang>/common.json'`.
  - Use "Test configuration" in that same dialog to validate the YAML before applying.

3) Resources → Settings for JSON files
  - i18n type: JSON (KEYVALUEJSON or generic JSON depending on resource).
  - Translate file names: OFF.
  - Allow editing of source text identifiers / keys: OFF.
  - Only pull reviewed/proofread translations (avoid pulling drafts automatically).

4) Project Settings → Languages
  - Add target languages: `mrh`, `my`, etc.
  - If Transifex locale codes differ, add mappings in `transifex.yml` under `language_mapping`.

5) Workflow & Safety
  - Commit message template: e.g. `Add Transifex translations: %language%`.
  - Use a dedicated translations branch (optional) if you want manual review before merging to `main`.
  - Ensure webhooks or GitHub integration allow pushes from Transifex to trigger Cloudflare Pages builds.

6) Testing (quick end-to-end)
  - Push a new `news-content/source/en/news-xxx.json` file to the repo.
  - In Transifex, confirm the file appears under the `news` resource's source content.
  - Create/approve a translation for `mrh` (or mark as reviewed).
  - Confirm Transifex auto-commits `news-content/translations/mrh/news-xxx.json` to the `main` branch.
  - Verify Cloudflare Pages starts a build and the localized article is served after the next `npm run build`.

7) Notes to avoid mistakes
  - Do not enable file-name translation or allow translators to edit keys.
  - Keep article JSON schema stable (`slug`, `title`, `summary`, `body`, `date`).
  - Turn on Translation Memory & Glossary for consistency.
  - `news-content/source/en/*.json` articles use `KEYVALUEJSON`, so every field (including `id`, `slug`, `date`) is exposed as a translatable segment, not just `title`/`body_html`. Translators should leave non-text fields unchanged; switching the source files to Transifex's "Structured JSON" format (wrapping translatable fields as `{"string": "..."}`) would let Transifex exclude them automatically, if that becomes worth the source-file rework.
  - The legacy `tx` CLI reads `.tx/config` (INI format), not `transifex.yml` — only relevant if someone wires up the CLI separately from GitHub Sync; the GitHub Sync integration itself reads `transifex.yml` directly.
