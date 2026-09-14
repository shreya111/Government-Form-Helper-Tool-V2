# FormWise — PRD

## Original problem statement
Chrome Extension (Manifest V3) + web demo that acts as a real-time AI consultant on Indian government form sites (Passport Seva). A glassmorphic side panel is injected into the page; focusing a field triggers AI advice ("Field Help" tab); a "Chat" tab answers free-form questions using page context. Deliverables: landing page, form simulator demo, downloadable extension zip.

## Architecture
- `backend/server.py` — FastAPI. `POST /api/form-help`, `POST /api/chat`, `GET /api/form-help/history`, `GET /api/extension/download`. Gemini 2.5 Flash via Emergent LLM key (`emergentintegrations`). Mongo only logs history.
- `frontend/src/pages/LandingPage.jsx` (`/`), `FormSimulator.jsx` (`/demo`, contains inline AIHelperPanel + form).
- `extension/` — `manifest.json`, `config.js` (API base URL), `background.js` (service worker, `importScripts('config.js')`), `content.js` (DOM detection + panel UI), `styles.css`, `icons/` (icon16/48/128 + `logo.png` via web_accessible_resources).
- `/app/formwise-extension.zip` — built with `cd /app && zip -rq formwise-extension.zip extension`. MUST be rebuilt after any extension change.
- UI parity: panel UI exists twice (FormSimulator.jsx and content.js/styles.css).

## Implemented
- Field Help + Chat tabs, Gemini guidance, rebranding to FormWise, README/MASTER_PROMPT/voiceover docs (previous sessions).
- 2026-06 (this session): repo audit; rebuilt stale zip (was pointing at old `formaid` preview URL); real FormWise icons generated from `formwise-logo.png`; logo bundled locally; API URL centralised in `extension/config.js`; removed dead `components/AIHelperPanel.jsx` & `PassportForm.jsx`; removed boilerplate `/api/status` endpoints; finished Government Form Helper → FormWise rename; `backend_test.py` updated (5/5 pass); extension v1.2.0.

## Backlog
- P0: DOM detection overhaul in `extension/content.js` (scoring-based label discovery, table/column headers, previous-row questions, aria-labelledby, section headings, MutationObserver for AJAX transitions; send section context to backend). User chose to defer this.
- P1: Mock Passport-Seva-style test page for extension verification; E2E tests for extension.
- P2: Unify panel UI between React demo and extension; replace deprecated `@app.on_event`; tighten CORS.
