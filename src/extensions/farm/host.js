// @ts-check
// 宿主接口的薄封装：菜币钱包、体力、迁移退款。
// 扩展只能通过宿主给的 api 动钱和体力，这里把老宿主兼容和退款入库集中在一处。
import { EXERT } from './data.js'

/** 菜币钱包；老宿主（没有 api.wallet）退回金币，免得装上就坏。 */
export function purse(api) {
  return api.wallet ? api.wallet : { currency: { label: '金币', emoji: '🪙', rate: 1 }, balance: () => api.coins(), earn: (n, source) => api.earn(n, source), spend: (n, sink) => api.spend(n, sink) }
}
export const tire = (api, plots = 1) => { if (typeof api.exert === 'function') api.exert(EXERT * plots) }
/** 迁移欠下的退款：下一次动作时付；农具那笔单独提示一句。 */
export function payRefund(data, api) {
  if (data.refund > 0 && api) {
    purse(api).earn(data.refund, 'refund')
    if (data.helperBarnRefund > 0 && typeof api.say === 'function') api.say('农具暂时下架，已退还 ' + data.helperBarnRefund + ' 菜币')
    data.refund = 0
    data.helperBarnRefund = 0
  }
}
