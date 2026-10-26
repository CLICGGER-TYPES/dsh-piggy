// @ts-check
/**
 * 版本详情用：某一版到底有没有发到 npm。
 *
 * 发布页的标签和 npm 上的包不是同一件事：标签先出，npm 由 OIDC 工作流随后补发
 * （0.37.1 就是只有发布页、npm 上没有），所以不能看标签就叫人装 `dsh-piggy@版本`。
 * 只问 `/<包名>/<精确版本>` 这一条元数据，不拉整包文档（`/dsh-piggy` 有几十兆）。
 * @module dsh-piggy/client/tabs/update-npm
 */

export const NPM_PACKAGE = 'dsh-piggy'
export const NPM_REGISTRY = 'https://registry.npmjs.org'

/**
 * 精确版本的元数据地址。npm 注册表支持 `/<包名>/<版本>`，404 就是这一版没发。
 * @param {string} version
 * @returns {string}
 */
export function npmVersionUrl(version) {
  return NPM_REGISTRY + '/' + NPM_PACKAGE + '/' + encodeURIComponent(version)
}

/**
 * 问 npm 有没有这个精确版本。
 *
 * 200 是「有」，404 是「这一版没发到 npm」；其它状态码和连不上的情况都当「没问出来」，
 * 抛出去让页面显示可重试状态——不能把网络问题说成版本不存在。
 * @param {string} version
 * @param {typeof fetch} [doFetch]
 * @returns {Promise<'found'|'missing'>}
 */
export async function fetchNpmVersion(version, doFetch = fetch) {
  let response
  try {
    response = await doFetch(npmVersionUrl(version), { headers: { accept: 'application/json' }, cache: 'no-store' })
  } catch (error) {
    throw new Error('没连上 npm')
  }
  if (response.status === 404) return 'missing'
  if (!response.ok) throw new Error('npm ' + response.status)
  return 'found'
}
