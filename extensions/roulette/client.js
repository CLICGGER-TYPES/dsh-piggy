// GENERATED FILE. Edit src/extensions/roulette/client/ and run `node scripts/build-roulette-client.mjs`; do not edit by hand.
(() => {
  // src/extensions/roulette/client/ai.js
  var AI_DELAYS = [900, 1200, 1800, 2500];
  function createAiRunner(deps) {
    const { ui, later, send, rerender } = deps;
    function schedule(key, attempt) {
      const index = Math.min(attempt ?? 0, AI_DELAYS.length - 1);
      later(function() {
        if (ui.aiKey !== key) return;
        const result = send("ai");
        function failed() {
          if (ui.aiKey !== key) return;
          if ((attempt ?? 0) < AI_DELAYS.length - 1) {
            schedule(key, (attempt ?? 0) + 1);
            return;
          }
          ui.aiError = true;
          rerender();
        }
        if (result && typeof result.then === "function") {
          result.then(function(next) {
            if (!next || next.ok === false) failed();
            else rerender();
          }, failed);
        } else {
          rerender();
        }
      }, AI_DELAYS[index]);
    }
    return { schedule };
  }

  // src/extensions/roulette/client/arm.js
  function createArm(deps) {
    const { ui, chambers, cancel, later, send, rerender, toast } = deps;
    function reset() {
      if (ui.armTimer !== null) {
        cancel(ui.armTimer);
        ui.armTimer = null;
      }
      ui.arming = false;
      ui.spinning = false;
      ui.primerPop = false;
      ui.primer = -1;
      ui.armPending = false;
      ui.armUncertain = false;
      ui.armToken += 1;
    }
    function load(index) {
      if (ui.arming || ui.armPending) return;
      const hole = Number.isInteger(index) ? index : Math.floor(Math.random() * chambers);
      const token = ++ui.armToken;
      ui.arming = true;
      ui.spinning = true;
      ui.primer = Math.max(0, Math.min(chambers - 1, hole));
      ui.primerPop = true;
      rerender();
      ui.armTimer = later(function() {
        ui.armTimer = null;
        if (ui.armToken !== token) return;
        ui.armPending = true;
        const result = send("arm");
        ui.arming = false;
        ui.spinning = false;
        ui.primerPop = false;
        ui.primer = -1;
        rerender();
        later(function() {
          if (ui.armToken !== token || !ui.armPending) return;
          ui.armPending = false;
          ui.armUncertain = true;
          toast("\u88C5\u5F39\u8BF7\u6C42\u8FD8\u6CA1\u56DE\u6765\uFF0C\u8FD4\u56DE\u4F1A\u6309\u5DF2\u88C5\u5F39\u5904\u7406");
          rerender();
        }, 8e3);
        if (result && typeof result.then === "function") {
          result.then(function(next) {
            if (ui.armToken !== token || !ui.armPending) return;
            if (next && next.ok === false) {
              ui.armPending = false;
              ui.armUncertain = false;
              toast("\u88C5\u5F39\u6CA1\u9001\u5230\uFF0C\u70B9\u5F39\u5B54\u91CD\u8BD5");
              rerender();
            }
          }, function() {
          });
        }
      }, 700);
    }
    return { reset, load };
  }

  // src/extensions/roulette/client/ui-actions.js
  function createUiActions({ ui, rerender }) {
    return {
      cancelLeave() {
        ui.leaveConfirm = false;
        rerender();
      },
      retryAi() {
        ui.aiKey = "";
        ui.aiError = false;
        rerender();
      }
    };
  }

  // src/extensions/roulette/client/game.js
  var CHAMBERS = 6;
  var CHAMBER_X = [0, 39, 39, 0, -38, -38];
  var CHAMBER_Y = [-38, -18, 20, 40, 20, -18];
  var LOAD_MIN = 1;
  var LOAD_MAX = 5;
  var LIVES_OPTIONS = [1, 3];
  var STAKE_LEVELS = [100, 500, 1e3, 5e3];
  var STAKE_MIN = 100;
  var STAKE_MAX = 1e4;
  var AI_STRATEGIES = [
    { key: "always", label: "\u83BD\u592B" },
    { key: "expected", label: "\u671F\u671B\u503C" },
    { key: "bluff", label: "\u968F\u673A\u8BC8\u552C" },
    { key: "bayes", label: "\u8D1D\u53F6\u65AF" },
    { key: "monteCarlo", label: "\u8499\u7279\u5361\u6D1B" }
  ];
  var PASS_RATE = 0.5;
  var EMPTY = {
    coins: 0,
    vault: 0,
    settings: { lives: 1, format: "single", loadCount: 1, stake: 1e3, ai: "always" },
    seq: 0,
    passRate: PASS_RATE,
    match: null
  };
  function money(value) {
    return Math.round(Number(value) || 0).toLocaleString("en-US");
  }
  function createGame(options = {}) {
    const getApp = options.getApp ?? (() => options.app);
    const rerender = options.rerender ?? function() {
    };
    const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel ?? ((id) => clearTimeout(id));
    const timers = [];
    let toastTimer = null;
    const ui = {
      page: "lobby",
      rulesFrom: "lobby",
      toast: "",
      arming: false,
      spinning: false,
      primer: -1,
      primerPop: false,
      flash: "",
      lastSeq: -1,
      aiKey: "",
      aiError: false,
      nextLoad: null,
      leaveConfirm: false,
      armTimer: null,
      armPending: false,
      armUncertain: false,
      armToken: 0
    };
    function later(fn, ms) {
      const id = schedule(function() {
        const at = timers.indexOf(id);
        if (at >= 0) timers.splice(at, 1);
        fn();
      }, ms);
      timers.push(id);
      return id;
    }
    function stopTimers() {
      while (timers.length > 0) cancel(timers.pop());
      if (toastTimer !== null) {
        cancel(toastTimer);
        toastTimer = null;
      }
    }
    const uiActions = createUiActions({ ui, rerender });
    const ai = createAiRunner({ ui, later, send, rerender });
    const arm = createArm({ ui, chambers: CHAMBERS, cancel, later, send, rerender, toast });
    function data() {
      const app2 = getApp();
      const value = app2 && app2.data;
      if (!value || typeof value !== "object" || value.settings === void 0) return EMPTY;
      return value;
    }
    function app() {
      return getApp();
    }
    function seq() {
      const value = data().seq;
      return Number.isInteger(value) ? value : 0;
    }
    function send(op, payload) {
      const current = app();
      if (!current || typeof current.send !== "function") {
        toast("\u5BBF\u4E3B\u6CA1\u6709\u8FDE\u63A5\uFF0C\u6682\u65F6\u4E0D\u80FD\u884C\u52A8");
        return null;
      }
      return current.send(op, Object.assign({}, payload ?? {}, { seq: seq() }));
    }
    function toast(text) {
      ui.toast = text;
      if (toastTimer !== null) cancel(toastTimer);
      toastTimer = schedule(function() {
        toastTimer = null;
        ui.toast = "";
        rerender();
      }, 1900);
    }
    function notify(text) {
      toast(text);
      rerender();
    }
    function clearFlash(ms) {
      later(function() {
        ui.flash = "";
        rerender();
      }, ms);
    }
    function sync() {
      const value = data();
      if (!Number.isInteger(value.seq)) return;
      if (ui.lastSeq !== value.seq) {
        ui.lastSeq = value.seq;
        ui.leaveConfirm = false;
        ui.nextLoad = null;
        if (ui.armTimer !== null) {
          cancel(ui.armTimer);
          ui.armTimer = null;
        }
        ui.arming = false;
        ui.spinning = false;
        ui.primer = -1;
        ui.primerPop = false;
        ui.armPending = false;
        ui.armUncertain = false;
        const match2 = value.match;
        if (match2 !== null) {
          if (match2.lastEvent === "hit" && match2.lastShooter === "you") {
            ui.flash = "live";
            clearFlash(450);
          } else if (match2.lastEvent === "blank" && match2.lastShooter === "you") {
            ui.flash = "blank";
            clearFlash(450);
          }
          if (match2.lastEvent === "armed" || match2.lastEvent === "reload") {
            ui.spinning = false;
            ui.arming = false;
          }
        }
      }
      const match = value.match;
      if (match !== null && match.stage === "ai") {
        const key = value.seq + ":" + match.handId + ":" + match.round + ":" + match.chamber + ":" + match.turn + ":" + match.bulletsLeft;
        if (ui.aiKey !== key) {
          ui.aiKey = key;
          ui.aiError = false;
          ai.schedule(key, 0);
        }
      }
    }
    function enterTable() {
      ui.page = "table";
      rerender();
    }
    function showPage(next2) {
      ui.page = next2;
      ui.flash = "";
      rerender();
    }
    function leaveTable() {
      const match = data().match;
      send("leave", { handId: match === null ? void 0 : match.handId });
      stopTimers();
      arm.reset();
      ui.page = "lobby";
      ui.flash = "";
      ui.aiKey = "";
      ui.aiError = false;
      ui.nextLoad = null;
      ui.leaveConfirm = false;
      toast("\u5DF2\u56DE\u5230\u5927\u5385");
      rerender();
    }
    function requestLeave() {
      const match = data().match;
      if (match === null || match.stage === "matchOver") {
        leaveTable();
        return;
      }
      if (ui.armPending) {
        notify("\u88C5\u5F39\u8BF7\u6C42\u63D0\u4EA4\u4E2D\uFF0C\u7A0D\u7B49\u4E00\u4E0B");
        return;
      }
      if (ui.arming && ui.armTimer !== null) {
        cancel(ui.armTimer);
        ui.armTimer = null;
        ui.arming = false;
        ui.spinning = false;
        ui.primer = -1;
        ui.primerPop = false;
        leaveTable();
        return;
      }
      if (match.stage === "arming" && match.round === 1 && !ui.armUncertain) {
        leaveTable();
        return;
      }
      ui.leaveConfirm = true;
      rerender();
    }
    function start() {
      const value = data();
      if (value.match !== null && value.match.stage !== "matchOver") {
        ui.page = "table";
        ui.leaveConfirm = false;
        ui.nextLoad = null;
        arm.reset();
        rerender();
        return;
      }
      if (value.coins < value.settings.stake) {
        notify("\u91D1\u5E01\u4E0D\u591F\u672C\u5C40\u5E95\u6CE8");
        return;
      }
      send("start");
      ui.page = "table";
      ui.aiKey = "";
      ui.aiError = false;
      ui.leaveConfirm = false;
      ui.nextLoad = null;
      arm.reset();
      rerender();
    }
    function next() {
      const value = data();
      if (value.coins < value.settings.stake) {
        notify("\u91D1\u5E01\u4E0D\u591F\u4E0B\u4E00\u5C40\u5E95\u6CE8");
        return;
      }
      const loadCount = ui.nextLoad ?? value.settings.loadCount;
      send("next", { loadCount });
      ui.aiKey = "";
      ui.aiError = false;
      arm.reset();
      rerender();
    }
    function setNextLoad(value) {
      const count = Math.floor(Number(value));
      if (!Number.isInteger(count) || count < LOAD_MIN || count > LOAD_MAX) {
        notify("\u88C5\u5F39\u6570 " + LOAD_MIN + "\u2013" + LOAD_MAX + " \u53D1");
        return false;
      }
      ui.nextLoad = count;
      rerender();
      return true;
    }
    function config(patch) {
      send("config", patch);
      rerender();
    }
    function setStake(value) {
      const amount = Math.floor(Number(value));
      if (!Number.isInteger(amount) || amount < STAKE_MIN || amount > STAKE_MAX) {
        notify("\u5E95\u6CE8\u8303\u56F4 " + money(STAKE_MIN) + "\u2013" + money(STAKE_MAX));
        return false;
      }
      config({ stake: amount });
      return true;
    }
    function load(index) {
      const match = data().match;
      if (match === null || match.stage !== "arming") return;
      arm.load(index);
    }
    function randomLoad() {
      arm.load(Math.floor(Math.random() * CHAMBERS));
    }
    function fire() {
      const match = data().match;
      if (match === null || match.stage !== "choice" || match.turn !== "you") return;
      send("fire");
      rerender();
    }
    function pass() {
      const value = data();
      const match = value.match;
      if (match === null || match.stage !== "choice" || match.turn !== "you") return;
      if (match.mustShoot === "you") {
        notify("\u56DE\u8BA9\u540E\u5FC5\u987B\u5F00\u67AA");
        return;
      }
      const fee = Math.max(1, Math.ceil(value.settings.stake * (value.passRate || PASS_RATE)));
      if (value.coins < fee) {
        notify("\u91D1\u5E01\u4E0D\u591F\u8BA9\u67AA\u8D39 " + money(fee));
        return;
      }
      send("pass");
      rerender();
    }
    function openRules(from) {
      ui.rulesFrom = from || ui.page;
      ui.page = "rules";
      rerender();
    }
    function closeRules() {
      ui.page = ui.rulesFrom === "rules" ? "lobby" : ui.rulesFrom;
      ui.rulesFrom = "lobby";
      rerender();
    }
    return {
      ui,
      data,
      sync,
      enterTable,
      showPage,
      leaveTable,
      requestLeave,
      ...uiActions,
      start,
      next,
      setNextLoad,
      config,
      setStake,
      load,
      randomLoad,
      fire,
      pass,
      openRules,
      closeRules,
      notify,
      toast,
      stopTimers,
      seq
    };
  }

  // src/extensions/roulette/online.js
  var ONLINE_CHAMBERS = 6;
  var ONLINE_LOAD_MIN = 1;
  var ONLINE_LOAD_MAX = 5;
  var ONLINE_LIVES = [1, 3];
  var ONLINE_FORMATS = ["single", "bestOf3"];
  var ONLINE_STAKE_MIN = 100;
  var ONLINE_STAKE_MAX = 1e4;
  var ONLINE_PASS_RATE = 0.5;
  function shuffle(n, random) {
    const out = Array.from({ length: n }, (_, index) => index);
    for (let index = out.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(random() * (index + 1));
      const swap = out[index];
      out[index] = out[pick];
      out[pick] = swap;
    }
    return out;
  }
  function randomInt(n, random) {
    return Math.floor(random() * n);
  }
  function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }
  function otherSeat(seat) {
    return seat === "host" ? "guest" : "host";
  }
  function passFee(stake) {
    return Math.max(1, Math.ceil(stake * ONLINE_PASS_RATE));
  }
  function createMatch(input, random = Math.random) {
    if (typeof input?.matchId !== "string" || input.matchId === "") throw new Error("matchId required");
    if (typeof input.hostId !== "string" || typeof input.guestId !== "string" || input.hostId === input.guestId) {
      throw new Error("two distinct seats required");
    }
    const state = {
      matchId: input.matchId,
      hostId: input.hostId,
      guestId: input.guestId,
      settings: {
        lives: ONLINE_LIVES.includes(input.lives) ? input.lives : 1,
        format: ONLINE_FORMATS.includes(input.format) ? input.format : "single",
        stake: clampInt(input.stake, ONLINE_STAKE_MIN, ONLINE_STAKE_MAX, 1e3),
        loadCount: clampInt(input.loadCount, ONLINE_LOAD_MIN, ONLINE_LOAD_MAX, 1)
      },
      seats: {
        host: { lives: 0, wins: 0, paid: 0, fees: 0 },
        guest: { lives: 0, wins: 0, paid: 0, fees: 0 }
      },
      pot: 0,
      round: 0,
      stage: "arming",
      turn: "host",
      loader: "host",
      bulletCount: 1,
      bullets: [],
      chamber: 0,
      fired: 0,
      passBy: "",
      mustShoot: "",
      outcome: "",
      winner: "",
      settled: false,
      lastEvent: "",
      lastShooter: "",
      rev: 0,
      lastSeq: { host: 0, guest: 0 }
    };
    startRound(state, random);
    return state;
  }
  function startRound(state, random) {
    const { stake, lives, loadCount } = state.settings;
    const seat = state.seats.host;
    const guest = state.seats.guest;
    seat.lives = lives;
    guest.lives = lives;
    seat.paid += stake;
    guest.paid += stake;
    state.pot += stake * 2;
    state.round += 1;
    state.bulletCount = loadCount;
    state.bullets = [];
    state.chamber = 0;
    state.fired = 0;
    state.stage = "arming";
    state.turn = "host";
    state.loader = "host";
    state.passBy = "";
    state.mustShoot = "";
    state.outcome = "";
    state.lastEvent = "bet";
    state.lastShooter = "";
    state.rev += 1;
    return { op: "round-start", round: state.round, stake, pot: state.pot };
  }
  function reload(state, random, first) {
    state.bullets = shuffle(ONLINE_CHAMBERS, random).slice(0, state.bulletCount);
    state.chamber = randomInt(ONLINE_CHAMBERS, random);
    state.fired = 0;
    state.turn = first;
    state.stage = "choice";
    state.passBy = "";
    state.mustShoot = "";
    state.lastEvent = "reload";
    state.lastShooter = "";
  }
  function finishRound(state, winner) {
    state.seats[winner].wins += 1;
    const over = state.settings.format === "single" || state.seats.host.wins >= 2 || state.seats.guest.wins >= 2;
    if (over) {
      state.stage = "matchOver";
      state.winner = winner;
      state.outcome = winner === "host" ? "host-win" : "guest-win";
      state.settled = true;
      state.lastEvent = "settled";
      return { op: "match-over", winner, pot: state.pot };
    }
    state.stage = "roundOver";
    state.outcome = winner === "host" ? "host-round" : "guest-round";
    state.lastEvent = "round-over";
    return { op: "round-over", winner, pot: state.pot };
  }
  function shoot(state, who, random) {
    state.passBy = "";
    state.mustShoot = "";
    const firedChamber = state.chamber;
    const hit = state.bullets.includes(state.chamber);
    state.lastShooter = who;
    state.fired = Math.min(ONLINE_CHAMBERS, state.fired + 1);
    if (hit) {
      state.bullets = state.bullets.filter((index) => index !== state.chamber);
      state.seats[who].lives -= 1;
      state.lastEvent = "hit";
      if (state.seats[who].lives <= 0) return finishRound(state, otherSeat(who));
      if (state.bulletCount === 1) {
        reload(state, random, otherSeat(who));
        return { op: "reload" };
      }
      if (state.bullets.length === 0) {
        reload(state, random, random() < 0.5 ? "host" : "guest");
        return { op: "reload" };
      }
      state.chamber = (state.chamber + 1) % ONLINE_CHAMBERS;
      state.turn = otherSeat(who);
      state.stage = "choice";
      return { op: "hit", who, chamber: firedChamber };
    }
    state.chamber = (state.chamber + 1) % ONLINE_CHAMBERS;
    state.lastEvent = "blank";
    state.turn = otherSeat(who);
    state.stage = "choice";
    return { op: "blank", who, chamber: firedChamber };
  }
  function doPass(state, who) {
    const fee = passFee(state.settings.stake);
    state.seats[who].fees += fee;
    state.pot += fee;
    const previous = state.passBy;
    if (previous !== "" && previous !== who) {
      state.passBy = "";
      state.mustShoot = previous;
      state.turn = previous;
    } else {
      state.passBy = who;
      state.mustShoot = "";
      state.turn = otherSeat(who);
    }
    state.stage = "choice";
    state.lastEvent = who === "host" ? "host-pass" : "guest-pass";
    state.lastShooter = who;
    return { op: "pass", who, fee };
  }
  function publicView(state) {
    return {
      matchId: state.matchId,
      hostId: state.hostId,
      guestId: state.guestId,
      rev: state.rev,
      settings: { ...state.settings },
      seats: {
        host: { lives: state.seats.host.lives, wins: state.seats.host.wins, paid: state.seats.host.paid, fees: state.seats.host.fees },
        guest: { lives: state.seats.guest.lives, wins: state.seats.guest.wins, paid: state.seats.guest.paid, fees: state.seats.guest.fees }
      },
      pot: state.pot,
      round: state.round,
      stage: state.stage,
      turn: state.turn,
      loader: state.loader,
      bulletCount: state.bulletCount,
      bulletsLeft: state.bullets.length,
      chamber: state.chamber,
      fired: state.fired,
      passBy: state.passBy,
      mustShoot: state.mustShoot,
      outcome: state.outcome,
      winner: state.winner,
      settled: state.settled,
      lastEvent: state.lastEvent,
      lastShooter: state.lastShooter
    };
  }
  function initialEvent(state) {
    return { op: "match-start", view: publicView(state) };
  }
  function seatOf(state, from) {
    if (from === "host" || from === "guest") return from;
    if (from === state.hostId) return "host";
    if (from === state.guestId) return "guest";
    return "";
  }
  function applyAction(state, input, random = Math.random) {
    const from = seatOf(state, input?.from);
    if (from === "") return { ok: false, reason: "bad-seat" };
    if (!Number.isSafeInteger(input.seq) || input.seq <= 0) return { ok: false, reason: "bad-seq" };
    if (input.seq <= state.lastSeq[from]) return { ok: true, duplicate: true, events: [] };
    const op = input.op;
    if (state.stage === "matchOver") return { ok: false, reason: "match-over" };
    if (state.stage === "roundOver" && op !== "next" && op !== "leave") return { ok: false, reason: "not-playing" };
    if (op === "arm") {
      if (from !== state.loader) return { ok: false, reason: "not-loader" };
      if (state.stage !== "arming") return { ok: false, reason: "not-arming" };
      state.bullets = shuffle(ONLINE_CHAMBERS, random).slice(0, state.bulletCount);
      state.chamber = randomInt(ONLINE_CHAMBERS, random);
      state.fired = 0;
      state.turn = random() < 0.5 ? "host" : "guest";
      state.stage = "choice";
      state.passBy = "";
      state.mustShoot = "";
      state.lastEvent = "armed";
      state.lastShooter = "";
      state.rev += 1;
    } else if (op === "fire") {
      if (state.stage !== "choice") return { ok: false, reason: "not-choice" };
      if (state.turn !== from) return { ok: false, reason: "not-your-turn" };
      const event = shoot(state, from, random);
      state.rev += 1;
      state.lastSeq[from] = input.seq;
      return { ok: true, events: [{ ...event, view: publicView(state) }] };
    } else if (op === "pass") {
      if (state.stage !== "choice") return { ok: false, reason: "not-choice" };
      if (state.turn !== from) return { ok: false, reason: "not-your-turn" };
      if (state.mustShoot === from) return { ok: false, reason: "must-shoot" };
      const event = doPass(state, from);
      state.rev += 1;
      state.lastSeq[from] = input.seq;
      return { ok: true, events: [{ ...event, view: publicView(state) }] };
    } else if (op === "next") {
      if (from !== "host") return { ok: false, reason: "not-host" };
      if (state.stage !== "roundOver") return { ok: false, reason: "not-round-over" };
      const event = startRound(state, random);
      state.lastSeq[from] = input.seq;
      return { ok: true, events: [{ ...event, view: publicView(state) }] };
    } else if (op === "leave") {
      state.lastSeq[from] = input.seq;
      if (state.round === 1 && state.stage === "arming" && !state.fired && input.data?.force !== true) {
        state.stage = "matchOver";
        state.outcome = "cancelled";
        state.settled = true;
        state.lastEvent = "cancelled";
        state.rev += 1;
        return { ok: true, events: [{ op: "cancelled", view: publicView(state) }] };
      }
      const winner = otherSeat(from);
      state.seats[winner].wins = Math.max(state.seats[winner].wins, state.settings.format === "bestOf3" ? 2 : 1);
      state.stage = "matchOver";
      state.winner = winner;
      state.outcome = "forfeit";
      state.settled = true;
      state.lastEvent = "forfeit";
      state.rev += 1;
      return { ok: true, events: [{ op: "forfeit", who: from, winner, view: publicView(state) }] };
    } else {
      return { ok: false, reason: "bad-op" };
    }
    state.lastSeq[from] = input.seq;
    return { ok: true, events: [{ op, view: publicView(state) }] };
  }

  // src/extensions/roulette/client/match-state.js
  function clearRoomUi(ui) {
    ui.room = null;
    ui.matchView = null;
    ui.matchId = "";
    ui.waiting = false;
    ui.settled = "";
    ui.net = null;
    ui.opponentGone = false;
  }

  // src/extensions/roulette/client/online-session.js
  var PING_MS = 5e3;
  var SILENCE_MS = 2e4;
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function numberIn(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }
  function createOnlineSession(deps) {
    const ui = deps.ui;
    const getApp = deps.getApp;
    const rerender = deps.rerender;
    const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    const cancel = deps.cancel ?? ((id) => clearTimeout(id));
    const now = deps.now ?? (() => Date.now());
    let rules = null;
    let bound = false;
    let boundBridge = null;
    let selfId = "";
    let mySeat = "";
    let seq = 0;
    const seen = {};
    const paid = {};
    let heartbeat = null;
    let flashTimer = null;
    let spinTimer = null;
    let lastOtherAt = 0;
    let baselineId = null;
    const app = () => getApp();
    function bridge() {
      const current = app();
      return current && isObject(current.room) ? current.room : null;
    }
    function authority() {
      return ui.room !== null && ui.room.hosting === true && ui.room.authority === "host";
    }
    const terminal = (view) => isObject(view) && view.stage === "matchOver";
    function active(view) {
      return isObject(view) && view.stage !== "matchOver";
    }
    function seatOf2(view) {
      if (view.hostId === selfId) return "host";
      return view.guestId === selfId ? "guest" : "";
    }
    function otherId() {
      const view = ui.matchView;
      if (view === null) return "";
      return view.hostId === selfId ? view.guestId : view.hostId;
    }
    function bind() {
      if (bound) return;
      const channel = bridge();
      if (channel === null) return;
      bound = true;
      boundBridge = channel;
      if (typeof channel.onUpdate === "function") channel.onUpdate(onRoom);
      if (typeof channel.onClosed === "function") channel.onClosed(onClosed);
      if (typeof channel.status === "function") {
        const result = channel.status();
        if (result && typeof result.then === "function") result.then(onRoom, function() {
        });
      }
    }
    function onClosed() {
      resetState();
      clearRoomUi(ui);
      ui.error = "\u8054\u673A\u623F\u95F4\u5DF2\u5173\u95ED";
      rerender();
    }
    function onRoom(snapshot) {
      if (!isObject(snapshot) || snapshot.ok !== true || snapshot.inRoom !== true) {
        ui.room = null;
        ui.roomError = "\u4E0D\u5728\u8054\u673A\u623F\u95F4\u91CC";
        rerender();
        return;
      }
      ui.room = snapshot;
      ui.roomError = "";
      ui.error = ui.error === "\u8054\u673A\u623F\u95F4\u5DF2\u5173\u95ED" ? "" : ui.error;
      selfId = typeof snapshot.selfId === "string" ? snapshot.selfId : "";
      const events = Array.isArray(snapshot.gameEvents) ? snapshot.gameEvents : [];
      if (baselineId === null) {
        let latest = 0;
        for (const event of events) {
          if (isObject(event) && Number.isSafeInteger(event.id) && event.id > latest) latest = event.id;
        }
        baselineId = latest;
        if (latest > seq) seq = latest;
      }
      for (const event of events) {
        handleEvent(event, typeof event.id === "number" && event.id <= baselineId);
      }
      if (ui.page === "table" && active(ui.matchView)) startHeartbeat();
      rerender();
    }
    function handleEvent(event, replay) {
      if (!isObject(event) || event.ext !== "roulette") return;
      if (typeof event.id === "number") {
        if (seen[event.id] === true) return;
        seen[event.id] = true;
      }
      if (event.from !== selfId && selfId !== "") lastOtherAt = now();
      const data = isObject(event.data) ? event.data : {};
      if (event.op === "create" || event.op === "action") {
        if (replay !== true && authority() && (event.op === "create" || rules !== null)) applyInput(event, data);
        return;
      }
      if (isObject(data.view)) applyView(data.view, event.op, data);
    }
    function applyInput(event, data) {
      if (event.op === "create") {
        if (event.from !== selfId || rules !== null) return;
        const matchId = typeof data.matchId === "string" ? data.matchId : "";
        const guestId = typeof data.guestId === "string" ? data.guestId : "";
        if (matchId === "" || guestId === "") return;
        const settings = isObject(data.settings) ? data.settings : {};
        rules = createMatch({
          matchId,
          hostId: selfId,
          guestId,
          lives: settings.lives,
          format: settings.format,
          stake: settings.stake,
          loadCount: settings.loadCount
        });
        mySeat = "host";
        ui.waiting = false;
        emit(initialEvent(rules));
        emit({ op: "round-start", round: rules.round, stake: rules.settings.stake, pot: rules.pot, view: publicView(rules) });
        rerender();
        return;
      }
      if (rules === null || typeof data.op !== "string") return;
      const result = applyAction(rules, { from: event.from, seq: event.id, op: data.op, data });
      if (!result.ok) return;
      for (const item of result.events ?? []) emit(item);
      rerender();
    }
    function emit(event) {
      applyView(event.view, event.op, event);
      const channel = boundBridge;
      if (channel === null || typeof channel.send !== "function") return;
      seq += 1;
      const result = channel.send(seq, event.op, event);
      if (result && typeof result.then === "function") {
        result.then(function(reply) {
          if (isObject(reply) && reply.ok === true && Number.isInteger(reply.eventId)) seen[reply.eventId] = true;
        }, function() {
        });
      }
    }
    function applyView(view, op, data) {
      if (!isObject(view) || seatOf2(view) === "") return;
      ui.matchView = view;
      ui.matchId = typeof view.matchId === "string" ? view.matchId : ui.matchId;
      if (seatOf2(view) !== "") mySeat = seatOf2(view);
      ui.waiting = false;
      if (op === "match-start") ui.opponentGone = false;
      if (op === "match-start" && isObject(view.settings)) ui.settings = Object.assign({}, view.settings);
      if (op === "round-start" || op === "match-start") payStake(view);
      if (op === "pass" && data.who === mySeat) payFee(view);
      if (op === "arm") spin();
      if (op === "hit" && data.who === mySeat) flash("live");
      if (op === "blank" && data.who === mySeat) flash("blank");
      if (op === "match-over" || op === "forfeit" || op === "cancelled") settle(view, op);
      if (terminal(view)) stopHeartbeat();
      else if (ui.page === "lobby") {
        ui.page = "table";
        startHeartbeat();
      }
    }
    function flash(kind) {
      if (flashTimer !== null) cancel(flashTimer);
      ui.flash = kind;
      flashTimer = schedule(function() {
        flashTimer = null;
        ui.flash = "";
        rerender();
      }, 450);
    }
    function spin() {
      ui.spinning = true;
      if (spinTimer !== null) cancel(spinTimer);
      spinTimer = schedule(function() {
        spinTimer = null;
        ui.spinning = false;
        rerender();
      }, 600);
    }
    function wallet(op, payload) {
      const current = app();
      if (!current || typeof current.send !== "function") return null;
      const result = current.send(op, payload);
      return result && typeof result.then === "function" ? result : null;
    }
    function payStake(view) {
      const key = view.matchId + ":stake:" + view.round;
      if (paid[key] === true) return;
      paid[key] = true;
      const stake = numberIn(view.settings?.stake, 1, 1e5, 0);
      const result = wallet("online-wallet", { kind: "stake", matchId: view.matchId, handId: view.round, amount: stake });
      if (result !== null) {
        result.then(function(reply) {
          if (!isObject(reply) || reply.ok !== true) {
            ui.error = "\u91D1\u5E01\u4E0D\u591F\u672C\u5C40\u5E95\u6CE8\uFF0C\u6309\u8BA4\u8F93\u5904\u7406";
            sendAction("leave");
          }
          rerender();
        }, function() {
        });
      }
    }
    function payFee(view) {
      const key = view.matchId + ":fee:" + view.rev;
      if (paid[key] === true) return;
      paid[key] = true;
      const fee = passFee(numberIn(view.settings?.stake, 1, 1e5, 100));
      const result = wallet("online-wallet", { kind: "fee", matchId: view.matchId, handId: view.round, id: view.rev, amount: fee });
      if (result !== null) result.then(function() {
        rerender();
      }, function() {
      });
    }
    function settle(view, op) {
      if (ui.settled === view.matchId) return;
      ui.settled = view.matchId;
      const mine = view.seats?.[mySeat] ?? { paid: 0, fees: 0 };
      if (op === "cancelled") {
        wallet("online-wallet", { kind: "refund", matchId: view.matchId });
        ui.net = 0;
        return;
      }
      const win = view.winner === mySeat;
      wallet("online-wallet", { kind: "settle", matchId: view.matchId, winner: win ? "you" : "them", pot: win ? view.pot : 0 });
      ui.net = (win ? view.pot : 0) - mine.paid - mine.fees;
    }
    function startHeartbeat() {
      if (heartbeat !== null) return;
      lastOtherAt = now();
      heartbeat = schedule(tick, PING_MS);
    }
    function stopHeartbeat() {
      if (heartbeat !== null) cancel(heartbeat);
      heartbeat = null;
    }
    function tick() {
      heartbeat = null;
      if (ui.page !== "table" || !active(ui.matchView)) return;
      const channel = bridge();
      if (channel !== null && typeof channel.send === "function") {
        seq += 1;
        channel.send(seq, "ping", {});
      }
      watch();
      heartbeat = schedule(tick, PING_MS);
    }
    function watch() {
      if (ui.opponentGone || !active(ui.matchView) || mySeat === "" || ui.room === null) return;
      if (ui.room.authority !== "host") return;
      if (now() - lastOtherAt < SILENCE_MS) return;
      ui.opponentGone = true;
      if (authority() && rules !== null) {
        const seat = otherId() === rules.hostId ? "host" : "guest";
        const result = applyAction(rules, { from: otherId(), seq: (rules.lastSeq[seat] ?? 0) + 1, op: "leave", data: { force: true } });
        if (result.ok) for (const item of result.events ?? []) emit(item);
      } else {
        const view = Object.assign({}, ui.matchView, {
          stage: "matchOver",
          winner: mySeat,
          outcome: mySeat === "host" ? "host-win" : "guest-win",
          settled: true
        });
        applyView(view, "forfeit", {});
        emit({ op: "forfeit", view });
      }
      rerender();
    }
    function refresh() {
      const channel = bridge();
      if (channel !== null && typeof channel.status === "function") {
        const result = channel.status();
        if (result && typeof result.then === "function") result.then(onRoom, function() {
        });
      }
    }
    function createFailed() {
      ui.waiting = false;
      ui.error = "\u724C\u684C\u6CA1\u5EFA\u6210\uFF0C\u68C0\u67E5\u623F\u95F4\u72B6\u6001";
      rerender();
    }
    function create(matchId, guestId, settings) {
      ui.matchId = matchId;
      ui.waiting = true;
      seq += 1;
      const channel = bridge();
      if (channel !== null && typeof channel.send === "function") {
        const result = channel.send(seq, "create", { matchId, guestId, settings: Object.assign({}, settings) });
        if (result && typeof result.then === "function") {
          result.then(function(reply) {
            if (!isObject(reply) || reply.ok !== true) createFailed();
          }, createFailed);
        }
      }
      rerender();
    }
    function sendAction(op, data) {
      const channel = bridge();
      if (channel === null || typeof channel.send !== "function") {
        ui.error = "\u8054\u673A\u901A\u9053\u4E0D\u53EF\u7528";
        rerender();
        return null;
      }
      seq += 1;
      const result = channel.send(seq, "action", Object.assign({ op }, data ?? {}));
      if (result && typeof result.then === "function") {
        result.then(function(reply) {
          if (!isObject(reply) || reply.ok !== true) ui.error = "\u52A8\u4F5C\u6CA1\u53D1\u51FA\u53BB";
          rerender();
        }, function() {
          ui.error = "\u52A8\u4F5C\u6CA1\u53D1\u51FA\u53BB";
          rerender();
        });
      }
      return result;
    }
    function enterTable() {
      ui.page = "table";
      startHeartbeat();
    }
    function resetState() {
      rules = null;
      mySeat = "";
      stopHeartbeat();
    }
    return {
      sync: bind,
      refresh,
      create,
      sendAction,
      enterTable,
      stop: stopHeartbeat,
      seat: () => mySeat,
      authority,
      active: () => active(ui.matchView),
      terminal: () => terminal(ui.matchView),
      reset: resetState
    };
  }

  // src/extensions/roulette/client/online-game.js
  var LOAD_MIN2 = 1;
  var LOAD_MAX2 = 5;
  function numberIn2(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }
  function createOnline(deps) {
    const getApp = deps.getApp;
    const rerender = deps.rerender ?? function() {
    };
    const ui = {
      page: "lobby",
      room: null,
      roomError: "",
      matchView: null,
      matchId: "",
      settings: { lives: 1, format: "single", stake: 1e3, loadCount: 1 },
      error: "",
      waiting: false,
      flash: "",
      spinning: false,
      leaveConfirm: false,
      net: null,
      settled: "",
      opponentGone: false
    };
    const session = createOnlineSession({ ui, getApp, rerender, schedule: deps.schedule, cancel: deps.cancel, now: deps.now });
    function app() {
      return getApp();
    }
    function coinsNow() {
      const coins = app()?.data?.coins;
      return Number.isFinite(coins) ? coins : 0;
    }
    function players() {
      return ui.room !== null && Array.isArray(ui.room.players) ? ui.room.players : [];
    }
    function opponent() {
      return players().find((player) => player.id !== ui.room?.selfId) ?? null;
    }
    function hostId() {
      if (ui.room === null) return "";
      if (ui.room.hosting === true) return typeof ui.room.selfId === "string" ? ui.room.selfId : "";
      const list = players();
      const flagged = list.find((player) => player.host === true);
      if (flagged !== void 0) {
        if (ui.room.authority !== "server" && flagged.id === ui.room.selfId) return "";
        return flagged.id;
      }
      if (ui.room.authority === "server" && list.length > 0) return list[0].id;
      return "";
    }
    function roomHost() {
      return ui.room !== null && hostId() === ui.room.selfId;
    }
    function openLobby() {
      session.sync();
      ui.page = "lobby";
      ui.leaveConfirm = false;
      session.refresh();
      rerender();
    }
    function back() {
      ui.page = "lobby";
      ui.error = "";
      session.refresh();
      rerender();
    }
    function enterTable() {
      session.enterTable();
      ui.leaveConfirm = false;
      rerender();
    }
    function setSetting(key, value) {
      const settings = ui.settings;
      if (key === "lives" && (value === 1 || value === 3)) settings.lives = value;
      else if (key === "format" && (value === "single" || value === "bestOf3")) settings.format = value;
      else if (key === "loadCount") settings.loadCount = numberIn2(value, LOAD_MIN2, LOAD_MAX2, settings.loadCount);
      else if (key === "stake") settings.stake = numberIn2(value, ONLINE_STAKE_MIN, ONLINE_STAKE_MAX, settings.stake);
      else return;
      rerender();
    }
    function createTable() {
      if (session.active()) {
        ui.error = "\u8FD9\u4E00\u573A\u8FD8\u6CA1\u7ED3\u675F";
        rerender();
        return;
      }
      if (ui.room === null || !roomHost()) {
        ui.error = "\u7B49\u623F\u4E3B\u521B\u5EFA\u724C\u684C";
        rerender();
        return;
      }
      const guest = opponent();
      if (guest === null) {
        ui.error = "\u7B49\u53E6\u4E00\u4F4D\u670B\u53CB\u8FDB\u623F\u95F4\u540E\u518D\u5F00\u5C40";
        rerender();
        return;
      }
      if (players().length > 2) {
        ui.error = "\u8054\u673A 1v1 \u53EA\u652F\u6301\u4E24\u4E2A\u4EBA\uFF0C\u8BF7\u5176\u4ED6\u4EBA\u5148\u79BB\u5F00\u623F\u95F4";
        rerender();
        return;
      }
      if (coinsNow() < ui.settings.stake) {
        ui.error = "\u91D1\u5E01\u4E0D\u591F\u672C\u5C40\u5E95\u6CE8";
        rerender();
        return;
      }
      const matchId = "m" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      session.reset();
      ui.matchId = matchId;
      ui.matchView = null;
      ui.settled = "";
      ui.net = null;
      ui.opponentGone = false;
      ui.error = "";
      session.create(matchId, guest.id, ui.settings);
      rerender();
    }
    function arm(index) {
      const view = ui.matchView;
      if (view === null || view.stage !== "arming" || session.seat() !== "host") return;
      const chamber = numberIn2(index, 0, 5, Math.floor(Math.random() * 6));
      session.sendAction("arm", { chamber });
      ui.flash = "";
      rerender();
    }
    function randomArm() {
      arm(Math.floor(Math.random() * 6));
    }
    function fire() {
      const view = ui.matchView;
      if (view === null || view.stage !== "choice" || view.turn !== session.seat()) return;
      session.sendAction("fire");
      rerender();
    }
    function pass() {
      const view = ui.matchView;
      if (view === null || view.stage !== "choice" || view.turn !== session.seat()) return;
      if (view.mustShoot === session.seat()) {
        ui.error = "\u56DE\u8BA9\u540E\u5FC5\u987B\u5F00\u67AA";
        rerender();
        return;
      }
      const fee = passFee(view.settings.stake);
      if (coinsNow() < fee) {
        ui.error = "\u91D1\u5E01\u4E0D\u591F\u8BA9\u67AA\u8D39 " + fee;
        rerender();
        return;
      }
      session.sendAction("pass");
      rerender();
    }
    function next() {
      const view = ui.matchView;
      if (view === null || view.stage !== "roundOver" || session.seat() !== "host") return;
      session.sendAction("next", { loadCount: ui.settings.loadCount });
      rerender();
    }
    function requestLeave() {
      if (!session.active()) {
        confirmLeave();
        return;
      }
      ui.leaveConfirm = true;
      rerender();
    }
    function cancelLeave() {
      ui.leaveConfirm = false;
      rerender();
    }
    function confirmLeave() {
      ui.leaveConfirm = false;
      if (ui.room !== null && session.active()) {
        session.sendAction("leave");
        ui.page = "lobby";
      } else {
        session.reset();
        ui.page = "lobby";
        ui.matchView = null;
      }
      rerender();
    }
    function sync() {
      session.sync();
    }
    return {
      ui,
      sync,
      openLobby,
      enterTable,
      back,
      refresh: session.refresh,
      setSetting,
      createTable,
      arm,
      randomArm,
      fire,
      pass,
      next,
      requestLeave,
      cancelLeave,
      confirmLeave,
      players,
      opponent,
      hostId,
      roomHost
    };
  }

  // src/extensions/roulette/client/ui.js
  function assetImage(app, name, className) {
    const node = app.el("img", className);
    node.src = typeof app.asset === "function" ? app.asset(name) : "";
    node.alt = "";
    return node;
  }
  function coin() {
    const node = document.createElement("span");
    node.className = "rt-coin";
    node.setAttribute("aria-hidden", "true");
    return node;
  }
  function vaultPill(app, state) {
    const pill = app.el("div", "rt-vault");
    pill.setAttribute("aria-label", "AI \u91D1\u5E93 " + money(state.vault));
    pill.appendChild(coin());
    pill.appendChild(app.el("small", null, "\u91D1\u5E93"));
    pill.appendChild(app.el("b", null, money(state.vault)));
    return pill;
  }
  function coinPill(app, state) {
    const pill = app.el("div", "rt-vault rt-wallet");
    pill.setAttribute("aria-label", "\u91D1\u5E01 " + money(state.coins));
    pill.appendChild(coin());
    pill.appendChild(app.el("b", null, money(state.coins)));
    return pill;
  }
  function pageHead(app, state, title, sub, backLabel, onBack) {
    const head = app.el("header", "rt-head");
    if (typeof onBack === "function") {
      const back = app.button("rt-back", { "aria-label": backLabel || "\u8FD4\u56DE" }, onBack);
      back.textContent = "\u8FD4\u56DE";
      head.appendChild(back);
    }
    const brand = app.el("div", "rt-brand");
    brand.appendChild(app.el("div", "rt-title", title));
    if (sub) brand.appendChild(app.el("div", "rt-sub", sub));
    head.appendChild(brand);
    head.appendChild(coinPill(app, state));
    return head;
  }
  function action(app, className, attrs, label, onClick) {
    const node = app.button(className, attrs || {}, onClick);
    if (label !== void 0) node.textContent = label;
    return node;
  }
  function chip(app, label, active, onClick, attrs) {
    const node = action(app, "dp-mini rt-chip" + (active ? " rt-chip-on" : ""), attrs || {}, label, onClick);
    node.setAttribute("aria-pressed", active ? "true" : "false");
    return node;
  }
  function modeRow(app, options) {
    let className = "rt-mode";
    if (options.primary) className += " rt-mode-primary";
    if (options.locked) className += " rt-mode-locked";
    const node = app.button(className, {
      "data-op": options.op,
      "aria-disabled": options.locked ? "true" : "false",
      "aria-label": options.name + "\uFF0C" + options.note
    }, options.onClick);
    const medal = app.el("span", options.grid ? "rt-medal rt-medal-grid" : "rt-medal");
    if (options.grid) {
      for (let index = 0; index < 4; index += 1) medal.appendChild(app.el("i"));
    } else if (options.asset) {
      medal.appendChild(assetImage(app, options.asset, "rt-medal-img"));
    } else if (options.emoji) {
      medal.textContent = options.emoji;
    }
    node.appendChild(medal);
    const copy = app.el("span", "rt-mode-copy");
    copy.appendChild(app.el("span", "rt-mode-name", options.name));
    copy.appendChild(app.el("span", "rt-mode-note", options.note));
    node.appendChild(copy);
    const side = app.el("span", "rt-mode-side");
    side.appendChild(app.el("span", options.locked ? "rt-lock" : "rt-chev"));
    node.appendChild(side);
    return node;
  }
  function footer(app, options) {
    const row = app.el("div", "rt-foot");
    const rules = app.button("rt-link", { "data-op": "rules", "aria-label": "\u770B\u89C4\u5219" }, options.onRules);
    rules.textContent = "\u89C4\u5219";
    row.appendChild(rules);
    if (typeof options.extra === "function") row.appendChild(options.extra());
    row.appendChild(app.el("span", "rt-spacer"));
    row.appendChild(app.el("span", "rt-tiny", options.note || "\u5355\u5C40\u5E95\u6C60"));
    return row;
  }

  // src/extensions/roulette/client/settings.js
  function settingsBlock(app, game2, data) {
    const box = app.el("div", "rt-settings");
    const s = data.settings;
    const lives = app.el("div", "rt-setting");
    lives.appendChild(app.el("span", "rt-setting-label", "\u547D\u6570"));
    const livesRow = app.el("div", "rt-chips");
    LIVES_OPTIONS.forEach(function(value) {
      livesRow.appendChild(chip(app, value + " \u6761", s.lives === value, function() {
        game2.config({ lives: value });
      }, { "data-op": "lives-" + value }));
    });
    lives.appendChild(livesRow);
    box.appendChild(lives);
    const format = app.el("div", "rt-setting");
    format.appendChild(app.el("span", "rt-setting-label", "\u8D5B\u5236"));
    const formatRow = app.el("div", "rt-chips");
    formatRow.appendChild(chip(app, "\u5355\u5C40", s.format === "single", function() {
      game2.config({ format: "single" });
    }, { "data-op": "format-single" }));
    formatRow.appendChild(chip(app, "\u4E09\u5C40\u4E24\u80DC", s.format === "bestOf3", function() {
      game2.config({ format: "bestOf3" });
    }, { "data-op": "format-bestOf3" }));
    format.appendChild(formatRow);
    box.appendChild(format);
    const load = app.el("div", "rt-setting");
    load.appendChild(app.el("span", "rt-setting-label", "\u88C5\u5F39"));
    const loadRow = app.el("div", "rt-chips rt-chips-5");
    for (let value = LOAD_MIN; value <= LOAD_MAX; value += 1) {
      loadRow.appendChild(chip(app, value + " \u53D1", s.loadCount === value, function() {
        game2.config({ loadCount: value });
      }, { "data-op": "load-" + value }));
    }
    load.appendChild(loadRow);
    box.appendChild(load);
    const stake = app.el("div", "rt-setting");
    stake.appendChild(app.el("span", "rt-setting-label", "\u5E95\u6CE8"));
    const stakeRow = app.el("div", "rt-chips rt-chips-4");
    STAKE_LEVELS.forEach(function(value) {
      stakeRow.appendChild(chip(app, money(value), s.stake === value, function() {
        game2.config({ stake: value });
      }, { "data-op": "stake-" + value }));
    });
    stake.appendChild(stakeRow);
    const custom = app.el("div", "rt-stake-custom");
    const input = app.el("input", "rt-stake-input");
    input.setAttribute("type", "number");
    input.setAttribute("min", String(STAKE_MIN));
    input.setAttribute("max", String(STAKE_MAX));
    input.setAttribute("step", "100");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("aria-label", "\u81EA\u5B9A\u4E49\u5E95\u6CE8");
    input.setAttribute("placeholder", "\u81EA\u5B9A\u4E49 " + money(STAKE_MIN) + "\u2013" + money(STAKE_MAX));
    if (!STAKE_LEVELS.includes(s.stake)) input.value = String(s.stake);
    input.addEventListener("keydown", function(event) {
      if (event.key === "Enter") game2.setStake(input.value);
    });
    custom.appendChild(input);
    custom.appendChild(action(app, "dp-mini rt-chip", { "data-op": "stake-custom" }, "\u8BBE\u5B9A", function() {
      game2.setStake(input.value);
    }));
    stake.appendChild(custom);
    box.appendChild(stake);
    const ai = app.el("div", "rt-setting");
    ai.appendChild(app.el("span", "rt-setting-label", "AI"));
    const select = app.el("select", "rt-select");
    select.setAttribute("aria-label", "AI \u7B56\u7565");
    AI_STRATEGIES.forEach(function(strategy) {
      const option = app.el("option", null, strategy.label);
      option.value = strategy.key;
      select.appendChild(option);
    });
    select.value = s.ai;
    select.addEventListener("change", function() {
      game2.config({ ai: select.value });
    });
    ai.appendChild(select);
    box.appendChild(ai);
    const vault = app.el("div", "rt-setting rt-vault-line");
    vault.appendChild(app.el("span", "rt-setting-label", "\u91D1\u5E93"));
    vault.appendChild(vaultPill(app, data));
    box.appendChild(vault);
    return box;
  }

  // src/extensions/roulette/client/pages.js
  function renderLobby(app, game2) {
    const data = game2.data();
    const root = app.el("div", "rt-page rt-lobby");
    const top = app.el("div", "rt-topline");
    top.appendChild(app.el("span", "rt-kicker", "6 \u5DE2 \xB7 \u771F\u5B9E\u91D1\u5E01 \xB7 \u73A9\u5177\u8F6E\u76D8"));
    top.appendChild(app.el("span", "rt-spacer"));
    top.appendChild(coinPill(app, data));
    root.appendChild(top);
    const hero = app.el("div", "rt-hero");
    hero.appendChild(app.el("div", "rt-hero-glow"));
    hero.appendChild(assetImage(app, "table-v2.webp", "rt-hero-table"));
    hero.appendChild(assetImage(app, "revolver-v6.webp", "rt-hero-gun"));
    hero.appendChild(assetImage(app, "chip-v1.webp", "rt-hero-chip rt-hero-chip-a"));
    hero.appendChild(assetImage(app, "chip-v1.webp", "rt-hero-chip rt-hero-chip-b"));
    hero.appendChild(app.el("span", "rt-hero-tag", "AI \u5BF9\u6218 \xB7 1 \u5BF9 1"));
    root.appendChild(hero);
    root.appendChild(action(app, "dp-btn rt-primary rt-wide rt-enter", { "data-op": "enter-ai" }, "\u8FDB\u5165\u724C\u684C", function() {
      game2.start();
    }));
    const menu = app.el("div", "rt-menu");
    menu.appendChild(modeRow(app, {
      op: "friend-mode",
      name: "\u597D\u53CB\u8054\u673A",
      note: "1v1 \xB7 \u623F\u4E3B\u5F00\u5C40",
      asset: "chip-v1.webp",
      onClick: function() {
        if (!app.room && typeof app.openBig === "function") {
          app.openBig();
          return;
        }
        game2.showPage("online");
      }
    }));
    menu.appendChild(modeRow(app, {
      op: "four-mode",
      name: "4 \u4EBA\u684C",
      note: "\u540C\u6279\u8BBE\u8BA1 \xB7 \u4E0B\u4E00\u9636\u6BB5\u63A5\u5165",
      locked: true,
      grid: true,
      onClick: function() {
        game2.notify("4 \u4EBA\u684C\u9700\u8981\u5BBF\u4E3B\u623F\u95F4\u63A5\u53E3\uFF0C\u4E0B\u4E00\u9636\u6BB5\u63A5\u5165");
      }
    }));
    root.appendChild(menu);
    root.appendChild(settingsBlock(app, game2, data));
    root.appendChild(footer(app, {
      onRules: function() {
        game2.openRules("lobby");
      },
      note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u5E95\u6C60\u5F52\u8D62\u5BB6"
    }));
    return root;
  }
  function lifeDots(app, count, max) {
    const lives = app.el("span", "rt-lives");
    for (let index = 0; index < max; index += 1) {
      lives.appendChild(app.el("i", index < count ? "rt-life rt-life-on" : "rt-life"));
    }
    return lives;
  }
  function renderLives(app, data, opponentName) {
    const match = data.match;
    const max = data.settings.lives;
    const row = app.el("div", "rt-livesbar");
    const ai = app.el("div", "rt-lives-side rt-lives-ai");
    ai.appendChild(app.el("b", null, opponentName ?? "\u4FA6\u63A2\u732A"));
    ai.appendChild(lifeDots(app, match ? match.livesAi : 0, max));
    row.appendChild(ai);
    row.appendChild(app.el("span", "rt-lives-score", match ? match.winsAi + " : " + match.winsYou : "0 : 0"));
    const you = app.el("div", "rt-lives-side rt-lives-you");
    you.appendChild(lifeDots(app, match ? match.livesYou : 0, max));
    you.appendChild(app.el("b", null, "\u4F60"));
    row.appendChild(you);
    return row;
  }
  function renderMeta(app, data) {
    const match = data.match;
    const row = app.el("div", "rt-meta");
    const left = app.el("div", "rt-meta-left");
    left.appendChild(app.el("span", "rt-meta-tag", match ? "\u7B2C " + match.round + " \u5C40" : "\u672A\u5F00\u5C40"));
    left.appendChild(app.el("span", "rt-meta-tag", data.settings.format === "bestOf3" ? "\u4E09\u5C40\u4E24\u80DC" : "\u5355\u5C40"));
    if (match && data.settings.format === "bestOf3") {
      left.appendChild(app.el("span", "rt-meta-tag rt-meta-score", match.winsAi + " : " + match.winsYou));
    }
    row.appendChild(left);
    const pot = app.el("div", "rt-pot");
    pot.appendChild(assetImage(app, "chip-v1.webp", "rt-pot-chip"));
    pot.appendChild(app.el("span", null, "\u5E95\u6C60"));
    pot.appendChild(app.el("b", null, money(match ? match.pot : 0)));
    row.appendChild(pot);
    return row;
  }
  function renderBoard(app, game2, data, canArm) {
    const match = data.match;
    const ui = game2.ui;
    let className = "rt-board";
    if (match && match.stage === "arming") className += " rt-board-arming";
    if (ui.flash === "live") className += " rt-board-fire rt-board-live";
    else if (ui.flash === "blank") className += " rt-board-fire";
    const board = app.el("div", className);
    board.setAttribute("role", "group");
    board.setAttribute("aria-label", "\u516D\u5B54\u5F39\u5DE2");
    board.appendChild(assetImage(app, "table-v2.webp", "rt-board-table"));
    const wrap = app.el("div", ui.spinning ? "rt-cyl-wrap rt-cyl-spin" : "rt-cyl-wrap");
    wrap.appendChild(assetImage(app, "cylinder-v4.webp", "rt-cyl"));
    if (ui.primer >= 0) {
      const primer = assetImage(app, "bullet-base-v4.webp", ui.primerPop ? "rt-primer rt-primer-show" : "rt-primer rt-primer-on");
      primer.style.setProperty("--x", CHAMBER_X[ui.primer] + "px");
      primer.style.setProperty("--y", CHAMBER_Y[ui.primer] + "px");
      wrap.appendChild(primer);
    }
    const armed = canArm !== false && match !== null && match.stage === "arming" && !ui.spinning;
    for (let index = 0; index < 6; index += 1) {
      const hole = app.button("rt-hole", {
        "data-chamber": String(index),
        "aria-label": "\u7B2C " + (index + 1) + " \u5DE2" + (armed ? "\uFF0C\u70B9\u8FD9\u91CC\u88C5\u5F39" : ""),
        "aria-disabled": armed ? "false" : "true"
      }, function() {
        game2.load(index);
      });
      hole.disabled = !armed;
      hole.style.setProperty("--x", CHAMBER_X[index] + "px");
      hole.style.setProperty("--y", CHAMBER_Y[index] + "px");
      wrap.appendChild(hole);
    }
    board.appendChild(wrap);
    board.appendChild(app.el("div", "rt-flash"));
    if (match && match.stage !== "roundOver") {
      const badge = app.el("div", "rt-ammo rt-board-ammo");
      badge.appendChild(assetImage(app, "bullet-side-v4.webp", "rt-ammo-icon"));
      if (match.stage === "arming") {
        badge.appendChild(app.el("b", null, String(match.bulletCount)));
        badge.appendChild(app.el("span", null, "\u53D1 \xB7 \u5F85\u88C5"));
      } else {
        badge.appendChild(app.el("b", null, String(match.bulletsLeft)));
        badge.appendChild(app.el("span", null, "/ " + match.bulletCount + " \u53D1"));
      }
      board.appendChild(badge);
    }
    return board;
  }
  function statusText(match) {
    if (match === null) return "\u9009\u62E9\u8BBE\u7F6E\u540E\u5F00\u59CB\u5BF9\u5C40\u3002";
    if (match.stage === "arming") return "\u88C5 " + match.bulletCount + " \u53D1\u3002\u70B9\u4E00\u4E2A\u5F39\u5B54\uFF0C\u968F\u540E\u5F3A\u5236\u8F6C\u8F6E\u3002";
    if (match.stage === "ai") {
      if (match.mustShoot === "ai") return "AI \u88AB\u56DE\u8BA9\uFF0C\u5FC5\u987B\u5F00\u67AA\u2026";
      if (match.passBy === "you") return "\u4F60\u5DF2\u8BA9\u67AA\uFF0C\u7B49 AI \u51B3\u5B9A\u3002";
      return "AI \u56DE\u5408\u2026";
    }
    if (match.stage === "choice") {
      if (match.mustShoot === "you") return "\u5BF9\u624B\u56DE\u8BA9\uFF0C\u4F60\u5FC5\u987B\u5F00\u67AA\u3002";
      if (match.passBy === "ai") return "AI \u5DF2\u8BA9\u67AA\uFF1A\u5F00\u67AA\uFF0C\u6216\u56DE\u8BA9\u8BA9\u5B83\u5F00\u67AA\u3002";
      return match.turn === "you" ? "\u8F6E\u5230\u4F60\uFF1A\u5BF9\u81EA\u5DF1\u5F00\u67AA\uFF0C\u6216\u8BA9\u67AA\u3002" : "AI \u56DE\u5408\u2026";
    }
    if (match.stage === "roundOver") return "\u672C\u5C40\u7ED3\u675F\uFF0C\u6BD4\u5206 " + match.winsAi + " : " + match.winsYou + "\u3002\u70B9\u300C\u4E0B\u4E00\u5C40\u300D\u7EE7\u7EED\u3002";
    if (match.stage === "matchOver") return match.outcome === "win" ? "\u4F60\u8D62\u4E0B\u6574\u573A\uFF0C\u5E95\u6C60\u5DF2\u7ED3\u7B97\u3002" : "AI \u8D62\u4E0B\u6574\u573A\uFF0C\u5E95\u6C60\u5DF2\u7ED3\u7B97\u3002";
    if (match.lastEvent === "hit") return "\u4E2D\u5F39\uFF01";
    if (match.lastEvent === "blank") return "\u7A7A\u67AA\uFF0C\u6362\u624B\u3002";
    return "\u51C6\u5907\u4E2D\u2026";
  }
  function matchNet(match) {
    return (match.outcome === "win" ? match.pot : 0) - (match.paidYou || 0) - (match.feesYou || 0);
  }
  function renderResult(app, match) {
    const net = matchNet(match);
    const win = match.outcome === "win";
    const card = app.el("div", "rt-result " + (net >= 0 ? "rt-result-win" : "rt-result-lose"));
    card.appendChild(app.el("div", "rt-result-kicker", "\u672C\u573A\u7ED3\u675F"));
    card.appendChild(app.el("div", "rt-result-title", win ? "\u4F60\u8D62\u4E86" : "AI \u8D62\u4E86"));
    card.appendChild(app.el("div", "rt-result-net", (net > 0 ? "+" : net < 0 ? "-" : "") + money(Math.abs(net))));
    card.appendChild(app.el("div", "rt-result-label", net > 0 ? "\u672C\u573A\u51C0\u6536" : net < 0 ? "\u672C\u573A\u51C0\u4ED8" : "\u672C\u573A\u6253\u5E73"));
    const meta = app.el("div", "rt-result-meta");
    meta.appendChild(app.el("span", null, "\u5E95\u6C60 " + money(match.pot)));
    meta.appendChild(app.el("span", null, "\u4E0B\u6CE8 " + money(match.paidYou)));
    if (match.feesYou > 0) meta.appendChild(app.el("span", null, "\u8BA9\u67AA\u4ED8 " + money(match.feesYou)));
    if (match.feesAi > 0) meta.appendChild(app.el("span", null, "AI \u8BA9\u67AA\u5165\u6C60 " + money(match.feesAi)));
    card.appendChild(meta);
    return card;
  }
  function renderDock(app, game2, data) {
    const match = data.match;
    const dock = app.el("div", "rt-dock");
    if (match === null) {
      dock.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "start" }, "\u5F00\u59CB AI \u5BF9\u6218", function() {
        game2.start();
      }));
      return dock;
    }
    if (game2.ui.leaveConfirm) {
      const confirm = app.el("div", "rt-confirm");
      confirm.appendChild(app.el("b", null, "\u786E\u8BA4\u79BB\u5F00\u724C\u684C\uFF1F"));
      confirm.appendChild(app.el("p", null, match.stage === "arming" ? "\u524D\u9762\u7D2F\u79EF\u7684\u5E95\u6C60\u4F1A\u5F52 AI \u91D1\u5E93\uFF0C\u5DF2\u4E0B\u7684\u5E95\u6CE8\u4E0D\u9000\u3002" : "\u672C\u573A\u89C6\u4E3A\u8BA4\u8F93\uFF0C\u5E95\u6C60\u5F52 AI \u91D1\u5E93\uFF0C\u5DF2\u4E0B\u7684\u5E95\u6CE8\u4E0D\u9000\u3002"));
      dock.appendChild(confirm);
      const buttons = app.el("div", "rt-actions");
      buttons.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "cancel-leave" }, "\u7EE7\u7EED\u6253", function() {
        game2.cancelLeave();
      }));
      buttons.appendChild(action(app, "dp-btn rt-danger rt-wide", { "data-op": "confirm-leave" }, "\u786E\u8BA4\u79BB\u5F00", function() {
        game2.leaveTable();
      }));
      dock.appendChild(buttons);
      return dock;
    }
    const info = app.el("div", "rt-bet");
    info.appendChild(app.el("span", "rt-bet-label", "\u5E95\u6CE8"));
    info.appendChild(app.el("b", "rt-stake", money(match.matchedYou)));
    info.appendChild(app.el("span", "rt-bet-label", "\xB7 \u672C\u5C40 AI \u914D\u6CE8"));
    info.appendChild(app.el("b", "rt-stake", money(match.matchedAi)));
    dock.appendChild(info);
    const actions = app.el("div", "rt-actions");
    function primary(label, op, handler, disabled) {
      const node = action(app, "dp-btn rt-primary rt-wide", { "data-op": op }, label, handler);
      if (disabled) node.disabled = true;
      actions.appendChild(node);
      return node;
    }
    if (match.stage === "arming") {
      primary("\u968F\u673A\u88C5\u5F39", "load-random", function() {
        game2.randomLoad();
      });
      actions.appendChild(app.el("div", "rt-hint", "\u4E5F\u53EF\u4EE5\u76F4\u63A5\u70B9\u5F39\u5B54 \xB7 \u88C5\u5B8C\u5F3A\u5236\u8F6C\u8F6E"));
    } else if (match.stage === "choice") {
      actions.appendChild(action(app, "dp-btn rt-danger", { "data-op": "shoot" }, "\u5BF9\u81EA\u5DF1\u5F00\u67AA", function() {
        game2.fire();
      }));
      const fee = Math.max(1, Math.ceil(match.matchedYou * (data.passRate || 0.5)));
      const forced = match.mustShoot === "you";
      const passBtn = action(app, "dp-btn", { "data-op": "pass" }, "\u8BA9\u67AA \xB7 \u4ED8 " + money(fee), function() {
        game2.pass();
      });
      if (forced || data.coins < fee) passBtn.disabled = true;
      actions.appendChild(passBtn);
      const hint = forced ? "\u5BF9\u624B\u56DE\u8BA9\uFF0C\u4F60\u53EA\u80FD\u5F00\u67AA" : data.coins < fee ? "\u91D1\u5E01\u4E0D\u591F\u8BA9\u67AA\u8D39\uFF0C\u53EA\u80FD\u5F00\u67AA" : match.passBy === "ai" ? "\u56DE\u8BA9\u4F1A\u8BA9\u67AA\u56DE\u5230 AI\uFF0C\u5B83\u5FC5\u987B\u5F00\u67AA" : "\u8BA9\u67AA\u8D39\u76F4\u63A5\u7ED9 AI\uFF0C\u672C\u56DE\u5408\u7ED3\u675F";
      actions.appendChild(app.el("div", "rt-hint", hint));
    } else if (match.stage === "ai") {
      if (game2.ui.aiError) {
        primary("AI \u884C\u52A8\u91CD\u8BD5", "ai-retry", function() {
          game2.retryAi();
        });
        actions.appendChild(app.el("div", "rt-hint", "AI \u884C\u52A8\u6CA1\u9001\u5230\u5BBF\u4E3B\uFF0C\u70B9\u91CD\u8BD5"));
      } else {
        primary("AI \u56DE\u5408\u2026", "ai-wait", function() {
        }, true);
        actions.appendChild(app.el("div", "rt-hint", "AI \u4E0D\u77E5\u9053\u5B50\u5F39\u4F4D\u7F6E"));
      }
    } else if (match.stage === "roundOver") {
      const load = app.el("div", "rt-next-load");
      load.appendChild(app.el("span", "rt-bet-label", "\u4E0B\u4E00\u5C40\u88C5\u5F39"));
      const row = app.el("div", "rt-chips");
      const current = game2.ui.nextLoad ?? data.settings.loadCount;
      for (let value = LOAD_MIN; value <= LOAD_MAX; value += 1) {
        row.appendChild(chip(app, value + " \u53D1", current === value, function() {
          game2.setNextLoad(value);
        }, { "data-op": "next-load-" + value }));
      }
      load.appendChild(row);
      actions.appendChild(load);
      primary("\u4E0B\u4E00\u5C40", "next", function() {
        game2.next();
      });
    } else if (match.stage === "matchOver") {
      primary("\u518D\u6765\u4E00\u573A", "again", function() {
        game2.start();
      });
      actions.appendChild(app.el("div", "rt-hint", match.outcome === "win" ? "\u5E95\u6C60\u5DF2\u7ED3\u7B97 \xB7 \u91D1\u5E01\u5DF2\u5230\u8D26" : "\u5E95\u6C60\u5F52 AI \xB7 \u5DF2\u4E0B\u5E95\u6CE8\u4E0D\u9000"));
    }
    dock.appendChild(actions);
    return dock;
  }
  function renderTable(app, game2) {
    const data = game2.data();
    const match = data.match;
    const root = app.el("div", "rt-page rt-table");
    const sub = match === null ? "\u672A\u5F00\u5C40" : "\u7B2C " + match.round + " \u5C40 \xB7 " + (data.settings.format === "bestOf3" ? "\u4E09\u5C40\u4E24\u80DC" : "\u5355\u5C40");
    root.appendChild(pageHead(app, data, "AI \u5BF9\u6218", sub, "\u8FD4\u56DE\u5927\u5385", function() {
      game2.requestLeave();
    }));
    root.appendChild(renderMeta(app, data));
    root.appendChild(renderLives(app, data, "\u4FA6\u63A2\u732A"));
    if (match !== null && match.stage === "matchOver") {
      root.appendChild(renderResult(app, match));
    } else {
      root.appendChild(renderBoard(app, game2, data, true));
      const status = app.el("div", "rt-status", statusText(match));
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      root.appendChild(status);
    }
    root.appendChild(renderDock(app, game2, data));
    root.appendChild(footer(app, {
      onRules: function() {
        game2.openRules("table");
      },
      note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u8BA9\u67AA\u4ED8 50%"
    }));
    return root;
  }
  function renderRules(app, game2) {
    const data = game2.data();
    const root = app.el("div", "rt-page rt-rules");
    root.appendChild(pageHead(app, data, "\u89C4\u5219", "6 \u5DE2 \xB7 1/3 \u547D \xB7 \u5355\u5C40\u6216\u4E09\u5C40\u4E24\u80DC", "\u8FD4\u56DE", function() {
      game2.closeRules();
    }));
    const card = app.el("div", "rt-rules-card");
    card.appendChild(app.el("h2", null, "\u5DE6\u8F6E\u8F6E\u76D8\u89C4\u5219"));
    const list = app.el("ul");
    [
      "6 \u4E2A\u5F39\u5DE2\u3002\u6BCF\u5C40\u5F00\u5C40\u81EA\u5DF1\u9009\u88C5 1-5 \u53D1\uFF0C\u5355\u5C40\u5185\u5B50\u5F39\u4E0D\u589E\u52A0\u3002",
      "\u88C5\u5B8C\u5F3A\u5236\u8F6C\u8F6E\uFF0C\u5B50\u5F39\u4F4D\u7F6E\u968F\u673A\u5316\uFF0C\u53CC\u65B9\u90FD\u4E0D\u77E5\u9053\u6700\u7EC8\u4F4D\u7F6E\u3002",
      "\u6BCF\u5C40\u5148\u624B\u968F\u673A\uFF1B\u7A7A\u67AA\u6362\u624B\uFF1B\u4E2D\u5F39\u6263 1 \u6761\u547D\u3002",
      "1 \u6761\u547D\uFF1A\u4E2D\u5F39\u5373\u8F93\u30023 \u6761\u547D\uFF1A\u88C5 1 \u53D1\u4E2D\u5F39\u540E\u91CD\u88C5\u7EE7\u7EED\uFF1B\u88C5\u591A\u53D1\u5219\u7EE7\u7EED\u6253\u5F53\u524D\u5F39\u5DE2\uFF0C\u5B50\u5F39\u6253\u5B8C\u518D\u91CD\u88C5\u3002",
      "\u8BA9\u67AA\uFF1A\u73A9\u5BB6\u4ED8\u5F53\u524D\u5E95\u6CE8 50% \u7ED9 AI\uFF1BAI \u8BA9\u67AA\u4ED8 50% \u8FDB\u5E95\u6C60\u3002\u672C\u56DE\u5408\u7ED3\u675F\uFF0C\u5BF9\u624B\u4E0D\u7528\u5F00\u67AA\u3002",
      "\u56DE\u8BA9\uFF1A\u5BF9\u624B\u8BA9\u67AA\u540E\u4F60\u518D\u8BA9\uFF0C\u67AA\u56DE\u5230\u5148\u8BA9\u7684\u4EBA\u624B\u91CC\uFF0C\u4ED6\u8FD9\u4E00\u624B\u5FC5\u987B\u5F00\u67AA\u3002",
      "\u5355\u5C40\u6216\u4E09\u5C40\u4E24\u80DC\u3002\u4E09\u5C40\u4E24\u80DC\u6BCF\u5C40\u4E0B\u6CE8\u3001\u5E95\u6C60\u7D2F\u79EF\uFF0C\u5148\u8D62 2 \u5C40\u8005\u62FF\u8D70\u5168\u90E8\u5E95\u6C60\u3002",
      "AI \u6309\u91D1\u5E93\u4E0A\u9650\u914D\u6CE8\uFF0C\u8DDF\u4E0D\u8D77\u5C31\u5C11\u914D\uFF1B5 \u6863\u7B56\u7565\uFF08\u83BD\u592B / \u671F\u671B\u503C / \u968F\u673A\u8BC8\u552C / \u8D1D\u53F6\u65AF / \u8499\u7279\u5361\u6D1B\uFF09\u90FD\u53EA\u8BFB\u516C\u5F00\u91CF\uFF0C\u4E0D\u77E5\u9053\u5B50\u5F39\u4F4D\u7F6E\uFF1B\u4E2D\u5F39\u6982\u7387\u226575% \u65F6\u90FD\u4F1A\u8BA9\u67AA\u3002",
      "\u771F\u5B9E\u91D1\u5E01\u7ED3\u7B97\uFF1A\u8F93\u7684\u94B1\u8FDB AI \u91D1\u5E93\uFF0C\u8D62\u7684\u94B1\u4ECE AI \u91D1\u5E93\u51FA\u3002"
    ].forEach(function(line) {
      list.appendChild(app.el("li", null, line));
    });
    card.appendChild(list);
    root.appendChild(card);
    const label = game2.ui.rulesFrom === "table" ? "\u8FD4\u56DE\u724C\u684C" : "\u8FD4\u56DE\u5927\u5385";
    root.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "rules-back" }, label, function() {
      game2.closeRules();
    }));
    return root;
  }

  // src/extensions/roulette/client/online-pages.js
  var STAKE_CHOICES = [100, 500, 1e3, 5e3];
  function isObject2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function mapSeat(value, seat) {
    if (value !== "host" && value !== "guest") return "";
    return value === seat ? "you" : "ai";
  }
  function nameOf(room, id) {
    const players = isObject2(room) && Array.isArray(room.players) ? room.players : [];
    const player = players.find((entry) => entry.id === id);
    return player && typeof player.name === "string" && player.name !== "" ? player.name : "\u5BF9\u624B";
  }
  function mapMatch(data, view, seat) {
    const me = view.seats[seat] ?? { lives: 0, wins: 0, paid: 0, fees: 0 };
    const them = view.seats[seat === "host" ? "guest" : "host"] ?? { lives: 0, wins: 0, paid: 0, fees: 0 };
    const mine = view.turn === seat;
    return {
      coins: data.coins,
      settings: {
        lives: view.settings.lives,
        format: view.settings.format,
        loadCount: view.settings.loadCount,
        stake: view.settings.stake
      },
      match: {
        handId: view.rev,
        round: view.round,
        winsYou: me.wins,
        winsAi: them.wins,
        pot: view.pot,
        matchedYou: me.paid,
        matchedAi: them.paid,
        paidYou: me.paid,
        feesYou: me.fees,
        feesAi: them.fees,
        livesYou: me.lives,
        livesAi: them.lives,
        bulletCount: view.bulletCount,
        bulletsLeft: view.bulletsLeft,
        chamber: view.chamber,
        turn: mine ? "you" : "ai",
        stage: view.stage === "choice" && !mine ? "ai" : view.stage,
        passBy: mapSeat(view.passBy, seat),
        mustShoot: mapSeat(view.mustShoot, seat),
        outcome: view.winner === seat ? "win" : view.winner === "" ? "" : "lose",
        lastEvent: view.lastEvent,
        lastShooter: mapSeat(view.lastShooter, seat),
        settled: view.settled
      }
    };
  }
  function roomLine(app, online2, room) {
    const box = app.el("div", "rt-room");
    const head = app.el("div", "rt-room-head");
    const hostId = online2.hostId();
    head.appendChild(app.el("span", "rt-room-code", room.code ?? ""));
    head.appendChild(app.el("span", "rt-badge", room.authority === "server" ? "\u516C\u7F51\u670D\u52A1\u5668\u6743\u5A01" : hostId === "" ? "\u6CA1\u6709\u5F00\u5C40\u6743\u5A01" : "\u623F\u4E3B\u5BA2\u6237\u7AEF\u6743\u5A01"));
    box.appendChild(head);
    const players = Array.isArray(room.players) ? room.players : [];
    for (const player of players) {
      const row = app.el("div", "rt-player" + (player.id === room.selfId ? " rt-player-self" : ""));
      row.appendChild(app.el("b", null, (player.name ?? "\u5C0F\u732A") + (player.id === room.selfId ? "\uFF08\u4F60\uFF09" : "")));
      row.appendChild(app.el("span", "rt-tiny", player.id === hostId ? "\u623F\u4E3B" : "\u5BA2\u4EBA"));
      box.appendChild(row);
    }
    return box;
  }
  function renderOnlineLobby(app, online2, game2) {
    const data = game2.data();
    const root = app.el("div", "rt-page rt-online");
    root.appendChild(pageHead(app, data, "\u597D\u53CB\u8054\u673A", "1v1 \xB7 \u540C\u4E00\u623F\u95F4", "\u8FD4\u56DE\u5927\u5385", function() {
      game2.showPage("lobby");
    }));
    const room = online2.ui.room;
    if (room === null) {
      const empty = app.el("div", "rt-empty");
      empty.appendChild(app.el("p", null, online2.ui.roomError || "\u8FD8\u6CA1\u6709\u8FDB\u5165\u8054\u673A\u623F\u95F4\u3002"));
      empty.appendChild(app.el("p", "rt-tiny", app.room ? "\u5148\u5728\u9762\u677F\u7684\u8054\u673A\u623F\u95F4\u91CC\u5EFA\u623F\u6216\u52A0\u5165\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u3002" : "\u8054\u673A\u9700\u8981\u684C\u9762\u7248\uFF1A\u7F51\u9875\u7248\u6CA1\u6709\u623F\u95F4\u901A\u9053\u3002"));
      empty.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "online-refresh" }, "\u5237\u65B0\u623F\u95F4\u72B6\u6001", function() {
        online2.refresh();
      }));
      root.appendChild(empty);
      root.appendChild(footer(app, { onRules: function() {
        game2.openRules("online");
      }, note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u5404\u6263\u5404\u7684" }));
      return root;
    }
    root.appendChild(roomLine(app, online2, room));
    const players = Array.isArray(room.players) ? room.players : [];
    const other = players.find((player) => player.id !== room.selfId) ?? null;
    if (players.length > 2) {
      root.appendChild(app.el("p", "rt-online-note", "\u623F\u95F4\u91CC\u8D85\u8FC7\u4E24\u4E2A\u4EBA\u3002\u8054\u673A 1v1 \u53EA\u652F\u6301\u4E24\u4EBA\uFF0C\u8BF7\u5176\u4ED6\u4EBA\u5148\u79BB\u5F00\u3002"));
      root.appendChild(footer(app, { onRules: function() {
        game2.openRules("online");
      }, note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u5404\u6263\u5404\u7684" }));
      return root;
    }
    if (online2.hostId() === "") {
      const missing = app.el("div", "rt-empty");
      missing.appendChild(app.el("p", null, "\u8FD9\u4E2A\u623F\u95F4\u6CA1\u6709\u5F00\u5C40\u6743\u5A01\u3002"));
      missing.appendChild(app.el("p", "rt-tiny", "\u516C\u7F51\u623F\u95F4\u670D\u52A1\u5668\u9700\u8981\u914D\u7F6E\u6743\u5A01\u8FDB\u7A0B\uFF1B\u5C40\u57DF\u7F51\u8BF7\u8BA9\u623F\u4E3B\u5EFA\u623F\u3002"));
      root.appendChild(missing);
      root.appendChild(footer(app, { onRules: function() {
        game2.openRules("online");
      }, note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u5404\u6263\u5404\u7684" }));
      return root;
    }
    if (other === null) {
      root.appendChild(app.el("p", "rt-online-note", "\u7B49\u53E6\u4E00\u4F4D\u670B\u53CB\u8FDB\u623F\u95F4\u3002\u4E24\u4E2A\u4EBA\u90FD\u5230\u4E86\u624D\u80FD\u5F00\u5C40\u3002"));
      root.appendChild(action(app, "dp-btn rt-wide", { "data-op": "online-refresh" }, "\u5237\u65B0", function() {
        online2.refresh();
      }));
      root.appendChild(footer(app, { onRules: function() {
        game2.openRules("online");
      }, note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u5404\u6263\u5404\u7684" }));
      return root;
    }
    if (online2.roomHost()) {
      root.appendChild(hostSettings(app, online2, data));
    } else {
      const wait = app.el("div", "rt-empty");
      wait.appendChild(app.el("p", null, "\u7B49\u623F\u4E3B\u8BBE\u7F6E\u5E76\u521B\u5EFA\u724C\u684C\u3002"));
      wait.appendChild(app.el("p", "rt-tiny", "\u623F\u4E3B\u521B\u5EFA\u540E\u4F1A\u81EA\u52A8\u8FDB\u5165\u724C\u684C\u3002"));
      wait.appendChild(action(app, "dp-btn rt-wide", { "data-op": "online-refresh" }, "\u5237\u65B0", function() {
        online2.refresh();
      }));
      root.appendChild(wait);
    }
    if (online2.ui.error !== "") root.appendChild(app.el("p", "rt-online-note rt-online-error", online2.ui.error));
    root.appendChild(footer(app, { onRules: function() {
      game2.openRules("online");
    }, note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u5404\u6263\u5404\u7684" }));
    return root;
  }
  function settingRow(app, online2, label, values, current, key) {
    const row = app.el("div", "rt-setting");
    row.appendChild(app.el("span", "rt-setting-label", label));
    const chips = app.el("div", "rt-chips");
    for (const value of values) {
      chips.appendChild(chip(app, typeof value === "number" ? money(value) : value.label, current === value.key, function() {
        online2.setSetting(key, value.key);
      }, { "data-op": "online-" + key + "-" + value.key }));
    }
    row.appendChild(chips);
    return row;
  }
  function hostSettings(app, online2, data) {
    const box = app.el("div", "rt-settings");
    const s = online2.ui.settings;
    box.appendChild(settingRow(app, online2, "\u547D\u6570", [{ key: 1, label: "1 \u6761" }, { key: 3, label: "3 \u6761" }], s.lives, "lives"));
    box.appendChild(settingRow(app, online2, "\u8D5B\u5236", [{ key: "single", label: "\u5355\u5C40" }, { key: "bestOf3", label: "\u4E09\u5C40\u4E24\u80DC" }], s.format, "format"));
    const loads = [];
    for (let value = 1; value <= 5; value += 1) loads.push({ key: value, label: value + " \u53D1" });
    box.appendChild(settingRow(app, online2, "\u88C5\u5F39", loads, s.loadCount, "loadCount"));
    const stakes = STAKE_CHOICES.filter((value) => value >= ONLINE_STAKE_MIN && value <= ONLINE_STAKE_MAX);
    box.appendChild(settingRow(app, online2, "\u5E95\u6CE8", stakes.map((value) => ({ key: value, label: money(value) })), s.stake, "stake"));
    const start = action(app, "dp-btn rt-primary rt-wide", { "data-op": "online-create" }, online2.ui.waiting ? "\u6B63\u5728\u5F00\u5C40\u2026" : "\u521B\u5EFA\u724C\u684C", function() {
      online2.createTable();
    });
    if (online2.ui.waiting) start.disabled = true;
    if (Number.isFinite(data.coins) && data.coins < s.stake) {
      start.disabled = true;
      box.appendChild(app.el("p", "rt-online-note", "\u91D1\u5E01\u4E0D\u591F\u672C\u5C40\u5E95\u6CE8\u3002"));
    }
    box.appendChild(start);
    box.appendChild(app.el("p", "rt-tiny", "\u5F00\u5C40\u540E\u53CC\u65B9\u5404\u6263\u672C\u5C40\u5E95\u6CE8\uFF1B\u4E2D\u9014\u5173\u95ED\u5927\u7A97\u53E3\u5373\u7ED3\u675F\u5BF9\u5C40\u3002"));
    return box;
  }
  function renderOnlineResult(app, online2, view, seat) {
    const mine = view.seats[seat] ?? { paid: 0, fees: 0 };
    const them = view.seats[seat === "host" ? "guest" : "host"] ?? { paid: 0, fees: 0 };
    const cancelled = view.outcome === "cancelled";
    const win = view.winner === seat;
    const net = cancelled ? 0 : online2.ui.net ?? (win ? view.pot : 0) - mine.paid - mine.fees;
    const card = app.el("div", "rt-result " + (net >= 0 ? "rt-result-win" : "rt-result-lose"));
    card.appendChild(app.el("div", "rt-result-kicker", "\u672C\u573A\u7ED3\u675F"));
    card.appendChild(app.el("div", "rt-result-title", cancelled ? "\u672C\u573A\u53D6\u6D88" : win ? "\u4F60\u8D62\u4E86" : "\u4F60\u8F93\u4E86"));
    card.appendChild(app.el("div", "rt-result-net", (net > 0 ? "+" : net < 0 ? "-" : "") + money(Math.abs(net))));
    card.appendChild(app.el("div", "rt-result-label", net > 0 ? "\u672C\u573A\u51C0\u6536" : net < 0 ? "\u672C\u573A\u51C0\u4ED8" : "\u672C\u573A\u6253\u5E73"));
    const meta = app.el("div", "rt-result-meta");
    meta.appendChild(app.el("span", null, "\u5E95\u6C60 " + money(view.pot)));
    meta.appendChild(app.el("span", null, "\u4E0B\u6CE8 " + money(mine.paid)));
    if (mine.fees > 0) meta.appendChild(app.el("span", null, "\u8BA9\u67AA\u4ED8 " + money(mine.fees)));
    if (them.fees > 0) meta.appendChild(app.el("span", null, "\u5BF9\u624B\u8BA9\u67AA\u5165\u6C60 " + money(them.fees)));
    card.appendChild(meta);
    if (online2.ui.opponentGone) card.appendChild(app.el("p", "rt-tiny", "\u5BF9\u624B\u5DF2\u7ECF\u79BB\u5F00\uFF0C\u5E95\u6C60\u5224\u7ED9\u4F60\u3002"));
    return card;
  }
  function statusText2(view, seat, opponentName) {
    if (view.stage === "arming") {
      return seat === "host" ? "\u88C5 " + view.bulletCount + " \u53D1\u3002\u70B9\u4E00\u4E2A\u5F39\u5B54\uFF0C\u968F\u540E\u5F3A\u5236\u8F6C\u8F6E\u3002" : "\u623F\u4E3B\u88C5\u5F39\u4E2D\u2026";
    }
    if (view.stage === "ai") return "\u7B49" + opponentName + "\u884C\u52A8\u2026";
    if (view.stage === "choice") {
      if (view.mustShoot === seat) return "\u5BF9\u624B\u56DE\u8BA9\uFF0C\u4F60\u5FC5\u987B\u5F00\u67AA\u3002";
      if (view.passBy !== "" && view.passBy !== seat) return "\u5BF9\u624B\u8BA9\u67AA\uFF1A\u5F00\u67AA\uFF0C\u6216\u56DE\u8BA9\u8BA9\u5B83\u5F00\u67AA\u3002";
      return view.turn === seat ? "\u8F6E\u5230\u4F60\uFF1A\u5BF9\u81EA\u5DF1\u5F00\u67AA\uFF0C\u6216\u8BA9\u67AA\u3002" : "\u7B49" + opponentName + "\u884C\u52A8\u2026";
    }
    if (view.stage === "roundOver") return "\u672C\u5C40\u7ED3\u675F\u3002";
    if (view.stage === "matchOver") return view.winner === seat ? "\u4F60\u8D62\u4E0B\u6574\u573A\uFF0C\u5E95\u6C60\u5DF2\u7ED3\u7B97\u3002" : "\u5BF9\u624B\u8D62\u4E0B\u6574\u573A\uFF0C\u5E95\u6C60\u5DF2\u7ED3\u7B97\u3002";
    return "\u51C6\u5907\u4E2D\u2026";
  }
  function renderOnlineDock(app, online2, view, seat, data, opponentName) {
    const dock = app.el("div", "rt-dock");
    if (online2.ui.leaveConfirm) {
      const confirm = app.el("div", "rt-confirm");
      confirm.appendChild(app.el("b", null, "\u786E\u8BA4\u79BB\u5F00\u724C\u684C\uFF1F"));
      confirm.appendChild(app.el("p", null, "\u672C\u573A\u89C6\u4E3A\u8BA4\u8F93\uFF0C\u5E95\u6C60\u5F52" + opponentName + "\uFF0C\u5DF2\u4E0B\u7684\u5E95\u6CE8\u4E0D\u9000\u3002"));
      const buttons = app.el("div", "rt-actions");
      buttons.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "online-cancel-leave" }, "\u7EE7\u7EED\u6253", function() {
        online2.cancelLeave();
      }));
      buttons.appendChild(action(app, "dp-btn rt-danger rt-wide", { "data-op": "online-confirm-leave" }, "\u786E\u8BA4\u79BB\u5F00", function() {
        online2.confirmLeave();
      }));
      dock.appendChild(buttons);
      return dock;
    }
    const actions = app.el("div", "rt-actions");
    function primary(label, op, handler, disabled) {
      const node = action(app, "dp-btn rt-primary rt-wide", { "data-op": op }, label, handler);
      if (disabled) node.disabled = true;
      actions.appendChild(node);
      return node;
    }
    if (view.stage === "arming") {
      if (seat === "host") {
        primary("\u968F\u673A\u88C5\u5F39", "online-arm-random", function() {
          online2.randomArm();
        });
        actions.appendChild(app.el("div", "rt-hint", "\u4E5F\u53EF\u4EE5\u76F4\u63A5\u70B9\u5F39\u5B54 \xB7 \u88C5\u5B8C\u5F3A\u5236\u8F6C\u8F6E"));
      } else {
        primary("\u623F\u4E3B\u88C5\u5F39\u4E2D\u2026", "online-arm-wait", function() {
        }, true);
      }
    } else if (view.stage === "choice") {
      if (view.turn !== seat) {
        primary("\u7B49" + opponentName + "\u884C\u52A8\u2026", "online-wait", function() {
        }, true);
      } else {
        actions.appendChild(action(app, "dp-btn rt-danger", { "data-op": "online-shoot" }, "\u5BF9\u81EA\u5DF1\u5F00\u67AA", function() {
          online2.fire();
        }));
        const fee = passFee(view.settings.stake);
        const forced = view.mustShoot === seat;
        const passBtn = action(app, "dp-btn", { "data-op": "online-pass" }, "\u8BA9\u67AA \xB7 \u4ED8 " + money(fee), function() {
          online2.pass();
        });
        if (forced || data.coins < fee) passBtn.disabled = true;
        actions.appendChild(passBtn);
        const hint = forced ? "\u5BF9\u624B\u56DE\u8BA9\uFF0C\u4F60\u53EA\u80FD\u5F00\u67AA" : data.coins < fee ? "\u91D1\u5E01\u4E0D\u591F\u8BA9\u67AA\u8D39\uFF0C\u53EA\u80FD\u5F00\u67AA" : view.passBy !== "" ? "\u56DE\u8BA9\u4F1A\u8BA9\u67AA\u56DE\u5230" + opponentName + "\uFF0C\u5BF9\u65B9\u5FC5\u987B\u5F00\u67AA" : "\u8BA9\u67AA\u8D39\u8FDB\u5E95\u6C60\uFF0C\u672C\u56DE\u5408\u7ED3\u675F";
        actions.appendChild(app.el("div", "rt-hint", hint));
      }
    } else if (view.stage === "roundOver") {
      if (seat === "host") {
        const load = app.el("div", "rt-next-load");
        load.appendChild(app.el("span", "rt-bet-label", "\u4E0B\u4E00\u5C40\u88C5\u5F39"));
        const row = app.el("div", "rt-chips");
        const current = online2.ui.settings.loadCount;
        for (let value = 1; value <= 5; value += 1) {
          row.appendChild(chip(app, value + " \u53D1", current === value, function() {
            online2.setSetting("loadCount", value);
          }, { "data-op": "online-next-load-" + value }));
        }
        load.appendChild(row);
        actions.appendChild(load);
        primary("\u4E0B\u4E00\u5C40", "online-next", function() {
          online2.next();
        });
      } else {
        primary("\u7B49\u623F\u4E3B\u5F00\u4E0B\u4E00\u5C40", "online-next-wait", function() {
        }, true);
      }
    } else if (view.stage === "matchOver") {
      if (seat === "host") {
        primary("\u518D\u6765\u4E00\u573A", "online-again", function() {
          online2.createTable();
        });
        actions.appendChild(app.el("div", "rt-hint", "\u5BF9\u624B\u8FD8\u5728\u623F\u95F4\u91CC\u5C31\u80FD\u76F4\u63A5\u5F00\u65B0\u4E00\u573A"));
      } else {
        primary("\u7B49\u623F\u4E3B\u518D\u6765\u4E00\u573A", "online-again-wait", function() {
        }, true);
        actions.appendChild(app.el("div", "rt-hint", "\u60F3\u9000\u51FA\u53EF\u4EE5\u70B9\u4E0A\u65B9\u8FD4\u56DE\u5927\u5385"));
      }
    }
    dock.appendChild(actions);
    return dock;
  }
  function renderOnlineTable(app, online2, game2) {
    const data = game2.data();
    const view = online2.ui.matchView;
    if (!isObject2(view)) {
      const root2 = app.el("div", "rt-page rt-online");
      root2.appendChild(pageHead(app, data, "\u8054\u673A\u724C\u684C", "1v1", "\u8FD4\u56DE\u5927\u5385", function() {
        online2.back();
      }));
      root2.appendChild(app.el("p", "rt-online-note", "\u8FD8\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u5BF9\u5C40\u3002"));
      root2.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "online-back-lobby" }, "\u56DE\u5230\u8054\u673A\u5927\u5385", function() {
        online2.back();
      }));
      return root2;
    }
    const room = online2.ui.room;
    const selfId = room !== null ? room.selfId : "";
    const seat = view.hostId === selfId ? "host" : "guest";
    const opponentName = nameOf(room, view.hostId === selfId ? view.guestId : view.hostId);
    const mapped = mapMatch(data, view, seat);
    const root = app.el("div", "rt-page rt-table rt-online-table");
    const sub = "\u7B2C " + view.round + " \u5C40 \xB7 " + (view.settings.format === "bestOf3" ? "\u4E09\u5C40\u4E24\u80DC" : "\u5355\u5C40") + " \xB7 \u5BF9\u624B " + opponentName;
    root.appendChild(pageHead(app, data, "\u8054\u673A\u724C\u684C", sub, "\u8FD4\u56DE\u5927\u5385", function() {
      online2.requestLeave();
    }));
    root.appendChild(renderMeta(app, mapped));
    root.appendChild(renderLives(app, mapped, opponentName));
    if (view.stage === "matchOver") {
      root.appendChild(renderOnlineResult(app, online2, view, seat));
    } else {
      root.appendChild(renderBoard(app, { ui: online2.ui, load: function(index) {
        online2.arm(index);
      } }, mapped, seat === "host"));
      const status = app.el("div", "rt-status", statusText2(view, seat, opponentName));
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      root.appendChild(status);
    }
    if (online2.ui.error !== "") root.appendChild(app.el("p", "rt-online-note rt-online-error", online2.ui.error));
    root.appendChild(renderOnlineDock(app, online2, view, seat, data, opponentName));
    root.appendChild(footer(app, {
      onRules: function() {
        game2.openRules("table");
      },
      note: "\u771F\u5B9E\u91D1\u5E01 \xB7 \u8BA9\u67AA\u4ED8 50% \u8FDB\u5E95\u6C60"
    }));
    return root;
  }

  // src/extensions/roulette/client/styles.js
  var CSS = [
    ".rt{position:relative;box-sizing:border-box;height:var(--ext-panel-height,505px);padding:2px 2px 3px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;display:flex;flex-direction:column;color:var(--ac-text,#794f27);font-size:12px;line-height:1.35}",
    ".rt *{box-sizing:border-box}",
    ".rt-page{position:relative;display:flex;flex-direction:column;gap:4px;flex-shrink:0}",
    ".rt-head{display:flex;align-items:center;gap:7px;min-height:30px}",
    ".rt-back{display:flex;align-items:center;justify-content:center;height:26px;min-width:52px;flex-shrink:0;padding:0 8px 0 15px;border-radius:var(--ac-pill,50px);border:2px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-input,#fffbe7);color:var(--ac-text,#794f27);font:inherit;font-size:10px;font-weight:700;line-height:1;box-shadow:var(--ac-shadow-sm,0 2px 4px rgba(61,52,40,.06));cursor:pointer;position:relative}",
    '.rt-back:before{content:"";position:absolute;left:7px;top:9px;width:6px;height:6px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg)}',
    ".rt-back:hover{border-color:var(--ac-primary,#19c8b9);color:var(--ac-primary-active,#11a89b)}",
    ".rt-brand{min-width:0;flex:1}",
    ".rt-title{font-size:14px;line-height:1.15;font-weight:800;color:var(--ac-text,#794f27);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rt-sub{font-size:9px;line-height:1.2;color:var(--ac-text-muted,#8a7b66);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rt-vault{display:flex;align-items:center;gap:4px;flex-shrink:0;padding:4px 7px;border-radius:var(--ac-pill,50px);border:2px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-input,#fffbe7);font-size:9px;font-weight:700;font-variant-numeric:tabular-nums}",
    ".rt-vault small{font-size:8px;color:var(--ac-text-muted,#8a7b66);font-weight:600}",
    ".rt-vault b{font-size:10px;color:var(--ac-text,#794f27)}",
    ".rt-coin{width:10px;height:10px;flex-shrink:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f8df9e,#d9a441 60%,#b7791f);border:1px solid #b7791f;position:relative}",
    '.rt-coin:after{content:"";position:absolute;left:2px;top:2px;width:2px;height:4px;border-radius:50%;background:#fff6d8;transform:rotate(24deg)}',
    ".rt-topline{display:flex;align-items:center;gap:6px;min-height:26px}",
    ".rt-kicker{font-size:9px;font-weight:700;letter-spacing:.1em;color:var(--ac-text-muted,#8a7b66);padding-left:2px}",
    ".rt-hero{position:relative;height:170px;flex-shrink:0;border-radius:17px;overflow:hidden;border:2px solid var(--ac-border-light,#e5dcc6);background:radial-gradient(circle at 42% 34%,#fffef8 0%,#e8fbf6 48%,#d3f4ed 100%);display:grid;place-items:center}",
    '.rt-hero:before{content:"";position:absolute;inset:8px;border:1px dashed rgba(15,156,145,.22);border-radius:12px;pointer-events:none}',
    ".rt-hero-glow{position:absolute;width:170px;height:105px;border-radius:50%;background:#fff;opacity:.55;filter:blur(8px)}",
    ".rt-hero-table{position:absolute;width:186px;height:186px;object-fit:cover;opacity:.28;filter:saturate(.8)}",
    ".rt-hero-gun{position:relative;z-index:2;width:170px;transform:rotate(-7deg);filter:drop-shadow(0 8px 6px rgba(91,66,38,.2))}",
    ".rt-hero-chip{position:absolute;z-index:3;width:34px;filter:drop-shadow(0 2px 2px rgba(91,66,38,.16))}",
    ".rt-hero-chip-a{left:12px;bottom:7px;transform:rotate(-14deg)}",
    ".rt-hero-chip-b{right:14px;top:8px;width:26px;transform:rotate(13deg);opacity:.9}",
    ".rt-hero-tag{position:absolute;z-index:4;left:10px;top:9px;padding:4px 10px;border-radius:9px;background:#f5c31c;color:#6d471a;font-size:10px;font-weight:900;letter-spacing:.02em;box-shadow:0 2px 0 #c99a12;transform:rotate(-3deg)}",
    ".rt-enter{min-height:44px;margin-top:2px;font-size:13px;letter-spacing:.04em}",
    ".rt-ammo{display:flex;align-items:center;gap:3px;padding:2px 7px 2px 4px;border-radius:var(--ac-pill,50px);border:2px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-input,#fffbe7);font-size:9px;color:var(--ac-text-body,#725d42);white-space:nowrap}",
    ".rt-ammo img{width:7px;height:15px;display:block}",
    ".rt-ammo b{font-size:10px;color:var(--ac-text,#794f27)}",
    ".rt-hero .rt-ammo{position:absolute;right:8px;bottom:8px;z-index:4}",
    ".rt-menu-label{font-size:9px;letter-spacing:.12em;color:var(--ac-text-muted,#8a7b66);font-weight:700;padding:0 2px 1px}",
    ".rt-menu{display:grid;gap:6px}",
    ".rt-mode{display:flex;align-items:center;gap:8px;width:100%;min-height:50px;padding:6px 9px;border:2px solid var(--ac-border-light,#e5dcc6);border-radius:15px;background:var(--ac-bg-input,#fffbe7);color:var(--ac-text,#794f27);text-align:left;font:inherit;cursor:pointer;box-shadow:var(--ac-shadow-sm,0 2px 4px rgba(61,52,40,.06));transition:all .16s var(--ac-ease,ease)}",
    ".rt-mode:hover:not(:disabled){transform:translateY(-1px);border-color:var(--ac-border-hover,#a89878);box-shadow:var(--ac-shadow,0 3px 10px rgba(61,52,40,.1))}",
    ".rt-mode:active:not(:disabled){transform:translateY(1px);box-shadow:none}",
    ".rt-mode:focus-visible{outline:2px solid var(--ac-primary,#19c8b9);outline-offset:1px}",
    ".rt-mode-primary{background:var(--ac-primary-bg,#e6f9f6);border-color:var(--ac-primary,#19c8b9)}",
    ".rt-mode-primary:hover:not(:disabled){background:#e9fbf7;border-color:var(--ac-primary-active,#11a89b)}",
    ".rt-mode-locked{opacity:.62;cursor:not-allowed}",
    ".rt-medal{width:32px;height:32px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:#fff7e6;border:2px solid var(--ac-border-light,#e5dcc6)}",
    ".rt-mode-primary .rt-medal{background:#fff;border-color:#b9e6df}",
    ".rt-medal img{width:38px;height:38px;object-fit:contain;display:block}",
    ".rt-medal-grid{display:grid;grid-template-columns:8px 8px;grid-template-rows:8px 8px;gap:2px}",
    ".rt-medal-grid i{width:8px;height:8px;border-radius:3px;background:var(--ac-primary,#19c8b9)}",
    ".rt-medal-grid i:nth-child(2){background:#d96b5f}",
    ".rt-medal-grid i:nth-child(3){background:#d9a441}",
    ".rt-medal-grid i:nth-child(4){background:#94a9b0}",
    ".rt-mode-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}",
    ".rt-mode-name{font-size:12px;font-weight:700;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rt-mode-note{font-size:8.5px;line-height:1.2;color:var(--ac-text-muted,#8a7b66);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rt-mode-primary .rt-mode-note{color:var(--ac-text-body,#725d42)}",
    ".rt-mode-side{display:flex;align-items:center;flex-shrink:0;gap:4px;color:var(--ac-text-2,#9f927d)}",
    ".rt-chev{width:6px;height:6px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg);opacity:.6;margin-right:1px}",
    ".rt-lock{position:relative;display:inline-block;width:9px;height:7px;border:2px solid currentColor;border-radius:2px;opacity:.7}",
    '.rt-lock:before{content:"";position:absolute;left:1px;top:-6px;width:3px;height:6px;border:2px solid currentColor;border-bottom:0;border-radius:4px 4px 0 0}',
    ".rt-foot{display:flex;align-items:center;gap:6px;min-height:22px;padding:1px 2px 0}",
    ".rt-link{appearance:none;border:0;background:transparent;padding:2px 1px;font:inherit;font-size:9.5px;color:var(--ac-text-muted,#8a7b66);cursor:pointer;text-decoration:underline;text-underline-offset:2px}",
    ".rt-link:hover{color:var(--ac-primary-active,#11a89b)}",
    ".rt-spacer{flex:1}",
    ".rt-tiny{font-size:8.5px;color:var(--ac-text-muted,#8a7b66)}",
    ".rt-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:10px 6px}",
    ".rt-empty p{margin:0;font-size:10.5px;line-height:1.5;color:var(--ac-text-body,#725d42)}",
    ".rt-room{display:flex;flex-direction:column;gap:4px;padding:7px 8px;background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);border-radius:14px}",
    ".rt-room-head{display:flex;align-items:center;justify-content:space-between;gap:6px}",
    ".rt-room-code{font-size:13px;font-weight:800;letter-spacing:.08em}",
    ".rt-badge{padding:2px 7px;border-radius:8px;background:var(--ac-primary-bg,#e6f9f6);font-size:8.5px;font-weight:700;color:var(--ac-primary-active,#11a89b)}",
    ".rt-player{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 2px;font-size:10.5px}",
    ".rt-player-self b{color:var(--ac-primary-active,#11a89b)}",
    ".rt-online-note{margin:0;padding:2px 4px;font-size:9.5px;line-height:1.45;color:var(--ac-text-body,#725d42)}",
    ".rt-online-error{color:#b55146}",
    ".rt-meta{display:flex;align-items:center;gap:6px;min-height:26px}",
    ".rt-meta-left{display:flex;align-items:center;gap:4px;flex:1;min-width:0}",
    ".rt-meta-tag{padding:3px 8px;border-radius:8px;border:1.5px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-input,#fffbe7);font-size:9px;font-weight:700;color:var(--ac-text-body,#725d42);white-space:nowrap}",
    ".rt-meta-score{color:var(--ac-primary-active,#11a89b)}",
    ".rt-livesbar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;padding:0 4px;min-height:24px}",
    ".rt-lives-side{display:flex;align-items:center;gap:4px;min-width:0;font-size:10px;color:var(--ac-text,#794f27)}",
    ".rt-lives-you{justify-content:flex-end}",
    ".rt-lives-score{font-size:11px;font-weight:800;color:var(--ac-text,#794f27);font-variant-numeric:tabular-nums}",
    ".rt-vault-line{justify-content:space-between}",
    ".rt-vault-line .rt-vault{margin-left:auto}",
    ".rt-players{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:stretch}",
    ".rt-pcard{display:flex;align-items:center;gap:5px;min-width:0;padding:5px 6px;background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);border-radius:14px}",
    ".rt-pcard-you{flex-direction:row-reverse;text-align:right}",
    ".rt-avatar{width:30px;height:30px;flex-shrink:0;border-radius:50%;overflow:hidden;background:var(--ac-primary-bg,#e6f9f6);border:2px solid #fff;display:grid;place-items:center;font-size:18px}",
    ".rt-pcard-ai .rt-avatar{background:#ffe9c9}",
    ".rt-avatar img{width:38px;height:38px;object-fit:contain;display:block}",
    ".rt-pwho{min-width:0;flex:1}",
    ".rt-pname{font-size:11px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rt-prole{font-size:8.5px;line-height:1.2;color:var(--ac-text-muted,#8a7b66);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".rt-pips{display:flex;gap:2px;margin-top:2px}",
    ".rt-pcard-you .rt-pips{justify-content:flex-end}",
    ".rt-pip{width:6px;height:6px;border-radius:50%;background:#fff;border:1px solid #cdbb9c}",
    ".rt-pcard-you .rt-pip-on{background:var(--ac-primary,#19c8b9);border-color:var(--ac-primary-active,#11a89b)}",
    ".rt-pcard-ai .rt-pip-on{background:#d96b5f;border-color:#b55146}",
    ".rt-score{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:40px;padding:3px 4px;background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);border-radius:14px}",
    ".rt-score b{font-size:15px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}",
    ".rt-score small{font-size:7.5px;color:var(--ac-text-muted,#8a7b66);margin-top:2px;white-space:nowrap}",
    ".rt-board{position:relative;height:218px;flex-shrink:0;border-radius:18px;overflow:hidden;border:2px solid var(--ac-border-light,#e5dcc6);background:radial-gradient(circle at 42% 34%,#f7fffc 0%,#e3faf4 46%,#cff2ea 100%);display:grid;place-items:center}",
    '.rt-board:before{content:"";position:absolute;inset:9px;border:1px dashed rgba(15,156,145,.24);border-radius:12px;pointer-events:none}',
    '.rt-board:after{content:"";position:absolute;width:170px;height:120px;border-radius:50%;background:#fff;opacity:.35;filter:blur(10px);pointer-events:none}',
    ".rt-board-table{position:absolute;width:176px;height:176px;object-fit:cover;opacity:.18;pointer-events:none}",
    ".rt-pot{display:flex;align-items:center;gap:4px;padding:2px 9px 2px 4px;border-radius:var(--ac-pill,50px);background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);font-size:9px;color:var(--ac-text-body,#725d42);white-space:nowrap}",
    ".rt-pot img{width:19px;height:19px;display:block;filter:drop-shadow(0 1px 1px rgba(91,66,38,.18))}",
    ".rt-pot b{font-size:12px;color:var(--ac-text,#794f27);font-variant-numeric:tabular-nums}",
    ".rt-cyl-wrap{position:relative;z-index:3;width:150px;height:150px;display:grid;place-items:center}",
    ".rt-cyl{position:relative;z-index:1;width:150px;display:block;filter:drop-shadow(0 7px 6px rgba(91,66,38,.18))}",
    ".rt-primer{position:absolute;z-index:5;left:calc(50% + var(--x,0px));top:calc(50% + var(--y,0px));width:24px;height:24px;margin:-12px;object-fit:contain;pointer-events:none;opacity:0;filter:drop-shadow(0 1px 1px rgba(91,66,38,.25))}",
    ".rt-primer-show{opacity:1;animation:rt-seat .28s cubic-bezier(.4,0,.2,1) both}",
    ".rt-primer-on{opacity:1}",
    ".rt-hole{position:absolute;z-index:6;left:calc(50% + var(--x,0px));top:calc(50% + var(--y,0px));width:26px;height:26px;margin:-13px;padding:0;border-radius:50%;border:2px solid transparent;background:transparent;opacity:0;pointer-events:none;cursor:default;appearance:none;transition:background .16s, border-color .16s, transform .16s}",
    ".rt-board-arming .rt-hole{opacity:1;pointer-events:auto;cursor:pointer;border-color:rgba(25,200,185,.55);background:rgba(255,254,248,.32);animation:rt-hole-pulse 1.25s ease-in-out infinite}",
    ".rt-board-arming .rt-hole:hover,.rt-board-arming .rt-hole:focus-visible{border-color:var(--ac-primary,#19c8b9);background:rgba(25,200,185,.2);outline:none;transform:scale(1.14)}",
    ".rt-hole:focus-visible{outline:2px solid var(--ac-primary,#19c8b9);outline-offset:2px}",
    ".rt-board-ammo{position:absolute;z-index:5;left:9px;bottom:9px}",
    ".rt-board-chips{position:absolute;z-index:5;right:8px;bottom:7px;width:34px;transform:rotate(8deg);filter:drop-shadow(0 2px 2px rgba(91,66,38,.16))}",
    ".rt-flash{position:absolute;inset:0;z-index:6;opacity:0;pointer-events:none;background:radial-gradient(circle at 50% 48%,#fff,rgba(255,255,255,0) 68%)}",
    ".rt-board-fire .rt-flash{animation:rt-flash .42s ease-out both}",
    ".rt-board-live .rt-flash{background:radial-gradient(circle at 50% 48%,#ffe0d6,rgba(217,107,95,.55) 36%,rgba(217,107,95,0) 70%)}",
    ".rt-board-fire .rt-cyl-wrap{animation:rt-kick .32s ease-out both}",
    ".rt-cyl-spin{animation:rt-spin .9s cubic-bezier(.4,0,.2,1)}",
    ".rt-status{min-height:16px;text-align:center;font-size:10.5px;line-height:16px;color:var(--ac-text-body,#725d42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}",
    ".rt-dock{display:grid;gap:6px;padding:8px;border-radius:16px;background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6)}",
    ".rt-bet{display:flex;align-items:center;gap:4px;min-height:28px}",
    ".rt-bet-label{font-size:9px;color:var(--ac-text-muted,#8a7b66);flex-shrink:0}",
    ".rt-step{width:28px;height:28px;padding:0;border-radius:50%;border:2px solid var(--ac-border,#c4b89e);background:var(--ac-bg-input,#fffbe7);color:var(--ac-text,#794f27);font:inherit;font-size:16px;line-height:1;font-weight:700;display:grid;place-items:center;box-shadow:var(--ac-shadow-sm,0 2px 4px rgba(61,52,40,.06));cursor:pointer}",
    ".rt-step:hover:not(:disabled){border-color:var(--ac-primary,#19c8b9);color:var(--ac-primary,#19c8b9)}",
    ".rt-step:disabled{opacity:.4;cursor:not-allowed}",
    ".rt-stake{font-size:13px;font-weight:800;min-width:56px;text-align:center;font-variant-numeric:tabular-nums}",
    ".rt-bet-note{margin-left:auto;text-align:right;font-size:8.5px;line-height:1.25;color:var(--ac-text-muted,#8a7b66);max-width:126px}",
    ".rt-bet-note b{color:var(--ac-text-body,#725d42)}",
    ".rt-warn{color:#b55146;font-weight:700}",
    ".rt-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-content:center;min-height:40px}",
    ".rt-actions .dp-btn{min-height:40px;font-size:12px;padding:5px 8px;min-width:0;white-space:nowrap}",
    ".rt-wide{grid-column:span 2}",
    ".rt-primary.dp-btn{background:var(--ac-primary,#19c8b9);border-color:var(--ac-primary,#19c8b9);color:#fff;box-shadow:0 5px 0 var(--ac-primary-active,#0f9c91),inset 0 1px 0 rgba(255,255,255,.25);font-size:13px;font-weight:600;min-height:45px;border-radius:var(--ac-pill,50px)}",
    ".rt-primary.dp-btn:hover:not(:disabled){background:var(--ac-primary-hover,#3dd4c6);border-color:var(--ac-primary-hover,#3dd4c6);color:#fff;transform:translateY(-1px);box-shadow:0 6px 0 var(--ac-primary-active,#0f9c91),inset 0 1px 0 rgba(255,255,255,.25)}",
    ".rt-primary.dp-btn:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 var(--ac-primary-active,#0f9c91),inset 0 1px 0 rgba(255,255,255,.25)}",
    ".rt-danger.dp-btn{background:#e05a5a;border-color:#e05a5a;color:#fff;box-shadow:0 5px 0 #c94444,inset 0 1px 0 rgba(255,255,255,.2)}",
    ".rt-danger.dp-btn:hover:not(:disabled){background:#e86b6b;border-color:#e86b6b;color:#fff;transform:translateY(-1px);box-shadow:0 6px 0 #c94444,inset 0 1px 0 rgba(255,255,255,.2)}",
    ".rt-danger.dp-btn:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #c94444,inset 0 1px 0 rgba(255,255,255,.2)}",
    ".rt-hint{grid-column:span 2;text-align:center;font-size:8.5px;line-height:1.3;color:var(--ac-text-muted,#8a7b66);padding:0 2px}",
    ".rt-next-load{grid-column:span 2;display:grid;gap:4px}",
    ".rt-next-load .rt-chips{display:flex;gap:4px;flex:1;min-width:0}",
    ".rt-next-load .rt-chip{flex:1 1 0;min-width:0;padding-left:2px;padding-right:2px}",
    ".rt-confirm{display:flex;flex-direction:column;gap:4px;text-align:center;padding:2px}",
    ".rt-confirm b{font-size:13px;color:#b55146}",
    ".rt-confirm p{margin:0;font-size:10px;line-height:1.45;color:var(--ac-text-body,#725d42)}",
    ".rt-result{position:relative;min-height:218px;flex-shrink:0;border-radius:18px;overflow:hidden;border:2px solid var(--ac-border-light,#e5dcc6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:16px 12px;text-align:center}",
    '.rt-result:before{content:"";position:absolute;inset:9px;border:1px dashed rgba(15,156,145,.24);border-radius:12px;pointer-events:none}',
    ".rt-result-win{background:radial-gradient(circle at 50% 34%,#fffef8 0%,#e3faf4 58%,#cff2ea 100%)}",
    ".rt-result-lose{background:radial-gradient(circle at 50% 34%,#fffaf4 0%,#ffe9df 58%,#f3d2c4 100%)}",
    ".rt-result-kicker{position:relative;font-size:9px;font-weight:800;letter-spacing:.16em;color:var(--ac-text-muted,#8a7b66)}",
    ".rt-result-title{position:relative;font-size:19px;font-weight:900;line-height:1.2;color:var(--ac-text,#794f27)}",
    ".rt-result-net{position:relative;font-size:28px;font-weight:900;line-height:1.1;margin-top:2px;font-variant-numeric:tabular-nums}",
    ".rt-result-win .rt-result-net{color:#0f9c91}",
    ".rt-result-lose .rt-result-net{color:#c94444}",
    ".rt-result-label{position:relative;font-size:9.5px;font-weight:700;color:var(--ac-text-muted,#8a7b66)}",
    ".rt-result-meta{position:relative;display:flex;flex-wrap:wrap;justify-content:center;gap:3px 10px;margin-top:7px;font-size:9px;color:var(--ac-text-body,#725d42)}",
    ".rt-gun-stage{position:relative;height:210px;flex-shrink:0;border-radius:17px;overflow:hidden;display:grid;place-items:center;border:2px solid var(--ac-border-light,#e5dcc6);background:radial-gradient(circle at 42% 30%,#fffef8 0%,#e8fbf6 62%,#d3f4ed 100%)}",
    ".rt-gun-wrap{position:relative;width:214px;height:125px;z-index:2}",
    ".rt-gun-img{width:214px;display:block;transform:rotate(-4deg);filter:drop-shadow(0 8px 7px rgba(91,66,38,.18))}",
    ".rt-gun-ring{position:absolute;left:44%;top:32%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:1.5px dashed rgba(15,156,145,.42);animation:rt-ring 3.6s linear infinite;z-index:3}",
    ".rt-gun-ring i{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px;border-radius:50%;background:#d9a441;border:1px solid #b7791f;box-shadow:0 1px 0 rgba(255,255,255,.35)}",
    ".rt-gun-ring i:nth-child(1){transform:rotate(0deg) translateY(-21px)}",
    ".rt-gun-ring i:nth-child(2){transform:rotate(60deg) translateY(-21px)}",
    ".rt-gun-ring i:nth-child(3){transform:rotate(120deg) translateY(-21px)}",
    ".rt-gun-ring i:nth-child(4){transform:rotate(180deg) translateY(-21px)}",
    ".rt-gun-ring i:nth-child(5){transform:rotate(240deg) translateY(-21px)}",
    ".rt-gun-ring i:nth-child(6){transform:rotate(300deg) translateY(-21px)}",
    ".rt-gun-bullet{position:absolute;right:8px;bottom:8px;z-index:5;display:flex;align-items:center;gap:4px;padding:3px 8px 3px 4px;border:2px solid var(--ac-border-light,#e5dcc6);border-radius:var(--ac-pill,50px);background:var(--ac-bg-input,#fffbe7);color:var(--ac-text-body,#725d42);font:inherit;font-size:9px;font-weight:700;cursor:pointer;box-shadow:var(--ac-shadow-sm,0 2px 4px rgba(61,52,40,.06))}",
    ".rt-gun-bullet img{width:12px;height:30px;display:block;filter:drop-shadow(0 2px 2px rgba(91,66,38,.18))}",
    ".rt-bet-pill{display:flex;align-items:center;justify-content:center;gap:4px;margin:0 auto;padding:3px 10px;border-radius:var(--ac-pill,50px);border:2px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-input,#fffbe7);font-size:10px;color:var(--ac-text-body,#725d42);white-space:nowrap}",
    ".rt-bet-pill b{color:var(--ac-text,#794f27);font-size:12px;font-variant-numeric:tabular-nums}",
    ".rt-load-hint{font-size:9.5px;line-height:1.45;color:var(--ac-text-muted,#8a7b66);text-align:center;padding:0 4px}",
    ".rt-actions-two{grid-template-columns:1fr 1fr}",
    ".rt-rules-card{display:flex;flex-direction:column;gap:7px;padding:10px 11px;border-radius:var(--ac-radius-sm,12px);border:2px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-content,rgb(247,243,223))}",
    ".rt-rules-card h2{font-size:13px;line-height:1.2;margin:0 0 1px;color:var(--ac-text,#794f27)}",
    ".rt-rules-card p,.rt-rules-card li{font-size:10.5px;line-height:1.5;color:var(--ac-text-body,#725d42);margin:0}",
    ".rt-rules-card ul{margin:0;padding-left:15px;display:flex;flex-direction:column;gap:4px}",
    ".rt-rules-card b{color:var(--ac-text,#794f27)}",
    ".rt-rules-note{font-size:9.5px;line-height:1.45;color:var(--ac-text-muted,#8a7b66);margin:0}",
    ".rt-toast{position:absolute;left:8px;right:8px;bottom:8px;z-index:30;padding:7px 11px;border-radius:12px;background:var(--ac-text,#794f27);color:#fff8e8;font-size:10.5px;line-height:1.4;text-align:center;box-shadow:var(--ac-shadow,0 3px 10px rgba(61,52,40,.1));pointer-events:none}",
    ".rt-toast[hidden]{display:none!important}",
    ".rt [hidden]{display:none!important}",
    ".rt-settings{display:grid;gap:7px;margin-top:8px}",
    ".rt-setting{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".rt-setting-label{width:30px;flex:0 0 30px;font-size:9.5px;font-weight:800;color:var(--ac-text-muted,#8a7b66)}",
    ".rt-chips{display:flex;gap:4px;flex-wrap:wrap;flex:1;min-width:0}",
    ".rt-stake-custom{display:flex;gap:4px;flex:0 0 auto;width:calc(100% - 38px);margin-left:38px}",
    ".rt-stake-input{flex:1;min-width:0;padding:4px 7px;border:2px solid var(--ac-border-light,#e5dcc6);border-radius:9px;background:var(--ac-bg-input,#fffbe7);color:var(--ac-text-body,#725d42);font:inherit;font-size:10px;font-weight:700}",
    ".rt-stake-input::placeholder{color:var(--ac-text-muted,#8a7b66);font-weight:600}",
    ".rt-select{flex:1;min-width:0;padding:4px 7px;border:2px solid var(--ac-border-light,#e5dcc6);border-radius:9px;background:var(--ac-bg-input,#fffbe7);color:var(--ac-text-body,#725d42);font:inherit;font-size:10px;font-weight:700}",
    ".rt-chips-4 .rt-chip,.rt-chips-5 .rt-chip{flex:1 1 0;min-width:0}",
    ".rt-chip{padding:5px 8px;font-size:10px;font-weight:700;line-height:1.1;border-radius:9px;border:2px solid var(--ac-border-light,#e5dcc6);background:var(--ac-bg-input,#fffbe7);color:var(--ac-text-body,#725d42);cursor:pointer;white-space:nowrap}",
    ".rt-chip-on{border-color:#19c8b9;background:#d9f7f3;color:#0f6f68;box-shadow:0 2px 0 #0f9c91}",
    ".rt-lives{display:flex;gap:2px;margin-left:auto}",
    ".rt-life{width:7px;height:7px;border-radius:50%;background:var(--ac-bg-disabled,#f0ece2);border:1px solid var(--ac-border-light,#e5dcc6)}",
    ".rt-life-on{background:#e86a63;border-color:#c94444}",
    "@keyframes rt-seat{0%{opacity:0;transform:scale(.3)}60%{opacity:1;transform:scale(1.16)}100%{opacity:1;transform:scale(1)}}",
    "@keyframes rt-hole-pulse{0%,100%{box-shadow:0 0 0 0 rgba(25,200,185,0)}50%{box-shadow:0 0 0 4px rgba(25,200,185,.16)}}",
    "@keyframes rt-spin{0%{transform:rotate(0) scale(1)}55%{transform:rotate(380deg) scale(1.035)}100%{transform:rotate(720deg) scale(1)}}",
    "@keyframes rt-flash{0%{opacity:0}18%{opacity:.9}100%{opacity:0}}",
    "@keyframes rt-kick{0%{transform:translateY(0) rotate(0)}35%{transform:translateY(-4px) rotate(2deg)}100%{transform:translateY(0) rotate(0)}}",
    "@keyframes rt-ring{to{transform:rotate(360deg)}}",
    "@media (prefers-reduced-motion:reduce){.rt-cyl-spin,.rt-gun-ring,.rt-board-fire .rt-flash,.rt-board-fire .rt-cyl-wrap,.rt-primer-show,.rt-board-arming .rt-hole{animation:none}}"
  ].join("\n");

  // src/extensions/roulette/client/entry.js
  var STYLE_ID = "dsh-piggy-roulette-style";
  var game = null;
  var online = null;
  var activeApp = null;
  function style() {
    const existing = typeof document.getElementById === "function" ? document.getElementById(STYLE_ID) : null;
    if (existing) {
      if (existing.textContent !== CSS) existing.textContent = CSS;
      return;
    }
    const node = document.createElement("style");
    node.id = STYLE_ID;
    node.textContent = CSS;
    (document.head || document.body).appendChild(node);
  }
  function ensureGame() {
    if (game !== null) return game;
    game = createGame({
      getApp: function() {
        return activeApp;
      },
      rerender: function() {
        if (activeApp !== null && typeof activeApp.rerender === "function") activeApp.rerender();
      }
    });
    online = createOnline({
      getApp: function() {
        return activeApp;
      },
      rerender: function() {
        if (activeApp !== null && typeof activeApp.rerender === "function") activeApp.rerender();
      }
    });
    return game;
  }
  function pageNode(app, current) {
    if (current.ui.page === "online") {
      online.sync();
      return online.ui.page === "table" ? renderOnlineTable(app, online, current) : renderOnlineLobby(app, online, current);
    }
    if (current.ui.page === "table") return renderTable(app, current);
    if (current.ui.page === "rules") return renderRules(app, current);
    return renderLobby(app, current);
  }
  function toastNode(app, text) {
    const node = app.el("div", "rt-toast", text);
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    return node;
  }
  function render(app) {
    style();
    activeApp = app;
    const current = ensureGame();
    current.sync();
    const shell = app.el("div", "rt");
    shell.appendChild(pageNode(app, current));
    if (current.ui.toast) shell.appendChild(toastNode(app, current.ui.toast));
    app.content.appendChild(shell);
  }
  function register() {
    const host = (
      /** @type {any} */
      window
    );
    if (!host.dshPiggyExtensions || typeof host.dshPiggyExtensions.register !== "function") return;
    host.dshPiggyExtensions.register("roulette", { render });
  }
  register();
})();
