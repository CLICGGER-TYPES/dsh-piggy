// @ts-check
/**
 * 物理层的固定包络：只依赖猪的布局盒和最大形变，不读运行时 transform。
 *
 * 桌面窗口（Linux 的 setShape 还会裁画面）必须把这整块算进可点/可见区域，
 * 否则倾斜、拉长、压扁时会重演「头顶被裁」。包络是保守值：把压扁和拉长两个
 * 方向、左右两个倾角都取并集，回稳后由 measure 移除。
 * @module dsh-piggy/client/feel/envelope
 */
import { FEEL } from './config.js'

const corners = box => [
  { x: box.x, y: box.y },
  { x: box.x + box.width, y: box.y },
  { x: box.x, y: box.y + box.height },
  { x: box.x + box.width, y: box.y + box.height },
]

function bounds(points) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const point of points) {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, point.y)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function union(...boxes) {
  return bounds(boxes.flatMap(corners))
}

/**
 * 一层变换：绕 pivot 缩放 +（可选）旋转 + 平移。
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{x:number,y:number}} pivot
 * @param {{scaleX:number,scaleY:number,rotate:number,dy:number}} state
 */
function transformed(box, pivot, state) {
  const radians = state.rotate * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return corners(box).map(point => {
    const x = (point.x - pivot.x) * state.scaleX
    const y = (point.y - pivot.y) * state.scaleY
    return {
      x: pivot.x + x * cos - y * sin,
      y: pivot.y + x * sin + y * cos + state.dy,
    }
  })
}

/**
 * 一个极限姿态的包围盒：先做身体层（绕 85% 缩放 + 旋转），再做拎起层
 * （绕头顶只做缩放）。和 DOM 的嵌套顺序一致。
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{squash:number,hold:number,tilt:number,hop:number}} pose
 */
function poseEnvelope(box, pose, pigBox = box) {
  const bodyPivot = { x: pigBox.x + pigBox.width * 0.5, y: pigBox.y + pigBox.height * 0.85 }
  const holdPivot = { x: pigBox.x + pigBox.width * 0.5, y: pigBox.y }
  const body = transformed(box, bodyPivot, {
    scaleX: 1 + FEEL.volumeK * pose.squash,
    scaleY: 1 - pose.squash,
    rotate: pose.tilt,
    dy: -pose.hop,
  })
  const hold = transformed(
    { x: Math.min(...body.map(p => p.x)), y: Math.min(...body.map(p => p.y)),
      width: Math.max(...body.map(p => p.x)) - Math.min(...body.map(p => p.x)),
      height: Math.max(...body.map(p => p.y)) - Math.min(...body.map(p => p.y)) },
    holdPivot,
    { scaleX: 1 - FEEL.holdNarrow * pose.hold, scaleY: 1 + pose.hold, rotate: 0, dy: 0 },
  )
  // 上面用「身体层的包围盒」再缩放会略保守；把原始四角的完整组合也算进来，
  // 免得包围盒扩张后又被缩回去，漏掉旋转后的角。
  const exact = corners(box).map(point => {
    const bodyPoint = {
      x: bodyPivot.x + (point.x - bodyPivot.x) * (1 + FEEL.volumeK * pose.squash),
      y: bodyPivot.y + (point.y - bodyPivot.y) * (1 - pose.squash) - pose.hop,
    }
    const radians = pose.tilt * Math.PI / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const rotated = {
      x: bodyPivot.x + (bodyPoint.x - bodyPivot.x) * cos - (bodyPoint.y - bodyPivot.y) * sin,
      y: bodyPivot.y + (bodyPoint.x - bodyPivot.x) * sin + (bodyPoint.y - bodyPivot.y) * cos,
    }
    return {
      x: holdPivot.x + (rotated.x - holdPivot.x) * (1 - FEEL.holdNarrow * pose.hold),
      y: holdPivot.y + (rotated.y - holdPivot.y) * (1 + pose.hold),
    }
  })
  return union(bounds(hold), bounds(exact))
}

/**
 * 物理包络。默认按最大压扁/拉长/倾斜算；显式传入姿态时只算那一个姿态。
 * @param {{x:number,y:number,width:number,height:number}} pigBox
 * @param {{squash?:number,hold?:number,tilt?:number,hop?:number}} [pose]
 * @param {{x:number,y:number,width:number,height:number}} [artBox] 绘制范围，变换中心仍取猪布局盒
 */
export function feelEnvelope(pigBox, pose, artBox = pigBox) {
  if (pigBox.width <= 0 || pigBox.height <= 0) return { x: pigBox.x, y: pigBox.y, width: pigBox.width, height: pigBox.height }
  if (pose !== undefined) {
    return poseEnvelope(artBox, {
      squash: Number.isFinite(pose.squash) ? pose.squash : 0,
      hold: Number.isFinite(pose.hold) ? pose.hold : 0,
      tilt: Number.isFinite(pose.tilt) ? pose.tilt : 0,
      hop: Number.isFinite(pose.hop) ? pose.hop : 0,
    }, pigBox)
  }
  // 挤压两个方向都要盖住：落地回弹会短暂反向拉长。
  const squashes = [FEEL.squashMax, -FEEL.squashMax * 0.45]
  const tilts = [-FEEL.tiltMaxFly, FEEL.tiltMaxFly]
  const boxes = []
  for (const squash of squashes) {
    for (const tilt of tilts) {
      boxes.push(poseEnvelope(artBox, { squash: squash, hold: FEEL.holdMax, tilt: tilt, hop: 0 }, pigBox))
      boxes.push(poseEnvelope(artBox, { squash: squash, hold: 0, tilt: tilt, hop: 0 }, pigBox))
    }
  }
  return union(...boxes)
}
