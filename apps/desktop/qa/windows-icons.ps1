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
 foreach($id in $ids){
  $cond=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,[int]$id)
  foreach($root in [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$cond)){
   if($root.Current.IsOffscreen){continue}
   foreach($e in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)){
    $c=$e.Current;$r=$c.BoundingRectangle
    if($c.Name -match $Pattern -and -not $c.IsOffscreen -and $r.Width -gt 5 -and $r.Height -gt 5 -and ($null -eq $Type -or $c.ControlType -eq $Type)){return $e}
   }
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
 [PiggyIconNative]::Keys(0x44,$true)
 [PiggyIconNative]::Keys(0x5B,$false)
 Start-Sleep -Milliseconds 650
 [System.Windows.Forms.SendKeys]::SendWait('dsh-piggy')
 $entry=Wait-Until {Find-SystemElement '^dsh-piggy(?:, App| App)?$' @('SearchHost','StartMenuExperienceHost','SearchApp')} 'native Start menu search result' 25
 Screenshot 'icon-start-menu-native'
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
 Start-Sleep -Milliseconds 250
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
 $Results.Add(@{case='approved-face-installer-exe-shortcuts';shellIcons=$IconChecks.Count;nativeDesktop=$true;nativeStartMenu=$true})
}
function Check-TrayIcon {
 $button=Find-SystemElement '^dsh-piggy(?:,|$)' @('explorer','ShellExperienceHost') ([System.Windows.Automation.ControlType]::Button)
 if(-not $button){
  $more=Wait-Until {Find-SystemElement 'Show hidden icons|显示隐藏的图标|Notification Chevron' @('explorer','ShellExperienceHost') ([System.Windows.Automation.ControlType]::Button)} 'native notification overflow button' 15
  Click-Element $more
  $button=Wait-Until {Find-SystemElement '^dsh-piggy(?:,|$)' @('explorer','ShellExperienceHost') ([System.Windows.Automation.ControlType]::Button)} 'installed game tray icon' 15
 }
 Screenshot 'icon-tray-native' $button
 Screenshot 'icon-tray-context-native'
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
 $Results.Add(@{case='approved-face-native-tray';nativeMouse=$true})
}
