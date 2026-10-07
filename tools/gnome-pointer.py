#!/usr/bin/env python3
"""GNOME（Wayland）下注入真实鼠标：走 Mutter 的 RemoteDesktop D-Bus 接口（GNOME 远程桌面同一条路）。

ydotool 在新版 udev 下会被认成纯键盘、GNOME 不把它当鼠标，所以桌面版的真拖动测试用这个。
从 stdin 逐行读命令，每条执行完回一行 ok：
  move X Y     指针移到屏幕绝对坐标（逻辑像素）
  down / up    左键按下 / 松开
  sleep MS     等一会儿
stdin 关掉就结束会话（会话挂着录屏流，别长时间开着）。

第二个参数给一个 .mkv 路径就同时录屏（带鼠标指针，每帧有真实时间戳）：拖动测试要看的是
「屏幕上真正显示了什么」，不是页面自己报的坐标——见 tools/drag-film.py。
"""
import signal
import subprocess
import time
import sys
import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib

BUS = Gio.bus_get_sync(Gio.BusType.SESSION)
BTN_LEFT = 0x110


def call(path, iface, method, args=None, reply='()'):
    return BUS.call_sync(_dest(iface), path, iface, method,
                         args, GLib.VariantType(reply), Gio.DBusCallFlags.NONE, -1, None)


def _dest(iface):
    return 'org.gnome.Mutter.RemoteDesktop' if 'RemoteDesktop' in iface else 'org.gnome.Mutter.ScreenCast'


rd_path = call('/org/gnome/Mutter/RemoteDesktop', 'org.gnome.Mutter.RemoteDesktop', 'CreateSession', None, '(o)').unpack()[0]
rd_id = BUS.call_sync('org.gnome.Mutter.RemoteDesktop', rd_path, 'org.freedesktop.DBus.Properties', 'Get',
                      GLib.Variant('(ss)', ('org.gnome.Mutter.RemoteDesktop.Session', 'SessionId')),
                      GLib.VariantType('(v)'), Gio.DBusCallFlags.NONE, -1, None).unpack()[0]
sc_path = call('/org/gnome/Mutter/ScreenCast', 'org.gnome.Mutter.ScreenCast', 'CreateSession',
               GLib.Variant('(a{sv})', ({'remote-desktop-session-id': GLib.Variant('s', rd_id)},)), '(o)').unpack()[0]
# 录主显示器：绝对坐标要挂在一个 stream 上；给了录像路径时同一个 stream 也拿来录屏
connector = sys.argv[1] if len(sys.argv) > 1 else 'Virtual-1'
record = sys.argv[2] if len(sys.argv) > 2 else None
# cursor-mode 1：指针画进画面里（录屏时要看猪跟不跟手）
stream = call(sc_path, 'org.gnome.Mutter.ScreenCast.Session', 'RecordMonitor',
              GLib.Variant('(sa{sv})', (connector, {'cursor-mode': GLib.Variant('u', 1)})), '(o)').unpack()[0]
node = []
BUS.signal_subscribe('org.gnome.Mutter.ScreenCast', 'org.gnome.Mutter.ScreenCast.Stream', 'PipeWireStreamAdded',
                     stream, None, Gio.DBusSignalFlags.NONE, lambda *a: node.append(a[5].unpack()[0]))
call(rd_path, 'org.gnome.Mutter.RemoteDesktop.Session', 'Start')

ctx = GLib.MainContext.default()
deadline = time.time() + 5
while not node and time.time() < deadline:
    ctx.iteration(False)
    time.sleep(0.01)
for _ in range(50):
    ctx.iteration(False)

recorder = None
if record and node:
    recorder = subprocess.Popen(['gst-launch-1.0', '-e', 'pipewiresrc', f'path={node[0]}', 'do-timestamp=true', 'always-copy=true',
                                 '!', 'videoconvert', '!', 'jpegenc', 'quality=80', '!', 'matroskamux', '!', 'filesink', f'location={record}'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)

T0 = time.monotonic()
print('ready', flush=True)
for line in sys.stdin:
    parts = line.split()
    if not parts:
        continue
    if parts[0] == 'sleep':
        time.sleep(int(parts[1]) / 1000)
    elif parts[0] == 'move':
        call(rd_path, 'org.gnome.Mutter.RemoteDesktop.Session', 'NotifyPointerMotionAbsolute',
             GLib.Variant('(sdd)', (stream, float(parts[1]), float(parts[2]))))
    elif parts[0] in ('down', 'up'):
        call(rd_path, 'org.gnome.Mutter.RemoteDesktop.Session', 'NotifyPointerButton',
             GLib.Variant('(ib)', (BTN_LEFT, parts[0] == 'down')))
    for _ in range(5):
        ctx.iteration(False)
    # 每条命令执行的时刻（相对录屏开始），录像分析时拿它对齐鼠标轨迹
    print(f'ok {time.monotonic() - T0:.4f} {line.strip()}', flush=True)
if recorder is not None:
    time.sleep(1.0)
    recorder.send_signal(signal.SIGINT)
    try:
        recorder.wait(timeout=10)
    except subprocess.TimeoutExpired:
        recorder.kill()
call(rd_path, 'org.gnome.Mutter.RemoteDesktop.Session', 'Stop')
