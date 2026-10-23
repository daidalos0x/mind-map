.DEFAULT_GOAL := install

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
CARGO_TARGET_DIR ?= $(ROOT)/desktop/src-tauri/target
APP := $(CARGO_TARGET_DIR)/release/bundle/macos/Mind.app
INSTALL_DIR := $(HOME)/Applications
LSREGISTER := /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

# bootstrap installs node and rust into the home directory; make sure later steps see them
export PATH := $(HOME)/.local/bin:$(HOME)/.cargo/bin:$(PATH)

# Windows 上 node 自带的 npm 没有扩展名，是个 bash 脚本（shebang: #!/usr/bin/env bash）。
# 某些 POSIX 层（比如 cygwin）无法直接 exec 它，会报
# "/cygdrive/.../npm: No such file or directory" —— 这是 execve 找不到解释器，
# 不是文件不存在。交给 sh 去读文件执行就跳过了 shebang 查找。
# macOS / Linux 没有这个问题，仍直接调用 npm。
#
# 局限：这里只覆盖官方安装包带的那个无扩展名脚本。nvm-windows、scoop 这类
# 只提供 npm.cmd 的环境不在覆盖范围内。
ifeq ($(OS),Windows_NT)
NPM = sh "$$(command -v npm)"
else
NPM = npm
endif

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
# bootstrap-node 是伪目标，每次都会"更新"；当普通前置依赖会让这条规则永远重跑
# npm ci。改成 order-only，只保证顺序，不参与时间戳比较。
web/node_modules: web/package-lock.json | bootstrap-node
	@printf '  web: installing dependencies...\n'
	@cd web && $(NPM) ci --no-audit --no-fund --loglevel=error
	@touch $@

desktop/node_modules: desktop/package-lock.json
	@printf '  desktop: installing dependencies...\n'
	@cd desktop && $(NPM) ci --no-audit --no-fund --loglevel=error
	@touch $@

web: web/node_modules
	cd web && $(NPM) run serve

desktop: bootstrap web/node_modules desktop/node_modules
	@# 构建产物里也有一份 Mind.app，Spotlight 会把它当成第二个应用；让 Spotlight 跳过 target/
	@mkdir -p desktop/src-tauri/target && touch desktop/src-tauri/target/.metadata_never_index
	cd desktop && $(NPM) run build

dev: bootstrap web/node_modules desktop/node_modules
	cd desktop && $(NPM) run dev

install: desktop
	mkdir -p "$(INSTALL_DIR)"
	rm -rf "$(INSTALL_DIR)/Mind.app"
	ditto "$(APP)" "$(INSTALL_DIR)/Mind.app"
	@# 构建产物里的那份副本会被 LaunchServices 和 Spotlight 一并收进去，
	@# "打开方式" 里就会出现两个 Mind。装完直接删掉，并解除注册。
	@-$(LSREGISTER) -u "$(APP)" >/dev/null 2>&1 || true
	@rm -rf "$(APP)"
	@printf 'Installed %s/Mind.app\n' "$(INSTALL_DIR)"

open:
	open "$(INSTALL_DIR)/Mind.app"
