/**
 * 点日历/礼包不能变成摸摸（TOUCH03）。
 *
 * 这些用例走完整的 pointerdown → pointerup → click 序列：图标自己的
 * stopPropagation、动作返回后同一坐标的第二击、以及礼包按住换位，都必须
 * 只产生签到/礼包动作，不能冒出 touch/pet。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findByClass, hostOf, mount, settle, SNAPSHOT } from '../../helpers/bundle.js'
import { press } from '../../helpers/pointer.js'

const rect = (x, y, width, height) => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height })
const posted = calls => calls
  .filter(call => call.method === 'POST')
  .map(call => JSON.parse(String(call.body)).action)

/** 把场景/猪/emoji 放到同一个盒子，让命中点落在猪墨迹里。 */
function stage(dom, box) {
  const host = hostOf(dom)
  for (const name of ['dp-scene', 'dp-pig', 'dp-pig-emoji']) {
    const node = findByClass(host, name)
    if (node !== undefined) node.rect = box
  }
  return { host, scene: findByClass(host, 'dp-scene') }
}

test('tapping the sign-in bubble sends only signIn; the next tap at the same spot is not a pet', async () => {
  const daily = { ...SNAPSHOT.daily, canSignIn: true, signInDay: 5, unclaimed: 0 }
  const signed = { ...daily, canSignIn: false, signInTotal: 5 }
  const { dom, calls } = await mount({
    status: { ...SNAPSHOT, daily },
    actResult: { ...SNAPSHOT, daily: signed },
  })
  const { host } = stage(dom, rect(100, 100, 56, 56))
  const scene = findByClass(host, 'dp-scene')
  const hint = findByClass(host, 'dp-daily')
  // 故意让日历和猪重叠：拦住第二击的必须是盾，不是“点不到猪”的几何巧合。
  hint.rect = rect(100, 100, 40, 30)
  assert.equal(hint.hidden, false)

  press(hint, 'pointerdown', { clientX: 120, clientY: 112 })
  press(hint, 'pointerup', { clientX: 120, clientY: 112 })
  press(hint, 'click', { clientX: 120, clientY: 112 })
  await settle(); await settle()
  assert.deepEqual(posted(calls), ['signIn'])
  assert.equal(hint.hidden, true, '动作结果已经把图标藏起来了')

  // 同一坐标的第二击现在落在场景/猪身上：没有防穿透盾就会发 touch/pet。
  press(scene, 'pointerdown', { clientX: 120, clientY: 112 })
  press(scene, 'pointerup', { clientX: 120, clientY: 112 })
  await settle()
  assert.deepEqual(posted(calls), ['signIn'], '第二击不能变成摸摸')
})

test('a gift held while it moves beside the pig never starts a drag or a pet', async () => {
  const daily = { ...SNAPSHOT.daily, canSignIn: false, unclaimed: 2 }
  const { dom, calls } = await mount({
    status: { ...SNAPSHOT, daily },
    actResult: { ...SNAPSHOT, daily: { ...daily, unclaimed: 0 } },
  })
  const { host } = stage(dom, rect(100, 100, 56, 56))
  const scene = findByClass(host, 'dp-scene')
  const hint = findByClass(host, 'dp-daily')
  const bubble = findByClass(host, 'dp-bubble')
  bubble.hidden = false // 礼包只在气泡还在时按住不失位
  assert.equal(hint.allText(), '🎁')
  hint.rect = rect(100, 100, 40, 30)

  press(hint, 'pointerdown', { clientX: 112, clientY: 110, pointerId: 7 })
  assert.equal(host.getAttribute('data-gift-held'), 'true', '按下后礼包挪到猪身侧')
  hint.rect = rect(120, 100, 40, 30)

  // 指针还停在原坐标，场景收到 move/up：不能开始拖动或摸摸。
  press(scene, 'pointermove', { clientX: 120, clientY: 110, pointerId: 7 })
  press(scene, 'pointerup', { clientX: 120, clientY: 110, pointerId: 7 })
  await settle()
  assert.deepEqual(posted(calls), [], '按住移动期间没有动作，更没有 touch/pet')

  // 在移动后的礼包上松开并点击：只领礼包。
  press(hint, 'pointerup', { clientX: 130, clientY: 112, pointerId: 7 })
  press(hint, 'click', { clientX: 130, clientY: 112 })
  await settle(); await settle()
  assert.deepEqual(posted(calls), ['openGift'])
  assert.equal(hint.hidden, true, '领完之后礼包消失')

  // 在同一块“礼包刚待过”的位置再点一下：这里也可能压着猪，仍然不许摸摸。
  press(scene, 'pointerdown', { clientX: 130, clientY: 112, pointerId: 8 })
  press(scene, 'pointerup', { clientX: 130, clientY: 112, pointerId: 8 })
  await settle()
  assert.deepEqual(posted(calls), ['openGift'], '礼包消失后的第二击不能变成 touch/pet')
})
