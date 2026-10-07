#!/usr/bin/env python3
"""逐帧看一次真拖的录像（tools/desktop-geometry-check.mjs 设 PIGGY_FILM_DIR 录的 .mkv + .txt）。

只看起止坐标看不出「拖着拖着跳一下」「松手瞬移」「闪一帧」——这些都在中间几帧里。这里：
  1. 每一帧找猪（猪是桃粉色的，从按下的位置开始跟踪），量它在屏幕上的实际位置；
  2. 用 .txt 里鼠标每一步的时刻算出「猪此刻该在哪」（猪跟着按下那一刻的抓点走），
     录像和鼠标时间轴按「猪开始动的那一帧」对齐；
  3. 报：猪消失（闪一帧）、拖动中落后鼠标多少、有没有往回跳、松手后有没有动。

用法：uv run --with numpy --with scipy python tools/drag-film.py 目录或文件.mkv …
判定（默认阈值）：拖动中没有一帧丢猪、没有往回跳 >3px；松手后的每一帧离最终位置 ≤2px。
落后鼠标的像素数只报告不判定（虚拟机没有显卡，合成本身就慢，真机另看）。
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

W, H = 1280, 800


def frames_of(path):
    times = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'frame=pts_time',
                            '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout.split()
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-fps_mode', 'passthrough', '-f', 'rawvideo',
                          '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    n = len(raw) // (W * H * 3)
    video = np.frombuffer(raw[: n * W * H * 3], dtype=np.uint8).reshape(n, H, W, 3)
    return [float(t) for t in times[:n]], video


def timeline_of(path):
    """鼠标时间轴：[(t, kind, x, y)]，t 是相对录屏开始（ready 那一刻）的秒数。"""
    out = []
    for line in Path(path).read_text().splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[0] == 'ok':
            t, kind = float(parts[1]), parts[2]
            if kind == 'move':
                out.append((t, 'move', float(parts[3]), float(parts[4])))
            elif kind in ('down', 'up'):
                out.append((t, kind, None, None))
    return out


def pig_mask(img):
    # 猪身子是很匀的桃粉色（255,209,175 上下几个数）：卡得紧一点，Dock 图标、按钮这些相近的颜色才不会混进来
    r, g, b = (img[..., i].astype(np.int16) for i in range(3))
    return (r >= 248) & (abs(g - 209) <= 9) & (abs(b - 175) <= 12)


def find_pig(img, near, radius=140):
    """在 near 附近找猪：取离 near 最近、大小像一只猪的那一块（不是把附近所有像素平均）。"""
    from scipy import ndimage
    x0, y0 = int(near[0]), int(near[1])
    xa, xb = max(0, x0 - radius), min(W, x0 + radius)
    ya, yb = max(0, y0 - radius), min(H, y0 + radius)
    mask = pig_mask(img[ya:yb, xa:xb])
    # 猪身上有眼睛鼻子把色块切开：先膨胀一点再分块
    labels, n = ndimage.label(ndimage.binary_dilation(mask, iterations=3))
    best = None
    for k in range(1, n + 1):
        ys, xs = np.nonzero((labels == k) & mask)
        if len(xs) < 150:
            continue
        # 用外接框中心，不用颜色重心：鼠标指针压在猪身上，按下时还会换成抓手，重心会被带偏几像素
        cx, cy = float((xs.min() + xs.max()) / 2 + xa), float((ys.min() + ys.max()) / 2 + ya)
        d = (cx - near[0]) ** 2 + (cy - near[1]) ** 2
        if best is None or d < best[0]:
            best = (d, cx, cy, int(len(xs)))
    return None if best is None else best[1:]


def cursor_at(timeline, t):
    pos = None
    for tt, kind, x, y in timeline:
        if tt > t:
            break
        if kind == 'move':
            pos = (x, y)
    return pos


def analyse(mkv):
    txt = mkv.with_suffix('.txt')
    timeline = timeline_of(txt)
    times, video = frames_of(mkv)
    down = next(t for t, k, _, _ in timeline if k == 'down')
    up = next(t for t, k, _, _ in timeline if k == 'up')
    grab = cursor_at(timeline, down)
    if grab is None:
        return {'file': mkv.name, 'error': '时间轴里按下之前没有鼠标位置'}
    moves_after_down = [(t, x, y) for t, k, x, y in timeline if k == 'move' and t > down]
    # 跟踪猪：从抓点开始
    track = []
    near = grab
    for i, img in enumerate(video):
        hit = find_pig(img, near)
        track.append(hit)
        if hit is not None:
            near = (hit[0], hit[1])
    first = next((i for i, h in enumerate(track) if h is not None), None)
    if first is None:
        return {'file': mkv.name, 'error': '一帧都没找到猪'}
    start = track[first]
    # 对齐：猪第一次离开起点超过 15px 的那一帧 = 鼠标第一次离开抓点超过 15px 的时刻
    # （阈值要大过猪自己晃动的幅度；录的时候也把待机晃动关了，见 desktop-geometry-check.mjs）
    moved = next((i for i in range(first, len(track)) if track[i] is not None
                  and ((track[i][0] - start[0]) ** 2 + (track[i][1] - start[1]) ** 2) ** 0.5 > 15), None)
    lead = next(((t, x, y) for t, x, y in moves_after_down if ((x - grab[0]) ** 2 + (y - grab[1]) ** 2) ** 0.5 > 15), None)
    if moved is None or lead is None:
        return {'file': mkv.name, 'error': '猪一直没动（拖动没生效？）'}
    offset = times[moved] - lead[0]
    pig_off = (start[0] - grab[0], start[1] - grab[1])
    lost, back, lags, after = [], [], [], []
    final = next(h for h in reversed(track) if h is not None)
    for i in range(first, len(track)):
        t = times[i] - offset
        h = track[i]
        if h is None:
            if down <= t <= up + 1.0:
                lost.append(round(t, 3))
            continue
        if down <= t <= up:
            c = cursor_at(timeline, t)
            if c is not None:
                lags.append(((h[0] - (c[0] + pig_off[0])) ** 2 + (h[1] - (c[1] + pig_off[1])) ** 2) ** 0.5)
            prev = next((track[j] for j in range(i - 1, first - 1, -1) if track[j] is not None), None)
            if prev is not None:
                dir_x = moves_after_down[-1][1] - grab[0]
                dir_y = moves_after_down[-1][2] - grab[1]
                step = ((h[0] - prev[0]) * np.sign(dir_x) + (h[1] - prev[1]) * np.sign(dir_y))
                if step < -3:
                    back.append((round(t, 3), round(float(step), 1)))
        elif t > up + 0.15:
            after.append(max(abs(h[0] - final[0]), abs(h[1] - final[1])))
    fps = len(times) / (times[-1] - times[0]) if len(times) > 1 else 0
    gaps = np.diff(times) if len(times) > 1 else np.array([0])
    result = {
        'file': mkv.name,
        'frames': len(times), 'fps': round(fps, 1), 'max_frame_gap_ms': round(float(gaps.max()) * 1000, 1),
        'pig_lost_frames': lost,
        'backward_steps': back,
        'lag_px': {'median': round(float(np.median(lags)), 1), 'max': round(float(np.max(lags)), 1)} if lags else None,
        'after_release_max_move_px': round(float(max(after)), 1) if after else None,
        'final_vs_expected_px': None,
    }
    end = cursor_at(timeline, up)
    if end is not None and final is not None:
        result['final_vs_expected_px'] = round(((final[0] - (end[0] + pig_off[0])) ** 2 + (final[1] - (end[1] + pig_off[1])) ** 2) ** 0.5, 1)
    result['ok'] = (not lost and not back and (result['after_release_max_move_px'] or 0) <= 2)
    return result


def main():
    files = []
    for arg in sys.argv[1:]:
        p = Path(arg)
        files += sorted(p.glob('*.mkv')) if p.is_dir() else [p]
    bad = 0
    for f in files:
        r = analyse(f)
        bad += 0 if r.get('ok') else 1
        print(json.dumps(r, ensure_ascii=False))
    print('ALL OK' if bad == 0 else f'FAIL {bad}/{len(files)}')


if __name__ == '__main__':
    main()
