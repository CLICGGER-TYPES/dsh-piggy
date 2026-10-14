// @ts-check
/** 可选的本机工作事件接口：不开放游戏管理路由，也不依赖任何 agent 框架。 */
import { execFile } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { chmod, lstat, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readWorkJson, removeWorkFile, writeWorkJson } from './work-files.js'
import { WORK_EVENT_TYPES, WORK_EVENT_WINDOW_MS, workError } from './work-events.js'
import { acquireGameLock } from './owner-lock.js'

async function secureDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const stat = await lstat(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('work endpoint directory must be a real directory')
  if (process.platform !== 'win32') {
    if (stat.uid !== process.getuid()) throw new Error('work endpoint directory owner mismatch')
    await chmod(directory, 0o700)
    return
  }
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$dir = [System.IO.DirectoryInfo]::new($env:PIGGY_WORK_PATH)',
    '$sections = [System.Security.AccessControl.AccessControlSections]',
    '$sidType = [System.Security.Principal.SecurityIdentifier]',
    'if (-not $dir.GetAccessControl($sections::Owner).GetOwner($sidType).Equals($sid)) { throw "owner mismatch" }',
    '$acl = $dir.GetAccessControl($sections::Access)',
    '$acl.SetAccessRuleProtection($true, $false)',
    'foreach ($rule in $acl.GetAccessRules($true, $false, $sidType)) { $acl.RemoveAccessRuleSpecific($rule) }',
    '$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,"FullControl","ContainerInherit,ObjectInherit","None","Allow"))',
    '$dir.SetAccessControl($acl)',
    // 已有的显式子文件授权可能不继承目录的新权限，不能发布到不私有的文件上。
    'foreach ($file in $dir.GetFiles()) { foreach ($rule in $file.GetAccessControl($sections::Access).GetAccessRules($true,$true,$sidType)) { if (-not $rule.IdentityReference.Equals($sid) -or [int]$rule.AccessControlType -ne 0) { throw "file is not private" } } }',
  ].join('; ')
  await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { env: { ...process.env, PIGGY_WORK_PATH: directory }, windowsHide: true }, error => error ? reject(error) : resolve(undefined)))
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

export async function startWorkEventServer({ directory, runtime }) {
  await secureDirectory(directory)
  const release = acquireGameLock(join(directory, 'endpoint'))
  const token = randomBytes(32).toString('hex')
  const discoveryPath = join(directory, 'endpoint.json')
  let host = ''
  let closing = false
  const requests = new Set()

  async function handle(request, response) {
    if (closing) throw workError('work endpoint closing', 503)
    const counts = new Map()
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index].toLowerCase()
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    if (counts.has('origin') || counts.get('host') !== 1 || request.headers.host !== host) throw workError('forbidden', 403)
    const actual = Buffer.from(request.headers.authorization ?? '')
    const expected = Buffer.from(`Bearer ${token}`)
    if (counts.get('authorization') !== 1 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw workError('unauthorized', 401)
    }
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, 200, { ok: true, role: 'piggy-work-events', version: 1,
        eventTypes: WORK_EVENT_TYPES, receiptWindowMs: WORK_EVENT_WINDOW_MS, acknowledgement: 'game-committed' })
    }
    if (request.method !== 'POST' || request.url !== '/events') throw workError('not found', 404)
    if (counts.has('content-encoding') || counts.get('content-type') !== 1 ||
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) {
      throw workError('json required', 415)
    }
    const chunks = []
    let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 16384) throw workError('body too large', 413)
      chunks.push(chunk)
    }
    let event
    try { event = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { throw workError('invalid json') }
    send(response, 200, await runtime.acceptWorkEvent(event))
  }

  const server = createServer({ maxHeaderSize: 16384 }, (request, response) => {
    const task = handle(request, response).catch(error => {
      if (!response.headersSent && !response.destroyed) send(response, error.status ?? 503,
        { ok: false, reason: error.status ? error.message : 'game commit unavailable' })
      request.resume()
    }).finally(() => requests.delete(task))
    requests.add(task)
  })
  server.requestTimeout = 10000
  server.headersTimeout = 10000
  server.timeout = 10000
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(undefined) })
    })
  } catch (error) { release(); throw error }
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('work endpoint missing address')
  host = `127.0.0.1:${address.port}`
  try { writeWorkJson(discoveryPath, { version: 1, role: 'piggy-work-events', port: address.port, token, pid: process.pid }) }
  catch (error) { await new Promise(resolve => server.close(resolve)); release(); throw error }
  let closePromise
  return {
    close() {
      if (closePromise) return closePromise
      closing = true
      closePromise = (async () => {
        const stopped = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve(undefined)))
        server.closeIdleConnections()
        await stopped
        await Promise.allSettled([...requests])
        if (readWorkJson(discoveryPath)?.token === token) removeWorkFile(discoveryPath)
        release()
      })()
      return closePromise
    },
  }
}
