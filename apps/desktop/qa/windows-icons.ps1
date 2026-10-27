# Native Windows branding checks; dot-sourced by the isolated installer harness.
Add-Type @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
public class PiggyIconNative {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 public struct FileInfo { public IntPtr icon; public int index; public uint attributes;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string display;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string type; }
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SHGetFileInfo(string path,uint flags,out FileInfo info,uint size,uint options);
 [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
 [DllImport("user32.dll")] static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
 public static Bitmap ReadIcon(string path) {
  FileInfo info;
  if (SHGetFileInfo(path,0,out info,(uint)Marshal.SizeOf(typeof(FileInfo)),0x100)==IntPtr.Zero || info.icon==IntPtr.Zero) throw new Exception("Shell icon missing: "+path);
  try { using(var icon=Icon.FromHandle(info.icon)) return icon.ToBitmap(); } finally { DestroyIcon(info.icon); }
 }
 public static void Keys(byte key, bool win) {
  if(win) keybd_event(0x5B,0,0,UIntPtr.Zero);
  keybd_event(key,0,0,UIntPtr.Zero);keybd_event(key,0,2,UIntPtr.Zero);
  if(win) keybd_event(0x5B,0,2,UIntPtr.Zero);
 }
}
'@ -ReferencedAssemblies System.Drawing
$IconChecks=[System.Collections.Generic.List[object]]::new()
function Check-ShellIcon([string]$Name,[string]$Path) {
 $Path=[System.IO.Path]::GetFullPath($Path.Replace('/','\'))
 $actual=[PiggyIconNative]::ReadIcon($Path)
 $expectedIcon=[System.Drawing.Icon]::new((Join-Path $Repository 'apps/desktop/build/icon.ico'),[System.Drawing.Size]::new($actual.Width,$actual.Height))
 $expected=$expectedIcon.ToBitmap()
 try {
  $diff=0.0;$count=0
  for($y=0;$y -lt $actual.Height;$y++){for($x=0;$x -lt $actual.Width;$x++){
   # Shortcut arrows may occupy the lower-left quadrant; keep the face itself.
   if($x -lt $actual.Width/2 -and $y -ge $actual.Height/2){continue}
   $want=$expected.GetPixel($x,$y);if($want.A -lt 192){continue}
   $got=$actual.GetPixel($x,$y)
   $diff += [Math]::Abs([int]$got.R-[int]$want.R)+[Math]::Abs([int]$got.G-[int]$want.G)+[Math]::Abs([int]$got.B-[int]$want.B)+[Math]::Abs([int]$got.A-[int]$want.A)
   $count++
  }}
  if($count -lt 100){throw 'Not enough opaque icon pixels'}
  $mean=$diff/($count*4)
  $actual.Save((Join-Path $Out ('icon-'+$Name+'-shell.png')))
  $IconChecks.Add(@{name=$Name;file=(Split-Path $Path -Leaf);width=$actual.Width;height=$actual.Height;meanRgbaError=$mean;samples=$count})
  $IconChecks | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Out 'icon-comparisons.json') -Encoding UTF8
  if($mean -gt 12){throw "Shell icon differs from the approved pig face: $Name ($mean)"}
 } finally {$actual.Dispose();$expected.Dispose();$expectedIcon.Dispose()}
}
function Find-SystemElement([string]$Pattern,[string[]]$Processes,$Type=$null) {
 $ids=@(Get-Process -Name $Processes -ErrorAction SilentlyContinue | ForEach-Object Id)
 # XAML accessibility children can live in a different process from their
 # top-level proxy. Match the actual element owner, not the window proxy.
 foreach($root in [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)){
  foreach($e in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)){
   $c=$e.Current;$r=$c.BoundingRectangle
   if($c.ProcessId -in $ids -and $c.Name -match $Pattern -and -not $c.IsOffscreen -and $r.Width -gt 5 -and $r.Height -gt 5 -and ($null -eq $Type -or $c.ControlType -eq $Type)){return $e}
  }
 }
 return $null
}
function Check-InstalledIcons {
 Check-ShellIcon 'installer' $Installer
 Check-ShellIcon 'application' (Join-Path $AppDir 'dsh-piggy.exe')
 Check-ShellIcon 'uninstaller' (Join-Path $AppDir 'Uninstall dsh-piggy.exe')
 $wsh=New-Object -ComObject WScript.Shell
 $shortcuts=@{}
 foreach($kind in @('Desktop','Programs')){
  $dir=[Environment]::GetFolderPath($kind)
  $link=Get-ChildItem $dir -Filter '*.lnk' -Recurse | Where-Object {
   $s=$wsh.CreateShortcut($_.FullName)
   $s.TargetPath -ieq (Join-Path $AppDir 'dsh-piggy.exe')
  } | Select-Object -First 1
  if(-not $link){throw "Installed $kind shortcut missing"}
  Check-ShellIcon $kind.ToLower() $link.FullName
  $shortcuts[$kind]=$link.FullName
 }
 $shortcuts | ConvertTo-Json | Set-Content (Join-Path $Out 'icon-shortcuts.json') -Encoding UTF8
 [PiggyIconNative]::Keys(0x44,$true)
 Start-Sleep -Milliseconds 700
 $desktopIcon=Wait-Until {Find-SystemElement '^dsh-piggy$' @('explorer') ([System.Windows.Automation.ControlType]::ListItem)} 'desktop shortcut visible' 15
 Screenshot 'icon-desktop-native' $desktopIcon
 $start=Wait-Until {Find-SystemElement '^Start$' @('explorer') ([System.Windows.Automation.ControlType]::Button)} 'native Start button' 15
 Click-Element $start
 # This hosted Server image renders Start XAML but exposes the desktop
 # through UIA FromPoint. Use the observed native screenshot coordinates and
 # capture every All apps page for explicit visual review after the run.
 $screen=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
 if($screen.Width -ne 1024 -or $screen.Height -ne 768){throw 'Unreviewed native Start menu screen geometry'}
 Start-Sleep -Milliseconds 800
 Screenshot 'icon-start-menu-open-native'
 Mouse-Point 743 154
 Start-Sleep -Milliseconds 800
 for($attempt=0;$attempt -lt 8;$attempt++){
  Screenshot ('icon-start-menu-page-'+$attempt+'-native')
  [void][PiggyNative]::SetCursorPos(500,450)
  [PiggyNative]::mouse_event(0x0800,0,0,4294966936,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 450
 }
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
 Start-Sleep -Milliseconds 250
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
 $Results.Add(@{case='approved-face-installer-exe-shortcuts';shellIcons=$IconChecks.Count;nativeDesktop=$true;nativeStartMenuCaptured=$true;startVisualReview='required'})
}
function Check-TrayIcon {
 $button=Find-SystemElement '^dsh-piggy(?:,|$)' @('explorer','ShellExperienceHost') ([System.Windows.Automation.ControlType]::Button)
 if($button){Screenshot 'icon-tray-native' $button}
 else {
  # The same hosted XAML accessibility limitation applies to notification
  # overflow. Capture the real desktop before/after clicking its visible caret.
  $screen=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  if($screen.Width -ne 1024 -or $screen.Height -ne 768){throw 'Unreviewed native tray screen geometry'}
  Screenshot 'icon-tray-before-native'
  Mouse-Point 805 744
  Start-Sleep -Milliseconds 700
 }
 Screenshot 'icon-tray-context-native'
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
 $Results.Add(@{case='approved-face-native-tray';nativeMouse=$true;visualReview='required'})
}
