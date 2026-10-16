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
  const derive = line(workflow, new RegExp(`^\\s*if \\\[\\\[ "\\$${tagVariable}" =~ `), `${label} channel derivation`)
  const globLine = line(workflow, globLinePattern, `${label} metadata glob`)
  const glob = globLine.match(/(?:files=\(|for f in )(.*?)(?:\)|; do)$/)?.[1]
  assert.ok(glob, `${label} glob parsed`)
  return {
    script: `${initial}\n${derive}\nshopt -s nullglob\nfiles=(${glob})\nprintf '%s\\n' "\${files[@]}"`,
  }
}

test('stable release keeps latest metadata; an RC selects and uploads its rc metadata', () => {
  const ghSelection = selectionScript(
    releaseWorkflow, 'GITHUB_REF_NAME', /^\s*files=\(dist\/\*\.AppImage/, 'GitHub',
  )
  const giteeSelection = selectionScript(
    giteeWorkflow, 'TAG', /^\s*for f in apps\/desktop\/dist\/\*\.exe/, 'Gitee',
  )
  const ghValidation = releaseWorkflow.split('\n').filter(value => value.includes('test -s "dist/${update_channel}'))
  assert.ok(
    ghValidation.some(value => value.includes('dist/${update_channel}.yml')),
    'Windows validates the channel manifest',
  )
  assert.ok(
    ghValidation.some(value => value.includes('dist/${update_channel}-linux.yml')),
    'Linux validates its channel manifest',
  )
  assert.ok(
    giteeWorkflow.includes('test -s "apps/desktop/dist/${update_channel}.yml"'),
    'Gitee requires its Windows channel manifest',
  )

  for (const [tag, names, expected] of [
    [
      'v0.37.1',
      ['latest.yml', 'latest-linux.yml', 'latest-mac.yml', 'rc.yml', 'piggy.AppImage'],
      ['dist/latest.yml', 'dist/latest-linux.yml', 'dist/latest-mac.yml', 'dist/piggy.AppImage'],
    ],
    [
      'v0.37.1-rc.1',
      ['rc.yml', 'rc-linux.yml', 'rc-mac.yml', 'latest.yml', 'piggy.AppImage'],
      ['dist/rc.yml', 'dist/rc-linux.yml', 'dist/rc-mac.yml', 'dist/piggy.AppImage'],
    ],
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'piggy-release-channel-'))
    try {
      makeDist(dir, names)
      assert.deepEqual(
        runBash(dir, ghSelection.script, { GITHUB_REF_NAME: tag }).sort(), expected.sort(),
      )
      const giteeExpected = expected.filter(value => /\.yml$/.test(value))
      const giteeScript = giteeSelection.script.replaceAll('apps/desktop/dist/', 'dist/')
      assert.deepEqual(runBash(dir, giteeScript, { TAG: tag }).sort(), giteeExpected.sort())
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  const oldRcOnly = mkdtempSync(join(tmpdir(), 'piggy-old-rc-glob-'))
  try {
    makeDist(oldRcOnly, ['rc.yml', 'rc-linux.yml'])
    const oldSelection = 'shopt -s nullglob; files=(dist/latest*.yml); test -s dist/latest.yml; printf "%s\\n" "${files[@]}"'
    assert.throws(() => runBash(oldRcOnly, oldSelection))
    assert.deepEqual(
      runBash(oldRcOnly, ghSelection.script, { GITHUB_REF_NAME: 'v0.37.1-rc.1' }).sort(),
      ['dist/rc-linux.yml', 'dist/rc.yml'],
    )
  } finally {
    rmSync(oldRcOnly, { recursive: true, force: true })
  }

  const oldStable = mkdtempSync(join(tmpdir(), 'piggy-old-stable-glob-'))
  try {
    makeDist(oldStable, ['latest.yml', 'latest-linux.yml'])
    const oldSelection = 'shopt -s nullglob; files=(dist/latest*.yml); test -s dist/latest.yml; printf "%s\\n" "${files[@]}"'
    assert.deepEqual(
      runBash(oldStable, oldSelection).sort(), ['dist/latest-linux.yml', 'dist/latest.yml'],
    )
  } finally {
    rmSync(oldStable, { recursive: true, force: true })
  }

  const artifactPaths = giteeWorkflow.split('\n').map(value => value.trim())
  assert.ok(artifactPaths.includes('apps/desktop/dist/latest*.yml'), 'stable artifacts remain included')
  assert.ok(artifactPaths.includes('apps/desktop/dist/rc*.yml'), 'RC artifacts are preserved for local publishing')
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
