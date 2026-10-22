.DEFAULT_GOAL := install

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
CARGO_TARGET_DIR ?= $(ROOT)/desktop/src-tauri/target
APP := $(CARGO_TARGET_DIR)/release/bundle/macos/Mind.app
INSTALL_DIR := $(HOME)/Applications

.PHONY: help web desktop dev install open

help:
	@printf '%s\n' \
		'make            Build Mind.app and copy it to ~/Applications' \
		'make desktop    Build Mind.app only' \
		'make dev        Run the desktop shell against the local web app' \
		'make web        Run the web app at http://localhost:8080' \
		'make open       Open ~/Applications/Mind.app'

web/node_modules: web/package.json web/package-lock.json
	cd web && npm ci
	@touch $@

desktop/node_modules: desktop/package.json desktop/package-lock.json
	cd desktop && npm ci
	@touch $@

# md4 兼容由 web/build/md4-fallback.js 在构建进程内处理，不再需要 NODE_OPTIONS
web: web/node_modules
	cd web && npm run serve

desktop: web/node_modules desktop/node_modules
	@command -v cargo >/dev/null || { echo 'Install Rust first: https://rustup.rs'; exit 1; }
	cd desktop && npm run build

dev: web/node_modules desktop/node_modules
	@command -v cargo >/dev/null || { echo 'Install Rust first: https://rustup.rs'; exit 1; }
	cd desktop && npm run dev

install: desktop
	mkdir -p "$(INSTALL_DIR)"
	rm -rf "$(INSTALL_DIR)/Mind.app"
	ditto "$(APP)" "$(INSTALL_DIR)/Mind.app"

open:
	open "$(INSTALL_DIR)/Mind.app"
