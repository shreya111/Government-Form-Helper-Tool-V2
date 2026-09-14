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
- 2026-06 (session 2): mock Passport Seva page; DOM detection overhaul (label[for]/aria → row cells → column headers → previous-row questions → nested tables → div wrapper labels → containers; radio-group common-ancestor logic; option-label stripping; noise filtering; section + help-text capture; MutationObserver + history hooks); unified React panel in iframe; required-field progress tracker (bar + missing list + jump-to-field) in demo and extension; backend accepts section/help context; landing title + testids. Testing agent iteration_2: 100% pass.

## Backlog
- P1: Verify on the live Passport Seva portal with the installed extension (only mock page verified in-browser).
- P1: Speed up `/api/form-help` (LLM responses take 15–30s; consider shorter prompt / streaming / caching by label).
- P2: E2E test suite for the extension on the mock page (Playwright).
- P2: Replace deprecated `@app.on_event`; tighten CORS.
