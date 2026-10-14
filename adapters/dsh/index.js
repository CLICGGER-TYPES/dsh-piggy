// @ts-check
/** DSH 只负责宿主事件、服务注册和默认位置，游戏规则与持久化由运行时负责。 */
import { randomUUID } from 'node:crypto'
import { createGameRuntime } from '../../runtime/index.js'
import { defaultStatePath, moveLegacySaveDir } from '../../store/state-file.js'
import { environmentNote } from '../../environment.js'

export const name = 'dsh-piggy'
export const inject = []

export function apply(ctx, config = {}) {
  const command = typeof config.command === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(config.command)
    ? config.command : 'pig'
  const customPath = typeof config.statePath === 'string' && config.statePath.trim() !== ''
  if (!customPath) moveLegacySaveDir()
  const statePath = customPath ? config.statePath : defaultStatePath()
  const runtime = createGameRuntime({ statePath, journalHeader: environmentNote({
    运行形态: 'DSH 插件', 存档路径: statePath, DSH_HOME: process.env.DSH_HOME ?? '', Node: process.version,
  }) })
  // 当前 DSH 回调未提供已核实的持久身份，保留每次真实回调计数的原行为。
  const producer = randomUUID()
  let sequence = 0
  const observe = type => {
    try { runtime.acceptWorkEvent({ version: 1, source: 'dsh', id: `${producer}:${++sequence}`, type, at: Date.now() }) }
    catch (error) { console.warn('[dsh-piggy] DSH work event failed; evidence preserved') }
  }
  ctx.on('agent/inbox/claimed', () => observe('message'))
  ctx.on('agent/turn-stopping', () => observe('turn'))
  ctx.on('agent/error', () => observe('agentError'))
  ctx.on('tools/result', (exec, result) => observe(result?.isError === true ? 'toolError' : 'tool'))
  ctx.inject(['webServer'], webCtx => webCtx.webServer ? runtime.mountRoutes(webCtx.webServer) : () => {})
  ctx.inject(['commands'], commandCtx => commandCtx.commands.register({
    name: command,
    description: 'your pig 🐖: status · study · work · shop · travel · bag',
    input: { hint: '[hatch|feed|bathe|play|pet|study <科目>|work <job>|trip <目的地>|shop|buy|use|weigh|about]' },
    handler: invocation => {
      try { return runtime.dispatchCommand(command, String(invocation.rawInput ?? '')) }
      catch (error) { return { kind: 'error', text: `🐖 猪摔了一跤：${error instanceof Error ? error.message : String(error)}` } }
    },
  }))
  ctx.effect(() => () => runtime.dispose())
}
