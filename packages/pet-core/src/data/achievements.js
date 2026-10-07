// @ts-check
import { EXTENSION_ACHIEVEMENTS } from './extension-achievements.js'
/** Milestones. Rewards are pig badges only; no economic effects. */
/** @typedef {{key:string, label:string, group:string, emoji:string, art:string, metric:string, target:number, unit:string, description:string, extension?:string, event?:string, mode?:string}} Achievement */
/** @type {Array<[string,string,string,string,string,number,string,string]>} */
const rows = [
  ['first-meal', '开饭啦', '照顾', '🍎', 'feeds', 1, '次', '第一次成功喂食，把肚子填得暖暖的。'],
  ['clean-ten', '香喷喷小猪', '照顾', '🛁', 'baths', 10, '次', '成功洗澡十次，耳朵也洗得干干净净。'],
  ['play-twenty', '玩心不改', '照顾', '🎾', 'plays', 20, '次', '成功玩耍二十次，快乐也值得认真积累。'],
  ['pet-hundred', '摸摸老朋友', '照顾', '❤️', 'pets', 100, '次', '成功摸摸一百次，熟悉你的手心了。'],
  ['first-class', '今天学到了', '学习', '📚', 'courses', 1, '节', '完整上完第一节文化课。'],
  ['first-job', '第一桶金', '工作', '🪙', 'jobs', 1, '班', '完整做完第一班工作。'],
  ['jobs-ten', '认真打工猪', '工作', '💼', 'jobs', 10, '班', '完成十班工作，班班都算数。'],
  ['jobs-hundred', '百班老手', '工作', '🧱', 'jobs', 100, '班', '完成一百班工作，积累自己的故事。'],
  ['first-trip', '出门看看', '旅行', '🧳', 'trips', 1, '趟', '完整完成第一次旅行。'],
  ['trips-ten', '远方常客', '旅行', '🌍', 'trips', 10, '趟', '完成十趟旅行，把见闻带回家。'],
  ['first-fish', '初次上钩', '收藏', '🐟', 'fishCaught', 1, '条', '第一条鱼真正放进鱼篓，才算收获。'],
  ['fish-five', '小小鱼类学家', '收藏', '🎣', 'fishKinds', 5, '种', '图鉴记录五种不同的鱼，卖掉或喂掉也不丢记录。'],
  ['souvenirs-three', '口袋里的远方', '收藏', '🐚', 'souvenirKinds', 3, '种', '图鉴记录三种不同的旅行纪念品。'],
  ['king', '加冕时刻', '晋升', '👑', 'king', 1, '次', '亲自完成猪猪王加冕，买到王冠还不算。'],
  ['devil', '小小恶魔', '晋升', '😈', 'devil', 1, '次', '亲自完成恶魔契约，调皮也有自己的徽章。'],
  ['grown-up', '长大啦', '成长', '🐷', 'level', 40, '级', '成长到四十级，迎来成年。'],
]
/** @type {readonly Readonly<Achievement>[]} */
export const ACHIEVEMENTS = Object.freeze([...rows.map(([key,label,group,emoji,metric,target,unit,description]) =>
  Object.freeze({key,label,group,emoji,metric,target,unit,description,art:'badge-pig-'+key})), ...EXTENSION_ACHIEVEMENTS])
