// @ts-check
/** 本地接口测试直连回环地址，避免继承的 Node 环境代理把请求转到别的机器。 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const bypass = [process.env.NO_PROXY, process.env.no_proxy, 'localhost', '127.0.0.1', '::1', '[::1]'].filter(Boolean).join(',')
const targets = process.argv.slice(2)
const run = spawnSync(process.execPath, [
  '--import', new URL('../test/helpers/strict-lines.js', import.meta.url).href,
  '--test', ...(targets.length ? targets : ['test/**/*.test.js', 'apps/desktop/test/*.test.js']),
], { cwd: root, stdio: 'inherit', env: { ...process.env, NO_PROXY: bypass, no_proxy: bypass } })
if (run.error) console.error('测试进程启动失败', run.error.message)
process.exit(run.status ?? 1)
