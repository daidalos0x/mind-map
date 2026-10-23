.DEFAULT_GOAL := install

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
CARGO_TARGET_DIR ?= $(ROOT)/desktop/src-tauri/target
APP := $(CARGO_TARGET_DIR)/release/bundle/macos/Mind.app
INSTALL_DIR := $(HOME)/Applications

# bootstrap installs node and rust into the home directory; make sure later steps see them
export PATH := $(HOME)/.local/bin:$(HOME)/.cargo/bin:$(PATH)

.PHONY: help bootstrap bootstrap-node web desktop dev install open

help:
	@printf '%s\n' \
		'make             check the toolchain, build Mind.app, install it to ~/Applications' \
		'make web         run the web app at http://localhost:8080' \
		'make desktop     build Mind.app without installing' \
		'make dev         run the desktop shell against the local web app' \
		'make open        open ~/Applications/Mind.app' \
		'make bootstrap   only check/install the toolchain, do not build'

# Check the toolchain only, installing whatever is missing
bootstrap:
	@sh scripts/bootstrap.sh rust

bootstrap-node:
	@sh scripts/bootstrap.sh node

# npm prints a warn line for every deprecated transitive dependency of the vue-cli 4
# toolchain. Those cannot be fixed from this repository, so keep the install quiet
# and let only errors through.
# 只认 lockfile：改 package.json 的脚本之类不该触发整包重装
web/node_modules: bootstrap-node web/package-lock.json
	@printf '  web: installing dependencies...\n'
	@cd web && npm ci --no-audit --no-fund --loglevel=error
	@touch $@

desktop/node_modules: desktop/package-lock.json
	@printf '  desktop: installing dependencies...\n'
	@cd desktop && npm ci --no-audit --no-fund --loglevel=error
	@touch $@

web: web/node_modules
	cd web && npm run serve

desktop: bootstrap web/node_modules desktop/node_modules
	@# 构建产物里也有一份 Mind.app，Spotlight 会把它当成第二个应用；让 Spotlight 跳过 target/
	@mkdir -p desktop/src-tauri/target && touch desktop/src-tauri/target/.metadata_never_index
	cd desktop && npm run build

dev: bootstrap web/node_modules desktop/node_modules
	cd desktop && npm run dev

install: desktop
	mkdir -p "$(INSTALL_DIR)"
	rm -rf "$(INSTALL_DIR)/Mind.app"
	ditto "$(APP)" "$(INSTALL_DIR)/Mind.app"
	@printf 'Installed %s/Mind.app\n' "$(INSTALL_DIR)"

open:
	open "$(INSTALL_DIR)/Mind.app"
