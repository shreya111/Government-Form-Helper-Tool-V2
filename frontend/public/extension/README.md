# FormWise Chrome Extension

AI-powered assistant for filling out Indian government forms, with a focus on the Passport Seva portal.

## Features

### 🎯 Field Help Tab
- **Real-time Field Detection**: Automatically detects form fields when you click or focus on them
- **Smart Context Extraction**: Intelligently extracts questions and labels from complex government website DOM structures
- **Required Field Tracker**: A progress bar shows how many mandatory fields are done; expand it to see what's missing and jump straight to the field
- **AI-Powered Guidance**: For text fields and complex choices, provides contextual advice and interactive recommendations
- **Interactive Questions**: For fields requiring clarification, asks questions to understand your situation and recommends the best option

### 💬 Chat Tab (NEW!)
- **Ask Anything**: General Q&A about the form, eligibility, documents, or confusing terms
- **Full Page Context**: AI has access to all visible text, form fields, instructions, and terms on the current page
- **Persistent Conversations**: Chat history is saved per website and persists throughout your session
- **Smart Recommendations**: Get guidance on requirements, document lists, and application processes

## Installation

1. Download the extension: `formwise-extension.zip`
2. Extract the ZIP file to a folder
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top-right corner)
5. Click "Load unpacked" and select the extracted extension folder
6. The extension icon will appear in your Chrome toolbar

## Usage

### Using Field Help

1. Navigate to the Passport Seva portal (or any supported government form website)
2. Click on any form field (input, select, textarea)
3. The AI helper panel will slide in from the right
4. View the detected question/label at the top
5. See AI-powered guidance:
   - **Dropdowns/Radio buttons**: Detected options are sent to the AI so it can recommend which one to pick
   - **Text fields**: Get advice on what to enter
   - **Complex fields**: Answer clarifying questions to get personalized recommendations

### Using Chat

1. With the helper panel open, click the **"Chat"** tab at the top
2. Type your question in the input box at the bottom
3. Examples:
   - "What documents do I need for a new passport?"
   - "Am I eligible for ECNR status?"
   - "What is the difference between re-issue and tatkal?"
   - "What should I write in the employment field if I'm a freelancer?"
4. The AI will respond based on the content and context of the current page
5. Your chat history is saved per website and persists across page refreshes

## Technical Details

- **Manifest Version**: 3
- **Permissions**: 
  - `activeTab`: To detect form fields on the current page
  - `storage`: To save chat history locally
- **Host Permissions**: 
  - `*.passportindia.gov.in/*`
  - `services1.passportindia.gov.in/*`
- **AI Model**: Gemini 2.5 Flash for intelligent guidance and chat
- **Architecture**:
  - `config.js`: Single place to set the backend API base URL (`FORMWISE_API_BASE_URL`)
  - `content.js`: Field detection (scored label discovery for tables / nested tables / radio groups / div layouts), required-field progress scan, MutationObserver for AJAX-loaded sections, and messaging with the panel iframe
  - `panel/`: The React panel (shared with the web demo at `frontend/src/panel/`) built by `yarn build:extension`; loaded in an iframe so page CSS/CSP cannot break it
  - `background.js`: Service worker for API communication (imports `config.js`)
  - `styles.css`: Iframe positioning + field highlight only
  - `icons/`: Toolbar icons and the bundled panel logo (`logo.png`)

### Building after UI changes

The panel UI lives once in `frontend/src/panel/`. After editing it run `cd frontend && yarn build:extension` — this bundles `panel/panel.js` + `panel/panel.css`, mirrors the extension to `frontend/public/extension/` (used by the mock page at `/mock-passport.html`) and rebuilds `formwise-extension.zip`.

### Testing without the live portal

Open `/mock-passport.html` on the FormWise site. It mimics Passport Seva's legacy HTML (nested tables, `<font>` labels, radio groups in separate cells, questions in a previous row, AJAX-loaded "Family Details") and loads the content script through a small dev shim, so detection can be verified without installing the extension. If the real extension is installed it takes precedence automatically.

### Changing the backend URL

Edit `FORMWISE_API_BASE_URL` in `config.js` and update the matching origin in `host_permissions` inside `manifest.json`, then reload the extension.

## Features by Tab

### Field Help Tab
- Auto-triggers on field focus/click
- Shows detected question
- Displays available options for select/radio
- Provides AI guidance for text fields
- Interactive questions with recommendations
- Warning messages about common mistakes

### Chat Tab
- Welcome screen with helpful prompts
- Chat message history with user/assistant bubbles
- Real-time page context extraction (form data + all visible text)
- Loading indicator while AI thinks
- Auto-scroll to latest message
- Persistent history per domain

## Privacy & Data

- **Local Storage Only**: Chat history is stored locally in your browser using Chrome's storage API
- **Page Context**: The extension reads visible text and form data on the current page to provide contextual assistance
- **API Calls**: Field help and chat queries are sent to the backend API for AI processing
- **No Personal Data Collection**: We do not collect or store your personal information from the forms

## Support

For issues, questions, or feature requests, please visit the project repository or contact support.

## Version

**v2.0.0** - Unified React panel (iframe) shared with the web demo, scored DOM label detection for legacy portals, AJAX-aware MutationObserver, required-field progress tracker with jump-to-field, mock Passport Seva test page
**v1.2.0** - Real FormWise icons, logo bundled locally, backend URL centralised in `config.js`
**v1.1.0** - Added Chat feature with full page context awareness and session persistence
