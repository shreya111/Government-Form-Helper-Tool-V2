# FormWise — PRD

## Original problem statement
Chrome Extension (Manifest V3) + web demo that acts as a real-time AI consultant on Indian government form sites (Passport Seva). A glassmorphic side panel is injected into the page; focusing a field triggers AI advice ("Field Help" tab); a "Chat" tab answers free-form questions using page context. Deliverables: landing page, form simulator demo, downloadable extension zip.

## Architecture
- `backend/server.py` — FastAPI. `POST /api/form-help` (field_label, field_type, field_options, section_context, help_text, form_context), `POST /api/chat`, `GET /api/form-help/history`, `GET /api/extension/download`. Gemini 2.5 Flash via Emergent LLM key. Mongo only logs history.
- `frontend/src/pages/LandingPage.jsx` (`/`), `FormSimulator.jsx` (`/demo`).
- **Shared panel UI (single source of truth):** `frontend/src/panel/` — `HelperPanel.jsx`, `PanelHeader`, `PanelTabs`, `ProgressBar`, `FieldHelpTab`, `ChatTab`. Used directly by `/demo` and bundled for the extension.
- `frontend/src/extension-panel/index.jsx` — iframe bridge for the extension (postMessage `FW_*` protocol with content.js; API via `chrome.runtime.sendMessage`; chat history in `chrome.storage.local`).
- `frontend/scripts/build-extension.js` (`yarn build:extension`) — esbuild + Tailwind CLI → `extension/panel/panel.js|css`, mirrors extension to `frontend/public/extension/`, rebuilds `/app/formwise-extension.zip`. **Run after any change under `src/panel`, `src/extension-panel`, or `/app/extension`.**
- `extension/` — `manifest.json` (v2.0.0), `config.js` (API base URL), `background.js`, `content.js` (scored label detection, section/help-text capture, required-field progress scan, MutationObserver for AJAX, iframe messaging), `styles.css` (iframe + highlight only), `panel/` (built), `icons/`.
- Mock test page: `frontend/public/mock-passport.html` + `formwise-shim.js` (emulates chrome.* so content.js runs without the extension installed; real extension takes precedence).

## Implemented
- Previous sessions: Field Help + Chat tabs, Gemini guidance, FormWise rebrand, docs/voiceovers.
- 2026-06 (session 1): repo audit; rebuilt stale zip; real icons; logo bundled; `config.js`; dead code + `/api/status` removed; PRD created.
- 2026-06 (session 2): mock Passport Seva page; DOM detection overhaul; unified React panel in iframe; required-field progress tracker; backend accepts section/help context; landing title + testids. Testing agent iteration_2: 100% pass.
- 2026-06 (session 3a): one-click **Apply** for recommended dropdown/radio option (`FieldHelpTab` matches AI recommendation -> real option; demo via `handleChange`, extension via `FW_APPLY` -> `content.js applyValue()`). Build hardened: extension mirror trimmed + React devtools-hook stripped so `frontend/` stays lint-clean.
- 2026-06 (session 3b): **Document Intelligence + Autofill — V1 Phase 1** (tested, iteration_3 100%).
  - Auth: Emergent-managed Google sign-in. `backend/auth.py` (`/api/auth/session|me|logout`, cookie-first + Bearer). `App.js` AuthCallback on `location.hash`. `lib/docApi.js` (withCredentials).
  - Storage: `backend/storage_service.py` — Emergent object storage behind `StorageService` adapter; 24h TTL (`_ttl` index + `DOCUMENT_RETENTION_HOURS`).
  - Sources: `DocumentSource` ABC + active `ManualUploadSource`; `DigiLockerSource` disabled stub.
  - Extraction: `GeminiExtractionService` (behind `ExtractionService` adapter) — Gemini vision classifies + extracts ontology fields with per-field confidence; images resized, PDFs via `FileContentWithMimeType`; no fabrication (missing -> omitted).
  - Mapping: `doc_models.normalize_label` ontology + `FieldMappingService` (best-by-confidence, cross-doc conflict detection with alternatives).
  - API (`doc_router.py`, all auth+ownership): upload/list/get/extracted-data/process/classification PATCH/delete, autofill/preview, autofill/confirm; audit_events (value hashed) + analytics_events (no PII).
  - UI: shared `DocumentsTab.jsx` (consent gate, drag/drop multi-upload, processing/confidence, doc cards, Review&Autofill with editable values + confidence + source + conflict picker). Tabs = Field Help | Documents | Chat. Demo wires `webDocApi` + `applyAutofill` (select label->value, DD/MM/YYYY->date). Extension shows "available on web demo".
  - App-wide sign-in: `components/AuthButton.jsx` (sign in / avatar+name / sign out) in the landing nav and demo header; verified signed-out + signed-in on desktop and mobile.
  - Env: `APP_NAME, MAX_DOCUMENT_SIZE_MB, DOCUMENT_RETENTION_HOURS, ENABLE_DOCUMENT_AUTOFILL, ENABLE_DIGILOCKER, DOC_EXTRACTION_MODEL`.

## Phase 2 backlog (document autofill)
- Multi-document conflict UI polish (backend + review picker already exist; add dedicated conflict cards).
- English/Hindi UI localization layer.
- Form-requirement layer (`FormRequirement` config: which documents help this form).
- Docs: document-intelligence.md, autofill-architecture.md, privacy.md, security.md, future-digilocker-integration.md.
- Extension-context auth + `FW_APPLY_BATCH` so the packaged extension can autofill from documents (Phase 1 stubbed to web demo).
- Product metrics dashboards from analytics_events.

## Backlog
- P1: Verify on the live Passport Seva portal with the installed extension.
- P1: Speed up `/api/form-help` (LLM 15–30s; shorter prompt / caching by label).
- P2: E2E test suite for the extension on the mock page (Playwright).
- P2: Replace deprecated `@app.on_event`; tighten CORS.
