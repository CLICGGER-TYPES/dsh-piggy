// @ts-check
/** Real private-directory checks; Windows checks both token ownership and the effective ACL. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { secureDirectory } from '../runtime/work-directory.js'

test('securing a real endpoint directory preserves files and restricts permissions on each platform', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-private-directory-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const directory = join(root, 'endpoint')
  await secureDirectory(directory)
  writeFileSync(join(directory, 'owned-file'), 'private')
  await secureDirectory(directory)
  if (process.platform === 'win32') {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', [
      '$ErrorActionPreference="Stop"',
      '$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User',
      '$type=[System.Security.Principal.SecurityIdentifier]',
      '$dir=[System.IO.DirectoryInfo]::new($env:PIGGY_TEST_DIRECTORY)',
      'if (-not $dir.GetAccessControl().GetOwner($type).Equals($sid)) { throw "unexpected owner" }',
      'foreach ($item in @($dir)+@($dir.GetFiles())) { foreach ($rule in $item.GetAccessControl().GetAccessRules($true,$true,$type)) { if (-not $rule.IdentityReference.Equals($sid) -or [int]$rule.AccessControlType -ne 0) { throw "unexpected permission" } } }',
      'Write-Output "private"',
    ].join('; ')], { env: { ...process.env, PIGGY_TEST_DIRECTORY: directory }, encoding: 'utf8' })
    assert.equal(output.trim(), 'private')
  } else assert.equal(statSync(directory).mode & 0o777, 0o700)
})
