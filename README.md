<p align="center">
  <img src="./assets/icon/icon.svg" width="120" height="120" alt="Mind" />
</p>

<h1 align="center">Mind</h1>

<p align="center">A lightweight, minimal, and customizable mind map</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="https://github.com/phaethix/mind-map/releases"><img src="https://img.shields.io/github/v/release/phaethix/mind-map?label=release" alt="Release" /></a>
</p>

Documents are `.xmind` files, stored locally.

## Install

**Windows / Linux** — download from [Releases](https://github.com/phaethix/mind-map/releases):

| System | File |
| --- | --- |
| Windows 10 / 11 (x64) | `Mind_<version>_x64-setup.exe` |
| Ubuntu 22.04+ / Debian 12+ (x64) | `Mind_<version>_amd64.deb` |
| Any distro with WebKitGTK 4.1 | `Mind_<version>_amd64.AppImage` |

The Windows installer is unsigned, so the first launch asks for **More info → Run anyway**. It installs per user and fetches WebView2 automatically. On Linux the app uses the system WebKitGTK 4.1, which older releases such as Ubuntu 20.04 do not have; the AppImage also needs `libfuse2`.

**macOS** — no prebuilt binary, build it locally:

```bash
make
```

## Build from source

The only prerequisite is the Xcode Command Line Tools (`xcode-select --install`). Node and Rust are installed into your home directory by `scripts/bootstrap.sh` when missing — no `sudo`, no Homebrew. `make` builds `Mind.app` into `~/Applications`; documents live in `~/Documents/Mind` and new files are named `未命名.xmind`.

```bash
make open      # launch the installed app
make desktop   # build only
make dev       # run against the local dev server
make bootstrap # toolchain only
```

### Icon

```bash
cd desktop && npx tauri icon ../assets/icon/icon.svg
```

A private icon can be dropped at `assets/icon/local/icon.icns` (or `icon.png`); it is git-ignored and only applied to local builds.

## AI

AI generation reads `baseUrl`, `model` and `apiKey` from `ai.json` in the app config folder.

## Credits

A fork of [SimpleMindMap](https://github.com/wanglin2/mind-map) by [wanglin2](https://github.com/wanglin2), MIT licensed — the notice is kept in [LICENSE](./LICENSE). The editor, the `simple-mind-map/` engine, the themes and most icons come from that project. This fork adds the Tauri shell, dark mode, Mermaid authoring, AI generation and a local file library.
