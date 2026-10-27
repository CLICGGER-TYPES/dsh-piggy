param([Parameter(Mandatory=$true)][string]$Installer,[Parameter(Mandatory=$true)][string]$Repository,[switch]$CheckIcons)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Windows.Forms,System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class PiggyNative {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr window,int id);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr window);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
 public struct Rect { public int Left,Top,Right,Bottom; }
}
'@
$Out = Join-Path $Repository 'installer-qa-results'
New-Item $Out -ItemType Directory -Force | Out-Null
$Qa = Join-Path $env:RUNNER_TEMP ('piggy-installer-' + [Guid]::NewGuid().ToString('N'))
# electron-builder appends APP_FILENAME when the chosen directory lacks it.
$AppDir = Join-Path $Qa 'Program files/dsh-piggy'
$DataProfile = Join-Path $Qa 'personal profile'
$DefaultProfile = Join-Path $env:APPDATA 'piggy'
$LegacyProfile = Join-Path $env:APPDATA 'dsh-piggy-desktop'
$Catalog = Get-Content (Join-Path $Repository 'apps/desktop/build/optional-extensions/catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$Results = [System.Collections.Generic.List[object]]::new()
$Game = $null
function Wait-Until([scriptblock]$Condition,[string]$Description,[int]$Seconds=60) {
 $end = [DateTime]::UtcNow.AddSeconds($Seconds)
 do { $value = & $Condition; if ($value) { return $value }; Start-Sleep -Milliseconds 200 } while ([DateTime]::UtcNow -lt $end)
 throw "Timeout: $Description"
}
function Mouse-Point([int]$X,[int]$Y,[bool]$Right=$false) {
 if (-not [PiggyNative]::SetCursorPos($X,$Y)) { throw 'Cannot position native mouse on this VM desktop' }
 Start-Sleep -Milliseconds 90
 if ($Right) { [PiggyNative]::mouse_event(8,0,0,0,[UIntPtr]::Zero); [PiggyNative]::mouse_event(16,0,0,0,[UIntPtr]::Zero) }
 else { [PiggyNative]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [PiggyNative]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
 Start-Sleep -Milliseconds 160
}
function Click-Element($Element) {
 # Polls/import completion can rebuild Chromium buttons. Reacquire the same
 # visible accessible target by its identity while waiting for layout to settle.
 $identity=@{name=$Element.Current.Name;process=$Element.Current.ProcessId;type=$Element.Current.ControlType}
 if (-not $identity.name) { throw 'Native click target has no accessible identity' }
 $position=@{previous='';stable=0}
 $target=Wait-Until {
  $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$identity.process)
  foreach ($window in [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)) {
   if ($window.Current.IsOffscreen) { continue }
   foreach ($candidate in (Controls $window $identity.type)) {
    $box=$candidate.Current.BoundingRectangle
    if ($candidate.Current.Name -ne $identity.name -or $candidate.Current.IsOffscreen -or -not $candidate.Current.IsEnabled -or $box.Width -le 0 -or $box.Height -le 0) { continue }
    if ($box.ToString() -eq $position.previous) { $position.stable++ } else { $position.stable=0; $position.previous=$box.ToString() }
    if ($position.stable -ge 3) { return @{element=$candidate;bounds=$box} }
   }
  }
  return $null
 } 'stable visible native target' 10
 $r=$target.bounds
 Write-Host ('Native click: '+$identity.name+' @ '+$r.ToString())
 Mouse-Point ([int]($r.X+$r.Width/2)) ([int]($r.Y+$r.Height/2))
}
function Click-Id($Root,[int]$Id) {
 $handle = [PiggyNative]::GetDlgItem([IntPtr]$Root.Current.NativeWindowHandle,$Id)
 if ($handle -eq [IntPtr]::Zero -or -not [PiggyNative]::IsWindowEnabled($handle)) { throw "Dialog button $Id unavailable" }
 $r = [PiggyNative+Rect]::new(); [void][PiggyNative]::GetWindowRect($handle,[ref]$r)
 Mouse-Point (($r.Left+$r.Right)/2) (($r.Top+$r.Bottom)/2)
}
function Find-Window([int]$ProcessId) {
 $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$ProcessId)
 $all = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)
 foreach ($item in $all) { if (-not $item.Current.IsOffscreen -and $item.Current.BoundingRectangle.Width -gt 80) { $script:LastRoot=$item; return $item } }
 return $null
}
function Controls($Root,$Type) {
 $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,$Type)
 return @($Root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition))
}
function Extension-Checks($Root) {
 return @(Controls $Root ([System.Windows.Automation.ControlType]::CheckBox) | Where-Object { $_.Current.Name -in @($Catalog.items.label) })
}
function Is-Checked($Element) { return $Element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On }
function Screenshot([string]$Name,$Root=$null) {
 $r = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
 if ($Root) { $box=$Root.Current.BoundingRectangle; $r=[System.Drawing.Rectangle]::new([int]$box.X,[int]$box.Y,[int]$box.Width,[int]$box.Height) }
 if ($r.Width -le 0 -or $r.Height -le 0) { throw 'No interactive VM display' }
 $bitmap=[System.Drawing.Bitmap]::new($r.Width,$r.Height)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 try { $graphics.CopyFromScreen($r.Location,[System.Drawing.Point]::Empty,$r.Size); $bitmap.Save((Join-Path $Out ($Name+'.png'))) }
 finally { $graphics.Dispose(); $bitmap.Dispose() }
}
function Inventory([string]$Directory) {
 $items=@(Get-ChildItem $Directory -File -Recurse | Sort-Object FullName | ForEach-Object { $_.FullName.Substring($Directory.Length) + ':' + (Get-FileHash $_.FullName -Algorithm SHA256).Hash })
 return ($items -join "`n")
}
function Install-Pick([string]$Name,[string[]]$Keys,[bool]$Cancel=$false,[bool]$Back=$false) {
 $before=Inventory $DataProfile
 $proc=Start-Process -FilePath $Installer -ArgumentList "/CURRENTUSER /D=$AppDir" -PassThru
 $root=Wait-Until { Find-Window $proc.Id } 'installer window'
 $checks=@()
 for ($page=0;$page -lt 8;$page++) {
  $checks=Extension-Checks $root
  if ($checks.Count -eq 5) { break }
  Click-Id $root 1
 }
 if ($checks.Count -ne 5) { Screenshot ($Name+'-missing-page') $root; throw 'Five optional-extension checkboxes not found' }
 foreach ($check in $checks) { if (Is-Checked $check) { throw 'Extension checked by default' } }
 $rect=$root.Current.BoundingRectangle
 foreach ($check in $checks) {
  $box=$check.Current.BoundingRectangle
  if ($box.Bottom -gt $rect.Bottom -or $box.Right -gt $rect.Right) { throw 'Checkbox is clipped' }
  if ($check.Current.Name -in @($Catalog.items | Where-Object key -in $Keys | ForEach-Object label)) { Click-Element $check }
 }
 if ($Back) {
  Click-Id $root 3
  Click-Id $root 1
  $checks=Extension-Checks $root
  foreach ($check in $checks) {
   $expected=$check.Current.Name -in @($Catalog.items | Where-Object key -in $Keys | ForEach-Object label)
   if ((Is-Checked $check) -ne $expected) { throw 'Back navigation lost current selections' }
  }
 }
 Screenshot ($Name+'-options') $root
 if ($Cancel) {
  Click-Id $root 2
  Start-Sleep -Milliseconds 400
  $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$proc.Id)
  foreach ($window in [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)) {
   $yes=[PiggyNative]::GetDlgItem([IntPtr]$window.Current.NativeWindowHandle,6)
   if ($yes -ne [IntPtr]::Zero) { Click-Id $window 6; break }
  }
 } else {
  Click-Id $root 1
  Wait-Until {
   $button=[PiggyNative]::GetDlgItem([IntPtr]$root.Current.NativeWindowHandle,1)
   if ($button -eq [IntPtr]::Zero -or -not [PiggyNative]::IsWindowEnabled($button)) { return $false }
   $element=[System.Windows.Automation.AutomationElement]::FromHandle($button)
   return $element.Current.Name -match 'Finish|完成'
  } 'installer completion' 180 | Out-Null
  foreach ($check in (Controls $root ([System.Windows.Automation.ControlType]::CheckBox))) { if (Is-Checked $check) { Click-Element $check } }
  Screenshot ($Name+'-finish') $root
  Click-Id $root 1
 }
 if (-not $proc.WaitForExit(30000)) { throw 'Installer did not exit' }
 if ($before -ne (Inventory $DataProfile)) { throw 'NSIS changed game save or installed extensions' }
 if (-not $Cancel) {
  $directory=Join-Path $AppDir 'resources/optional-extensions'
  $selection=Get-Content (Join-Path $directory 'selection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ((@($selection.keys | Sort-Object) -join ',') -ne (@($Keys | Sort-Object) -join ',')) { throw 'Installed selection differs from native choices' }
  $bundles=@(Get-ChildItem $directory -Filter '*.piggyext')
  if ($bundles.Count -ne $Keys.Count) { throw 'Unselected bundles extracted' }
  foreach ($key in $Keys) { $item=$Catalog.items | Where-Object key -eq $key; if ((Get-FileHash (Join-Path $directory $item.file) -Algorithm SHA256).Hash -ne $item.sha256) { throw 'Embedded bundle hash mismatch' } }
 }
 Write-Host ('Installer case complete: '+$Name)
 $Results.Add(@{case=$Name;keys=$Keys;cancel=$Cancel;nativeMouse=$true;saveUntouched=$true})
}
function Find-GameButton([int]$ProcessId,[string]$Pattern) {
 $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$ProcessId)
 foreach ($window in [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)) {
  if ($window.Current.IsOffscreen -or $window.Current.BoundingRectangle.Width -lt 80) { continue }
  foreach ($button in (Controls $window ([System.Windows.Automation.ControlType]::Button))) {
   $current=$button.Current
   if ($current.Name -match $Pattern -and -not $current.IsOffscreen -and $current.IsEnabled -and $current.BoundingRectangle.Width -gt 0) {
    # Keep identity by value; Chromium may replace the live node before click.
    return @{Current=@{Name=[string]$current.Name;ProcessId=[int]$current.ProcessId;
     ControlType=$current.ControlType;BoundingRectangle=$current.BoundingRectangle}}
   }
  }
 }
 return $null
}
function Open-GameMenu($Root) {
 # Hatching can leave the menu open; right-click would close that valid state.
 Start-Sleep -Milliseconds 300
 if (Find-GameButton $Root.Current.ProcessId '^第 [0-9]+ 页$|拆开纸盒') { return }
 # The transparent window includes speech/motion reserve; its center is not the pig.
 # Read the visible scene group from Windows accessibility and click its actual bounds.
 $target=Wait-Until {
  foreach ($group in (Controls $Root ([System.Windows.Automation.ControlType]::Group))) {
   $r=$group.Current.BoundingRectangle
   if (-not $group.Current.IsOffscreen -and $r.Width -ge 32 -and $r.Height -ge 32 -and $r.Width -le 400 -and $r.Height -le 200) { return $group }
  }
  return $null
 } 'visible native pig scene' 30
 if (Find-GameButton $Root.Current.ProcessId '^第 [0-9]+ 页$|^‹$|拆开纸盒') { return }
 $r=$target.Current.BoundingRectangle
 # Stage scene includes the name bar; the pig remains at its lower-right.
 Mouse-Point ([int]($r.Right-[Math]::Min(33,$r.Width/2))) ([int]($r.Bottom-[Math]::Min(33,$r.Height/2))) $true
 Start-Sleep -Milliseconds 1000
}
function Quit-Tile([int]$ProcessId) {
 $button=Find-GameButton $ProcessId '退出'
 if ($button) { return $button }
 # Home apps are paginated; the quit tile is on the final page.
 for ($page=8;$page -ge 2;$page--) {
  $dot=Find-GameButton $ProcessId ('^第 '+$page+' 页$')
  if ($dot) { Click-Element $dot; return (Wait-Until { Find-GameButton $ProcessId '退出' } 'visible quit tile on final home page' 10) }
 }
 return $null
}
function Close-Game($Process,$Root) {
 $button=Quit-Tile $Process.Id
 if (-not $button) { Open-GameMenu $Root; $button=Wait-Until { Quit-Tile $Process.Id } 'native quit tile' 20 }
 Click-Element $button
 Start-Sleep -Milliseconds 400
 $confirm=Find-GameButton $Process.Id '^退出$|^确定$'
 if ($confirm) { Click-Element $confirm }
 if (-not $Process.WaitForExit(20000)) { throw 'Game did not quit through its UI' }
}
function Run-Game([string]$Name,[string]$UserProfile,[int]$Expected,[bool]$Fresh=$false,[bool]$UseDefault=$false,[string]$WindowMode="split",[bool]$CheckExternal=$false) {
 if ($UseDefault) { Remove-Item Env:PIGGY_USERDATA -ErrorAction SilentlyContinue } else { $env:PIGGY_USERDATA=$UserProfile }
 if (-not $UseDefault -or -not (Test-Path (Join-Path $LegacyProfile 'dsh-piggy'))) {
  if (-not (Test-Path $UserProfile)) { New-Item $UserProfile -ItemType Directory | Out-Null }
  '{"mode":"http","address":"127.0.0.1:9"}' | Set-Content (Join-Path $UserProfile 'proxy.json')
 }
 $script:Game=Start-Process (Join-Path $AppDir 'dsh-piggy.exe') -ArgumentList "--force-renderer-accessibility --window-mode=$WindowMode" -PassThru
 $root=Wait-Until { Find-Window $script:Game.Id } 'installed game window' 60
 if ($Fresh) {
  Start-Sleep -Seconds 3
  if (Test-Path (Join-Path $UserProfile 'extensions')) { throw 'Extensions installed before hatch' }
  Open-GameMenu $root
  $hatch=Wait-Until { Find-GameButton $script:Game.Id '拆开纸盒' } 'native hatch button' 20
  Screenshot ($Name+'-before-hatch') $root
  Click-Element $hatch
 }
 Wait-Until { @(Get-ChildItem (Join-Path $UserProfile 'extensions') -Filter manifest.json -Recurse -ErrorAction SilentlyContinue).Count -eq $Expected } 'offline extension imports' 40 | Out-Null
 if (-not $Fresh) {
  if ((Get-Content (Join-Path $UserProfile 'extensions/gacha/manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version -ne '9.9.9') { throw 'Existing extension version replaced' }
  if ((Get-Content (Join-Path $UserProfile 'extensions/gacha/owner-marker') -Raw) -ne 'keep my version') { throw 'Existing extension content replaced' }
 }
 if (Test-Path (Join-Path $UserProfile 'dsh-piggy')) { throw 'Legacy nested save directory recreated' }
 Screenshot ($Name+'-game') $root
 Open-GameMenu $root
 Wait-Until { Quit-Tile $script:Game.Id } 'native game menu' 20 | Out-Null
 Screenshot ($Name+'-menu')
 if($CheckIcons -and $Name -eq 'none'){Check-TrayIcon}
 if ($CheckExternal) {
  Click-Element (Wait-Until { Find-GameButton $script:Game.Id '设置' } 'settings tile')
  $back=Wait-Until { Find-GameButton $script:Game.Id '^‹$' } 'settings back button'
  $box=$back.Current.BoundingRectangle
  [void][PiggyNative]::SetCursorPos([int]($box.X+130),[int]($box.Y+180))
  $toggle=$null
  for ($scroll=0;$scroll -lt 30;$scroll++) {
   $toggle=Find-GameButton $script:Game.Id '允许 DSH 联动'
   if ($toggle) { break }
   [PiggyNative]::mouse_event(2048,0,0,[uint32]4294967176,[UIntPtr]::Zero)
   Start-Sleep -Milliseconds 180
  }
  if (-not $toggle) { throw 'Native external permission toggle not visible' }
  Click-Element $toggle
  Wait-Until { Test-Path (Join-Path $UserProfile 'work-endpoint/pair.json') } 'native pair service ready' 15 | Out-Null
  if (-not (Get-Content (Join-Path $UserProfile 'external.json') -Raw -Encoding UTF8 | ConvertFrom-Json).enabled) { throw 'Native toggle did not persist permission' }
  Screenshot ($Name+'-external-enabled')
  Click-Element (Wait-Until { Find-GameButton $script:Game.Id '允许 DSH 联动' } 'permission toggle after settings redraw' 15)
  Wait-Until { -not (Test-Path (Join-Path $UserProfile 'work-endpoint/pair.json')) } 'native pair service disabled' 15 | Out-Null
  for ($scroll=0;$scroll -lt 15;$scroll++) {
   $back=Find-GameButton $script:Game.Id '^‹$'
   if ($back) { break }
   [PiggyNative]::mouse_event(2048,0,0,1440,[UIntPtr]::Zero)
   Start-Sleep -Milliseconds 180
  }
  Click-Element (Wait-Until { Find-GameButton $script:Game.Id '^‹$' } 'back after settings redraw' 15)
  Wait-Until { Quit-Tile $script:Game.Id } 'home after external permission check' 15 | Out-Null
 }
 Close-Game $script:Game $root
 $script:Game=$null
 $state=Get-Content (Join-Path $UserProfile 'state.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if (-not $Fresh -and ($state.coins -ne 1314 -or $state.inventory.apple -ne 7 -or $state.name -ne 'Installer QA')) { throw 'Existing game progress changed' }
 Write-Host ('Game case complete: '+$Name)
 $Results.Add(@{case=$Name;installedExe=$true;nativeMenu=$true;nativeQuit=$true;proxy='unreachable 127.0.0.1:9';extensions=$Expected;freshHatch=$Fresh;defaultProfile=$UseDefault;windowMode=$WindowMode;externalPermission=$CheckExternal})
}
. (Join-Path $Repository 'apps/desktop/qa/windows-icons.ps1')
try {
 if ((Test-Path $DefaultProfile) -or (Test-Path $LegacyProfile)) { throw 'VM already contains a personal piggy profile; refusing to overwrite it' }
 node (Join-Path $Repository 'apps/desktop/qa/seed-installer-profile.mjs') $DataProfile $Repository
 if ($LASTEXITCODE -ne 0) { throw 'Fixture seed failed' }
 $env:PIGGY_USERDATA=$DataProfile
 Install-Pick 'none' @()
 if($CheckIcons){Check-InstalledIcons}
 Run-Game 'none' $DataProfile 1
 Install-Pick 'single' @('mine') $false $true
 Run-Game 'single' $DataProfile 2
 Install-Pick 'all' @('farm','mine','blindbox','gacha','pig-puzzle')
 Run-Game 'all' $DataProfile 5
 Run-Game 'restart' $DataProfile 5
 Run-Game 'split-external' $DataProfile 5 $false $false 'split' $true
 Run-Game 'stage-external' $DataProfile 5 $false $false 'stage' $true
 Install-Pick 'upgrade-subset' @('mine')
 Run-Game 'upgrade-subset' $DataProfile 5
 $before=Inventory $DataProfile
 $exeHash=(Get-FileHash (Join-Path $AppDir 'dsh-piggy.exe')).Hash
 Install-Pick 'cancel' @('farm','mine','blindbox','gacha','pig-puzzle') $true
 if ($exeHash -ne (Get-FileHash (Join-Path $AppDir 'dsh-piggy.exe')).Hash) { throw 'Cancel changed installed executable' }
 Install-Pick 'fresh-all' @('farm','mine','blindbox','gacha','pig-puzzle')
 node (Join-Path $Repository 'apps/desktop/qa/seed-installer-profile.mjs') (Join-Path $LegacyProfile 'dsh-piggy') $Repository
 if ($LASTEXITCODE -ne 0) { throw 'Legacy fixture seed failed' }
 Move-Item (Join-Path $LegacyProfile 'dsh-piggy/proxy.json') (Join-Path $LegacyProfile 'proxy.json')
 $oldHash=Inventory $LegacyProfile
 Run-Game 'default-migration' $DefaultProfile 5 $false $true
 if ($oldHash -ne (Inventory $LegacyProfile)) { throw 'Native default migration changed original legacy files' }
 Move-Item $DefaultProfile (Join-Path $Qa 'migrated-default-backup')
 Move-Item $LegacyProfile (Join-Path $Qa 'original-legacy-backup')
 Run-Game 'fresh-hatch' $DefaultProfile 5 $true $true
 $before=Inventory $DataProfile
 $freshBefore=Inventory $DefaultProfile
 $uninstall=Start-Process (Join-Path $AppDir 'Uninstall dsh-piggy.exe') -ArgumentList "/S _?=$AppDir" -PassThru
 if (-not $uninstall.WaitForExit(60000)) { throw 'Uninstaller timed out' }
 Wait-Until { -not (Test-Path (Join-Path $AppDir 'dsh-piggy.exe')) } 'uninstalled executable removal' 30 | Out-Null
 if ($before -ne (Inventory $DataProfile)) { throw 'Uninstall changed personal save or extensions' }
 if ($freshBefore -ne (Inventory $DefaultProfile)) { throw 'Uninstall changed default-profile save or extensions' }
 $Results.Add(@{case='uninstall';saveUntouched=$true;exitCode=$uninstall.ExitCode})
 @{ok=$true;cases=$Results;vm='GitHub windows-latest';input='native Win32 mouse';version='QA only, not published'} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $Out 'report.json') -Encoding UTF8
} catch {
 try { Screenshot 'failure-desktop' } catch {}
 foreach ($dir in @($DataProfile,$DefaultProfile)) {
  if (Test-Path (Join-Path $dir 'piggy.log')) { Copy-Item (Join-Path $dir 'piggy.log') (Join-Path $Out ((Split-Path $dir -Leaf)+'-piggy.log')) }
  if (Test-Path (Join-Path $dir 'window.json')) { Copy-Item (Join-Path $dir 'window.json') (Join-Path $Out ((Split-Path $dir -Leaf)+'-window.json')) }
 }
 try {
  $script:LastRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { @{name=$_.Current.Name;type=$_.Current.ControlType.ProgrammaticName;id=$_.Current.AutomationId;rect=$_.Current.BoundingRectangle.ToString()} } | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Out 'failure-controls.json') -Encoding UTF8
 } catch {}
 @{ok=$false;error=$_.Exception.ToString();cases=$Results} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $Out 'report.json') -Encoding UTF8
 throw
} finally {
 if ($script:Game -and -not $script:Game.HasExited) { Stop-Process -Id $script:Game.Id -Force -ErrorAction SilentlyContinue }
}
