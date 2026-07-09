# ChatPulse Desktop Build

This is the first desktop packaging track for a Steam-style standalone app. It keeps the current React + Express product shape, but wraps it in Electron so the player opens `ChatPulse.exe` instead of a browser tab.

## What runs inside the app

- Electron opens a native desktop window.
- The main process starts the bundled Node runtime from `.runtime/node20`.
- Express serves the production React build from `client/dist`.
- Qdrant starts from `tools/qdrant/current/qdrant.exe` when available.
- SQLite data, uploads, TTS files, local vectors, Qdrant storage, and logs live under Electron `userData`.

Default Windows data path:

```text
%APPDATA%\ChatPulse
```

For smoke tests or build pipelines, override it with:

```powershell
$env:CHATPULSE_DESKTOP_USER_DATA_DIR="C:\path\to\temp-user-data"
```

## Existing local account import

On first desktop launch, the shell looks for an existing local workspace and imports it before starting Qdrant or Express. This is how a developer/local player can move from the browser stack into the desktop app without losing their account.

Import candidates:

- `CHATPULSE_DESKTOP_IMPORT_FROM`, when set.
- The source repo root during `desktop:dev`.
- The repo root beside `release/win-unpacked` when running an unpacked local build.
- `Documents/ChatPluse` or `Documents/ChatPulse`.

Copied data:

- `data/*`, excluding `data/qdrant` because desktop Qdrant stores that under `userData/qdrant`.
- `server/public/uploads/*`.
- `data/qdrant/*` into `userData/qdrant`.

The import only runs automatically when the desktop data directory has no `data/master.db`. Existing desktop data is not overwritten unless forced:

```powershell
$env:CHATPULSE_DESKTOP_FORCE_IMPORT="1"
```

To disable import entirely for tests:

```powershell
$env:CHATPULSE_DESKTOP_SKIP_IMPORT="1"
```

## Commands

```powershell
npm run desktop:dev
npm run desktop:pack
npm run desktop:dist
```

- `desktop:dev` builds the frontend and launches Electron from source.
- `desktop:pack` creates an unpacked Windows app in `release/win-unpacked`.
- `desktop:dist` creates an NSIS installer when the local signing/build environment allows it.

## Player-owned API keys

The desktop shell does not bundle provider keys. Players still configure their own model endpoints and API keys inside ChatPulse character/settings screens. The shell only creates a local session token so first launch does not depend on terminal-visible credentials.

## Current release notes

- The Windows pack applies the product icon and metadata, but skips code signing for local builds. Add proper signing before public distribution.
- ASAR integrity is disabled for this first package. Revisit this when Electron/electron-builder versions are pinned for release.
- Steamworks SDK, Steam Cloud, achievements, overlay integration, and depot scripts are not wired yet.
- Cold start can take tens of seconds because the backend initializes all plugins and Qdrant before showing the window.
