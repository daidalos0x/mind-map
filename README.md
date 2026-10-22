# Mind

[![release](https://img.shields.io/badge/release-v0.1.0-blue?style=for-the-badge)](https://github.com/phaethix/mind-map)
[![license](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-phaethix%2Fmind--map-181717?style=for-the-badge&logo=github)](https://github.com/phaethix/mind-map)
[![node](https://img.shields.io/badge/node-17%2B-blue?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![PRs](https://img.shields.io/badge/PRs-welcome-green?style=for-the-badge)](https://github.com/phaethix/mind-map/pulls)

A mind map app with a web editor and a Mac desktop app. Documents are `.xmind` files.

## Web

Use it online at https://phaethix.github.io/mind-map/.

```bash
cd web
npm ci
NODE_OPTIONS=--openssl-legacy-provider npm run serve
```

Open http://localhost:8080.

The web app uses Vue CLI 4. On Node 17 and newer, `NODE_OPTIONS=--openssl-legacy-provider` is required.

## Desktop

The Mac app is `Mind`. It stores files in `~/Documents/Mind`. New documents are named `未命名.xmind`.

Run the installed app:

```bash
open ~/Applications/Mind.app
```

Build it from this repo:

```bash
cd desktop
npm install
npm run build
```

The app bundle is written to `desktop/src-tauri/target/release/bundle/macos/Mind.app`.

For development, the desktop shell loads the web app:

```bash
cd desktop
npm install
npm run dev
```
