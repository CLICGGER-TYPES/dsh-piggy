// @ts-check
/** DSH 只负责宿主事件、服务注册和默认位置，游戏规则与持久化由运行时负责。 */
import { randomUUID } from 'node:crypto'
import { createGameRuntime } from '../../runtime/index.js'
import { defaultStatePath, moveLegacySaveDir } from '../../store/state-file.js'
import { environmentNote } from '../../environment.js'
import { createWorkObserver } from './work-observer.js'

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
  // Host callbacks have no durable identity; keep each generated event ID stable across 503 retries.
  const observer = createWorkObserver({ accept: event => runtime.acceptWorkEvent(event), source: 'dsh', producer: randomUUID(),
    warn: message => console.warn(message) })
  const observe = type => observer.observe(type)
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
  ctx.effect(() => () => { observer.dispose(); runtime.dispose() })
}
