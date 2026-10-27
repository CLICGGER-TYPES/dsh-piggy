// @ts-check
/** Private endpoint directory, including Windows tokens whose default owner is a group.
 * WindowsIdentity.Owner is the token default owner, not an arbitrary administrators group.
 * https://learn.microsoft.com/en-us/dotnet/api/system.security.principal.windowsidentity.owner
 */
import { execFile } from 'node:child_process'
import { chmod, lstat, mkdir } from 'node:fs/promises'

export async function secureDirectory(directory) {
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
    '$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()',
    '$sid = $identity.User',
    '$dir = [System.IO.DirectoryInfo]::new($env:PIGGY_WORK_PATH)',
    '$sections = [System.Security.AccessControl.AccessControlSections]',
    '$sidType = [System.Security.Principal.SecurityIdentifier]',
    '$owner = $dir.GetAccessControl($sections::Owner).GetOwner($sidType)',
    'if (-not $owner.Equals($sid) -and -not $owner.Equals($identity.Owner)) { throw "owner mismatch" }',
    '$acl = $dir.GetAccessControl($sections::Access -bor $sections::Owner)',
    '$acl.SetOwner($sid)',
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

