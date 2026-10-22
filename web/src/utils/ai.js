import { chatCompletionsUrl } from '@/utils/mermaidMindmap'

class Ai {
  constructor(options = {}) {
    this.options = options

    this.baseData = {}
    this.controller = null
    this.currentChunk = ''
    this.content = ''
  }

  init(type = 'huoshan', options = {}) {
    // 火山引擎接口
    if (type === 'huoshan') {
      this.baseData = {
        api: options.api,
        method: options.method,
        headers: {
          Authorization: 'Bearer ' + options.key
        },
        data: {
          model: options.model,
          stream: true
        }
      }
    }
  }

  async request(data, progress = () => {}, end = () => {}, err = () => {}) {
    try {
      const res = await this.postMsg(data)
      const decoder = new TextDecoder()
      while (1) {
        const { done, value } = await res.read()
        if (done) {
          return
        }
        // 拿到当前切片的数据
        const text = decoder.decode(value)
        // 处理切片数据
        let chunk = this.handleChunkData(text)
        // 判断是否有不完整切片，如果有，合并下一次处理，没有则获取数据
        if (this.currentChunk) continue
        let isEnd = false
        const list = chunk
          .split('\n')
          .filter(item => {
            isEnd = item.includes('[DONE]')
            return !!item && !isEnd
          })
          .map(item => {
            return JSON.parse(item.replace(/^data:/, ''))
          })
        list.forEach(item => {
          this.content += item.choices
            .map(item2 => {
              return item2.delta.content
            })
            .join('')
        })
        progress(this.content)
        if (isEnd) {
          end(this.content)
        }
      }
    } catch (error) {
      console.log(error)
      // 手动停止请求不需要触发错误回调
      if (!(error && error.name === 'AbortError')) {
        err(error)
      }
    }
  }

  async postMsg(data) {
    this.controller = new AbortController()
    const res = await fetch(chatCompletionsUrl(this.baseData.api), {
      signal: this.controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.baseData.headers.Authorization
      },
      body: JSON.stringify({
        model: this.baseData.data.model,
        stream: true,
        messages: data.messages
      })
    })
    if (!res.ok) {
      let message = '请求失败'
      try {
        const payload = await res.json()
        message = (payload.error && payload.error.message) || message
      } catch (error) {
        message = '请求失败'
      }
      throw new Error(message)
    }
    return res.body.getReader()
  }

  handleChunkData(chunk) {
    chunk = chunk.trim()
    // 如果存在上一个切片
    if (this.currentChunk) {
      chunk = this.currentChunk + chunk
      this.currentChunk = ''
    }
    // 如果存在done,认为是完整切片且是最后一个切片
    if (chunk.includes('[DONE]')) {
      return chunk
    }
    // 最后一个字符串不为}，则默认切片不完整，保存与下次拼接使用（这种方法不严谨，但已经能解决大部分场景的问题）
    if (chunk[chunk.length - 1] !== '}') {
      this.currentChunk = chunk
    }
    return chunk
  }

  stop() {
    this.controller.abort()
    this.controller = new AbortController()
  }
}

export default Ai
