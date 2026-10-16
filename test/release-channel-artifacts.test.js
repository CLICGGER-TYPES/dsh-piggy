import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const releaseWorkflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
const giteeWorkflow = readFileSync(new URL('../.github/workflows/release-gitee.yml', import.meta.url), 'utf8')
const giteePublish = readFileSync(new URL('../scripts/gitee-publish.sh', import.meta.url), 'utf8')

function line(source, pattern, label) {
  const found = source.split('\n').find(value => pattern.test(value))
  assert.ok(found, `${label} exists`)
  return found.trim()
}

function runBash(dir, script, env = {}) {
  return execFileSync('bash', ['--noprofile', '--norc', '-e', '-c', script], {
    cwd: dir, env: { ...process.env, ...env }, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean)
}

function makeDist(dir, names) {
  mkdirSync(join(dir, 'dist'), { recursive: true })
  for (const name of names) writeFileSync(join(dir, 'dist', name), 'metadata')
}

function selectionScript(workflow, tagVariable, globLinePattern, label) {
  const initial = line(workflow, /^\s*update_channel=latest$/, `${label} channel default`)
  const derive = label === 'GitHub' ? (workflow.split('\n').find(value => /^\s*if \[\[.* =~ .*update_channel=/.test(value)) || '').trim() : line(workflow, new RegExp(`^\\s*if \\\[\\\[ "\\$${tagVariable}" =~ `), `${label} channel derivation`)
  const globLine = line(workflow, globLinePattern, `${label} metadata glob`)
  const glob = globLine.match(/(?:files=\(|for f in )(.*?)(?:\)|; do)$/)?.[1]
  assert.ok(glob, `${label} glob parsed`)
  return {
    script: `${initial}\n${derive}\nshopt -s nullglob\nfiles=(${glob})\nprintf '%s\\n' "\${files[@]}"`,
  }
}

test('GitHub keeps latest metadata per release; Gitee uses the version channel', () => {
  const ghSelection = selectionScript(
    releaseWorkflow, 'TAG', /^\s*files=\(dist\/\*\.AppImage/, 'GitHub',
  )
  const giteeSelection = selectionScript(
    giteeWorkflow, 'TAG', /^\s*for f in apps\/desktop\/dist\/\*\.exe/, 'Gitee',
  )
  const validation = releaseWorkflow.split('\n').filter(value => value.includes('test -s "dist/${update_channel}'))
    .map(value => value.trim().replaceAll('${{ matrix.target }}', '$TARGET')).join('\n')
  assert.ok(validation.includes('dist/${update_channel}.yml'))
  assert.ok(validation.includes('dist/${update_channel}-linux.yml'))
  assert.ok(giteeWorkflow.includes('test -s "apps/desktop/dist/${update_channel}.yml"'))
  assert.equal(JSON.parse(readFileSync(new URL('../apps/desktop/package.json', import.meta.url))).build.publish[0].provider, 'github')
  for (const tag of ['v0.37.1', 'v0.37.1-rc.1']) {
    const dir = mkdtempSync(join(tmpdir(), 'piggy-release-channel-'))
    try {
      // The real GitHub provider emits latest*.yml even for prerelease versions.
      makeDist(dir, ['latest.yml', 'latest-linux.yml', 'piggy.AppImage'])
      for (const target of ['--win', '--linux']) {
        const script = ghSelection.script.replace('shopt -s nullglob', validation + '\nshopt -s nullglob')
        assert.deepEqual(runBash(dir, script, { TAG: tag, GITHUB_REF_NAME: tag, TARGET: target }).sort(),
          ['dist/latest-linux.yml', 'dist/latest.yml', 'dist/piggy.AppImage'])
      }
    } finally { rmSync(dir, { recursive: true, force: true }) }
    const generic = mkdtempSync(join(tmpdir(), 'piggy-gitee-channel-'))
    try {
      makeDist(generic, ['latest.yml', 'rc.yml'])
      const script = giteeSelection.script.replaceAll('apps/desktop/dist/', 'dist/')
      assert.deepEqual(runBash(generic, script, { TAG: tag }), [tag.includes('-rc.') ? 'dist/rc.yml' : 'dist/latest.yml'])
    } finally { rmSync(generic, { recursive: true, force: true }) }
  }
  const artifactPaths = giteeWorkflow.split('\n').map(value => value.trim())
  assert.ok(artifactPaths.includes('apps/desktop/dist/latest*.yml'))
  assert.ok(artifactPaths.includes('apps/desktop/dist/rc*.yml'))
  // Repair builds run the current workflow but check out the immutable release tag.
  assert.ok(releaseWorkflow.includes('workflow_dispatch:'))
  assert.equal((releaseWorkflow.match(/ref: refs\/tags\/\$\{\{ env.TAG \}\}/g) || []).length, 2)
  assert.ok(releaseWorkflow.includes('gh release upload "$TAG"'))
  assert.ok(releaseWorkflow.includes('gh release create "$TAG" --verify-tag'))
  assert.ok(releaseWorkflow.includes('fail-fast: false'))
})

test('Gitee upload script classifies both stable and RC metadata for the final upload phase', () => {
  const patternLine = line(giteePublish, /^\s*latest\*\.yml\|rc\*\.yml\) MANIFESTS/, 'Gitee manifest classifier')
  const patterns = patternLine.match(/^([^)]*)\) MANIFESTS/)?.[1]
  assert.ok(patterns)
  const cases = [
    ['latest.yml', 'manifest'], ['latest-linux.yml', 'manifest'],
    ['rc.yml', 'manifest'], ['rc-linux.yml', 'manifest'], ['setup.exe', 'installer'],
  ]
  for (const [name, expected] of cases) {
    const script = `case '${name}' in ${patterns}) echo manifest;; *) echo installer;; esac`
    assert.deepEqual(runBash(process.cwd(), script), [expected])
  }
  const installersUpload = giteePublish.indexOf('node scripts/gitee-release.mjs upload "$ID" "${INSTALLERS[@]}"')
  const manifestsUpload = giteePublish.indexOf('node scripts/gitee-release.mjs upload "$ID" "${MANIFESTS[@]}"')
  assert.ok(installersUpload >= 0 && manifestsUpload > installersUpload, 'metadata uploads after installers')
})
