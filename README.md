<p align="center">
  <img src="./assets/icon/icon.svg" width="120" height="120" alt="Mind" />
</p>

<h1 align="center">Mind</h1>

<p align="center">A lightweight, minimal, and customizable mind map</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="https://github.com/phaethix/mind-map/releases"><img src="https://img.shields.io/github/v/release/phaethix/mind-map?label=release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Vue-2-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue" />
</p>

Documents are `.xmind` files, stored locally.

## Features

- **Lightweight** — Tauri 2 on the system WebView: 10 MB on macOS, ~70 MB RAM idle.
- **Local-first** — documents are plain `.xmind` files on disk, no account, nothing uploaded.
- **Two views of one document** — a classic mind map, or a Mermaid `mindmap` source with live preview.
- **Full editor** — 14 layouts, 50+ themes, dark mode, rich text, notes, tags, images, formulas and an outline view.
- **AI assisted** — generate a diagram from a prompt through your own OpenAI-compatible endpoint.

![Mind map](./assets/screenshots/mind-map.png)

_Mind map view_

![Mermaid mode](./assets/screenshots/mermaid.png)

_Mermaid view_

## Install

Prebuilt builds are on [Releases](https://github.com/phaethix/mind-map/releases).

| System                           | File                            |
| -------------------------------- | ------------------------------- |
| Windows 10 / 11 (x64)            | `Mind_<version>_x64-setup.exe`  |
| Ubuntu 22.04+ / Debian 12+ (x64) | `Mind_<version>_amd64.deb`      |
| Any distro with WebKitGTK 4.1    | `Mind_<version>_amd64.AppImage` |

The Windows build is unsigned, so the first launch needs **More info → Run anyway**. Linux builds use the system WebKitGTK 4.1 (Ubuntu 20.04 will not start), and the AppImage also needs `libfuse2`.

**macOS** — no prebuilt binary, build it locally:

```bash
make
```

## Build from source

| Item      | Detail                                                   |
| --------- | -------------------------------------------------------- |
| Requires  | Xcode Command Line Tools — `xcode-select --install`      |
| Toolchain | `scripts/bootstrap.sh` installs Node and Rust if missing |
| Install   | `make`; `Mind.app` ends up in `~/Applications`           |
| Documents | `~/Documents/Mind`                                       |

```bash
make open      # launch the installed app
make desktop   # build only
make dev       # run against the local dev server
make bootstrap # toolchain only
```

## AI

AI generation reads `baseUrl`, `model` and `apiKey` from `ai.json` in the app config folder.

## Credits

- Built on [SimpleMindMap](https://github.com/wanglin2/mind-map) by [wanglin2](https://github.com/wanglin2) — MIT, notice kept in [LICENSE](./LICENSE).
- From upstream: the editor, the `simple-mind-map/` engine, the themes and most icons.
- Added by this fork: the Tauri shell, dark mode, Mermaid authoring, AI generation and a local file library.
