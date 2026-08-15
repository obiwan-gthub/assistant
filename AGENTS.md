# AGENTS.md — Cursor Agent Guidelines

Instructions for AI agents working on this repository.

## Project context

Personal assistant running on a **Raspberry Pi**, built as a father/son learning project. Each development step must produce a **visible, testable result** on hardware (TFT screen, microphone, LED).

Key docs:

- [ARCHITECTURE.md](ARCHITECTURE.md) — technical reference (API, modules, WebSocket, deployment)
- [project.md](project.md) — step-by-step pedagogical guide
- [trame.md](trame.md) — Pi setup procedures

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, FastAPI, uvicorn |
| Frontend | Vanilla HTML, CSS, JavaScript — **no React, no npm, no build step** |
| Real-time | WebSocket (`/ws`) |
| Voice | Whisper (local STT), optional Piper TTS |
| AI | Anthropic Claude API |
| Weather | Open-Meteo (no API key) |

## Repository layout

```
backend/main.py          # FastAPI entry point — run uvicorn from backend/
backend/modules/         # one file per module, implements Module ABC
backend/tests/           # hardware tests (mic, etc.)
frontend/                # index.html, style.css, app.js
deploy/                  # systemd and autostart templates (Phase 4)
```

## Code conventions

- **Code**: English
- **Comments**: French
- **User-facing UI strings**: French
- **Minimal diffs**: do not refactor unrelated code
- **No over-engineering**: no extra abstractions, no heavy dependencies without Pi justification
- **No secrets in code**: use environment variables (`ANTHROPIC_API_KEY`, `LAT`, `LON`)


## Module architecture

Every feature module lives in `backend/modules/` and implements the `Module` contract:

```python
class Module(ABC):
    name: str = "base"

    def can_handle(self, query: str) -> bool: ...
    def run(self, query: str) -> dict: ...
```

Rules:

1. Register new modules in `main.py` via `ModuleRegistry.register()`
2. Never bypass the registry for user queries — route through `dispatch()`
3. Register `AIModule` **last** (fallback: `can_handle` always returns `True`)
4. Return flat JSON-serializable dicts from `run()`; the registry adds `"module": "<name>"`

Planned modules: `clock`, `weather`, `audio_test`, `ai`.

`AudioTestModule` also exposes `record(text)` — called on every `/voice` request before dispatch.

## Frontend navigation

Single-page app with one visible panel at a time. Manual navigation via `#nav-bar`:

| Page ID | Nav label | Source |
|---|---|---|
| `clock` | Horloge | WebSocket `type: "clock"` |
| `weather` | Météo | `fetch("/ask?q=météo")` on page show |
| `assistant` | Assistant | `/voice` + `module_result` |
| `audio_test` | Test | WebSocket `type: "audio_message"` + `GET /audio-log` |

Key JS functions: `showPage(pageId)`, `onPageShow(pageId)`.

Do not create separate HTML files or client-side routers.

## WebSocket message types

| `type` | Purpose |
|---|---|
| `clock` | Live time tick from ClockModule |
| `module_result` | Dispatch result — auto-switch to module page |
| `audio_message` | STT transcription — append to `#audio-log` |

## Development commands

```bash
# Start server (from repo root)
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# Microphone test (on Pi with sounddevice installed)
source ~/assistant-env/bin/activate
python backend/tests/mic_test.py
aplay test.wav

# Text dispatch (once /ask is implemented)
curl "http://localhost:8000/ask?q=heure"
```

Always run uvicorn from `backend/` — static files use relative path `../frontend`.

## What to avoid

- Adding React, Vue, npm, or bundlers
- Committing `.env`, API keys, or credentials
- Large refactors of working code without explicit request
- Framework-style abstractions for one-off helpers
- Tests that only assert trivial behavior unless requested

## Implementation phases

Work incrementally; each phase has a validation test documented in [ARCHITECTURE.md](ARCHITECTURE.md):

| Phase | Deliverable |
|---|---|
| 0 | ARCHITECTURE.md, AGENTS.md *(this file)* |
| 1 | Module registry + `/ask` |
| 1b | ClockModule + WebSocket refactor |
| 2a | Multi-page nav (4 pages) |
| 2b | WeatherModule |
| 3a | AudioTestModule + `/voice` + `/audio-log` |
| 3b | AIModule (STT, Claude) |
| 4 | deploy/ templates (systemd, kiosk autostart) |

When adding a module, update both the backend registry and the corresponding frontend page.
