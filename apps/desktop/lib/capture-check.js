// @ts-check
/** 测试用：对页面执行一串步骤并截图（含透明像素），然后退出。 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {{ app: any, getPetWindow: () => any, primaryPet: () => any }} deps
 */
export function createCaptureCheck(deps) {
  /**
   * Testing: run a list of steps against the page and photograph it (with its
   * transparency), printing the clickable regions each time; then quit. Wayland
   * desktops cannot be screenshotted from here, so this is how the window is
   * checked. Steps (PIGGY_CAPTURE_STEPS, JSON): { js } runs code in the page,
   * { click } clicks a selector inside the pig, { wait } pauses, { shot } saves a PNG.
   */
  return async function captureForCheck(dir) {
    const wait = ms => new Promise(done => setTimeout(done, ms))
    const steps = process.env.PIGGY_CAPTURE_STEPS
      ? JSON.parse(process.env.PIGGY_CAPTURE_STEPS)
      : [{ shot: 'first' }, { js: "document.querySelector('[data-dsh-pig] .dp-scene').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))" }, { shot: 'toggled' }]
    mkdirSync(dir, { recursive: true })
    await wait(2500)
    for (const step of steps) {
      if (step.wait) await wait(step.wait)
      if (step.js) await deps.getPetWindow().webContents.executeJavaScript(step.js).catch(error => console.log('[capture] js failed', String(error)))
      if (step.click) {
        const ok = await deps.getPetWindow().webContents.executeJavaScript(`(() => { const n = document.querySelector('[data-dsh-pig] ${step.click.replace(/'/g, "\\'")}'); if (n) n.click(); return n !== null })()`)
        console.log('[capture] click', step.click, ok)
        await wait(400)
      }
      if (step.shot) {
        await wait(1200)
        const image = await deps.getPetWindow().webContents.capturePage()
        writeFileSync(join(dir, step.shot + '.png'), image.toPNG())
        console.log('[capture]', step.shot, JSON.stringify({ shape: deps.primaryPet()?.lastShape ?? [] }))
      }
    }
    deps.app.quit()
  }
}
