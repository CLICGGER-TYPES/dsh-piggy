// GENERATED FILE. Edit src/extensions/farm/ and run `npm run build`; do not edit by hand.
// The download protocol is still manifest.json + server.js + client.js + assets; this bundle has no runtime imports.

// src/extensions/farm/data.js
var PLOTS = 18;
var START_PLOTS = 6;
var RECLAIM_PRICE = 1e4;
var PEST_MS = 4 * 36e5;
var PEST_LOSS = 2;
var CARE_EXP = 2;
var EXP_PER_LEVEL = 100;
var EXP_CAP = Number.MAX_SAFE_INTEGER;
var EXERT = 0.2;
var LESSON = { reward: 12, seed: "scallion", ripeMs: 18e4, wateredMs: 12e4 };
var HOUR_MS = 36e5;
var CROPS = [
  { key: "radish", emoji: "🥕", label: "白萝卜", level: 1, price: 80, hours: 14, exp: 10, yield: 24, sell: 18, seasons: 1 },
  { key: "apple", emoji: "🍎", label: "苹果", level: 1, price: 75, hours: 20, exp: 12, yield: 24, sell: 18, seasons: 1 },
  { key: "grape", emoji: "🍇", label: "葡萄", level: 1, price: 70, hours: 17, exp: 11, yield: 24, sell: 18, seasons: 1 },
  { key: "carrot", emoji: "🥕", label: "胡萝卜", level: 2, price: 90, hours: 16, exp: 12, yield: 25, sell: 20, seasons: 1 },
  { key: "peach", emoji: "🍑", label: "桃子", level: 2, price: 85, hours: 16, exp: 14, yield: 25, sell: 20, seasons: 1 },
  { key: "watermelon", emoji: "🍉", label: "西瓜", level: 2, price: 90, hours: 19, exp: 15, yield: 25, sell: 20, seasons: 1 },
  { key: "potato", emoji: "🥔", label: "土豆", level: 3, price: 120, hours: 17, exp: 14, yield: 22, sell: 22, seasons: 1 },
  { key: "chili", emoji: "🌶️", label: "辣椒", level: 3, price: 110, hours: 16, exp: 16, yield: 22, sell: 22, seasons: 1 },
  { key: "banana", emoji: "🍌", label: "香蕉", level: 3, price: 95, hours: 20, exp: 18, yield: 22, sell: 22, seasons: 1 },
  { key: "tomato", emoji: "🍅", label: "西红柿", level: 4, price: 110, hours: 18, exp: 18, yield: 26, sell: 24, seasons: 1 },
  { key: "eggplant", emoji: "🍆", label: "茄子", level: 4, price: 120, hours: 20, exp: 20, yield: 26, sell: 24, seasons: 1 },
  { key: "pea", emoji: "🫛", label: "豌豆", level: 4, price: 120, hours: 20, exp: 20, yield: 26, sell: 24, seasons: 1 },
  { key: "pineapple", emoji: "🍍", label: "菠萝", level: 4, price: 110, hours: 28, exp: 18, yield: 26, sell: 24, seasons: 1 },
  { key: "corn", emoji: "🌽", label: "玉米", level: 5, price: 105, hours: 19, exp: 22, yield: 20, sell: 28, seasons: 1 },
  { key: "pomelo", emoji: "🍈", label: "柚子", level: 5, price: 120, hours: 22, exp: 32, yield: 20, sell: 28, seasons: 2 },
  { key: "strawberry", emoji: "🍓", label: "草莓", level: 6, price: 130, hours: 24, exp: 26, yield: 24, sell: 18, seasons: 1, food: "strawberry", foodLabel: "草莓" },
  { key: "pumpkin", emoji: "🎃", label: "南瓜", level: 7, price: 300, hours: 22, exp: 28, yield: 28, sell: 30, seasons: 2, food: "pumpkin", foodLabel: "南瓜粥" },
  { key: "orange", emoji: "🍊", label: "橘子", level: 7, price: 160, hours: 24, exp: 26, yield: 28, sell: 30, seasons: 2 },
  { key: "pomegranate", emoji: "🍎", label: "石榴", level: 8, price: 170, hours: 27, exp: 20, yield: 30, sell: 32, seasons: 3 },
  { key: "coconut", emoji: "🥥", label: "椰子", level: 9, price: 190, hours: 30, exp: 28, yield: 30, sell: 35, seasons: 3 },
  { key: "scallion", emoji: "🧅", label: "小葱", level: 1, price: 70, hours: 14, exp: 10, yield: 24, sell: 18, seasons: 1 },
  { key: "sprout", emoji: "🌱", label: "豆芽", level: 1, price: 75, hours: 15, exp: 10, yield: 25, sell: 18, seasons: 1 },
  { key: "coriander", emoji: "🌿", label: "香菜", level: 2, price: 85, hours: 16, exp: 12, yield: 24, sell: 20, seasons: 1 },
  { key: "lettuce", emoji: "🥗", label: "生菜", level: 2, price: 90, hours: 17, exp: 13, yield: 25, sell: 20, seasons: 1 },
  { key: "cabbage", emoji: "🥬", label: "小白菜", level: 3, price: 100, hours: 18, exp: 15, yield: 24, sell: 22, seasons: 1 },
  { key: "blueberry", emoji: "🫐", label: "蓝莓", level: 5, price: 140, hours: 22, exp: 22, yield: 26, sell: 26, seasons: 1 },
  { key: "sweetpotato", emoji: "🍠", label: "红薯", level: 6, price: 150, hours: 24, exp: 24, yield: 26, sell: 28, seasons: 1, food: "sweetpotato", foodLabel: "烤红薯" },
  { key: "sunflower", emoji: "🌻", label: "向日葵", level: 7, price: 170, hours: 26, exp: 26, yield: 28, sell: 30, seasons: 1 },
  { key: "melon", emoji: "🍈", label: "哈密瓜", level: 9, price: 200, hours: 30, exp: 28, yield: 30, sell: 34, seasons: 1 }
];
var TOOLS = [{ key: "sickle", label: "收割镰", price: 1e3, note: "解锁一键收获" }, { key: "sprayer", label: "喷雾桶", price: 600, note: "解锁一键照料" }, { key: "rake", label: "平地耙", price: 800, note: "解锁一键铲除" }, { key: "planter", label: "播种器", price: 1800, note: "解锁一键播种" }];
var FERTILIZERS = [{ key: "fert-1", label: "普通肥料", price: 500, hours: 2 }, { key: "fert-2", label: "快速肥料", price: 800, hours: 3.5 }, { key: "fert-3", label: "急速肥料", price: 1e3, hours: 5 }];
var PESTS = ["weed", "bug", "dry"];
var STAGES = ["seed", "sprout", "seedling", "growing", "flowering", "ripe"];
var STAGE_AT = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 1];
var REGROW_AT = 3 / 6;
var OLD_YIELD = { sprout: 2, scallion: 3, coriander: 3, lettuce: 3, cabbage: 3, strawberry: 3, blueberry: 4, carrot: 4, sweetpotato: 3, tomato: 4, corn: 5, pumpkin: 2, sunflower: 3, watermelon: 2, grape: 3, melon: 2 };
var OLD_SPRINKLER = 3e3;
var OLD_FERTILIZER = 20;
var OLD_HELPER_BARN_PRICES = [0, 1e3, 3e3, 9e3];

// src/extensions/farm/host.js
function purse(api) {
  return api.wallet ? api.wallet : { currency: { label: "金币", emoji: "🪙", rate: 1 }, balance: () => api.coins(), earn: (n, source) => api.earn(n, source), spend: (n, sink) => api.spend(n, sink) };
}
var tire = (api, plots = 1) => {
  if (typeof api.exert === "function") api.exert(EXERT * plots);
};
function payRefund(data, api) {
  if (data.refund > 0 && api) {
    purse(api).earn(data.refund, "refund");
    if (data.helperBarnRefund > 0 && typeof api.say === "function") api.say("农具暂时下架，已退还 " + data.helperBarnRefund + " 菜币");
    data.refund = 0;
    data.helperBarnRefund = 0;
  }
}

// src/extensions/farm/pure.js
var cropFor = (key) => CROPS.find((crop) => crop.key === key) ?? null;
var toolFor = (key) => TOOLS.find((tool) => tool.key === key) ?? null;
var fertFor = (key) => FERTILIZERS.find((fert) => fert.key === key) ?? null;
var count = (value) => Math.max(0, Math.floor(Number(value) || 0));
var validCount = (value) => Number.isSafeInteger(value) && value > 0;
var isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var random = Math.random;
function setRandom(fn) {
  random = typeof fn === "function" ? fn : Math.random;
}
var randomValue = () => random();
var nextPest = (from) => from + Math.round(-Math.log(1 - Math.min(0.999999, random())) * PEST_MS);
function weatherAt(at) {
  const date = new Date(at);
  const day = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  let h = Math.imul(day, 2654435761) >>> 0;
  h = Math.imul(h ^ h >>> 15, 2246822519) >>> 0;
  return (h ^ h >>> 13) % 2 === 0 ? "rain" : "sunny";
}
function droughtAt(at) {
  while (Number.isFinite(at) && weatherAt(at) === "rain") at = new Date(at).setHours(24, 0, 0, 0);
  return at;
}
var seasonMs = (crop) => crop.hours * HOUR_MS;
function sow(crop, at, season = 1, offset = 0) {
  return { crop: crop.key, season, plantedAt: at - offset, boostMs: 0, roll: Math.floor(random() * 6) - 3, pests: { weed: nextPest(at), bug: nextPest(at), dry: nextPest(at) } };
}
var ageOf = (plot, crop, now) => Math.min(1, Math.max(0, (now - plot.plantedAt + plot.boostMs) / seasonMs(crop)));
var ripeAt = (plot, crop) => plot.plantedAt - plot.boostMs + seasonMs(crop);
var pestOn = (plot, crop, kind, at) => (kind !== "dry" || weatherAt(at) !== "rain") && (kind === "dry" ? droughtAt(plot.pests[kind]) : plot.pests[kind]) <= Math.min(at, ripeAt(plot, crop));
function plotState(plot, now) {
  if (plot === null) return null;
  if (plot.fallow) return { empty: true, stubble: plot.stubble, pests: PESTS.filter((kind) => plot.pests[kind] === 0 && (kind !== "dry" || weatherAt(now) !== "rain")), ripe: false, withered: false };
  if (plot.withered) return { crop: plot.crop, stage: "withered", withered: true, pests: [], ripe: false, progress: 0, remainingMs: 0, yield: 0 };
  const crop = cropFor(plot.crop);
  if (crop === null) return null;
  const age = ageOf(plot, crop, now);
  const index = STAGE_AT.filter((threshold) => age >= threshold).length - 1;
  const ripe = age >= 1;
  const pests = PESTS.filter((kind) => pestOn(plot, crop, kind, now));
  return {
    crop: crop.key,
    stage: STAGES[index],
    ripe,
    withered: false,
    season: plot.season,
    seasons: crop.seasons,
    pests,
    progress: age,
    remainingMs: ripe ? 0 : Math.max(0, ripeAt(plot, crop) - now),
    yield: ripe ? Math.max(1, crop.yield + plot.roll - PEST_LOSS * pests.length) : 0
  };
}
function levelOf(exp) {
  const total = Math.min(EXP_CAP, count(exp)), reach = (level2) => EXP_PER_LEVEL / 2 * level2 * (level2 - 1);
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + total / 12.5)) / 2));
  level += reach(level + 1) <= total ? 1 : reach(level) > total ? -1 : 0;
  return { level, exp: total - reach(level), need: level * EXP_PER_LEVEL };
}

// src/extensions/farm/plot-rules.js
var availablePlot = (data, index) => Number.isInteger(index) && index >= 0 && index < data.unlocked;
var amountFor = (data, field, key) => count(data[field][key]);
var owns = (data, tool) => data.tools[tool] === true;
var levelNow = (data) => levelOf(data.exp).level;
var lessonAt = (o) => o.plantedAt === null ? null : o.plantedAt + (o.wateredAt === null ? LESSON.ripeMs : LESSON.wateredMs);
var lessonDone = (legacy) => ({ step: "done", rewarded: true, legacy, plantedAt: null, wateredAt: null });
var lessonProgress = (d) => d.exp > 0 || d.unlocked > START_PLOTS || d.refund > 0 || d.helperBarnRefund > 0 || d.helperBarnRefunded === true || d.helper.hired || d.helper.level > 0 || d.helper.usedMs > 0 || d.helper.pending !== null || d.helper.targets.some(Boolean) || Object.values(d.helper.stock).some((n) => count(n) > 0) || d.plots.some((plot) => plot !== null && plot.fallow !== true) || ["seeds", "harvest", "acquired", "harvests", "fert"].some((field) => Object.values(d[field]).some((n) => count(n) > 0)) || Object.values(d.tools).some((on) => on === true);
function gainExp(data, n) {
  const before = levelNow(data);
  data.exp += n;
  return levelNow(data) > before ? levelNow(data) : null;
}
function recordHarvest(data, key, n, into) {
  into[key] = count(into[key]) + n;
  data.acquired[key] = amountFor(data, "acquired", key) + n;
  data.harvests[key] = amountFor(data, "harvests", key) + 1;
}
function harvestPlot(data, index, at, into = data.harvest) {
  const plot = data.plots[index];
  const state = plotState(plot, at);
  if (state === null || !state.ripe) return null;
  const crop = cropFor(plot.crop);
  recordHarvest(data, crop.key, state.yield, into);
  const level = gainExp(data, crop.exp);
  data.plots[index] = plot.season < crop.seasons ? sow(crop, at, plot.season + 1, REGROW_AT * seasonMs(crop)) : { crop: crop.key, withered: true };
  return { crop, n: state.yield, level };
}
function carePlot(data, index, at, kind = null) {
  const plot = data.plots[index];
  const state = plotState(plot, at);
  if (state === null || state.ripe || state.withered) return 0;
  const pests = state.pests.filter((pest) => kind === null || kind === pest);
  for (const pest of pests) plot.pests[pest] = plot.fallow ? null : nextPest(at);
  return pests.length;
}
function clearPlot(data, index, force = false) {
  const plot = data.plots[index];
  if (plot?.fallow && plot.stubble) {
    plot.stubble = false;
    gainExp(data, CARE_EXP);
    return true;
  }
  if (plot !== null && !plot.fallow && (plot.withered || force)) {
    data.plots[index] = null;
    return true;
  }
  return false;
}
function plantPlot(data, index, crop, at) {
  const old = data.plots[index];
  if (old !== null && (!old.fallow || old.stubble || old.pests.weed === 0) || amountFor(data, "seeds", crop.key) < 1 || levelNow(data) < crop.level) return false;
  data.seeds[crop.key] -= 1;
  data.plots[index] = sow(crop, at);
  if (old?.fallow && old.pests.dry === 0) data.plots[index].pests.dry = at;
  return true;
}
function batchAction(data, api, spec) {
  if (spec.tool && !owns(data, spec.tool)) return { ok: false, reason: "locked" };
  const indices = spec.indices ?? Array.from({ length: data.unlocked }, (_, index) => index);
  const results = indices.map(spec.visit);
  const total = results.reduce((sum, n) => sum + n, 0);
  if (!total) return { ok: false, reason: spec.reason ?? "unavailable" };
  tire(api, results.filter(Boolean).length);
  const level = spec.exp ? gainExp(data, total * spec.exp) : null;
  if (level) api.say("菜园升到 " + level + " 级了！");
  return { ok: true, [spec.key]: total };
}
var plotAction = (handler) => (data, payload, api) => availablePlot(data, payload?.plot) ? handler(data, payload, api) : { ok: false, reason: "locked" };
function sayHarvest(result) {
  const head = result.crop.key === "carrot" ? "收获 " + result.n + " 个胡萝卜，我一个都没偷吃" : "收获 " + result.n + " 个" + result.crop.label + "，菜园有收成啦！";
  return result.level ? head + "菜园升到 " + result.level + " 级了！" : head;
}

// src/extensions/farm/helper.js
var HELPER_PLOTS = [4, 8, 16];
var HELPER_SHARE = 0.9;
var HELPER_WINDOW = 6 * 36e5;
var HELPER_PRICES = { hire: 2500, level: [0, 2e3, 6e3] };
function helperRecipe(key, level) {
  const crop = cropFor(key);
  if (!crop) return null;
  const manual = HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours;
  const cap = Math.min(400, manual * 0.92), target = Math.min(400, manual * HELPER_SHARE);
  let best = null, make = (batches, y, degraded) => {
    const net = (y * crop.sell - crop.price) * batches / 6;
    return { yield: y, intervalMs: HELPER_WINDOW / batches, net, itemsPerHour: y * batches / 6, batches, share: manual > 0 ? net / manual : 0, degraded: degraded === true };
  }, gap = (net) => Math.abs(net - manual * HELPER_SHARE);
  for (let batches = 1; batches <= 60; batches += 1) {
    const y = Math.round((target * 6 / batches + crop.price) / crop.sell), net = (y * crop.sell - crop.price) * batches / 6, ok = y >= 1 && y <= crop.yield;
    if (ok && net >= manual * 0.85 && net <= cap) return make(batches, y, false);
    if (ok && net > 0 && net <= cap && (!best || gap(net) < gap(best.net))) best = make(batches, y, true);
  }
  return best ?? make(1, 1, true);
}
function normalizeHelper(data) {
  const raw = isObject(data.helper) ? data.helper : {};
  const level = Math.min(2, count(raw.level));
  const barn = Math.min(3, count(raw.barn));
  const recipe = helperRecipe(raw.pending?.crop, level), pending = recipe && Number.isFinite(raw.pending.remainingMs) && Number.isInteger(raw.pending.index) ? { ...raw.pending, remainingMs: Math.max(0, Math.min(recipe.intervalMs, raw.pending.remainingMs)), yield: recipe.yield } : null;
  data.helper = {
    hired: raw.hired === true,
    level,
    barn,
    lastAt: Number.isFinite(raw.lastAt) ? raw.lastAt : null,
    usedMs: Number.isFinite(raw.usedMs) ? Math.max(0, Math.min(HELPER_WINDOW, raw.usedMs)) : 0,
    cursor: count(raw.cursor) % PLOTS,
    pending,
    targets: Array.from({ length: PLOTS }, (_, index) => cropFor(raw.targets?.[index]) ? raw.targets[index] : null),
    stock: Object.fromEntries(CROPS.map((crop) => [crop.key, count(raw.stock?.[crop.key])]))
  };
}
var helperCount = (data) => Object.values(data.helper.stock).reduce((sum, n) => sum + Number(n), 0);
var helperPlots = (data) => data.helper.hired ? Math.min(data.unlocked, HELPER_PLOTS[data.helper.level]) : 0;
function prepareHelper(data, at) {
  const helper = data.helper;
  const managed = helperPlots(data);
  for (let offset = 0; offset < managed; offset += 1) {
    const index = (helper.cursor + offset) % managed;
    let plot = data.plots[index];
    if (plot?.withered) data.plots[index] = plot = null;
    if (plot?.fallow && (plot.stubble || plot.pests.weed === 0)) {
      plot.stubble = false;
      plot.pests.weed = null;
    }
    const crop = cropFor(plot?.crop) ?? cropFor(helper.targets[index]);
    if (!crop) continue;
    helper.targets[index] = crop.key;
    if (!plot || plot.fallow) {
      if (!plantPlot(data, index, crop, at)) continue;
      plot = data.plots[index];
    }
    const recipe = helperRecipe(crop.key, helper.level);
    if (!recipe) continue;
    helper.pending = { index, crop: crop.key, plantedAt: plot.plantedAt, remainingMs: recipe.intervalMs, yield: recipe.yield };
    return true;
  }
  return false;
}
function settleHelper(data, now) {
  if (weatherAt(now) === "rain") for (const plot of data.plots) {
    if (plot?.fallow) plot.pests.dry = null;
    else if (plot?.pests?.dry <= now) plot.pests.dry = droughtAt(now);
  }
  const helper = data.helper;
  if (!helperPlots(data) || !Number.isFinite(now)) return;
  const start = helper.lastAt ?? now;
  if (now < start) return;
  const pendingPlot = helper.pending ? data.plots[helper.pending.index] : null;
  if (helper.pending && (!pendingPlot || pendingPlot.withered || pendingPlot.plantedAt !== helper.pending.plantedAt || pendingPlot.crop !== helper.pending.crop)) helper.pending = null;
  let remaining = Math.min(now - start, HELPER_WINDOW - helper.usedMs);
  let at = start;
  if (!helper.pending) prepareHelper(data, start);
  while (remaining > 0 && helper.pending) {
    const pending = helper.pending;
    const elapsed = Math.min(remaining, pending.remainingMs);
    pending.remainingMs -= elapsed;
    helper.usedMs += elapsed;
    remaining -= elapsed;
    at += elapsed;
    if (pending.remainingMs > 1e-5) break;
    recordHarvest(data, pending.crop, pending.yield, helper.stock);
    data.plots[pending.index] = null;
    helper.cursor = (pending.index + 1) % helperPlots(data);
    helper.pending = null;
    if (helper.usedMs >= HELPER_WINDOW - 1e-5) {
      helper.usedMs = HELPER_WINDOW;
      break;
    }
    plantPlot(data, pending.index, cropFor(pending.crop), at);
    if (!prepareHelper(data, at)) break;
  }
  helper.lastAt = now;
}
function helperView(data) {
  const helper = data.helper;
  const managed = helperPlots(data);
  const missing = helper.targets.slice(0, managed).filter((key, index) => key && (!data.plots[index] || data.plots[index].fallow) && amountFor(data, "seeds", key) === 0);
  const seedless = managed > 0 && !helper.pending && !data.plots.slice(0, managed).some((plot) => plot?.crop) && !helper.targets.slice(0, managed).some((key) => key && amountFor(data, "seeds", key) > 0);
  return {
    hired: helper.hired,
    plots: managed,
    stored: helperCount(data),
    usedHours: helper.usedMs / 36e5,
    capacityHours: 6,
    full: helper.usedMs >= HELPER_WINDOW,
    seedless,
    missing: [...new Set(missing)].map((key) => cropFor(key).label)
  };
}
function helperPlotView(data, index, state) {
  if (index >= helperPlots(data) || state === null || state.ripe || state.withered) return {};
  const recipe = helperRecipe(state.crop, data.helper.level);
  if (!recipe) return {};
  const pending = data.helper.pending?.index === index ? data.helper.pending : null;
  const remainingMs = pending?.remainingMs ?? recipe.intervalMs;
  const progress2 = pending ? Math.max(0, Math.min(1, 1 - remainingMs / recipe.intervalMs)) : 0;
  return {
    helperNote: data.helper.usedMs >= HELPER_WINDOW ? "等帮工接着干" : pending ? "帮工处理中" : "等帮工",
    pests: [],
    stage: STAGES[Math.min(4, Math.floor(progress2 * 5))],
    progress: progress2,
    remainingMs
  };
}
function helperShelf(data, balance) {
  const helper = data.helper;
  const level = helper.hired ? helper.level + 1 : null;
  const price = helper.hired ? HELPER_PRICES.level[level] : HELPER_PRICES.hire;
  if (price === void 0) return [];
  const label = helper.hired ? ["帮工猪", "熟练帮工", "老练帮工"][level] : "雇帮工猪";
  const note = helper.hired ? "管 " + HELPER_PLOTS[level] + " 块地" : "管 " + HELPER_PLOTS[0] + " 块地，6 小时封仓";
  return [{ key: helper.hired ? "helper-level" : "helper-hire", emoji: "🐷", label, note, price, disabled: balance < price, pick: null }];
}
function helperBuy(data, payload, api) {
  const helper = data.helper;
  const kind = String(payload?.item).replace("helper-", "");
  if (kind === "hire") {
    if (helper.hired) return { ok: false, reason: "owned" };
    if (!purse(api).spend(HELPER_PRICES.hire, "helper")) return { ok: false, reason: "poor" };
    helper.hired = true;
    helper.lastAt = api.now;
  } else {
    if (kind !== "level" || !helper.hired) return { ok: false, reason: "locked" };
    const price = HELPER_PRICES.level[helper.level + 1];
    if (price === void 0) return { ok: false, reason: "owned" };
    if (!purse(api).spend(price, "helper")) return { ok: false, reason: "poor" };
    helper.level += 1;
  }
  return { ok: true };
}
function collectHelper(data) {
  if (!helperCount(data) && data.helper.usedMs === 0) return { ok: false, reason: "empty" };
  for (const crop of CROPS) data.harvest[crop.key] = amountFor(data, "harvest", crop.key) + data.helper.stock[crop.key];
  data.helper.stock = Object.fromEntries(CROPS.map((crop) => [crop.key, 0]));
  data.helper.usedMs = 0;
  return { ok: true };
}

// src/extensions/farm/migration.js
function migrate(data) {
  const oldPlots = Array.isArray(data.plots) ? data.plots : [];
  const harvest = isObject(data.harvest) ? data.harvest : {};
  const acquired = isObject(data.acquired) ? data.acquired : {};
  const harvests = {};
  for (const plot of oldPlots) {
    if (!isObject(plot) || !OLD_YIELD[plot.crop]) continue;
    harvest[plot.crop] = count(harvest[plot.crop]) + OLD_YIELD[plot.crop];
    acquired[plot.crop] = count(acquired[plot.crop]) + OLD_YIELD[plot.crop];
  }
  for (const [key, yieldCount] of Object.entries(OLD_YIELD)) harvests[key] = Math.floor(count(acquired[key]) / yieldCount);
  const tools = isObject(data.tools) ? data.tools : {};
  const sprinklers = Array.isArray(data.sprinklers) ? data.sprinklers.filter((on) => on === true).length : 0;
  const pastHarvests = Object.values(harvests).reduce((sum, n) => sum + n, 0);
  const helper = isObject(data.helper) ? data.helper : {};
  return {
    version: 4,
    unlocked: Math.max(START_PLOTS, Math.min(PLOTS, count(data.unlocked))),
    plots: [],
    seeds: isObject(data.seeds) ? data.seeds : {},
    harvest,
    acquired,
    harvests,
    tools: { sickle: tools.sickle === true, sprayer: tools.can === true, rake: false, planter: tools.planter === true },
    fert: {},
    exp: pastHarvests * 10,
    refund: sprinklers * OLD_SPRINKLER + count(data.fertilizer) * OLD_FERTILIZER,
    helper: { hired: helper.hired === true, level: count(helper.level), barn: count(helper.barn), usedMs: helper.usedMs, lastAt: helper.lastAt, stock: isObject(helper.stock) ? helper.stock : {} }
  };
}
function refundOldBarn(data) {
  if (data.helperBarnRefunded === true || data.helper.barn < 1) return;
  let amount2 = 0;
  for (let stage = 1; stage <= data.helper.barn; stage += 1) amount2 += OLD_HELPER_BARN_PRICES[stage];
  data.refund += amount2;
  data.helperBarnRefund = amount2;
  data.helper.barn = 0;
  data.helperBarnRefunded = true;
}
function normalize(data) {
  if (count(data.version) < 4) {
    const old = { ...data };
    for (const key of Object.keys(data)) delete data[key];
    Object.assign(data, migrate(old));
  }
  data.unlocked = Math.max(START_PLOTS, Math.min(PLOTS, count(data.unlocked) || START_PLOTS));
  if (!Array.isArray(data.plots)) data.plots = [];
  data.plots = Array.from({ length: PLOTS }, (_, index) => {
    const plot = data.plots[index];
    if (!isObject(plot) || index >= data.unlocked) return null;
    if (plot.fallow === true) return { fallow: true, stubble: plot.stubble === true, pests: { dry: plot.pests?.dry === 0 ? 0 : null, weed: plot.pests?.weed === 0 ? 0 : null } };
    if (plot.withered === true) return cropFor(plot.crop) ? { crop: plot.crop, withered: true } : null;
    if (!cropFor(plot.crop) || !Number.isFinite(plot.plantedAt) || !isObject(plot.pests)) return null;
    return plot;
  });
  for (const field of ["seeds", "harvest", "acquired", "harvests", "tools", "fert"]) if (!isObject(data[field])) data[field] = {};
  data.exp = Math.min(EXP_CAP, count(data.exp));
  data.refund = count(data.refund);
  data.helperBarnRefund = count(data.helperBarnRefund);
  normalizeHelper(data);
  refundOldBarn(data);
  const known = count(data.version) >= 5, raw = known && isObject(data.onboarding) ? data.onboarding : null;
  if (!known) data.onboarding = lessonProgress(data) ? lessonDone(true) : { step: "offer", rewarded: false, legacy: false, plantedAt: null, wateredAt: null };
  else if (raw === null || !["offer", "planted", "done"].includes(raw.step) || raw.step === "planted" && !Number.isFinite(raw.plantedAt) || raw.step !== "done" && (raw.rewarded || raw.legacy)) data.onboarding = lessonDone(true);
  else data.onboarding = raw.step === "done" ? { step: "done", rewarded: true, legacy: raw.legacy === true, plantedAt: Number.isFinite(raw.plantedAt) ? raw.plantedAt : null, wateredAt: Number.isFinite(raw.wateredAt) ? raw.wateredAt : null } : { step: raw.step, rewarded: false, legacy: false, plantedAt: raw.step === "offer" ? null : raw.plantedAt, wateredAt: raw.step === "offer" ? null : Number.isFinite(raw.wateredAt) ? raw.wateredAt : null };
  data.version = Math.max(5, count(data.version));
  return data;
}
function newGround() {
  const weed = randomValue() < 0.8;
  return { fallow: true, stubble: !weed || randomValue() < 0.5, pests: { dry: 0, weed: weed ? 0 : null } };
}

// src/extensions/farm/actions.js
var actions = {
  /** 商店：种子（可一次买多颗）、工具、肥料、帮工。 */
  buy(data, payload, api) {
    const wallet = purse(api);
    const item = String(payload?.item ?? "");
    if (item.startsWith("helper-")) return helperBuy(data, payload, api);
    const n = payload?.count === void 0 ? 1 : payload.count;
    const crop = cropFor(item), fert = fertFor(item);
    const consumable = crop ?? fert;
    if (consumable !== null) {
      const limit = crop ? 999 : 99;
      if (!validCount(n) || n > limit) return { ok: false, reason: "unavailable" };
      if (crop && levelNow(data) < crop.level) return { ok: false, reason: "level" };
      if (!wallet.spend(consumable.price * n, crop ? "seed" : "fertilizer")) return { ok: false, reason: "poor" };
      const field = crop ? "seeds" : "fert";
      data[field][item] = amountFor(data, field, item) + n;
      return { ok: true };
    }
    const tool = toolFor(item);
    if (tool === null || owns(data, tool.key)) return { ok: false, reason: tool === null ? "unknown" : "owned" };
    if (!wallet.spend(tool.price, "tool")) return { ok: false, reason: "poor" };
    data.tools[tool.key] = true;
    api.say("买到了" + tool.label + "！" + tool.note.replace("解锁", "以后可以"));
    return { ok: true };
  },
  /** 开垦下一块荒地（只能按顺序开）。 */
  unlock(data, payload, api) {
    if (payload?.plot !== data.unlocked || data.unlocked >= PLOTS) return { ok: false, reason: "locked" };
    if (!purse(api).spend(RECLAIM_PRICE, "plot")) return { ok: false, reason: "poor" };
    data.plots[data.unlocked] = newGround();
    return { ok: true, plots: data.unlocked += 1 };
  },
  /** 第一课：op = start / plant / water / harvest；不碰普通地块、种子、仓库、经验、体力或帮工。 */
  onboarding(data, payload, api) {
    const o = data.onboarding, op = String(payload?.op ?? ""), readyAt = lessonAt(o);
    const allowed = { start: o.step === "offer", plant: o.step === "offer", water: o.step === "planted" && o.wateredAt === null, harvest: o.step === "planted" && readyAt !== null && api.now >= readyAt }[op];
    if (!allowed) return { ok: false, reason: o.step === "done" || o.rewarded || op === "water" && o.wateredAt !== null || op === "start" && o.step !== "offer" || op === "plant" && o.step !== "offer" ? "already" : op === "harvest" ? "not-ripe" : "unavailable" };
    if (op === "start") return { ok: true, step: o.step };
    if (op === "plant") {
      o.step = "planted";
      o.plantedAt = api.now;
      o.wateredAt = null;
      return { ok: true };
    }
    if (op === "water") {
      o.wateredAt = api.now;
      return { ok: true };
    }
    o.step = "done";
    o.rewarded = true;
    purse(api).earn(LESSON.reward, "tutorial");
    data.seeds[LESSON.seed] = amountFor(data, "seeds", LESSON.seed) + 1;
    return { ok: true, earned: LESSON.reward, seed: LESSON.seed, exp: 0 };
  },
  plant(data, payload, api) {
    const crop = cropFor(payload?.item);
    if (crop === null || !availablePlot(data, payload.plot) || data.plots[payload.plot] !== null && !data.plots[payload.plot]?.fallow) return { ok: false, reason: "unavailable" };
    if (data.plots[payload.plot]?.fallow && (data.plots[payload.plot].stubble || data.plots[payload.plot].pests.weed === 0)) return { ok: false, reason: "clear-ground" };
    if (levelNow(data) < crop.level) return { ok: false, reason: "level" };
    if (!plantPlot(data, payload.plot, crop, api.now)) return { ok: false, reason: "no-seed" };
    tire(api);
    return { ok: true };
  },
  /** 照料一块地：kind 是 weed / bug / dry，不给就把这块地的毛病全治了。 */
  care: plotAction((data, payload, api) => {
    const kind = PESTS.includes(payload.kind) ? payload.kind : null;
    return batchAction(data, api, { indices: [payload.plot], key: "cured", visit: (index) => carePlot(data, index, api.now, kind), exp: CARE_EXP });
  }),
  fertilize: plotAction((data, payload, api) => {
    const fert = fertFor(payload.item);
    if (fert === null || amountFor(data, "fert", fert.key) < 1) return { ok: false, reason: "empty" };
    const state = plotState(data.plots[payload.plot], api.now);
    if (state === null || state.empty || state.ripe || state.withered) return { ok: false, reason: "unavailable" };
    data.fert[fert.key] -= 1;
    data.plots[payload.plot].boostMs += fert.hours * HOUR_MS;
    return { ok: true };
  }),
  harvest: plotAction((data, payload, api) => {
    const result = harvestPlot(data, payload.plot, api.now);
    if (result === null) return { ok: false, reason: "not-ripe" };
    tire(api);
    api.say(sayHarvest(result));
    return { ok: true, n: result.n };
  }),
  /** 铲地：枯苗随便铲；正在长的作物要 force（界面先问一句）。 */
  clear: plotAction((data, payload, api) => {
    if (!clearPlot(data, payload.plot, payload.force === true)) return { ok: false, reason: "unavailable" };
    tire(api);
    return { ok: true };
  }),
  /** 一键收获（要收割镰）。 */
  harvestAll(data, payload, api) {
    if (!owns(data, "sickle")) return { ok: false, reason: "locked" };
    let harvested = 0, crops = 0, level = null;
    for (let index = 0; index < data.unlocked; index += 1) {
      const result = harvestPlot(data, index, api.now);
      if (result !== null) {
        harvested += 1;
        crops += result.n;
        level = result.level ?? level;
      }
    }
    if (harvested === 0) return { ok: false, reason: "not-ripe" };
    tire(api, harvested);
    api.say("一口气收获 " + harvested + " 块地，" + crops + " 个果实进了仓库！" + (level ? "菜园升到 " + level + " 级了！" : ""));
    return { ok: true, harvested };
  },
  /** 一键照料（要喷雾桶）：所有地的草、虫、旱一次治完。 */
  careAll(data, payload, api) {
    return batchAction(data, api, { tool: "sprayer", key: "cured", visit: (index) => carePlot(data, index, api.now), exp: CARE_EXP });
  },
  /** 一键铲除（要平地耙）：只铲枯苗，不碰正在长的。 */
  clearAll(data, payload, api) {
    return batchAction(data, api, { tool: "rake", key: "cleared", visit: (index) => Number(clearPlot(data, index)) });
  },
  /** 一键播种（要播种器）：同一种种子种满所有空地，种子不够就种到用完。 */
  plantAll(data, payload, api) {
    if (!owns(data, "planter")) return { ok: false, reason: "locked" };
    const crop = cropFor(payload?.item);
    if (crop === null || levelNow(data) < crop.level) return { ok: false, reason: crop === null ? "unavailable" : "level" };
    return batchAction(data, api, { tool: "planter", key: "planted", visit: (index) => Number(plantPlot(data, index, crop, api.now)), reason: amountFor(data, "seeds", crop.key) < 1 ? "no-seed" : "unavailable" });
  },
  /** 卖：item 是作物；item '*' 是全卖。 */
  sell(data, payload, api) {
    if (payload?.item === "*") {
      let total = 0;
      for (const crop2 of CROPS) {
        total += amountFor(data, "harvest", crop2.key) * crop2.sell;
        data.harvest[crop2.key] = 0;
      }
      if (total === 0) return { ok: false, reason: "unavailable" };
      purse(api).earn(total, "sell");
      return { ok: true, earned: total };
    }
    const n = payload?.count === void 0 ? 1 : payload.count;
    const crop = cropFor(payload?.item);
    if (crop === null || !validCount(n) || !Number.isSafeInteger(crop.sell * n) || amountFor(data, "harvest", crop.key) < n) return { ok: false, reason: "unavailable" };
    data.harvest[crop.key] -= n;
    purse(api).earn(crop.sell * n, "sell");
    return { ok: true, earned: crop.sell * n };
  },
  store(data, payload, api) {
    const crop = cropFor(payload?.item);
    const n = payload?.count === void 0 ? 1 : payload.count;
    if (crop === null || !crop.food || !validCount(n) || n > 99 || amountFor(data, "harvest", crop.key) < n) return { ok: false, reason: "unavailable" };
    if (!api.give(crop.food, n)) return { ok: false, reason: "unavailable" };
    data.harvest[crop.key] -= n;
    return { ok: true };
  }
};
actions.hire = (data, payload, api) => helperBuy(data, { item: "helper-hire" }, api);
actions.upgrade = (data, payload, api) => helperBuy(data, { item: "helper-" + payload?.kind }, api);
actions.collect = (data) => collectHelper(data);

// src/extensions/farm/merge.js
var FARM_DATA_VERSION = 5;
var KNOWN = /* @__PURE__ */ new Set([
  "version",
  "unlocked",
  "plots",
  "seeds",
  "harvest",
  "acquired",
  "harvests",
  "tools",
  "fert",
  "exp",
  "refund",
  "helperBarnRefund",
  "helperBarnRefunded",
  "helper",
  "onboarding"
]);
var SAFE = Number.MAX_SAFE_INTEGER;
var safeKey = (key) => key !== "__proto__" && key !== "constructor" && key !== "prototype";
var amount = (value) => {
  const n = Math.floor(Number(value));
  return Number.isSafeInteger(n) && n > 0 ? Math.min(SAFE, n) : 0;
};
function sumCounts(...maps) {
  const out = {};
  for (const map of maps) {
    if (!isObject(map)) continue;
    for (const [key, value] of Object.entries(map)) {
      const n = amount(value);
      if (n > 0 && safeKey(key)) out[key] = Math.min(SAFE, (out[key] ?? 0) + n);
    }
  }
  return out;
}
function prepare(data, side) {
  if (!isObject(data)) throw new Error("菜园数据（" + side + "）不是对象，无法合并");
  const version = Math.floor(Number(data.version));
  if (Number.isSafeInteger(version) && version > FARM_DATA_VERSION) {
    throw new Error("菜园数据（" + side + "）版本 " + version + " 比当前扩展新，请先更新菜园再合并");
  }
  return normalize(structuredClone(data));
}
function plotRank(plot, now) {
  if (!isObject(plot)) return [-1, 0];
  const state = plotState(plot, now);
  if (state === null) return [-1, 0];
  if (state.withered === true) return [0, 0];
  if (state.empty === true) return [1, 0];
  return state.ripe === true ? [3, 1] : [2, Math.max(0, Math.min(0.999999, state.progress))];
}
function cleanPlot(plot) {
  if (!isObject(plot)) return null;
  if (plot.fallow === true) return { fallow: true, stubble: plot.stubble === true, pests: { dry: plot.pests?.dry === 0 ? 0 : null, weed: plot.pests?.weed === 0 ? 0 : null } };
  if (plot.withered === true) return { crop: plot.crop, withered: true };
  const crop = cropFor(plot.crop);
  if (crop === null) return null;
  const pest = (kind) => Number.isFinite(plot.pests?.[kind]) ? plot.pests[kind] : null;
  return {
    crop: crop.key,
    season: Math.max(1, Math.min(crop.seasons, Math.floor(Number(plot.season)) || 1)),
    plantedAt: plot.plantedAt,
    boostMs: Number.isFinite(plot.boostMs) ? Math.max(0, plot.boostMs) : 0,
    roll: Number.isFinite(plot.roll) ? Math.max(-3, Math.min(2, Math.floor(plot.roll))) : 0,
    pests: { weed: pest("weed"), bug: pest("bug"), dry: pest("dry") }
  };
}
function pickPlot(target, source, now) {
  const t = cleanPlot(target), s = cleanPlot(source);
  if (t === null) return s;
  if (s === null) return t;
  const [tRank, tProgress] = plotRank(t, now);
  const [sRank, sProgress] = plotRank(s, now);
  if (sRank > tRank || sRank === tRank && sProgress > tProgress) return s;
  return t;
}
function pickHelperContext(target, source) {
  const tWork = [target.usedMs, target.lastAt ?? 0];
  const sWork = [source.usedMs, source.lastAt ?? 0];
  if (sWork[0] > tWork[0] || sWork[0] === tWork[0] && sWork[1] > tWork[1]) return source;
  return target;
}
function mergeHelper(out, t, s, warnings) {
  const hired = t.hired === true || s.hired === true;
  const level = Math.max(t.level, s.level);
  const context = pickHelperContext(t, s);
  const loser = context === t ? s : t;
  const managed = hired ? Math.min(out.unlocked, HELPER_PLOTS[level]) : 0;
  const stock = sumCounts(t.stock, s.stock);
  let pending = hired ? context.pending : null;
  if (loser.pending !== null && (pending === null || loser.pending.index !== pending.index || loser.pending.plantedAt !== pending.plantedAt)) {
    warnings.push("菜园：帮工没收完的那一批只保留干得更多那一边的进度");
  }
  if (pending !== null) {
    const plot = Array.isArray(out.plots) ? out.plots[pending.index] : null;
    const recipe = helperRecipe(pending.crop, level);
    const same = pending.index >= 0 && pending.index < managed && isObject(plot) && plot.fallow !== true && plot.withered !== true && plot.crop === pending.crop && plot.plantedAt === pending.plantedAt;
    if (!same || recipe === null) {
      pending = null;
      warnings.push("菜园：帮工那批没收完的作物随旧地块一起结束了，收成没有记进仓库");
    } else pending = { index: pending.index, crop: pending.crop, plantedAt: pending.plantedAt, remainingMs: Math.max(0, Math.min(recipe.intervalMs, pending.remainingMs)), yield: recipe.yield };
  }
  out.helper = {
    hired,
    level,
    barn: Math.max(t.barn, s.barn),
    lastAt: hired && Number.isFinite(context.lastAt) ? context.lastAt : null,
    usedMs: hired ? Math.max(0, Math.min(HELPER_WINDOW, context.usedMs)) : 0,
    cursor: context.cursor,
    pending,
    targets: Array.from({ length: PLOTS }, (_, index) => context.targets[index] ?? null),
    stock
  };
}
function mergeLesson(out, t, s, warnings) {
  const done = t.step === "done" ? t : s.step === "done" ? s : null;
  if (done !== null) {
    const other = done === t ? s : t;
    if (other.step !== "done") warnings.push("菜园：另一边的第一课还没做完，合并后按已完成处理，只保留一份 12 菜币奖励");
    out.onboarding = {
      step: "done",
      rewarded: true,
      legacy: t.legacy === true || s.legacy === true,
      plantedAt: Number.isFinite(done.plantedAt) ? done.plantedAt : null,
      wateredAt: Number.isFinite(done.wateredAt) ? done.wateredAt : null
    };
    return;
  }
  const ready = (lesson) => lesson.plantedAt === null ? Infinity : lessonAt(lesson);
  const advanced = s.step === "planted" && (t.step !== "planted" || ready(s) < ready(t));
  const pick = advanced ? s : t;
  out.onboarding = pick.step === "planted" ? { step: "planted", rewarded: false, legacy: false, plantedAt: pick.plantedAt, wateredAt: Number.isFinite(pick.wateredAt) ? pick.wateredAt : null } : { step: "offer", rewarded: false, legacy: false, plantedAt: null, wateredAt: null };
}
function mergeStates(targetData, sourceData, now = Date.now()) {
  const t = prepare(targetData, "桌宠");
  const s = prepare(sourceData, "内嵌猪");
  const warnings = [];
  const out = {
    version: FARM_DATA_VERSION,
    unlocked: Math.max(START_PLOTS, Math.min(PLOTS, Math.max(t.unlocked, s.unlocked))),
    plots: [],
    seeds: sumCounts(t.seeds, s.seeds),
    harvest: sumCounts(t.harvest, s.harvest),
    acquired: sumCounts(t.acquired, s.acquired),
    harvests: sumCounts(t.harvests, s.harvests),
    tools: {},
    fert: sumCounts(t.fert, s.fert),
    exp: Math.min(EXP_CAP, Math.max(t.exp, s.exp)),
    refund: Math.min(SAFE, t.refund + s.refund),
    helperBarnRefund: Math.max(amount(t.helperBarnRefund), amount(s.helperBarnRefund)),
    helperBarnRefunded: t.helperBarnRefunded === true || s.helperBarnRefunded === true
  };
  for (let index = 0; index < PLOTS; index += 1) {
    out.plots.push(index < out.unlocked ? pickPlot(t.plots[index], s.plots[index], now) : null);
  }
  for (const map of [t.tools, s.tools]) for (const [key, value] of Object.entries(map)) if (value === true && safeKey(key)) out.tools[key] = true;
  mergeHelper(out, t.helper, s.helper, warnings);
  mergeLesson(out, t.onboarding, s.onboarding, warnings);
  for (const [key, value] of Object.entries(t)) if (!KNOWN.has(key) && safeKey(key)) out[key] = value;
  const unknown = Object.keys(s).filter((key) => !KNOWN.has(key));
  if (unknown.length > 0) warnings.push("菜园：内嵌猪有当前版本不认识的字段（" + unknown.slice(0, 6).join("、") + "），没有合并");
  normalize(out);
  out.unlocked = Math.max(START_PLOTS, Math.min(PLOTS, out.unlocked));
  for (let index = out.unlocked; index < PLOTS; index += 1) out.plots[index] = null;
  return { data: out, warnings, conflicts: [] };
}

// src/extensions/farm/view.js
function view(data, api) {
  const d = normalize(structuredClone(data));
  settleHelper(d, api.now);
  const wallet = purse(api), balance = wallet.balance() + d.refund;
  const level = levelOf(d.exp);
  const managed = helperPlots(d);
  const plots = d.plots.map((plot, index) => {
    if (index >= d.unlocked) return { index, wild: true, next: index === d.unlocked };
    const state = plotState(plot, api.now);
    if (state === null || state.empty) return { index, empty: true, stubble: state?.stubble || false, pests: state?.pests || [], helper: index < managed };
    const crop = cropFor(state.crop);
    return { index, ...state, label: crop.label, emoji: crop.emoji, helper: index < managed, ...helperPlotView(d, index, state) };
  });
  const tally = (test) => plots.filter(test).length;
  const counts = { ripe: tally((plot) => plot.ripe), pests: tally((plot) => plot.pests?.length > 0), withered: tally((plot) => plot.withered), empty: tally((plot) => plot.empty) };
  const hoursText = (hours) => (Number.isInteger(hours) ? hours : hours.toFixed(1)) + " 小时";
  const seeds = CROPS.map((crop) => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, "seeds", crop.key), price: crop.price, hours: crop.hours, level: crop.level, locked: level.level < crop.level, seasons: crop.seasons, yield: crop.yield, sell: crop.sell, exp: crop.exp }));
  const tools = TOOLS.map((tool) => ({ key: tool.key, label: tool.label, note: tool.note, price: tool.price, owned: owns(d, tool.key) }));
  const cropItems = seeds.map((crop) => ({ key: crop.key, emoji: crop.emoji, label: crop.label + "种子", note: crop.locked ? crop.level + " 级解锁" : hoursText(crop.hours) + "成熟 · 收约 " + crop.yield + " 个 · 卖 " + crop.sell + (crop.seasons > 1 ? " · " + crop.seasons + " 季" : ""), price: crop.price, disabled: crop.locked || balance < crop.price, pick: null }));
  const o = d.onboarding, readyAt = lessonAt(o), lessonReady = o.step === "planted" && readyAt !== null && api.now >= readyAt, lessonMs = o.wateredAt === null ? LESSON.ripeMs : LESSON.wateredMs;
  return {
    onboarding: {
      step: o.step,
      legacy: o.legacy,
      rewarded: o.rewarded,
      watered: o.wateredAt !== null,
      plantedAt: o.plantedAt,
      wateredAt: o.wateredAt,
      readyAt,
      ready: lessonReady,
      progress: o.step === "done" ? 1 : readyAt === null ? 0 : lessonReady ? 1 : Math.max(0, Math.min(1, (api.now - o.plantedAt) / lessonMs)),
      remainingMs: o.step === "done" || lessonReady || readyAt === null ? 0 : Math.min(lessonMs, Math.max(0, readyAt - api.now)),
      seed: { key: LESSON.seed, emoji: "🌱", label: cropFor(LESSON.seed).label + "种子", count: o.step === "done" ? 0 : 1, lessonOnly: true },
      reward: { currency: LESSON.reward, seed: LESSON.seed, exp: 0 },
      canStart: o.step === "offer",
      canPlant: o.step === "offer",
      canWater: o.step === "planted" && o.wateredAt === null,
      canHarvest: lessonReady
    },
    now: api.now,
    balance,
    currency: wallet.currency,
    level: level.level,
    exp: level.exp,
    need: level.need,
    weather: weatherAt(api.now),
    unlocked: d.unlocked,
    total: PLOTS,
    reclaimPrice: RECLAIM_PRICE,
    plots,
    counts,
    tools,
    fert: FERTILIZERS.map((fert) => ({ key: fert.key, label: fert.label, hours: fert.hours, price: fert.price, count: amountFor(d, "fert", fert.key) })),
    seeds,
    harvest: CROPS.map((crop) => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, "harvest", crop.key), sell: crop.sell, food: crop.food ?? null, foodLabel: crop.foodLabel ?? null })),
    helper: helperView(d),
    shelf: {
      key: "farm",
      label: "菜园商店",
      emoji: "🌱",
      color: "green",
      currency: { label: wallet.currency.label, emoji: wallet.currency.emoji, balance },
      items: [
        ...helperShelf(d, balance),
        ...cropItems,
        ...FERTILIZERS.map((fert) => ({ key: fert.key, emoji: "🧪", label: fert.label, note: "多长 " + hoursText(fert.hours), price: fert.price, disabled: balance < fert.price, pick: null })),
        ...tools.map((tool) => ({ key: tool.key, emoji: "🧰", label: tool.label, note: tool.owned ? "已拥有" : tool.note, price: tool.price, disabled: tool.owned || balance < tool.price, pick: null }))
      ]
    },
    dex: {
      key: "crops",
      label: "作物",
      emoji: "🌾",
      color: "green",
      entries: CROPS.map((crop) => ({ key: crop.key, emoji: crop.emoji, label: crop.label, stars: 0, blurb: "收获过 " + amountFor(d, "acquired", crop.key) + " 个", potential: amountFor(d, "acquired", crop.key), acquired: amountFor(d, "acquired", crop.key) > 0 }))
    }
  };
}

// src/extensions/farm/server.js
function progress(data) {
  const saved = normalize(structuredClone(data));
  const crops = CROPS.filter((crop) => amountFor(saved, "harvests", crop.key) > 0);
  return [{ name: "harvest", total: crops.reduce((sum, crop) => Math.min(Number.MAX_SAFE_INTEGER, sum + amountFor(saved, "harvests", crop.key)), 0), items: crops.map((crop) => crop.key) }];
}
var game = {
  eventVersion: 1,
  progress,
  init() {
    return normalize({ version: 4, plots: Array.from({ length: START_PLOTS }, () => newGround()) });
  },
  actions,
  view,
  // #14 外部桌宠合并：宿主只在目标端已安装且 manifest mergeHook >= 1 时调用。
  mergeStates
};
for (const [key, action] of Object.entries(game.actions)) {
  game.actions[key] = (data, payload, api) => {
    normalize(data);
    payRefund(data, api);
    settleHelper(data, api?.now);
    const result = action(data, payload, api);
    if (result.ok) {
      settleHelper(data, api?.now);
      if (typeof api?.emit === "function") for (const { name, ...payload2 } of progress(data)) api.emit(name, payload2);
    }
    return result;
  };
}
var server_default = game;
export {
  CARE_EXP,
  CROPS,
  EXERT,
  EXP_CAP,
  EXP_PER_LEVEL,
  FERTILIZERS,
  HELPER_PLOTS,
  HELPER_PRICES,
  HELPER_SHARE,
  HELPER_WINDOW,
  LESSON,
  OLD_HELPER_BARN_PRICES,
  PESTS,
  PEST_LOSS,
  PEST_MS,
  PLOTS,
  RECLAIM_PRICE,
  STAGES,
  START_PLOTS,
  TOOLS,
  cropFor,
  server_default as default,
  helperRecipe,
  levelOf,
  normalize,
  plotState,
  progress,
  setRandom,
  settleHelper,
  weatherAt
};
