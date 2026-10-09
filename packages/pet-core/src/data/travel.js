// @ts-check
/**
 * 旅行与纪念品 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/data/travel
 */

import { MINUTES } from './minutes.js'

/**
 * Rarity tiers for souvenirs: bragging rights, and a price tag.
 *
 * Deterministic — a souvenir's tier is a property of the souvenir, not a dice
 * roll, so the whole collection stays testable and "the far trips are worth
 * more" is a fact about the tables rather than a probability.
 */
export const SOUVENIR_RARITY = Object.freeze({
  common: Object.freeze({ key: 'common', label: '普通', emoji: '⚪', price: 60 }),
  rare: Object.freeze({ key: 'rare', label: '稀有', emoji: '🔵', price: 320 }),
  legend: Object.freeze({ key: 'legend', label: '传说', emoji: '🟡', price: 1600 }),
})

export const rarityByKey = key => SOUVENIR_RARITY[key] ?? SOUVENIR_RARITY.common

/**
 * 一件纪念品。卖价默认按稀有度；近处的短途（公园、游乐场、动物园）单独标得便宜，
 * 不然花 15 金币逛一圈公园能卖 60，成了挂机刷钱（J1 第 5 节）。
 */
const souvenir = (key, emoji, label, rarity, story, price = rarityByKey(rarity).price) => Object.freeze({ key, emoji, label, rarity, story, price })

/** 旅行地点，按花费从低到高排（J1 第 5 节：7 → 15 个）。 */
export const TRIPS = Object.freeze([
  Object.freeze({ key: 'park', label: '公园', emoji: '🌳', minutes: MINUTES.quarter, cost: 15, happiness: 5, satiety: -3, souvenirs: Object.freeze([
    souvenir('ginkgo', '🍃', '银杏叶', 'common', '捡了一片扇子形状的银杏叶，回家夹进书里压平了。', 30),
    souvenir('balloonstring', '🎈', '气球绳', 'common', '气球飞走了，手里只剩一截绳子，舍不得扔。', 30),
    souvenir('breadcrumbs', '🦆', '鸭子面包屑', 'common', '口袋里还剩半包喂鸭子的面包屑，鸭子们追了一路。', 30),
  ]) }),
  Object.freeze({ key: 'funfair', label: '游乐场', emoji: '🎡', minutes: MINUTES.half, cost: 40, happiness: 8, satiety: -5, souvenirs: Object.freeze([
    souvenir('carouselticket', '🎠', '木马票根', 'common', '旋转木马的票根，转了三圈还想再坐一次。', 40),
    souvenir('cottoncandy', '🍭', '棉花糖棍', 'common', '棉花糖吃完了，小棍上还黏着一点甜。', 40),
    souvenir('coasterphoto', '📸', '过山车照片', 'rare', '冲下坡那一刻被拍了下来，嘴张得比脸还大。', 120),
  ]) }),
  Object.freeze({ key: 'zoo', label: '动物园', emoji: '🦁', minutes: MINUTES.fortyFive, cost: 50, happiness: 9, satiety: -6, souvenirs: Object.freeze([
    souvenir('giraffesticker', '🦒', '长颈鹿贴纸', 'common', '门口送的贴纸，长颈鹿的脖子一直印到了纸边外面。', 45),
    souvenir('monkeypeanut', '🥜', '猴子分的花生', 'common', '一只小猴子隔着栏杆递来一颗花生，好像在请客。', 45),
    souvenir('pandacard', '🐼', '熊猫明信片', 'rare', '等了一上午，熊猫只翻了个身。明信片上那只倒是一直醒着。', 150),
  ]) }),
  Object.freeze({ key: 'suburb', label: '郊游', emoji: '🧺', minutes: MINUTES.hour, cost: 60, happiness: 10, satiety: -8, souvenirs: Object.freeze([
    souvenir('clover', '🍀', '四叶草', 'common', '在草堆里翻到一片四叶草，据说会带来好运。'),
    souvenir('pinecone', '🌰', '松果', 'common', '捡了一颗松果，捏起来有点扎手。'),
    souvenir('wildflower', '🌼', '野花', 'rare', '摘了一朵小野花，一路上都小心护着。'),
  ]) }),
  Object.freeze({ key: 'aquarium', label: '海洋馆', emoji: '🐬', minutes: MINUTES.ninety, cost: 150, happiness: 13, satiety: -12, souvenirs: Object.freeze([
    souvenir('fishkeychain', '🐠', '鱼形钥匙扣', 'common', '一按肚子就会亮的小鱼钥匙扣。'),
    souvenir('coralmodel', '🪸', '珊瑚模型', 'common', '玻璃柜里那片珊瑚的缩小版，颜色比真的还艳。'),
    souvenir('dolphinsplash', '💦', '海豚的水花', 'rare', '坐在第一排被海豚溅了一身水，衣服晾干了，笑还没停。'),
  ]) }),
  Object.freeze({ key: 'bambooforest', label: '竹林', emoji: '🎋', minutes: MINUTES.twoHours, cost: 160, happiness: 14, satiety: -14, souvenirs: Object.freeze([
    souvenir('bambooleaf', '🎋', '竹叶书签', 'common', '风一吹整片竹林沙沙响，捡了片竹叶做书签。'),
    souvenir('bambooshoot', '🌱', '竹笋', 'common', '雨后冒出来的竹笋，好像比早上又高了一截。'),
    souvenir('bambootea', '🍵', '竹筒茶', 'rare', '用竹筒煮的茶，喝起来有股清清的竹子味。'),
  ]) }),
  Object.freeze({ key: 'mountain', label: '名山大川', emoji: '🏔', minutes: MINUTES.threeHours, cost: 200, happiness: 16, satiety: -20, souvenirs: Object.freeze([
    souvenir('cloudsea', '☁️', '云海照片', 'common', '爬到半山腰回头看，云在脚底下走。'),
    souvenir('stone', '🪨', '山石', 'common', '从山涧里捡了块石头，摸起来凉凉的。'),
    souvenir('bamboo', '🎍', '竹杖', 'rare', '在竹林里挑了根直溜的竹子当拐杖，拄着它上了山顶。'),
    souvenir('echo', '🏔', '山谷回声', 'legend', '在山顶冲着对面喊了一嗓子，山谷把你的名字还了回来。'),
  ]) }),
  Object.freeze({ key: 'hotspring', label: '泡温泉', emoji: '♨️', minutes: MINUTES.sixHours, cost: 380, happiness: 20, satiety: -28, souvenirs: Object.freeze([
    souvenir('towelmint', '🧺', '温泉毛巾', 'common', '印着当地小图案的毛巾，闻起来有硫磺味。'),
    souvenir('springegg', '🥚', '温泉蛋', 'common', '在池边煮的蛋，蛋黄是半凝固的。'),
    souvenir('omamori', '🧿', '平安符', 'rare', '泡完汤求了个平安符，据说能防着点倒霉事。'),
  ]) }),
  Object.freeze({ key: 'snowpeak', label: '雪山', emoji: '🏔', minutes: MINUTES.fiveHours, cost: 500, happiness: 22, satiety: -34, souvenirs: Object.freeze([
    souvenir('sled', '🛷', '小雪橇', 'common', '山脚小店买的木头小雪橇，巴掌大，能摆在桌上。'),
    souvenir('mittens', '🧤', '毛线手套', 'common', '一副厚厚的手套，上面织着歪歪扭扭的雪人。'),
    souvenir('skibadge', '⛷', '滑雪徽章', 'rare', '摔了十几跤，终于一口气滑到了坡底，教练给了一枚徽章。'),
    souvenir('snowsunrise', '🌄', '雪山日出', 'legend', '天没亮就往上爬，到山顶时太阳刚好把雪照成了金色。'),
  ]) }),
  Object.freeze({ key: 'sea', label: '看海', emoji: '🌊', minutes: MINUTES.eightHours, cost: 620, happiness: 24, satiety: -42, souvenirs: Object.freeze([
    souvenir('seasalt', '🧂', '海盐', 'common', '在礁石坑里刮了点海盐，咸得发苦。'),
    souvenir('starfish', '⭐', '海星', 'common', '退潮时捡到一只海星，看完就放回水里了。'),
    souvenir('shell', '🐚', '一枚海螺', 'rare', '在海边捡到一枚海螺，贴在耳朵上能听见浪声。'),
    souvenir('driftbottle', '🍾', '漂流瓶', 'legend', '瓶子里有张潮湿的纸条，写着「你好，陌生人」。'),
  ]) }),
  Object.freeze({ key: 'desert', label: '沙漠', emoji: '🏜', minutes: MINUTES.eightHours, cost: 800, happiness: 26, satiety: -45, souvenirs: Object.freeze([
    souvenir('sandbottle', '🫙', '一瓶沙子', 'common', '装了一小瓶沙子，倒过来能听见细细的沙沙声。'),
    souvenir('cactusflower', '🌵', '仙人掌花', 'common', '仙人掌一年只开几天花，刚好被碰上了。'),
    souvenir('camelbell', '🐫', '骆驼铃铛', 'rare', '驼队的老铃铛，走起来叮当、叮当，听着路就不觉得远。'),
    souvenir('desertstars', '🌠', '沙漠星空', 'legend', '夜里一点灯都没有，星星多得像撒了一地的盐。'),
  ]) }),
  Object.freeze({ key: 'oldtown', label: '古镇', emoji: '🏮', minutes: MINUTES.halfDay, cost: 1100, happiness: 30, satiety: -50, souvenirs: Object.freeze([
    souvenir('woodcut', '🪵', '木刻', 'common', '巷口老师傅刻的小木牌，背面还有刀痕。'),
    souvenir('lantern', '🏮', '小灯笼', 'rare', '买了一盏纸灯笼，晚上提着一路走回客栈。'),
    souvenir('teapot', '🫖', '紫砂壶', 'legend', '在旧货摊上淘到的紫砂壶，壶底刻着一个看不清的年份。'),
  ]) }),
  Object.freeze({ key: 'abroad', label: '出国', emoji: '🌍', minutes: MINUTES.day, cost: 2000, happiness: 38, satiety: -80, souvenirs: Object.freeze([
    souvenir('foreigncoin', '🪙', '外国硬币', 'common', '找零收到一枚硬币，上面的字一个都不认识。'),
    souvenir('stamp', '📮', '异国邮票', 'rare', '在旧书摊上买了张盖过戳的邮票。'),
    souvenir('postcard', '💌', '手写明信片', 'rare', '给自己寄了一张明信片，上面写着「我很好，就是有点想你」。'),
    souvenir('snowglobe', '🔮', '水晶球', 'legend', '晃一晃，陌生的城市就会下雪。'),
  ]) }),
  Object.freeze({ key: 'aurora', label: '看极光', emoji: '🌌', minutes: MINUTES.day, cost: 3600, happiness: 44, satiety: -90, souvenirs: Object.freeze([
    souvenir('polestone', '⛰', '极地石', 'common', '从冻土上抠下来一块石头，冰得刺手。'),
    souvenir('compass', '🧭', '老罗盘', 'rare', '指针一直抖，最后还是能指回住的地方。'),
    souvenir('icecrystal', '❄️', '冰晶', 'rare', '接住了一片雪花，在掌心化成一小滴水。'),
    souvenir('auroraphoto', '🌌', '极光照片', 'legend', '守了三个晚上才等到的那一片绿光，快门按下去的时候手在抖。'),
  ]) }),
  // 只有当过宇航员（解锁过宇航员外观）的猪能去。
  Object.freeze({ key: 'spacestation', label: '太空站', emoji: '🚀', minutes: MINUTES.day, cost: 6000, happiness: 50, satiety: -95, requires: Object.freeze({ job: 'astronaut', label: '当过宇航员' }), souvenirs: Object.freeze([
    souvenir('spacepen', '🖊', '太空笔', 'common', '倒过来也能写字的笔，在失重的舱里试了好几遍。'),
    souvenir('spaceicecream', '🍦', '太空冰淇淋', 'common', '冻干的冰淇淋，咬起来咔嚓咔嚓的，永远不会化。'),
    souvenir('earthphoto', '🌍', '地球照片', 'rare', '从舷窗拍的地球，蓝得不像真的。找了半天，也没找到家在哪儿。'),
    souvenir('meteorite', '☄️', '一小块陨石', 'legend', '机械臂从舱外捡回来的一小块石头，比地球上所有的石头都老。'),
  ]) }),
])

/** Every souvenir on the map, flattened — the collection is global. */
export const ALL_SOUVENIRS = Object.freeze(TRIPS.flatMap(trip => trip.souvenirs.map(entry => Object.freeze({ ...entry, from: trip.key, fromLabel: trip.label }))))

export const souvenirByKey = key => ALL_SOUVENIRS.find(entry => entry.key === key) ?? null

/** 背包里一件纪念品卖多少：表上有的按表，老存档里表上没有的按稀有度。 */
export const souvenirPrice = entry => souvenirByKey(entry?.key)?.price ?? rarityByKey(entry?.rarity).price

// ---------------------------------------------------------------------------
// Items — one shop, four shelves.
//
//   food      feeds the pig
//   bath      washes it
//   toy       plays with it
//   medicine  cures it (four tiers, one per illness stage)
//   revive    brings it back
//
// Buying is not the only way in: every pig owns one scruffy default toy for
// free, so `玩耍` always works even with an empty bag. That mirrors QQ Pet,
// where the pet can amuse itself without a bought plaything.
// ---------------------------------------------------------------------------

export const tripByKey = key => TRIPS.find(trip => trip.key === key) ?? null

/** 地点要满足什么才能去（`{ job, label }`），没有条件是 null。 */
export const tripRequirement = trip => trip !== null && typeof trip === 'object' && 'requires' in trip ? trip.requires : null
