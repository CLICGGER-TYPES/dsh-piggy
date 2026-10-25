// @ts-check
/**
 * 网页版单页在舞台里的存档导出入口：save-transfer.js 在没有 desktopShell 时用
 * showSaveFilePicker；这里提供一个同名 API，延迟到 close() 时走主进程的系统保存框
 * （只写用户选的位置）。
 *
 * 扩展大窗不再靠按钮 data-* 属性识别：openBigApp 直接走游戏注册的舞台适配器（A4）。
 * @module dsh-piggy-desktop/stage/stage-compat
 */

/** @param {any} data */
async function bytesOf(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer())
  if (data && data.buffer instanceof ArrayBuffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || 0)
  return null
}

/**
 * @param {{stageShell:any}} options
 */
export function installSavePicker(options) {
  const shell = options.stageShell
  if (typeof shell?.saveArchive !== 'function') return
  ;/** @type {any} */ (window).showSaveFilePicker = async pickerOptions => {
    const name = String(pickerOptions?.suggestedName ?? 'piggy-save.zip')
    if (!/\.zip$/i.test(name)) return null
    let payload = null
    return {
      async createWritable() {
        return {
          async write(data) { payload = await bytesOf(data) },
          async close() {
            if (payload === null) throw new Error('没有可保存的存档数据')
            const result = await shell.saveArchive(name, payload)
            if (result?.ok === true) return
            if (result?.canceled === true) throw Object.assign(new Error('已取消'), { name: 'AbortError' })
            throw new Error(String(result?.reason ?? '存档没有保存'))
          },
        }
      },
    }
  }
}
