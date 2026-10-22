# Mind

<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
<a href="https://github.com/phaethix/mind-map"><img src="https://img.shields.io/badge/GitHub-phaethix%2Fmind--map-181717?logo=github" alt="GitHub" /></a>
<a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-17%2B-blue?logo=nodedotjs&logoColor=white" alt="Node" /></a>
<a href="https://github.com/phaethix/mind-map/pulls"><img src="https://img.shields.io/badge/PRs-welcome-green" alt="PRs welcome" /></a>

A mind map app with a web editor and a Mac desktop app. Documents are `.xmind` files.

Built on [SimpleMindMap](https://github.com/wanglin2/mind-map) by [wanglin2](https://github.com/wanglin2),
MIT licensed — its copyright notice is kept in [LICENSE](./LICENSE). The editor, the engine in
`simple-mind-map/`, the themes and most icon assets come from that project. This fork adds the
Vue 2 web build, the Tauri macOS app, dark mode, Mermaid authoring, AI generation and a local
file library.

## Web

Use it online at https://phaethix.github.io/mind-map/.

```bash
make web
```

Open http://localhost:8080. Node.js is installed automatically if it is missing.

The toolbar includes Mermaid. It edits a `mindmap` diagram with a live preview, then applies it to the canvas. On the website, the AI key is entered in that window and stored only in the browser. The Mac app reads `baseUrl`, `model`, and `apiKey` from `ai.json` in its application support folder and does not show the key.

The web app uses Vue CLI 4, which hashes with md4. OpenSSL 3 dropped that algorithm, so
`web/build/md4-fallback.js` transparently substitutes sha256 at build time. No extra
environment variables are needed, and `NODE_OPTIONS=--openssl-legacy-provider` is no longer
required.

## Desktop

The Mac app is `Mind`. It stores files in `~/Documents/Mind`. New documents are named `未命名.xmind`.

There are no prebuilt binaries. The only manual prerequisite is the Xcode Command Line Tools
(`xcode-select --install`) — `git` and `make` both come from it, so you already have it if you
managed to clone this repository. Everything else is handled for you.

Clone the repository and run:

```bash
make
```

That single command is all you need. If Node.js, Rust or the Xcode Command Line Tools are missing,
`scripts/bootstrap.sh` installs what it can into your home directory — no `sudo`, no Homebrew
required — and then builds `Mind.app` into `~/Applications`.

```bash
make open      # launch the installed app
make desktop   # build only, do not install
make bootstrap # check/install the toolchain and exit
```

`make dev` runs the desktop shell against the local web app.
