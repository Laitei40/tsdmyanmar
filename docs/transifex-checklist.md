Transifex Configuration Checklist

1) Integrations → GitHub
  - Connect your repository (TSD repo) via the Transifex GitHub integration or GitHub Actions.
  - Enable auto-commit of translations back to the repo.
  - Target branch: `main`.
  - Commit author: choose a bot/service user account.

2) Resources → Verify file mappings (or confirm `transifex.yml` / `.tx/config`):
  - Source pattern: `news-content/source/en/*.json`
  - Translation (export) pattern: `news-content/translations/%locale%/%original_file_name%`
  - Confirm `preserve_hierarchy: true` is enabled.

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
  - The `tx` CLI reads `.tx/config` (INI format), not `transifex.yml` — if you wire up the CLI, mirror the resource mappings from `transifex.yml` into `.tx/config`.
