// 浏览器里不存在 Node 的 stream：sax 里是 `try { require('stream').Stream } catch {}`，
// 给它一个空模块即可，运行时那段代码本来就只在 Node 下有意义。
export default {}
