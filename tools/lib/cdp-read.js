// @ts-check
/** 验收工具的 CDP 只读连接：仅查询页面，不发送输入或修改 DOM。Node 22+。 */

/** 连接一张页面，连接与单次查询各最多等三秒。 */
export async function connectPage(endpoint, target) {
  const address = new URL(target.webSocketDebuggerUrl)
  address.host = new URL(endpoint).host
  const socket = new WebSocket(address)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connection timed out')) }, 3000)
    socket.onopen = event => { clearTimeout(timer); resolve(event) }
    socket.onerror = event => { clearTimeout(timer); reject(event) }
  })
  let sequence = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data)), request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
  }
  return {
    /** @returns {Promise<any>} */
    read(expression) {
      return new Promise((resolve, reject) => {
        const id = ++sequence
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP read timed out')) }, 3000)
        pending.set(id, {
          resolve: result => { clearTimeout(timer); result.exceptionDetails ? reject(new Error(JSON.stringify(result.exceptionDetails))) : resolve(result.result.value) },
          reject: error => { clearTimeout(timer); reject(error) },
        })
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
      })
    },
    close() { socket.close() },
  }
}

/** 找指定角色的页面；没有匹配必须失败，不能输出空报告当作通过。 */
export async function connectRole(endpoint, role) {
  const targets = await (await fetch(endpoint + '/json/list', { signal: AbortSignal.timeout(3000) })).json()
  for (const target of targets.filter(target => target.type === 'page')) {
    const page = await connectPage(endpoint, target)
    if (await page.read('window.piggyShell?.role') === role) return page
    page.close()
  }
  throw new Error(`CDP page not found: ${role}`)
}
