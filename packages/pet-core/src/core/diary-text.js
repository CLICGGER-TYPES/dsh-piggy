// @ts-check
/**
 * 将游戏写出的照料结算与日记正文分开，只派生展示信息，不改原文。
 * @param {unknown} text
 * @returns {{ body: string, careNotes: string[] }}
 */
export function splitDiaryText(text) {
  const raw = typeof text === 'string' ? text : ''
  const body = []
  const careNotes = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    const receipt = (/^你不在的时候，猪猪自己(?:吃了|洗了|玩了) /.test(trimmed) && /×[1-9]\d*(?=、|；|$)/.test(trimmed))
      || trimmed === '背包里没吃的了'
    if (receipt) careNotes.push(line)
    else body.push(line)
  }
  return { body: body.join('\n'), careNotes }
}
