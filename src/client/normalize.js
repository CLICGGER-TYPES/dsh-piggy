// @ts-check
/**
 * 把宿主快照（当前版 / 旧版 / 被截断）映射成面板画的那份形状。
 *
 * 缺字段补默认值，永不为 `undefined` —— 这是"满屏 undefined"那个 bug 的修法。
 * @module dsh-piggy/client/normalize
 */
import { MODES } from './constants.js'
import { arr, isObj, num, obj, str } from './values.js'
import { normalizeDex } from './normalize-dex.js'
import { normalizeFishing } from './normalize-fishing.js'
import { normalizeSkins } from './normalize-skins.js'
import { normalizeEconomy } from './normalize-economy.js'
import { normalizeExtensionParts } from './extensions.js'
export function normalize(raw) {
  var d = obj(raw)
  var pig = isObj(d.pig) ? d.pig : null
  var legacy = pig !== null && !('coins' in pig) && !('health' in pig)
  return {
    legacy: legacy,
    version: str(d.version, ''),
    // Trust the flag when the host sends one; for older hosts "a pig exists" is the answer.
    hatched: d.hatched === true || (d.hatched === undefined && pig !== null),
    dead: d.dead === true || (pig !== null && num(pig.health, 5) <= 0),
    pig: pig === null ? null : {
      name: str(pig.name, '猪猪'),
      // The pig is measured in days now; `stage` carries how big it is and
      // what it looks like.
      stage: {
        key: str(obj(pig.stage).key, 'piglet'),
        label: str(obj(pig.stage).label, '小猪'),
        emoji: str(obj(pig.stage).emoji, '🐖'),
        size: num(obj(pig.stage).size, 56),
        line: str(obj(pig.stage).line, ''),
        art: typeof obj(pig.stage).art === 'string' && obj(pig.stage).art !== '' ? obj(pig.stage).art : null,
        faded: obj(pig.stage).faded === true,
        // 加冕后的形态：有没有动作立绘、盖住哪些装扮位置。
        actionArt: obj(pig.stage).actionArt === true,
        artScenes: arr(obj(pig.stage).artScenes).filter(scene => typeof scene === 'string'),
        hides: arr(obj(pig.stage).hides).map(function (slot) { return str(slot, '') }),
      },
      // Older hosts send no sex; the HUD then simply shows none.
      sex: isObj(pig.sex) ? { key: str(pig.sex.key, ''), label: str(pig.sex.label, ''), symbol: str(pig.sex.symbol, '') } : null,
      ageLabel: str(pig.ageLabel, ''),
      ageForced: pig.ageForced === true,
      daysToNextStage: typeof pig.daysToNextStage === 'number' ? pig.daysToNextStage : null,
      soul: pig.soul === true,
      mood: str(pig.mood, 'fine'),
      moodEmoji: str(pig.moodEmoji, '😊'),
      moodLabel: str(pig.moodLabel, '还不错'),
      satiety: Math.round(num(pig.satiety, 0)),
      happiness: Math.round(num(pig.happiness, 0)),
      cleanliness: Math.round(num(pig.cleanliness, 0)),
      health: num(pig.health, 5),
      healthPercent: num(pig.healthPercent, 100),
      coins: num(pig.coins, 0),
      weight: str(pig.weight, '—'),
      bodyWeight: isObj(pig.bodyWeight) ? {
        class: str(obj(pig.bodyWeight).class, 'normal'), label: str(obj(pig.bodyWeight).label, '正常'), visible: obj(pig.bodyWeight).visible === true,
        weightG: Math.round(num(obj(pig.bodyWeight).weightG, 0)), idealG: Math.round(num(obj(pig.bodyWeight).idealG, 1360)), roundAtG: Math.round(num(obj(pig.bodyWeight).roundAtG, 1768)), fatAtG: Math.round(num(obj(pig.bodyWeight).fatAtG, 2176)),
        ideal: str(obj(pig.bodyWeight).ideal, '—'), roundAt: str(obj(pig.bodyWeight).roundAt, '—'), fatAt: str(obj(pig.bodyWeight).fatAt, '—'), playsLeft: Math.round(num(obj(pig.bodyWeight).playsLeft, 0)),
      } : null,
      xp: num(pig.xp, 0),
      level: (function (info) {
        var i = obj(info)
        var t = obj(i.title)
        return {
          level: num(i.level, 1),
          percent: num(i.percent, 0),
          toNext: num(i.toNext, 0),
          maxed: i.maxed === true,
          titleLabel: str(t.label, '新来的'),
          titleEmoji: str(t.emoji, '🌱'),
          next: isObj(i.nextTitle) ? { level: num(i.nextTitle.level, 0), label: str(i.nextTitle.label, ''), emoji: str(i.nextTitle.emoji, '') } : null,
        }
      })(pig.levelInfo),
      stageLine: str(pig.stageLine, ''),
      birthdayToday: pig.birthdayToday === true,
      illness: isObj(pig.illness) ? {
        name: str(pig.illness.name, '生病'),
        cure: str(pig.illness.cure, '药'),
        cureEmoji: str(pig.illness.cureEmoji, '💊'),
        stage: num(pig.illness.stage, 1),
        chainKey: str(pig.illness.chainKey, ''),
        doctorFee: typeof pig.illness.doctorFee === 'number' ? pig.illness.doctorFee : null,
      } : null,
      traits: {
        intel: num(obj(pig.traits).intel, 0),
        charm: num(obj(pig.traits).charm, 0),
        strong: num(obj(pig.traits).strong, 0),
      },
      courses: obj(pig.courses),
      // Souvenirs are objects now (rarity + story). An old host sent bare
      // strings, and those must still list rather than turn into [object
      // Object] or vanish.
      souvenirs: arr(pig.souvenirs).map(entry => {
        if (typeof entry === 'string') {
          return { key: entry, emoji: '🎁', label: entry, rarityLabel: '普通', rarityEmoji: '⚪', price: 0, story: '', fromLabel: '' }
        }
        return {
          key: str(obj(entry).key, ''),
          emoji: str(obj(entry).emoji, '🎁'),
          label: str(obj(entry).label, '纪念品'),
          rarityLabel: str(obj(entry).rarityLabel, '普通'),
          rarityEmoji: str(obj(entry).rarityEmoji, '⚪'),
          price: num(obj(entry).price, 0),
          story: str(obj(entry).story, ''),
          fromLabel: str(obj(entry).fromLabel, ''),
        }
      }).filter(entry => entry.key !== ''),
      memories: arr(pig.memories).filter(m => typeof m === 'string'),
    },
    actions: normalizeActions(d.actions),
    jobs: arr(d.jobs).map(job => ({
      key: str(obj(job).key, ''),
      label: str(obj(job).label, '工作'),
      emoji: str(obj(job).emoji, '💼'),
      minutes: num(obj(job).minutes, 0),
      coins: num(obj(job).coins, 0),
      available: obj(job).available === true,
      // What schooling has bought this job.
      traitLabel: str(obj(job).traitLabel, ''),
      traitEmoji: str(obj(job).traitEmoji, ''),
      traitPoints: num(obj(job).traitPoints, 0),
      baseMinutes: num(obj(job).baseMinutes, 0),
      baseCoins: num(obj(job).baseCoins, 0),
      payPercent: num(obj(job).payPercent, 0),
      speedPercent: num(obj(job).speedPercent, 0),
      // An old host has no gate at all, so a missing flag must read as
      // "qualified" — the opposite default would lock every job on upgrade.
      qualified: obj(job).qualified !== false,
      lockText: str(obj(job).lockText, ''),
      level: num(obj(job).level, 1),
      trait: str(obj(job).trait, ''),
      satiety: num(obj(job).satiety, 0),
      cleanliness: num(obj(job).cleanliness, 0),
      requirements: arr(obj(job).requirements).filter(isObj).map(entry => ({
        text: str(entry.text, ''),
        need: num(entry.need, 0),
        have: num(entry.have, 0),
        kind: str(entry.kind, ''),
        met: entry.met === true,
      })),
    })).filter(job => job.key !== ''),
    // B4: nine subjects, each with its own lesson count and stage.
    subjects: arr(d.subjects).map(sub => ({
      key: str(obj(sub).key, ''),
      label: str(obj(sub).label, '课'),
      emoji: str(obj(sub).emoji, '📘'),
      traitLabel: str(obj(sub).traitLabel, ''),
      traitEmoji: str(obj(sub).traitEmoji, ''),
      lessons: num(obj(sub).lessons, num(obj(sub).level, 0)),
      stageKey: str(obj(obj(sub).stage).key, ''),
      stageLabel: str(obj(obj(sub).stage).label, ''),
      graduatedLabel: isObj(obj(sub).graduated) ? str(obj(sub).graduated.label, '') : '',
      nextGraduation: typeof obj(sub).nextGraduation === 'number' ? obj(sub).nextGraduation : null,
      minutes: num(obj(sub).minutes, 0),
      tuition: num(obj(sub).tuition, 0),
      gain: num(obj(sub).gain, 0),
      secondaryGain: num(obj(sub).secondaryGain, 0),
      available: obj(sub).available === true,
      affordable: obj(sub).affordable !== false,
    })).filter(sub => sub.key !== ''),
    // 兴趣课：学习页里随时能学的一栏，学完加的是既有的三条属性。
    interests: arr(d.interests).map(entry => ({
      key: str(obj(entry).key, ''),
      label: str(obj(entry).label, '兴趣'),
      emoji: str(obj(entry).emoji, '🎯'),
      traitLabel: str(obj(entry).traitLabel, ''),
      traitEmoji: str(obj(entry).traitEmoji, ''),
      minutes: num(obj(entry).minutes, 0),
      cost: num(obj(entry).cost, 0),
      gain: num(obj(entry).gain, 0),
      blurb: str(obj(entry).blurb, ''),
      times: num(obj(entry).times, 0),
      certificate: str(obj(entry).certificate, ''),
      certificateAfter: num(obj(entry).certificateAfter, 0),
      certified: obj(entry).certified === true,
      available: obj(entry).available === true,
      affordable: obj(entry).affordable === true,
    })).filter(entry => entry.key !== ''),
    stages: arr(d.stages).map(stage => ({
      key: str(obj(stage).key, ''),
      label: str(obj(stage).label, '学段'),
      emoji: str(obj(stage).emoji, '📚'),
      minutes: num(obj(stage).minutes, 0),
      tuition: num(obj(stage).tuition, 0),
      gain: num(obj(stage).gain, 0),
      // B4: the lesson numbers this stage covers (upTo null = no end).
      from: num(obj(stage).from, 0),
      upTo: typeof obj(stage).upTo === 'number' ? obj(stage).upTo : null,
      // Which courses this stage teaches — empty on an old host, in which
      // case the panel shows every subject rather than none.
      subjects: arr(obj(stage).subjects).filter(key => typeof key === 'string'),
      // The school ladder: a stage with `unlocked === false` is gated behind
      // finishing the previous one, and says by how much.
      unlocked: obj(stage).unlocked !== false,
      progress: isObj(obj(stage).progress) ? {
        done: num(obj(stage).progress.done, 0),
        need: num(obj(stage).progress.need, 0),
        label: str(obj(stage).progress.label, ''),
      } : null,
    })).filter(stage => stage.key !== ''),
    trips: arr(d.trips).map(trip => ({
      key: str(obj(trip).key, ''),
      label: str(obj(trip).label, '目的地'),
      emoji: str(obj(trip).emoji, '🧳'),
      minutes: num(obj(trip).minutes, 0),
      cost: num(obj(trip).cost, 0),
      happiness: num(obj(trip).happiness, 0),
      // What the destination can bring back — the far trips advertise it.
      souvenirCount: num(obj(trip).souvenirCount, 0),
      bestRarity: str(obj(trip).bestRarity, ''),
      bestRarityEmoji: str(obj(trip).bestRarityEmoji, ''),
      affordable: obj(trip).affordable === true,
      available: obj(trip).available === true,
    })).filter(trip => trip.key !== ''),
    // 家当: owned and worn, never counted. An old host sends none.
    dress: arr(d.dress).map(entry => ({
      key: str(obj(entry).key, ''),
      label: str(obj(entry).label, '装扮'),
      emoji: str(obj(entry).emoji, '👕'),
      price: num(obj(entry).price, 0),
      level: num(obj(entry).level, 1),
      slot: str(obj(entry).slot, ''),
      slotLabel: str(obj(entry).slotLabel, ''),
      blurb: str(obj(entry).blurb, ''),
      owned: obj(entry).owned === true,
      worn: obj(entry).worn === true,
      unlocked: obj(entry).unlocked !== false,
    })).filter(entry => entry.key !== ''),
    shop: arr(d.shop).map(item => ({
      key: str(obj(item).key, ''),
      label: str(obj(item).label, '物品'),
      emoji: str(obj(item).emoji, '📦'),
      price: num(obj(item).price, 0),
      kind: str(obj(item).kind, 'food'),
      tier: typeof obj(item).tier === 'number' ? obj(item).tier : null,
      // 家当 fields: a dress item is owned (not counted) or waits for a level.
      level: typeof obj(item).level === 'number' ? obj(item).level : null,
      owned: obj(item).owned === true,
      worn: obj(item).worn === true,
      unlocked: obj(item).unlocked !== false,
      blurb: str(obj(item).blurb, ''),
      useLabel: str(obj(item).useLabel, '使用'),
      affordable: obj(item).affordable === true,
      needed: obj(item).needed === true,
    })).filter(item => item.key !== ''),
    inventory: obj(d.inventory),
    dex: normalizeDex(d.dex),
    skins: normalizeSkins(d.skins),
    economy: normalizeEconomy(d.economy),
    fishing: normalizeFishing(d.fishing),
    ...normalizeExtensionParts(d), // 下载扩展的 App、货架和图鉴入口
    daily: {
      canSignIn: obj(d.daily).canSignIn === true,
      signInDay: num(obj(d.daily).signInDay, 1),
      signInTotal: num(obj(d.daily).signInTotal, 0),
      cycle: num(obj(d.daily).cycle, 12),
      unclaimed: num(obj(d.daily).unclaimed, 0),
      onlineMinutes: num(obj(d.daily).onlineMinutes, 0),
    },
    // 新到旧；老宿主没有 diary 时是空数组，面板不显示这一栏。
    // C2 番茄钟：老宿主不发就是 null，页签显示「宿主还没提供」。
    pomodoro: isObj(d.pomodoro) ? {
      active: d.pomodoro.active === true,
      minutes: num(d.pomodoro.minutes, 0),
      secondsLeft: num(d.pomodoro.secondsLeft, 0),
      breakSecondsLeft: num(d.pomodoro.breakSecondsLeft, 0),
      todayDone: num(d.pomodoro.todayDone, 0),
      rewardedToday: num(d.pomodoro.rewardedToday, 0),
      cap: num(d.pomodoro.cap, 8),
      reward: {
        coins: num(obj(d.pomodoro.reward).coins, 0),
        happiness: num(obj(d.pomodoro.reward).happiness, 0),
      },
      breakMinutes: num(d.pomodoro.breakMinutes, 5),
      options: arr(d.pomodoro.options).filter(value => typeof value === 'number'),
      finishedAt: typeof d.pomodoro.finishedAt === 'number' ? d.pomodoro.finishedAt : null,
    } : null,
    diary: arr(d.diary).map(entry => ({
      day: str(obj(entry).day, ''),
      text: str(obj(entry).text, ''),
    })).filter(entry => entry.day !== '' && entry.text !== ''),
    // Which items each care action could spend right now.
    care: (() => {
      const out = {}
      const source = obj(d.care)
      for (const action of ['feed', 'bathe', 'play']) {
        out[action] = arr(source[action]).map(entry => ({
          key: str(obj(entry).key, ''),
          label: str(obj(entry).label, '物品'),
          emoji: str(obj(entry).emoji, '📦'),
          default: obj(entry).default === true,
          count: typeof obj(entry).count === 'number' ? obj(entry).count : null,
          satiety: num(obj(entry).satiety, 0),
          happiness: num(obj(entry).happiness, 0),
          cleanliness: num(obj(entry).cleanliness, 0),
        })).filter(entry => entry.key !== '')
      }
      return out
    })(),
    activity: isObj(d.activity) ? {
      kind: str(d.activity.kind, 'work'),
      key: str(d.activity.key, ''),
      label: str(d.activity.label, '外面'),
      emoji: str(d.activity.emoji, '💼'),
      secondsLeft: num(d.activity.secondsLeft, 0), cost: num(d.activity.cost, 0),
      progress: num(d.activity.progress, 0),
    } : null,
    canGoOut: d.canGoOut === true,
    timeScale: num(d.timeScale, 1),
    boxStage: isObj(d.boxStage) ? {
      key: str(d.boxStage.key, 'box'),
      label: str(d.boxStage.label, '纸盒'),
      emoji: str(d.boxStage.emoji, '📦'),
      size: num(d.boxStage.size, 58),
    } : { key: 'box', label: '纸盒', emoji: '📦', size: 58 },
    awayBlocked: typeof d.awayBlocked === 'string' ? d.awayBlocked : null,
    // B9: the villager card. Older hosts send none, and the card says so.
    profile: isObj(d.profile) ? {
      personality: isObj(d.profile.personality) ? { label: str(d.profile.personality.label, ''), emoji: str(d.profile.personality.emoji, '') } : null,
      catchphrase: str(d.profile.catchphrase, ''),
      motto: str(d.profile.motto, ''),
      birthday: str(d.profile.birthday, ''),
      zodiac: isObj(d.profile.zodiac) ? { label: str(d.profile.zodiac.label, ''), emoji: str(d.profile.zodiac.emoji, '') } : null,
      counts: {
        days: num(obj(d.profile.counts).days, 0),
        certificates: num(obj(d.profile.counts).certificates, 0),
        souvenirs: num(obj(d.profile.counts).souvenirs, 0),
        graduations: num(obj(d.profile.counts).graduations, 0),
      },
    } : null,
    // 形态: the forms and how close the pig is. Older hosts send none, and older
    // hosts also have no `via` — treat those as 加冕, which is what they were.
    forms: isObj(d.forms) ? {
      current: typeof d.forms.current === 'string' ? d.forms.current : null,
      forms: arr(d.forms.forms).map(function (raw) {
        var f = obj(raw)
        return {
          key: str(f.key, ''), via: str(f.via, 'item'), item: str(f.item, ''), label: str(f.label, ''), emoji: str(f.emoji, '👑'), art: str(f.art, ''),
          hasItem: f.hasItem === true,
          stage: str(f.stage, ''),
          fromLevel: num(f.fromLevel, 1),
          current: f.current === true, ready: f.ready === true,
          requirements: arr(f.requirements).map(function (row) {
            var r = obj(row)
            return { key: str(r.key, ''), label: str(r.label, ''), have: num(r.have, 0), need: num(r.need, 0), met: r.met === true }
          }),
        }
      }),
    } : null,
    // B6: what the pig calls its owner, and 免打扰. Older hosts send neither.
    dialogue: {
      ownerName: str(obj(d.dialogue).ownerName, '主人'),
      quiet: obj(d.dialogue).quiet === true,
    },
    pending: arr(d.pending).filter(e => isObj(e) && typeof e.at === 'number').map(e => ({
      id: num(e.id, 0),
      kind: str(e.kind, ''),
      text: str(e.text, ''),
      at: e.at,
      replies: arr(e.replies).filter(label => typeof label === 'string'),
    })),
    maxHealth: num(d.maxHealth, 5),
  }
}

export function normalizeActions(raw) {
  var source = obj(raw)
  var out = {}
  for (var i = 0; i < MODES.length; i += 1) {
    var key = MODES[i]
    var entry = obj(source[key])
    out[key] = {
      ready: entry.ready !== false,
      waitSeconds: num(entry.waitSeconds, 0),
      blocked: typeof entry.blocked === 'string' ? entry.blocked : null,
    }
  }
  return out
}
