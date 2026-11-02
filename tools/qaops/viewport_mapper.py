"""Convert a fresh CDP viewport point to X11 pixels using live window geometry."""
from math import isfinite


def viewport_to_native_point(point, dom, bounds):
    """Return explicit viewport/native points; raise ValueError if geometry disagrees.

    `point` is a CSS-pixel {x,y} from getBoundingClientRect/elementFromPoint.
    `dom` supplies inner/outer dimensions and devicePixelRatio from that same target.
    `bounds` is the live owned X11 window {x,y,width,height} in screen pixels.
    """
    dpr = float(dom["devicePixelRatio"])
    inner_w, inner_h = float(dom["innerWidth"]), float(dom["innerHeight"])
    outer_w, outer_h = float(dom["outerWidth"]), float(dom["outerHeight"])
    x, y = float(point["x"]), float(point["y"])
    bx, by = int(bounds["x"]), int(bounds["y"])
    bw, bh = int(bounds["width"]), int(bounds["height"])
    if not all(isfinite(v) for v in (dpr, inner_w, inner_h, outer_w, outer_h, x, y)) or dpr <= 0:
        raise ValueError("invalid DOM viewport geometry")
    if inner_w <= 0 or inner_h <= 0 or outer_w < inner_w or outer_h < inner_h:
        raise ValueError("invalid DOM outer/inner dimensions")
    if not (0 <= x < inner_w and 0 <= y < inner_h):
        raise ValueError("viewport point lies outside current content")

    # Native bounds are physical X pixels; DOM dimensions are CSS pixels.
    extra_x = bw - inner_w * dpr
    extra_y = bh - inner_h * dpr
    expected_x = (outer_w - inner_w) * dpr
    expected_y = (outer_h - inner_h) * dpr
    tolerance = max(2.0, dpr)
    if abs(extra_x - expected_x) > tolerance or abs(extra_y - expected_y) > tolerance:
        raise ValueError("native window bounds do not match fresh DOM outer/inner geometry")

    origin_x = bx + extra_x / 2
    origin_y = by + extra_y
    screen_x, screen_y = round(origin_x + x * dpr), round(origin_y + y * dpr)
    if not (bx <= screen_x < bx + bw and by <= screen_y < by + bh):
        raise ValueError("mapped screen point lies outside the owned native window")
    return {
        "viewportPointCss": {"x": x, "y": y},
        "viewportSizeCss": {"width": inner_w, "height": inner_h},
        "outerSizeCss": {"width": outer_w, "height": outer_h},
        "devicePixelRatio": dpr,
        "nativeWindowBoundsPx": {"x": bx, "y": by, "width": bw, "height": bh},
        "contentOriginPx": {"x": origin_x, "y": origin_y},
        "screenPointPx": {"x": screen_x, "y": screen_y},
        "mapping": "live X11 window bounds + fresh DOM outer/inner sizes × devicePixelRatio",
    }
