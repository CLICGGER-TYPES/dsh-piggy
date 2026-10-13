// @ts-check
/** 无界面的游戏运行时入口，供本机适配器开发和独立部署使用。 */
import { isAbsolute } from 'node:path'
import { createGameRuntime } from './index.js'
import { startWorkEventServer } from './local-server.js'

const argument = key => process.argv.slice(2).find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3)
const statePath = argument('state-path')
const directory = argument('endpoint-directory')
if (!statePath || !directory || !isAbsolute(statePath) || !isAbsolute(directory)) {
  throw new Error('use --state-path=<absolute save path> --endpoint-directory=<absolute private directory>')
}
const runtime = createGameRuntime({ statePath })
let endpoint
try { endpoint = await startWorkEventServer({ directory, runtime }) }
catch (error) { runtime.dispose(); throw error }
console.log('piggy work-event runtime ready')
let closing
const close = () => closing ??= endpoint.close().then(() => runtime.dispose())
process.on('SIGINT', () => void close())
process.on('SIGTERM', () => void close())
if (process.platform === 'win32') process.on('SIGBREAK', () => void close())
