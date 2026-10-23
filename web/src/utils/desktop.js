// 桌面端（Tauri）专用的小工具：网页版走不到这些分支
export function isDesktop() {
  return typeof window.__TAURI_INTERNALS__ !== 'undefined'
}

// macOS 的更新入口在应用菜单里，界面上不再重复放版本号和检查按钮
export function isMac() {
  return /Mac OS X|Macintosh/.test(navigator.userAgent)
}

export function invoke(command, args) {
  return window.__TAURI_INTERNALS__.invoke(command, args || {})
}
