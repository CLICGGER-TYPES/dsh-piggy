// @ts-check
/**
 * 台词 —— 按场景分类，带可选的回复按钮（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 场景照 QQ 宠物的台词分类来（enter / eat / clean / toHeartTolk / levUp /
 * 生病 tolk / errTolk / successTolk ……）。`[主人]` 会换成主人的称呼。
 * 文案来自 docs/numbers/B6-lines.md（用户 2026-10-01：按稿直接上）。
 *
 * @module dsh-piggy/data/lines
 */

import { MORE_LINES } from './lines-more.js'

/** 台词里代表主人称呼的占位符。 */
export const OWNER_TOKEN = '[主人]'

/** 没设置称呼时用的默认称呼。 */
export const DEFAULT_OWNER_NAME = '主人'

/** 称呼最多几个字。 */
export const OWNER_NAME_MAX = 12

/** 点一次回复按钮加的心情；每句台词只算一次。 */
export const REPLY_HAPPINESS = 3

/** 闲着时隔多久冒一句（分钟，区间内随机）。 */
export const IDLE_CHAT_MINUTES = Object.freeze({ min: 20, max: 40 })

/** 离开多久再打开算「你回来了」（分钟）。 */
export const WELCOME_BACK_AFTER_MINUTES = 30

/**
 * @typedef {object} LineReply
 * @property {string} label - 按钮上的字
 * @property {number} [happiness] - 点了加多少心情，默认 REPLY_HAPPINESS
 */

/**
 * @typedef {object} Line
 * @property {string} text
 * @property {ReadonlyArray<LineReply>} [replies]
 */

/**
 * One line, with an optional reply button.
 * @param {string} text
 * @param {string} [reply]
 * @returns {Line}
 */
const line = (text, reply) => Object.freeze(reply === undefined
  ? { text }
  : { text, replies: Object.freeze([Object.freeze({ label: reply })]) })

const scene = (...lines) => Object.freeze(lines)

/** B6 的原稿；G 批次加的句子和新场景在 lines-more.js，下面合并。 */
const BASE_LINES = Object.freeze({
  // --- 照顾 -----------------------------------------------------------------
  eat: scene(
    line('好吃！还有吗？', '真乖'),
    line('吧唧吧唧……'),
    line('[主人]最好了～'),
    line('这个味道我记住了'),
    line('吃饱饱才有力气陪你加班'),
    line('嗝——（不好意思）'),
  ),
  full: scene(
    line('吃饱啦，肚子圆滚滚的'),
    line('好饱好饱，再吃就要撑着了'),
    line('嗝——谢谢[主人]，饱饱的'),
  ),
  overfull: scene(
    line('撑……撑住了……'),
    line('真的吃不下了，你看我肚子'),
    line('再喂我就要变成球了', '最后一口'),
  ),
  bathe: scene(
    line('香喷喷的！'),
    line('水有点凉……', '马上擦干'),
    line('搓搓背，舒服～'),
    line('泡泡！是泡泡！'),
    line('洗干净了，可以抱了'),
  ),
  play: scene(
    line('再来一次！'),
    line('接住啦！', '真棒'),
    line('哈哈哈好好玩'),
    line('我跑得比球快'),
    line('玩累了……再玩五分钟'),
  ),
  pet: scene(
    line('好舒服……'),
    line('再摸摸～', '好'),
    line('呼噜呼噜……'),
    line('（眯起眼睛）'),
    line('这里这里！左边一点！'),
    line('唔……好痒'),
    line('[主人]的手暖暖的'),
  ),
  // --- 状态提醒（闲着时优先说这些）-------------------------------------------
  hungry: scene(
    line('肚子咕咕叫了……'),
    line('[主人]，饭饭！', '马上来'),
    line('我可以吃一整个苹果树'),
  ),
  dirty: scene(
    line('身上有点痒痒的'),
    line('我是不是有点味道了……'),
    line('想洗泡泡浴', '好，这就洗'),
  ),
  lonely: scene(
    line('[主人]在忙什么呀？'),
    line('你好久没理我了……', '陪你一会儿'),
    line('我一个人在这儿数像素'),
  ),
  idle: scene(
    line('（打了个哈欠）'),
    line('今天天气好像不错'),
    line('你写的代码我看懂了一行！'),
    line('要不要休息一下眼睛？', '好'),
    line('我在想晚饭吃什么'),
    line('（在角落里滚了一圈）'),
    line('[主人]加油，我在旁边看着'),
    line('刚才那个报错我也看见了……'),
  ),
  // --- 出门 -----------------------------------------------------------------
  workDone: scene(
    line('我回来啦！赚到钱了！', '辛苦了'),
    line('今天老板夸我了'),
    line('累是累了点，但是有钱了'),
  ),
  tired: scene(
    line('好累啊……', '歇会儿吧'),
    line('能不能先让我躺一下'),
    line('再干下去我要头晕了'),
  ),
  study: scene(
    line('今天学到好多！', '真乖'),
    line('老师讲的我都听懂了（大概）'),
    line('作业……明天再说'),
  ),
  graduate: scene(
    line('我毕业啦！我没有留级！', '真棒'),
    line('看，我的毕业照！'),
    line('下一段我也能念完'),
  ),
  tripBack: scene(
    line('我给你带了东西！', '是什么？'),
    line('外面好大啊'),
    line('下次带你一起去'),
  ),
  // --- 生病 -----------------------------------------------------------------
  sick: scene(
    line('阿——嚏！[主人]，我好像病了……', '乖，吃药'),
    line('头有点晕晕的'),
    line('我不想动……'),
  ),
  wrongMedicine: scene(
    line('这药好苦……好像不是这个', '对不起'),
    line('呜，更难受了'),
    line('[主人]你是不是看错说明书了'),
  ),
  cured: scene(
    line('我好啦！谢谢[主人]～', '真乖'),
    line('又能跑能跳了！'),
    line('以后我会乖乖吃饭的'),
  ),
  // --- 成长与生死 -------------------------------------------------------------
  levelup: scene(
    line('我又长大了一点！', '真乖'),
    line('感觉自己变厉害了'),
    line('你看我是不是高了一点'),
  ),
  growUp: scene(
    line('我长大啦！'),
    line('以前的衣服好像穿不下了'),
    line('[主人]，我现在是大猪了'),
  ),
  coronation: scene(
    line('王冠有点重，但我会好好戴着的，[主人]。', '你可以的'),
    line('从今天起，零食也算王室事务！'),
    line('我宣布：[主人]永远是我的第一位贵客。'),
    line('咳咳，本王想先吃个苹果。'),
  ),
  contract: scene(
    line('契约签好了。先说好，我还是你那只猪。', '当然'),
    line('角长出来了，撒娇的本事可没丢。'),
    line('恶魔也要吃饭呀，[主人]。'),
    line('这笔交易我赚了：以后还能和你在一起。'),
  ),
  enter: scene(
    line('[主人]你回来啦！', '回来了'),
    line('等你好久了～'),
    line('今天也要一起加油哦'),
  ),
  death: scene(
    line('[主人]保重，我走了，不带走一片云彩～'),
    line('下辈子还给你当猪'),
  ),
  revive: scene(
    line('我……我回来了？'),
    line('那边好冷，还是这里好'),
    line('谢谢你没放弃我', '欢迎回来'),
  ),
  // --- B5 用 ------------------------------------------------------------------
  signIn: scene(
    line('签到啦！今天也要好好的'),
    line('这是今天的礼物，给你～'),
  ),
  gift: scene(
    line('我在地上捡到一个盒子！'),
    line('陪你这么久，这是奖励'),
  ),
  // --- C2 番茄钟 --------------------------------------------------------------
  pomodoroStart: scene(
    line('[主人]忙吧，我趴这儿不动'),
    line('专注模式！我帮你看着时间'),
    line('这 25 分钟我也不吵你，说好了'),
  ),
  pomodoroDone: scene(
    line('时间到！[主人]真厉害'),
    line('做完一个啦，起来动动脖子'),
    line('我陪你数着呢，一个都不少'),
  ),
  pomodoroAbandon: scene(
    line('不做了呀？那就歇会儿'),
    line('没事，等你准备好再来'),
    line('我先把番茄收起来啦'),
  ),
})

/**
 * 每个场景的全部台词：原稿在前，G 批次加的在后。
 * @type {Readonly<Record<string, ReadonlyArray<Line>>>}
 */
export const LINES = Object.freeze(Object.fromEntries(
  [...new Set([...Object.keys(BASE_LINES), ...Object.keys(MORE_LINES)])]
    .map(key => [key, Object.freeze([...(BASE_LINES[key] ?? []), ...(MORE_LINES[key] ?? [])])]),
))

/** Every scene a line can be asked for. */
export const LINE_SCENES = Object.freeze(Object.keys(LINES))
