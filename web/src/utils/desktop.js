// 桌面端（Tauri）专用的小工具：网页版走不到这些分支
export function isDesktop() {
  return typeof window.__TAURI_INTERNALS__ !== 'undefined'
}

export function invoke(command, args) {
  return window.__TAURI_INTERNALS__.invoke(command, args || {})
}
