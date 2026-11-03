// @ts-check
/** Extension badges celebrate completed play and collections, without rewards. */
/** @type {Array<[string,string,string,string,string,string,number,string,string]>} */
const rows = [
  ['farm-first', '菜园开张', 'farm', '菜园', 'harvest', 'total', 1, '次', '成功收获第一块成熟作物，买种和浇水还不算。'],
  ['farm-ten', '丰收小猪', 'farm', '菜园', 'harvest', 'total', 10, '次', '成功收获十块成熟作物，每块算一次。'],
  ['farm-five', '五彩菜篮', 'farm', '菜园', 'harvest', 'kinds', 5, '种', '收获五种不同作物，卖掉或放进背包也保留经历。'],
  ['mine-first', '第一块矿石', 'mine', '矿洞', 'ore', 'total', 1, '块', '真正挖出第一块矿石，敲裂石头还不算。'],
  ['mine-fossils', '小猪考古家', 'mine', '矿洞', 'fossil', 'kinds', 3, '种', '发现三种不同化石，留下自己的矿洞收藏。'],
  ['mine-deep', '矿洞探险家', 'mine', '矿洞', 'depth', 'maximum', 10, '层', '沿着梯子真正抵达矿洞第十层。'],
  ['gacha-first', '扭蛋初体验', 'gacha', '扭蛋', 'spin', 'total', 1, '颗', '成功领取第一颗扭蛋，免费的也算。'],
  ['gacha-machines', '三台都逛过', 'gacha', '扭蛋', 'machine', 'kinds', 3, '台', '零食、杂货、药箱三台机器都成功领取过扭蛋。'],
  ['gacha-gold', '金色惊喜', 'gacha', '扭蛋', 'gold', 'total', 1, '次', '获得一次金色扭蛋奖励，保底获得的也算。'],
  ['blindbox-first', '摆件新朋友', 'blindbox', '盲盒', 'figure', 'kinds', 1, '种', '得到第一个摆件，寻访和凭证兑换都算。'],
  ['blindbox-ten', '小猪收藏家', 'blindbox', '盲盒', 'figure', 'kinds', 10, '种', '拥有过十种不同摆件，重复摆件不增加种类。'],
  ['blindbox-six', '六星相遇', 'blindbox', '盲盒', 'six-star', 'kinds', 1, '种', '得到一个六星摆件，凭证兑换也能达成。'],
  // 第二期继续消费已有公共事件，不读取扩展私有数据。
  ['farm-hundred', '百次丰收', 'farm', '菜园', 'harvest', 'total', 100, '次', '累计成功收获一百次作物，每块地每季收获算一次，不按作物个数计数。'],
  ['farm-fifteen', '四季菜篮', 'farm', '菜园', 'harvest', 'kinds', 15, '种', '成功收获十五种不同作物，买种、种下和重复收同一种都不增加种类。'],
  ['mine-twenty', '矿洞尽头', 'mine', '矿洞', 'depth', 'maximum', 20, '层', '沿梯子真正抵达第二十层，买到高级镐还不算。'],
]
export const EXTENSION_ACHIEVEMENTS = Object.freeze(rows.map(([key, label, extension, group, event, mode, target, unit, description]) =>
  Object.freeze({ key, label, extension, group, event, mode, target, unit, description, emoji: '🏅', metric: 'extension', art: 'badge-pig-' + key })))
