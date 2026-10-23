#!/bin/sh
# Makes `make` a one-command setup: installs whatever is missing, no sudo needed.
# Everything goes into the current user's home directory.
#
#   sh scripts/bootstrap.sh node   # node/npm only, enough for the web app
#   sh scripts/bootstrap.sh rust   # also ensure the Rust toolchain, needed for the macOS app
#
# The script is idempotent: anything already installed is only probed, never reinstalled.
set -eu

MODE="${1:-rust}"

if [ -t 1 ]; then
  C_INFO=$(printf '\033[36m')
  C_WARN=$(printf '\033[33m')
  C_ERR=$(printf '\033[31m')
  C_OFF=$(printf '\033[0m')
else
  C_INFO=''
  C_WARN=''
  C_ERR=''
  C_OFF=''
fi

info() { printf '%s[bootstrap]%s %s\n' "$C_INFO" "$C_OFF" "$1"; }
warn() { printf '%s[bootstrap]%s %s\n' "$C_WARN" "$C_OFF" "$1"; }
die() {
  printf '%s[bootstrap]%s %s\n' "$C_ERR" "$C_OFF" "$1" >&2
  exit 1
}

LOCAL_PREFIX="$HOME/.local"
LOCAL_BIN="$LOCAL_PREFIX/bin"
NODE_DIST="https://nodejs.org/dist/latest-v22.x"
MIN_NODE_MAJOR=14

mkdir -p "$LOCAL_BIN"
PATH="$LOCAL_BIN:$HOME/.cargo/bin:$PATH"
export PATH

install_node() {
  # 自动安装只认 macOS 的官方 tarball；Windows / Linux 上让用户自己装，
  # 否则会在下载地址解析那一步报一句跟真实原因无关的错。
  case "$(uname -s)" in
    Darwin) : ;;
    *)
      die "Automatic Node.js installation is macOS-only. Install Node.js ${MIN_NODE_MAJOR}+ from https://nodejs.org, then run make again."
      ;;
  esac

  if command -v curl >/dev/null 2>&1; then :; else
    die "curl is required to install Node.js automatically."
  fi

  case "$(uname -m)" in
    arm64) narch=arm64 ;;
    x86_64) narch=x64 ;;
    *) die "Unsupported CPU architecture: $(uname -m)" ;;
  esac

  info "Fetching Node.js LTS metadata..."
  shasums=$(curl -fsSL "$NODE_DIST/SHASUMS256.txt") ||
    die "Cannot reach nodejs.org. Check your network or proxy and try again."
  tarball=$(printf '%s\n' "$shasums" | grep -o "node-v[0-9][0-9.]*-darwin-$narch\.tar\.gz" | head -n 1)
  [ -n "$tarball" ] || die "Failed to resolve the Node.js download URL."

  folder=${tarball%.tar.gz}
  target="$LOCAL_PREFIX/opt/$folder"

  if [ ! -x "$target/bin/node" ]; then
    info "Downloading $tarball ..."
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    curl -fsSL "$NODE_DIST/$tarball" -o "$tmp/node.tar.gz" || die "Failed to download Node.js."
    mkdir -p "$LOCAL_PREFIX/opt"
    tar -xzf "$tmp/node.tar.gz" -C "$LOCAL_PREFIX/opt" || die "Failed to extract Node.js."
    rm -rf "$tmp"
    trap - EXIT
  fi

  ln -sf "$target/bin/node" "$LOCAL_BIN/node"
  ln -sf "$target/bin/npm" "$LOCAL_BIN/npm"
  ln -sf "$target/bin/npx" "$LOCAL_BIN/npx"
  hash -r 2>/dev/null || true
  info "node $(node -v) installed into $target"
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
    if [ "$major" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
      info "node $(node -v) is ready"
      return
    fi
    warn "node $(node -v) is too old, ${MIN_NODE_MAJOR}+ is required. Installing a separate copy."
  fi
  install_node
}

ensure_rust() {
  if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1; then
    info "$(cargo --version) is ready"
    return
  fi

  # Building Rust needs the system C toolchain
  if ! xcrun --find clang >/dev/null 2>&1; then
    warn "Xcode Command Line Tools are missing, opening the system installer..."
    xcode-select --install >/dev/null 2>&1 || true
    waited=0
    while [ "$waited" -lt 600 ]; do
      if xcrun --find clang >/dev/null 2>&1; then
        break
      fi
      sleep 5
      waited=$((waited + 5))
    done
    xcrun --find clang >/dev/null 2>&1 ||
      die "Command Line Tools are still missing. Finish the system dialog, then run make again."
    info "Command Line Tools are ready"
  fi

  info "Installing the Rust toolchain through rustup, this takes a minute or two..."
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' EXIT
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs -o "$tmp" ||
    die "Failed to download rustup. Check your network and try again."
  sh "$tmp" -y --profile minimal --no-modify-path || die "Rust installation failed."
  rm -f "$tmp"
  trap - EXIT
  hash -r 2>/dev/null || true

  command -v cargo >/dev/null 2>&1 ||
    die "Rust is installed but cargo is not on PATH ($HOME/.cargo/bin)."
  info "$(cargo --version) installed"
}

ensure_node
case "$MODE" in
  rust | desktop | all) ensure_rust ;;
esac
info "Environment check finished"
