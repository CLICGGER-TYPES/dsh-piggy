// @ts-check
/** 无窗口入口；只有明确开启工作事件时才创建运行时和监听端口。 */
import { isAbsolute } from 'node:path'
import { createGameRuntime } from './index.js'
import { startWorkEventServer } from './local-server.js'

const argument = key => process.argv.slice(2).find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3)

async function serve() {
  const statePath = argument('state-path')
  const directory = argument('endpoint-directory')
  if (!statePath || !directory || !isAbsolute(statePath) || !isAbsolute(directory)) {
    throw new Error('use --work-events --state-path=<absolute save path> --endpoint-directory=<absolute private directory>')
  }
  const runtime = createGameRuntime({ statePath })
  let endpoint
  try { endpoint = await startWorkEventServer({ directory, runtime }) }
  catch (error) { runtime.dispose(); throw error }
  console.log('piggy work-event runtime ready')
  let closing
  const close = () => closing ??= endpoint.close().then(() => runtime.dispose()).catch(error => {
    console.error('piggy runtime shutdown failed', error)
    process.exitCode = 1
  })
  process.on('SIGINT', () => void close())
  process.on('SIGTERM', () => void close())
  if (process.platform === 'win32') process.on('SIGBREAK', () => void close())
}

if (process.argv.includes('--work-events')) await serve()
else console.log('piggy work-event endpoint disabled; enable with --work-events')
