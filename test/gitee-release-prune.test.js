import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptPath = fileURLToPath(new URL('../scripts/gitee-release.mjs', import.meta.url))
const releases = [
  { id: 1, tag_name: 'v0.37.1' },
  { id: 2, tag_name: 'v0.36.1-rc.1' },
  { id: 3, tag_name: 'v0.36.0' },
  { id: 4, tag_name: 'ext-farm-4.0.9' },
]
const assets = {
  1: [
    { id: 101, name: 'setup.exe', size: 10 },
    { id: 102, name: 'latest.yml', size: 10 },
    { id: 103, name: 'game-0.37.1.json.gz', size: 10 },
  ],
  2: [
    { id: 201, name: 'setup.exe', size: 10 },
    { id: 202, name: 'rc.yml', size: 10 },
    { id: 203, name: 'latest.yml', size: 10 },
    { id: 204, name: 'game-0.36.1-rc.1.json.gz', size: 10 },
  ],
  3: [
    { id: 301, name: 'setup.exe', size: 10 },
    { id: 302, name: 'latest.yml', size: 10 },
    { id: 303, name: 'latest-linux.yml', size: 10 },
    { id: 304, name: 'game-0.36.0.json.gz', size: 10 },
  ],
  4: [
    { id: 401, name: 'ext-farm-4.0.9.piggyext', size: 10 },
    { id: 402, name: 'manifest.json', size: 10 },
  ],
}

const preloadSource = `
import { appendFileSync } from 'node:fs'
const releases = ${JSON.stringify(releases)}
const assets = ${JSON.stringify(assets)}
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input)
  const method = init.method ?? 'GET'
  if (url.pathname.endsWith('/releases') && method === 'GET') {
    const page = Number(url.searchParams.get('page'))
    return new Response(JSON.stringify(page === 1 ? releases : []), { status: 200 })
  }
  const match = url.pathname.match(/\\/releases\\/(\\d+)\\/attach_files(?:\\/(\\d+))?$/)
  if (!match) throw new Error('Unexpected mock request: ' + method + ' ' + url.pathname)
  if (method === 'GET' && match[2] === undefined) {
    return new Response(JSON.stringify(assets[match[1]] ?? []), { status: 200 })
  }
  if (method === 'DELETE') {
    appendFileSync(process.env.GITEE_MOCK_DELETE_LOG, JSON.stringify({ release: match[1], asset: match[2] }) + '\\n')
    return new Response(null, { status: 204 })
  }
  throw new Error('Unexpected mocked attachment method: ' + method)
}
`

function prune(tag) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-gitee-prune-'))
  try {
    const preload = join(dir, 'mock-gitee.mjs')
    const deletes = join(dir, 'deletes.jsonl')
    writeFileSync(preload, preloadSource)
    writeFileSync(deletes, '')
    const output = execFileSync(process.execPath, ['--import', pathToFileURL(preload).href, scriptPath, 'prune', tag], {
      env: {
        ...process.env,
        GITEE_TOKEN: 'mock-token',
        GITEE_REPO: 'mock/repo',
        GITEE_MOCK_DELETE_LOG: deletes,
      },
      encoding: 'utf8',
    })
    const deleted = readFileSync(deletes, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    return { output, deleted }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('pruning an RC release makes no delete requests', () => {
  const result = prune('v0.37.1-rc.1')
  assert.deepEqual(result.deleted, [])
  assert.match(result.output, /skipped for prerelease/)
})

test('stable pruning keeps the selected release and game packages, and removes old installer metadata', () => {
  const result = prune('v0.37.1')
  assert.deepEqual(result.deleted, [
    { release: '2', asset: '201' },
    { release: '2', asset: '202' },
    { release: '2', asset: '203' },
    { release: '3', asset: '301' },
    { release: '3', asset: '302' },
    { release: '3', asset: '303' },
  ])
  assert.match(result.output, /v0\.36\.1-rc\.1 setup\.exe/)
  assert.match(result.output, /v0\.36\.0 latest-linux\.yml/)
  assert.doesNotMatch(result.output, /game-0\.36/)
  assert.doesNotMatch(result.output, /v0\.37\.1 setup\.exe/)
})
