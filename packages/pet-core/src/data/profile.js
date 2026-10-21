// @ts-check
/**
 * 居民卡：性格、口头禅、签名、星座 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * B9（用户 2026-10-01）：照动森居民卡。性格在拆纸盒时随机一种，带一个默认口头禅和签名；
 * 口头禅和签名主人都能改，猪说话时会不时带上口头禅。
 * @module dsh-piggy/data/profile
 */

/** 居民卡的小猪名字最多五个字。 */
export const PET_NAME_MAX = 5

/**
 * @typedef {object} Personality
 * @property {string} key
 * @property {string} label
 * @property {string} emoji
 * @property {string} catchphrase - 默认口头禅
 * @property {string} motto - 默认签名
 */

/** @type {ReadonlyArray<Personality>} */
export const PERSONALITIES = Object.freeze([
  Object.freeze({ key: 'peppy', label: '元气', emoji: '🌟', catchphrase: '嘿嘿', motto: '今天也要元气满满！' }),
  Object.freeze({ key: 'lazy', label: '悠闲', emoji: '😴', catchphrase: '呼噜', motto: '能躺着，绝不坐着。' }),
  Object.freeze({ key: 'cranky', label: '傲娇', emoji: '😤', catchphrase: '哼', motto: '别惹我，除非你带了吃的。' }),
  Object.freeze({ key: 'sisterly', label: '贴心', emoji: '💁', catchphrase: '懂吗', motto: '有事找我，我罩着你。' }),
  Object.freeze({ key: 'snooty', label: '自恋', emoji: '💅', catchphrase: '啧啧', motto: '我是这片最可爱的猪。' }),
  Object.freeze({ key: 'normal', label: '温和', emoji: '🙂', catchphrase: '嗯嗯', motto: '平平淡淡才是真。' }),
  Object.freeze({ key: 'clingy', label: '黏人', emoji: '💕', catchphrase: '贴贴', motto: '位置挪近一点，喜欢也近一点。' }),
  Object.freeze({ key: 'shy', label: '害羞', emoji: '🌸', catchphrase: '那个', motto: '想靠近你，又怕你发现。' }),
  Object.freeze({ key: 'curious', label: '好奇', emoji: '🔎', catchphrase: '咦', motto: '今天会有什么新发现呢？' }),
  Object.freeze({ key: 'mischievous', label: '调皮', emoji: '🫧', catchphrase: '嘻嘻', motto: '一点点小捣蛋，很多很多喜欢。' }),
  Object.freeze({ key: 'goofy', label: '呆萌', emoji: '🍡', catchphrase: '唔', motto: '没想明白，也不耽误喜欢你。' }),
  Object.freeze({ key: 'earnest', label: '认真', emoji: '📚', catchphrase: '记好啦', motto: '答应你的事，我会认真记住。' }),
])

export const personalityByKey = key => PERSONALITIES.find(entry => entry.key === key) ?? null

/** 口头禅最多几个字。 */
export const CATCHPHRASE_MAX = 6

/** 签名最多几个字。 */
export const MOTTO_MAX = 24

/** 猪说一句话时，句末带上口头禅的概率。 */
export const CATCHPHRASE_CHANCE = 0.4

/** 这些场景不带口头禅：生病、吃错药、走了的时候不该卖萌。 */
export const SERIOUS_SCENES = Object.freeze(['death', 'sick', 'wrongMedicine'])

/**
 * 星座：每个星座的**起始**月日（含），按日历顺序；1 月 1 日到 1 月 19 日落在最后一行之后，
 * 即摩羯座（从上一年 12 月 22 日开始）。
 */
export const ZODIAC = Object.freeze([
  Object.freeze({ month: 1, day: 20, label: '水瓶座', emoji: '♒' }),
  Object.freeze({ month: 2, day: 19, label: '双鱼座', emoji: '♓' }),
  Object.freeze({ month: 3, day: 21, label: '白羊座', emoji: '♈' }),
  Object.freeze({ month: 4, day: 20, label: '金牛座', emoji: '♉' }),
  Object.freeze({ month: 5, day: 21, label: '双子座', emoji: '♊' }),
  Object.freeze({ month: 6, day: 22, label: '巨蟹座', emoji: '♋' }),
  Object.freeze({ month: 7, day: 23, label: '狮子座', emoji: '♌' }),
  Object.freeze({ month: 8, day: 23, label: '处女座', emoji: '♍' }),
  Object.freeze({ month: 9, day: 23, label: '天秤座', emoji: '♎' }),
  Object.freeze({ month: 10, day: 24, label: '天蝎座', emoji: '♏' }),
  Object.freeze({ month: 11, day: 23, label: '射手座', emoji: '♐' }),
  Object.freeze({ month: 12, day: 22, label: '摩羯座', emoji: '♑' }),
])
