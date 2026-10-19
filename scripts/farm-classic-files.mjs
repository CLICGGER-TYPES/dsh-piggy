import { readFileSync, existsSync } from 'node:fs'
import { extensionFiles } from './extension-files.mjs'

/** Classic appearance with the exact current server, not a downgrade migration. */
export function farmClassicFiles() {
  const root = new URL('../extension-variants/farm-classic/', import.meta.url)
  const shared = extensionFiles('farm')
  const manifest = readFileSync(new URL('manifest.json', root), 'utf8')
  const bridge = readFileSync(new URL('data-bridge.js', root), 'utf8')
  const client = readFileSync(new URL('client.js', root), 'utf8').replace('/* CLASSIC_DATA_BRIDGE */', bridge)
  const files = { 'manifest.json': manifest, 'client.js': client, 'server.js': shared['server.js'] }
  for (const name of JSON.parse(manifest).assets) {
    const local = new URL('assets/' + name, root)
    files['assets/' + name] = existsSync(local) ? readFileSync(local) : shared['assets/' + name]
    if (!files['assets/' + name]) throw new Error('classic farm asset missing: ' + name)
  }
  return files
}
