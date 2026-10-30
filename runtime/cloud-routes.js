// @ts-check
/**
 * 云存档的 HTTP 面：只做参数校验与 JSON 往返，git 与存档替换都在注入的实现里。
 * 挂到运行时自己的路由表上，和 /dsh-piggy/save/* 一个层级。
 */
export const CLOUD_STATUS_ROUTE = '/dsh-piggy/cloud/status'
export const CLOUD_BRANCHES_ROUTE = '/dsh-piggy/cloud/branches'
export const CLOUD_PULL_ROUTE = '/dsh-piggy/cloud/pull'
export const CLOUD_PUSH_ROUTE = '/dsh-piggy/cloud/push'
export const CLOUD_COMMIT_ROUTE = '/dsh-piggy/cloud/commit'
export const CLOUD_HISTORY_ROUTE = '/dsh-piggy/cloud/history'

/** 请求体上限：这里只有分支名，1 KB 足够。 */
const BODY_LIMIT = 1024

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) return null
    chunks.push(chunk)
  }
  if (size === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * @param {object} deps
 * @param {() => Promise<any>} deps.status
 * @param {() => Promise<string[]>} deps.branches
 * @param {(branch: string) => Promise<any>} deps.pull
 * @param {() => Promise<any>} deps.push
 * @param {() => Promise<any>} deps.commit
 * @param {(branch: string) => Promise<any>} deps.history
 */
export function createCloudRoutes(deps) {
  const wrap = handler => async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      sendJson(res, 200, { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return [
    {
      path: CLOUD_STATUS_ROUTE,
      handler: wrap(async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
        sendJson(res, 200, { ok: true, ...(await deps.status()) })
      }),
    },
    {
      path: CLOUD_BRANCHES_ROUTE,
      handler: wrap(async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
        sendJson(res, 200, { ok: true, branches: await deps.branches() })
      }),
    },
    {
      path: CLOUD_PULL_ROUTE,
      handler: wrap(async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
        const body = await readJson(req)
        if (body === null) return sendJson(res, 400, { ok: false, reason: 'invalid-body' })
        const branch = typeof body.branch === 'string' ? body.branch.trim() : ''
        if (branch === '') return sendJson(res, 400, { ok: false, reason: 'missing-branch' })
        const result = await deps.pull(branch)
        sendJson(res, 200, { ok: result?.applied === true, branch, ...result })
      }),
    },
    {
      path: CLOUD_PUSH_ROUTE,
      handler: wrap(async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
        const result = await deps.push()
        sendJson(res, 200, { ok: true, ...result })
      }),
    },
    {
      path: CLOUD_COMMIT_ROUTE,
      handler: wrap(async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
        const result = await deps.commit()
        sendJson(res, 200, { ok: true, ...result })
      }),
    },
    {
      path: CLOUD_HISTORY_ROUTE,
      handler: wrap(async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
        const branch = new URL(String(req.url ?? ''), 'http://local').searchParams.get('branch') ?? ''
        const result = await deps.history(branch)
        sendJson(res, 200, { ok: true, ...result })
      }),
    },
  ]
}
