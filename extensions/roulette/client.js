// GENERATED FILE. Edit src/extensions/roulette/client/ and run `node scripts/build-roulette-client.mjs`; do not edit by hand.
(() => {
  // src/extensions/roulette/client/game.js
  var STAKE_MIN = 500;
  var STAKE_MAX = 1e4;
  var STAKE_STEP = 500;
  var CHAMBERS = 6;
  var CHAMBER_X = [0, 33, 33, 0, -32, -32];
  var CHAMBER_Y = [-32, -15, 17, 34, 17, -15];
  function createState() {
    return {
      page: "lobby",
      stage: "idle",
      rulesFrom: "lobby",
      stake: 1e3,
      coins: 12500,
      vault: 1e5,
      matched: 0,
      pot: 0,
      you: 0,
      ai: 0,
      round: 1,
      bullet: -1,
      chamber: 0,
      primer: -1,
      primerPop: false,
      arming: false,
      pendingFresh: false,
      settled: false,
      spinning: false,
      flash: "",
      outcome: "",
      status: "\u5148\u4E0B\u6CE8\uFF0C\u518D\u5F00\u59CB\u3002\u8F6C\u8F6E\u7ED3\u679C\u4E0D\u4F1A\u63D0\u524D\u663E\u793A\u3002",
      toast: ""
    };
  }
  function money(value) {
    return Math.round(Number(value) || 0).toLocaleString("en-US");
  }
  function aiCap(vault) {
    return Math.max(STAKE_MIN, Math.floor((Number(vault) || 0) * 0.01 / 100) * 100);
  }
  function matchStake(state) {
    return Math.min(state.stake, aiCap(state.vault));
  }
  function createGame(options = {}) {
    const state = createState();
    const rerender = options.rerender ?? function() {
    };
    const random = options.random ?? Math.random;
    const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel ?? ((id) => clearTimeout(id));
    const timers = [];
    let toastTimer = null;
    function commit() {
      rerender();
    }
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
    function toast(text) {
      state.toast = text;
      if (toastTimer !== null) cancel(toastTimer);
      toastTimer = schedule(function() {
        toastTimer = null;
        state.toast = "";
        commit();
      }, 1900);
    }
    function randomChamber() {
      const value = Math.floor(Number(random()) * CHAMBERS);
      return Math.max(0, Math.min(CHAMBERS - 1, value));
    }
    function resetMatch() {
      stopTimers();
      state.stage = "idle";
      state.you = 0;
      state.ai = 0;
      state.round = 1;
      state.matched = 0;
      state.pot = 0;
      state.bullet = -1;
      state.chamber = 0;
      state.primer = -1;
      state.primerPop = false;
      state.arming = false;
      state.pendingFresh = false;
      state.settled = false;
      state.spinning = false;
      state.flash = "";
      state.outcome = "";
      state.status = "\u5148\u4E0B\u6CE8\uFF0C\u518D\u5F00\u59CB\u3002\u8F6C\u8F6E\u7ED3\u679C\u4E0D\u4F1A\u63D0\u524D\u663E\u793A\u3002";
      state.toast = "";
    }
    function enterTable() {
      resetMatch();
      state.page = "table";
      commit();
    }
    function leaveTable() {
      const refund = state.pot > 0 && !state.settled && state.round === 1 && state.you === 0 && state.ai === 0 && (state.page === "loading" || state.stage === "arming");
      const forfeit = state.pot > 0 && !state.settled && !refund;
      if (refund) state.coins += state.matched;
      resetMatch();
      state.page = "lobby";
      if (refund) toast("\u5DF2\u53D6\u6D88\u88C5\u5F39\uFF0C\u5E95\u6CE8\u9000\u56DE");
      else if (forfeit) toast("\u5DF2\u9000\u51FA\u724C\u684C\uFF0C\u672C\u573A\u4F5C\u5E9F");
      else toast("\u5DF2\u56DE\u5230\u5927\u5385");
      commit();
    }
    function backToTable() {
      if (state.page !== "loading") return;
      state.page = "table";
      state.stage = state.pendingFresh ? "idle" : "roundOver";
      state.pendingFresh = false;
      state.status = state.stage === "idle" ? "\u5148\u4E0B\u6CE8\uFF0C\u518D\u5F00\u59CB\u3002\u8F6C\u8F6E\u7ED3\u679C\u4E0D\u4F1A\u63D0\u524D\u663E\u793A\u3002" : "\u672C\u5C40\u7ED3\u675F\u3002\u70B9\u300C\u4E0B\u4E00\u5C40\u300D\u7EE7\u7EED\u3002";
      commit();
    }
    function openRules(from) {
      state.rulesFrom = from || state.page;
      state.page = "rules";
      commit();
    }
    function closeRules() {
      const back = state.rulesFrom === "rules" ? "lobby" : state.rulesFrom;
      state.page = back;
      state.rulesFrom = "lobby";
      commit();
    }
    function setStake(delta) {
      if (state.page !== "table" || state.stage !== "idle") return;
      state.stake = Math.max(STAKE_MIN, Math.min(STAKE_MAX, state.stake + delta));
      commit();
    }
    function startMatch() {
      if (state.stage !== "idle" && state.stage !== "roundOver" && state.stage !== "matchOver") return;
      const fresh = state.stage === "idle" || state.stage === "matchOver";
      if (fresh) {
        state.you = 0;
        state.ai = 0;
        state.round = 1;
        state.matched = 0;
        state.pot = 0;
        state.bullet = -1;
        state.chamber = 0;
        state.primer = -1;
        state.primerPop = false;
        state.arming = false;
        state.spinning = false;
        state.flash = "";
        state.settled = false;
        state.outcome = "";
      }
      state.pendingFresh = fresh;
      state.page = "loading";
      commit();
    }
    function beginLoad(auto) {
      if (state.page !== "loading") return;
      if (state.pendingFresh) {
        const need = matchStake(state);
        if (state.coins < need) {
          toast("\u91D1\u5E01\u4E0D\u8DB3");
          commit();
          return;
        }
        state.matched = need;
        state.coins -= need;
        state.pot = need * 2;
        state.pendingFresh = false;
      }
      if (state.pot <= 0) {
        toast("\u5148\u4E0B\u6CE8");
        commit();
        return;
      }
      state.page = "table";
      state.stage = "arming";
      state.arming = true;
      state.bullet = -1;
      state.chamber = 0;
      state.primer = -1;
      state.primerPop = false;
      state.spinning = false;
      state.flash = "";
      state.outcome = "";
      state.status = auto ? "\u7CFB\u7EDF\u968F\u673A\u88C5\u5F39\u2026" : "\u70B9\u4E00\u4E2A\u5F39\u5B54\uFF0C\u628A\u5B50\u5F39\u88C5\u8FDB\u53BB\u3002";
      commit();
      if (auto) {
        later(function() {
          if (state.stage === "arming") seat(randomChamber());
        }, 520);
      }
    }
    function seat(index) {
      if (state.stage !== "arming" || !state.arming) return;
      if (!Number.isInteger(index) || index < 0 || index >= CHAMBERS) return;
      state.arming = false;
      state.bullet = index;
      state.chamber = index;
      state.primer = index;
      state.primerPop = true;
      state.stage = "ready";
      state.status = "\u7B2C " + (index + 1) + " \u5DE2\u5DF2\u88C5\u5F39 \xB7 \u76F4\u63A5\u5F00\u67AA\u6309\u8BE5\u5B54\uFF0C\u6216\u8F6C\u8F6E\u3002";
      toast("\u7B2C " + (index + 1) + " \u5DE2\u5DF2\u88C5\u5F39");
      commit();
      later(function() {
        if (state.primer !== index) return;
        state.primerPop = false;
        commit();
      }, 320);
    }
    function randomArm() {
      if (state.stage !== "arming" || !state.arming) return;
      seat(randomChamber());
    }
    function spin() {
      if (state.stage !== "ready") return;
      state.stage = "spinning";
      state.spinning = true;
      state.primer = -1;
      state.primerPop = false;
      state.status = "\u8F6C\u8F6E\u4E2D\u2026 \u5B50\u5F39\u4F4D\u7F6E\u4E0D\u4F1A\u663E\u793A\u3002";
      commit();
      later(function() {
        state.bullet = randomChamber();
        state.chamber = 0;
        state.spinning = false;
        state.stage = "choice";
        state.status = "\u8F6C\u8F6E\u5B8C\u6210\u3002\u4F60\u5148\u624B\uFF1A\u5BF9\u81EA\u5DF1\u5F00\u67AA\uFF0C\u6216\u4E0D\u5F00\u67AA\u3002";
        commit();
      }, 950);
    }
    function flash(live) {
      state.flash = live ? "live" : "blank";
      later(function() {
        state.flash = "";
        commit();
      }, 450);
    }
    function finishRound(winner) {
      if (winner === "you") state.you += 1;
      else state.ai += 1;
      if (state.you >= 2 || state.ai >= 2) {
        if (state.you >= 2) {
          state.vault = Math.max(0, state.vault - state.matched);
          state.coins += state.pot;
          state.outcome = "win";
          state.status = "\u4F60\u8D62\u4E0B\u6574\u573A\uFF0C\u62FF\u8D70\u5E95\u6C60 " + money(state.pot) + "\u3002";
        } else {
          state.vault += state.matched;
          state.outcome = "lose";
          state.status = "AI \u8D62\u4E0B\u6574\u573A\u3002\u5E95\u6C60\u8FDB\u4E86 AI \u91D1\u5E93\u3002";
        }
        state.settled = true;
        state.stage = "matchOver";
        toast(state.outcome === "win" ? "\u6574\u573A\u80DC\u5229" : "\u6574\u573A\u7ED3\u675F");
      } else {
        state.round += 1;
        state.stage = "roundOver";
        state.status = "\u672C\u5C40\u7ED3\u675F\u3002\u6BD4\u5206 " + state.you + " : " + state.ai + "\u3002\u70B9\u300C\u4E0B\u4E00\u5C40\u300D\u7EE7\u7EED\u3002";
        toast("\u672C\u5C40\u7ED3\u675F");
      }
      commit();
    }
    function fire(shooter) {
      if (shooter === "you" && state.stage !== "ready" && state.stage !== "choice") return;
      if (shooter === "ai" && state.stage !== "ai") return;
      if (state.chamber === state.bullet) {
        state.primer = -1;
        state.primerPop = false;
        flash(true);
        state.status = "\u4E2D\u5F39\uFF01";
        finishRound(shooter === "you" ? "ai" : "you");
        return;
      }
      flash(false);
      state.chamber = (state.chamber + 1) % CHAMBERS;
      state.primer = -1;
      state.primerPop = false;
      if (shooter === "you") {
        state.stage = "ai";
        state.status = "\u7A7A\u67AA\u3002\u4F60\u628A\u67AA\u4EA4\u7ED9 AI\u3002";
        commit();
        later(aiTurn, 650);
        return;
      }
      state.stage = "choice";
      state.status = "AI \u7A7A\u67AA\u3002\u67AA\u56DE\u5230\u4F60\u624B\u91CC\u3002";
      commit();
    }
    function aiTurn() {
      if (state.stage !== "ai") return;
      state.spinning = true;
      state.primer = -1;
      state.primerPop = false;
      state.status = "AI \u8F6C\u8F6E\u2026";
      commit();
      later(function() {
        state.bullet = randomChamber();
        state.chamber = 0;
        state.spinning = false;
        fire("ai");
      }, 900);
    }
    function pass() {
      if (state.stage !== "ready" && state.stage !== "choice") return;
      state.stage = "ai";
      state.primer = -1;
      state.primerPop = false;
      state.status = "\u4F60\u9009\u62E9\u4E0D\u5F00\u67AA\u3002\u67AA\u4EA4\u7ED9 AI\u3002";
      commit();
      later(aiTurn, 500);
    }
    return {
      state,
      later,
      notify: function(text) {
        toast(text);
        commit();
      },
      enterTable,
      leaveTable,
      backToTable,
      openRules,
      closeRules,
      setStake,
      startMatch,
      beginLoad,
      seat,
      randomArm,
      spin,
      fire,
      pass,
      aiTurn,
      stopTimers
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
  function pageHead(app, state, title, sub, backLabel, onBack) {
    const head = app.el("header", "rt-head");
    if (typeof onBack === "function") {
      const back = app.button("rt-back", { "aria-label": backLabel || "\u8FD4\u56DE" }, onBack);
      back.textContent = (backLabel || "").replace(/^返回/, "") || "\u8FD4\u56DE";
      head.appendChild(back);
    }
    const brand = app.el("div", "rt-brand");
    brand.appendChild(app.el("div", "rt-title", title));
    if (sub) brand.appendChild(app.el("div", "rt-sub", sub));
    head.appendChild(brand);
    head.appendChild(vaultPill(app, state));
    return head;
  }
  function action(app, className, attrs, label, onClick) {
    const node = app.button(className, attrs || {}, onClick);
    if (label !== void 0) node.textContent = label;
    return node;
  }
  function pigAvatar(app, className) {
    const art = typeof app.pigArt === "function" ? app.pigArt() : null;
    if (!art) return app.el("span", className, "\u{1F416}");
    const node = app.el("img", className);
    node.src = art;
    node.alt = "";
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
  function ammoBadge(app) {
    const badge = app.el("div", "rt-ammo");
    badge.appendChild(assetImage(app, "bullet-v1.webp", "rt-ammo-icon"));
    badge.appendChild(app.el("b", null, "1"));
    badge.appendChild(app.el("span", null, "/ 6 \u5DE2"));
    return badge;
  }

  // src/extensions/roulette/client/pages.js
  function renderLobby(app, game2) {
    const state = game2.state;
    const root = app.el("div", "rt-page rt-lobby");
    const top = app.el("div", "rt-topline");
    top.appendChild(app.el("span", "rt-kicker", "\u7ECF\u5178 6 \u5DE2 \xB7 1 \u6761\u547D \xB7 \u4E09\u5C40\u4E24\u80DC"));
    top.appendChild(app.el("span", "rt-spacer"));
    top.appendChild(vaultPill(app, state));
    root.appendChild(top);
    const hero = app.el("div", "rt-hero");
    hero.appendChild(app.el("div", "rt-hero-glow"));
    hero.appendChild(assetImage(app, "table-v1.webp", "rt-hero-table"));
    hero.appendChild(assetImage(app, "revolver-v2.webp", "rt-hero-gun"));
    hero.appendChild(assetImage(app, "chip-v1.webp", "rt-hero-chip rt-hero-chip-a"));
    hero.appendChild(assetImage(app, "chip-v1.webp", "rt-hero-chip rt-hero-chip-b"));
    const badge = ammoBadge(app);
    badge.className += " rt-hero-ammo";
    hero.appendChild(badge);
    root.appendChild(hero);
    root.appendChild(app.el("div", "rt-menu-label", "\u9009\u62E9\u73A9\u6CD5"));
    const menu = app.el("div", "rt-menu");
    menu.appendChild(modeRow(app, {
      op: "enter-ai",
      name: "AI \u5BF9\u6218",
      note: "\u5355\u5C40\u5E95\u6C60 \xB7 AI \u4ECE\u91D1\u5E93\u914D\u6CE8",
      primary: true,
      asset: "cylinder-v1.webp",
      onClick: function() {
        game2.enterTable();
      }
    }));
    menu.appendChild(modeRow(app, {
      op: "friend-mode",
      name: "\u597D\u53CB\u8054\u673A",
      note: "\u9700\u8981\u5BBF\u4E3B\u623F\u95F4\u63A5\u53E3",
      locked: true,
      asset: "chip-v1.webp",
      onClick: function() {
        game2.notify("\u597D\u53CB\u8054\u673A\u9700\u8981\u5BBF\u4E3B\u623F\u95F4\u63A5\u53E3\uFF0C\u4E0B\u4E00\u9636\u6BB5\u63A5\u5165");
      }
    }));
    menu.appendChild(modeRow(app, {
      op: "team-mode",
      name: "4v4 \u9635\u8425",
      note: "\u5355\u5C40\u6DD8\u6C70 \xB7 \u540E\u7EED\u5F00\u653E",
      locked: true,
      grid: true,
      onClick: function() {
        game2.notify("4v4 \u9700\u8981\u5BBF\u4E3B\u623F\u95F4\u63A5\u53E3\uFF0C\u4E0B\u4E00\u9636\u6BB5\u63A5\u5165");
      }
    }));
    root.appendChild(menu);
    root.appendChild(footer(app, {
      onRules: function() {
        game2.openRules("lobby");
      },
      note: "\u91D1\u5E01 " + money(state.coins) + " \xB7 \u672C\u5730\u6F14\u793A"
    }));
    return root;
  }
  function renderLoading(app, game2) {
    const state = game2.state;
    const root = app.el("div", "rt-page rt-loading");
    root.appendChild(pageHead(app, state, "\u88C5\u5F39", "\u7B2C " + state.round + " \u5C40 \xB7 \u4E09\u5C40\u4E24\u80DC", "\u8FD4\u56DE\u724C\u684C", function() {
      game2.backToTable();
    }));
    const stage = app.el("div", "rt-gun-stage");
    const wrap = app.el("div", "rt-gun-wrap");
    wrap.appendChild(assetImage(app, "revolver-v2.webp", "rt-gun-img"));
    const ring = app.el("div", "rt-gun-ring");
    for (let index = 0; index < 6; index += 1) ring.appendChild(app.el("i"));
    wrap.appendChild(ring);
    stage.appendChild(wrap);
    const bullet = app.button("rt-gun-bullet", { "data-op": "load-bullet", "aria-label": "\u88C5\u5F39" }, function() {
      game2.beginLoad(false);
    });
    bullet.appendChild(assetImage(app, "bullet-v1.webp", "rt-gun-bullet-icon"));
    bullet.appendChild(app.el("span", null, "\u88C5\u5F39"));
    stage.appendChild(bullet);
    root.appendChild(stage);
    const pot = state.pendingFresh ? matchStake(state) * 2 : state.pot;
    const bet = app.el("div", "rt-bet-pill");
    bet.appendChild(app.el("span", null, "\u5E95\u6CE8"));
    bet.appendChild(app.el("b", null, money(state.stake)));
    bet.appendChild(app.el("span", null, "\xB7 \u5E95\u6C60"));
    bet.appendChild(app.el("b", null, money(pot)));
    root.appendChild(bet);
    root.appendChild(app.el("div", "rt-load-hint", "\u70B9\u300C\u88C5\u5F39\u300D\u540E\u5728\u5F39\u5DE2\u4E0A\u70B9\u4E00\u4E2A\u5B54\uFF1B\u4E5F\u53EF\u4EE5\u8BA9\u7CFB\u7EDF\u968F\u673A\u3002\u8FD4\u56DE\u5927\u5385\u4F1A\u53D6\u6D88\u672C\u573A\uFF0C\u88C5\u5F39\u524D\u4E0D\u6263\u94B1\u3002"));
    const actions = app.el("div", "rt-actions rt-actions-two");
    actions.appendChild(action(app, "dp-btn rt-primary", { "data-op": "load-now" }, "\u88C5\u5F39", function() {
      game2.beginLoad(false);
    }));
    actions.appendChild(action(app, "dp-btn", { "data-op": "load-random" }, "\u968F\u673A\u88C5\u5F39", function() {
      game2.beginLoad(true);
    }));
    root.appendChild(actions);
    root.appendChild(footer(app, {
      onRules: function() {
        game2.openRules("loading");
      },
      extra: function() {
        return action(app, "rt-link", { "data-op": "leave-lobby", "aria-label": "\u8FD4\u56DE\u5927\u5385\u5E76\u53D6\u6D88\u672C\u573A" }, "\u8FD4\u56DE\u5927\u5385", function() {
          game2.leaveTable();
        });
      },
      note: "\u91D1\u5E01 " + money(state.coins)
    }));
    return root;
  }
  function renderRules(app, game2) {
    const state = game2.state;
    const root = app.el("div", "rt-page rt-rules");
    root.appendChild(pageHead(app, state, "\u89C4\u5219", "\u7ECF\u5178 6 \u5DE2 \xB7 1 \u6761\u547D", "\u8FD4\u56DE", function() {
      game2.closeRules();
    }));
    const card = app.el("div", "rt-rules-card");
    card.appendChild(app.el("h2", null, "\u7ECF\u5178\u4FC4\u7F57\u65AF\u8F6E\u76D8"));
    const list = app.el("ul");
    [
      "6 \u4E2A\u5F39\u5DE2\uFF0C1 \u53D1\u5B9E\u5F39\uFF0C1 \u6761\u547D\u3002\u6BCF\u5C40\u5F00\u59CB\u5148\u88C5\u5F39\uFF0C\u518D\u9009\u62E9\u662F\u5426\u8F6C\u8F6E\u3002",
      "\u8F6C\u8F6E\u4F1A\u91CD\u65B0\u968F\u673A\u5B50\u5F39\u4F4D\u7F6E\u5E76\u9690\u85CF\u5E95\u706B\uFF1B\u4E0D\u8F6C\u8F6E\u76F4\u63A5\u5F00\u67AA\uFF0C\u6309\u4F60\u88C5\u5F39\u65F6\u9009\u7684\u5B54\u7ED3\u7B97\u3002",
      "\u7A7A\u67AA\u6362\u624B\uFF1B\u4E2D\u5F39\u8F93\u6389\u672C\u5C40\u3002\u5148\u8D62 2 \u5C40\u7684\u4EBA\u62FF\u8D70\u5E95\u6C60\u3002",
      "AI \u53EA\u5728\u5BF9\u6218\u6A21\u5F0F\u53C2\u6218\uFF0C\u6309\u91D1\u5E93 1% \u7B49\u989D\u914D\u6CE8\uFF1B\u8D85\u51FA\u90E8\u5206\u539F\u8DEF\u9000\u56DE\u3002",
      "\u597D\u53CB\u8054\u673A / 4v4 \u9700\u8981\u5BBF\u4E3B\u623F\u95F4\u63A5\u53E3\uFF0C\u5F53\u524D\u53EA\u9501\u5B9A\u5165\u53E3\uFF0C\u4E0D\u5047\u88C5\u5DF2\u652F\u6301\u3002",
      "\u672C\u6269\u5C55\u4F7F\u7528\u672C\u5730\u6F14\u793A\u91D1\u5E01\uFF0C\u4E0D\u8BFB\u5199\u4E3B\u5B58\u6863\u91D1\u5E01\uFF1B\u5173\u95ED\u6269\u5C55\u540E\u672C\u573A\u6570\u636E\u4E0D\u4FDD\u7559\u3002"
    ].forEach(function(line) {
      list.appendChild(app.el("li", null, line));
    });
    card.appendChild(list);
    card.appendChild(app.el("p", "rt-rules-note", "\u88C5\u5F39\u9875\u548C\u724C\u684C\u90FD\u80FD\u70B9\u300C\u89C4\u5219\u300D\uFF1B\u4ECE\u89C4\u5219\u8FD4\u56DE\u65F6\uFF0C\u724C\u684C\u7684\u5E95\u6CE8\u3001\u6BD4\u5206\u548C\u5F39\u5DE2\u72B6\u6001\u4E0D\u53D8\u3002"));
    root.appendChild(card);
    const label = state.rulesFrom === "table" ? "\u8FD4\u56DE\u724C\u684C" : state.rulesFrom === "loading" ? "\u8FD4\u56DE\u88C5\u5F39" : "\u8FD4\u56DE\u5927\u5385";
    root.appendChild(action(app, "dp-btn rt-primary rt-wide", { "data-op": "rules-back" }, label, function() {
      game2.closeRules();
    }));
    return root;
  }

  // src/extensions/roulette/client/table.js
  function pips(app, count) {
    const row = app.el("div", "rt-pips");
    row.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 2; index += 1) {
      row.appendChild(app.el("i", index < count ? "rt-pip rt-pip-on" : "rt-pip"));
    }
    return row;
  }
  function playerCard(app, options) {
    const card = app.el("div", "rt-pcard " + (options.you ? "rt-pcard-you" : "rt-pcard-ai"));
    const avatar = app.el("span", "rt-avatar");
    if (options.you) avatar.appendChild(pigAvatar(app, "rt-avatar-img"));
    else avatar.textContent = "\u{1F437}";
    card.appendChild(avatar);
    const who = app.el("div", "rt-pwho");
    who.appendChild(app.el("div", "rt-pname", options.name));
    who.appendChild(app.el("div", "rt-prole", options.role));
    who.appendChild(pips(app, options.wins));
    card.appendChild(who);
    return card;
  }
  function renderPlayers(app, state) {
    const row = app.el("div", "rt-players");
    row.appendChild(playerCard(app, {
      name: "\u4FA6\u63A2\u732A",
      role: state.matched > 0 ? "\u914D\u6CE8 " + money(state.matched) : "\u914D\u6CE8\u4E0A\u9650 " + money(aiCap(state.vault)),
      wins: state.ai
    }));
    const score = app.el("div", "rt-score");
    score.appendChild(app.el("b", null, state.you + " : " + state.ai));
    score.appendChild(app.el("small", null, state.stage === "matchOver" ? "\u5DF2\u7ED3\u675F" : "\u7B2C " + state.round + " \u5C40"));
    row.appendChild(score);
    row.appendChild(playerCard(app, {
      name: "\u4F60",
      role: "\u91D1\u5E01 " + money(state.coins),
      wins: state.you,
      you: true
    }));
    return row;
  }
  function renderBoard(app, game2) {
    const state = game2.state;
    let className = "rt-board";
    if (state.stage === "arming") className += " rt-board-arming";
    if (state.flash === "live") className += " rt-board-fire rt-board-live";
    else if (state.flash === "blank") className += " rt-board-fire";
    const board = app.el("div", className);
    board.setAttribute("role", "group");
    board.setAttribute("aria-label", "\u516D\u5B54\u5F39\u5DE2");
    board.appendChild(assetImage(app, "table-v1.webp", "rt-board-table"));
    const pot = app.el("div", "rt-pot");
    pot.appendChild(assetImage(app, "chip-v1.webp", "rt-pot-chip"));
    pot.appendChild(app.el("span", null, "\u5E95\u6C60"));
    pot.appendChild(app.el("b", null, money(state.pot > 0 ? state.pot : matchStake(state) * 2)));
    board.appendChild(pot);
    const wrap = app.el("div", state.spinning ? "rt-cyl-wrap rt-cyl-spin" : "rt-cyl-wrap");
    wrap.appendChild(assetImage(app, "cylinder-v1.webp", "rt-cyl"));
    if (state.primer >= 0) {
      const primer = app.el("i", state.primerPop ? "rt-primer rt-primer-show" : "rt-primer rt-primer-on");
      primer.style.setProperty("--x", CHAMBER_X[state.primer] + "px");
      primer.style.setProperty("--y", CHAMBER_Y[state.primer] + "px");
      wrap.appendChild(primer);
    }
    for (let index = 0; index < 6; index += 1) {
      const on = state.stage === "arming";
      const hole = app.button("rt-hole", {
        "data-chamber": String(index),
        "aria-label": "\u7B2C " + (index + 1) + " \u5DE2" + (on ? "\uFF0C\u70B9\u8FD9\u91CC\u88C5\u5F39" : ""),
        "aria-disabled": on ? "false" : "true"
      }, function() {
        game2.seat(index);
      });
      hole.disabled = !on;
      hole.style.setProperty("--x", CHAMBER_X[index] + "px");
      hole.style.setProperty("--y", CHAMBER_Y[index] + "px");
      wrap.appendChild(hole);
    }
    board.appendChild(wrap);
    board.appendChild(app.el("div", "rt-flash"));
    const badge = ammoBadge(app);
    badge.className += " rt-board-ammo";
    board.appendChild(badge);
    board.appendChild(assetImage(app, "chip-v1.webp", "rt-board-chips"));
    return board;
  }
  function betNote(app, state) {
    const note = app.el("div", "rt-bet-note");
    const cap = aiCap(state.vault);
    if (state.matched > 0) {
      note.appendChild(app.el("span", null, "\u672C\u5C40\u914D\u6CE8 "));
      note.appendChild(app.el("b", null, money(state.matched)));
      if (state.stake > state.matched) {
        note.appendChild(app.el("div", "rt-warn", "\u591A\u51FA " + money(state.stake - state.matched) + " \u9000\u56DE"));
      }
      return note;
    }
    if (state.stake > cap) {
      note.appendChild(app.el("span", null, "\u6709\u6548\u914D\u6CE8 "));
      note.appendChild(app.el("b", null, money(cap)));
      note.appendChild(app.el("div", "rt-warn", "\u591A\u51FA " + money(state.stake - cap) + " \u9000\u56DE"));
      return note;
    }
    note.appendChild(app.el("span", null, "\u914D\u6CE8\u4E0A\u9650 "));
    note.appendChild(app.el("b", null, money(cap)));
    return note;
  }
  function renderDock(app, game2) {
    const state = game2.state;
    const dock = app.el("div", "rt-dock");
    const bet = app.el("div", "rt-bet");
    bet.appendChild(app.el("span", "rt-bet-label", "\u5E95\u6CE8"));
    const minus = app.button("rt-step", { "data-op": "stake-down", "aria-label": "\u51CF\u5C11\u5E95\u6CE8" }, function() {
      game2.setStake(-STAKE_STEP);
    });
    minus.textContent = "\u2212";
    minus.disabled = state.stage !== "idle";
    bet.appendChild(minus);
    bet.appendChild(app.el("span", "rt-stake", money(state.stake)));
    const plus = app.button("rt-step", { "data-op": "stake-up", "aria-label": "\u589E\u52A0\u5E95\u6CE8" }, function() {
      game2.setStake(STAKE_STEP);
    });
    plus.textContent = "+";
    plus.disabled = state.stage !== "idle";
    bet.appendChild(plus);
    bet.appendChild(betNote(app, state));
    dock.appendChild(bet);
    const actions = app.el("div", "rt-actions");
    function primary(label, op, handler, disabled) {
      const node = action(app, "dp-btn rt-primary rt-wide", { "data-op": op }, label, handler);
      if (disabled) node.disabled = true;
      actions.appendChild(node);
      return node;
    }
    function hint(text) {
      actions.appendChild(app.el("div", "rt-hint", text));
    }
    if (state.stage === "idle") {
      primary("\u5F00\u59CB\u5BF9\u5C40", "start", function() {
        game2.startMatch();
      });
      hint("AI \u91D1\u5E93\u914D\u6CE8 \xB7 \u4E09\u5C40\u4E24\u80DC");
    } else if (state.stage === "arming") {
      primary("\u968F\u673A\u88C5\u5F39", "random-arm", function() {
        game2.randomArm();
      });
      hint("\u70B9\u4E00\u4E2A\u5F39\u5B54\u88C5\u5F39\uFF0C\u6216\u70B9\u300C\u968F\u673A\u88C5\u5F39\u300D");
    } else if (state.stage === "ready") {
      primary("\u8F6C\u8F6E", "spin", function() {
        game2.spin();
      });
      actions.appendChild(action(app, "dp-btn", { "data-op": "pass" }, "\u4E0D\u5F00\u67AA", function() {
        game2.pass();
      }));
      actions.appendChild(action(app, "dp-btn rt-danger", { "data-op": "shoot" }, "\u5BF9\u81EA\u5DF1\u5F00\u67AA", function() {
        game2.fire("you");
      }));
    } else if (state.stage === "spinning") {
      primary("\u8F6C\u8F6E\u4E2D\u2026", "spin-wait", function() {
      }, true);
      hint("\u8F6C\u8F6E\u4E2D\u2026 \u5B50\u5F39\u4F4D\u7F6E\u4E0D\u4F1A\u663E\u793A");
    } else if (state.stage === "choice") {
      actions.appendChild(action(app, "dp-btn", { "data-op": "pass" }, "\u4E0D\u5F00\u67AA", function() {
        game2.pass();
      }));
      actions.appendChild(action(app, "dp-btn rt-danger", { "data-op": "shoot" }, "\u5BF9\u81EA\u5DF1\u5F00\u67AA", function() {
        game2.fire("you");
      }));
      hint("\u7A7A\u67AA\u6362\u624B \xB7 \u5148\u8D62 2 \u5C40");
    } else if (state.stage === "ai") {
      primary("AI \u56DE\u5408\u2026", "ai-wait", function() {
      }, true);
      hint("AI \u8F6C\u8F6E\u540E\u5F00\u67AA");
    } else if (state.stage === "roundOver") {
      primary("\u4E0B\u4E00\u5C40", "next", function() {
        game2.startMatch();
      });
      hint("\u672C\u5C40\u7ED3\u675F \xB7 \u70B9\u4E0B\u4E00\u5C40\u7EE7\u7EED");
    } else {
      primary("\u518D\u6765\u4E00\u573A", "again", function() {
        game2.startMatch();
      });
      hint("\u6574\u573A\u7ED3\u675F \xB7 \u5E95\u6C60\u5DF2\u7ED3\u7B97");
    }
    dock.appendChild(actions);
    return dock;
  }
  function renderTable(app, game2) {
    const state = game2.state;
    const root = app.el("div", "rt-page rt-table");
    const sub = state.stage === "matchOver" ? "\u5DF2\u7ED3\u675F \xB7 \u4E09\u5C40\u4E24\u80DC" : "\u7B2C " + state.round + " \u5C40 \xB7 \u4E09\u5C40\u4E24\u80DC";
    root.appendChild(pageHead(app, state, "AI \u5BF9\u6218", sub, "\u8FD4\u56DE\u5927\u5385", function() {
      game2.leaveTable();
    }));
    root.appendChild(renderPlayers(app, state));
    root.appendChild(renderBoard(app, game2));
    const status = app.el("div", "rt-status", state.status);
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    root.appendChild(status);
    root.appendChild(renderDock(app, game2));
    root.appendChild(footer(app, {
      onRules: function() {
        game2.openRules("table");
      },
      note: "\u5355\u5C40\u5E95\u6C60"
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
    ".rt-hero{position:relative;height:148px;flex-shrink:0;border-radius:17px;overflow:hidden;border:2px solid var(--ac-border-light,#e5dcc6);background:radial-gradient(circle at 42% 34%,#fffef8 0%,#e8fbf6 48%,#d3f4ed 100%);display:grid;place-items:center}",
    '.rt-hero:before{content:"";position:absolute;inset:8px;border:1px dashed rgba(15,156,145,.22);border-radius:12px;pointer-events:none}',
    ".rt-hero-glow{position:absolute;width:170px;height:105px;border-radius:50%;background:#fff;opacity:.55;filter:blur(8px)}",
    ".rt-hero-table{position:absolute;width:186px;height:186px;object-fit:cover;opacity:.28;filter:saturate(.8)}",
    ".rt-hero-gun{position:relative;z-index:2;width:170px;transform:rotate(-7deg);filter:drop-shadow(0 8px 6px rgba(91,66,38,.2))}",
    ".rt-hero-chip{position:absolute;z-index:3;width:34px;filter:drop-shadow(0 2px 2px rgba(91,66,38,.16))}",
    ".rt-hero-chip-a{left:12px;bottom:7px;transform:rotate(-14deg)}",
    ".rt-hero-chip-b{right:14px;top:8px;width:26px;transform:rotate(13deg);opacity:.9}",
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
    ".rt-board{position:relative;height:176px;flex-shrink:0;border-radius:18px;overflow:hidden;border:2px solid var(--ac-border-light,#e5dcc6);background:radial-gradient(circle at 42% 34%,#f7fffc 0%,#e3faf4 46%,#cff2ea 100%);display:grid;place-items:center}",
    '.rt-board:before{content:"";position:absolute;inset:9px;border:1px dashed rgba(15,156,145,.24);border-radius:12px;pointer-events:none}',
    '.rt-board:after{content:"";position:absolute;width:170px;height:120px;border-radius:50%;background:#fff;opacity:.35;filter:blur(10px);pointer-events:none}',
    ".rt-board-table{position:absolute;width:176px;height:176px;object-fit:cover;opacity:.18;pointer-events:none}",
    ".rt-pot{position:absolute;z-index:5;left:50%;top:7px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:2px 9px 2px 4px;border-radius:var(--ac-pill,50px);background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);font-size:9px;color:var(--ac-text-body,#725d42);white-space:nowrap}",
    ".rt-pot img{width:19px;height:19px;display:block;filter:drop-shadow(0 1px 1px rgba(91,66,38,.18))}",
    ".rt-pot b{font-size:12px;color:var(--ac-text,#794f27);font-variant-numeric:tabular-nums}",
    ".rt-cyl-wrap{position:relative;z-index:3;width:128px;height:128px;display:grid;place-items:center}",
    ".rt-cyl{position:relative;z-index:1;width:128px;display:block;filter:drop-shadow(0 7px 6px rgba(91,66,38,.18))}",
    ".rt-primer{position:absolute;z-index:5;left:calc(50% + var(--x,0px));top:calc(50% + var(--y,0px));width:18px;height:18px;margin:-9px;border-radius:50%;pointer-events:none;opacity:0;background:radial-gradient(circle at 35% 30%,#f6d78e,#d9a441 58%,#b7791f 100%);border:1.5px solid #8f5f1e;box-shadow:inset 0 0 0 2px rgba(255,244,214,.35),0 1px 1px rgba(91,66,38,.25)}",
    '.rt-primer:after{content:"";position:absolute;left:5px;top:5px;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c9,#c9962e 70%);border:1px solid #8f5f1e}',
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
      rerender: function() {
        if (activeApp !== null && typeof activeApp.rerender === "function") activeApp.rerender();
      }
    });
    return game;
  }
  function pageNode(app, game2) {
    const page = game2.state.page;
    if (page === "table") return renderTable(app, game2);
    if (page === "loading") return renderLoading(app, game2);
    if (page === "rules") return renderRules(app, game2);
    return renderLobby(app, game2);
  }
  function toastNode(app, current) {
    const node = app.el("div", "rt-toast", current.toast);
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    return node;
  }
  function render(app) {
    style();
    activeApp = app;
    const current = ensureGame();
    const shell = app.el("div", "rt");
    shell.appendChild(pageNode(app, current));
    if (current.state.toast) shell.appendChild(toastNode(app, current.state));
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
