# Mind

<a href="https://github.com/phaethix/mind-map/releases"><img src="https://img.shields.io/badge/release-v0.1.0-blue" alt="Release" /></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
<a href="https://github.com/phaethix/mind-map"><img src="https://img.shields.io/badge/GitHub-phaethix%2Fmind--map-181717?logo=github" alt="GitHub" /></a>
<a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-17%2B-blue?logo=nodedotjs&logoColor=white" alt="Node" /></a>
<a href="https://github.com/phaethix/mind-map/pulls"><img src="https://img.shields.io/badge/PRs-welcome-green" alt="PRs welcome" /></a>

A mind map app with a web editor and a Mac desktop app. Documents are `.xmind` files.

## Web

Use it online at https://phaethix.github.io/mind-map/.

```bash
cd web
npm ci
NODE_OPTIONS=--openssl-legacy-provider npm run serve
```

Open http://localhost:8080.

The toolbar includes Mermaid. It edits a `mindmap` diagram with a live preview, then applies it to the canvas. On the website, the AI key is entered in that window and stored only in the browser. The Mac app reads `baseUrl`, `model`, and `apiKey` from `ai.json` in its application support folder and does not show the key.

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
