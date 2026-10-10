// GENERATED FILE. Edit src/client/ and run `npm run build`; do not edit by hand.
(() => {
  // src/client/constants.js
  var STATE_URL = "/dsh-piggy/state";
  var ART_URL = "/dsh-piggy/art/";
  var ACT_URL = "/dsh-piggy/act";
  var POLL_MS = 4e3;
  var IDLE_CHAT_MINUTES = { min: 20, max: 40 };
  var GREET_DELAY_MS = 1500;
  var MOUNTED = "data-dsh-pig";
  var OPEN_KEY = "dsh-piggy:open";
  var POSITION_KEY = "dsh-piggy:position";
  var PANEL_WIDTH = 292;
  var PANEL_GAP = 8;
  var PANEL_MARGIN = 10;
  var PANEL_MIN_HEIGHT = 120;
  var PANEL_MAX_HEIGHT = 520;
  var SCENE_RESERVE = 132;
  var PIG_PADDING_X = 6;
  var TABS = [
    { key: "status", label: "\u72B6\u6001", emoji: "\u{1F4CB}" },
    { key: "card", label: "\u5C45\u6C11\u5361", emoji: "\u{1FAAA}" },
    { key: "dex", label: "\u56FE\u9274", emoji: "\u{1F4D6}" },
    { key: "skins", label: "\u6362\u80A4", emoji: "\u{1F3A8}" },
    { key: "study", label: "\u5B66\u4E60", emoji: "\u{1F4DA}" },
    { key: "work", label: "\u6253\u5DE5", emoji: "\u{1F4BC}" },
    { key: "shop", label: "\u5546\u5E97", emoji: "\u{1F6D2}" },
    { key: "travel", label: "\u65C5\u884C", emoji: "\u{1F9F3}" },
    { key: "bag", label: "\u80CC\u5305", emoji: "\u{1F392}" },
    { key: "pomodoro", label: "\u756A\u8304\u949F", emoji: "\u{1F345}" },
    { key: "fishing", label: "\u9493\u9C7C", emoji: "\u{1F3A3}" },
    { key: "extensions", label: "\u6269\u5C55", emoji: "\u{1F9E9}" },
    { key: "settings", label: "\u8BBE\u7F6E", emoji: "\u2699\uFE0F" }
  ];
  var DEV_TAPS_TO_UNLOCK = 7;
  var DEV_TAP_WINDOW_MS = 3e3;
  var DEV_TAP_HINT_FROM = 4;
  var DEV_TAP_HINT_MS = 1200;
  var DEV_KEY = "dsh-piggy:dev";
  var DEV_TAB = { key: "dev", label: "\u8C03\u8BD5", emoji: "\u{1F527}" };
  var UPDATE_TAB = { key: "update", label: "\u66F4\u65B0", emoji: "\u{1F504}" };
  var QUIT_TAB = { key: "quit", label: "\u9000\u51FA", emoji: "\u{1F44B}" };
  var MODES = ["feed", "bathe", "play", "pet"];
  var CARE_LABEL = { feed: ["\u5582\u98DF", "\u{1F34E}"], bathe: ["\u6D17\u6FA1", "\u{1F6C1}"], play: ["\u73A9\u800D", "\u{1F3BE}"], pet: ["\u6478\u6478", "\u2764\uFE0F"] };
  var BOX_POKES_TO_OPEN = 3;
  var BOX_POKE_LINES = [
    "\u91CC\u9762\u597D\u50CF\u6709\u4E1C\u897F\u2026",
    "\u52A8\u4E86\uFF01\u518D\u6233\u4E00\u4E0B\uFF01"
  ];
  var NO_ITEM_LINE = {
    food: "\u6CA1\u6709\u5403\u7684\u5566\uFF0C\u5FEB\u53BB\u4E70\u4E00\u70B9 \u{1F34E}",
    bath: "\u6CA1\u6709\u6D17\u6D74\u7528\u54C1\u4E86\uFF0C\u53BB\u4E70\u70B9\u5427 \u{1F9FC}",
    toy: "\u6CA1\u6709\u73A9\u5177\u4E86\uFF0C\u53BB\u5546\u5E97\u770B\u770B \u{1FA80}"
  };
  var KIND_TITLE = { food: "\u{1F34E} \u98DF\u7269", bath: "\u{1F9FC} \u6D17\u6D74", toy: "\u{1FA80} \u73A9\u5177", bait: "\u{1F3A3} \u9C7C\u9975", dress: "\u{1F455} \u88C5\u626E", medicine: "\u{1F48A} \u836F\u54C1", revive: "\u2728 \u590D\u6D3B", promotion: "\u2728 \u664B\u5347" };
  var KIND_ORDER = ["food", "bath", "toy", "bait", "medicine", "promotion"];
  function shelfOf(kind) {
    return kind === "revive" ? "medicine" : kind;
  }
  var STAGES = [
    { key: "preschool", label: "\u5E7C\u513F\u56ED" },
    { key: "extracurricular", label: "\u8BFE\u5916" },
    { key: "primary", label: "\u5C0F\u5B66" },
    { key: "middle", label: "\u4E2D\u5B66" },
    { key: "high", label: "\u9AD8\u4E2D" },
    { key: "college", label: "\u5927\u5B66" },
    { key: "graduate", label: "\u7814\u7A76\u751F" }
  ];

  // packages/pet-core/src/data/art-assets.js
  var PIG_ART_ASSETS = Object.freeze({
    "badge-pig-blindbox-first": "pigs/badges/badge-pig-blindbox-first.png",
    "badge-pig-blindbox-six": "pigs/badges/badge-pig-blindbox-six.png",
    "badge-pig-blindbox-ten": "pigs/badges/badge-pig-blindbox-ten.png",
    "badge-pig-clean-ten": "pigs/badges/badge-pig-clean-ten.png",
    "badge-pig-devil": "pigs/badges/badge-pig-devil.png",
    "badge-pig-farm-first": "pigs/badges/badge-pig-farm-first.png",
    "badge-pig-farm-five": "pigs/badges/badge-pig-farm-five.png",
    "badge-pig-farm-ten": "pigs/badges/badge-pig-farm-ten.png",
    "badge-pig-first-class": "pigs/badges/badge-pig-first-class.png",
    "badge-pig-first-fish": "pigs/badges/badge-pig-first-fish.png",
    "badge-pig-first-job": "pigs/badges/badge-pig-first-job.png",
    "badge-pig-first-meal": "pigs/badges/badge-pig-first-meal.png",
    "badge-pig-first-trip": "pigs/badges/badge-pig-first-trip.png",
    "badge-pig-fish-five": "pigs/badges/badge-pig-fish-five.png",
    "badge-pig-gacha-first": "pigs/badges/badge-pig-gacha-first.png",
    "badge-pig-gacha-gold": "pigs/badges/badge-pig-gacha-gold.png",
    "badge-pig-gacha-machines": "pigs/badges/badge-pig-gacha-machines.png",
    "badge-pig-grown-up": "pigs/badges/badge-pig-grown-up.png",
    "badge-pig-jobs-hundred": "pigs/badges/badge-pig-jobs-hundred.png",
    "badge-pig-jobs-ten": "pigs/badges/badge-pig-jobs-ten.png",
    "badge-pig-king": "pigs/badges/badge-pig-king.png",
    "badge-pig-mine-deep": "pigs/badges/badge-pig-mine-deep.png",
    "badge-pig-mine-first": "pigs/badges/badge-pig-mine-first.png",
    "badge-pig-mine-fossils": "pigs/badges/badge-pig-mine-fossils.png",
    "badge-pig-pet-hundred": "pigs/badges/badge-pig-pet-hundred.png",
    "badge-pig-play-twenty": "pigs/badges/badge-pig-play-twenty.png",
    "badge-pig-souvenirs-three": "pigs/badges/badge-pig-souvenirs-three.png",
    "badge-pig-trips-ten": "pigs/badges/badge-pig-trips-ten.png",
    "career-astronaut": "pigs/skins/career-astronaut/idle.png",
    "career-astronaut-bathe": "pigs/skins/career-astronaut/bathe.png",
    "career-astronaut-eat": "pigs/skins/career-astronaut/eat.png",
    "career-astronaut-pet": "pigs/skins/career-astronaut/pet.png",
    "career-astronaut-play": "pigs/skins/career-astronaut/play.png",
    "career-astronaut-relaxed": "pigs/skins/career-astronaut/relaxed.png",
    "career-astronaut-sleep": "pigs/skins/career-astronaut/sleep.png",
    "career-astronaut-study": "pigs/skins/career-astronaut/study.png",
    "career-astronaut-trip": "pigs/skins/career-astronaut/trip.png",
    "career-astronaut-work": "pigs/skins/career-astronaut/work.png",
    "career-chef": "pigs/skins/career-chef/idle.png",
    "career-chef-bathe": "pigs/skins/career-chef/bathe.png",
    "career-chef-eat": "pigs/skins/career-chef/eat.png",
    "career-chef-pet": "pigs/skins/career-chef/pet.png",
    "career-chef-play": "pigs/skins/career-chef/play.png",
    "career-chef-relaxed": "pigs/skins/career-chef/relaxed.png",
    "career-chef-sleep": "pigs/skins/career-chef/sleep.png",
    "career-chef-study": "pigs/skins/career-chef/study.png",
    "career-chef-trip": "pigs/skins/career-chef/trip.png",
    "career-chef-work": "pigs/skins/career-chef/work.png",
    "elder": "pigs/base/elder/idle.png",
    "feedback/allergy": "pigs/feedback/allergy.png",
    "feedback/birthday": "pigs/feedback/birthday.png",
    "feedback/collection-badge": "pigs/feedback/collection-badge.png",
    "feedback/collection-bubbles": "pigs/feedback/collection-bubbles.png",
    "feedback/collection-cage": "pigs/feedback/collection-cage.png",
    "feedback/collection-check": "pigs/feedback/collection-check.png",
    "feedback/collection-chicken": "pigs/feedback/collection-chicken.png",
    "feedback/collection-courier": "pigs/feedback/collection-courier.png",
    "feedback/collection-fever": "pigs/feedback/collection-fever.png",
    "feedback/collection-fitness": "pigs/feedback/collection-fitness.png",
    "feedback/collection-letter": "pigs/feedback/collection-letter.png",
    "feedback/collection-mosquito": "pigs/feedback/collection-mosquito.png",
    "feedback/collection-scallion": "pigs/feedback/collection-scallion.png",
    "feedback/collection-snack": "pigs/feedback/collection-snack.png",
    "feedback/collection-soup": "pigs/feedback/collection-soup.png",
    "feedback/collection-stack": "pigs/feedback/collection-stack.png",
    "feedback/collection-taro": "pigs/feedback/collection-taro.png",
    "feedback/collection-throne": "pigs/feedback/collection-throne.png",
    "feedback/courier": "pigs/feedback/courier.png",
    "feedback/death-day": "pigs/feedback/death-day.png",
    "feedback/faint": "pigs/feedback/faint.png",
    "feedback/fishing": "pigs/feedback/fishing.png",
    "feedback/ghost-grave": "pigs/feedback/ghost-grave.png",
    "feedback/hungry": "pigs/feedback/hungry.png",
    "feedback/lie-flat": "pigs/feedback/lie-flat.png",
    "feedback/music-earbuds": "pigs/feedback/music-earbuds.png",
    "feedback/music-headphones-v2": "pigs/feedback/music-headphones-v2.png",
    "feedback/music-rainbow": "pigs/feedback/music-rainbow.png",
    "feedback/painting": "pigs/feedback/painting.png",
    "feedback/recruit": "pigs/feedback/recruit.png",
    "feedback/runny-nose": "pigs/feedback/runny-nose.png",
    "feedback/sleep-cloud": "pigs/feedback/sleep-cloud.png",
    "feedback/study-book": "pigs/feedback/study-book.png",
    "feedback/study-determined": "pigs/feedback/study-determined.png",
    "feedback/study-pink-book": "pigs/feedback/study-pink-book.png",
    "feedback/suspended": "pigs/feedback/suspended.png",
    "feedback/turning": "pigs/feedback/turning.png",
    "feedback/twitch": "pigs/feedback/twitch.png",
    "pig-devil": "pigs/forms/pig-devil/idle.png",
    "pig-devil-bathe": "pigs/forms/pig-devil/bathe.png",
    "pig-devil-eat": "pigs/forms/pig-devil/eat.png",
    "pig-devil-fly": "pigs/forms/pig-devil/fly.png",
    "pig-devil-pet": "pigs/forms/pig-devil/pet.png",
    "pig-devil-play": "pigs/forms/pig-devil/play.png",
    "pig-devil-relaxed": "pigs/forms/pig-devil/relaxed.png",
    "pig-devil-sleep": "pigs/forms/pig-devil/sleep.png",
    "pig-devil-study": "pigs/forms/pig-devil/study.png",
    "pig-devil-trip": "pigs/forms/pig-devil/trip.png",
    "pig-devil-work": "pigs/forms/pig-devil/work.png",
    "pig-fat": "pigs/forms/pig-fat/idle.png",
    "pig-fat-bathe": "pigs/forms/pig-fat/bathe.png",
    "pig-fat-eat": "pigs/forms/pig-fat/eat.png",
    "pig-fat-pet": "pigs/forms/pig-fat/pet.png",
    "pig-fat-play": "pigs/forms/pig-fat/play.png",
    "pig-fat-relaxed": "pigs/forms/pig-fat/relaxed.png",
    "pig-fat-sleep": "pigs/forms/pig-fat/sleep.png",
    "pig-fat-study": "pigs/forms/pig-fat/study.png",
    "pig-fat-trip": "pigs/forms/pig-fat/trip.png",
    "pig-fat-work": "pigs/forms/pig-fat/work.png",
    "pig-king": "pigs/forms/pig-king/idle.png",
    "pig-king-bathe": "pigs/forms/pig-king/bathe.png",
    "pig-king-eat": "pigs/forms/pig-king/eat.png",
    "pig-king-pet": "pigs/forms/pig-king/pet.png",
    "pig-king-play": "pigs/forms/pig-king/play.png",
    "pig-king-relaxed": "pigs/forms/pig-king/relaxed.png",
    "pig-king-sleep": "pigs/forms/pig-king/sleep.png",
    "pig-king-study": "pigs/forms/pig-king/study.png",
    "pig-king-trip": "pigs/forms/pig-king/trip.png",
    "pig-king-work": "pigs/forms/pig-king/work.png",
    "pig-round": "pigs/forms/pig-round/idle.png",
    "pig-round-bathe": "pigs/forms/pig-round/bathe.png",
    "pig-round-eat": "pigs/forms/pig-round/eat.png",
    "pig-round-pet": "pigs/forms/pig-round/pet.png",
    "pig-round-play": "pigs/forms/pig-round/play.png",
    "pig-round-relaxed": "pigs/forms/pig-round/relaxed.png",
    "pig-round-sleep": "pigs/forms/pig-round/sleep.png",
    "pig-round-study": "pigs/forms/pig-round/study.png",
    "pig-round-trip": "pigs/forms/pig-round/trip.png",
    "pig-round-work": "pigs/forms/pig-round/work.png",
    "piglet": "pigs/base/piglet/idle.png",
    "piglet-bathe": "pigs/base/piglet/bathe.png",
    "piglet-eat": "pigs/base/piglet/eat.png",
    "piglet-play": "pigs/base/piglet/play.png",
    "piglet-sleep": "pigs/base/piglet/sleep.png",
    "piglet-work": "pigs/base/piglet/work.png",
    "skin-angel": "pigs/skins/skin-angel/idle.png",
    "skin-angel-bathe": "pigs/skins/skin-angel/bathe.png",
    "skin-angel-eat": "pigs/skins/skin-angel/eat.png",
    "skin-angel-pet": "pigs/skins/skin-angel/pet.png",
    "skin-angel-play": "pigs/skins/skin-angel/play.png",
    "skin-angel-relaxed": "pigs/skins/skin-angel/relaxed.png",
    "skin-angel-sleep": "pigs/skins/skin-angel/sleep.png",
    "skin-angel-study": "pigs/skins/skin-angel/study.png",
    "skin-angel-trip": "pigs/skins/skin-angel/trip.png",
    "skin-angel-work": "pigs/skins/skin-angel/work.png",
    "skin-detective": "pigs/skins/skin-detective/idle.png",
    "skin-detective-bathe": "pigs/skins/skin-detective/bathe.png",
    "skin-detective-eat": "pigs/skins/skin-detective/eat.png",
    "skin-detective-pet": "pigs/skins/skin-detective/pet.png",
    "skin-detective-play": "pigs/skins/skin-detective/play.png",
    "skin-detective-relaxed": "pigs/skins/skin-detective/relaxed.png",
    "skin-detective-sleep": "pigs/skins/skin-detective/sleep.png",
    "skin-detective-study": "pigs/skins/skin-detective/study.png",
    "skin-detective-trip": "pigs/skins/skin-detective/trip.png",
    "skin-detective-work": "pigs/skins/skin-detective/work.png",
    "skin-mint": "pigs/skins/skin-mint/idle.png",
    "skin-mint-bathe": "pigs/skins/skin-mint/bathe.png",
    "skin-mint-eat": "pigs/skins/skin-mint/eat.png",
    "skin-mint-pet": "pigs/skins/skin-mint/pet.png",
    "skin-mint-play": "pigs/skins/skin-mint/play.png",
    "skin-mint-sleep": "pigs/skins/skin-mint/sleep.png",
    "skin-mint-work": "pigs/skins/skin-mint/work.png",
    "skin-pirate": "pigs/skins/skin-pirate/idle.png",
    "skin-pirate-bathe": "pigs/skins/skin-pirate/bathe.png",
    "skin-pirate-eat": "pigs/skins/skin-pirate/eat.png",
    "skin-pirate-pet": "pigs/skins/skin-pirate/pet.png",
    "skin-pirate-play": "pigs/skins/skin-pirate/play.png",
    "skin-pirate-relaxed": "pigs/skins/skin-pirate/relaxed.png",
    "skin-pirate-sleep": "pigs/skins/skin-pirate/sleep.png",
    "skin-pirate-study": "pigs/skins/skin-pirate/study.png",
    "skin-pirate-trip": "pigs/skins/skin-pirate/trip.png",
    "skin-pirate-work": "pigs/skins/skin-pirate/work.png",
    "skin-wizard": "pigs/skins/skin-wizard/idle.png",
    "skin-wizard-bathe": "pigs/skins/skin-wizard/bathe.png",
    "skin-wizard-eat": "pigs/skins/skin-wizard/eat.png",
    "skin-wizard-pet": "pigs/skins/skin-wizard/pet.png",
    "skin-wizard-play": "pigs/skins/skin-wizard/play.png",
    "skin-wizard-relaxed": "pigs/skins/skin-wizard/relaxed.png",
    "skin-wizard-sleep": "pigs/skins/skin-wizard/sleep.png",
    "skin-wizard-study": "pigs/skins/skin-wizard/study.png",
    "skin-wizard-trip": "pigs/skins/skin-wizard/trip.png",
    "skin-wizard-work": "pigs/skins/skin-wizard/work.png"
  });

  // src/client/art-path.js
  function artSource(key) {
    return ART_URL + (PIG_ART_ASSETS[key] ?? (key.startsWith("custom-") ? key : key + ".svg"));
  }
  function hasBuiltinArt(key) {
    return Object.hasOwn(PIG_ART_ASSETS, key);
  }

  // src/client/feedback-art.js
  var MOOD_ART = {
    hungry: ["hungry"],
    sleepy: ["sleep-cloud", "lie-flat"],
    lonely: ["lie-flat"],
    dirty: ["collection-mosquito"],
    happy: ["music-rainbow", "collection-stack"]
  };
  var ILLNESS_ART = {
    "cold:1": ["runny-nose"],
    "cold:2": ["collection-fever"],
    "cold:3": ["runny-nose"],
    "skin:1": ["allergy"],
    "skin:2": ["allergy"],
    "skin:3": ["allergy"],
    "skin:4": ["allergy"],
    "dizzy:1": ["faint"],
    "dizzy:2": ["faint"],
    "dizzy:3": ["faint"]
  };
  var REACTION_ART = {
    feed: ["collection-snack", "collection-soup"],
    bathe: ["collection-bubbles"],
    play: ["collection-chicken", "turning"],
    levelup: ["collection-throne"]
  };
  var IDLE_ART = {
    roll: ["turning", "collection-taro"],
    butterfly: ["collection-chicken", "collection-scallion"],
    look: ["collection-letter"],
    walk: ["collection-chicken", "collection-scallion"]
  };
  var WORK_ART = {
    flyers: "collection-letter",
    singer: "music-headphones-v2",
    songwriter: "music-earbuds",
    cartoonist: "painting",
    athlete: "collection-fitness",
    coach: "collection-fitness",
    gardener: "collection-scallion",
    florist: "collection-scallion",
    ceo: "collection-throne",
    star: "music-rainbow"
  };
  var STAGE_ART = { box: ["courier", "collection-courier"], "dead-day": ["death-day"], grave: ["ghost-grave"] };
  var STUDY_ART = ["study-book", "study-pink-book", "study-determined"];
  var INTEREST_ART = {
    fitness: ["collection-fitness"],
    guitar: ["music-earbuds", "music-headphones-v2"],
    dancing: ["music-earbuds", "music-headphones-v2"],
    calligraphy: ["painting"],
    photography: ["painting"],
    other: ["study-determined"]
  };
  var TRIP_ART = ["collection-chicken", "collection-taro", "collection-scallion"];
  var BIRTHDAY_ART = "birthday";
  var FEEDBACK_ART_TABLES = Object.freeze({
    stage: STAGE_ART,
    birthday: [BIRTHDAY_ART],
    reaction: REACTION_ART,
    illness: ILLNESS_ART,
    mood: MOOD_ART,
    work: WORK_ART,
    study: STUDY_ART,
    interest: INTEREST_ART,
    fishing: ["fishing"],
    trip: TRIP_ART,
    idle: IDLE_ART
  });
  var UNUSED_FEEDBACK_ART = Object.freeze(["collection-badge", "collection-check", "collection-cage", "suspended", "twitch"]);
  function choose(options, hour) {
    return options[Math.abs(Math.floor(hour)) % options.length];
  }
  function feedbackArtFor(state2) {
    if (STAGE_ART[state2.stage]) return choose(STAGE_ART[state2.stage], state2.hour);
    if (state2.party === true) return BIRTHDAY_ART;
    if (state2.base && state2.base !== "piglet") return null;
    if (REACTION_ART[state2.reaction]) return choose(REACTION_ART[state2.reaction], state2.hour);
    if (state2.mood === "sick") return ILLNESS_ART[state2.illness ?? ""] ? choose(ILLNESS_ART[state2.illness ?? ""], state2.hour) : null;
    if (state2.mood === "dirty") return choose(MOOD_ART.dirty, state2.hour);
    if (state2.activityKind === "work") return WORK_ART[state2.activityKey] ?? null;
    if (state2.activityKind === "study") return choose(STUDY_ART, state2.hour);
    if (state2.activityKind === "interest") return choose(INTEREST_ART[state2.activityKey] ?? INTEREST_ART.other, state2.hour);
    if (state2.activityKind === "fishing") return "fishing";
    if (state2.activityKind === "trip") return choose(TRIP_ART, state2.hour);
    if (IDLE_ART[state2.idle]) return choose(IDLE_ART[state2.idle], state2.hour);
    if (MOOD_ART[state2.mood]) return choose(MOOD_ART[state2.mood], state2.hour);
    return null;
  }

  // src/client/feedback-framing.js
  var FRAME_HEIGHT = 0.84375;
  var FEEDBACK_FRAMING = Object.freeze({
    "allergy": [1.2558, 0, 0],
    "birthday": [1.0746, 0, 0.21],
    "collection-badge": [0.9908, 0, 0],
    "collection-bubbles": [1.1192, 0, 0.22],
    "collection-cage": [0.9643, 0, 0],
    "collection-check": [1.0854, 0, 0.21],
    "collection-chicken": [0.9643, 0.19, 0],
    "collection-courier": [1.1803, 0, 0.23],
    "collection-fever": [1.1803, 0, 0.23],
    "collection-fitness": [1.3171, 0, 0],
    "collection-letter": [1.2632, 0, 0.25],
    "collection-mosquito": [1.3012, 0, 0],
    "collection-scallion": [1.0385, 0, 0],
    "collection-snack": [1.2632, 0, 0.25],
    "collection-soup": [0.9643, 0, 0],
    "collection-stack": [0.9643, 0, 0],
    "collection-taro": [1.1489, 0, 0],
    "collection-throne": [0.9643, 0, 0],
    "courier": [1.0286, 0, 0],
    "death-day": [1.5429, 0, 0],
    "faint": [1.1551, 0, 0.23],
    "fishing": [1.1368, 0, 0],
    "ghost-grave": [1.1934, 0, 0.23],
    "hungry": [1.0693, 0, 0],
    "lie-flat": [1.2706, 0, 0],
    "music-earbuds": [1.1134, 0, 0],
    "music-headphones-v2": [1.2343, 0, 0.24],
    "music-rainbow": [1.9115, 0, 0.37],
    "painting": [1.1309, 0, 0.22],
    "recruit": [1.0047, 0, 0.2],
    "runny-nose": [1.3252, 0, 0.26],
    "sleep-cloud": [1.3935, 0, 0.27],
    "study-book": [1.2632, 0, 0.25],
    "study-determined": [1.2, 0, 0],
    "study-pink-book": [1.1077, 0, 0.22],
    "suspended": [0.9643, 0, 0],
    "turning": [1.3171, 0, 0],
    "twitch": [1.2857, 0, 0]
  });
  var BUILTIN_FRAMING = Object.freeze({
    "pigs/skins/career-astronaut/idle.png": [1.0909, 0, 0],
    "pigs/skins/career-astronaut/bathe.png": [1.8, 0, 0],
    "pigs/skins/career-astronaut/eat.png": [1.2486, 0, 0.24],
    "pigs/skins/career-astronaut/pet.png": [0.9643, 0, 0],
    "pigs/skins/career-astronaut/play.png": [0.9818, 0, 0],
    "pigs/skins/career-astronaut/relaxed.png": [1.1077, 0, 0.22],
    "pigs/skins/career-astronaut/sleep.png": [1.4595, 0, 0],
    "pigs/skins/career-astronaut/study.png": [1.0909, 0, 0],
    "pigs/skins/career-astronaut/trip.png": [1.1803, 0, 0.23],
    "pigs/skins/career-astronaut/work.png": [1.6615, 0, 0],
    "pigs/skins/career-chef/idle.png": [1.0141, 0, 0.2],
    "pigs/skins/career-chef/bathe.png": [1.8, 0, 0],
    "pigs/skins/career-chef/eat.png": [1.064, 0, 0.21],
    "pigs/skins/career-chef/pet.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/play.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/relaxed.png": [1.0093, 0, 0],
    "pigs/skins/career-chef/sleep.png": [1.2343, 0, 0.24],
    "pigs/skins/career-chef/study.png": [0.9643, 0.19, 0],
    "pigs/skins/career-chef/trip.png": [1.0093, 0, 0],
    "pigs/skins/career-chef/work.png": [1.3012, 0, 0],
    "pigs/base/elder/idle.png": [1.2558, 0, 0],
    "pigs/forms/pig-devil/idle.png": [1.3012, 0, 0],
    "pigs/forms/pig-devil/bathe.png": [1.4211, 0, 0],
    "pigs/forms/pig-devil/eat.png": [1.4118, 0, 0.28],
    "pigs/forms/pig-devil/fly.png": [1.2934, 0, 0.25],
    "pigs/forms/pig-devil/pet.png": [1.1934, 0, 0.23],
    "pigs/forms/pig-devil/play.png": [1.1934, 0, 0.23],
    "pigs/forms/pig-devil/relaxed.png": [1.3252, 0, 0.26],
    "pigs/forms/pig-devil/sleep.png": [1.5211, 0, 0],
    "pigs/forms/pig-devil/study.png": [1.3012, 0, 0],
    "pigs/forms/pig-devil/trip.png": [1.35, 0, 0],
    "pigs/forms/pig-devil/work.png": [1.5, 0, 0],
    "pigs/forms/pig-fat/idle.png": [1.2343, 0, 0.24],
    "pigs/forms/pig-fat/bathe.png": [1.5, 0, 0],
    "pigs/forms/pig-fat/eat.png": [1.3671, 0, 0],
    "pigs/forms/pig-fat/pet.png": [1.0189, 0, 0],
    "pigs/forms/pig-fat/play.png": [1.4026, 0, 0],
    "pigs/forms/pig-fat/relaxed.png": [1.2343, 0, 0.24],
    "pigs/forms/pig-fat/sleep.png": [1.4694, 0, 0.29],
    "pigs/forms/pig-fat/study.png": [1.3758, 0, 0.27],
    "pigs/forms/pig-fat/trip.png": [1.3171, 0, 0],
    "pigs/forms/pig-fat/work.png": [1.9636, 0, 0],
    "pigs/forms/pig-king/idle.png": [1.0537, 0, 0.21],
    "pigs/forms/pig-king/bathe.png": [1.7851, 0, 0.35],
    "pigs/forms/pig-king/eat.png": [1.1489, 0, 0],
    "pigs/forms/pig-king/pet.png": [0.9643, 0, 0],
    "pigs/forms/pig-king/play.png": [0.9643, 0, 0],
    "pigs/forms/pig-king/relaxed.png": [1.0537, 0, 0.21],
    "pigs/forms/pig-king/sleep.png": [1.3935, 0, 0.27],
    "pigs/forms/pig-king/study.png": [1.0485, 0, 0],
    "pigs/forms/pig-king/trip.png": [1.0286, 0, 0],
    "pigs/forms/pig-king/work.png": [1.4595, 0, 0],
    "pigs/forms/pig-round/idle.png": [1.1803, 0, 0.23],
    "pigs/forms/pig-round/bathe.png": [1.4118, 0, 0.28],
    "pigs/forms/pig-round/eat.png": [1.2414, 0, 0],
    "pigs/forms/pig-round/pet.png": [1.0909, 0, 0],
    "pigs/forms/pig-round/play.png": [1.1429, 0, 0.22],
    "pigs/forms/pig-round/relaxed.png": [1.1803, 0, 0.23],
    "pigs/forms/pig-round/sleep.png": [1.35, 0, 0],
    "pigs/forms/pig-round/study.png": [1.102, 0, 0],
    "pigs/forms/pig-round/trip.png": [1.2, 0, 0],
    "pigs/forms/pig-round/work.png": [1.7008, 0, 0.33],
    "pigs/base/piglet/idle.png": [1.2203, 0, 0.24],
    "pigs/base/piglet/bathe.png": [1.4595, 0, 0],
    "pigs/base/piglet/eat.png": [1.2781, 0, 0.25],
    "pigs/base/piglet/play.png": [1.1077, 0, 0.22],
    "pigs/base/piglet/sleep.png": [1.4497, 0, 0.28],
    "pigs/base/piglet/work.png": [1.7008, 0, 0.33],
    "pigs/skins/skin-angel/idle.png": [1.0854, 0, 0.21],
    "pigs/skins/skin-angel/bathe.png": [1.2343, 0, 0.24],
    "pigs/skins/skin-angel/eat.png": [1.0964, 0, 0.21],
    "pigs/skins/skin-angel/pet.png": [1.0237, 0, 0.2],
    "pigs/skins/skin-angel/play.png": [0.9774, 0, 0.19],
    "pigs/skins/skin-angel/relaxed.png": [1.0854, 0, 0.21],
    "pigs/skins/skin-angel/sleep.png": [1.3846, 0, 0],
    "pigs/skins/skin-angel/study.png": [1.0047, 0, 0.2],
    "pigs/skins/skin-angel/trip.png": [1.1489, 0, 0],
    "pigs/skins/skin-angel/work.png": [1.44, 0, 0],
    "pigs/skins/skin-detective/idle.png": [1.1309, 0, 0.22],
    "pigs/skins/skin-detective/bathe.png": [1.9817, 0, 0.39],
    "pigs/skins/skin-detective/eat.png": [1.2, 0, 0],
    "pigs/skins/skin-detective/pet.png": [1.0588, 0, 0],
    "pigs/skins/skin-detective/play.png": [0.9954, 0, 0.19],
    "pigs/skins/skin-detective/relaxed.png": [1.1309, 0, 0.22],
    "pigs/skins/skin-detective/sleep.png": [1.35, 0, 0],
    "pigs/skins/skin-detective/study.png": [1.1192, 0, 0.22],
    "pigs/skins/skin-detective/trip.png": [1.1309, 0, 0.22],
    "pigs/skins/skin-detective/work.png": [1.5319, 0, 0.3],
    "pigs/skins/skin-mint/idle.png": [1.2135, 0, 0],
    "pigs/skins/skin-mint/bathe.png": [1.4595, 0, 0],
    "pigs/skins/skin-mint/eat.png": [1.2934, 0, 0.25],
    "pigs/skins/skin-mint/pet.png": [1.0335, 0, 0.2],
    "pigs/skins/skin-mint/play.png": [1.1551, 0, 0.23],
    "pigs/skins/skin-mint/sleep.png": [1.3585, 0, 0.27],
    "pigs/skins/skin-mint/work.png": [1.7008, 0, 0.33],
    "pigs/skins/skin-pirate/idle.png": [1.2414, 0, 0],
    "pigs/skins/skin-pirate/bathe.png": [1.9636, 0, 0],
    "pigs/skins/skin-pirate/eat.png": [1.3758, 0, 0.27],
    "pigs/skins/skin-pirate/pet.png": [1.0385, 0, 0],
    "pigs/skins/skin-pirate/play.png": [1.2632, 0, 0.25],
    "pigs/skins/skin-pirate/relaxed.png": [1.2486, 0, 0.24],
    "pigs/skins/skin-pirate/sleep.png": [1.5319, 0, 0.3],
    "pigs/skins/skin-pirate/study.png": [1.1613, 0, 0],
    "pigs/skins/skin-pirate/trip.png": [1.2706, 0, 0],
    "pigs/skins/skin-pirate/work.png": [1.6615, 0, 0],
    "pigs/skins/skin-wizard/idle.png": [0.973, 0, 0],
    "pigs/skins/skin-wizard/bathe.png": [1.9115, 0, 0.37],
    "pigs/skins/skin-wizard/eat.png": [1.0588, 0, 0],
    "pigs/skins/skin-wizard/pet.png": [1.0189, 0, 0],
    "pigs/skins/skin-wizard/play.png": [0.9643, 0, 0],
    "pigs/skins/skin-wizard/relaxed.png": [0.9908, 0, 0],
    "pigs/skins/skin-wizard/sleep.png": [1.2, 0, 0],
    "pigs/skins/skin-wizard/study.png": [1.0189, 0, 0],
    "pigs/skins/skin-wizard/trip.png": [0.9863, 0, 0.19],
    "pigs/skins/skin-wizard/work.png": [1.44, 0, 0]
  });
  var ART_BOUNDS = Object.freeze({
    "pigs/base/piglet/idle.png": [0.0625, 0.152344, 0.9375, 0.84375],
    "pigs/skins/career-chef/idle.png": [0.0625, 0.082031, 0.9375, 0.914062],
    "pigs/skins/skin-angel/idle.png": [0.0625, 0.109375, 0.9375, 0.886719],
    "pigs/forms/pig-round/idle.png": [0.0625, 0.140625, 0.9375, 0.855469],
    "pigs/forms/pig-fat/idle.png": [0.0625, 0.15625, 0.9375, 0.839844],
    "pigs/forms/pig-king/idle.png": [0.0625, 0.097656, 0.9375, 0.898438],
    "pigs/skins/skin-mint/idle.png": [0.0625, 0.152344, 0.9375, 0.847656],
    "pigs/forms/pig-devil/idle.png": [0.0625, 0.175781, 0.9375, 0.824219],
    "pigs/skins/career-astronaut/idle.png": [0.0625, 0.113281, 0.9375, 0.886719],
    "pigs/skins/skin-detective/idle.png": [0.0625, 0.125, 0.9375, 0.871094],
    "pigs/skins/skin-pirate/idle.png": [0.0625, 0.160156, 0.9375, 0.839844],
    "pigs/skins/skin-wizard/idle.png": [0.0625, 0.066406, 0.9375, 0.933594],
    "pigs/base/piglet/eat.png": [0.0625, 0.167969, 0.9375, 0.828125],
    "pigs/base/piglet/play.png": [0.0625, 0.117188, 0.9375, 0.878906],
    "pigs/base/piglet/sleep.png": [0.0625, 0.207031, 0.9375, 0.789062],
    "pigs/skins/career-chef/eat.png": [0.0625, 0.101562, 0.9375, 0.894531],
    "pigs/skins/career-chef/play.png": [0.117188, 0.0625, 0.882812, 0.9375],
    "pigs/skins/career-chef/sleep.png": [0.0625, 0.15625, 0.9375, 0.839844],
    "pigs/skins/skin-pirate/eat.png": [0.0625, 0.191406, 0.9375, 0.804688],
    "pigs/skins/skin-pirate/play.png": [0.0625, 0.164062, 0.9375, 0.832031],
    "pigs/skins/skin-pirate/sleep.png": [0.0625, 0.222656, 0.9375, 0.773438],
    "pigs/skins/skin-wizard/eat.png": [0.0625, 0.101562, 0.9375, 0.898438],
    "pigs/skins/skin-wizard/play.png": [0.074219, 0.0625, 0.925781, 0.9375],
    "pigs/skins/skin-wizard/sleep.png": [0.0625, 0.148438, 0.9375, 0.851562],
    "pigs/forms/pig-round/eat.png": [0.0625, 0.160156, 0.9375, 0.839844],
    "pigs/forms/pig-round/play.png": [0.0625, 0.128906, 0.9375, 0.867188],
    "pigs/forms/pig-round/sleep.png": [0.0625, 0.1875, 0.9375, 0.8125],
    "pigs/forms/pig-fat/eat.png": [0.0625, 0.191406, 0.9375, 0.808594],
    "pigs/forms/pig-fat/play.png": [0.0625, 0.199219, 0.9375, 0.800781],
    "pigs/forms/pig-fat/sleep.png": [0.0625, 0.210938, 0.9375, 0.785156],
    "pigs/skins/skin-mint/eat.png": [0.0625, 0.171875, 0.9375, 0.824219],
    "pigs/skins/skin-mint/play.png": [0.0625, 0.132812, 0.9375, 0.863281],
    "pigs/skins/skin-mint/sleep.png": [0.0625, 0.1875, 0.9375, 0.808594],
    "pigs/skins/skin-detective/eat.png": [0.0625, 0.148438, 0.9375, 0.851562],
    "pigs/skins/skin-detective/play.png": [0.0625, 0.074219, 0.9375, 0.921875],
    "pigs/skins/skin-detective/sleep.png": [0.0625, 0.1875, 0.9375, 0.8125],
    "pigs/forms/pig-king/eat.png": [0.0625, 0.132812, 0.9375, 0.867188],
    "pigs/forms/pig-king/sleep.png": [0.0625, 0.195312, 0.9375, 0.800781],
    "pigs/forms/pig-devil/eat.png": [0.0625, 0.199219, 0.9375, 0.796875],
    "pigs/forms/pig-devil/play.png": [0.0625, 0.144531, 0.9375, 0.851562],
    "pigs/forms/pig-devil/sleep.png": [0.0625, 0.222656, 0.9375, 0.777344],
    "pigs/skins/skin-angel/eat.png": [0.0625, 0.113281, 0.9375, 0.882812],
    "pigs/skins/skin-angel/play.png": [0.0625, 0.066406, 0.9375, 0.929688],
    "pigs/skins/skin-angel/sleep.png": [0.0625, 0.195312, 0.9375, 0.804688],
    "pigs/skins/career-astronaut/eat.png": [0.0625, 0.160156, 0.9375, 0.835938],
    "pigs/skins/career-astronaut/play.png": [0.0625, 0.070312, 0.9375, 0.929688],
    "pigs/skins/career-astronaut/sleep.png": [0.0625, 0.210938, 0.9375, 0.789062],
    "pigs/forms/pig-king/play.png": [0.070312, 0.0625, 0.929688, 0.9375],
    "pigs/skins/career-chef/pet.png": [0.070312, 0.0625, 0.929688, 0.9375],
    "pigs/skins/career-chef/relaxed.png": [0.0625, 0.082031, 0.9375, 0.917969],
    "pigs/skins/skin-pirate/pet.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/skins/skin-pirate/relaxed.png": [0.0625, 0.160156, 0.9375, 0.835938],
    "pigs/skins/skin-wizard/pet.png": [0.0625, 0.085938, 0.9375, 0.914062],
    "pigs/skins/skin-wizard/relaxed.png": [0.0625, 0.074219, 0.9375, 0.925781],
    "pigs/skins/career-astronaut/pet.png": [0.070312, 0.0625, 0.929688, 0.9375],
    "pigs/skins/career-astronaut/relaxed.png": [0.0625, 0.117188, 0.9375, 0.878906],
    "pigs/forms/pig-round/pet.png": [0.0625, 0.113281, 0.9375, 0.886719],
    "pigs/forms/pig-fat/pet.png": [0.0625, 0.085938, 0.9375, 0.914062],
    "pigs/forms/pig-round/relaxed.png": [0.0625, 0.140625, 0.9375, 0.855469],
    "pigs/forms/pig-fat/relaxed.png": [0.0625, 0.15625, 0.9375, 0.839844],
    "pigs/forms/pig-king/pet.png": [0.078125, 0.0625, 0.921875, 0.9375],
    "pigs/forms/pig-king/relaxed.png": [0.0625, 0.097656, 0.9375, 0.898438],
    "pigs/forms/pig-devil/pet.png": [0.0625, 0.144531, 0.9375, 0.851562],
    "pigs/forms/pig-devil/relaxed.png": [0.0625, 0.179688, 0.9375, 0.816406],
    "pigs/skins/skin-angel/pet.png": [0.0625, 0.085938, 0.9375, 0.910156],
    "pigs/skins/skin-angel/relaxed.png": [0.0625, 0.109375, 0.9375, 0.886719],
    "pigs/skins/skin-mint/pet.png": [0.0625, 0.089844, 0.9375, 0.90625],
    "pigs/skins/skin-detective/pet.png": [0.0625, 0.101562, 0.9375, 0.898438],
    "pigs/skins/skin-detective/relaxed.png": [0.0625, 0.125, 0.9375, 0.871094],
    "pigs/forms/pig-round/bathe.png": [0.0625, 0.199219, 0.9375, 0.796875],
    "pigs/forms/pig-fat/bathe.png": [0.0625, 0.21875, 0.9375, 0.78125],
    "pigs/base/piglet/bathe.png": [0.0625, 0.210938, 0.9375, 0.789062],
    "pigs/skins/career-chef/bathe.png": [0.0625, 0.265625, 0.9375, 0.734375],
    "pigs/skins/skin-pirate/bathe.png": [0.0625, 0.285156, 0.9375, 0.714844],
    "pigs/skins/skin-wizard/bathe.png": [0.0625, 0.277344, 0.9375, 0.71875],
    "pigs/skins/skin-detective/bathe.png": [0.0625, 0.285156, 0.9375, 0.710938],
    "pigs/forms/pig-king/bathe.png": [0.0625, 0.261719, 0.9375, 0.734375],
    "pigs/skins/skin-mint/bathe.png": [0.0625, 0.210938, 0.9375, 0.789062],
    "pigs/skins/career-astronaut/bathe.png": [0.0625, 0.265625, 0.9375, 0.734375],
    "pigs/forms/pig-devil/bathe.png": [0.0625, 0.203125, 0.9375, 0.796875],
    "pigs/skins/skin-angel/bathe.png": [0.0625, 0.15625, 0.9375, 0.839844],
    "pigs/skins/career-chef/study.png": [0.066406, 0.0625, 0.929688, 0.9375],
    "pigs/skins/career-chef/trip.png": [0.0625, 0.082031, 0.9375, 0.917969],
    "pigs/skins/skin-pirate/work.png": [0.0625, 0.246094, 0.9375, 0.753906],
    "pigs/skins/skin-pirate/study.png": [0.0625, 0.136719, 0.9375, 0.863281],
    "pigs/skins/skin-pirate/trip.png": [0.0625, 0.167969, 0.9375, 0.832031],
    "pigs/skins/skin-wizard/work.png": [0.0625, 0.207031, 0.9375, 0.792969],
    "pigs/skins/skin-wizard/study.png": [0.0625, 0.085938, 0.9375, 0.914062],
    "pigs/skins/skin-wizard/trip.png": [0.0625, 0.070312, 0.9375, 0.925781],
    "pigs/skins/career-astronaut/work.png": [0.0625, 0.246094, 0.9375, 0.753906],
    "pigs/skins/career-astronaut/study.png": [0.0625, 0.113281, 0.9375, 0.886719],
    "pigs/skins/career-astronaut/trip.png": [0.0625, 0.140625, 0.9375, 0.855469],
    "pigs/skins/career-chef/work.png": [0.0625, 0.175781, 0.9375, 0.824219],
    "pigs/forms/pig-round/work.png": [0.0625, 0.25, 0.9375, 0.746094],
    "pigs/forms/pig-round/study.png": [0.0625, 0.117188, 0.9375, 0.882812],
    "pigs/forms/pig-round/trip.png": [0.0625, 0.148438, 0.9375, 0.851562],
    "pigs/forms/pig-fat/work.png": [0.0625, 0.285156, 0.9375, 0.714844],
    "pigs/forms/pig-fat/study.png": [0.0625, 0.191406, 0.9375, 0.804688],
    "pigs/forms/pig-fat/trip.png": [0.0625, 0.179688, 0.9375, 0.820312],
    "pigs/forms/pig-king/work.png": [0.0625, 0.210938, 0.9375, 0.789062],
    "pigs/forms/pig-king/study.png": [0.0625, 0.097656, 0.9375, 0.902344],
    "pigs/forms/pig-king/trip.png": [0.0625, 0.089844, 0.9375, 0.910156],
    "pigs/forms/pig-devil/work.png": [0.0625, 0.21875, 0.9375, 0.78125],
    "pigs/forms/pig-devil/study.png": [0.0625, 0.175781, 0.9375, 0.824219],
    "pigs/forms/pig-devil/trip.png": [0.0625, 0.1875, 0.9375, 0.8125],
    "pigs/skins/skin-angel/work.png": [0.0625, 0.207031, 0.9375, 0.792969],
    "pigs/skins/skin-angel/study.png": [0.0625, 0.078125, 0.9375, 0.917969],
    "pigs/skins/skin-angel/trip.png": [0.0625, 0.132812, 0.9375, 0.867188],
    "pigs/skins/skin-detective/work.png": [0.0625, 0.222656, 0.9375, 0.773438],
    "pigs/skins/skin-detective/study.png": [0.0625, 0.121094, 0.9375, 0.875],
    "pigs/skins/skin-detective/trip.png": [0.0625, 0.125, 0.9375, 0.871094],
    "pigs/base/elder/idle.png": [0.0625, 0.164062, 0.9375, 0.835938],
    "pigs/forms/pig-devil/fly.png": [0.0625, 0.171875, 0.9375, 0.824219],
    "pigs/base/piglet/work.png": [0.0625, 0.25, 0.9375, 0.746094],
    "pigs/feedback/allergy.png": [0.0625, 0.164062, 0.9375, 0.835938],
    "pigs/feedback/birthday.png": [0.0625, 0.105469, 0.9375, 0.890625],
    "pigs/feedback/collection-badge.png": [0.0625, 0.074219, 0.9375, 0.925781],
    "pigs/feedback/collection-bubbles.png": [0.0625, 0.121094, 0.9375, 0.875],
    "pigs/feedback/collection-cage.png": [0.097656, 0.0625, 0.902344, 0.9375],
    "pigs/skins/skin-mint/work.png": [0.0625, 0.25, 0.9375, 0.746094],
    "pigs/badges/badge-pig-blindbox-first.png": [0.125, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-blindbox-six.png": [0.121094, 0.0625, 0.878906, 0.9375],
    "pigs/badges/badge-pig-blindbox-ten.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-clean-ten.png": [0.128906, 0.0625, 0.871094, 0.9375],
    "pigs/badges/badge-pig-devil.png": [0.113281, 0.0625, 0.882812, 0.9375],
    "pigs/badges/badge-pig-farm-first.png": [0.140625, 0.0625, 0.855469, 0.9375],
    "pigs/badges/badge-pig-farm-five.png": [0.128906, 0.0625, 0.871094, 0.9375],
    "pigs/badges/badge-pig-farm-ten.png": [0.132812, 0.0625, 0.867188, 0.9375],
    "pigs/badges/badge-pig-first-class.png": [0.125, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-first-fish.png": [0.121094, 0.0625, 0.878906, 0.9375],
    "pigs/badges/badge-pig-first-job.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-first-meal.png": [0.125, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-first-trip.png": [0.125, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-fish-five.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-gacha-first.png": [0.109375, 0.0625, 0.890625, 0.9375],
    "pigs/badges/badge-pig-gacha-gold.png": [0.125, 0.0625, 0.871094, 0.9375],
    "pigs/badges/badge-pig-gacha-machines.png": [0.117188, 0.0625, 0.882812, 0.9375],
    "pigs/badges/badge-pig-grown-up.png": [0.128906, 0.0625, 0.871094, 0.9375],
    "pigs/badges/badge-pig-jobs-ten.png": [0.128906, 0.0625, 0.871094, 0.9375],
    "pigs/badges/badge-pig-king.png": [0.117188, 0.0625, 0.882812, 0.9375],
    "pigs/badges/badge-pig-mine-deep.png": [0.125, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-mine-first.png": [0.121094, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-mine-fossils.png": [0.132812, 0.0625, 0.867188, 0.9375],
    "pigs/badges/badge-pig-pet-hundred.png": [0.125, 0.0625, 0.875, 0.9375],
    "pigs/badges/badge-pig-play-twenty.png": [0.128906, 0.0625, 0.871094, 0.9375],
    "pigs/badges/badge-pig-souvenirs-three.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-trips-ten.png": [0.125, 0.0625, 0.871094, 0.9375],
    "pigs/feedback/collection-check.png": [0.0625, 0.109375, 0.9375, 0.886719],
    "pigs/feedback/collection-chicken.png": [0.089844, 0.0625, 0.90625, 0.9375],
    "pigs/feedback/collection-courier.png": [0.0625, 0.140625, 0.9375, 0.855469],
    "pigs/feedback/collection-fever.png": [0.0625, 0.140625, 0.9375, 0.855469],
    "pigs/feedback/collection-fitness.png": [0.0625, 0.179688, 0.9375, 0.820312],
    "pigs/feedback/collection-letter.png": [0.0625, 0.164062, 0.9375, 0.832031],
    "pigs/feedback/collection-mosquito.png": [0.0625, 0.175781, 0.9375, 0.824219],
    "pigs/feedback/collection-scallion.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/feedback/collection-snack.png": [0.0625, 0.164062, 0.9375, 0.832031],
    "pigs/feedback/collection-soup.png": [0.09375, 0.0625, 0.90625, 0.9375],
    "pigs/feedback/collection-stack.png": [0.179688, 0.0625, 0.820312, 0.9375],
    "pigs/feedback/collection-taro.png": [0.0625, 0.132812, 0.9375, 0.867188],
    "pigs/feedback/collection-throne.png": [0.082031, 0.0625, 0.917969, 0.9375],
    "pigs/feedback/courier.png": [0.0625, 0.089844, 0.9375, 0.910156],
    "pigs/feedback/faint.png": [0.0625, 0.132812, 0.9375, 0.863281],
    "pigs/feedback/fishing.png": [0.0625, 0.128906, 0.9375, 0.871094],
    "pigs/feedback/ghost-grave.png": [0.0625, 0.144531, 0.9375, 0.851562],
    "pigs/feedback/hungry.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/feedback/lie-flat.png": [0.0625, 0.167969, 0.9375, 0.832031],
    "pigs/feedback/music-earbuds.png": [0.0625, 0.121094, 0.9375, 0.878906],
    "pigs/feedback/music-headphones-v2.png": [0.0625, 0.15625, 0.9375, 0.839844],
    "pigs/feedback/music-rainbow.png": [0.0625, 0.277344, 0.9375, 0.71875],
    "pigs/feedback/painting.png": [0.0625, 0.125, 0.9375, 0.871094],
    "pigs/feedback/recruit.png": [0.0625, 0.078125, 0.9375, 0.917969],
    "pigs/feedback/runny-nose.png": [0.0625, 0.179688, 0.9375, 0.816406],
    "pigs/feedback/sleep-cloud.png": [0.0625, 0.195312, 0.9375, 0.800781],
    "pigs/feedback/study-book.png": [0.0625, 0.164062, 0.9375, 0.832031],
    "pigs/feedback/study-determined.png": [0.0625, 0.148438, 0.9375, 0.851562],
    "pigs/feedback/study-pink-book.png": [0.0625, 0.117188, 0.9375, 0.878906],
    "pigs/feedback/suspended.png": [0.148438, 0.0625, 0.851562, 0.9375],
    "pigs/feedback/turning.png": [0.0625, 0.179688, 0.9375, 0.820312],
    "pigs/feedback/twitch.png": [0.0625, 0.171875, 0.9375, 0.828125],
    "pigs/badges/badge-pig-jobs-hundred.png": [0.136719, 0.0625, 0.859375, 0.9375],
    "pigs/feedback/death-day.png": [0.0625, 0.226562, 0.9375, 0.773438]
  });
  var MAX_ART_ASPECT = 2.055046;

  // src/client/art.js
  var REACTION_ART2 = { feed: "eat", bathe: "bathe", play: "play", pet: "pet", cure: "relaxed", levelup: "relaxed" };
  var ACTIVITY_ART = { work: "work", study: "study", interest: "study", trip: "trip", fishing: "fish" };
  var SLEEP_ART = /* @__PURE__ */ new Set([
    "piglet",
    "pig-round",
    "pig-fat",
    "pig-king",
    "pig-devil",
    "skin-mint",
    "career-chef",
    "career-astronaut",
    "skin-detective",
    "skin-angel",
    "skin-pirate",
    "skin-wizard"
  ]);
  var CUSTOM_FRAME_CACHE = /* @__PURE__ */ new Map();
  var CUSTOM_FRAME_PENDING = /* @__PURE__ */ new WeakMap();
  function applyFrame(image, frame2) {
    if (typeof image.style?.setProperty !== "function") return;
    image.style.setProperty("--art-zoom", frame2 ? String(frame2[0]) : "1");
    image.style.setProperty("--art-x", frame2 ? frame2[1] + "%" : "0%");
    image.style.setProperty("--art-y", frame2 ? frame2[2] + "%" : "0%");
  }
  function frameCustomImage(image, src, sleep = false) {
    if (!src.includes("/custom-")) {
      applyFrame(image, BUILTIN_FRAMING[src.slice(ART_URL.length)] ?? null);
      return;
    }
    const cached = CUSTOM_FRAME_CACHE.get(src);
    if (cached !== void 0) {
      applyFrame(image, cached);
      return;
    }
    if (CUSTOM_FRAME_PENDING.get(image) === src) return;
    applyFrame(image, null);
    CUSTOM_FRAME_PENDING.set(image, src);
    function measure2() {
      CUSTOM_FRAME_PENDING.delete(image);
      if (image.getAttribute("src") !== src) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.height = 128;
        canvas.width = sleep ? Math.round(128 * 1.2) : 128;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) return;
        const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / (image.naturalHeight || image.naturalWidth));
        const width = image.naturalWidth * fit, height = (image.naturalHeight || image.naturalWidth) * fit;
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
        for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] <= 16) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
        if (right <= left || bottom <= top) return;
        const zoom = FRAME_HEIGHT / ((bottom - top) / canvas.height);
        const frame2 = [
          zoom,
          (0.5 - (left + right) / (2 * canvas.width)) * zoom * 100,
          (0.5 - (top + bottom) / (2 * canvas.height)) * zoom * 100
        ];
        CUSTOM_FRAME_CACHE.set(src, frame2);
        applyFrame(image, frame2);
      } catch {
      }
    }
    if (image.complete && image.naturalWidth > 0) measure2();
    else image.addEventListener?.("load", measure2, { once: true });
  }
  function syncSleepArt(art, scenes, image) {
    var custom = typeof art === "string" && art.startsWith("custom-") && scenes.includes("sleep");
    var name = SLEEP_ART.has(art) ? art : "piglet";
    var src = artSource((custom ? art : name) + "-sleep");
    if (image.getAttribute("src") !== src) image.src = src;
    frameCustomImage(image, src, true);
  }
  var forcedFeedback = null;
  function forceFeedbackArt(name) {
    forcedFeedback = typeof name === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(name) ? name : null;
  }
  function syncPigArt(pig, image, emoji) {
    var base = pig.getAttribute("data-art") || "";
    var feedback = forcedFeedback || feedbackArtFor({
      stage: pig.getAttribute("data-stage") || "",
      base,
      mood: pig.getAttribute("data-mood") || "",
      reaction: pig.getAttribute("data-react") || "",
      idle: pig.getAttribute("data-idle") || "",
      activityKind: pig.getAttribute("data-activity") || "",
      activityKey: pig.getAttribute("data-activity-key") || "",
      illness: pig.getAttribute("data-illness") || "",
      party: pig.getAttribute("data-party") === "true",
      hour: Math.floor(Date.now() / 36e5)
    });
    if (feedback) {
      var feedbackSrc = artSource("feedback/" + feedback);
      if (image.getAttribute("src") !== feedbackSrc) image.src = feedbackSrc;
      applyFrame(image, FEEDBACK_FRAMING[feedback] ?? null);
      image.hidden = false;
      pig.setAttribute("data-feedback", "true");
      if (emoji) emoji.hidden = true;
      return true;
    }
    if (!base) {
      applyFrame(image, null);
      image.hidden = true;
      if (image.getAttribute("src")) image.removeAttribute("src");
      pig.setAttribute("data-feedback", "false");
      if (emoji) emoji.hidden = false;
      return false;
    }
    var art = base;
    if (pig.getAttribute("data-art-actions") === "true" || base === "piglet") {
      var action = REACTION_ART2[pig.getAttribute("data-react")] || ACTIVITY_ART[pig.getAttribute("data-activity")];
      var scenes = String(pig.getAttribute("data-art-scenes") || "").split(",");
      if (action && (base === "piglet" || scenes[0] === "" || scenes.indexOf(action) >= 0) && (base.startsWith("custom-") || hasBuiltinArt(base + "-" + action))) art += "-" + action;
    }
    var src = artSource(art);
    if (image.getAttribute("src") !== src) image.src = src;
    frameCustomImage(image, src);
    image.hidden = false;
    pig.setAttribute("data-feedback", "false");
    if (emoji) emoji.hidden = true;
    return true;
  }

  // src/client/pet-parts.js
  var PART_FX = {
    head: ["\u2764\uFE0F"],
    ears: ["\u3030\uFE0F", "\u2764\uFE0F"],
    nose: ["\u{1F4A6}"],
    belly: ["\u{1F606}", "\u2764\uFE0F"],
    back: ["\u2728"],
    tail: ["\u{1F300}"],
    feet: ["\u{1F43E}"]
  };
  function partFor(fx, fy) {
    if (fy > 0.8) return "feet";
    if (fx > 0.8 && fy < 0.45) return "tail";
    if (fx < 0.42 && fy > 0.58) return "nose";
    if (fx < 0.45 && fy < 0.38) return "ears";
    if (fx < 0.5) return "head";
    if (fy > 0.6) return "belly";
    return "back";
  }
  function partAt(pig, event) {
    if (!pig || typeof pig.getBoundingClientRect !== "function" || typeof event?.clientX !== "number") return "head";
    var box = pig.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return "head";
    var fx = (event.clientX - box.left) / box.width;
    var fy = (event.clientY - box.top) / box.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return "head";
    return partFor(fx, fy);
  }

  // src/client/values.js
  var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  var obj = (v) => isObj(v) ? v : {};
  var arr = (v) => Array.isArray(v) ? v : [];
  var num = (v, dflt) => typeof v === "number" && isFinite(v) ? v : dflt;
  var str = (v, dflt) => typeof v === "string" && v !== "" ? v : dflt;

  // src/client/dom.js
  function el(tag2, className, text) {
    var node = document.createElement(tag2);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function button(className, attrs, onClick) {
    var node = el("button", className);
    node.type = "button";
    for (var key in attrs) node.setAttribute(key, attrs[key]);
    node.addEventListener("click", function(event) {
      event.stopPropagation();
      onClick(event);
    });
    return node;
  }
  function meter(value, variant) {
    var wrap = el("div", "dp-meter" + (variant ? " " + variant : ""));
    var fill = document.createElement("i");
    fill.style.width = Math.max(0, Math.min(100, num(value, 0))) + "%";
    wrap.appendChild(fill);
    return wrap;
  }
  function sideScroller(strip, active) {
    if (typeof strip.addEventListener === "function") {
      strip.addEventListener("wheel", function(event) {
        if (strip.scrollWidth <= strip.clientWidth) return;
        var delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (delta === 0) return;
        strip.scrollLeft += delta;
        event.preventDefault();
      }, { passive: false });
    }
    if (active && typeof active.offsetLeft === "number") {
      strip.scrollLeft = Math.max(0, active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2);
    }
  }

  // src/client/effects.js
  function createEffects(deps) {
    var scene3 = deps.scene;
    var pig = deps.pig;
    var card2 = deps.card;
    var bubble = deps.bubble;
    var pomoHint = deps.pomoHint ?? null;
    var isStopped = deps.isStopped;
    var reactTimer = null;
    var bubbleTimer = null;
    var transformTimer = null;
    var transformLayer = null;
    function transform(kind) {
      if (transformTimer !== null) window.clearTimeout(transformTimer);
      if (transformLayer !== null) transformLayer.remove();
      var emojis = kind === "contract" ? ["\u{1F608}", "\u{1F525}"] : ["\u{1F451}", "\u2728"];
      var layer = el("div", "dp-transform");
      layer.setAttribute("aria-hidden", "true");
      for (var i = 0; i < 16; i += 1) {
        var falling = el("span", "dp-transform-fall", emojis[i % 2]);
        falling.style.left = i * 47 % 101 + "%";
        falling.style.setProperty("--delay", i % 5 * 0.07 + "s");
        falling.style.setProperty("--drift", (i % 3 - 1) * 34 + "px");
        layer.appendChild(falling);
      }
      var center = pig.getBoundingClientRect();
      var pop = el("span", "dp-transform-pop", emojis[0]);
      pop.style.left = center.left + center.width / 2 + "px";
      pop.style.top = center.top + center.height / 2 + "px";
      layer.appendChild(pop);
      document.body.appendChild(layer);
      transformLayer = layer;
      transformTimer = window.setTimeout(function() {
        layer.remove();
        if (transformLayer === layer) transformLayer = null;
        transformTimer = null;
      }, 1450);
    }
    function react(kind, ms) {
      if (reactTimer !== null) window.clearTimeout(reactTimer);
      pig.removeAttribute("data-react");
      void pig.offsetWidth;
      pig.setAttribute("data-react", kind);
      syncPigArt(pig, deps.pigArt, deps.pigEmoji);
      reactTimer = window.setTimeout(function() {
        pig.removeAttribute("data-react");
        syncPigArt(pig, deps.pigArt, deps.pigEmoji);
        reactTimer = null;
      }, ms || 900);
    }
    function burst(emojis, count) {
      for (var i = 0; i < (count || 1); i += 1) {
        (function(index) {
          window.setTimeout(function() {
            if (isStopped()) return;
            var node = el("span", "dp-fx", emojis[index % emojis.length]);
            node.style.setProperty("--dx", Math.round((Math.random() - 0.5) * 46) + "px");
            var spot = headSpot();
            node.style.left = spot.x + Math.round((Math.random() - 0.5) * 22) + "px";
            node.style.top = spot.y + "px";
            scene3.appendChild(node);
            window.setTimeout(function() {
              node.remove();
            }, 1200);
          }, index * 110);
        })(i);
      }
    }
    function headSpot() {
      var fallback = { x: 24, y: 8 };
      if (typeof pig.getBoundingClientRect !== "function" || typeof scene3.getBoundingClientRect !== "function") return fallback;
      var p = pig.getBoundingClientRect();
      var s = scene3.getBoundingClientRect();
      if (p.width === 0 && p.height === 0) return fallback;
      return { x: p.left - s.left + p.width / 2, y: p.top - s.top - 20 };
    }
    var REACTIONS = {
      hatch: { kind: "levelup", ms: 980, fx: ["\u{1F95A}", "\u2728", "\u{1F416}", "\u{1F389}"], count: 4, say: "\u5B75\u51FA\u6765\u5566\uFF01" },
      feed: { kind: "feed", ms: 900, fx: ["\u{1F34E}", "\u{1F60B}", "\u2728"], count: 3, say: "\u5403\u6389\u4E86\uFF01" },
      bathe: { kind: "bathe", ms: 1050, fx: ["\u{1FAE7}", "\u{1FAE7}", "\u{1F4A7}", "\u2728"], count: 4, say: "\u6D17\u5E72\u51C0\u5566\uFF5E" },
      play: { kind: "play", ms: 900, fx: ["\u{1F3BE}", "\u2B50", "\u{1F4A8}"], count: 3, say: "\u597D\u5F00\u5FC3\uFF01" },
      pet: { kind: "pet", ms: 420, fx: ["\u2764\uFE0F"], count: 1, say: "\u597D\u8212\u670D\u2026" },
      work: { kind: "away", ms: 900, fx: ["\u{1F4BC}", "\u{1F9F1}", "\u{1FA99}"], count: 3, say: "\u51FA\u95E8\u6253\u5DE5\uFF01" },
      study: { kind: "away", ms: 900, fx: ["\u{1F4DA}", "\u270F\uFE0F", "\u{1F9E0}"], count: 3, say: "\u4E0A\u5B66\u53BB\uFF01" },
      trip: { kind: "away", ms: 900, fx: ["\u{1F9F3}", "\u{1F5FA}", "\u2728"], count: 3, say: "\u51FA\u53D1\u65C5\u884C\uFF01" },
      calloff: { kind: "refuse", ms: 520, fx: ["\u{1F4A8}"], count: 1, say: "\u63D0\u524D\u56DE\u6765\u4E86\u2026" },
      buy: { kind: "pet", ms: 620, fx: ["\u{1FA99}", "\u{1F6D2}"], count: 2, say: "\u4E70\u5230\u4E86\uFF01" },
      use: { kind: "pet", ms: 620, fx: ["\u2728"], count: 2, say: "\u7528\u6389\u4E86\u3002" }
    };
    var SPOKEN_BY_HOST = { feed: true, bathe: true, play: true, pet: true, work: true, study: true, trip: true, buy: true, use: true };
    function flash(action, extra) {
      var spec = REACTIONS[action];
      if (spec === void 0) return;
      react(spec.kind, spec.ms);
      var part = action === "pet" && extra ? PART_FX[extra.part] : void 0;
      burst(part ?? spec.fx, part ? part.length : spec.count);
      if (!SPOKEN_BY_HOST[action]) showBubble(spec.say, 1600);
    }
    var bubbleTimer = null;
    function showBubble(text, ms) {
      if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
      bubble.setAttribute("data-bubble-shown", "true");
      bubble.textContent = "";
      bubble.appendChild(el("span", "dp-bubble-text", text));
      bubble.hidden = false;
      if (pomoHint !== null) pomoHint.hidden = true;
      bubbleTimer = window.setTimeout(function() {
        bubble.hidden = true;
        bubbleTimer = null;
        if (pomoHint !== null) pomoHint.hidden = pomoHint.getAttribute("data-pomo") !== "on";
      }, ms || 2600);
    }
    function showLine(text, replies, onReply) {
      if (replies.length === 0) {
        showBubble(text, 2600);
        return;
      }
      if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
      bubble.textContent = "";
      bubble.appendChild(el("span", "dp-bubble-text", text));
      var row = el("div", "dp-bubble-replies", "");
      replies.forEach(function(label, index) {
        var answer = el("button", "dp-reply", label);
        answer.type = "button";
        answer.addEventListener("click", function(event) {
          event.stopPropagation();
          bubble.hidden = true;
          if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
          bubbleTimer = null;
          onReply(index);
        });
        row.appendChild(answer);
      });
      bubble.appendChild(row);
      bubble.hidden = false;
      bubbleTimer = window.setTimeout(function() {
        bubble.hidden = true;
        bubbleTimer = null;
      }, 6e3);
    }
    function toast(text) {
      var node = el("div", "dp-toast", text);
      card2.insertBefore(node, card2.firstChild);
      window.setTimeout(function() {
        node.remove();
      }, 4800);
    }
    function dispose() {
      if (reactTimer !== null) window.clearTimeout(reactTimer);
      if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
      if (transformTimer !== null) window.clearTimeout(transformTimer);
      if (transformLayer !== null) transformLayer.remove();
      reactTimer = null;
      bubbleTimer = null;
      transformTimer = null;
      transformLayer = null;
    }
    return { react, burst, transform, flash, showBubble, showLine, toast, dispose };
  }

  // src/client/tabs/pomodoro.js
  function clockText(seconds) {
    var left = Math.max(0, Math.round(seconds));
    var mm = Math.floor(left / 60);
    var ss = left % 60;
    return mm + ":" + (ss < 10 ? "0" : "") + ss;
  }
  function renderPomodoroTab(ui) {
    var view = ui.view.pomodoro;
    if (view === null) {
      ui.content.appendChild(el("div", "dp-empty", "\u5BBF\u4E3B\u8FD8\u6CA1\u63D0\u4F9B\u756A\u8304\u949F\u3002"));
      return;
    }
    if (view.active) {
      var live = el("div", "dp-pomo-live");
      live.appendChild(el("div", "dp-pomo-clock", "\u{1F345} " + clockText(view.secondsLeft)));
      live.appendChild(el("div", "dp-dim", "\u4E13\u6CE8 " + view.minutes + " \u5206\u949F \xB7 \u8FD9\u671F\u95F4\u6211\u4E0D\u5435\u4F60"));
      ui.content.appendChild(live);
      var stop = button("dp-btn dp-btn-wide", { "data-pomo-abandon": "true" }, function() {
        ui.send("pomodoroAbandon");
      });
      stop.textContent = "\u653E\u5F03\u8FD9\u4E00\u4E2A";
      ui.content.appendChild(stop);
    } else {
      if (view.breakSecondsLeft > 0) {
        var rest = el("div", "dp-empty", "\u2615 \u4F11\u606F " + clockText(view.breakSecondsLeft) + "\uFF08\u4E5F\u53EF\u4EE5\u76F4\u63A5\u5F00\u4E0B\u4E00\u4E2A\uFF09");
        rest.setAttribute("data-pomo-break", "true");
        ui.content.appendChild(rest);
      }
      var head = el("div", "dp-title");
      head.appendChild(el("b", null, "\u{1F345} \u4E13\u6CE8\u591A\u4E45\uFF1F"));
      head.appendChild(el("span", null, "\u4F11\u606F " + view.breakMinutes + " \u5206\u949F"));
      ui.content.appendChild(head);
      var row = el("div", "dp-dev-row");
      for (var i = 0; i < view.options.length; i += 1) {
        (function(minutes) {
          var start2 = button("dp-mini dp-dev-btn", { "data-pomo-start": String(minutes) }, function() {
            ui.send("pomodoro", { minutes });
          });
          start2.textContent = minutes + " \u5206\u949F";
          row.appendChild(start2);
        })(view.options[i]);
      }
      ui.content.appendChild(row);
    }
    var today2 = el("div", "dp-row");
    today2.appendChild(el("span", null, "\u4ECA\u5929\u5B8C\u6210"));
    today2.appendChild(el("b", null, view.todayDone + " \u4E2A"));
    ui.content.appendChild(today2);
    ui.content.appendChild(el(
      "div",
      "dp-dim",
      "\u6BCF\u5B8C\u6210\u4E00\u4E2A +" + view.reward.coins + " \u{1FA99} \xB7 \u5FC3\u60C5 +" + view.reward.happiness
    ));
  }

  // src/client/pomodoro-clock.js
  function createPomodoroClock(getView, pill, content, refresh2, isStopped) {
    var seen = null;
    var endsAt = 0;
    var breakEndsAt = 0;
    function resync(local, server) {
      if (local === 0 || server === 0) return server;
      return Math.abs(server - local) > 1500 ? server : local;
    }
    function tick2() {
      if (isStopped()) {
        window.clearInterval(timer2);
        return;
      }
      var p = getView().pomodoro;
      var now = Date.now();
      if (p && p !== seen) {
        seen = p;
        endsAt = resync(endsAt, p.active ? now + p.secondsLeft * 1e3 : 0);
        breakEndsAt = resync(breakEndsAt, !p.active && p.breakSecondsLeft > 0 ? now + p.breakSecondsLeft * 1e3 : 0);
      }
      if (endsAt > 0) {
        var left = Math.max(0, Math.ceil((endsAt - now) / 1e3));
        var text = "\u{1F345} " + clockText(left);
        if (pill.getAttribute("data-pomo") === "on") pill.textContent = text;
        var clock = content.querySelector(".dp-pomo-clock");
        if (clock !== null) clock.textContent = text;
        if (left === 0) {
          endsAt = 0;
          refresh2();
        }
      }
      if (breakEndsAt > 0) {
        var rest = Math.max(0, Math.ceil((breakEndsAt - now) / 1e3));
        var note = content.querySelector("[data-pomo-break]");
        if (note !== null) note.textContent = "\u2615 \u4F11\u606F " + clockText(rest) + "\uFF08\u4E5F\u53EF\u4EE5\u76F4\u63A5\u5F00\u4E0B\u4E00\u4E2A\uFF09";
        if (rest === 0) breakEndsAt = 0;
      }
    }
    var timer2 = window.setInterval(tick2, 1e3);
    return { tick: tick2, dispose: function() {
      window.clearInterval(timer2);
    } };
  }

  // src/client/journal.js
  var LOG_URL = "/dsh-piggy/logs/client";
  var LIMIT = 200;
  var FLUSH_DELAY_MS = 2e4;
  var MAX_TEXT = 2e3;
  var entries = [];
  var seq = 0;
  var sent = 0;
  var timer = null;
  var installed = false;
  var clip = (value, limit) => {
    const text = String(value ?? "");
    return text.length > limit ? text.slice(0, limit) + "\u2026" : text;
  };
  function record(level, scope, message2, fields = {}) {
    seq += 1;
    entries.push({
      id: "c" + seq,
      at: Date.now(),
      level: ["debug", "info", "warn", "error"].includes(level) ? level : "info",
      scope: clip(scope, 32),
      message: clip(message2, MAX_TEXT),
      fields: fields !== null && typeof fields === "object" ? fields : {}
    });
    if (entries.length > LIMIT) entries.splice(0, entries.length - LIMIT);
    schedule();
    return entries[entries.length - 1];
  }
  function schedule() {
    if (timer !== null || typeof window === "undefined" || typeof window.setTimeout !== "function") return;
    timer = window.setTimeout(() => {
      timer = null;
      flush();
    }, FLUSH_DELAY_MS);
  }
  var unsent = () => entries.slice(sent);
  async function flush() {
    const batch = unsent();
    if (batch.length === 0) return true;
    sent = entries.length;
    try {
      const response = await fetch(LOG_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: batch })
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return true;
    } catch {
      sent = Math.max(0, sent - batch.length);
      return false;
    }
  }
  function flushSoon() {
    Promise.resolve(flush()).catch(() => {
    });
  }
  function installCapture() {
    if (installed || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    installed = true;
    window.addEventListener("error", (event) => {
      const error = event?.error;
      record("error", "client", "uncaught: " + clip(error?.message ?? event?.message ?? "\u672A\u77E5\u9519\u8BEF", 500), {
        source: clip(event?.filename, 200),
        line: event?.lineno ?? null,
        stack: clip(error?.stack, 1200)
      });
      flushSoon();
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event?.reason;
      record("error", "client", "unhandled rejection: " + clip(reason?.message ?? reason ?? "\u672A\u77E5\u539F\u56E0", 500), {
        stack: clip(reason?.stack, 1200)
      });
      flushSoon();
    });
  }
  async function flushBeforeExport() {
    await flush();
  }

  // src/client/io.js
  function createIo(ctx) {
    var actionSeq = 0;
    var hostDown = false;
    async function send2(action, extra) {
      if (ctx.busy || ctx.stopped) return null;
      if (ctx.view.pig === null && action !== "hatch") return null;
      actionSeq += 1;
      ctx.busy = true;
      ctx.flash(action, extra);
      try {
        var body = { action };
        if (extra) for (var k in extra) body[k] = extra[k];
        var res = await fetch(ACT_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        var next = await res.json();
        if (action === "buy" && next?.ok === true) ctx.justBought = extra?.item ?? null;
        ctx.render(next);
        if ((action === "signIn" || action === "openGift") && next?.ok === true) {
          var reward = str(next.reward, "");
          ctx.showBubble((action === "signIn" ? "\u7B7E\u5230\u6210\u529F" : "\u793C\u5305\u6253\u5F00") + (reward ? " \xB7 " + reward : ""), 4e3);
        }
        if (next && next.ok === false) {
          if (next.reason === "stale-line") return next;
          if (next.reason === "silent") return next;
          ctx.react("refuse", 520);
          if (next.reason === "no-item") {
            var emptyKind = str(next.kind, "");
            ctx.showBubble(NO_ITEM_LINE[emptyKind] ?? "\u80CC\u5305\u91CC\u6CA1\u6709\u80FD\u7528\u7684\u4E1C\u897F", 3200);
            return next;
          }
          if (next.reason === "contract-ineligible" || next.reason === "coronation-ineligible") {
            var lacks = (Array.isArray(next.missing) ? next.missing : []).map(function(row) {
              return str(row.label, "") + " " + num(row.have, 0) + "/" + num(row.need, 0);
            }).join(" \xB7 ");
            var actionName = next.reason === "contract-ineligible" ? "\u7B7E\u7EA6" : "\u52A0\u5195";
            ctx.showBubble(lacks === "" ? actionName + "\u6761\u4EF6\u8FD8\u6CA1\u9F50" : actionName + "\u8FD8\u5DEE\uFF1A" + lacks, 3400);
            return next;
          }
          var reasons = {
            box: "\u5148\u628A\u7EB8\u76D2\u62C6\u5F00",
            "needs-item": "\u8FD8\u6CA1\u6709\u738B\u51A0\uFF0C\u53BB\u5546\u5E97\u7684\u664B\u5347\u8D27\u67B6\u4E70",
            "coronation-ineligible": "\u52A0\u5195\u6761\u4EF6\u8FD8\u6CA1\u9F50",
            "contract-ineligible": "\u5951\u7EA6\u8FD8\u6CA1\u751F\u6548\uFF1A\u6761\u4EF6\u6CA1\u8865\u9F50",
            "needs-contract": "\u8FD9\u4E00\u79CD\u8981\u7B7E\u7EA6\uFF0C\u4E0D\u662F\u52A0\u5195",
            "not-a-contract": "\u8FD9\u4E0D\u662F\u5951\u7EA6",
            already: "\u5B83\u5DF2\u7ECF\u662F\u8FD9\u4E2A\u6837\u5B50\u4E86",
            cooldown: "\u8FD8\u8981\u7B49 " + num(next.wait, 0) + " \u79D2",
            poor: "\u94B1\u4E0D\u591F",
            away: "\u5B83\u5728\u5916\u9762",
            weak: "\u592A\u865A\u5F31\u4E86\uFF0C\u5148\u517B\u597D\u518D\u51FA\u95E8",
            hungry: "\u592A\u997F\u4E86",
            "trip-locked": "\u8FD9\u91CC\u8981" + str(next.need, "\u6EE1\u8DB3\u6761\u4EF6") + "\u624D\u80FD\u53BB",
            "no-bait": "\u9C7C\u9975\u4E0D\u591F" + (next.need ? "\uFF0C\u672C\u6B21\u9700\u8981 " + num(next.need, 0) + " \u4E2A" : "") + "\uFF0C\u53BB\u5546\u5E97\u7684\u9C7C\u9975\u8D27\u67B6\u4E70",
            escaped: "\u9C7C\u8DD1\u6389\u4E86\uFF0C\u518D\u629B\u4E00\u6B21\u5427",
            "wrong-medicine": "\u836F\u4E0D\u5BF9\u75C7\uFF0C\u75C5\u60C5\u52A0\u91CD\u4E86\u2026",
            empty: "\u80CC\u5305\u91CC\u6CA1\u6709",
            "not-sick": "\u5B83\u6CA1\u751F\u75C5",
            dead: "\u5B83\u5DF2\u7ECF\u8D70\u4E86\u2026",
            idle: "\u5B83\u6CA1\u5728\u5916\u9762",
            owned: "\u8FD9\u4EF6\u5DF2\u7ECF\u6709\u4E86",
            "low-level": "\u7B49\u7EA7\u4E0D\u591F\uFF08\u8981 Lv." + num(next.need, 0) + "\uFF0C\u73B0\u5728 Lv." + num(next.have, 0) + "\uFF09",
            "not-owned": "\u8FD8\u6CA1\u6709\u8FD9\u4EF6\u4E1C\u897F",
            "not-consumable": "\u8FD9\u4E2A\u662F\u7A7F\u7684\uFF0C\u4E0D\u662F\u7528\u7684",
            "wrong-stage": "\u8FD9\u4E2A\u5B66\u6BB5\u6CA1\u6709\u8FD9\u95E8\u8BFE",
            underqualified: "\u5B83\u8FD8\u6CA1\u8FD9\u4E2A\u672C\u4E8B\uFF0C\u5148\u53BB\u4E0A\u8BFE",
            // v0.30 扩展下载 / 删除
            "download-failed": "\u6269\u5C55\u6CA1\u88C5\u4E0A" + (next.message ? "\uFF1A" + str(next.message, "") : ""),
            "game-too-old": "\u8981\u5148\u628A\u6E38\u620F\u66F4\u65B0\u5230 v" + str(next.need, ""),
            "broken-extension": "\u8FD9\u4E2A\u6269\u5C55\u574F\u4E86\uFF0C\u88C5\u4E0D\u4E0A",
            "not-installed": "\u8FD9\u4E2A\u6269\u5C55\u8FD8\u6CA1\u88C5",
            "extension-off": "\u8FD9\u4E2A\u6269\u5C55\u5173\u7740",
            "extension-error": "\u8FD9\u4E2A\u6269\u5C55\u51FA\u9519\u4E86",
            "unknown-extension": "\u6CA1\u6709\u8FD9\u4E2A\u6269\u5C55",
            "no-ticket": "\u6CA1\u6709\u76F2\u76D2\u5238\u4E86",
            "no-shards": "\u788E\u7247\u8FD8\u4E0D\u591F",
            "no-certs": "\u8D44\u8D28\u51ED\u8BC1\u4E0D\u591F",
            "too-small": "\u592A\u5C11\u4E86\uFF0C\u6362\u4E0D\u51FA 1 \u4E2A\u91D1\u5E01",
            "not-buyable": "\u8FD9\u79CD\u5E01\u53EA\u80FD\u5728\u6269\u5C55\u91CC\u6323\uFF0C\u4E0D\u80FD\u7528\u91D1\u5E01\u4E70",
            closed: "\u8FD9\u4E2A\u9493\u70B9\u73B0\u5728\u6CA1\u5F00\uFF0C\u591C\u6F6D\u53EA\u5728\u665A\u4E0A"
          };
          ctx.showBubble(reasons[next.reason] ?? "\u8FD9\u4E2A\u64CD\u4F5C\u6CA1\u6210", 2400);
        }
        return next;
      } catch (error) {
        ctx.showBubble("\u64CD\u4F5C\u6CA1\u9001\u5230\u5BBF\u4E3B", 2600);
        ctx.react("refuse", 520);
        record("warn", "act", "\u52A8\u4F5C\u6CA1\u9001\u5230\u5BBF\u4E3B\uFF1A" + action, { reason: error instanceof Error ? error.message : String(error) });
        return null;
      } finally {
        ctx.busy = false;
      }
    }
    async function refresh2() {
      if (ctx.stopped) return;
      ctx.fitPanel();
      var startedAt = actionSeq;
      try {
        var res = await fetch(STATE_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var next = await res.json();
        if (startedAt !== actionSeq) return;
        ctx.render(next);
        if (hostDown) {
          hostDown = false;
          record("info", "poll", "\u5BBF\u4E3B\u6062\u590D\u54CD\u5E94");
        }
      } catch (error) {
        if (ctx.stopped) return;
        ctx.showBubble("\u8FDE\u63A5\u4E0D\u4E0A\u5BBF\u4E3B", 4e3);
        if (!hostDown) {
          hostDown = true;
          record("warn", "poll", "\u8FDE\u4E0D\u4E0A\u5BBF\u4E3B", { url: STATE_URL, reason: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    ctx.pomoTick = createPomodoroClock(
      function() {
        return ctx.view;
      },
      ctx.pomoHint,
      ctx.content,
      refresh2,
      function() {
        return ctx.stopped === true;
      }
    ).tick;
    return { send: send2, refresh: refresh2 };
  }

  // src/client/desktop-shell.js
  function desktopShell() {
    var shell2 = typeof window !== "undefined" ? (
      /** @type {any} */
      window.__dshPiggyShell
    ) : null;
    return shell2 !== null && typeof shell2 === "object" && (typeof shell2.beginDrag === "function" || typeof shell2.moveBy === "function") ? shell2 : null;
  }
  function desktopRole() {
    var shell2 = desktopShell();
    var role2 = shell2 === null ? null : shell2.role;
    return role2 === "pet" || role2 === "panel" ? role2 : null;
  }

  // src/client/desktop/panel-window.js
  var PANEL_CSS = [
    "html,body{margin:0;padding:0;background:transparent;overflow:hidden}",
    '[data-piggy-role="panel"] [data-dsh-pig]{position:static!important;inset:auto!important;width:max-content!important;',
    // 名牌在 DOM 里排在卡片前面：面板在猪上方时名牌放底下（靠猪），在猪下方时放上面。
    "height:auto!important;display:flex!important;flex-direction:column-reverse;gap:6px;align-items:flex-end;pointer-events:auto!important;transform:none!important}",
    '[data-piggy-role="panel"] [data-dsh-pig][data-panel-vertical="below"]{flex-direction:column}',
    '[data-piggy-role="panel"] .dp-scene{display:none!important}',
    '[data-piggy-role="panel"] .dp-card{position:relative!important;inset:auto!important;margin:0!important}',
    '[data-piggy-role="panel"] .dp-hud{position:relative!important;inset:auto!important;flex-direction:row!important;gap:10px!important;margin:0!important}'
  ].join("\n");
  var shell = (
    /** @type {any} */
    null
  );
  var anchor = { vertical: "above", maxHeight: 520 };
  var lastSize = "";
  var scheduled = false;
  function host() {
    return (
      /** @type {any} */
      document.querySelector("[data-dsh-pig]")
    );
  }
  function reportSize() {
    const h = host();
    if (h === null || typeof shell?.panel?.size !== "function") return;
    if (h.getAttribute("data-open") !== "true") return;
    const width = Math.ceil(h.offsetWidth || 0);
    const height = Math.ceil(h.offsetHeight || 0);
    if (width < 1 || height < 1) return;
    const key = width + "x" + height;
    if (key === lastSize) return;
    lastSize = key;
    shell.panel.size(width, height);
  }
  function schedule2() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function() {
      scheduled = false;
      reportSize();
    });
  }
  function fitPanelWindow(ctx) {
    const vertical = anchor.vertical === "below" ? "below" : "above";
    ctx.host.setAttribute("data-panel-vertical", vertical);
    ctx.host.setAttribute("data-panel-side", "left");
    const hudHeight = ctx.hud && !ctx.hud.hidden ? (ctx.hud.offsetHeight || 0) + 6 : 0;
    ctx.card.style.maxHeight = Math.max(120, Math.round(anchor.maxHeight - hudHeight)) + "px";
    schedule2();
  }
  function installPanel(bridge3) {
    shell = bridge3;
    document.documentElement.setAttribute("data-piggy-role", "panel");
    const style = document.createElement("style");
    style.setAttribute("data-piggy-panel-style", "");
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
    window.__dshPiggyShell = {
      role: "panel",
      proxy: bridge3.proxy,
      geometry: bridge3.geometry,
      split: true,
      panel: bridge3.panel,
      onStateChanged: bridge3.onStateChanged,
      // 面板窗口里没有猪可拖：这些是给「认桌面版」用的空动作（desktop-shell.js 按 beginDrag 认）。
      beginDrag: function() {
      },
      endDrag: function() {
      },
      dragHeartbeat: function() {
      },
      syncGeometry: schedule2,
      setAnchor: function(next) {
        anchor = next;
      }
    };
  }
  function startPanel() {
    const h = host();
    if (h === null) return;
    const hud = h.querySelector(".dp-hud");
    if (hud !== null) h.insertBefore(hud, h.firstChild);
    if (typeof MutationObserver === "function") {
      new MutationObserver(schedule2).observe(h, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    window.addEventListener("resize", schedule2);
    schedule2();
  }

  // src/client/extensions.js
  var DEFAULTS = [
    { key: "pomodoro", label: "\u756A\u8304\u949F", emoji: "\u{1F345}", description: "", on: true, apps: ["pomodoro"], dexSections: [], shopKinds: [], installed: true, builtin: true, version: "", app: null, error: null },
    { key: "fishing", label: "\u9493\u9C7C", emoji: "\u{1F3A3}", description: "", on: true, apps: ["fishing"], dexSections: ["fish"], shopKinds: ["bait"], installed: true, builtin: true, version: "", app: null, error: null }
  ];
  function normalizeExtensions(raw) {
    const list = arr(raw);
    if (list.length === 0) return DEFAULTS.map((entry) => ({ ...entry }));
    return list.map(function(value) {
      const entry = obj(value);
      const strings = (key) => arr(entry[key]).filter((item) => typeof item === "string");
      const app = obj(entry.app);
      return {
        key: str(entry.key, ""),
        label: str(entry.label, ""),
        emoji: str(entry.emoji, "\u{1F9E9}"),
        description: str(entry.description, ""),
        on: entry.on !== false,
        apps: strings("apps"),
        dexSections: strings("dexSections"),
        shopKinds: strings("shopKinds"),
        // v0.30：装没装、是不是内置、下载扩展的版本和主菜单格子、加载出错。
        installed: entry.installed !== false,
        builtin: entry.builtin !== false,
        version: str(entry.version, ""),
        // 本地导入的非官方扩展（不会被在线目录提示更新）。
        local: entry.local === true,
        app: entry.app ? { emoji: str(app.emoji, "\u{1F9E9}"), label: str(app.label, str(entry.label, "")) } : null,
        error: typeof entry.error === "string" ? entry.error : null
      };
    }).filter((entry) => entry.key !== "");
  }
  function normalizeExtensionParts(d) {
    const extensions = normalizeExtensions(d.extensions);
    const visible2 = (part) => {
      if (typeof part?.extension !== "string" || typeof part?.key !== "string") return false;
      const owner = extensions.find((entry) => entry.key === part.extension);
      return owner !== void 0 && owner.on && owner.installed && !owner.builtin;
    };
    return {
      extensions,
      extViews: obj(d.extViews),
      extShelves: arr(d.extShelves).filter(visible2).map((part) => ({ ...part, currency: obj(part.currency), items: arr(part.items) })),
      extDex: arr(d.extDex).filter(visible2).map((part) => ({ ...part, entries: arr(part.entries) })),
      // 扩展币钱包（规则 1）：扩展关掉了也列出来，可以把币换成金币。
      wallets: arr(d.wallets).map((value) => {
        const wallet = obj(value);
        return { key: str(wallet.key, ""), label: str(wallet.label, "\u5E01"), emoji: str(wallet.emoji, "\u{1FA99}"), balance: num(wallet.balance, 0), rate: num(wallet.rate, 1), buyRate: num(wallet.buyRate, 1), buyable: wallet.buyable !== false };
      }).filter((wallet) => wallet.key !== "")
    };
  }
  function offParts(view) {
    const apps = /* @__PURE__ */ new Set();
    const dexSections = /* @__PURE__ */ new Set();
    for (const extension of arr(view?.extensions)) {
      if (extension.on) continue;
      for (const app of extension.apps) apps.add(app);
      for (const section2 of extension.dexSections) dexSections.add(section2);
    }
    return { apps, dexSections };
  }
  function applyExtensions(view) {
    const off = offParts(view);
    if (off.apps.has("pomodoro")) view.pomodoro = null;
    return view;
  }
  function enabledTabs(ctx, tabs) {
    const off = offParts(ctx.view);
    const downloaded = arr(ctx.view?.extensions).filter((extension) => !extension.builtin && extension.installed && extension.on && extension.app !== null).map((extension) => ({ key: "ext:" + extension.key, label: extension.app.label, emoji: extension.app.emoji }));
    if (off.apps.has(ctx.tab) || String(ctx.tab).startsWith("ext:") && !downloaded.some((tab) => tab.key === ctx.tab)) ctx.tab = "home";
    return tabs.filter((tab) => !off.apps.has(tab.key)).concat(downloaded);
  }

  // src/client/layout.js
  function createLayout(ctx) {
    function clampPig() {
      if (desktopShell() !== null) return;
      var vw = window.innerWidth || 0;
      var vh = window.innerHeight || 0;
      if (vw <= 0 || vh <= 0) return;
      var pigRect = ctx.pig.getBoundingClientRect ? ctx.pig.getBoundingClientRect() : null;
      var w = (pigRect ? pigRect.width || 0 : 0) + 2 * PIG_PADDING_X;
      var sceneRect = ctx.scene.getBoundingClientRect ? ctx.scene.getBoundingClientRect() : null;
      var h = Math.max(sceneRect ? sceneRect.height || 0 : 0, SCENE_RESERVE);
      var right = Math.min(Math.max(4, ctx.userRight), Math.max(4, vw - w - 4));
      var bottom = Math.min(Math.max(4, ctx.userBottom), Math.max(4, vh - h - 4));
      ctx.host.style.right = Math.round(right) + "px";
      ctx.host.style.bottom = Math.round(bottom) + "px";
    }
    function fitPanel() {
      if (!ctx.isOpen) return;
      if (desktopRole() === "panel") {
        fitPanelWindow(ctx);
        return;
      }
      if (desktopRole() === "pet") return;
      if (desktopShell() !== null) return;
      var vw = window.innerWidth || 0;
      var vh = window.innerHeight || 0;
      if (vw <= 0 || vh <= 0) return;
      var rect = ctx.scene.getBoundingClientRect();
      var roomAbove = rect.top - PANEL_GAP - PANEL_MARGIN;
      var roomBelow = vh - rect.bottom - PANEL_GAP - PANEL_MARGIN;
      if (roomAbove >= roomBelow) {
        ctx.card.style.top = "auto";
        ctx.card.style.bottom = "calc(100% + " + PANEL_GAP + "px)";
        ctx.card.style.maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(roomAbove))) + "px";
      } else {
        ctx.card.style.bottom = "auto";
        ctx.card.style.top = "calc(100% + " + PANEL_GAP + "px)";
        ctx.card.style.maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(roomBelow))) + "px";
      }
      var width = Math.min(PANEL_WIDTH, vw - 2 * PANEL_MARGIN);
      ctx.card.style.maxWidth = Math.round(width) + "px";
      var shift = PANEL_MARGIN - (rect.right - width);
      ctx.card.style.right = shift > 0 ? -Math.round(shift) + "px" : "0px";
      var cardLeft = Math.max(rect.right - width, PANEL_MARGIN);
      ctx.hud.style.left = Math.max(9, Math.round(cardLeft - rect.left)) + "px";
    }
    function visibleTabs() {
      const tabs = enabledTabs(ctx, TABS);
      return ctx.devMode ? tabs.concat([DEV_TAB]) : tabs;
    }
    function paintBar() {
      while (ctx.bar.firstChild) ctx.bar.removeChild(ctx.bar.firstChild);
      var list = visibleTabs();
      for (var t = 0; t < list.length; t += 1) ctx.buildIcon(list[t]);
      if (ctx.icons[ctx.tab] === void 0 && ctx.tab !== "home") ctx.tab = "home";
      for (var k in ctx.icons) ctx.icons[k].setAttribute("data-active", k === ctx.tab ? "true" : "false");
    }
    function buildIcon(entry) {
      (function(entry2) {
        var btn = button("dp-ico", { "data-tab": entry2.key }, function() {
          if (ctx.host.getAttribute("data-open") !== "true") ctx.setOpen(true);
          ctx.select(entry2.key);
        });
        btn.appendChild(el("span", "dp-ico-e", entry2.emoji));
        btn.appendChild(el("span", null, entry2.label));
        ctx.icons[entry2.key] = btn;
        ctx.bar.appendChild(btn);
      })(entry);
    }
    function attachResize() {
      function onResize() {
        clampPig();
        if (desktopShell() === null) fitPanel();
      }
      window.addEventListener?.("resize", onResize);
      return function() {
        window.removeEventListener?.("resize", onResize);
      };
    }
    return { clampPig, fitPanel, visibleTabs, paintBar, buildIcon, attachResize };
  }

  // src/client/milestone-notice.js
  function showMilestoneNotice(ctx, event) {
    if (event.kind === "achievement") {
      ctx.showBubble(str(event.text, "\u83B7\u5F97\u5C0F\u732A\u5FBD\u7AE0"), 4500);
      return true;
    }
    if (event.kind === "interest") {
      ctx.showBubble(str(event.text, "\u5174\u8DA3\u8BFE\u5B66\u5B8C\u5566"), 4e3);
      ctx.react("away", 900);
      return true;
    }
    return false;
  }

  // src/client/pending.js
  var URGENT_KINDS = ["sick", "worse", "death", "cured", "revived"];
  function processPending(ctx, showPigLine) {
    var role2 = desktopRole();
    var pigSide = role2 !== "panel";
    var cardSide = role2 !== "pet";
    for (var i = 0; i < ctx.view.pending.length; i += 1) {
      var event = ctx.view.pending[i];
      if (event.id > 0 ? event.id <= ctx.lastPendingId : event.at <= ctx.lastPendingAt) continue;
      if (event.id > 0) ctx.lastPendingId = event.id;
      ctx.lastPendingAt = Math.max(ctx.lastPendingAt, event.at);
      if (event.kind === "line") {
        if (pigSide) showPigLine(event);
        continue;
      }
      if (ctx.view.dialogue.quiet && URGENT_KINDS.indexOf(event.kind) < 0) continue;
      if (event.kind === "achievement" || event.kind === "interest") {
        if (pigSide) showMilestoneNotice(ctx, event);
        continue;
      }
      if (event.kind === "gift") continue;
      if (cardSide) ctx.toast(str(event.text, "\u732A\u6709\u65B0\u6D88\u606F"));
      if (!pigSide) continue;
      if (event.kind === "coronation") {
        ctx.react("levelup", 950);
        ctx.transform("crown");
      } else if (event.kind === "contract") {
        ctx.react("levelup", 950);
        ctx.transform("contract");
      } else if (event.kind === "levelup") {
        ctx.react("levelup", 950);
        ctx.burst(["\u2728", "\u{1F389}"], 3);
      } else if (event.kind === "cured") {
        ctx.react("cure", 900);
        ctx.burst(["\u{1F49A}", "\u2728"], 3);
      } else if (event.kind === "death") ctx.react("refuse", 700);
      else if (event.kind === "work") {
        ctx.react("away", 900);
        ctx.burst(["\u{1FA99}", "\u{1F4B0}"], 3);
      } else if (event.kind === "study") {
        ctx.react("away", 900);
        ctx.burst(["\u{1F4DA}", "\u2728"], 3);
      } else if (event.kind === "trip") {
        ctx.react("away", 900);
        ctx.burst(["\u{1F9F3}", "\u{1F381}"], 3);
      }
    }
    if (pigSide) ctx.updateNotice?.maybeBubble();
  }

  // src/client/storage.js
  function readStore(key) {
    try {
      var value = window.localStorage.getItem(key);
      return value !== null ? value : window.localStorage.getItem(key.replace(/^dsh-piggy:/, "dsh-pig:"));
    } catch (error) {
      return null;
    }
  }
  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
    }
  }

  // src/client/auto-collapse.js
  var AUTO_COLLAPSE_KEY = "dsh-piggy:auto-collapse";
  function autoCollapseEnabled() {
    return readStore(AUTO_COLLAPSE_KEY) !== "false";
  }
  function setAutoCollapse(enabled) {
    writeStore(AUTO_COLLAPSE_KEY, enabled ? "true" : "false");
  }
  function attachAutoCollapse(context) {
    function focusedInput() {
      const active = document.activeElement;
      const tag2 = active?.tagName?.toLowerCase?.() ?? "";
      return tag2 === "input" || tag2 === "textarea" || active?.getAttribute?.("contenteditable") === "true";
    }
    function canClose() {
      return context.isOpen() && autoCollapseEnabled() && !context.isDragging() && !focusedInput() && !context.isFishing();
    }
    function onOutsidePointer(event) {
      if (!canClose() || event.button !== 0) return;
      for (let node = event.target; node !== null && node !== void 0; node = node.parentNode) {
        if (node === context.host) return;
      }
      context.setOpen(false);
    }
    function onWindowBlur() {
      if (context.isDesktop() && canClose()) context.setOpen(false);
    }
    document.addEventListener("pointerdown", onOutsidePointer, true);
    window.addEventListener?.("blur", onWindowBlur);
    return {
      dispose() {
        document.removeEventListener("pointerdown", onOutsidePointer, true);
        window.removeEventListener?.("blur", onWindowBlur);
      }
    };
  }

  // src/client/tabs/fishing-fight.js
  var frame = 0;
  var activeUi = null;
  var resolving = false;
  var session = null;
  var raf = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : 0;
  var caf = (id) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  };
  var releaseHold = null;
  function stopFight(clear = false) {
    if (frame) caf(frame);
    frame = 0;
    activeUi = null;
    if (releaseHold !== null) {
      releaseHold();
      releaseHold = null;
    }
    if (clear) session = null;
  }
  function fightActive(ui) {
    return activeUi === ui;
  }
  function resetFightResolve() {
    resolving = false;
  }
  function difficultyOf(fish3) {
    return Math.max(1, Math.min(100, Number(fish3.feel?.difficulty ?? fish3.difficulty) || 1));
  }
  function feelOf(fish3) {
    const f = fish3.feel || {};
    return { speed: f.speed || 1, burst: f.burst || 0, burstScale: f.burstScale || 1, drift: f.drift || 0, jitter: f.jitter || 0, zone: f.zone || 1, hold: f.hold || 1 };
  }
  function surgeOf(s, feel2, now, dt) {
    if ((s.burstLeft || 0) > 0) s.burstLeft -= dt;
    else if (feel2.burst > 0 && Math.random() < feel2.burst * dt / 16) s.burstLeft = 260 + Math.random() * 240;
    const wobble = 1 + feel2.jitter * Math.sin(now / 380 + (s.phase || 0));
    return feel2.speed * wobble * ((s.burstLeft || 0) > 0 ? feel2.burstScale : 1);
  }
  function renderFight(ui, fish3) {
    const mode = fish3.fight === "bar" || fish3.fight === "pull" ? fish3.fight : "ring";
    if (session?.id !== fish3.id || session.mode !== mode) session = { id: fish3.id, mode };
    activeUi = ui;
    const finish = (success) => {
      if (resolving) return;
      resolving = true;
      stopFight(true);
      ui.send("fishResolve", { success });
    };
    if (mode === "bar") return renderBar(ui, fish3, session, finish);
    if (mode === "pull") return renderPull(ui, fish3, session, finish);
    return renderRing(ui, fish3, session, finish);
  }
  function stillOpen(ui) {
    return activeUi === ui && ui.host.getAttribute("data-open") === "true";
  }
  function holdControls(stage2, s) {
    stage2.addEventListener("pointerdown", function(event) {
      event?.preventDefault?.();
      s.holding = true;
    });
    stage2.addEventListener("keydown", function(event) {
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault?.();
        s.holding = true;
      }
    });
    stage2.addEventListener("keyup", function(event) {
      if (event.code === "Space" || event.key === " ") s.holding = false;
    });
    const up = function() {
      s.holding = false;
    };
    if (typeof window.addEventListener === "function") {
      window.addEventListener("pointerup", up);
      releaseHold = function() {
        if (typeof window.removeEventListener === "function") window.removeEventListener("pointerup", up);
      };
    }
  }
  var FIGHT_LENGTH = 1.5;
  function ringRules(difficulty, feel2) {
    return {
      zoneDegrees: Math.round((115 - difficulty * 0.38) * feel2.zone),
      perfectDegrees: Math.round(16 - difficulty * 0.06),
      rotationsPerSecond: 0.28 + difficulty * 18e-4,
      hitsNeeded: Math.round((difficulty >= 80 ? 4 : difficulty >= 45 ? 3 : 2) * FIGHT_LENGTH)
    };
  }
  function newRingRound(s) {
    s.zoneStart = 105 + Math.random() * 135;
    s.angle = 0;
    s.completedCircles = 0;
    s.startedAt = 0;
    s.locked = false;
    s.feedback = "\u770B\u51C6\u7EFF\u8272\u533A\u57DF";
  }
  function renderRing(ui, fish3, s, finish) {
    if (s.hits === void 0) {
      Object.assign(s, { hits: 0, misses: 0, phase: Math.random() * 6 }, ringRules(difficultyOf(fish3), feelOf(fish3)));
      newRingRound(s);
    }
    let lastPointerAt = -Infinity;
    const wrap = button("dp-fish-qte", {
      "data-fish-qte": "true",
      "data-fish-fight": "ring",
      "data-qte-difficulty": String(fish3.difficulty),
      "data-qte-needed": String(s.hitsNeeded),
      "aria-label": "\u9493\u9C7C\u6280\u80FD\u68C0\u5B9A\uFF0C\u6307\u9488\u8FDB\u5165\u7EFF\u8272\u533A\u57DF\u65F6\u70B9\u51FB"
    }, function(event) {
      if (event.detail > 0 && event.timeStamp - lastPointerAt < 700) return;
      hit(event);
    });
    wrap.addEventListener("pointerdown", function(event) {
      lastPointerAt = event.timeStamp;
      hit(event);
    });
    const ring = el("div", "dp-fish-qte-ring");
    const needle = el("i", "dp-fish-qte-needle");
    const score = el("b", "dp-fish-qte-score");
    const feedback = el("span", "dp-fish-qte-feedback");
    ring.appendChild(needle);
    ring.appendChild(el("span", "dp-fish-qte-core", fish3.emoji));
    wrap.appendChild(el("div", "dp-fish-qte-title", fish3.emoji + "\u3000\u54AC\u7D27\u4E86\uFF01"));
    wrap.appendChild(ring);
    wrap.appendChild(score);
    wrap.appendChild(feedback);
    wrap.appendChild(el("div", "dp-fish-help", "\u6307\u9488\u8FDB\u5165\u7EFF\u8272\u533A\u57DF\u65F6\u70B9\u51FB\u6216\u6309\u7A7A\u683C \xB7 \u9EC4\u8272\u4E3A\u5B8C\u7F8E\u5224\u5B9A"));
    wrap.setAttribute("tabindex", "0");
    ui.content.appendChild(wrap);
    function paint() {
      const angle = s.angle % 360;
      const perfectEnd = s.zoneStart + s.perfectDegrees;
      const zoneEnd = s.zoneStart + s.zoneDegrees;
      ring.style.background = `conic-gradient(from 0deg,#dce8e9 0deg ${s.zoneStart}deg,#ffd45d ${s.zoneStart}deg ${perfectEnd}deg,#6bd47b ${perfectEnd}deg ${zoneEnd}deg,#dce8e9 ${zoneEnd}deg 360deg)`;
      needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
      score.textContent = `\u6280\u80FD\u68C0\u5B9A ${Math.min(s.hits, s.hitsNeeded)} / ${s.hitsNeeded}`;
      feedback.textContent = `${s.feedback} \xB7 \u673A\u4F1A ${"\u2665".repeat(3 - s.misses)}${"\u2661".repeat(s.misses)}`;
      wrap.setAttribute("data-qte-angle", angle.toFixed(1));
      wrap.setAttribute("data-qte-zone-start", s.zoneStart.toFixed(1));
      wrap.setAttribute("data-qte-zone-size", String(s.zoneDegrees));
      wrap.setAttribute("data-qte-misses", String(s.misses));
      wrap.setAttribute("data-qte-speed", String(s.rotationsPerSecond));
      wrap.setAttribute("data-qte-feedback", s.feedback);
    }
    function hit(event) {
      event?.preventDefault?.();
      if (s.locked || activeUi !== ui) return;
      const offset = s.angle % 360 - s.zoneStart;
      if (offset < 0 || offset > s.zoneDegrees) {
        s.feedback = offset < 0 ? "\u8FD8\u6CA1\u5230\u65F6\u673A\uFF0C\u518D\u7B49\u7B49" : "\u5DF2\u7ECF\u5212\u8FC7\u53BB\u4E86\uFF0C\u7B49\u4E0B\u4E00\u5708";
        paint();
        return;
      }
      const perfect = offset <= s.perfectDegrees;
      s.hits += perfect ? 2 : 1;
      s.misses = 0;
      s.feedback = perfect ? "\u5B8C\u7F8E\uFF01\u8FDB\u5EA6 +2" : "\u547D\u4E2D\uFF01";
      s.locked = true;
      paint();
      if (s.hits >= s.hitsNeeded) return setTimeout(() => finish(true), 260);
      setTimeout(() => {
        if (session !== s || resolving) return;
        newRingRound(s);
        paint();
      }, 380);
    }
    const feel2 = feelOf(fish3);
    function tick2(now) {
      if (!stillOpen(ui)) return finish(false);
      if (!s.startedAt) s.startedAt = now;
      const dt = s.last ? Math.min(50, now - s.last) : 16;
      s.last = now;
      if (!s.locked) s.angle += dt * s.rotationsPerSecond * 0.36 * surgeOf(s, feel2, now, dt);
      const circles = Math.floor(s.angle / 360);
      if (!s.locked && circles > s.completedCircles) {
        s.misses += circles - s.completedCircles;
        s.completedCircles = circles;
        s.feedback = s.misses >= 3 ? "\u8FDE\u7EED\u7A7A\u4E86\u4E09\u5708\uFF0C\u9C7C\u8DD1\u6389\u4E86\u2026" : `\u7A7A\u4E86\u4E00\u5708\uFF0C\u8FD8\u5269 ${3 - s.misses} \u5708\u673A\u4F1A`;
        paint();
        if (s.misses >= 3) return finish(false);
      }
      paint();
      frame = raf(tick2);
    }
    paint();
    frame = raf(tick2);
  }
  var BAR_HEIGHT = 220;
  function renderBar(ui, fish3, s, finish) {
    const d = difficultyOf(fish3);
    const feel2 = feelOf(fish3);
    if (s.progress === void 0) {
      Object.assign(s, {
        zoneH: Math.round(Math.max(46, 96 - d * 0.5) * feel2.zone),
        zone: 0,
        vel: 0,
        phase: Math.random() * 6,
        fishY: BAR_HEIGHT * 0.3,
        target: BAR_HEIGHT * 0.3,
        wait: 0,
        progress: 30,
        holding: false,
        last: 0
      });
    }
    const stage2 = button("dp-fish-stage", { "data-fish-fight": "bar", "data-fish-bar": "true", "aria-label": "\u6309\u4F4F\u8BA9\u7EFF\u6761\u4E0A\u6D6E\uFF0C\u8BA9\u9C7C\u5F85\u5728\u7EFF\u6761\u91CC" }, function() {
    });
    stage2.setAttribute("tabindex", "0");
    const bar = el("div", "dp-fish-bar");
    const track = el("div", "dp-fish-track");
    const zone = el("i", "dp-fish-zone");
    const swimmer = el("span", "dp-fish-swimmer", fish3.emoji);
    const meter2 = el("div", "dp-fish-vmeter");
    const fill = el("i");
    track.appendChild(zone);
    track.appendChild(swimmer);
    meter2.appendChild(fill);
    bar.appendChild(track);
    bar.appendChild(meter2);
    stage2.appendChild(el("div", "dp-fish-qte-title", fish3.emoji + "\u3000\u54AC\u7D27\u4E86\uFF01"));
    stage2.appendChild(bar);
    const hint = el("div", "dp-fish-help", "\u6309\u4F4F\uFF08\u6216\u7A7A\u683C\uFF09\u7EFF\u6761\u4E0A\u6D6E\uFF0C\u677E\u5F00\u4E0B\u6C89 \xB7 \u8BA9\u9C7C\u5F85\u5728\u7EFF\u6761\u91CC");
    stage2.appendChild(hint);
    ui.content.appendChild(stage2);
    holdControls(stage2, s);
    function moveFish(dt, now) {
      s.wait -= dt;
      if (s.wait <= 0) {
        const calm = fish3.behavior === "smooth";
        const target = s.fishY + (Math.random() - 0.5) * (calm ? 90 : 60 + d * 1.6) * feel2.speed + feel2.drift * 1.2;
        s.target = Math.max(8, Math.min(BAR_HEIGHT - 8, target));
        s.wait = (calm ? 900 : Math.max(250, 900 - d * 6)) / feel2.speed;
      }
      s.fishY += (s.target - s.fishY) * Math.min(1, dt * (18e-4 + d * 5e-5) * surgeOf(s, feel2, now, dt));
    }
    function tick2(now) {
      if (!stillOpen(ui)) return finish(false);
      const dt = s.last ? Math.min(50, now - s.last) : 16;
      s.last = now;
      s.vel = Math.max(-0.5, Math.min(0.5, s.vel + (s.holding ? 16e-4 : -13e-4) * dt));
      s.zone += s.vel * dt;
      if (s.zone < 0) {
        s.zone = 0;
        s.vel = s.vel < 0 ? -s.vel * 0.3 : s.vel;
      }
      if (s.zone > BAR_HEIGHT - s.zoneH) {
        s.zone = BAR_HEIGHT - s.zoneH;
        s.vel = Math.min(0, s.vel);
      }
      moveFish(dt, now);
      const inside2 = s.fishY >= s.zone && s.fishY <= s.zone + s.zoneH;
      s.progress = Math.max(0, Math.min(100, s.progress + (inside2 ? 0.028 / FIGHT_LENGTH : -0.022 - d * 1e-4) * dt));
      zone.style.bottom = s.zone + "px";
      zone.style.height = s.zoneH + "px";
      swimmer.style.bottom = s.fishY + "px";
      fill.style.height = s.progress + "%";
      stage2.setAttribute("data-inside", inside2 ? "true" : "false");
      stage2.setAttribute("data-progress", s.progress.toFixed(0));
      if (s.progress >= 100) return finish(true);
      if (s.progress <= 0) return finish(false);
      frame = raf(tick2);
    }
    frame = raf(tick2);
  }
  function renderPull(ui, fish3, s, finish) {
    const d = difficultyOf(fish3);
    const feel2 = feelOf(fish3);
    const snap = Math.min(95, 85 + (feel2.hold - 1) * 50);
    if (s.distance === void 0) {
      Object.assign(s, { tension: 40, distance: 100, loose: 0, surge: 0, surgeCd: 1500, holding: false, last: 0 });
    }
    const stage2 = button("dp-fish-stage", { "data-fish-fight": "pull", "data-fish-pull": "true", "aria-label": "\u6309\u4F4F\u6536\u7EBF\uFF0C\u677E\u5F00\u653E\u7EBF\uFF0C\u6307\u9488\u522B\u8FDB\u7EA2\u533A" }, function() {
    });
    stage2.setAttribute("tabindex", "0");
    const line3 = el("div", "dp-fish-line");
    const rod = el("span", "dp-fish-rod", "\u{1F3A3}");
    line3.appendChild(rod);
    line3.appendChild(el("span", "dp-fish-string", "\u3030\u3030\u3030"));
    line3.appendChild(el("span", "dp-fish-rod", fish3.emoji));
    const gauge = el("div", "dp-fish-gauge");
    gauge.style.background = `linear-gradient(90deg,#dce8e9 0 30%,#6bd47b 30% ${snap - 13}%,#ffd45d ${snap - 13}% ${snap}%,#e05a5a ${snap}%)`;
    const pin = el("b");
    gauge.appendChild(pin);
    const state2 = el("div", "dp-fish-pull-state");
    const meter2 = el("div", "dp-fish-hmeter");
    const fill = el("i");
    meter2.appendChild(fill);
    stage2.appendChild(el("div", "dp-fish-qte-title", fish3.emoji + "\u3000\u54AC\u7D27\u4E86\uFF01"));
    stage2.appendChild(line3);
    stage2.appendChild(gauge);
    stage2.appendChild(state2);
    stage2.appendChild(meter2);
    stage2.appendChild(el("div", "dp-fish-help", "\u6309\u4F4F\uFF08\u6216\u7A7A\u683C\uFF09\u6536\u7EBF\uFF0C\u677E\u5F00\u653E\u7EBF \xB7 \u9C7C\u53D1\u529B\u65F6\u677E\u4E00\u677E"));
    ui.content.appendChild(stage2);
    holdControls(stage2, s);
    function tick2(now) {
      if (!stillOpen(ui)) return finish(false);
      const dt = s.last ? Math.min(50, now - s.last) : 16;
      s.last = now;
      s.surgeCd -= dt;
      if (s.surgeCd <= 0) {
        s.surge = (10 + d * 0.28) * feel2.speed * (feel2.burst > 0.015 ? 1.25 : 1);
        s.surgeCd = (Math.max(700, 2600 - d * 16) + Math.random() * 900) / (feel2.burst > 0 ? 1 + feel2.burst * 20 : 0.8);
      }
      s.tension = Math.max(0, Math.min(100, s.tension + ((s.holding ? 0.055 : -0.05) + s.surge * 4e-3) * dt));
      s.surge = Math.max(0, s.surge - dt * 0.02);
      const green = s.tension >= 30 && s.tension < snap;
      const sweet = s.tension >= snap - 13 && s.tension < snap;
      if (green) {
        s.distance -= (sweet ? 0.022 : 0.012) / FIGHT_LENGTH * dt * (1 - d * 4e-3);
        s.loose = Math.max(0, s.loose - dt);
      }
      if (s.tension < 30) s.loose += dt;
      pin.style.left = s.tension + "%";
      rod.style.transform = s.holding ? "rotate(-12deg)" : "none";
      fill.style.width = 100 - Math.max(0, s.distance) + "%";
      state2.textContent = (s.surge > 2 ? fish3.emoji + " \u53D1\u529B\u4E86\uFF01" : s.tension < 30 ? "\u592A\u677E\u4E86\uFF01" : s.tension >= snap ? "\u8981\u65AD\u4E86\uFF01" : sweet ? "\u7A33\uFF01\u6536\u5F97\u5FEB" : "\u6536\u7EBF\u4E2D") + " \xB7 \u79BB\u5CB8 " + Math.max(0, s.distance).toFixed(0) + " \u7C73";
      stage2.setAttribute("data-tension", s.tension.toFixed(0));
      if (s.tension >= 100) return finish(false);
      if (s.loose > 2600) return finish(false);
      if (s.distance <= 0) return finish(true);
      frame = raf(tick2);
    }
    frame = raf(tick2);
  }

  // src/client/switch-activity.js
  function canStart(ui) {
    return ui.view.canGoOut === true || ui.view.awayBlocked === "away" && ui.view.activity !== null;
  }
  function startOrSwitch(ui, label, action, payload) {
    if (ui.view.activity === null) {
      ui.send(action, payload);
      return;
    }
    ui.switchAsk = { label, action, payload };
    ui.renderContent();
    if (ui.content) ui.content.scrollTop = 0;
  }
  function lossOf(activity) {
    if (activity.kind === "work") return "\u6253\u5DE5\u5230\u4E00\u534A\u53EB\u56DE\u6765\uFF0C\u8FD9\u4E00\u73ED\u7684\u5DE5\u94B1\u5C31\u6CA1\u4E86";
    if (activity.kind === "fishing") return "\u9C7C\u9975\u4F1A\u9000\u56DE\u6765";
    return activity.cost > 0 ? "\u82B1\u7684\u94B1\u4F1A\u9000\u56DE\u6765" : "";
  }
  function renderSwitchAsk(ui) {
    var ask = ui.switchAsk;
    var activity = ui.view.activity;
    if (!ask) return;
    if (activity === null) {
      ui.switchAsk = null;
      return;
    }
    var box = el("div", "dp-alert dp-switch-ask");
    var left = Math.max(1, Math.ceil(activity.secondsLeft / 60));
    box.appendChild(el("b", null, "\u732A\u6B63\u5728" + activity.label.replace(/^兴趣·/, "\u5B66") + "\uFF08\u8FD8\u6709 " + left + " \u5206\u949F\uFF09"));
    var loss = lossOf(activity);
    box.appendChild(el("div", null, "\u8981\u7ED3\u675F\u5B83\uFF0C\u6539\u53BB" + ask.label + "\u5417\uFF1F" + (loss ? loss + "\u3002" : "")));
    var row = el("div", "dp-switch-ask-row");
    var go = button("dp-mini", { "data-switch-go": ask.action }, function() {
      ui.switchAsk = null;
      Promise.resolve(ui.send("calloff")).then(function() {
        return ui.send(ask.action, ask.payload);
      });
    });
    go.textContent = "\u6539\u53BB" + ask.label;
    var no = button("dp-mini dp-mini-plain", { "data-switch-cancel": "true" }, function() {
      ui.switchAsk = null;
      ui.renderContent();
    });
    no.textContent = "\u7B97\u4E86";
    row.appendChild(go);
    row.appendChild(no);
    box.appendChild(row);
    ui.content.appendChild(box);
  }

  // src/client/tabs/fishing.js
  var selectedBait = null;
  var autoOpen = false;
  var waitFrame = 0;
  var waitUi = null;
  var raf2 = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : 0;
  var caf2 = (id) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  };
  function stopWait() {
    if (waitFrame) caf2(waitFrame);
    waitFrame = 0;
    waitUi = null;
  }
  function closeFishing(ui) {
    const playing = fightActive(ui) && ui.view.fishing.pending?.phase === "hooked";
    stopFight(true);
    stopWait();
    if (playing) ui.send("fishResolve", { success: false });
  }
  function renderFishingTab(ui) {
    stopFight();
    stopWait();
    const pending2 = ui.view.fishing.pending;
    renderAutoStock(ui);
    if (pending2?.phase !== "hooked") resetFightResolve();
    if (ui.view.activity?.kind === "fishing") {
      stopFight(true);
      return renderAway(ui);
    }
    renderSwitchAsk(ui);
    if (pending2?.phase === "waiting") {
      stopFight(true);
      return renderWaiting(ui, pending2);
    }
    if (pending2?.phase === "hooked") return renderFight(ui, pending2);
    stopFight(true);
    if (pending2?.phase === "caught") return renderResult(ui, pending2);
    renderReady(ui);
  }
  var BAIT_NOTE = { bait_worm: "\u666E\u901A\u9C7C", bait_shrimp: "\u5C11\u89C1\u7684\u591A\u4E00\u70B9", bait_glow: "\u7A00\u6709\u7684\u591A\u5F88\u591A" };
  function renderGear(ui) {
    const fishing = ui.view.fishing;
    if (!Array.isArray(fishing.spots) || fishing.spots.length === 0) return;
    const coins = ui.view.pig?.coins ?? 0;
    const spots = el("div", "dp-fish-spots");
    for (const spot of fishing.spots) {
      const here = spot.key === fishing.spot;
      const pick = button("dp-fish-spot", { "data-fish-spot": spot.key, "aria-pressed": String(here) }, function() {
        if (!here) ui.send("fishSpot", { spot: spot.key });
      });
      pick.appendChild(el("em", null, spot.emoji));
      pick.appendChild(el("b", null, spot.label));
      pick.appendChild(el("small", null, !spot.unlocked ? "\u{1FA99} " + spot.price + " \u5F00" : !spot.open ? "\u665A\u4E0A\u624D\u5F00" : spot.kinds + " \u79CD\u9C7C"));
      pick.disabled = !spot.unlocked && coins < spot.price;
      spots.appendChild(pick);
    }
    ui.content.appendChild(spots);
    const rod = el("div", "dp-fish-rodrow");
    rod.appendChild(el("span", null, fishing.rod.emoji + " " + fishing.rod.label));
    if (fishing.nextRod) {
      const up = button("dp-mini", { "data-fish-rod": fishing.nextRod.key || String(fishing.nextRod.level) }, function() {
        ui.send("fishRod");
      });
      up.textContent = "\u6362" + fishing.nextRod.label + " \u{1FA99} " + fishing.nextRod.price;
      up.disabled = coins < fishing.nextRod.price;
      rod.appendChild(up);
      rod.appendChild(el("small", null, "\u597D\u7AFF\u54AC\u94A9\u66F4\u5FEB\u3001\u7EFF\u533A\u66F4\u5BBD\u3001\u66F4\u8010\u62C9\uFF0C\u7A00\u6709\u9C7C\u66F4\u591A"));
    } else rod.appendChild(el("small", null, "\u5DF2\u7ECF\u662F\u6700\u597D\u7684\u9C7C\u7AFF"));
    ui.content.appendChild(rod);
  }
  function renderReady(ui) {
    renderGear(ui);
    const baits = ui.view.shop.filter((item) => item.kind === "bait");
    const owned = (key) => ui.view.inventory[key] ?? 0;
    if (!baits.some((item) => item.key === selectedBait && owned(item.key) > 0)) selectedBait = baits.find((item) => owned(item.key) > 0)?.key ?? null;
    ui.content.appendChild(el("div", "dp-fish-label", "\u9009\u9C7C\u9975"));
    const choices = el("div", "dp-fish-baits");
    for (const bait of baits) {
      const choice = button("dp-fish-bait", { "data-fish-bait": bait.key }, function() {
        selectedBait = bait.key;
        ui.renderContent();
      });
      choice.appendChild(el("em", null, bait.emoji));
      choice.appendChild(el("b", null, bait.label.replace(/鱼饵$/, "") + " \xD7" + owned(bait.key)));
      choice.appendChild(el("small", null, BAIT_NOTE[bait.key] ?? ""));
      choice.setAttribute("aria-pressed", String(selectedBait === bait.key));
      choice.disabled = owned(bait.key) === 0;
      choices.appendChild(choice);
    }
    ui.content.appendChild(choices);
    if (selectedBait === null) ui.content.appendChild(el("div", "dp-fish-blocked", "\u6CA1\u6709\u9C7C\u9975\u4E86\uFF0C\u5148\u53BB\u5546\u5E97\u7684\u9C7C\u9975\u8D27\u67B6\u4E70\u3002"));
    const hungry = (ui.view.pig?.satiety ?? 0) < 1;
    if (hungry) {
      ui.content.appendChild(el("div", "dp-fish-blocked", "\u9971\u98DF\u4E3A 0\uFF0C\u5148\u5582\u98DF\u624D\u80FD\u629B\u7AFF\u3002"));
      const care = button("dp-mini dp-fish-care", { "data-fish-care": "feed" }, function() {
        ui.select("status");
      });
      care.textContent = "\u53BB\u72B6\u6001\u9875\u5582\u98DF \u2192";
      ui.content.appendChild(care);
    }
    const cast = button("dp-btn dp-btn-wide dp-fish-cast", { "data-fish": "cast" }, function() {
      ui.send("fishCast", { power: 0.5, bait: selectedBait });
    });
    cast.textContent = hungry ? "\u{1F35A} \u5582\u98DF\u540E\u624D\u80FD\u629B\u7AFF" : "\u{1F3A3} \u629B\u7AFF";
    cast.disabled = selectedBait === null || hungry;
    ui.content.appendChild(cast);
    renderAuto(ui);
  }
  function renderAuto(ui) {
    const automation2 = ui.view.fishing.automation;
    const auto = el("details", "dp-fish-auto");
    if (autoOpen) auto.setAttribute("open", "");
    auto.addEventListener("toggle", function() {
      autoOpen = auto.open === true;
    });
    auto.appendChild(el("summary", null, "\u{1F437} \u8BA9\u732A\u81EA\u5DF1\u53BB\u9493"));
    const row = el("div", "dp-fish-auto-row");
    const reasons = [];
    const choices = automation2?.choices ?? [30, 60].map((minutes) => ({ minutes, attempts: minutes / 3 }));
    for (const { minutes, attempts, legacy = minutes <= 60 } of choices) {
      const boxed = !legacy && automation2?.baitLimit > 0;
      const need = boxed ? 1 : attempts;
      const have = ui.view.inventory[selectedBait] ?? 0;
      const go = button("dp-mini", { "data-fish-auto": String(minutes) }, function() {
        startOrSwitch(ui, "\u81EA\u52A8\u9493\u9C7C " + minutes + " \u5206\u949F", "fishAuto", { minutes, bait: selectedBait });
      });
      go.textContent = `${minutes} \u5206\u949F` + (boxed ? "\uFF08\u81EA\u52A8\u8865\u9975\uFF09" : `\uFF08\u9C7C\u9975 ${need} \u4E2A\uFF09`);
      const closed = ui.view.fishing.spots?.find((spot) => spot.key === ui.view.fishing.spot)?.open === false;
      go.disabled = !canStart(ui) || have < need || !legacy && automation2?.full === true || closed;
      if (go.disabled && minutes === 30) {
        if (!canStart(ui)) reasons.push("\u732A\u73B0\u5728\u4E0D\u80FD\u51FA\u95E8");
        else if (!legacy && automation2?.full) reasons.push(automation2.stored > 0 ? "\u9C7C\u7BD3\u6EE1\u4E86\uFF0C\u5148\u6536\u4E00\u4E0B" : "\u9493\u9C7C\u6B47\u4E86\uFF0C\u5148\u63A5\u7740\u5E72");
        else if (closed) reasons.push("\u8FD9\u4E2A\u9493\u70B9\u73B0\u5728\u6CA1\u6709\u5F00");
        else reasons.push("\u9C7C\u9975\u53EA\u5269 " + have + " \u4E2A\uFF0C\u4E0D\u591F " + need + " \u4E2A");
      }
      row.appendChild(go);
    }
    auto.appendChild(row);
    for (const upgrade of automation2?.upgrades ?? []) {
      const buy = button("dp-mini", { "data-fish-upgrade": upgrade.kind }, () => ui.send("fishAutomation", { kind: upgrade.kind }));
      buy.textContent = upgrade.label + " \u{1FA99} " + upgrade.price;
      buy.disabled = (ui.view.pig?.coins ?? 0) < upgrade.price;
      auto.appendChild(buy);
    }
    if (reasons.length > 0) auto.appendChild(el("span", "dp-fish-why", "\u70B9\u4E0D\u4E86\uFF1A" + reasons[0] + "\u3002"));
    ui.content.appendChild(auto);
  }
  function renderAutoStock(ui) {
    const automation2 = ui.view.fishing.automation;
    if (!automation2 || !automation2.unlocked && automation2.stored === 0 && automation2.usedHours === 0) return;
    const row = el("div", "dp-fish-rodrow");
    row.appendChild(el("span", null, "\u{1F9FA} " + (automation2.full ? automation2.stored > 0 ? "\u9C7C\u7BD3\u6EE1\u4E86" : "\u9493\u9C7C\u6B47\u4E86" : "\u9C7C\u7BD3") + " " + automation2.usedHours.toFixed(1) + "/6\u65F6"));
    const collect = button("dp-mini", { "data-fish-collect": "true" }, () => ui.send("fishCollect"));
    collect.textContent = automation2.stored > 0 ? "\u6536\u4E00\u4E0B" : automation2.full ? "\u63A5\u7740\u5E72" : "\u6682\u65E0\u6536\u6210";
    collect.disabled = automation2.stored === 0 && !automation2.full;
    row.appendChild(collect);
    ui.content.appendChild(row);
  }
  function renderWaiting(ui, pending2) {
    const water = button("dp-fish-waiting", { "data-fish": "hook" }, function() {
      if (Date.now() < pending2.bitesAt) {
        line3.textContent = nibbleUntil > Date.now() ? "\u53EA\u662F\u8BD5\u63A2\uFF0C\u8FD8\u6CA1\u54AC\u5B9E\u2026" : "\u8FD8\u6CA1\u4E0A\u94A9\uFF0C\u7EE7\u7EED\u7B49\u2026";
        return;
      }
      ui.send("fishHook");
    });
    let nextNibble = Date.now() + 1500 + Math.random() * 2500;
    let nibbleUntil = 0;
    const mark = el("span", "dp-fish-bobber", "\u{1F3A3}");
    const line3 = el("b", null, "\u5B89\u9759\u7B49\u9C7C\u54AC\u94A9\u2026");
    water.appendChild(mark);
    water.appendChild(line3);
    ui.content.appendChild(water);
    waitUi = ui;
    function tick2() {
      if (waitUi !== ui) return;
      const now = Date.now();
      if (now < pending2.bitesAt - 900 && now >= nextNibble) {
        nibbleUntil = now + 420;
        nextNibble = now + 1800 + Math.random() * 3200;
        water.setAttribute("data-nibble", "true");
        line3.textContent = Math.random() < 0.5 ? "\u6D6E\u6F02\u52A8\u4E86\u4E00\u4E0B\u2026" : "\u5495\u561F\uFF0C\u5192\u4E86\u4E2A\u6CE1\u2026";
      } else if (nibbleUntil > 0 && now > nibbleUntil + 900) {
        nibbleUntil = 0;
        water.setAttribute("data-nibble", "false");
        line3.textContent = "\u5B89\u9759\u7B49\u9C7C\u54AC\u94A9\u2026";
      }
      if (now >= pending2.bitesAt && now <= pending2.hookUntil) {
        mark.textContent = "\u2757";
        line3.textContent = "\u4E0A\u94A9\u4E86\uFF01\u5FEB\u70B9\uFF01";
        water.setAttribute("data-bite", "true");
      } else if (now > pending2.hookUntil) {
        stopWait();
        ui.send("fishHook");
        return;
      }
      waitFrame = raf2(tick2);
    }
    waitFrame = raf2(tick2);
  }
  var STARS = { common: 1, uncommon: 2, rare: 3, legend: 4 };
  function renderResult(ui, fish3) {
    const card2 = el("div", "dp-fish-result");
    card2.appendChild(el("div", "dp-fish-result-emoji", fish3.emoji));
    card2.appendChild(el("b", null, "\u9493\u5230\u4E86 " + fish3.label + "\uFF01"));
    const stars2 = STARS[fish3.rarity] ?? 1;
    card2.appendChild(el("span", "dp-fish-stars", "\u2605".repeat(stars2) + "\u2606".repeat(4 - stars2)));
    const record2 = fish3.maxCm > 0 && fish3.sizeCm >= fish3.maxCm * 0.85 ? " \xB7 \u5927\u4E2A\u7684\uFF01" : "";
    card2.appendChild(el("span", null, fish3.sizeCm.toFixed(1) + " cm \xB7 \u{1FA99} " + fish3.price + record2));
    const keep = button("dp-btn dp-btn-wide", { "data-fish": "keep" }, function() {
      ui.send("fishKeep");
    });
    keep.textContent = "\u{1F392} \u653E\u8FDB\u9C7C\u7BD3";
    card2.appendChild(keep);
    ui.content.appendChild(card2);
  }
  function renderAway(ui) {
    ui.content.appendChild(el("div", "dp-fish-away", "\u{1F3A3}"));
    ui.content.appendChild(el("div", "dp-empty", ui.view.activity.label + " \xB7 \u9493\u5230\u7684\u9C7C\u4F1A\u653E\u8FDB\u9C7C\u7BD3"));
  }

  // src/client/split.js
  var PIG_FX = ["flash", "react", "burst", "showBubble", "transform", "previewArt", "idleNow", "walkNow", "birthdayNow"];
  function wireSplit(ctx, hooks) {
    var role2 = desktopRole();
    var shell2 = desktopShell();
    if (role2 === null || shell2 === null || shell2.panel === void 0) return null;
    if (typeof shell2.onStateChanged === "function") shell2.onStateChanged(function(view) {
      if (view && Array.isArray(view.pending)) ctx.render(view);
      else hooks.refresh();
    });
    if (role2 === "pet") {
      shell2.panel.onFx(function(fx) {
        if (fx === null || typeof fx !== "object" || PIG_FX.indexOf(fx.name) < 0) return;
        var run = ctx[fx.name];
        if (typeof run === "function") run.apply(null, Array.isArray(fx.args) ? fx.args : []);
      });
      shell2.panel.on(function(message2) {
        if (message2 && message2.type === "closed") ctx.isOpen = false;
      });
      return role2;
    }
    PIG_FX.forEach(function(name) {
      ctx[name] = function() {
        shell2.panel.fx(name, Array.prototype.slice.call(arguments));
      };
    });
    shell2.panel.on(function(message2) {
      if (message2 === null || typeof message2 !== "object") return;
      if (message2.type === "open") {
        shell2.setAnchor({ vertical: message2.vertical === "below" ? "below" : "above", maxHeight: Number(message2.maxHeight) || 520 });
        if (!ctx.isOpen) ctx.setOpen(true);
        else ctx.fitPanel();
        shell2.syncGeometry();
      } else if (message2.type === "closed") {
        if (ctx.isOpen) ctx.setOpen(false);
      } else if (message2.type === "blur") {
        if (message2.toPet || !ctx.isOpen || !autoCollapseEnabled() || hooks.isFishing() || typing()) return;
        ctx.setOpen(false);
      }
    });
    return role2;
  }
  function typing() {
    var active = (
      /** @type {any} */
      document.activeElement
    );
    var tag2 = active?.tagName?.toLowerCase?.() ?? "";
    return tag2 === "input" || tag2 === "textarea" || active?.getAttribute?.("contenteditable") === "true";
  }
  function splitSetOpen(ctx, next) {
    var role2 = desktopRole();
    if (role2 === "pet") {
      var changed = next !== ctx.isOpen;
      ctx.isOpen = next;
      ctx.host.setAttribute("data-open", "false");
      ctx.card.hidden = true;
      ctx.hud.hidden = true;
      if (changed) desktopShell().panel.toggle(next);
      return true;
    }
    if (role2 === "panel" && !next) {
      var wasOpen = ctx.isOpen;
      closeFishing(ctx);
      ctx.isOpen = false;
      if (wasOpen) desktopShell().panel.close();
      return true;
    }
    return false;
  }

  // src/client/normalize-dex.js
  function normalizeDex(raw) {
    const source = obj(raw);
    const out = {};
    for (const section2 of ["forms", "skins", "fish", "items", "souvenirs", "achievements"]) {
      out[section2] = arr(source[section2]).map(function(value) {
        const entry = obj(value);
        return {
          key: str(entry.key, ""),
          label: str(entry.label, ""),
          emoji: str(entry.emoji, "\u{1F4E6}"),
          art: str(entry.art, ""),
          description: str(entry.description, ""),
          hint: str(entry.hint, ""),
          kind: str(entry.kind, ""),
          kindLabel: str(entry.kindLabel, ""),
          acquired: entry.acquired === true,
          firstAt: typeof entry.firstAt === "number" ? entry.firstAt : null,
          count: num(entry.count, 0),
          condition: str(entry.condition, ""),
          availability: ["ready", "off", "not-installed", "update-required"].includes(entry.availability) ? entry.availability : "ready",
          group: str(entry.group, ""),
          progress: Math.max(0, num(entry.progress, 0)),
          target: Math.max(1, num(entry.target, 1)),
          unit: str(entry.unit, ""),
          recovered: entry.recovered === true,
          maxSizeCm: typeof entry.maxSizeCm === "number" ? entry.maxSizeCm : null,
          requirements: arr(entry.requirements).map(function(value2) {
            const requirement = obj(value2);
            return { key: str(requirement.key, ""), label: str(requirement.label, ""), have: num(requirement.have, 0), need: num(requirement.need, 0), met: requirement.met === true };
          })
        };
      }).filter((entry) => entry.key !== "");
    }
    return out;
  }

  // src/client/normalize-fishing.js
  function feel(value, difficulty) {
    const entry = obj(value);
    return {
      difficulty: num(entry.difficulty, difficulty),
      speed: num(entry.speed, 1),
      burst: num(entry.burst, 0),
      burstScale: num(entry.burstScale, 1),
      drift: num(entry.drift, 0),
      jitter: num(entry.jitter, 0),
      zone: num(entry.zone, 1),
      hold: num(entry.hold, 1),
      rod: str(entry.rod, "")
    };
  }
  function fish(value) {
    const entry = obj(value);
    const difficulty = num(entry.difficulty, 1);
    return {
      id: str(entry.id, ""),
      key: str(entry.key, ""),
      label: str(entry.label, "\u9C7C"),
      emoji: str(entry.emoji, "\u{1F41F}"),
      rarity: str(entry.rarity, "common"),
      behavior: str(entry.behavior, "smooth"),
      difficulty,
      sizeCm: num(entry.sizeCm, 0),
      price: num(entry.price, 0),
      phase: str(entry.phase, ""),
      castPower: num(entry.castPower, 0),
      bitesAt: num(entry.bitesAt, 0),
      hookUntil: num(entry.hookUntil, 0),
      expiresAt: num(entry.expiresAt, 0),
      // 搏斗玩法（ring / bar / pull，没有就是老宿主：圆盘）；maxCm 用来说「大个的」。
      fight: str(entry.fight, "ring"),
      maxCm: num(entry.maxCm, 0),
      feel: feel(entry.feel, difficulty)
    };
  }
  function automation(value) {
    if (!isObj(value)) return null;
    return {
      unlocked: value.unlocked === true,
      stored: num(value.stored, 0),
      usedHours: num(value.usedHours, 0),
      capacityHours: 6,
      full: value.full === true,
      baitLimit: num(value.baitLimit, 0),
      choices: arr(value.choices).filter(isObj).map((choice) => ({ minutes: num(choice.minutes, 30), attempts: num(choice.attempts, 6), legacy: choice.minutes <= 60 })),
      upgrades: arr(value.upgrades).filter(isObj).map((upgrade) => ({ kind: str(upgrade.kind, ""), label: str(upgrade.label, ""), price: num(upgrade.price, 0) })).filter((upgrade) => ["basket", "duration", "baitBox"].includes(upgrade.kind))
    };
  }
  function normalizeFishing(raw) {
    const source = obj(raw);
    const rod = obj(source.rod);
    return {
      automation: automation(source.automation),
      pending: isObj(source.pending) ? fish(source.pending) : null,
      bag: arr(source.bag).map(fish).filter((entry) => entry.id !== ""),
      period: str(source.period, ""),
      autoTrips: num(source.autoTrips, 0),
      rod: { level: num(rod.level, 1), label: str(rod.label, "\u9C7C\u7AFF"), emoji: str(rod.emoji, "\u{1F3A3}") },
      nextRod: isObj(source.nextRod) ? { level: num(source.nextRod.level, 2), label: str(source.nextRod.label, ""), emoji: str(source.nextRod.emoji, "\u{1F3A3}"), price: num(source.nextRod.price, 0) } : null,
      spot: str(source.spot, "river"),
      spots: arr(source.spots).map((value) => {
        const spot = obj(value);
        return { key: str(spot.key, ""), label: str(spot.label, ""), emoji: str(spot.emoji, "\u{1F3DE}"), price: num(spot.price, 0), unlocked: spot.unlocked === true, open: spot.open !== false, kinds: num(spot.kinds, 0) };
      }).filter((spot) => spot.key !== "")
    };
  }

  // src/client/normalize-skins.js
  function normalizeSkins(raw) {
    const source = obj(raw);
    return {
      current: str(source.current, "default"),
      entries: arr(source.entries).map(function(value) {
        const entry = obj(value);
        return {
          key: str(entry.key, ""),
          label: str(entry.label, "\u76AE\u80A4"),
          emoji: str(entry.emoji, "\u{1F3A8}"),
          art: str(entry.art, ""),
          author: str(entry.author, ""),
          description: str(entry.description, ""),
          custom: entry.custom === true,
          current: entry.current === true,
          unlocked: entry.unlocked !== false,
          unlockJob: str(entry.unlockJob, ""),
          scenes: arr(entry.scenes).filter((scene3) => typeof scene3 === "string")
        };
      }).filter((entry) => entry.key !== "")
    };
  }

  // src/client/normalize-economy.js
  function normalizeEconomy(raw) {
    if (raw === null || typeof raw !== "object") return null;
    const source = obj(raw);
    return {
      sources: arr(source.sources).map(function(value) {
        const entry = obj(value);
        return { source: str(entry.source, "other"), label: typeof entry.label === "string" ? entry.label : null, in: num(entry.in, 0), out: num(entry.out, 0) };
      }),
      days: arr(source.days).map(function(value) {
        const day = obj(value);
        return { day: str(day.day, ""), in: num(day.in, 0), out: num(day.out, 0) };
      })
    };
  }

  // src/client/normalize.js
  function normalize(raw) {
    var d = obj(raw);
    var pig = isObj(d.pig) ? d.pig : null;
    var legacy = pig !== null && !("coins" in pig) && !("health" in pig);
    return {
      legacy,
      version: str(d.version, ""),
      // Trust the flag when the host sends one; for older hosts "a pig exists" is the answer.
      hatched: d.hatched === true || d.hatched === void 0 && pig !== null,
      dead: d.dead === true || pig !== null && num(pig.health, 5) <= 0,
      pig: pig === null ? null : {
        name: str(pig.name, "\u732A\u732A"),
        // The pig is measured in days now; `stage` carries how big it is and
        // what it looks like.
        stage: {
          key: str(obj(pig.stage).key, "piglet"),
          label: str(obj(pig.stage).label, "\u5C0F\u732A"),
          emoji: str(obj(pig.stage).emoji, "\u{1F416}"),
          size: num(obj(pig.stage).size, 56),
          line: str(obj(pig.stage).line, ""),
          art: typeof obj(pig.stage).art === "string" && obj(pig.stage).art !== "" ? obj(pig.stage).art : null,
          faded: obj(pig.stage).faded === true,
          // 加冕后的形态：有没有动作立绘、盖住哪些装扮位置。
          actionArt: obj(pig.stage).actionArt === true,
          artScenes: arr(obj(pig.stage).artScenes).filter((scene3) => typeof scene3 === "string"),
          hides: arr(obj(pig.stage).hides).map(function(slot) {
            return str(slot, "");
          })
        },
        // Older hosts send no sex; the HUD then simply shows none.
        sex: isObj(pig.sex) ? { key: str(pig.sex.key, ""), label: str(pig.sex.label, ""), symbol: str(pig.sex.symbol, "") } : null,
        ageLabel: str(pig.ageLabel, ""),
        ageForced: pig.ageForced === true,
        daysToNextStage: typeof pig.daysToNextStage === "number" ? pig.daysToNextStage : null,
        soul: pig.soul === true,
        mood: str(pig.mood, "fine"),
        moodEmoji: str(pig.moodEmoji, "\u{1F60A}"),
        moodLabel: str(pig.moodLabel, "\u8FD8\u4E0D\u9519"),
        satiety: Math.round(num(pig.satiety, 0)),
        happiness: Math.round(num(pig.happiness, 0)),
        cleanliness: Math.round(num(pig.cleanliness, 0)),
        health: num(pig.health, 5),
        healthPercent: num(pig.healthPercent, 100),
        coins: num(pig.coins, 0),
        weight: str(pig.weight, "\u2014"),
        bodyWeight: isObj(pig.bodyWeight) ? {
          class: str(obj(pig.bodyWeight).class, "normal"),
          label: str(obj(pig.bodyWeight).label, "\u6B63\u5E38"),
          visible: obj(pig.bodyWeight).visible === true,
          weightG: Math.round(num(obj(pig.bodyWeight).weightG, 0)),
          idealG: Math.round(num(obj(pig.bodyWeight).idealG, 1360)),
          roundAtG: Math.round(num(obj(pig.bodyWeight).roundAtG, 1768)),
          fatAtG: Math.round(num(obj(pig.bodyWeight).fatAtG, 2176)),
          ideal: str(obj(pig.bodyWeight).ideal, "\u2014"),
          roundAt: str(obj(pig.bodyWeight).roundAt, "\u2014"),
          fatAt: str(obj(pig.bodyWeight).fatAt, "\u2014"),
          playsLeft: Math.round(num(obj(pig.bodyWeight).playsLeft, 0))
        } : null,
        xp: num(pig.xp, 0),
        level: (function(info) {
          var i = obj(info);
          var t = obj(i.title);
          return {
            level: num(i.level, 1),
            percent: num(i.percent, 0),
            toNext: num(i.toNext, 0),
            maxed: i.maxed === true,
            titleLabel: str(t.label, "\u65B0\u6765\u7684"),
            titleEmoji: str(t.emoji, "\u{1F331}"),
            next: isObj(i.nextTitle) ? { level: num(i.nextTitle.level, 0), label: str(i.nextTitle.label, ""), emoji: str(i.nextTitle.emoji, "") } : null
          };
        })(pig.levelInfo),
        stageLine: str(pig.stageLine, ""),
        birthdayToday: pig.birthdayToday === true,
        illness: isObj(pig.illness) ? {
          name: str(pig.illness.name, "\u751F\u75C5"),
          cure: str(pig.illness.cure, "\u836F"),
          cureEmoji: str(pig.illness.cureEmoji, "\u{1F48A}"),
          stage: num(pig.illness.stage, 1),
          chainKey: str(pig.illness.chainKey, ""),
          doctorFee: typeof pig.illness.doctorFee === "number" ? pig.illness.doctorFee : null
        } : null,
        traits: {
          intel: num(obj(pig.traits).intel, 0),
          charm: num(obj(pig.traits).charm, 0),
          strong: num(obj(pig.traits).strong, 0)
        },
        courses: obj(pig.courses),
        // Souvenirs are objects now (rarity + story). An old host sent bare
        // strings, and those must still list rather than turn into [object
        // Object] or vanish.
        souvenirs: arr(pig.souvenirs).map((entry) => {
          if (typeof entry === "string") {
            return { key: entry, emoji: "\u{1F381}", label: entry, rarityLabel: "\u666E\u901A", rarityEmoji: "\u26AA", price: 0, story: "", fromLabel: "" };
          }
          return {
            key: str(obj(entry).key, ""),
            emoji: str(obj(entry).emoji, "\u{1F381}"),
            label: str(obj(entry).label, "\u7EAA\u5FF5\u54C1"),
            rarityLabel: str(obj(entry).rarityLabel, "\u666E\u901A"),
            rarityEmoji: str(obj(entry).rarityEmoji, "\u26AA"),
            price: num(obj(entry).price, 0),
            story: str(obj(entry).story, ""),
            fromLabel: str(obj(entry).fromLabel, "")
          };
        }).filter((entry) => entry.key !== ""),
        memories: arr(pig.memories).filter((m) => typeof m === "string")
      },
      actions: normalizeActions(d.actions),
      jobs: arr(d.jobs).map((job2) => ({
        key: str(obj(job2).key, ""),
        label: str(obj(job2).label, "\u5DE5\u4F5C"),
        emoji: str(obj(job2).emoji, "\u{1F4BC}"),
        minutes: num(obj(job2).minutes, 0),
        coins: num(obj(job2).coins, 0),
        available: obj(job2).available === true,
        // What schooling has bought this job.
        traitLabel: str(obj(job2).traitLabel, ""),
        traitEmoji: str(obj(job2).traitEmoji, ""),
        traitPoints: num(obj(job2).traitPoints, 0),
        baseMinutes: num(obj(job2).baseMinutes, 0),
        baseCoins: num(obj(job2).baseCoins, 0),
        payPercent: num(obj(job2).payPercent, 0),
        // 短班；老宿主没有，就是 0，不显示按钮。
        shortMinutes: num(obj(job2).shortMinutes, 0),
        shortCoins: num(obj(job2).shortCoins, 0),
        speedPercent: num(obj(job2).speedPercent, 0),
        // An old host has no gate at all, so a missing flag must read as
        // "qualified" — the opposite default would lock every job on upgrade.
        qualified: obj(job2).qualified !== false,
        lockText: str(obj(job2).lockText, ""),
        level: num(obj(job2).level, 1),
        trait: str(obj(job2).trait, ""),
        satiety: num(obj(job2).satiety, 0),
        cleanliness: num(obj(job2).cleanliness, 0),
        requirements: arr(obj(job2).requirements).filter(isObj).map((entry) => ({
          text: str(entry.text, ""),
          need: num(entry.need, 0),
          have: num(entry.have, 0),
          kind: str(entry.kind, ""),
          met: entry.met === true
        }))
      })).filter((job2) => job2.key !== ""),
      // B4: nine subjects, each with its own lesson count and stage.
      subjects: arr(d.subjects).map((sub) => ({
        key: str(obj(sub).key, ""),
        label: str(obj(sub).label, "\u8BFE"),
        emoji: str(obj(sub).emoji, "\u{1F4D8}"),
        traitLabel: str(obj(sub).traitLabel, ""),
        traitEmoji: str(obj(sub).traitEmoji, ""),
        lessons: num(obj(sub).lessons, num(obj(sub).level, 0)),
        stageKey: str(obj(obj(sub).stage).key, ""),
        stageLabel: str(obj(obj(sub).stage).label, ""),
        graduatedLabel: isObj(obj(sub).graduated) ? str(obj(sub).graduated.label, "") : "",
        nextGraduation: typeof obj(sub).nextGraduation === "number" ? obj(sub).nextGraduation : null,
        minutes: num(obj(sub).minutes, 0),
        tuition: num(obj(sub).tuition, 0),
        gain: num(obj(sub).gain, 0),
        secondaryGain: num(obj(sub).secondaryGain, 0),
        available: obj(sub).available === true,
        affordable: obj(sub).affordable !== false
      })).filter((sub) => sub.key !== ""),
      // 兴趣课：学习页里随时能学的一栏，学完加的是既有的三条属性。
      interests: arr(d.interests).map((entry) => ({
        key: str(obj(entry).key, ""),
        label: str(obj(entry).label, "\u5174\u8DA3"),
        emoji: str(obj(entry).emoji, "\u{1F3AF}"),
        traitLabel: str(obj(entry).traitLabel, ""),
        traitEmoji: str(obj(entry).traitEmoji, ""),
        minutes: num(obj(entry).minutes, 0),
        cost: num(obj(entry).cost, 0),
        gain: num(obj(entry).gain, 0),
        blurb: str(obj(entry).blurb, ""),
        times: num(obj(entry).times, 0),
        certificate: str(obj(entry).certificate, ""),
        certificateAfter: num(obj(entry).certificateAfter, 0),
        certified: obj(entry).certified === true,
        available: obj(entry).available === true,
        affordable: obj(entry).affordable === true
      })).filter((entry) => entry.key !== ""),
      stages: arr(d.stages).map((stage2) => ({
        key: str(obj(stage2).key, ""),
        label: str(obj(stage2).label, "\u5B66\u6BB5"),
        emoji: str(obj(stage2).emoji, "\u{1F4DA}"),
        minutes: num(obj(stage2).minutes, 0),
        tuition: num(obj(stage2).tuition, 0),
        gain: num(obj(stage2).gain, 0),
        // B4: the lesson numbers this stage covers (upTo null = no end).
        from: num(obj(stage2).from, 0),
        upTo: typeof obj(stage2).upTo === "number" ? obj(stage2).upTo : null,
        // Which courses this stage teaches — empty on an old host, in which
        // case the panel shows every subject rather than none.
        subjects: arr(obj(stage2).subjects).filter((key) => typeof key === "string"),
        // The school ladder: a stage with `unlocked === false` is gated behind
        // finishing the previous one, and says by how much.
        unlocked: obj(stage2).unlocked !== false,
        progress: isObj(obj(stage2).progress) ? {
          done: num(obj(stage2).progress.done, 0),
          need: num(obj(stage2).progress.need, 0),
          label: str(obj(stage2).progress.label, "")
        } : null
      })).filter((stage2) => stage2.key !== ""),
      trips: arr(d.trips).map((trip) => ({
        key: str(obj(trip).key, ""),
        label: str(obj(trip).label, "\u76EE\u7684\u5730"),
        emoji: str(obj(trip).emoji, "\u{1F9F3}"),
        minutes: num(obj(trip).minutes, 0),
        cost: num(obj(trip).cost, 0),
        happiness: num(obj(trip).happiness, 0),
        // What the destination can bring back — the far trips advertise it.
        souvenirCount: num(obj(trip).souvenirCount, 0),
        bestRarity: str(obj(trip).bestRarity, ""),
        bestRarityEmoji: str(obj(trip).bestRarityEmoji, ""),
        affordable: obj(trip).affordable === true,
        available: obj(trip).available === true,
        locked: str(obj(trip).locked, "")
      })).filter((trip) => trip.key !== ""),
      // 家当: owned and worn, never counted. An old host sends none.
      dress: arr(d.dress).map((entry) => ({
        key: str(obj(entry).key, ""),
        label: str(obj(entry).label, "\u88C5\u626E"),
        emoji: str(obj(entry).emoji, "\u{1F455}"),
        price: num(obj(entry).price, 0),
        level: num(obj(entry).level, 1),
        slot: str(obj(entry).slot, ""),
        slotLabel: str(obj(entry).slotLabel, ""),
        blurb: str(obj(entry).blurb, ""),
        owned: obj(entry).owned === true,
        worn: obj(entry).worn === true,
        unlocked: obj(entry).unlocked !== false
      })).filter((entry) => entry.key !== ""),
      shop: arr(d.shop).map((item) => ({
        key: str(obj(item).key, ""),
        label: str(obj(item).label, "\u7269\u54C1"),
        emoji: str(obj(item).emoji, "\u{1F4E6}"),
        price: num(obj(item).price, 0),
        kind: str(obj(item).kind, "food"),
        tier: typeof obj(item).tier === "number" ? obj(item).tier : null,
        // 家当 fields: a dress item is owned (not counted) or waits for a level.
        level: typeof obj(item).level === "number" ? obj(item).level : null,
        owned: obj(item).owned === true,
        worn: obj(item).worn === true,
        unlocked: obj(item).unlocked !== false,
        blurb: str(obj(item).blurb, ""),
        useLabel: str(obj(item).useLabel, "\u4F7F\u7528"),
        affordable: obj(item).affordable === true,
        needed: obj(item).needed === true
      })).filter((item) => item.key !== ""),
      inventory: obj(d.inventory),
      dex: normalizeDex(d.dex),
      skins: normalizeSkins(d.skins),
      economy: normalizeEconomy(d.economy),
      fishing: normalizeFishing(d.fishing),
      ...normalizeExtensionParts(d),
      // 下载扩展的 App、货架和图鉴入口
      daily: {
        canSignIn: obj(d.daily).canSignIn === true,
        signInDay: num(obj(d.daily).signInDay, 1),
        signInTotal: num(obj(d.daily).signInTotal, 0),
        cycle: num(obj(d.daily).cycle, 12),
        unclaimed: num(obj(d.daily).unclaimed, 0),
        onlineMinutes: num(obj(d.daily).onlineMinutes, 0)
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
          happiness: num(obj(d.pomodoro.reward).happiness, 0)
        },
        breakMinutes: num(d.pomodoro.breakMinutes, 5),
        options: arr(d.pomodoro.options).filter((value) => typeof value === "number"),
        finishedAt: typeof d.pomodoro.finishedAt === "number" ? d.pomodoro.finishedAt : null
      } : null,
      diary: arr(d.diary).map((entry) => ({
        day: str(obj(entry).day, ""),
        text: str(obj(entry).text, "")
      })).filter((entry) => entry.day !== "" && entry.text !== ""),
      // Which items each care action could spend right now.
      care: (() => {
        const out = {};
        const source = obj(d.care);
        for (const action of ["feed", "bathe", "play"]) {
          out[action] = arr(source[action]).map((entry) => ({
            key: str(obj(entry).key, ""),
            label: str(obj(entry).label, "\u7269\u54C1"),
            emoji: str(obj(entry).emoji, "\u{1F4E6}"),
            default: obj(entry).default === true,
            count: typeof obj(entry).count === "number" ? obj(entry).count : null,
            satiety: num(obj(entry).satiety, 0),
            happiness: num(obj(entry).happiness, 0),
            cleanliness: num(obj(entry).cleanliness, 0)
          })).filter((entry) => entry.key !== "");
        }
        return out;
      })(),
      activity: isObj(d.activity) ? {
        kind: str(d.activity.kind, "work"),
        key: str(d.activity.key, ""),
        label: str(d.activity.label, "\u5916\u9762"),
        emoji: str(d.activity.emoji, "\u{1F4BC}"),
        secondsLeft: num(d.activity.secondsLeft, 0),
        cost: num(d.activity.cost, 0),
        progress: num(d.activity.progress, 0)
      } : null,
      canGoOut: d.canGoOut === true,
      timeScale: num(d.timeScale, 1),
      boxStage: isObj(d.boxStage) ? {
        key: str(d.boxStage.key, "box"),
        label: str(d.boxStage.label, "\u7EB8\u76D2"),
        emoji: str(d.boxStage.emoji, "\u{1F4E6}"),
        size: num(d.boxStage.size, 58)
      } : { key: "box", label: "\u7EB8\u76D2", emoji: "\u{1F4E6}", size: 58 },
      awayBlocked: typeof d.awayBlocked === "string" ? d.awayBlocked : null,
      // B9: the villager card. Older hosts send none, and the card says so.
      profile: isObj(d.profile) ? {
        personality: isObj(d.profile.personality) ? { label: str(d.profile.personality.label, ""), emoji: str(d.profile.personality.emoji, "") } : null,
        catchphrase: str(d.profile.catchphrase, ""),
        motto: str(d.profile.motto, ""),
        birthday: str(d.profile.birthday, ""),
        zodiac: isObj(d.profile.zodiac) ? { label: str(d.profile.zodiac.label, ""), emoji: str(d.profile.zodiac.emoji, "") } : null,
        counts: {
          days: num(obj(d.profile.counts).days, 0),
          certificates: num(obj(d.profile.counts).certificates, 0),
          souvenirs: num(obj(d.profile.counts).souvenirs, 0),
          graduations: num(obj(d.profile.counts).graduations, 0)
        }
      } : null,
      // 形态: the forms and how close the pig is. Older hosts send none, and older
      // hosts also have no `via` — treat those as 加冕, which is what they were.
      forms: isObj(d.forms) ? {
        current: typeof d.forms.current === "string" ? d.forms.current : null,
        forms: arr(d.forms.forms).map(function(raw2) {
          var f = obj(raw2);
          return {
            key: str(f.key, ""),
            via: str(f.via, "item"),
            item: str(f.item, ""),
            label: str(f.label, ""),
            emoji: str(f.emoji, "\u{1F451}"),
            art: str(f.art, ""),
            hasItem: f.hasItem === true,
            stage: str(f.stage, ""),
            fromLevel: num(f.fromLevel, 1),
            current: f.current === true,
            ready: f.ready === true,
            requirements: arr(f.requirements).map(function(row) {
              var r = obj(row);
              return { key: str(r.key, ""), label: str(r.label, ""), have: num(r.have, 0), need: num(r.need, 0), met: r.met === true };
            })
          };
        })
      } : null,
      // B6: what the pig calls its owner, and 免打扰. Older hosts send neither.
      dialogue: {
        ownerName: str(obj(d.dialogue).ownerName, "\u4E3B\u4EBA"),
        quiet: obj(d.dialogue).quiet === true
      },
      pending: arr(d.pending).filter((e) => isObj(e) && typeof e.at === "number").map((e) => ({
        id: num(e.id, 0),
        kind: str(e.kind, ""),
        text: str(e.text, ""),
        at: e.at,
        replies: arr(e.replies).filter((label) => typeof label === "string")
      })),
      maxHealth: num(d.maxHealth, 5)
    };
  }
  function normalizeActions(raw) {
    var source = obj(raw);
    var out = {};
    for (var i = 0; i < MODES.length; i += 1) {
      var key = MODES[i];
      var entry = obj(source[key]);
      out[key] = {
        ready: entry.ready !== false,
        waitSeconds: num(entry.waitSeconds, 0),
        blocked: typeof entry.blocked === "string" ? entry.blocked : null
      };
    }
    return out;
  }

  // src/client/pig-size.js
  var PIG_SIZE_KEY = "dsh-piggy:pig-size";
  var OLD_SCALE = { small: 0.85, standard: 1, large: 1.3, extra: 1.7, 48: 0.85, 56: 1, 72: 1.3, 96: 1.7 };
  function pigSize() {
    const saved = readStore(PIG_SIZE_KEY);
    if (saved?.startsWith("scale:")) {
      const value = Number(saved.slice(6));
      if (Number.isFinite(value) && value > 0) return value;
    }
    const scale = OLD_SCALE[saved] ?? 1;
    if (saved !== null) setPigSize(scale);
    return scale;
  }
  function setPigSize(value) {
    const scale = Number(value);
    writeStore(PIG_SIZE_KEY, "scale:" + (Number.isFinite(scale) && scale > 0 ? scale : 1));
  }
  function displayedPigSize(stageSize) {
    return stageSize * pigSize();
  }
  function attachSizePreference(host3, getStage, onChanged) {
    function onStorage(event) {
      if (event.key !== PIG_SIZE_KEY) return;
      const stage2 = getStage();
      if (!stage2) return;
      host3.style.setProperty("--pig-size", displayedPigSize(stage2.size) + "px");
      onChanged?.();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }

  // src/client/pat-cursor.js
  var SIZE = 32;
  var drawnFor = null;
  function applyPatCursor(host3) {
    if (typeof document === "undefined" || typeof document.createElement !== "function" || typeof getComputedStyle !== "function") return;
    let family = "sans-serif";
    try {
      family = String(getComputedStyle(host3).getPropertyValue("--ac-font") || "").trim() || "sans-serif";
    } catch {
      return;
    }
    if (drawnFor === family) return;
    drawnFor = family;
    const font = `26px ${family}`;
    const draw = () => {
      try {
        const canvas = (
          /** @type {HTMLCanvasElement} */
          document.createElement("canvas")
        );
        if (typeof canvas.getContext !== "function") return;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (ctx === null) return;
        ctx.font = font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u{1F44B}", SIZE / 2, SIZE / 2 + 1);
        const url = canvas.toDataURL("image/png");
        if (typeof url === "string" && url.startsWith("data:image/png")) host3.style.setProperty("--pat-cursor", `url(${url}) 14 18, pointer`);
      } catch {
      }
    };
    const fonts = (
      /** @type {any} */
      document.fonts
    );
    try {
      if (fonts !== void 0 && typeof fonts.load === "function") fonts.load(font, "\u{1F44B}").then(draw, draw);
      else draw();
    } catch {
    }
  }

  // src/client/emoji-style.js
  var EMOJI_STYLE_KEY = "dsh-piggy:emoji-style";
  function emojiStyle() {
    return readStore(EMOJI_STYLE_KEY) === "system" ? "system" : "bundled";
  }
  function setEmojiStyle(style) {
    writeStore(EMOJI_STYLE_KEY, style === "system" ? "system" : "bundled");
  }
  function hasBundledEmoji() {
    try {
      const fonts = (
        /** @type {any} */
        document.fonts
      );
      if (fonts === void 0 || typeof fonts.forEach !== "function") return false;
      let found = false;
      fonts.forEach(function(face) {
        if (String(face.family).replace(/["']/g, "") === "Piggy Emoji") found = true;
      });
      return found;
    } catch {
      return false;
    }
  }
  function applyEmojiStyle(host3) {
    host3.setAttribute("data-emoji", emojiStyle());
    applyPatCursor(host3);
  }

  // src/client/birthday.js
  var CAKE_KEY = "dsh-piggy:cake";
  var PARTY_MS = 15e3;
  function today() {
    var now = /* @__PURE__ */ new Date();
    return now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
  }
  function cakeTakenToday() {
    return readStore(CAKE_KEY) === today();
  }
  function createBirthday(c) {
    var timer2 = null;
    c.ctx.birthdayNow = function() {
      c.ctx.cakeForced = true;
      c.render();
    };
    return {
      /** 点了蛋糕：猪短暂换成生日图、冒彩带，蛋糕今天不再冒。 */
      celebrate: function() {
        writeStore(CAKE_KEY, today());
        c.ctx.cakeForced = false;
        c.pig.setAttribute("data-party", "true");
        syncPigArt(c.pig, c.pigArt, c.pigEmoji);
        c.burst(["\u{1F382}", "\u{1F389}", "\u{1F388}"], 6);
        c.render();
        if (timer2 !== null) window.clearTimeout(timer2);
        timer2 = window.setTimeout(function() {
          timer2 = null;
          c.pig.removeAttribute("data-party");
          syncPigArt(c.pig, c.pigArt, c.pigEmoji);
        }, PARTY_MS);
      }
    };
  }

  // src/client/css-achievements.js
  var CSS_ACHIEVEMENTS = `
.dp-ach-intro{font-size:12px;line-height:1.7;color:var(--ac-ink-soft,#756c60);padding:3px 0 12px}
.dp-ach-group{font-size:12px;font-weight:800;margin:16px 0 8px;color:var(--ac-ink,#514341)}
.dp-ach-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dp-ach-card{border:1px solid #e8e2d5;background:#fffdf7;border-radius:18px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#514341;cursor:pointer;font:inherit}
.dp-ach-card b{font-size:12px}.dp-ach-card small{font-size:11px;color:#81786d}
.dp-ach-badge{width:74px;height:74px;object-fit:contain;pointer-events:none}
[data-earned="false"]>.dp-ach-badge{filter:grayscale(1);opacity:.48}
.dp-ach-card[data-earned="true"]{background:#f3faf0;border-color:#c5ddba}
.dp-ach-card:hover{border-color:#81b5a6}.dp-ach-card:focus-visible,.dp-ach-back:focus-visible{outline:2px solid #68a995;outline-offset:2px}
.dp-ach-detail{text-align:center;background:#fffdf7;border:1px solid #e8e2d5;border-radius:22px;padding:24px 16px;margin-top:12px}
.dp-ach-detail .dp-ach-badge{width:132px;height:132px}.dp-ach-detail h3{font-size:18px;margin:12px 0}
.dp-ach-detail p{font-size:13px;line-height:1.8;margin:12px 0}.dp-ach-detail small{display:block;margin-top:16px;font-size:11px;color:#81786d}
.dp-ach-back{background:transparent;border:0;color:#578d7f;padding:8px 0;font:inherit;font-size:12px;cursor:pointer}
`;

  // src/client/css-base.js
  var CSS_BASE = [
    // ---------------------------------------------------------------------
    // Animal Crossing design language, transcribed from
    // guokaigdg/animal-island-ui docs/design-system (design-tokens.md and the
    // standalone css-variables.md template).
    //
    // The tokens are declared on the widget root rather than :root: the host
    // page must not inherit them, and they must not be clobbered by it.
    //
    // The rules that shape everything below:
    //   · warm earth-brown text on cream parchment, never pure black or grey
    //   · 12px minimum radius; buttons and inputs are 50px pills
    //   · the thick 3D bottom shadow belongs to primary buttons only
    //   · cards carry a border, not an elevation shadow
    //   · motion is 0.15-0.35s on cubic-bezier(.4,0,.2,1)
    //   · focus rings are yellow or teal, never blue
    // ---------------------------------------------------------------------
    // 设置 → Emoji 样式 → 系统自带：去掉内置那套，用这台设备的 emoji。
    '[data-dsh-pig][data-dsh-pig][data-emoji="system"]{--ac-font:Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif;}',
    "[data-dsh-pig]{",
    // 内置 emoji 排在前面：它只有表情字形，普通文字会自然落到后面的字体。
    // 桌面版的外壳提供同一个字体家族；网页版由 scene.js 注入 @font-face（assets/piggy-emoji.woff2）。
    '--ac-font:"Piggy Emoji",Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif;',
    "--ac-primary:#19c8b9;--ac-primary-hover:#3dd4c6;--ac-primary-active:#11a89b;",
    "--ac-primary-bg:#e6f9f6;",
    "--ac-text:#794f27;--ac-text-body:#725d42;--ac-text-2:#9f927d;--ac-text-muted:#8a7b66;",
    "--ac-text-disabled:#c4b89e;",
    "--ac-bg:#f8f8f0;--ac-bg-content:rgb(247,243,223);--ac-bg-input:#fffbe7;",
    "--ac-bg-disabled:#f0ece2;",
    "--ac-border:#c4b89e;--ac-border-light:#e5dcc6;--ac-border-hover:#a89878;",
    "--ac-radius-sm:12px;--ac-radius-card:20px;--ac-pill:50px;",
    "--ac-shadow-sm:0 2px 4px 0 rgba(61,52,40,.06);",
    "--ac-shadow:0 3px 10px 0 rgba(61,52,40,.1);",
    "--ac-shadow-lg:0 8px 24px 0 rgba(61,52,40,.16);",
    "--ac-inset:inset 0 2px 4px rgba(114,93,66,.15);",
    // sidebar tokens: the library uses these for the selected menu row, which
    // is exactly the role the icon bar plays here.
    "--ac-active:#b7c6e5;--ac-hover:#d6dff0;",
    "--ac-success:#6fba2c;--ac-warning:#f5c31c;--ac-error:#e05a5a;",
    "--ac-ease:cubic-bezier(.4,0,.2,1);",
    // One place to size the pig; the scene and the panel cap derive from it.
    "--pig-size:56px;--pig-gap-below:12px;--scene-open:132px;--panel-width:292px;",
    "position:fixed;right:18px;bottom:18px;z-index:2147483000;",
    "font-family:var(--ac-font);font-weight:500;letter-spacing:.01em;",
    "-webkit-user-select:none;user-select:none;touch-action:none;",
    // The wrapper spans a column wider and taller than what it paints (the
    // scene's padding, the gap above the panel). Without this it swallows
    // clicks aimed at the page underneath — which once looked like "sending a
    // message does nothing" while the whole stack was healthy.
    "pointer-events:none;",
    // The pig is the only in-flow child, so the wrapper's box is exactly the
    // pig's box and the panel can be parked anywhere around it without ever
    // nudging the pig. `fitPanel` places the panel.
    "display:block}",
    "[data-dsh-pig] *{box-sizing:border-box}",
    "[data-dsh-pig]>*{pointer-events:auto}",
    // `hidden` MUST win. The UA sheet's `[hidden]{display:none}` ties on
    // specificity with a single class, so any `.dp-x{display:grid|flex}` rule
    // below silently beats it and the element keeps rendering. That is exactly
    // how a collapsed panel ended up showing the icon bar and the hud while
    // every `el.hidden === true` assertion still passed.
    "[data-dsh-pig] .dp-card[hidden],[data-dsh-pig] .dp-bar[hidden],",
    "[data-dsh-pig] .dp-content[hidden],[data-dsh-pig] .dp-hud[hidden],",
    "[data-dsh-pig] .dp-bubble[hidden],[data-dsh-pig] .dp-scene[hidden],",
    "[data-dsh-pig] .dp-work[hidden],[data-dsh-pig] .dp-soul[hidden],",
    "[data-dsh-pig] .dp-poke-hint[hidden],[data-dsh-pig] .dp-daily[hidden],",
    "[data-dsh-pig] .dp-pomo[hidden],",
    "[data-dsh-pig] .dp-pig-img[hidden],[data-dsh-pig] .dp-pig-emoji[hidden]{display:none}",
    /* ---------- the panel: cream parchment, border not shadow ---------- */
    // Taken out of flow on purpose. In flow it would widen the wrapper, and a
    // wider wrapper moves the pig — the exact thing this layout exists to
    // prevent. Absolutely positioned, the wrapper's box stays the pig's box
    // and `fitPanel` can put the panel on whichever side has room.
    ".dp-card{position:absolute;right:0;bottom:calc(100% + 8px);width:var(--panel-width);",
    "border-radius:var(--ac-radius-card);overflow:hidden;",
    "display:flex;flex-direction:column;",
    "background:var(--ac-bg);border:2px solid var(--ac-border-light);",
    // 面板自己钉住基准字号与字体：不钉就会继承宿主页面的 16px，
    // 详情框那种「没写 font-size 的容器」就会比周围大一倍（用户反馈 #2）。
    "box-shadow:var(--ac-shadow-lg);color:var(--ac-text-body);font-family:var(--ac-font);font-size:11px}",
    /* ---------- the pig: never moved, never boxed ---------- */
    ".dp-scene{position:relative;height:var(--scene-open);background:none;cursor:grab;",
    "overflow:visible;display:flex;align-items:flex-end;justify-content:flex-end;",
    "padding:0 6px var(--pig-gap-below);width:max-content}",
    '.dp-scene[data-dragging="true"]{cursor:grabbing}',
    // Collapsed the scene is exactly the pig, so the wrapper paints nothing
    // extra to click through. Open it widens to the panel so the hud and the
    // speech bubble have somewhere to sit — the pig is right-aligned either
    // way, so widening costs it no movement.
    '[data-dsh-pig][data-open="true"] .dp-scene{width:var(--panel-width)}',
    // Near the desktop's top edge the panel opens below. Keep the pig at the
    // same foot line as the collapsed scene instead of dropping it by 64px.
    '[data-dsh-pig][data-panel-vertical="below"][data-open="true"] .dp-scene{height:calc(var(--pig-size) + var(--pig-gap-below))}',
    // 面板朝下开时场景只有猪那么高，名牌从顶上往下排会贴着面板（用户反馈「状态栏和菜单贴太近」）。
    // 改成名牌底边对齐猪脚上方一点，和下面的面板留出 16px，跟朝上开时一样宽。
    '[data-dsh-pig][data-panel-vertical="below"][data-open="true"] .dp-hud{top:auto;bottom:8px}',
    // 桌面版面板朝右开时（外壳把窗口贴着猪、右边有地方），猪改待在场景左端，
    // 跟着猪定位的气泡和打工道具也要镜像 —— 网页版没有这个属性，规则不命中。
    '[data-dsh-pig][data-panel-side="right"] .dp-scene{justify-content:flex-start}',
    '[data-dsh-pig][data-panel-side="right"] .dp-work{margin:0 0 6px 2px}',
    // Collapsed the scene shrinks to just the pig. An explicit height rather
    // than `auto` keeps the pig's line box identical in both states, so
    // opening moves it by exactly zero pixels.
    '[data-dsh-pig][data-open="false"] .dp-scene{height:calc(var(--pig-size) + var(--pig-gap-below));',
    "cursor:pointer}",
    // 阴影挂在立绘（不动的元素）上，而不是做 bob/breathe 的 .dp-pig 上：
    // 动画只改 transform，滤镜跟着每帧重算在 Windows 上很贵（D1 第 4 条）。
    ".dp-pig{line-height:1;transform-origin:50% 85%;cursor:pointer;position:relative;",
    "animation:dp-bob 1.8s ease-in-out infinite}",
    ".dp-pig-img,.dp-pig-emoji{filter:drop-shadow(0 4px 6px rgba(61,52,40,.28))}",
    ".dp-pig-sleep{display:none;position:absolute;top:0;left:calc(50% - var(--pig-size) * .6);z-index:1;",
    "width:calc(var(--pig-size) * 1.2);height:var(--pig-size);object-fit:contain;",
    "scale:var(--art-zoom,1);",
    "translate:var(--art-x,0%) var(--art-y,0%);pointer-events:none;-webkit-user-drag:none;user-select:none}",
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-pig-img,',
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-pig-emoji{visibility:hidden}',
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-pig-sleep{display:block}',
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-dress{visibility:hidden}',
    // 打盹时在头顶轻轻冒两次 Zzz；位置落在桌面猪窗口已预留的气泡区。
    ".dp-nap-zzz{display:none;position:absolute;left:calc(50% - 14px);top:-25px;z-index:4;",
    "padding:3px 7px;border:2px solid var(--ac-border-light);border-radius:11px;",
    "background:var(--ac-bg-input);color:var(--ac-text-body);box-shadow:var(--ac-shadow-sm);",
    "font:800 11px/1.2 var(--ac-font);letter-spacing:.04em;white-space:nowrap;pointer-events:none}",
    '.dp-nap-zzz::after{content:"";position:absolute;left:8px;top:calc(100% - 3px);',
    "width:7px;height:7px;background:var(--ac-bg-input);border-right:2px solid var(--ac-border-light);",
    "border-bottom:2px solid var(--ac-border-light);transform:rotate(45deg)}",
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-nap-zzz{display:block;',
    "animation:dp-nap-zzz-pop 2s ease-in-out 2 both}",
    "@keyframes dp-nap-zzz-pop{0%,8%,65%,100%{opacity:0;transform:translateY(3px) scale(.86)}",
    "18%,50%{opacity:1;transform:translateY(-2px) scale(1)}}",
    // 装扮点位：猪身上固定的几个锚点，每个点位挂一件。
    // 以后换真立绘时，只改这里的偏移/尺寸，逻辑和存档都不用动。
    ".dp-dress{position:absolute;inset:0;pointer-events:none;z-index:3}",
    ".dp-slot{position:absolute;line-height:1;font-size:15px;transform:translate(-50%,-50%)}",
    '.dp-slot[data-slot="head"]{left:50%;top:2%}',
    '.dp-slot[data-slot="face"]{left:50%;top:32%}',
    '.dp-slot[data-slot="neck"]{left:50%;top:60%}',
    '.dp-slot[data-slot="body"]{left:50%;top:78%;font-size:19px}',
    '.dp-slot[data-slot="back"]{left:14%;top:42%;font-size:19px}',
    '.dp-slot[data-slot="feet"]{left:50%;top:99%}',
    '[data-dsh-pig][data-open="false"] .dp-pig{filter:drop-shadow(0 5px 9px rgba(61,52,40,.26))}',
    '[data-dsh-pig][data-open="false"] .dp-pig[data-feedback="true"]{filter:none}',
    // A petting hand rather than an arrow. Drawn inline as an SVG data URI so
    // it needs no asset and can carry the palette's warm outline; the hotspot
    // sits in the palm, which is where a pat actually lands. The `pointer`
    // after it is the fallback for browsers that refuse a custom cursor.
    // 运行时会用 canvas 画好挥手 emoji 写进 --pat-cursor（见 pat-cursor.js）；下面的手画手掌只是兜底。
    `.dp-pig{cursor:var(--pat-cursor, url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><g fill="%23F7C9B6" stroke="%23794F27" stroke-width="1.7" stroke-linejoin="round"><rect x="10" y="13.5" width="14" height="12" rx="4.8"/><rect x="10.6" y="6.6" width="3.6" height="10" rx="1.8"/><rect x="14.9" y="5.1" width="3.6" height="11.5" rx="1.8"/><rect x="19.2" y="6.6" width="3.6" height="10" rx="1.8"/><rect x="5.7" y="12.4" width="3.4" height="7.8" rx="1.7" transform="rotate(-27 7.4 16.3)"/></g></svg>') 16 24, pointer)}`,
    // Transform-only keyframes: the pig is an ordinary flex item, so there is
    // no translateX(-50%) centring to preserve.
    "@keyframes dp-bob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(-2.5deg)}}",
    "@keyframes dp-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(1px) scale(1.09)}}",
    "@keyframes dp-shake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-4px) rotate(-5deg)}60%{transform:translateX(4px) rotate(5deg)}}",
    "@keyframes dp-spin{0%{transform:rotate(0)}50%{transform:rotate(180deg) scale(1.2)}100%{transform:rotate(360deg)}}",
    "@keyframes dp-jump{0%{transform:translateY(0)}30%{transform:translateY(-26px) scale(1.12)}60%{transform:translateY(0) scale(.92)}100%{transform:translateY(0)}}",
    // 照料反应从脚边发力、落地后轻轻回弹；幅度留在猪窗口原有的固定范围内。
    "@keyframes dp-feed-hop{0%,100%{transform:translateY(0) scale(1)}",
    "14%{transform:translateY(2px) scale(1.07,.91)}38%{transform:translateY(-12px) scale(.96,1.07)}",
    "58%{transform:translateY(0) scale(1.1,.88)}76%{transform:translateY(-4px) scale(.98,1.03)}}",
    "@keyframes dp-play-hop{0%,100%{transform:translate(0,0) rotate(0) scale(1)}",
    "18%{transform:translate(-3px,-5px) rotate(-7deg) scale(1.02)}",
    "38%{transform:translate(0,0) rotate(3deg) scale(1.08,.92)}",
    "60%{transform:translate(4px,-9px) rotate(8deg) scale(.97,1.06)}",
    "80%{transform:translate(0,0) rotate(-2deg) scale(1.05,.96)}}",
    // G 批次：猪自己找事做（life.js 设 data-idle），桌面散步时朝走的方向。
    '.dp-pig[data-idle="roll"]:not([data-react]){animation:dp-spin 1.4s ease-in-out}',
    '.dp-pig[data-idle="nap"]:not([data-react]){animation:dp-breathe 2s ease-in-out 2}',
    '.dp-pig[data-idle="butterfly"]:not([data-react]){animation:dp-jump .9s ease-out 3}',
    '.dp-pig[data-idle="scratch"]:not([data-react]){animation:dp-shake .5s ease-in-out 4}',
    '.dp-pig[data-idle="stretch"]:not([data-react]){animation:dp-idle-stretch 1.8s ease-in-out}',
    '.dp-pig[data-idle="look"]:not([data-react]){animation:dp-idle-look 2.6s ease-in-out}',
    '.dp-pig[data-idle="bubbles"]:not([data-react]){animation:dp-breathe .8s ease-in-out 3}',
    '.dp-pig[data-idle="walk"]:not([data-react]){animation:dp-walking .6s ease-in-out infinite}',
    '.dp-pig[data-walk="right"] .dp-pig-img{transform:scaleX(-1)}',
    "@keyframes dp-idle-nod{0%,100%{transform:rotate(0)}40%,60%{transform:translateY(3px) rotate(6deg)}}",
    "@keyframes dp-idle-stretch{0%,100%{transform:scale(1)}45%{transform:scaleX(1.16) scaleY(.88)}}",
    "@keyframes dp-idle-look{0%,100%{transform:rotate(0)}30%,70%{transform:rotate(-8deg) translateX(-3px)}}",
    "@media (prefers-reduced-motion:reduce){.dp-pig[data-idle],.dp-pig[data-react]{animation:none!important}",
    '.dp-pig[data-idle="nap"] .dp-nap-zzz{animation:none!important;opacity:1!important;transform:none!important}}',
    "@keyframes dp-wobble{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}55%{transform:rotate(14deg)}}",
    "@keyframes dp-cough{0%,100%{transform:translateX(0)}30%{transform:translateX(-4px) rotate(-7deg)}70%{transform:translateX(4px) rotate(6deg)}}",
    '.dp-pig[data-mood="happy"]{animation-duration:1.15s}',
    '.dp-pig[data-mood="sleepy"]{animation-name:dp-breathe;animation-duration:3.6s}',
    '.dp-pig[data-mood="hungry"]{animation-name:dp-shake;animation-duration:2.4s}',
    '.dp-pig[data-mood="dirty"]{animation-name:dp-breathe;animation-duration:2.6s}',
    '.dp-pig[data-mood="dirty"] .dp-pig-img,.dp-pig[data-mood="dirty"] .dp-pig-emoji{filter:sepia(.4) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
    // Dirty and sick pigs keep their color cue and gain small orbiting markers.
    '.dp-pig[data-mood="dirty"]::before,.dp-pig[data-mood="dirty"]::after,',
    '.dp-pig[data-mood="sick"]::before,.dp-pig[data-mood="sick"]::after{content:"\u{1FAB0}";position:absolute;z-index:4;',
    "font-size:calc(var(--pig-size) * .16);line-height:1;pointer-events:none;",
    "top:6%;left:22%;animation:dp-fly 2.4s ease-in-out infinite}",
    '.dp-pig[data-mood="sick"]::before,.dp-pig[data-mood="sick"]::after{content:"\u{1F9A0}";animation-duration:3.2s}',
    '.dp-pig[data-mood="dirty"]::after,.dp-pig[data-mood="sick"]::after{top:20%;left:62%;animation-duration:3.1s;animation-direction:reverse;animation-delay:-.9s}',
    "@keyframes dp-fly{0%,100%{transform:translate(0,0) rotate(-10deg)}25%{transform:translate(14px,-6px) rotate(15deg)}",
    "50%{transform:translate(22px,4px) rotate(-5deg)}75%{transform:translate(6px,8px) rotate(20deg)}}",
    "@media (prefers-reduced-motion:reduce){.dp-pig[data-mood]::before,.dp-pig[data-mood]::after{animation:none}}",
    '.dp-pig[data-mood="sick"]{animation-name:dp-cough;animation-duration:2.2s}',
    '.dp-pig[data-mood="sick"] .dp-pig-img,.dp-pig[data-mood="sick"] .dp-pig-emoji{filter:hue-rotate(-28deg) saturate(.75) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
    // One pose per activity, so being away reads as a thing the pig is doing.
    "@keyframes dp-typing{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-2px) rotate(-1.5deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-2px) rotate(1.5deg)}}",
    "@keyframes dp-reading{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(1px) rotate(-5deg)}70%{transform:translateY(1px) rotate(-2deg)}}",
    "@keyframes dp-walking{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-6px) rotate(-4deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-6px) rotate(4deg)}}",
    '.dp-pig[data-mood="working"]{animation-name:dp-typing;animation-duration:.7s}',
    '.dp-pig[data-mood="studying"]{animation-name:dp-reading;animation-duration:2.4s}',
    '.dp-pig[data-mood="traveling"]{animation-name:dp-walking;animation-duration:1s}',
    '.dp-pig[data-mood="dead"]{animation:none}',
    '.dp-pig[data-mood="dead"] .dp-pig-img,.dp-pig[data-mood="dead"] .dp-pig-emoji{filter:grayscale(1) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
    ".dp-pig[data-react]{animation-duration:.85s;animation-iteration-count:1}",
    '.dp-pig[data-react="feed"]{animation-name:dp-feed-hop}',
    '.dp-pig[data-react="bathe"]{animation-name:dp-wobble;animation-duration:1.05s}',
    '.dp-pig[data-react="play"]{animation-name:dp-play-hop;animation-duration:.9s}',
    '.dp-pig[data-react="away"]{animation-name:dp-jump;animation-duration:.9s}',
    '.dp-pig[data-react="cure"]{animation-name:dp-spin;animation-duration:.9s}',
    '.dp-pig[data-react="levelup"]{animation-name:dp-jump;animation-duration:.95s}',
    '.dp-pig[data-react="refuse"]{animation-name:dp-shake;animation-duration:.5s}',
    /* ---------- what the pig is off doing ---------- */
    "[data-dsh-pig] .dp-work{display:flex;flex-direction:column;align-items:center;gap:4px;",
    "margin:0 2px 6px 0}",
    ".dp-prop{font-size:26px;line-height:1;filter:drop-shadow(0 3px 5px rgba(61,52,40,.22));",
    "animation:dp-prop-bob 2.4s ease-in-out infinite}",
    '[data-dsh-pig][data-away="study"] .dp-prop{animation-duration:3.4s}',
    '[data-dsh-pig][data-away="trip"] .dp-prop{animation-name:dp-prop-swing;animation-duration:1.6s}',
    '[data-dsh-pig][data-away="interest"] .dp-prop{animation-duration:3.4s}',
    "@keyframes dp-prop-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}",
    "@keyframes dp-prop-swing{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-4px) rotate(8deg)}}",
    ".dp-progress{width:42px;height:7px;border-radius:var(--ac-pill);background:var(--ac-bg-disabled);",
    "box-shadow:var(--ac-inset);overflow:hidden}",
    ".dp-progress i{display:block;height:100%;border-radius:var(--ac-pill);",
    "background:var(--ac-primary);transition:width .5s var(--ac-ease)}",
    // The scene needs room for the prop; it grows leftward, so the pig stays put.
    '[data-dsh-pig][data-away="work"] .dp-scene,[data-dsh-pig][data-away="study"] .dp-scene,',
    '[data-dsh-pig][data-away="interest"] .dp-scene,',
    '[data-dsh-pig][data-away="trip"] .dp-scene{width:max-content;min-width:132px}',
    // 加冕后的形态有动作立绘（桌子、书、行李都画在图里）：不再摆 emoji 道具，
    // 动作也收小，免得把画里的东西甩来甩去（立绘与动作来自 PR #2）。
    '[data-dsh-pig][data-art-actions="true"] .dp-prop{display:none}',
    '.dp-pig[data-art-actions="true"][data-mood="working"]:not([data-react]){animation:dp-king-work 1.4s ease-in-out infinite}',
    '.dp-pig[data-art-actions="true"][data-mood="studying"]:not([data-react]){animation:dp-king-study 2.4s ease-in-out infinite}',
    '.dp-pig[data-art-actions="true"][data-mood="traveling"]:not([data-react]){animation:dp-king-walk .8s ease-in-out infinite}',
    "@keyframes dp-king-work{0%,100%{transform:translateY(0)}50%{transform:translateY(1px) rotate(1deg)}}",
    "@keyframes dp-king-study{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}",
    "@keyframes dp-king-walk{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}",
    /* ---------- hud: a cream tag beside the pig ---------- */
    ".dp-hud{position:absolute;left:9px;top:7px;display:flex;flex-direction:column;gap:1px;",
    "font-size:10.5px;font-weight:600;line-height:1.45;color:var(--ac-text);",
    "background:var(--ac-bg);border:2px solid var(--ac-border-light);padding:5px 10px;",
    "border-radius:var(--ac-radius-sm);box-shadow:var(--ac-shadow-sm)}",
    ".dp-hud b{font-weight:700}",
    // A drawn sprite is sized by the same variable as the emoji, so growing up
    // works identically either way.
    ".dp-pig-img{width:var(--pig-size);height:var(--pig-size);display:block;",
    "scale:var(--art-zoom,1);translate:var(--art-x,0%) var(--art-y,0%);",
    "-webkit-user-drag:none;user-select:none}",
    // 反馈立绘在打包前离线处理为透明 PNG。
    // 校准可见高度；桌面命中区域另按 PNG 的静态透明边界计算。
    '.dp-pig[data-feedback="true"] .dp-pig-img{filter:none;object-fit:contain}',
    '.dp-pig[data-walk="right"] .dp-pig-img{translate:calc(-1 * var(--art-x,0%)) var(--art-y,0%)}',
    '.dp-pig[data-feedback="true"] .dp-dress{display:none}',
    ".dp-pig-emoji{font-size:var(--pig-size);line-height:1}",
    // No drawings yet — every stage is the same pig, so age reads as size plus
    // a faded coat on the last one.
    '[data-dsh-pig][data-faded="true"] .dp-pig-emoji{filter:grayscale(.5) opacity(.72)}',
    // The box advertises itself: a slow breathing glow plus a label, so it
    // does not read as scenery.
    '[data-dsh-pig][data-unhatched="true"] .dp-pig{cursor:pointer;',
    "animation:dp-box-breathe 2.4s ease-in-out infinite}",
    '[data-dsh-pig][data-unhatched="true"] .dp-pig-emoji{',
    "filter:drop-shadow(0 0 0 rgba(255,214,102,0)) drop-shadow(0 4px 6px rgba(61,52,40,.28))}",
    "@keyframes dp-box-breathe{0%,100%{transform:translateY(0) scale(1)}",
    "50%{transform:translateY(-3px) scale(1.06)}}",
    ".dp-poke-hint{position:absolute;right:2px;bottom:-2px;display:flex;align-items:center;gap:3px;",
    "font-size:9.5px;font-weight:700;color:var(--ac-text);background:var(--ac-bg);",
    "border:1.5px solid var(--ac-border-light);border-radius:var(--ac-pill);padding:1px 7px;",
    "box-shadow:0 2px 0 rgba(61,52,40,.12);pointer-events:none;white-space:nowrap;z-index:3;",
    "animation:dp-hint-bob 1.6s ease-in-out infinite}",
    "@keyframes dp-hint-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}",
    // Each poke shakes it harder; the third one opens it instead.
    '[data-dsh-pig] .dp-pig[data-mood="poke"],',
    "[data-dsh-pig][data-poke] .dp-pig{animation-name:dp-poke-shake}",
    '[data-dsh-pig][data-poke="2"] .dp-pig{animation-duration:.28s}',
    "@keyframes dp-poke-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}",
    "50%{transform:rotate(6deg)}75%{transform:rotate(-4deg)}}"
    // The shop's tiles live in css-tiles.js since B8.
  ].join("");

  // src/client/css-tabs.js
  var CSS_TABS = [
    /* ---------- developer tab ---------- */
    ".dp-dev-note{font-size:10px;color:var(--ac-text-2);margin:4px 0 2px;line-height:1.5}",
    ".dp-dev-row{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 2px}",
    ".dp-dev-btn{flex:0 0 auto;font-size:10px;padding:3px 8px}",
    ".dp-on{background:var(--ac-primary);color:#fff;border-color:var(--ac-primary)}",
    '[data-dsh-pig][data-dev="true"] .dp-ico[data-tab="dev"]{color:var(--ac-primary)}',
    /* ---------- the soul that settles on an unclaimed grave ---------- */
    ".dp-soul{position:absolute;left:50%;transform:translateX(-50%);top:-4px;font-size:22px;",
    "line-height:1;opacity:.9;pointer-events:none;z-index:1;",
    "animation:dp-haunt 3.4s ease-in-out infinite}",
    "@keyframes dp-haunt{0%,100%{transform:translate(-50%,0) scale(1);opacity:.75}",
    "50%{transform:translate(-50%,-9px) scale(1.08);opacity:1}}",
    // A grave does not bob about like a living pig.
    '.dp-pig[data-stage="grave"]{animation:none;filter:grayscale(.35) drop-shadow(0 4px 6px rgba(61,52,40,.3))}',
    '.dp-pig[data-stage="grave"][data-feedback="true"]{filter:none}',
    '.dp-pig[data-stage="box"]{animation:dp-box-wobble 3.2s ease-in-out infinite}',
    "@keyframes dp-box-wobble{0%,100%{transform:rotate(0)}30%{transform:rotate(-4deg)}",
    "45%{transform:rotate(3deg)}60%{transform:rotate(-2deg)}}",
    // 摸头时先压扁再轻轻回弹；保留短时长，连续点击也能每次从头播放。
    '[data-dsh-pig] .dp-pig[data-react="pet"]{animation-name:dp-squash;animation-duration:.42s}',
    "@keyframes dp-squash{0%,100%{transform:translateY(0) scale(1)}",
    "16%{transform:translateY(1px) scale(1.04,.95)}38%{transform:translateY(3px) scale(1.14,.82)}",
    "67%{transform:translateY(-4px) scale(.95,1.09)}84%{transform:translateY(0) scale(1.04,.97)}}",
    /* ---------- speech bubble ---------- */
    // `z-index` matters: the pig comes later in the DOM, so without it the pig
    // paints over the bubble whenever the two boxes overlap — which is exactly
    // what happened when collapsed and the scene was only as wide as the pig.
    // 气泡钉在猪头上：右边和猪的右边对齐（场景左右各 6px 内边距，猪贴着它），底边在猪头上方 10px，
    // 尾巴指着猪头正中。收起/打开、面板朝左/朝右都是这一个位置（用户 2026-10-04：「不要飘来飘去」）。
    ".dp-bubble{position:absolute;right:6px;left:auto;top:auto;bottom:calc(var(--pig-gap-below) + var(--pig-size) + 10px);",
    "z-index:2;width:max-content;max-width:calc(var(--panel-width) - 24px);box-sizing:border-box;padding:6px 10px;",
    "border-radius:var(--ac-radius-sm);font-size:10.5px;font-weight:600;line-height:1.45;",
    "color:var(--ac-text-body);background:var(--ac-bg-input);",
    "border:2px solid var(--ac-border-light);box-shadow:var(--ac-shadow-sm)}",
    ".dp-bubble-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;",
    "overflow:hidden;white-space:normal;overflow-wrap:anywhere}",
    // Tail drawn as a small rotated square so the 2px border stays continuous.
    '.dp-bubble::after{content:"";position:absolute;left:auto;right:calc(var(--pig-size) / 2 - 5px);top:100%;bottom:auto;',
    "margin-top:-4px;width:8px;height:8px;",
    "background:var(--ac-bg-input);border-right:2px solid var(--ac-border-light);",
    "border-bottom:2px solid var(--ac-border-light);transform:rotate(45deg)}",
    '[data-dsh-pig][data-panel-side="right"] .dp-bubble{right:auto;left:6px}',
    '[data-dsh-pig][data-panel-side="right"] .dp-bubble::after{right:auto;left:calc(var(--pig-size) / 2 - 5px)}',
    // Reply buttons under a line: small pills, the mint of the primary colour
    // without the 3D base, which the spec keeps for real primary buttons.
    ".dp-bubble-replies{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}",
    // 猪头上的日常气泡（签到 / 礼包）：不用新颜色，沿用主色与卡片底色。
    // 挂在场景**上方**（不是 top 边缘）：折叠时场景就是猪本身，用 top:-6px
    // 会让气泡叠在猪头上（用户反馈 #6）。
    ".dp-daily{position:absolute;bottom:calc(100% + 7px);left:50%;width:36px;margin-left:-18px;",
    "font:inherit;font-size:15px;line-height:1;padding:3px 0;cursor:pointer;text-align:center;",
    "border:2px solid var(--ac-border);border-radius:50px;background:var(--ac-bg-input);",
    "box-shadow:0 3px 0 rgba(61,52,40,.14);animation:dp-daily-bob 2.4s var(--ac-ease) infinite}",
    // 折叠时场景就剩猪本身（而且它还在上下浮动 ±7px），再多让开一点。
    '[data-dsh-pig][data-open="false"] .dp-daily{bottom:calc(100% + 16px)}',
    // 展开时场景有面板那么宽、那么高，挂在场景上方会压到图标栏（B8 截图里压在「商店」上）：
    // 改成蹲在猪左边、贴着猪身子（再高会碰到左边的名字框）。
    '[data-dsh-pig][data-open="true"] .dp-daily{left:auto;margin-left:0;',
    "right:calc(6px + var(--pig-size) + 10px);bottom:calc(var(--pig-gap-below) + var(--pig-size) / 2 - 18px)}",
    // 桌面版面板朝右开时猪在左端：日历跟着镜像到猪右边。
    '[data-dsh-pig][data-panel-side="right"][data-open="true"] .dp-daily{right:auto;left:calc(6px + var(--pig-size) + 10px)}',
    ".dp-daily:hover{border-color:var(--ac-border-hover)}",
    ".dp-daily:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}",
    // 名字必须独占：叫 dp-bob 会覆盖猪的待机动画（css-base.js），
    // 而那个动画的 transform 一被替掉，猪就会横跳半个身位。
    // 只上下浮：横向居中改用 margin，展开时才能挪到猪旁边。
    "@keyframes dp-daily-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}",
    // 收起时礼包按钮也在猪头上方：猪说话时先藏起来，和番茄钟角标一样，不跟气泡抢位置。
    '[data-dsh-pig][data-open="false"]:has(.dp-bubble:not([hidden])) .dp-daily{visibility:hidden}',
    // 日记：折叠时只有首句，展开是全文。
    ".dp-diary{cursor:pointer}",
    '.dp-diary[data-open="true"] .dp-diary-full{display:block}',
    ".dp-diary-full{margin-top:4px;line-height:1.5}",
    ".dp-reply{font:inherit;font-size:10px;font-weight:700;padding:2px 9px;cursor:pointer;",
    "border-radius:var(--ac-pill);border:2px solid var(--ac-border-light);background:var(--ac-bg);",
    "color:var(--ac-text);transition:border-color .15s var(--ac-ease)}",
    ".dp-reply:hover{border-color:var(--ac-border-hover)}",
    ".dp-reply:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}",
    /* ---------- icon bar: the library sidebar, laid on its side ---------- */
    ".dp-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px;",
    "background:var(--ac-bg-content);border-top:2px solid var(--ac-border-light);",
    "border-bottom:2px solid var(--ac-border-light)}",
    ".dp-ico{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;",
    "font:inherit;font-size:9.5px;font-weight:600;color:var(--ac-text-muted);background:none;",
    "border:2px solid transparent;border-radius:var(--ac-radius-sm);padding:5px 1px;",
    "transition:all .2s var(--ac-ease)}",
    ".dp-ico span.dp-ico-e{font-size:18px;line-height:1}",
    ".dp-ico:hover{background:var(--ac-hover)}",
    '.dp-ico[data-active="true"]{background:var(--ac-active);border-color:#9db0d6;',
    "color:var(--ac-text);font-weight:700}",
    ".dp-ico:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}",
    "@keyframes dp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}",
    '.dp-ico[data-alert="true"] span.dp-ico-e{animation:dp-pulse 1.4s ease-in-out infinite}',
    /* ---------- content ---------- */
    ".dp-content{padding:12px 13px 13px;overflow-y:auto;flex:1 1 auto;min-height:0}",
    "[data-dsh-pig] .dp-panel-footer[hidden]{display:none}",
    ".dp-panel-footer{flex:none;max-height:min(42vh,270px);overflow-y:auto;padding:10px 13px 12px;",
    "border-top:2px solid var(--ac-border-light);background:var(--ac-bg)}",
    ".dp-panel-footer .dp-job-detail{margin:0}",
    ".dp-content::-webkit-scrollbar{width:8px}",
    ".dp-content::-webkit-scrollbar-thumb{background:var(--ac-border-light);border-radius:4px}",
    ".dp-content::-webkit-scrollbar-track{background:transparent}",
    ".dp-title{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;",
    "margin-bottom:8px}",
    ".dp-title b{font-weight:700;color:var(--ac-text)}",
    ".dp-title span{color:var(--ac-text-2);font-size:10.5px;font-weight:600}",
    ".dp-row{display:flex;justify-content:space-between;font-size:11px;font-weight:600;",
    "color:var(--ac-text-body);margin:2px 0}",
    ".dp-row b{font-weight:700;color:var(--ac-text)}",
    /* ---------- attribute bars: pill track with an inset well ---------- */
    ".dp-meter{height:9px;border-radius:var(--ac-pill);background:var(--ac-bg-disabled);",
    "box-shadow:var(--ac-inset);overflow:hidden;margin:3px 0 8px}",
    ".dp-meter i{display:block;height:100%;border-radius:var(--ac-pill);",
    "background:var(--ac-warning);transition:width .35s var(--ac-ease)}",
    ".dp-meter.dp-mood i{background:#f8a6b2}",
    ".dp-meter.dp-clean i{background:#82d5bb}",
    ".dp-meter.dp-health i{background:#8ac68a}",
    ".dp-traits{display:flex;gap:10px;font-size:10.5px;font-weight:600;color:var(--ac-text-2);",
    "margin:8px 0 3px}",
    /* ---------- banners ---------- */
    ".dp-alert{margin:0 0 9px;padding:8px 10px;border-radius:var(--ac-radius-sm);",
    "font-size:10.5px;font-weight:600;line-height:1.55;border:2px solid}",
    ".dp-alert b{font-weight:700;color:var(--ac-text)}",
    ".dp-alert.dp-sick{background:#fdeeee;border-color:#f2c2c2}",
    ".dp-alert.dp-work{background:#eef1fb;border-color:#c3cdf0}",
    ".dp-alert.dp-dead{background:var(--ac-bg-disabled);border-color:var(--ac-border-light)}",
    ".dp-alert.dp-legacy{background:#fdf7e2;border-color:#f0dfa8}",
    /* ---------- buttons: secondary is a cream pill with soft elevation ---- */
    ".dp-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}",
    ".dp-btn{display:flex;align-items:center;justify-content:center;gap:5px;font:inherit;",
    "font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--ac-text-body);",
    "cursor:pointer;padding:8px 6px;border-radius:var(--ac-pill);",
    "border:2px solid var(--ac-border);background:var(--ac-bg-input);",
    "box-shadow:var(--ac-shadow-sm);transition:all .2s var(--ac-ease)}",
    ".dp-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--ac-shadow);",
    "border-color:var(--ac-border-hover)}",
    ".dp-btn:active:not(:disabled){transform:translateY(2px);box-shadow:var(--ac-shadow-sm)}",
    ".dp-btn:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}",
    ".dp-btn:disabled{background:var(--ac-bg-disabled);color:var(--ac-text-disabled);",
    "border-color:var(--ac-border-light);box-shadow:none;cursor:not-allowed}",
    ".dp-btn-wide{grid-column:1/-1}",
    ".dp-btn .dp-wait{color:var(--ac-text-2);font-size:10px;font-weight:600}",
    /* ---------- settings inputs ---------- */
    ".dp-size-control{display:flex;align-items:center;width:max-content;gap:8px;margin:4px 0 8px}",
    ".dp-size-step{width:34px;height:34px;border:1px solid var(--ac-border-light);border-radius:10px;",
    "background:var(--ac-bg-input);color:var(--ac-text-body);font:inherit;font-size:20px;cursor:pointer}",
    ".dp-size-step:hover{border-color:var(--ac-primary);color:var(--ac-primary)}",
    ".dp-size-percent{display:flex;align-items:center;gap:3px;color:var(--ac-text-muted)}",
    ".dp-size-value{width:64px;text-align:center;appearance:textfield;border:0;border-bottom:1px solid var(--ac-border-light);",
    "background:transparent;color:var(--ac-text-body);font:inherit;font-size:15px;padding:5px 0}",
    ".dp-size-value::-webkit-inner-spin-button,.dp-size-value::-webkit-outer-spin-button{appearance:none;margin:0}",
    ".dp-size-value:focus{outline:none;border-color:var(--ac-primary)}",
    ".dp-proxy-form{display:grid;gap:10px;margin:4px 0 12px}",
    ".dp-setting-field{width:100%;box-sizing:border-box;font:inherit;font-size:11px;color:var(--ac-text-body);",
    "background:var(--ac-bg-input);border:1px solid var(--ac-border-light);border-radius:9px;padding:8px 10px}",
    ".dp-setting-field:focus{outline:2px solid var(--ac-primary);outline-offset:1px}",
    ".dp-proxy-endpoint{display:grid;gap:5px;font-size:10px}",
    ".dp-proxy-endpoint[hidden]{display:none}",
    ".dp-proxy-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".dp-proxy-actions .dp-mini{border-radius:8px;box-shadow:none;padding:6px 10px;font-size:10px}",
    ".dp-proxy-actions .dp-proxy-save{background:var(--ac-primary);border-color:var(--ac-primary);color:#fff}",
    ".dp-proxy-actions .dp-proxy-clear{margin-left:auto;border-color:transparent;background:transparent;color:var(--ac-text-muted)}",
    ".dp-proxy-status{font-size:10px;line-height:1.5;margin-top:9px;color:var(--ac-text-muted);overflow-wrap:anywhere}",
    ".dp-proxy-actions .dp-proxy-test{background:transparent;border-color:var(--ac-border-light);color:var(--ac-text-body)}",
    ".dp-proxy-error{color:var(--ac-error)}",
    /* ---------- segmented control ---------- */
    ".dp-seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:9px}",
    ".dp-seg button{font:inherit;font-size:10.5px;font-weight:600;color:var(--ac-text-muted);",
    "cursor:pointer;padding:6px 2px;border-radius:var(--ac-pill);",
    "border:2px solid var(--ac-border-light);background:var(--ac-bg-input);",
    // One line, always: a label that wraps makes its button taller than the rest.
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
    "transition:all .2s var(--ac-ease)}",
    // The work tab has three skills, not four stages.
    ".dp-seg.dp-seg-3{grid-template-columns:repeat(3,minmax(0,1fr))}",
    // Work rows: two small buttons on the right, 详情 opens the checklist below.
    ".dp-job-locked{opacity:.75}",
    ".dp-job-detail{margin-top:-2px}",
    ".dp-req{font-size:10.5px;font-weight:600;color:var(--ac-error);line-height:1.6}",
    ".dp-req.dp-req-ok{color:var(--ac-success)}",
    /* ---------- list rows ---------- */
    // minmax(0,1fr): a long nowrap line must ellipsize, not widen the panel.
    ".dp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}",
    ".dp-list{display:flex;flex-direction:column;gap:7px}",
    ".dp-shelf{margin:9px 0 1px;font-size:10px;font-weight:700;color:var(--ac-text-2);",
    "letter-spacing:.04em}",
    ".dp-shelf:first-child{margin-top:0}",
    ".dp-item{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;",
    "color:var(--ac-text-body);padding:7px 9px;border-radius:var(--ac-radius-sm);",
    "background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}",
    ".dp-item .dp-grow{flex:1;min-width:0}",
    ".dp-item .dp-dim{color:var(--ac-text-2);font-size:10px;font-weight:500;overflow:hidden;",
    "text-overflow:ellipsis;white-space:nowrap}",
    ".dp-item.dp-wanted{background:#fdf7e2;border-color:var(--ac-warning)}",
    // B6 talk row: name + 改 + 免打扰, and the inline name input.
    ".dp-talk{gap:6px;margin-top:8px}",
    ".dp-talk>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".dp-mini.dp-mini-plain{background:var(--ac-bg-input);color:var(--ac-text);border:2px solid var(--ac-border-light);box-shadow:none}",
    ".dp-mini.dp-mini-plain:hover:not(:disabled){background:var(--ac-hover)}",
    ".dp-input{flex:1;min-width:0;font:inherit;font-size:11px;padding:3px 8px;border-radius:var(--ac-pill);",
    "border:2px solid var(--ac-border);background:var(--ac-bg-input);color:var(--ac-text)}",
    ".dp-input:focus{outline:2px solid var(--ac-primary);outline-offset:1px}",
    /* ---------- primary buttons: teal pill with the game 3D bottom edge --- */
    ".dp-mini{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.02em;color:#fff;",
    "cursor:pointer;padding:6px 13px;border-radius:var(--ac-pill);",
    "border:2px solid var(--ac-primary-active);background:var(--ac-primary);",
    "box-shadow:0 3px 0 0 var(--ac-primary-active);transition:all .15s var(--ac-ease)}",
    ".dp-mini:hover:not(:disabled){background:var(--ac-primary-hover);transform:translateY(-1px);",
    "box-shadow:0 4px 0 0 var(--ac-primary-active)}",
    ".dp-mini:active:not(:disabled){transform:translateY(2px);",
    "box-shadow:0 1px 0 0 var(--ac-primary-active)}",
    ".dp-mini:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px}",
    ".dp-mini:disabled{background:var(--ac-bg-disabled);color:var(--ac-text-disabled);",
    "border-color:var(--ac-border-light);box-shadow:none;cursor:not-allowed}",
    /* ---------- the care item picker ---------- */
    ".dp-pick{margin-top:9px;padding:9px 10px;border-radius:var(--ac-radius-sm);font-size:10.5px;",
    "background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}",
    ".dp-pick-head{font-size:10.5px;font-weight:700;color:var(--ac-text);margin-bottom:7px}",
    ".dp-cancel{display:block;width:100%;margin-top:8px;font:inherit;font-size:10.5px;",
    "font-weight:600;color:var(--ac-text-2);cursor:pointer;padding:5px;",
    "border-radius:var(--ac-pill);border:2px solid var(--ac-border-light);",
    "background:var(--ac-bg-input);transition:all .2s var(--ac-ease)}",
    ".dp-cancel:hover{background:var(--ac-hover);color:var(--ac-text)}",
    ".dp-count{margin-left:2px;font-size:9px;font-weight:700;color:var(--ac-text-2);",
    "background:var(--ac-bg-content);border-radius:var(--ac-pill);padding:0 5px}",
    '.dp-btn[data-open-picker="true"]{background:var(--ac-active);border-color:#9db0d6}',
    '.dp-seg button[data-locked="true"]{color:var(--ac-text-disabled);',
    "border-style:dashed;background:var(--ac-bg-disabled)}",
    '.dp-seg button[data-locked="true"]:hover{background:var(--ac-bg-disabled)}',
    ".dp-locked{margin:0 0 8px;font-size:10.5px;font-weight:600;line-height:1.5;",
    "color:var(--ac-text-body);background:#fdf7e2;border:2px solid #f0dfa8;",
    "border-radius:var(--ac-radius-sm);padding:6px 9px}",
    // The per-job gate reads as a lock, not as another grey stat line: a
    // threshold the pig cannot see is indistinguishable from a broken button.
    ".dp-lock{font-size:10px;font-weight:700;line-height:1.5;color:#9a6b1f}",
    ".dp-empty{color:var(--ac-text-2);font-size:10.5px;font-weight:500;line-height:1.65;",
    "margin-top:4px}",
    ".dp-memo{margin-top:9px;padding-top:8px;border-top:2px solid var(--ac-border-light);",
    "color:var(--ac-text-muted);font-size:10px;font-weight:500;line-height:1.55;",
    "white-space:pre-wrap;word-break:break-word}",
    /* ---------- particles and toast ---------- */
    ".dp-transform{position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden}",
    ".dp-transform-fall{position:absolute;top:-48px;font-size:28px;opacity:0;",
    "animation:dp-transform-fall 1.35s var(--delay) ease-in forwards}",
    "@keyframes dp-transform-fall{0%{opacity:0;transform:translate3d(0,-20px,0) rotate(-15deg)}",
    "12%{opacity:1}100%{opacity:0;transform:translate3d(var(--drift),105vh,0) rotate(30deg)}}",
    ".dp-transform-pop{position:absolute;font-size:72px;line-height:1;filter:drop-shadow(0 3px 8px #fff);",
    "animation:dp-transform-pop 1.3s ease-out forwards}",
    "@keyframes dp-transform-pop{0%{opacity:0;transform:translate(-50%,-50%) scale(.15)}",
    "35%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}",
    "70%{opacity:1;transform:translate(-50%,-50%) scale(1)}",
    "100%{opacity:0;transform:translate(-50%,-50%) scale(1.1)}}",
    ".dp-fx{position:absolute;z-index:1;pointer-events:none;font-size:17px;",
    "animation:dp-rise 1.1s ease-out forwards}",
    "@keyframes dp-rise{0%{opacity:0;transform:translate(var(--dx0,0),4px) scale(.5)}18%{opacity:1}",
    "100%{opacity:0;transform:translate(var(--dx,0),-56px) scale(1.15)}}",
    // 提示条插在面板最上面、把内容往下推，不再浮在面板上压住标题和第一排图标（用户 2026-10-05 反馈）。
    ".dp-toast{position:relative;flex:none;margin:8px 9px 0;padding:8px 11px;box-sizing:border-box;overflow:hidden;",
    "border-radius:var(--ac-radius-sm);font-size:10.5px;font-weight:600;line-height:1.5;",
    "color:var(--ac-text);background:var(--ac-bg-input);border:2px solid var(--ac-border);",
    "box-shadow:var(--ac-shadow);pointer-events:none;white-space:normal;",
    "animation:dp-toast 4.6s var(--ac-ease) forwards}",
    "@keyframes dp-toast{0%{opacity:0;max-height:0;margin-top:0;padding-top:0;padding-bottom:0}",
    "7%{opacity:1;max-height:72px;margin-top:8px;padding-top:8px;padding-bottom:8px}",
    "86%{opacity:1;max-height:72px;margin-top:8px;padding-top:8px;padding-bottom:8px}",
    "100%{opacity:0;max-height:0;margin-top:0;padding-top:0;padding-bottom:0;border-width:0}}"
  ].join("");

  // src/client/css-tiles.js
  var CSS_TILES = [
    // 番茄钟角标（C2 返工）：贴在猪立绘右上角，跟着猪一起动。
    // 高度 = 13 + 2 = 15px，再往上 2px，所以顶多高出猪头 17px（要求 20px 以内）；
    // z-index:4 高于装扮层（3）：戴帽子时帽子会压住角标（用户反馈「有东西挡住了」）。
    // 角标挂在猪立绘里（猪有 transform 动画，自成一层），这个层级只跟装扮比，不会盖到面板上；
    // 猪说话时角标先藏起来，不跟气泡抢位置。
    ".dp-pomo{position:absolute;bottom:calc(100% + 2px);right:-4px;z-index:4;",
    "font-size:9.5px;font-weight:800;color:#fff;background:var(--tile-red);",
    "border-radius:var(--ac-pill);padding:1px 5px;line-height:13px;white-space:nowrap;pointer-events:none;",
    "box-shadow:0 2px 0 rgba(61,52,40,.16)}",
    ".dp-pomo-live{display:flex;flex-direction:column;align-items:center;gap:3px;margin:6px 0 10px}",
    ".dp-pomo-clock{font-size:26px;font-weight:800;color:var(--ac-text);letter-spacing:1px}",
    // 主屏底部的版本号：一行灰字，不占格子（连点 7 次解锁调试模式，见 C1）。
    ".dp-version{margin-top:8px;text-align:center;font-size:9.5px;font-weight:600;",
    "color:var(--ac-text-muted);cursor:default;user-select:none}",
    "[data-dsh-pig]{--tile-pink:#f8a6b2;--tile-purple:#b77dee;--tile-blue:#889df0;",
    "--tile-yellow:#f7cd67;--tile-orange:#e59266;--tile-teal:#82d5bb;--tile-green:#8ac68a;",
    "--tile-red:#fc736d;--tile-lime:#d1da49;--tile-peach:#e18c6f;--tile-brown:#9a835a}",
    '.dp-tile[data-color="pink"]{--tile-c:var(--tile-pink)}',
    '.dp-tile[data-color="purple"]{--tile-c:var(--tile-purple)}',
    '.dp-tile[data-color="blue"]{--tile-c:var(--tile-blue)}',
    '.dp-tile[data-color="yellow"]{--tile-c:var(--tile-yellow)}',
    '.dp-tile[data-color="orange"]{--tile-c:var(--tile-orange)}',
    '.dp-tile[data-color="teal"]{--tile-c:var(--tile-teal)}',
    '.dp-tile[data-color="green"]{--tile-c:var(--tile-green)}',
    '.dp-tile[data-color="red"]{--tile-c:var(--tile-red)}',
    '.dp-tile[data-color="lime"]{--tile-c:var(--tile-lime)}',
    '.dp-tile[data-color="peach"]{--tile-c:var(--tile-peach)}',
    '.dp-tile[data-color="brown"]{--tile-c:var(--tile-brown)}',
    // The grid: three columns that can never be widened by their content.
    ".dp-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px;padding:4px 2px 2px}",
    ".dp-home-clip{overflow:hidden;touch-action:pan-y}.dp-home-track{display:flex;transition:transform .25s ease;will-change:transform}",
    '.dp-home-page{box-sizing:border-box;flex:0 0 100%;grid-template-rows:repeat(3,72px);align-content:start}.dp-home-page[data-active="false"]{pointer-events:none}',
    '.dp-home-dots{display:flex;justify-content:center;gap:8px;margin:9px 0 2px}.dp-home-dot{width:9px;height:9px;padding:0;border:1.5px solid var(--ac-primary);border-radius:50%;background:transparent;cursor:pointer}.dp-home-dot[aria-pressed="true"]{background:var(--ac-primary)}',
    "@media (prefers-reduced-motion:reduce){.dp-home-track{transition:none}}",
    // A tile is a column: the coloured square, then its name, then a note.
    ".dp-tile{font:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;",
    "padding:0;margin:0;border:0;background:none;cursor:pointer;color:var(--ac-text)}",
    ".dp-tile-icon{position:relative;display:flex;align-items:center;justify-content:center;",
    "width:50px;height:50px;border-radius:15px;background:var(--tile-c,var(--ac-bg-content));",
    "box-shadow:0 3px 0 rgba(61,52,40,.16);transition:transform .15s var(--ac-ease),box-shadow .15s var(--ac-ease)}",
    ".dp-tile-e{font-size:24px;line-height:1;filter:drop-shadow(0 1px 1px rgba(61,52,40,.18))}",
    ".dp-tile-svg{width:27px;height:27px;object-fit:contain}",
    ".dp-app-title{display:inline-flex;align-items:center;gap:5px}",
    ".dp-app-title-icon{font-size:14px;line-height:1}",
    ".dp-app-title-icon.dp-tile-svg{width:17px;height:17px}",
    ".dp-setting-row{margin-top:8px}",
    // 状态页体重条：填充到现在的体重，三个刻度标理想 / 圆润 / 胖胖。
    ".dp-hint{margin:2px 0 8px;font-size:10px;line-height:1.5;color:var(--ac-text-2)}",
    // 调试页：顶上页签可横向滚动，左右箭头；每个按钮下面一行小字说明。
    ".dp-dev-nav{display:flex;align-items:center;gap:4px;margin:6px 0 8px}",
    ".dp-dev-tabs{position:relative;display:flex;gap:4px;overflow-x:auto;flex:1;scrollbar-width:none}.dp-dev-tabs::-webkit-scrollbar{display:none}",
    ".dp-dev-tab{flex:none;font:inherit;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:var(--ac-pill);cursor:pointer;",
    "border:2px solid var(--ac-border-light);background:var(--ac-bg-content);color:var(--ac-text-2)}",
    '.dp-dev-tab[aria-pressed="true"]{background:var(--ac-primary);border-color:var(--ac-primary-active);color:#fff}',
    // 一行一个：左边小按钮、右边一句说明（按钮别拉满宽）。
    ".dp-dev-list{display:flex;flex-direction:column;gap:5px;margin:4px 0 10px}",
    ".dp-dev-item{display:flex;align-items:center;gap:8px;min-width:0}",
    ".dp-dev-item .dp-dev-btn{flex:none;min-width:78px;justify-content:center;box-shadow:none}",
    ".dp-dev-desc{flex:1;min-width:0;font-size:9.5px;line-height:1.35;color:var(--ac-text-2)}",
    // 换肤「怎么做皮肤」页：两列图卡（缩略图 + 文件名 + 必须/可选 + 用途），规格和 skin.json 示例。
    ".dp-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 10px}",
    ".dp-guide-cell{display:grid;grid-template-columns:40px 1fr;grid-template-rows:auto auto auto;column-gap:6px;align-items:center;align-content:center;",
    "padding:6px;border-radius:var(--ac-radius-sm);border:2px solid var(--ac-border-light);background:var(--ac-bg-input)}",
    ".dp-guide-img{grid-row:1 / 4;width:40px;height:40px;object-fit:contain}.dp-guide-cell b{font-size:11px}",
    ".dp-guide-need{font-size:9.5px;font-weight:800;color:#c7781a}.dp-guide-optional .dp-guide-need{color:var(--ac-text-2)}",
    ".dp-guide-cell small{font-size:9.5px;line-height:1.35;color:var(--ac-text-2)}",
    ".dp-guide-rule{font-size:10.5px;line-height:1.6}",
    ".dp-switch-ask{display:grid;gap:6px;margin-bottom:10px}.dp-switch-ask-row{display:flex;gap:8px}",
    ".dp-guide-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 10px}",
    ".dp-guide-links .dp-btn{justify-content:center;font-size:12px}",
    ".dp-guide-code{margin:4px 0;padding:6px 8px;border-radius:8px;background:var(--ac-bg-content);font-size:10px;line-height:1.5;white-space:pre-wrap}",
    // 背包顶上的状态条：两列四格 + 一行体重。
    ".dp-statstrip{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:0 0 10px;padding:8px 10px;",
    "border-radius:var(--ac-radius-sm);background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}",
    ".dp-statcell .dp-row{margin:0 0 3px;font-size:10.5px}.dp-statcell .dp-meter{height:7px}",
    ".dp-statweight{grid-column:1 / -1;font-size:10.5px;color:var(--ac-text-2)}",
    // 设置页：每项一块，标题+说明，下面一排分段按钮；开关放在标题右边。
    ".dp-set{padding:10px 0;border-bottom:1.5px dashed var(--ac-border-light)}",
    // 扩展 App：每个扩展一块，图标 + 名称 + 开关，下面一句说明；进行中的提醒用暖色小字。
    ".dp-ext-intro{font-size:10.5px;line-height:1.5;color:var(--ac-text-2);margin:0 0 4px}",
    ".dp-ext-emoji{font-size:20px;line-height:1;margin-right:2px}",
    ".dp-ext-note{margin-top:6px;font-size:10px;font-weight:700;color:#c7781a}",
    ".dp-ext-later{margin-top:12px;text-align:center;font-size:10px;color:var(--ac-text-2)}",
    ".dp-ext-section{display:flex;align-items:center;justify-content:space-between;margin:12px 2px 6px;font-size:11px;font-weight:800;color:var(--ac-text-2);letter-spacing:.04em}",
    ".dp-ext-actions{display:flex;align-items:center;justify-content:flex-start;gap:8px;margin-top:8px;flex-wrap:wrap}",
    ".dp-ext-actions .dp-switch{margin:0}",
    ".dp-ext-warn{flex-basis:100%;order:-1;font-size:10px;font-weight:700;color:#c0503f}",
    ".dp-mini.dp-ext-danger{background:#e05a5a;box-shadow:none}",
    // 从文件导入：文件框藏在按钮下面，点按钮就是选文件。
    ".dp-ext-import-pick{position:relative;display:inline-flex;margin-top:8px;cursor:pointer;overflow:hidden}",
    ".dp-ext-import-pick input{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:0}",
    ".dp-ext-import .dp-ext-warn{order:0;margin-top:6px}",
    ".dp-mini.dp-ext-remove{padding:4px 12px}",
    ".dp-mini.dp-ext-remove:hover:not(:disabled){color:#c0503f;border-color:#e3a79c}",
    ".dp-ext-card [data-ext-install]{margin-left:auto;flex:none}",
    ".dp-set:first-child{padding-top:2px}.dp-set:last-child{border-bottom:0}",
    ".dp-set-head{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px}",
    ".dp-set-head b{font-size:12px;color:var(--ac-text)}",
    // 设置行里的按钮一律挂在最右边：标题和小字占左边，右边的操作顶到卡片边缘。
    ".dp-set-head>.dp-mini{margin-left:auto;flex:none}",
    ".dp-set-head small{flex-basis:100%;order:3;font-size:10px;line-height:1.45}",
    ".dp-seg{display:flex;gap:4px;margin-top:8px;padding:3px;border-radius:var(--ac-pill);background:var(--ac-bg-content);",
    "border:2px solid var(--ac-border-light)}",
    ".dp-seg-btn{flex:1;min-width:0;font:inherit;font-size:11px;font-weight:700;padding:5px 0;cursor:pointer;",
    "border:0;border-radius:var(--ac-pill);background:transparent;color:var(--ac-text-2);",
    "transition:background-color .15s var(--ac-ease),color .15s var(--ac-ease)}",
    ".dp-seg-btn:hover:not(:disabled){background:var(--ac-bg-input);color:var(--ac-text)}",
    '.dp-seg-btn[aria-pressed="true"]{background:var(--ac-primary);color:#fff;cursor:default;',
    "box-shadow:0 2px 0 var(--ac-primary-active)}",
    ".dp-seg-btn:focus-visible,.dp-switch:focus-visible{outline:2px solid var(--ac-yellow, #ffcf45);outline-offset:1px}",
    ".dp-switch{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:10.5px;font-weight:700;",
    "padding:2px 8px 2px 2px;cursor:pointer;border-radius:var(--ac-pill);border:2px solid var(--ac-border-light);",
    "background:var(--ac-bg-content);color:var(--ac-text-2);transition:background-color .15s var(--ac-ease)}",
    ".dp-switch-knob{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--ac-border-light);",
    "transition:transform .15s var(--ac-ease)}",
    '.dp-switch[aria-pressed="true"]{background:var(--ac-primary);border-color:var(--ac-primary-active);color:#fff;',
    "flex-direction:row-reverse;padding:2px 2px 2px 8px}",
    ".dp-setting-emoji{font-size:22px;line-height:1;width:28px;text-align:center}",
    ".dp-tile:hover:not(:disabled) .dp-tile-icon{transform:translateY(-2px);box-shadow:0 5px 0 rgba(61,52,40,.16)}",
    ".dp-tile:active:not(:disabled) .dp-tile-icon{transform:translateY(2px);box-shadow:0 1px 0 rgba(61,52,40,.16)}",
    ".dp-tile:focus-visible{outline:none}",
    ".dp-tile:focus-visible .dp-tile-icon{outline:2px solid var(--ac-primary);outline-offset:2px}",
    // One line each, never wrapping: every tile in a row stays the same height.
    ".dp-tile-n,.dp-tile-note{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25}",
    ".dp-tile-n{font-size:10.5px;font-weight:700}",
    ".dp-tile-note{font-size:9.5px;font-weight:600;color:var(--ac-text-2);margin-top:-2px}",
    // Corner marks on the square: a count top-right, a word top-left.
    ".dp-tile-badge,.dp-tile-tag{position:absolute;top:-5px;font-size:9px;font-weight:800;line-height:1;",
    "padding:3px 5px;border-radius:var(--ac-pill);white-space:nowrap;border:2px solid var(--ac-bg)}",
    ".dp-tile-badge{right:-6px;background:var(--ac-primary);color:#fff}",
    '.dp-tile[data-app="update"] .dp-tile-badge,.dp-tile[data-app="settings"] .dp-tile-badge,.dp-update-dot{background:var(--tile-red)}',
    ".dp-tile-tag{left:-6px;background:var(--ac-warning);color:var(--ac-text)}",
    // Second layer: the same colour, a shade paler and a little smaller.
    // Sizes trimmed on 2026-10-01 (owner: the tiles were too big): 50px / 44px.
    ".dp-tile-soft .dp-tile-icon{width:44px;height:44px;border-radius:13px;",
    "background:color-mix(in srgb,var(--tile-c) 42%,#fffbe7)}",
    ".dp-tile-soft .dp-tile-e{font-size:21px}",
    // Locked: greyed but still openable (a stage can be looked into before it opens).
    '.dp-tile[data-locked="true"] .dp-tile-icon{filter:grayscale(.75);opacity:.6}',
    '.dp-tile[data-dim="true"] .dp-tile-icon,.dp-tile:disabled .dp-tile-icon{opacity:.45;box-shadow:none}',
    '.dp-tile[data-dim="true"] .dp-tile-n,.dp-tile:disabled .dp-tile-n{color:var(--ac-text-2)}',
    ".dp-tile:disabled{cursor:default}",
    '.dp-tile[data-active="true"] .dp-tile-icon{outline:3px solid var(--ac-active);outline-offset:2px}',
    // The second layer's top row: back, title, one grey line.
    ".dp-drill{position:sticky;top:-12px;z-index:5;display:flex;align-items:center;gap:7px;",
    "margin:-12px 0 10px;padding:12px 0 0;background:var(--ac-bg)}",
    ".dp-drill-back{padding:0;margin:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font:inherit;font-size:16px;font-weight:800;line-height:1;width:26px;height:26px;",
    "flex:none;cursor:pointer;color:var(--ac-text);border-radius:50%;",
    "border:2px solid var(--ac-border-light);background:var(--ac-bg-input)}",
    ".dp-drill-back:hover{border-color:var(--ac-border-hover)}",
    ".dp-drill-title{font-size:12px;font-weight:800;color:var(--ac-text);white-space:nowrap}",
    ".dp-drill-info{flex:1;min-width:0;text-align:right;font-size:10px;font-weight:600;",
    "color:var(--ac-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    // B9: the home screen replaces the bottom icon bar. The bar still exists
    // (its icons carry the alert state the home tiles read) but is not shown.
    "[data-dsh-pig] .dp-card .dp-bar{display:none}",
    ".dp-app-head{margin-bottom:12px}",
    // Out working, the collapsed scene shrinks to pig + prop; open, it must stay
    // as wide as the panel, or the name plate is squeezed onto the pig.
    '[data-dsh-pig][data-open="true"][data-away] .dp-scene{width:var(--panel-width)}',
    // Banners only live on the status tab now, with room to breathe below.
    "[data-dsh-pig] .dp-alert{margin-bottom:14px}",
    "[data-dsh-pig] .dp-alert + .dp-actions{margin-bottom:14px}",
    ".dp-job-go,.dp-job-short{display:block;width:100%;margin-top:9px}",
    ".dp-job-short{margin-top:6px;font-size:.92em}",
    // A picked tile's details (a diary page, a souvenir's story) sit under the grid.
    ".dp-tile-card{margin-top:12px}",
    // 更新 App: the release notes keep their line breaks but stay short.
    ".dp-update-notes{white-space:pre-wrap;font-size:10.5px;line-height:1.5;color:var(--ac-text-2);max-height:120px;overflow:auto;margin:4px 0 6px}",
    ".dp-update-back{margin-top:10px;width:100%}",
    ".dp-update-now{margin-bottom:12px}",
    // 设置页的更新入口：小按钮右上角挂红点。
    ".dp-update-entry{position:relative;margin-left:auto}.dp-update-dot{position:absolute;top:-6px;right:-6px}",
    // 更新面板：按正式版分组的列表，测试版折叠在组里。
    ".dp-rel{border:2px solid var(--ac-border-light);border-radius:var(--ac-radius-sm);background:var(--ac-bg-input);margin:0 0 8px;overflow:hidden}",
    ".dp-rel-head{display:flex;align-items:center;gap:6px;width:100%;padding:8px 10px;border:0;background:transparent;font:inherit;cursor:pointer;text-align:left;color:var(--ac-text)}",
    ".dp-rel-head b{font-size:12px}.dp-rel-head small{color:var(--ac-text-2);font-size:10px}.dp-rel-tags{margin-left:auto;display:flex;gap:4px}",
    ".dp-rel-tag{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:var(--ac-pill);background:var(--ac-bg-content);color:var(--ac-text-2)}",
    '.dp-rel-tag[data-tag="current"]{background:#ffd65c;color:#6b4a00}.dp-rel-tag[data-tag="latest"]{background:var(--ac-primary);color:#fff}',
    ".dp-rel-body{padding:0 10px 10px}.dp-rel-pre{margin-top:6px;border-top:1.5px dashed var(--ac-border-light);padding-top:6px}",
    ".dp-rel-pre-row{display:flex;align-items:center;gap:6px;padding:4px 0;font-size:10.5px}.dp-rel-pre-row .dp-mini{margin-left:auto}",
    ".dp-update-top{display:flex;align-items:center;gap:8px}",
    ".dp-update-top .dp-pick-head{flex:1;min-width:0}",
    ".dp-update-refresh{flex:none}",
    ".dp-update-now .dp-btn,.dp-update-detail .dp-btn{width:100%;margin-top:8px}",
    ".dp-ext-shelf-note{font-size:11px;color:var(--ac-text-2);margin:6px 2px 10px}.dp-ext-goods{display:grid;gap:7px}",
    ".dp-ext-good{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 10px;border-radius:16px;background:var(--ac-bg-input);border:2px solid var(--ac-border-light)}",
    ".dp-ext-good-emoji{width:42px;height:42px;border-radius:12px;background:#fff3c4;display:grid;place-items:center;font-size:22px}",
    ".dp-ext-good-copy b{font-size:12px;color:var(--ac-text)}.dp-ext-good-copy small{display:block;font-size:10px;color:var(--ac-text-2)}",
    ".dp-ext-picks{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px}.dp-ext-good .dp-mini{white-space:nowrap}"
  ].join("");

  // src/client/css-card.js
  var CSS_CARD = [
    ".dp-vcard{position:relative;padding:14px 14px 12px;border-radius:20px;color:var(--ac-text-body);",
    "--vc-dot:rgba(196,184,158,.15);--vc-dot2:rgba(196,184,158,.1);--vc-bg:rgb(247,243,223);--vc-line:#d4c4a8;",
    "background:radial-gradient(circle,var(--vc-dot) 1.5px,transparent 1.5px),",
    "radial-gradient(circle,var(--vc-dot2) 1px,transparent 1px),var(--vc-bg);",
    "background-size:28px 28px,14px 14px;background-position:0 0,7px 7px;border:1.5px solid var(--vc-line)}",
    '.dp-vcard[data-sex="girl"]{--vc-dot:rgba(248,166,178,.18);--vc-dot2:rgba(255,200,210,.12);--vc-bg:#fde4e8;--vc-line:#f8a6b2}',
    '.dp-vcard[data-sex="boy"]{--vc-dot:rgba(136,157,240,.18);--vc-dot2:rgba(180,195,255,.12);--vc-bg:#e8edff;--vc-line:#889df0}',
    // Top: the photo and who it is.
    ".dp-vcard-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}",
    ".dp-vcard-avatar{flex:none;width:72px;height:72px;border-radius:18px;display:flex;align-items:center;",
    "justify-content:center;background:#fffbe7;border:2px solid var(--vc-line);box-shadow:0 3px 0 rgba(61,52,40,.12)}",
    ".dp-vcard-img{width:56px;height:56px;display:block}",
    ".dp-vcard-e{font-size:40px;line-height:1}",
    ".dp-vcard-who{display:flex;flex-direction:column;gap:3px;min-width:0}",
    ".dp-vcard-name{font-size:15px;font-weight:800;color:var(--ac-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    // 名字旁边的蜡笔：平时藏着，鼠标移到名字这行才出来；没有鼠标的设备一直淡淡显示。
    ".dp-vcard-nameline{display:flex;align-items:center;gap:6px;min-width:0}",
    ".dp-vcard-name-edit{width:22px;height:22px;font-size:11px}",
    // 名字、叫你、口头禅、签名：笔平时藏着，鼠标移到那一行才出来（rc.1 反馈）。
    ".dp-vcard-nameline .dp-vcard-edit,.dp-vcard-row .dp-vcard-edit{opacity:0;transition:opacity .15s}",
    // 笔浮在输入框右端、不占宽度：生日、星座这些没有笔的行和叫你、口头禅、签名一样长（rc.3 反馈）。
    ".dp-vcard-row{position:relative}.dp-vcard-row .dp-vcard-edit{position:absolute;right:3px;top:50%;margin-top:-12px}",
    ".dp-vcard-row.dp-vcard-motto-row .dp-vcard-edit{top:3px;margin-top:0}",
    ".dp-vcard-nameline:hover .dp-vcard-edit,.dp-vcard-row:hover .dp-vcard-edit,.dp-vcard-edit:focus-visible{opacity:1}",
    "@media (hover:none){.dp-vcard-nameline .dp-vcard-edit,.dp-vcard-row .dp-vcard-edit{opacity:.6}}",
    ".dp-vcard-sub{font-size:10.5px;font-weight:600;color:var(--ac-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    // 「标签：值」 rows.
    ".dp-vcard-row{display:flex;align-items:center;gap:6px;margin-top:7px;min-width:0}",
    ".dp-vcard-label{flex:none;width:44px;font-size:10.5px;font-weight:700;color:var(--ac-text)}",
    ".dp-vcard-value{flex:1;min-width:0;padding:5px 11px;border-radius:var(--ac-pill);background:#faf8f2;",
    "font-size:11px;font-weight:600;color:var(--ac-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    // The motto is the pig talking: a bubble that may take two lines.
    ".dp-vcard-motto-row{align-items:flex-start}",
    ".dp-vcard-motto-row .dp-vcard-label{margin-top:6px}",
    ".dp-vcard-value.dp-vcard-motto{border-radius:12px;white-space:normal;line-height:1.45}",
    ".dp-vcard-edit{flex:none;font:inherit;font-size:12px;line-height:1;width:24px;height:24px;padding:0;cursor:pointer;",
    "border-radius:50%;border:2px solid var(--vc-line);background:#fffbe7}",
    ".dp-vcard-edit:hover{background:var(--ac-hover)}",
    ".dp-vcard-input{flex:1;min-width:0;padding:3px 9px;font-size:11px}",
    // In-place editing: the two buttons stay as small as the pencil they replace.
    ".dp-vcard-row .dp-mini,.dp-vcard-nameline .dp-mini{flex:none;padding:3px 9px;font-size:10px;box-shadow:none}",
    "[data-dsh-pig] .dp-vcard-row .dp-mini.dp-mini-plain,[data-dsh-pig] .dp-vcard-nameline .dp-mini.dp-mini-plain{background:#fffbe7;color:var(--ac-text);border:2px solid var(--vc-line);box-shadow:none}",
    ".dp-vcard-foot{margin-top:12px;padding-top:9px;border-top:1.5px dashed var(--vc-line);",
    "font-size:10px;font-weight:600;color:var(--ac-text-2);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    // 加冕 App: one cream box per form, its picture on the left, conditions as small chips.
    ".dp-crown{margin-bottom:10px;padding:10px 12px;border-radius:16px;background:#fffbe7;border:2px dashed #e8c66a}",
    ".dp-crown.dp-crown-now{border-style:solid;background:#fdf3d0}",
    ".dp-crown-top{display:flex;gap:10px;align-items:flex-start}",
    ".dp-crown-pic{flex:none;width:58px;height:58px;border-radius:14px;display:flex;align-items:center;justify-content:center;",
    "background:#fff;border:2px solid #f0dca0;font-size:30px}",
    ".dp-crown-img{width:50px;height:50px;display:block}",
    ".dp-crown-side{flex:1;min-width:0}",
    ".dp-crown-head{font-size:12px;font-weight:800;color:var(--ac-text);margin-bottom:6px}",
    ".dp-crown-done{font-size:11px;font-weight:700;color:#3f8a62}",
    ".dp-crown-reqs{display:flex;flex-wrap:wrap;gap:4px}",
    ".dp-crown-req{padding:2px 7px;border-radius:var(--ac-pill);font-size:10px;font-weight:700;white-space:nowrap;",
    "background:#f3ece0;color:var(--ac-text-2)}",
    ".dp-crown-req.dp-crown-ok{background:#dff3e8;color:#3f8a62}",
    ".dp-crown .dp-btn{width:100%;margin-top:9px}"
  ].join("");

  // src/client/css-dex.js
  var CSS_DEX = [
    // Category dashboard: existing app tiles plus a thin museum-style progress rail.
    ".dp-dex-sections .dp-tile{gap:3px}",
    ".dp-dex-progress{display:block;width:42px;height:3px;margin-top:1px;border-radius:4px;overflow:hidden;",
    "background:rgba(61,52,40,.12)}",
    ".dp-dex-progress i{display:block;height:100%;border-radius:inherit;background:var(--tile-c,var(--ac-primary));",
    "transition:width .25s var(--ac-ease)}",
    // Forms and skins: three genuinely small collectible cards.
    ".dp-dex-flash-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;perspective:700px}",
    ".dp-dex-card{position:relative;min-width:0;aspect-ratio:4/5;padding:4px;border:1.5px solid rgba(117,91,48,.3);",
    "border-radius:11px;overflow:hidden;cursor:pointer;color:var(--ac-text);font:inherit;",
    "background:linear-gradient(145deg,#fff9dc 0%,#f5dd9e 38%,#e8bfcf 68%,#b9ddec 100%);",
    "box-shadow:0 3px 0 rgba(61,52,40,.13),0 6px 12px rgba(91,67,37,.09);",
    "transform:rotateX(var(--dex-rx,0deg)) rotateY(var(--dex-ry,0deg));transform-style:preserve-3d;",
    "transition:transform .18s var(--ac-ease),box-shadow .18s var(--ac-ease)}",
    ".dp-dex-card:hover{transform:translateY(-2px) rotateX(var(--dex-rx,-2deg)) rotateY(var(--dex-ry,3deg));",
    "box-shadow:0 5px 0 rgba(61,52,40,.11),0 9px 16px rgba(91,67,37,.14)}",
    ".dp-dex-card:focus-visible,.dp-dex-museum-item:focus-visible,.dp-dex-row:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px}",
    '.dp-dex-card-foil::after,.dp-dex-big-foil::after{content:"";position:absolute;inset:-45%;pointer-events:none;',
    "background:linear-gradient(112deg,transparent 32%,rgba(255,255,255,.08) 42%,rgba(255,255,255,.7) 49%,",
    "rgba(155,224,255,.3) 54%,transparent 66%);transform:translateX(-58%) rotate(5deg);",
    "transition:transform .65s ease;mix-blend-mode:screen}",
    ".dp-dex-card-foil:hover::after,.dp-dex-big-foil:hover::after{transform:translateX(58%) rotate(5deg)}",
    ".dp-dex-card-locked{background:linear-gradient(145deg,#e4e2dc,#bbbcb9 52%,#d4d0ca);border-color:#aaa7a0}",
    ".dp-dex-artbox{position:relative;height:calc(100% - 19px);display:flex;align-items:center;justify-content:center;",
    "border-radius:8px;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1px rgba(255,255,255,.7);overflow:hidden}",
    ".dp-dex-art{display:block;width:88%;height:88%;object-fit:contain;filter:drop-shadow(0 3px 2px rgba(61,52,40,.16));",
    "transform:translateZ(10px);transition:transform .18s var(--ac-ease)}",
    ".dp-dex-card-foil:hover .dp-dex-art{transform:translateZ(13px) scale(1.04)}",
    ".dp-dex-card-locked .dp-dex-art,.dp-dex-big-locked .dp-dex-art,.dp-dex-museum-locked .dp-dex-art,",
    ".dp-dex-info-locked .dp-dex-art{filter:grayscale(1) brightness(0);opacity:.3}",
    ".dp-dex-emoji{font-size:27px;line-height:1;filter:drop-shadow(0 2px 1px rgba(61,52,40,.14))}",
    ".dp-dex-emoji-large{font-size:42px}",
    ".dp-dex-lock{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;",
    "align-items:center;justify-content:center;width:25px;height:25px;border-radius:50%;font-size:12px;",
    "background:rgba(58,57,54,.78);border:1.5px solid rgba(255,255,255,.82);box-shadow:0 2px 6px rgba(0,0,0,.16)}",
    ".dp-dex-caption{position:relative;z-index:1;display:block;margin-top:4px;font-size:8.5px;font-weight:800;",
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}",
    ".dp-dex-card-locked .dp-dex-caption{color:#615f5b;letter-spacing:.04em}",
    // Fish and souvenirs: pastel three-column museum shelf, no foil or 3D.
    ".dp-dex-museum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 8px}",
    ".dp-dex-museum-item{font:inherit;min-width:0;height:82px;padding:5px;border:0;border-radius:13px;cursor:pointer;",
    "display:flex;flex-direction:column;align-items:center;justify-content:space-between;color:var(--ac-text);",
    "background:var(--ac-bg-content);box-shadow:inset 0 0 0 1.5px var(--ac-border-light)}",
    ".dp-dex-museum-item:nth-child(4n+1){background:#e5f3f5}.dp-dex-museum-item:nth-child(4n+2){background:#f5e6ef}",
    ".dp-dex-museum-item:nth-child(4n+3){background:#eef3df}.dp-dex-museum-item:nth-child(4n){background:#f8efd9}",
    ".dp-dex-museum-art{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:54px}",
    ".dp-dex-museum-art .dp-dex-art{width:48px;height:48px}",
    ".dp-dex-museum-lock{position:absolute;right:1px;top:1px;font-size:10px}",
    ".dp-dex-museum-name{display:block;width:100%;font-size:8.5px;font-weight:800;white-space:nowrap;",
    "overflow:hidden;text-overflow:ellipsis;text-align:center}",
    ".dp-dex-museum-locked{filter:grayscale(.45);color:var(--ac-text-2)}",
    // Item catalogue: search + wraparound category chips + dense rows.
    ".dp-dex-catalog-tools{margin-bottom:8px}",
    ".dp-dex-search{width:100%;height:28px;margin:0 0 6px;padding:4px 10px;font-size:10px}",
    ".dp-dex-filters{display:flex;gap:4px;overflow-x:auto;padding:1px 0 3px;scrollbar-width:none}",
    ".dp-dex-filters::-webkit-scrollbar{display:none}",
    ".dp-dex-filter{font:inherit;flex:none;border:1.5px solid var(--ac-border-light);border-radius:var(--ac-pill);",
    "background:var(--ac-bg-input);color:var(--ac-text-2);padding:3px 8px;font-size:9px;font-weight:700;cursor:pointer}",
    '.dp-dex-filter[data-active="true"]{background:var(--tile-orange);border-color:#cc7950;color:#fff}',
    ".dp-dex-catalog{display:flex;flex-direction:column;gap:5px}",
    ".dp-dex-row{font:inherit;width:100%;min-width:0;border:1.5px solid var(--ac-border-light);border-radius:10px;",
    "background:var(--ac-bg-content);color:var(--ac-text);padding:5px 8px;display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left}",
    ".dp-dex-row-emoji{flex:none;width:25px;text-align:center;font-size:19px}",
    ".dp-dex-row-text{flex:1;min-width:0;display:flex;flex-direction:column}",
    ".dp-dex-row-text b{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".dp-dex-row-text small{font-size:8.5px;color:var(--ac-text-2)}",
    ".dp-dex-row-count{flex:none;font-size:9px;font-weight:800;color:var(--ac-text-2)}",
    ".dp-dex-row-locked{color:var(--ac-text-2);background:#efeee9}",
    '.dp-dex-row[data-search-hidden="true"]{display:none}',
    // A detail replaces the shelf instead of stretching it underneath.
    ".dp-dex-detail{perspective:800px}",
    ".dp-dex-big,.dp-dex-info{position:relative;overflow:hidden;padding:12px;border-radius:18px;",
    "border:2px solid rgba(177,127,43,.4);background:linear-gradient(145deg,#fff8cf 0%,#f6d48c 32%,#efb8d1 61%,#a9d9ec 100%);",
    "box-shadow:0 4px 0 rgba(61,52,40,.13),0 10px 22px rgba(91,67,37,.12)}",
    ".dp-dex-big{transform-style:preserve-3d;transform:rotateX(var(--dex-rx,0deg)) rotateY(var(--dex-ry,0deg));transition:transform .18s ease}",
    ".dp-dex-big-locked{background:linear-gradient(145deg,#e9e7e1,#c5c5c1 56%,#ddd9d3);border-color:#aaa7a0}",
    ".dp-dex-info{background:#fffaf0;border-color:var(--ac-border-light)}",
    ".dp-dex-info-locked{background:#e9e7e1;border-color:#aaa7a0}",
    ".dp-dex-big-art,.dp-dex-info-art{position:relative;height:112px;display:flex;align-items:center;justify-content:center;",
    "border-radius:14px;background:rgba(255,255,255,.5);box-shadow:inset 0 0 0 1px rgba(255,255,255,.76);overflow:hidden}",
    ".dp-dex-info-art{height:92px}.dp-dex-big-art .dp-dex-art{width:106px;height:106px}",
    ".dp-dex-info-art .dp-dex-art{width:82px;height:82px}",
    ".dp-dex-big-title{position:relative;z-index:1;margin-top:9px;font-size:14px;font-weight:900;text-align:center;color:var(--ac-text)}",
    ".dp-dex-riddle{position:relative;z-index:1;margin-top:8px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.55);",
    "font-size:10.5px;font-weight:600;line-height:1.55;color:var(--ac-text-body)}",
    ".dp-dex-riddle b{display:block;margin-bottom:2px;font-size:9px;letter-spacing:.14em;color:#766f65}",
    ".dp-dex-story{position:relative;z-index:1;margin-top:7px;font-size:10.5px;font-weight:600;line-height:1.5;",
    "text-align:center;color:var(--ac-text-body)}",
    ".dp-dex-foot{position:relative;z-index:1;margin-top:8px;padding-top:7px;border-top:1px dashed rgba(87,69,42,.3);",
    "font-size:9.5px;font-weight:700;text-align:center;color:var(--ac-text-2)}",
    ".dp-dex-skin-action{position:relative;z-index:1;display:flex;margin-top:16px;justify-content:center}",
    "@media (prefers-reduced-motion:reduce){.dp-dex-card,.dp-dex-big,.dp-dex-art{transition:none!important;transform:none!important}",
    ".dp-dex-card-foil::after,.dp-dex-big-foil::after{display:none}}"
  ].join("");

  // src/client/css-fishing.js
  var CSS_FISHING = `
.dp-fish-blocked{margin:10px 0 6px;padding:9px 11px;border-radius:10px;background:#fff1df;color:#8f5123;font-size:12px;font-weight:700}.dp-fish-care{margin-bottom:8px}.dp-fish-cast{display:block;width:100%;min-height:44px;margin-top:12px;touch-action:manipulation}
.dp-fish-scene{margin:8px 0;padding:20px 8px;border-radius:16px;background:linear-gradient(#c8f2ff 0 45%,#69c9e8 46%);text-align:center;font-size:24px;letter-spacing:4px}.dp-fish-copy{font-size:12px;line-height:1.55;color:#61727a;margin:8px 2px}.dp-fish-cast{touch-action:manipulation}.dp-fish-waiting{width:100%;height:245px;border:0;border-radius:18px;background:linear-gradient(#d7f6ff 0 34%,#5cc7e8 35% 72%,#2d9ac3 73%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#16495b;cursor:pointer}.dp-fish-bobber{font-size:42px;animation:dp-fish-bob 1.3s ease-in-out infinite}.dp-fish-waiting[data-bite=true]{box-shadow:0 0 0 4px #ffcf45 inset}.dp-fish-waiting[data-bite=true] .dp-fish-bobber{animation:dp-fish-bite .18s ease-in-out infinite alternate}@keyframes dp-fish-bob{50%{transform:translateY(5px)}}@keyframes dp-fish-bite{to{transform:scale(1.2) rotate(7deg)}}
.dp-fish-qte{width:100%;min-height:318px;border:0;border-radius:18px;padding:15px 12px 12px;box-sizing:border-box;background:linear-gradient(155deg,#eefcff,#d8f3f8);display:flex;flex-direction:column;align-items:center;gap:9px;color:#294950;cursor:pointer;touch-action:manipulation;outline:0}.dp-fish-qte:focus-visible{box-shadow:0 0 0 3px #43b96f}.dp-fish-qte-title{font-size:15px;font-weight:800}.dp-fish-qte-ring{position:relative;width:178px;height:178px;border-radius:50%;box-shadow:0 3px 12px #246a7a44,inset 0 0 0 2px #fff;transform:rotate(-90deg)}.dp-fish-qte-ring:after{content:"";position:absolute;inset:17px;border-radius:50%;background:#f8feff;box-shadow:inset 0 2px 8px #8ab7c044}.dp-fish-qte-needle{position:absolute;z-index:3;left:50%;bottom:50%;width:4px;height:47%;border-radius:4px;background:#ed5d55;box-shadow:0 0 0 1px #fff,0 0 6px #d64a45;transform-origin:50% 100%}.dp-fish-qte-needle:after{content:"";position:absolute;top:-5px;left:-3px;width:10px;height:10px;border-radius:50%;background:#ed5d55}.dp-fish-qte-core{position:absolute;z-index:4;inset:31px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#fff 0 48%,#e9f9fb 70%);font-size:42px;transform:rotate(90deg)}.dp-fish-qte-score{font-size:14px}.dp-fish-qte-feedback{min-height:18px;font-size:12px;color:#55727a}.dp-fish-qte[data-qte-feedback^="\u8FD8\u6CA1\u5230"] .dp-fish-qte-feedback,.dp-fish-qte[data-qte-feedback^="\u5DF2\u7ECF\u5212\u8FC7"] .dp-fish-qte-feedback{color:#bd5545;font-weight:700}.dp-fish-help{text-align:center;font-size:11px;color:#718188}.dp-fish-result,.dp-fish-away{display:flex;flex-direction:column;align-items:center;gap:10px;margin:16px 0;padding:22px 14px;border-radius:18px;background:#edfaff;text-align:center}.dp-fish-result-emoji,.dp-fish-away{font-size:58px}.dp-fish-result span{color:#65757b;font-size:13px}
.dp-fish-label{margin:4px 2px 6px;font-size:11px;font-weight:800;color:var(--ac-text-2);letter-spacing:.04em}
.dp-fish-baits{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dp-fish-bait{font:inherit;display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:14px;border:2px solid var(--ac-border-light);background:var(--ac-bg-input);color:var(--ac-text-body);cursor:pointer}
.dp-fish-bait em{font-style:normal;font-size:22px;line-height:1.2}.dp-fish-bait b{font-size:11px;color:var(--ac-text)}.dp-fish-bait small{font-size:9.5px;color:var(--ac-text-2)}
.dp-fish-bait[aria-pressed=true]{border-color:var(--ac-primary);background:var(--ac-primary-bg)}.dp-fish-bait:disabled{opacity:.5;cursor:not-allowed}
.dp-fish-auto{display:grid;gap:6px;margin-top:12px;padding-top:9px;border-top:1.5px dashed var(--ac-border-light);font-size:11px;color:var(--ac-text-body)}
.dp-fish-auto summary{cursor:pointer;font-weight:800;color:var(--ac-text)}.dp-fish-auto-row{display:flex;flex-wrap:wrap;gap:6px}.dp-fish-why{color:var(--ac-text-2)}
.dp-fish-stars{color:#e8b400;letter-spacing:2px;font-size:14px!important}
.dp-fish-stage{width:100%;border:0;border-radius:18px;padding:14px 12px 12px;box-sizing:border-box;background:linear-gradient(155deg,#eefcff,#d8f3f8);display:flex;flex-direction:column;align-items:center;gap:10px;color:#294950;cursor:pointer;touch-action:none;user-select:none;outline:0}
.dp-fish-stage:focus-visible{box-shadow:0 0 0 3px #43b96f}
.dp-fish-bar{display:grid;grid-template-columns:56px 14px;gap:10px;height:220px}
.dp-fish-track{position:relative;border-radius:14px;background:linear-gradient(#bfe6ef,#8fd0df);overflow:hidden}
.dp-fish-zone{position:absolute;left:3px;right:3px;border-radius:10px;background:#6bd47bbb;border:2px solid #4cb860;box-sizing:border-box}
.dp-fish-swimmer{position:absolute;left:50%;font-size:24px;line-height:1;transform:translate(-50%,50%)}
.dp-fish-vmeter{position:relative;border-radius:10px;background:#dce8e9;overflow:hidden}.dp-fish-vmeter i{position:absolute;left:0;right:0;bottom:0;background:#ffd45d}
.dp-fish-stage[data-inside=true] .dp-fish-vmeter i{background:#6bd47b}
.dp-fish-line{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;color:#4a7a86}.dp-fish-rod{font-size:36px;transition:transform .1s}
.dp-fish-gauge{position:relative;width:100%;height:24px;border-radius:50px;background:linear-gradient(90deg,#bfe6ef 0 30%,#6bd47b 30% 72%,#ffd45d 72% 85%,#e05a5a 85%)}
.dp-fish-gauge b{position:absolute;top:-6px;width:6px;height:36px;border-radius:4px;background:#794f27;transform:translateX(-50%)}
.dp-fish-pull-state{font-size:12px;font-weight:800;min-height:16px}
.dp-fish-hmeter{width:100%;height:10px;border-radius:50px;background:#dce8e9;overflow:hidden}.dp-fish-hmeter i{display:block;height:100%;width:0;background:#6bd47b}
.dp-fish-spots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 8px}
.dp-fish-spot{display:grid;justify-items:center;gap:1px;padding:6px 2px;border-radius:14px;font:inherit;color:inherit;cursor:pointer;background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}
.dp-fish-spot em{font-style:normal;font-size:20px;line-height:1.1}.dp-fish-spot b{font-size:10.5px}.dp-fish-spot small{font-size:9.5px;color:var(--ac-text-2)}
.dp-fish-spot[aria-pressed="true"]{background:#e3f4f6;border-color:#7cc7d1;box-shadow:0 2px 0 #7cc7d1}.dp-fish-spot:disabled{opacity:.55;cursor:default}
.dp-fish-rodrow{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0 0 10px;font-size:11px;font-weight:800}
.dp-fish-rodrow small{width:100%;font-weight:600;font-size:10px;color:var(--ac-text-2)}
.dp-fish-waiting[data-nibble="true"] .dp-fish-bobber{animation:dp-fish-nibble .42s ease-in-out}
@keyframes dp-fish-nibble{0%,100%{transform:translateY(0)}30%{transform:translateY(5px) rotate(-6deg)}60%{transform:translateY(-2px) rotate(4deg)}}
`;

  // src/client/css-skins.js
  var CSS_SKINS = `
.dp-skin-intro{display:grid;gap:4px;margin:0 0 10px}.dp-skin-intro span{font-size:10.5px;line-height:1.5;color:var(--ac-text-2)}.dp-skin-grid{display:flex;flex-direction:column;gap:7px}.dp-skin-row{min-height:62px;padding:7px 9px}.dp-skin-current{background:var(--ac-active);border-color:#9db0d6}.dp-skin-row[data-locked="true"] .dp-skin-art{filter:grayscale(1);opacity:.48}.dp-skin-art{width:48px;height:48px;flex:none;object-fit:contain}.dp-skin-copy{display:grid;gap:3px}.dp-skin-copy b{font-size:10.5px}.dp-skin-copy small{line-height:1.35}.dp-skin-row>.dp-mini{flex:none;padding-inline:10px}.dp-skin-import{display:grid;grid-template-columns:1fr auto;align-items:center;gap:3px 8px;margin-top:10px;cursor:pointer}.dp-skin-import .dp-pick-head{margin:0}.dp-skin-import>.dp-dim{font-size:10px;line-height:1.4;color:var(--ac-text-2)}.dp-skin-import input{position:absolute;width:1px;height:1px;opacity:0}.dp-skin-file{grid-column:2;grid-row:1/3;display:inline-flex!important;align-items:center;white-space:nowrap}.dp-skin-howto{display:flex;width:100%;justify-content:center;margin:10px 0 8px}
`;

  // src/client/css-holo.js
  var CSS_HOLO = [
    ".dp-holo{--c:#aeb9c4;box-sizing:border-box;position:relative;display:block;width:100%;min-width:0;aspect-ratio:3/4;padding:4px;border:0;border-radius:14px;background:linear-gradient(145deg,var(--c),var(--cl,#eef2f5));box-shadow:0 0 12px color-mix(in srgb,var(--c) 70%,transparent),0 5px 10px rgba(61,52,40,.14);font:inherit;cursor:pointer;transform:perspective(500px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .15s ease-out;transform-style:preserve-3d}",
    '.dp-holo[data-s="4"]{--c:#b48cf2;--cl:#f3ecff}.dp-holo[data-s="5"]{--c:#f2b632;--cl:#fff4d6}.dp-holo[data-s="6"]{--c:#ff7a2f;--cl:#ffe6d6}.dp-holo[data-missing="true"]{box-shadow:0 3px 8px rgba(61,52,40,.1);filter:saturate(.55)}',
    '.dp-holo-face{position:relative;box-sizing:border-box;display:grid;grid-template-rows:1fr auto auto;justify-items:center;width:100%;height:100%;padding:6px 3px 5px;overflow:hidden;border-radius:10px;background:radial-gradient(circle at 50% 38%,#fff 0 34%,var(--cl,#f3f0e8) 100%)}.dp-holo-face::before{content:"";position:absolute;left:50%;top:60%;width:52%;height:7%;transform:translateX(-50%);border-radius:50%;background:rgba(120,90,60,.16)}',
    '.dp-holo-face::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 25%,rgba(255,140,210,.3) 40%,rgba(130,220,255,.32) 50%,rgba(255,240,150,.32) 60%,transparent 75%);background-size:260% 260%;opacity:.9;animation:dp-holo-shine 2.4s linear infinite}',
    ".dp-holo:hover .dp-holo-face::after{animation:none;background-position:var(--hx,50%) var(--hy,50%)}",
    ".dp-holo-doll{position:relative;z-index:1;align-self:center;font-size:30px;line-height:1;transform:translateZ(26px);filter:drop-shadow(0 4px 3px rgba(80,60,40,.25))}",
    ".dp-holo-name{z-index:1;max-width:100%;font-size:10px;font-weight:900;color:#6b4a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dp-holo-stars{z-index:1;font-size:8px;letter-spacing:-1px;color:var(--c)}",
    '.dp-holo[data-missing="true"] .dp-holo-doll{filter:brightness(0) opacity(.14)}.dp-holo[data-missing="true"] .dp-holo-face::after{opacity:0}.dp-holo[data-missing="true"] .dp-holo-name{color:var(--ac-text-2,#9f927d)}',
    ".dp-holo-large{width:110px;flex:none}.dp-holo-large .dp-holo-doll{font-size:46px}.dp-holo-large .dp-holo-name{font-size:11px}",
    ".dp-holo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.dp-holo-tier{font-size:12px;color:var(--ac-text);margin:12px 2px 8px}",
    ".dp-holo-detail{display:flex;gap:12px;align-items:center;padding:10px;margin:10px 0;border-radius:18px;background:var(--ac-bg-input);border:2px solid var(--ac-border-light)}",
    ".dp-holo-copy{min-width:0;display:grid;gap:5px;color:var(--ac-text)}.dp-holo-copy b{font-size:14px}.dp-holo-rating{color:#ff7a2f}.dp-holo-copy p{margin:0;font-size:11px;line-height:1.5}",
    '.dp-holo-potential{display:flex;gap:3px}.dp-holo-potential i{width:13px;height:8px;border-radius:3px;background:#e9dfca}.dp-holo-potential i[data-on="true"]{background:#ff9a58}',
    "@keyframes dp-holo-shine{from{background-position:100% 100%}to{background-position:0 0}}",
    "@media (prefers-reduced-motion:reduce){.dp-holo,.dp-holo-face::after{animation:none!important;transition:none!important;transform:none!important}}"
  ].join("");

  // src/client/wallet.js
  var TO_GOLD = [10, 100];
  var FROM_GOLD = [10, 100, 1e3];
  var CSS_WALLET = [
    ".dp-wallet{display:grid;gap:8px;margin:0 0 10px;padding:9px 11px;border-radius:16px;background:var(--ac-bg-input);border:2px solid var(--ac-border-light)}",
    ".dp-wallet-head{display:flex;align-items:center;gap:8px;font-weight:800}",
    ".dp-wallet-emoji{font-size:22px;line-height:1}.dp-wallet-name{font-size:11px;color:var(--ac-text-2);font-weight:700}",
    ".dp-wallet-balance{flex:1;font-size:15px;letter-spacing:.02em}",
    ".dp-wallet-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}",
    ".dp-wallet-row>small{width:100%;font-size:10px;color:var(--ac-text-2)}"
  ].join("");
  function walletBar(ui, wallet, options) {
    var always = options && options.open === true;
    var open = always || ui.drill.wallet === wallet.key;
    var box = el("div", "dp-wallet");
    box.setAttribute("data-wallet", wallet.key);
    var head = el("div", "dp-wallet-head");
    head.appendChild(el("span", "dp-wallet-emoji", wallet.emoji));
    var name = el("span", "dp-wallet-balance", String(wallet.balance));
    name.appendChild(el("span", "dp-wallet-name", " " + wallet.label));
    head.appendChild(name);
    if (!always) {
      var toggle = button("dp-mini dp-mini-plain", { "data-wallet-toggle": wallet.key }, function() {
        ui.drill.wallet = open ? null : wallet.key;
        ui.renderContent();
      });
      toggle.textContent = open ? "\u6536\u8D77" : "\u6362";
      head.appendChild(toggle);
    }
    box.appendChild(head);
    if (!open) return box;
    var coins = Number(ui.view.pig && ui.view.pig.coins) || 0;
    var send2 = function(direction, amount) {
      ui.send("exchange", { key: wallet.key, direction, amount });
    };
    var out = el("div", "dp-wallet-row");
    out.appendChild(el("small", null, "\u6362\u6210\u91D1\u5E01 \xB7 1 " + wallet.label + " = " + wallet.rate + " \u{1FA99}"));
    var amounts = TO_GOLD.filter(function(n) {
      return n < wallet.balance;
    }).concat(wallet.balance > 0 ? [wallet.balance] : []);
    for (var i = 0; i < amounts.length; i += 1) {
      (function(n, all) {
        var gold = Math.floor(n * wallet.rate);
        var go = button("dp-mini", { "data-wallet-out": all ? "all" : String(n) }, function() {
          send2("toGold", n);
        });
        go.textContent = (all ? "\u5168\u90E8 " : "") + n + " \u2192 \u{1FA99} " + gold;
        go.disabled = gold === 0;
        out.appendChild(go);
      })(amounts[i], i === amounts.length - 1 && wallet.balance > 0);
    }
    if (wallet.balance === 0) out.appendChild(el("span", "dp-wallet-name", "\u8FD8\u6CA1\u6709" + wallet.label));
    box.appendChild(out);
    if (wallet.buyable === false) return box;
    var back = el("div", "dp-wallet-row");
    back.appendChild(el("small", null, "\u7528\u91D1\u5E01\u6362 \xB7 1 " + wallet.label + " = " + wallet.buyRate + " \u{1FA99}\uFF08\u542B 5% \u624B\u7EED\u8D39\uFF09"));
    for (var j = 0; j < FROM_GOLD.length; j += 1) {
      (function(n) {
        var cost = Math.ceil(n * wallet.buyRate - 1e-9);
        var buy = button("dp-mini dp-mini-plain", { "data-wallet-in": String(n) }, function() {
          send2("fromGold", n);
        });
        buy.textContent = "\u{1FA99} " + cost + " \u2192 " + n;
        buy.disabled = coins < cost;
        back.appendChild(buy);
      })(FROM_GOLD[j]);
    }
    box.appendChild(back);
    return box;
  }

  // src/client/styles.js
  var CSS = CSS_BASE + CSS_TABS + CSS_TILES + CSS_CARD + CSS_DEX + CSS_FISHING + CSS_SKINS + CSS_HOLO + CSS_ACHIEVEMENTS + CSS_WALLET;

  // src/client/interaction-motion.js
  function canAnimate(node) {
    return typeof node.animate === "function" && !(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  var appEntry = null;
  function animateAppEntry(content) {
    if (!canAnimate(content)) return;
    appEntry?.cancel();
    appEntry = content.animate([
      { opacity: 0.7, transform: "translateY(5px)" },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: 170, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  function animatePurchase(tile2) {
    if (!canAnimate(tile2)) return;
    tile2.animate([
      { transform: "scale(0.94)", opacity: 0.72 },
      { transform: "scale(1.04)", opacity: 1, offset: 0.5 },
      { transform: "scale(1)", opacity: 1 }
    ], { duration: 320, easing: "ease-out" });
  }
  function panelOrigin(ctx) {
    const below = ctx.host.getAttribute("data-panel-vertical") === "below" || ctx.card.style.top !== "auto" && ctx.card.style.top !== "";
    const right = ctx.host.getAttribute("data-panel-side") === "right";
    return { below, origin: (below ? "top " : "bottom ") + (right ? "left" : "right") };
  }
  function animatePanelOpen(ctx) {
    const { below, origin } = panelOrigin(ctx);
    for (const node of [ctx.card, ctx.hud]) {
      if (!node || node.hidden || !canAnimate(node)) continue;
      node.style.transformOrigin = origin;
      node.animate([
        { opacity: 0, transform: `translateY(${below ? -6 : 6}px) scale(.94)` },
        { opacity: 1, transform: "none" }
      ], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
  function animatePanelClose(ctx) {
    const { below, origin } = panelOrigin(ctx);
    const host3 = ctx.host;
    for (const node of [ctx.card, ctx.hud]) {
      if (!node || node.hidden || !canAnimate(node) || typeof node.cloneNode !== "function") continue;
      const ghost = node.cloneNode(true);
      ghost.setAttribute("data-ghost", "true");
      ghost.setAttribute("aria-hidden", "true");
      const fromTop = host3.style.top !== "" && host3.style.top !== "auto";
      const fromLeft = host3.style.left !== "" && host3.style.left !== "auto";
      const style = ghost.style;
      style.pointerEvents = "none";
      style.margin = "0";
      style.width = node.offsetWidth + "px";
      style.height = node.offsetHeight + "px";
      style.maxHeight = "none";
      style.top = fromTop ? node.offsetTop + "px" : "auto";
      style.bottom = fromTop ? "auto" : host3.offsetHeight - node.offsetTop - node.offsetHeight + "px";
      style.left = fromLeft ? node.offsetLeft + "px" : "auto";
      style.right = fromLeft ? "auto" : host3.offsetWidth - node.offsetLeft - node.offsetWidth + "px";
      style.transformOrigin = origin;
      node.parentNode.insertBefore(ghost, node.nextSibling);
      const fade = ghost.animate([
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateY(${below ? -4 : 4}px) scale(.96)` }
      ], { duration: 140, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      fade.onfinish = () => ghost.remove();
      setTimeout(() => ghost.remove(), 400);
    }
  }

  // src/client/widgets.js
  function labelledBar(ui, label, value, valueText, variant) {
    var row = el("div", "dp-row");
    row.appendChild(el("span", null, label));
    row.appendChild(el("b", null, valueText));
    ui.content.appendChild(row);
    ui.content.appendChild(meter(value, variant));
  }
  function statStrip(ui) {
    var p = ui.view.pig;
    if (p === null) return;
    var strip = el("div", "dp-statstrip");
    var cells = [
      ["\u{1F35A} \u9971\u98DF", p.satiety, p.satiety + "%", ""],
      ["\u2764\uFE0F \u5FC3\u60C5", p.happiness, p.happiness + "%", "dp-mood"],
      ["\u{1FAE7} \u6E05\u6D01", p.cleanliness, p.cleanliness + "%", "dp-clean"],
      ["\u{1F49A} \u5065\u5EB7", p.healthPercent, p.health + "/" + ui.view.maxHealth, "dp-health"]
    ];
    for (var i = 0; i < cells.length; i += 1) {
      var cell = el("div", "dp-statcell");
      var head = el("div", "dp-row");
      head.appendChild(el("span", null, cells[i][0]));
      head.appendChild(el("b", null, cells[i][2]));
      cell.appendChild(head);
      cell.appendChild(meter(cells[i][1], cells[i][3]));
      strip.appendChild(cell);
    }
    strip.appendChild(el("div", "dp-statweight", "\u2696\uFE0F \u4F53\u91CD " + p.weight));
    ui.content.appendChild(strip);
  }
  function careEffectLine(action, item) {
    var parts = [];
    if (action === "feed") {
      parts.push("\u9971\u98DF +" + item.satiety);
      if (item.happiness) parts.push("\u5FC3\u60C5 +" + item.happiness);
    } else if (action === "bathe") {
      parts.push("\u6E05\u6D01 +" + item.cleanliness);
      if (item.happiness) parts.push("\u5FC3\u60C5 +" + item.happiness);
    } else {
      parts.push("\u5FC3\u60C5 +" + item.happiness);
      if (item.satiety) parts.push("\u9971\u98DF " + item.satiety);
    }
    return parts.join(" \xB7 ");
  }
  function tileGrid() {
    return el("div", "dp-tiles");
  }
  function tile(spec) {
    var node = button("dp-tile" + (spec.soft ? " dp-tile-soft" : ""), spec.data ?? {}, function() {
      spec.onPick();
    });
    node.setAttribute("data-color", spec.color);
    if (spec.locked) node.setAttribute("data-locked", "true");
    if (spec.dim) node.setAttribute("data-dim", "true");
    if (spec.active) node.setAttribute("data-active", "true");
    if (spec.disabled === true) node.disabled = true;
    var icon = el("span", "dp-tile-icon");
    icon.appendChild(spec.icon ?? el("span", "dp-tile-e", spec.emoji));
    if (spec.badge) icon.appendChild(el("b", "dp-tile-badge", spec.badge));
    if (spec.tag) icon.appendChild(el("b", "dp-tile-tag", spec.tag));
    node.appendChild(icon);
    node.appendChild(el("span", "dp-tile-n", spec.label));
    if (spec.note) node.appendChild(el("span", "dp-tile-note", spec.note));
    return node;
  }
  function drillTo(ui, tab, key) {
    ui.drill[tab] = key;
    ui.drill.pick = null;
    ui.renderContent();
    ui.content.scrollTop = 0;
  }
  function drillHeader(ui, tab, title, info) {
    var row = el("div", "dp-drill");
    var back = button("dp-drill-back", { "data-back": tab }, function() {
      if (ui.drill.from) ui.select(ui.drill.from);
      else drillTo(ui, tab, null);
    });
    back.textContent = "\u2039";
    row.appendChild(back);
    row.appendChild(el("b", "dp-drill-title", title));
    if (info) row.appendChild(el("span", "dp-drill-info", info));
    ui.content.appendChild(row);
  }

  // src/client/tabs/shop.js
  var SHELF_COLOR = { food: "red", bath: "teal", toy: "yellow", bait: "blue", medicine: "green", revive: "purple", promotion: "blue" };
  function shelfParts(kind) {
    var title = KIND_TITLE[kind] ?? kind;
    var space = title.indexOf(" ");
    return space < 0 ? ["\u{1F6D2}", title] : [title.slice(0, space), title.slice(space + 1)];
  }
  function renderShopTab(ui) {
    const extShelves = ui.view.extShelves ?? [];
    if (ui.view.shop.length === 0 && extShelves.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u5BBF\u4E3B\u8FD8\u6CA1\u63D0\u4F9B\u8D27\u67B6\u3002"));
      return;
    }
    var coins = "\u{1FA99} " + ui.view.pig.coins;
    var shelf = ui.drill.shop;
    const extShelf = extShelves.find((entry) => "ext:" + entry.extension === shelf);
    if (extShelf) {
      renderExtShelf(ui, extShelf);
      return;
    }
    if (shelf === null || KIND_ORDER.indexOf(shelf) < 0) {
      renderShelves(ui);
      return;
    }
    var parts = shelfParts(shelf);
    drillHeader(ui, "shop", parts[0] + " " + parts[1], coins);
    var grid = tileGrid();
    var items = ui.view.shop.filter(function(item) {
      return shelfOf(item.kind) === shelf;
    });
    var boughtTile = null;
    for (var i = 0; i < items.length; i += 1) {
      var node = itemTile(ui, items[i], SHELF_COLOR[shelf]);
      grid.appendChild(node);
      if (items[i].key === ui.justBought) boughtTile = node;
    }
    ui.content.appendChild(grid);
    if (boughtTile !== null) animatePurchase(boughtTile);
  }
  function renderShelves(ui) {
    var grid = tileGrid();
    for (var k = 0; k < KIND_ORDER.length; k += 1) {
      (function(kind) {
        var items = ui.view.shop.filter(function(item) {
          return shelfOf(item.kind) === kind;
        });
        if (items.length === 0) return;
        var parts = shelfParts(kind);
        var needed = items.some(function(item) {
          return item.needed;
        });
        grid.appendChild(tile({
          emoji: parts[0],
          label: parts[1],
          color: SHELF_COLOR[kind] ?? "blue",
          tag: needed ? "\u9700\u8981" : "",
          data: { "data-shelf": kind },
          onPick: function() {
            drillTo(ui, "shop", kind);
          }
        }));
      })(KIND_ORDER[k]);
    }
    for (const shelf of ui.view.extShelves ?? []) {
      grid.appendChild(tile({
        emoji: shelf.emoji,
        label: shelf.label,
        color: shelf.color || "orange",
        // 跟内置货架一样只写名字；不用金币买的才在下面注明货币。
        note: shelf.currency && shelf.currency.label !== "\u91D1\u5E01" ? shelf.currency.label : void 0,
        data: { "data-shelf": "ext:" + shelf.extension },
        onPick: function() {
          drillTo(ui, "shop", "ext:" + shelf.extension);
        }
      }));
    }
    ui.content.appendChild(grid);
  }
  function renderExtShelf(ui, shelf) {
    const currency = shelf.currency ?? { label: "\u8D27\u5E01", emoji: "\u{1FA99}", balance: 0 };
    drillHeader(ui, "shop", shelf.emoji + " " + shelf.label, currency.emoji + " " + currency.balance);
    ui.content.appendChild(el("div", "dp-ext-shelf-note", "\u7528" + currency.label + "\u4E70 \xB7 " + currency.emoji + " \u4F59\u989D " + currency.balance));
    const list = el("div", "dp-ext-goods");
    for (const item of shelf.items ?? []) {
      const row = el("div", "dp-ext-good");
      row.appendChild(el("span", "dp-ext-good-emoji", item.emoji));
      const copy = el("div", "dp-ext-good-copy");
      copy.appendChild(el("b", null, item.label));
      copy.appendChild(el("small", null, item.note));
      row.appendChild(copy);
      const hasPick = Array.isArray(item.pick);
      const buy = button("dp-mini", { "data-ext-buy": item.key }, function() {
        if (hasPick) {
          ui.drill.pick = ui.drill.pick === item.key ? null : item.key;
          ui.renderContent();
          return;
        }
        ui.send("ext", { key: shelf.extension, op: "buy", data: { item: item.key, pick: null } });
      });
      buy.textContent = item.price + " " + currency.emoji;
      buy.disabled = item.disabled === true;
      row.appendChild(buy);
      if (hasPick && ui.drill.pick === item.key) {
        const choices = el("div", "dp-ext-picks");
        for (const pick of item.pick) {
          const choose2 = button("dp-mini dp-mini-plain", { "data-ext-pick": pick.key }, function() {
            ui.drill.pick = null;
            ui.send("ext", { key: shelf.extension, op: "buy", data: { item: item.key, pick: pick.key } });
          });
          choose2.textContent = pick.emoji + " " + pick.label;
          choices.appendChild(choose2);
        }
        row.appendChild(choices);
      }
      list.appendChild(row);
    }
    ui.content.appendChild(list);
  }
  function itemTile(ui, item, color) {
    var owned = num(ui.view.inventory[item.key], 0);
    var note = item.price + " \u{1FA99}";
    if (item.owned) note = "\u5DF2\u62E5\u6709";
    else if (item.kind === "dress" && item.unlocked === false) note = "\u{1F512} Lv." + item.level;
    return tile({
      emoji: item.emoji,
      label: item.label,
      color,
      soft: true,
      note,
      badge: owned > 0 ? "\xD7" + owned : "",
      tag: item.needed ? "\u9700\u8981" : item.owned && item.worn ? "\u7A7F\u7740" : "",
      dim: !item.owned && (!item.affordable || item.kind === "dress" && item.unlocked === false),
      disabled: item.owned === true,
      data: { "data-buy": item.key },
      onPick: function() {
        ui.send("buy", { item: item.key });
      }
    });
  }

  // src/client/tabs/bag.js
  var CONSUMABLES = KIND_ORDER;
  var CARE_ACTION = { food: "feed", bath: "bathe", toy: "play" };
  var STAT_SHELVES = ["food", "bath", "toy", "medicine"];
  var EXTRA = {
    worn: { emoji: "\u{1F455}", label: "\u5DF2\u7A7F\u6234", color: "pink" },
    diary: { emoji: "\u{1F4D4}", label: "\u65E5\u8BB0", color: "brown" },
    souvenir: { emoji: "\u{1F381}", label: "\u7EAA\u5FF5\u54C1", color: "blue" },
    fish: { emoji: "\u{1F41F}", label: "\u9C7C\u7BD3", color: "teal" },
    wallet: { emoji: "\u{1F45B}", label: "\u94B1\u5305", color: "yellow" }
  };
  function shortDay(day) {
    return day.length >= 10 ? day.slice(5) : day;
  }
  function renderBagTab(ui) {
    var open = ui.drill.bag;
    if (open === "worn") renderWorn(ui);
    else if (open === "diary") renderDiary(ui);
    else if (open === "souvenir") renderSouvenirs(ui);
    else if (open === "fish") renderFish(ui);
    else if (open === "wallet") renderWallets(ui);
    else if (open !== null && CONSUMABLES.indexOf(open) >= 0) renderItems(ui, open);
    else renderCategories(ui);
  }
  function ownedOf(ui, kind) {
    var action = CARE_ACTION[kind];
    if (action !== void 0 && Array.isArray(ui.view.care[action]) && ui.view.care[action].length > 0) return ui.view.care[action];
    return ui.view.shop.filter(function(item) {
      return shelfOf(item.kind) === kind && num(ui.view.inventory[item.key], 0) > 0;
    });
  }
  function renderCategories(ui) {
    var grid = tileGrid();
    for (var k = 0; k < CONSUMABLES.length; k += 1) {
      (function(kind) {
        var items = ownedOf(ui, kind);
        var count = items.reduce(function(sum, item) {
          return sum + num(ui.view.inventory[item.key], 0);
        }, 0);
        var hasFree = items.some(function(item) {
          return item.default === true;
        });
        var parts = shelfParts(kind);
        grid.appendChild(tile({
          emoji: parts[0],
          label: parts[1],
          color: SHELF_COLOR[kind] ?? "blue",
          badge: count > 0 ? String(count) : "",
          dim: count === 0 && !hasFree,
          tag: items.some(function(item) {
            return item.needed;
          }) ? "\u9700\u8981" : "",
          data: { "data-bag": kind },
          onPick: function() {
            drillTo(ui, "bag", kind);
          }
        }));
      })(CONSUMABLES[k]);
    }
    var counts = {
      worn: ui.view.dress.filter(function(item) {
        return item.worn;
      }).length,
      diary: ui.view.diary.length,
      souvenir: ui.view.pig.souvenirs.length,
      fish: ui.view.fishing.bag.length,
      wallet: (ui.view.wallets || []).length
    };
    for (var key in EXTRA) {
      (function(category) {
        if ((category === "worn" || category === "wallet") && counts[category] === 0) return;
        var spec = EXTRA[category];
        grid.appendChild(tile({
          emoji: spec.emoji,
          label: spec.label,
          color: spec.color,
          badge: counts[category] > 0 ? String(counts[category]) : "",
          dim: counts[category] === 0,
          data: { "data-bag": category },
          onPick: function() {
            drillTo(ui, "bag", category);
          }
        }));
      })(key);
    }
    ui.content.appendChild(grid);
  }
  function renderWorn(ui) {
    var worn = ui.view.dress.filter(function(item) {
      return item.worn;
    });
    drillHeader(ui, "bag", "\u{1F455} \u5DF2\u7A7F\u6234", worn.length + " \u4EF6");
    if (worn.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u73B0\u5728\u6CA1\u6709\u7A7F\u6234\u88C5\u626E"));
      return;
    }
    for (var i = 0; i < worn.length; i += 1) {
      (function(item) {
        var row = el("div", "dp-item");
        row.appendChild(el("span", "dp-item-emoji", item.emoji));
        row.appendChild(el("span", "dp-grow", item.label + (item.slotLabel ? " \xB7 " + item.slotLabel : "")));
        var off = button("dp-mini", { "data-take-off": item.key }, function() {
          ui.send("wear", { item: item.key, on: false });
        });
        off.textContent = "\u8131\u4E0B";
        row.appendChild(off);
        ui.content.appendChild(row);
      })(worn[i]);
    }
  }
  function renderFish(ui) {
    const list = ui.view.fishing.bag;
    drillHeader(ui, "bag", "\u{1F41F} \u9C7C\u7BD3", list.length + " \u6761");
    if (list.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u9C7C\u7BD3\u8FD8\u662F\u7A7A\u7684"));
      return;
    }
    for (var i = 0; i < list.length; i += 1) {
      (function(fish3) {
        var card2 = el("div", "dp-pick dp-tile-card");
        card2.appendChild(el("div", "dp-pick-head", fish3.emoji + " " + fish3.label));
        card2.appendChild(el("div", null, fish3.sizeCm.toFixed(1) + " cm \xB7 \u{1FA99} " + fish3.price));
        var actions = el("div", "dp-dev-row");
        var feed = button("dp-mini", { "data-fish-feed": fish3.id }, function() {
          ui.send("fishFeed", { id: fish3.id });
        });
        feed.textContent = "\u{1F37D} \u5582";
        var sell = button("dp-mini", { "data-fish-sell": fish3.id }, function() {
          ui.send("fishSell", { id: fish3.id });
        });
        sell.textContent = "\u{1FA99} \u5356";
        actions.appendChild(feed);
        actions.appendChild(sell);
        card2.appendChild(actions);
        ui.content.appendChild(card2);
      })(list[i]);
    }
  }
  function renderItems(ui, kind) {
    var parts = shelfParts(kind);
    drillHeader(ui, "bag", parts[0] + " " + parts[1], "\u70B9\u4E00\u4E0B\u5C31\u7528");
    if (STAT_SHELVES.indexOf(kind) >= 0) statStrip(ui);
    var items = ownedOf(ui, kind);
    var action = CARE_ACTION[kind];
    if (items.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u7A7A\u7684"));
      if (action !== void 0) {
        var buy = button("dp-btn dp-btn-wide", { "data-bag-shop": kind }, function() {
          ui.select("shop");
          drillTo(ui, "shop", kind);
        });
        buy.textContent = "\u{1F6D2} \u53BB\u5546\u5E97\u4E70\u4E00\u70B9";
        ui.content.appendChild(buy);
      }
      return;
    }
    var grid = tileGrid();
    for (var i = 0; i < items.length; i += 1) {
      (function(item) {
        grid.appendChild(tile({
          emoji: item.emoji,
          label: item.label,
          color: SHELF_COLOR[kind] ?? "blue",
          soft: true,
          badge: item.default === true ? "\u514D\u8D39" : "\xD7" + num(ui.view.inventory[item.key], 0),
          tag: item.needed ? "\u9700\u8981" : "",
          note: action !== void 0 ? careEffectLine(action, item) : item.kind === "promotion" ? item.useLabel : "",
          data: { "data-use": item.key },
          // 照料货架发喂食 / 洗澡 / 玩耍本身（猪的动作和台词都对得上），其他货架照旧「使用」。
          onPick: function() {
            ui.send(action ?? "use", { item: item.key });
          }
        }));
      })(items[i]);
    }
    ui.content.appendChild(grid);
  }
  function renderDiary(ui) {
    drillHeader(ui, "bag", "\u{1F4D4} \u65E5\u8BB0", ui.view.diary.length + " \u7BC7");
    if (ui.view.diary.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD8\u6CA1\u6709\u65E5\u8BB0"));
      return;
    }
    var grid = tileGrid();
    var picked = null;
    for (var d = 0; d < ui.view.diary.length; d += 1) {
      (function(entry) {
        var active = ui.drill.pick === entry.day;
        if (active) picked = entry;
        grid.appendChild(tile({
          emoji: "\u{1F4D4}",
          label: shortDay(entry.day),
          color: EXTRA.diary.color,
          soft: true,
          active,
          data: { "data-diary": entry.day },
          onPick: function() {
            ui.drill.pick = active ? null : entry.day;
            ui.renderContent();
          }
        }));
      })(ui.view.diary[d]);
    }
    ui.content.appendChild(grid);
    if (picked !== null) {
      var page = el("div", "dp-pick dp-tile-card dp-diary-page");
      page.appendChild(el("div", "dp-pick-head", picked.day));
      page.appendChild(el("div", null, picked.text));
      ui.content.appendChild(page);
    }
  }
  function renderSouvenirs(ui) {
    var list = ui.view.pig.souvenirs;
    drillHeader(ui, "bag", "\u{1F381} \u7EAA\u5FF5\u54C1", list.length + " \u4EF6");
    if (list.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u6536\u85CF\u518C\u8FD8\u7A7A\u7740"));
      return;
    }
    var grid = tileGrid();
    var picked = null;
    for (var s = 0; s < list.length; s += 1) {
      (function(entry, index) {
        var id = entry.key + "#" + index;
        var active = ui.drill.pick === id;
        if (active) picked = entry;
        grid.appendChild(tile({
          emoji: entry.emoji,
          label: entry.label,
          color: EXTRA.souvenir.color,
          soft: true,
          active,
          note: entry.rarityEmoji + entry.rarityLabel,
          data: { "data-souvenir": id },
          onPick: function() {
            ui.drill.pick = active ? null : id;
            ui.renderContent();
          }
        }));
      })(list[s], s);
    }
    ui.content.appendChild(grid);
    if (picked === null) return;
    var story = el("div", "dp-pick dp-tile-card");
    story.appendChild(el("div", "dp-pick-head", picked.emoji + " " + picked.label + (picked.fromLabel === "" ? "" : " \xB7 " + picked.fromLabel)));
    story.appendChild(el("div", null, picked.story === "" ? "\uFF08\u65E7\u7248\u672C\u5E26\u56DE\u6765\u7684\uFF0C\u6CA1\u6709\u6545\u4E8B\uFF09" : "\u300C" + picked.story + "\u300D"));
    if (picked.price > 0) {
      var sold = picked;
      var sell = button("dp-mini", { "data-sell": sold.key }, function() {
        ui.drill.pick = null;
        ui.send("sell", { souvenir: sold.key });
      });
      sell.textContent = "\u5356\u6389 +" + sold.price + " \u{1FA99}";
      sell.style.marginTop = "6px";
      story.appendChild(sell);
    }
    ui.content.appendChild(story);
  }
  function renderWallets(ui) {
    var wallets = ui.view.wallets || [];
    drillHeader(ui, "bag", "\u{1F45B} \u94B1\u5305", "\u{1FA99} " + ui.view.pig.coins);
    if (wallets.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD8\u6CA1\u6709\u6269\u5C55\u5E01"));
      return;
    }
    for (var i = 0; i < wallets.length; i += 1) ui.content.appendChild(walletBar(ui, wallets[i], { open: true }));
    ui.content.appendChild(el("div", "dp-dim", "\u5220\u6389\u4E00\u4E2A\u6269\u5C55\u65F6\uFF0C\u5B83\u7684\u5E01\u4F1A\u6309\u6C47\u7387\u81EA\u52A8\u6362\u6210\u91D1\u5E01\u3002"));
  }

  // src/client/tabs/card.js
  var LIMITS = { catchphrase: 6, motto: 24, name: 16, owner: 12 };
  function renderCardTab(ui) {
    var p = ui.view.pig;
    var profile = ui.view.profile;
    if (p === null) return;
    if (profile === null) {
      ui.content.appendChild(el("div", "dp-empty", "\u91CD\u542F dsh \u4E4B\u540E\u624D\u6709\u5C45\u6C11\u5361"));
      return;
    }
    var card2 = el("div", "dp-vcard");
    card2.setAttribute("data-sex", p.sex !== null ? p.sex.key : "none");
    var top = el("div", "dp-vcard-top");
    var avatar = el("div", "dp-vcard-avatar");
    if (p.stage.art !== null) {
      var img = (
        /** @type {HTMLImageElement} */
        el("img", "dp-vcard-img")
      );
      img.src = artSource(p.stage.art);
      img.alt = "";
      avatar.appendChild(img);
    } else {
      avatar.appendChild(el("span", "dp-vcard-e", p.stage.emoji));
    }
    top.appendChild(avatar);
    var who = el("div", "dp-vcard-who");
    who.appendChild(nameLine(ui, p));
    who.appendChild(el("span", "dp-vcard-sub", "Lv." + p.level.level + " " + p.level.titleEmoji + p.level.titleLabel));
    who.appendChild(el("span", "dp-vcard-sub", p.stage.label));
    top.appendChild(who);
    card2.appendChild(top);
    card2.appendChild(field("\u751F\u65E5", profile.birthday));
    if (profile.zodiac !== null) card2.appendChild(field("\u661F\u5EA7", profile.zodiac.emoji + " " + profile.zodiac.label));
    if (profile.personality !== null) card2.appendChild(field("\u6027\u683C", profile.personality.emoji + " " + profile.personality.label));
    var forms = ui.view.forms;
    var worn = forms === null ? null : forms.forms.find(function(f) {
      return f.current;
    }) || null;
    if (worn !== null) card2.appendChild(field("\u5F62\u6001", worn.emoji + " " + worn.label));
    card2.appendChild(editableField(ui, "owner", "\u53EB\u4F60", ui.view.dialogue.ownerName));
    card2.appendChild(editableField(ui, "catchphrase", "\u53E3\u5934\u7985", profile.catchphrase));
    card2.appendChild(editableField(ui, "motto", "\u7B7E\u540D", profile.motto));
    var c = profile.counts;
    card2.appendChild(el(
      "div",
      "dp-vcard-foot",
      "\u517B\u4E86 " + c.days + " \u5929 \xB7 \u8BC1\u4E66 " + c.certificates + " \xB7 \u7EAA\u5FF5\u54C1 " + c.souvenirs + " \xB7 \u6BD5\u4E1A " + c.graduations
    ));
    ui.content.appendChild(card2);
  }
  function field(label, value) {
    var row = el("div", "dp-vcard-row");
    row.appendChild(el("span", "dp-vcard-label", label + "\uFF1A"));
    row.appendChild(el("span", "dp-vcard-value", value));
    return row;
  }
  function editableField(ui, key, label, value) {
    var editing = ui.cardEdit !== null && ui.cardEdit.field === key;
    var row = el("div", "dp-vcard-row" + (key === "motto" ? " dp-vcard-motto-row" : ""));
    row.appendChild(el("span", "dp-vcard-label", label + "\uFF1A"));
    if (editing) {
      appendEditor(ui, row, key);
      return row;
    }
    if (key === "owner") row.appendChild(el("span", "dp-vcard-value dp-dim", "\uFF08\u6084\u6084\u8BB0\u7740\uFF0C\u4E0D\u5199\u51FA\u6765\uFF09"));
    else row.appendChild(el("span", key === "motto" ? "dp-vcard-value dp-vcard-motto" : "dp-vcard-value", key === "motto" ? "\u300C" + value + "\u300D" : value));
    row.appendChild(pencil(ui, key, label, value, "dp-vcard-edit"));
    return row;
  }
  function nameLine(ui, p) {
    var line3 = el("div", "dp-vcard-nameline");
    if (ui.cardEdit !== null && ui.cardEdit.field === "name") {
      appendEditor(ui, line3, "name");
      return line3;
    }
    line3.appendChild(el("b", "dp-vcard-name", p.name + (p.sex !== null ? " " + p.sex.symbol : "")));
    line3.appendChild(pencil(ui, "name", "\u540D\u5B57", p.name, "dp-vcard-edit dp-vcard-name-edit"));
    return line3;
  }
  function pencil(ui, key, label, value, className) {
    var btn = button(className, { "data-card-edit": key }, function() {
      ui.cardEdit = { field: key, draft: value };
      ui.renderContent();
    });
    btn.textContent = "\u270F\uFE0F";
    btn.title = "\u6539" + label;
    return btn;
  }
  function appendEditor(ui, parent, key) {
    var input = (
      /** @type {HTMLInputElement} */
      el("input", "dp-input dp-vcard-input")
    );
    input.value = ui.cardEdit.draft;
    input.maxLength = LIMITS[key];
    input.setAttribute("data-card-input", key);
    input.addEventListener("input", function() {
      ui.cardEdit = { field: key, draft: input.value };
    });
    var save = button("dp-mini", { "data-card-save": key }, function() {
      var text = (ui.cardEdit === null ? "" : ui.cardEdit.draft).trim();
      ui.cardEdit = null;
      if (text !== "") ui.send(key, key === "name" || key === "owner" ? { name: text } : { text });
      ui.renderContent();
    });
    save.textContent = "\u597D";
    var cancel = button("dp-mini dp-mini-plain", { "data-card-cancel": key }, function() {
      ui.cardEdit = null;
      ui.renderContent();
    });
    cancel.textContent = "\u7B97\u4E86";
    parent.appendChild(input);
    parent.appendChild(save);
    parent.appendChild(cancel);
  }

  // src/client/tabs/achievements.js
  function renderAchievements(ui, entries2) {
    const selected = entries2.find((entry) => entry.key === ui.drill.pick);
    const earned = entries2.filter((entry) => entry.acquired).length;
    drillHeader(ui, "dex", "\u{1F3C6} \u5C0F\u732A\u6210\u5C31", earned + "/" + entries2.length);
    if (selected !== void 0) return renderAchievementDetail(ui, selected);
    ui.content.appendChild(el("div", "dp-ach-intro", "\u6BCF\u4E00\u679A\u5C0F\u732A\u5FBD\u7AE0\uFF0C\u90FD\u8BB0\u7740\u4E00\u6BB5\u4E00\u8D77\u7ECF\u5386\u7684\u65E5\u5E38\u3002"));
    for (const group of [...new Set(entries2.map((entry) => entry.group))]) {
      ui.content.appendChild(el("div", "dp-ach-group", group));
      const grid = el("div", "dp-ach-grid");
      for (const entry of entries2.filter((item) => item.group === group)) grid.appendChild(achievementCard(ui, entry));
      ui.content.appendChild(grid);
    }
  }
  function achievementCard(ui, entry) {
    const card2 = button("dp-ach-card", { "data-achievement": entry.key, "data-earned": String(entry.acquired) }, function() {
      ui.drill.pick = entry.key;
      ui.renderContent();
      ui.content.scrollTop = 0;
    });
    card2.appendChild(badge(entry));
    card2.appendChild(el("b", null, entry.label));
    card2.appendChild(el("small", null, entry.acquired ? "\u5DF2\u83B7\u5F97" : entry.progress + "/" + entry.target + " " + entry.unit));
    return card2;
  }
  function badge(entry) {
    const image = (
      /** @type {HTMLImageElement} */
      el("img", "dp-ach-badge")
    );
    image.src = artSource(entry.art);
    image.alt = entry.label + " \xB7 \u5C0F\u732A\u5FBD\u7AE0";
    return image;
  }
  function dateLabel(entry) {
    if (entry.recovered || entry.firstAt === null) return "\u65E7\u5B58\u6863\u8865\u5F55 \xB7 \u5B8C\u6210\u65E5\u671F\u672A\u77E5";
    return "\u83B7\u5F97\u4E8E " + new Date(entry.firstAt).toLocaleDateString("zh-CN");
  }
  function renderAchievementDetail(ui, entry) {
    const back = button("dp-ach-back", { "data-achievement-back": "true" }, function() {
      ui.drill.pick = null;
      ui.renderContent();
      ui.content.scrollTop = 0;
    });
    back.textContent = "\u2039 \u5168\u90E8\u6210\u5C31";
    ui.content.appendChild(back);
    const card2 = el("div", "dp-ach-detail");
    card2.setAttribute("data-earned", String(entry.acquired));
    card2.setAttribute("data-achievement-detail", entry.key);
    card2.appendChild(badge(entry));
    card2.appendChild(el("h3", null, entry.label));
    card2.appendChild(el("p", null, entry.description));
    card2.appendChild(el("b", null, entry.acquired ? "\u5DF2\u83B7\u5F97" : entry.progress + " / " + entry.target + " " + entry.unit));
    card2.appendChild(el("small", null, entry.acquired ? dateLabel(entry) : entry.availability === "update-required" ? "\u66F4\u65B0\u5BF9\u5E94\u6269\u5C55\u540E\u53EF\u8BB0\u5F55\u8FD9\u9879\u6210\u5C31" : entry.availability === "not-installed" ? "\u91CD\u65B0\u5B89\u88C5\u5BF9\u5E94\u6269\u5C55\u540E\u53EF\u7EE7\u7EED\u79EF\u7D2F" : entry.availability === "off" ? "\u542F\u7528\u5BF9\u5E94\u6269\u5C55\u540E\u53EF\u7EE7\u7EED\u79EF\u7D2F" : "\u89E3\u9501\u540E\u6C38\u4E45\u4FDD\u7559\u8FD9\u679A\u5C0F\u732A\u5FBD\u7AE0"));
    ui.content.appendChild(card2);
  }

  // src/client/tabs/dex-holo.js
  var stars = (count) => "\u2605".repeat(Math.max(0, Number(count) || 0));
  function card(entry, large, onPick) {
    const acquired = entry.acquired === true;
    const node = button("dp-holo" + (large ? " dp-holo-large" : ""), { "data-s": String(entry.stars), "data-missing": String(!acquired), "data-dex-entry": entry.key }, onPick);
    const face = el("span", "dp-holo-face");
    face.appendChild(el("span", "dp-holo-doll", entry.emoji));
    face.appendChild(el("b", "dp-holo-name", acquired ? entry.label : "\uFF1F\uFF1F\uFF1F"));
    face.appendChild(el("span", "dp-holo-stars", stars(entry.stars)));
    node.appendChild(face);
    if (acquired) tilt(node);
    return node;
  }
  function tilt(node) {
    node.addEventListener("pointermove", (event) => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      const box = node.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - box.left) / Math.max(1, box.width)));
      const y = Math.max(0, Math.min(1, (event.clientY - box.top) / Math.max(1, box.height)));
      node.style.setProperty("--rx", ((0.5 - y) * 10).toFixed(1) + "deg");
      node.style.setProperty("--ry", ((x - 0.5) * 14).toFixed(1) + "deg");
      node.style.setProperty("--hx", Math.round(x * 100) + "%");
      node.style.setProperty("--hy", Math.round(y * 100) + "%");
    });
    node.addEventListener("pointerleave", () => {
      for (const name of ["--rx", "--ry", "--hx", "--hy"]) node.style.removeProperty(name);
    });
  }
  function renderHoloSection(ui, section2) {
    const entries2 = section2.entries ?? [];
    const chosen = entries2.find((entry) => entry.key === ui.drill.pick);
    const title = section2.emoji + " " + section2.label;
    if (chosen) {
      drillHeader(ui, "dex", title, chosen.acquired ? "\u5DF2\u6536\u5F55" : "\u672A\u89E3\u9501");
      const back = button("dp-mini dp-mini-plain", { "data-dex-detail-back": section2.key }, () => {
        ui.drill.pick = null;
        ui.renderContent();
      });
      back.textContent = "\u2039 \u8FD4\u56DE\u6446\u4EF6\u5899";
      ui.content.appendChild(back);
      const detail = el("div", "dp-holo-detail");
      detail.setAttribute("data-dex-detail", chosen.key);
      detail.appendChild(card(chosen, true, () => {
      }));
      const copy = el("div", "dp-holo-copy");
      copy.appendChild(el("b", null, chosen.acquired ? chosen.label : "\uFF1F\uFF1F\uFF1F"));
      copy.appendChild(el("span", "dp-holo-rating", stars(chosen.stars)));
      const potential = el("div", "dp-holo-potential");
      for (let i = 1; i <= 6; i += 1) {
        const cell = el("i");
        cell.setAttribute("data-on", String(chosen.acquired && i <= chosen.potential));
        potential.appendChild(cell);
      }
      copy.appendChild(potential);
      copy.appendChild(el("p", null, chosen.acquired ? chosen.blurb : "\u8FD8\u6CA1\u6709\u5BFB\u8BBF\u5230\u3002"));
      detail.appendChild(copy);
      ui.content.appendChild(detail);
    } else drillHeader(ui, "dex", title, entries2.filter((entry) => entry.acquired).length + "/" + entries2.length);
    for (const rarity of [6, 5, 4, 3]) {
      const list = entries2.filter((entry) => entry.stars === rarity);
      if (list.length === 0) continue;
      ui.content.appendChild(el("h4", "dp-holo-tier", rarity + " \u661F " + stars(rarity)));
      const grid = el("div", "dp-holo-grid");
      for (const entry of list) grid.appendChild(card(entry, false, () => {
        ui.drill.pick = entry.key;
        ui.renderContent();
        ui.content.scrollTop = 0;
      }));
      ui.content.appendChild(grid);
    }
  }

  // src/client/tabs/dex.js
  var SECTIONS = [];
  var ITEM_KINDS = [
    ["all", "\u5168\u90E8"],
    ["food", "\u98DF\u7269"],
    ["bath", "\u6D17\u6D74"],
    ["toy", "\u73A9\u5177"],
    ["medicine", "\u836F\u54C1"],
    ["promotion", "\u664B\u5347"],
    ["dress", "\u88C5\u626E"]
  ];
  function registerDexSection(section2) {
    if (section2 === null || typeof section2 !== "object" || typeof section2.key !== "string") return;
    const index = SECTIONS.findIndex((entry) => entry.key === section2.key);
    if (index >= 0) SECTIONS[index] = section2;
    else SECTIONS.push(section2);
  }
  for (const section2 of [
    { key: "achievements", label: "\u6210\u5C31", emoji: "\u{1F3C6}", color: "teal" },
    { key: "forms", label: "\u5F62\u6001", emoji: "\u{1F437}", color: "pink" },
    { key: "skins", label: "\u76AE\u80A4", emoji: "\u{1F3A8}", color: "purple" },
    { key: "fish", label: "\u9C7C\u7C7B", emoji: "\u{1F41F}", color: "blue" },
    { key: "items", label: "\u9053\u5177", emoji: "\u{1F392}", color: "orange" },
    { key: "souvenirs", label: "\u7EAA\u5FF5\u54C1", emoji: "\u{1F9F3}", color: "teal" }
  ]) registerDexSection(section2);
  function renderDexTab(ui) {
    const picked = ui.drill.dex;
    if (picked === null) return renderSections(ui);
    const ext = (ui.view.extDex ?? []).find((entry) => picked === "ext:" + entry.extension + ":" + entry.key);
    if (ext && ext.style === "holo") {
      renderHoloSection(ui, ext);
      return;
    }
    if (ext) {
      renderExtPlain(ui, ext);
      return;
    }
    const section2 = SECTIONS.find((entry) => entry.key === picked);
    if (section2 === void 0) return drillTo(ui, "dex", null);
    const entries2 = ui.view.dex[section2.key] ?? [];
    if (section2.key === "achievements") return renderAchievements(ui, entries2);
    const detail = entries2.find((entry) => entry.key === ui.drill.pick);
    if (detail !== void 0) return renderDetail(ui, section2, detail);
    renderEntries(ui, section2, entries2);
  }
  function renderExtPlain(ui, ext) {
    const section2 = { key: "ext:" + ext.extension + ":" + ext.key, label: ext.label, emoji: ext.emoji };
    const entries2 = (ext.entries ?? []).map((entry) => ({
      key: entry.key,
      emoji: entry.emoji,
      label: entry.label,
      acquired: entry.acquired === true,
      description: entry.blurb,
      foot: ""
    }));
    const detail = entries2.find((entry) => entry.key === ui.drill.pick);
    if (detail !== void 0) return renderDetail(ui, section2, detail);
    renderEntries(ui, section2, entries2);
  }
  function renderSections(ui) {
    const grid = tileGrid();
    grid.className += " dp-dex-sections";
    const off = offParts(ui.view).dexSections;
    for (const section2 of SECTIONS) {
      if (off.has(section2.key)) continue;
      const entries2 = ui.view.dex[section2.key] ?? [];
      const got = entries2.filter((entry) => entry.acquired).length;
      const node = tile({
        emoji: section2.emoji,
        label: section2.label,
        color: section2.color,
        note: entries2.length === 0 ? "\u7B49\u5F85\u6536\u5F55" : got + "/" + entries2.length,
        data: { "data-dex-section": section2.key },
        onPick: function() {
          drillTo(ui, "dex", section2.key);
        }
      });
      const progress = el("span", "dp-dex-progress");
      const fill = el("i");
      fill.style.width = (entries2.length === 0 ? 0 : Math.round(got / entries2.length * 100)) + "%";
      progress.appendChild(fill);
      node.appendChild(progress);
      grid.appendChild(node);
    }
    for (const section2 of ui.view.extDex ?? []) {
      const entries2 = section2.entries ?? [];
      const got = entries2.filter((entry) => entry.acquired).length;
      const key = "ext:" + section2.extension + ":" + section2.key;
      const node = tile({
        emoji: section2.emoji,
        label: section2.label,
        color: section2.color || "orange",
        note: got + "/" + entries2.length,
        data: { "data-dex-section": key },
        onPick: function() {
          drillTo(ui, "dex", key);
        }
      });
      const progress = el("span", "dp-dex-progress");
      const fill = el("i");
      fill.style.width = (entries2.length === 0 ? 0 : Math.round(got / entries2.length * 100)) + "%";
      progress.appendChild(fill);
      node.appendChild(progress);
      grid.appendChild(node);
    }
    ui.content.appendChild(grid);
  }
  function renderEntries(ui, section2, entries2) {
    const acquired = entries2.filter((entry) => entry.acquired).length;
    drillHeader(ui, "dex", section2.emoji + " " + section2.label, acquired + "/" + entries2.length);
    if (entries2.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD9\u4E00\u9875\u8FD8\u6CA1\u6709\u6536\u5F55\u5185\u5BB9"));
      return;
    }
    if (section2.key === "forms" || section2.key === "skins") renderFlashShelf(ui, section2, entries2);
    else if (section2.key === "items") renderCatalogue(ui, entries2);
    else renderMuseum(ui, section2, entries2);
  }
  function renderFlashShelf(ui, section2, entries2) {
    const grid = el("div", "dp-dex-flash-grid");
    for (const entry of entries2) grid.appendChild(flashCard(ui, section2, entry));
    ui.content.appendChild(grid);
  }
  function flashCard(ui, section2, entry) {
    const classes = ["dp-dex-card"];
    if (entry.acquired) classes.push("dp-dex-card-foil");
    else classes.push("dp-dex-card-locked");
    const card2 = button(classes.join(" "), { "data-dex-entry": entry.key }, function() {
      openDetail(ui, entry.key);
    });
    const art = el("span", "dp-dex-artbox");
    appendArt(art, entry, true);
    if (!entry.acquired) art.appendChild(el("span", "dp-dex-lock", "\u{1F512}"));
    card2.appendChild(art);
    card2.appendChild(el("span", "dp-dex-caption", entry.acquired ? entry.label : "\u672A\u77E5" + section2.label));
    if (entry.acquired) tilt2(card2);
    return card2;
  }
  function renderMuseum(ui, section2, entries2) {
    const grid = el("div", "dp-dex-museum");
    for (const entry of entries2) {
      const card2 = button(
        "dp-dex-museum-item" + (entry.acquired ? "" : " dp-dex-museum-locked"),
        { "data-dex-entry": entry.key },
        function() {
          openDetail(ui, entry.key);
        }
      );
      const art = el("span", "dp-dex-museum-art");
      appendArt(art, entry, false);
      if (!entry.acquired) art.appendChild(el("span", "dp-dex-museum-lock", "\u{1F512}"));
      card2.appendChild(art);
      card2.appendChild(el("span", "dp-dex-museum-name", entry.acquired ? entry.label : "\u672A\u77E5" + section2.label));
      grid.appendChild(card2);
    }
    ui.content.appendChild(grid);
  }
  function renderCatalogue(ui, entries2) {
    const controls = el("div", "dp-dex-catalog-tools");
    const search = (
      /** @type {HTMLInputElement} */
      el("input", "dp-input dp-dex-search")
    );
    search.type = "search";
    search.placeholder = "\u641C\u7D22\u5DF2\u53D1\u73B0\u7684\u9053\u5177";
    search.value = ui.drill.dexQuery ?? "";
    search.setAttribute("data-dex-search", "items");
    controls.appendChild(search);
    const filters = el("div", "dp-dex-filters");
    const active = ui.drill.dexFilter ?? "all";
    const available = new Set(entries2.map((entry) => shelfOf(entry.kind)));
    for (const [key, label] of ITEM_KINDS) {
      if (key !== "all" && !available.has(key)) continue;
      const filter = button("dp-dex-filter", { "data-dex-filter": key }, function() {
        ui.drill.dexFilter = key;
        ui.drill.pick = null;
        ui.renderContent();
      });
      filter.textContent = label;
      filter.setAttribute("data-active", active === key ? "true" : "false");
      filters.appendChild(filter);
    }
    controls.appendChild(filters);
    ui.content.appendChild(controls);
    sideScroller(filters, filters.querySelector ? filters.querySelector('[data-active="true"]') : null);
    const query = String(ui.drill.dexQuery ?? "").trim().toLowerCase();
    const list = el("div", "dp-dex-catalog");
    for (const entry of entries2) {
      if (active !== "all" && shelfOf(entry.kind) !== active) continue;
      const searchable = entry.acquired ? entry.label.toLowerCase() : ("\u672A\u77E5" + entry.kindLabel).toLowerCase();
      if (query !== "" && !searchable.includes(query)) continue;
      list.appendChild(catalogueRow(ui, entry));
    }
    ui.content.appendChild(list);
    search.addEventListener("input", function() {
      ui.drill.dexQuery = search.value;
      const needle = search.value.trim().toLowerCase();
      for (const row of list.children) {
        const hidden = needle !== "" && !String(row.getAttribute("data-search-text") ?? "").includes(needle);
        if (hidden) row.setAttribute("data-search-hidden", "true");
        else row.removeAttribute("data-search-hidden");
      }
    });
  }
  function catalogueRow(ui, entry) {
    const row = button(
      "dp-dex-row" + (entry.acquired ? "" : " dp-dex-row-locked"),
      { "data-dex-entry": entry.key, "data-search-text": entry.acquired ? entry.label.toLowerCase() : ("\u672A\u77E5" + entry.kindLabel).toLowerCase() },
      function() {
        openDetail(ui, entry.key);
      }
    );
    row.appendChild(el("span", "dp-dex-row-emoji", entry.acquired ? entry.emoji : "\u25C6"));
    const copy = el("span", "dp-dex-row-text");
    copy.appendChild(el("b", null, entry.acquired ? entry.label : "\u672A\u77E5\u9053\u5177"));
    copy.appendChild(el("small", null, entry.kindLabel || "\u5176\u4ED6"));
    row.appendChild(copy);
    row.appendChild(el("span", "dp-dex-row-count", entry.acquired ? "\xD7" + entry.count : "\u{1F512}"));
    return row;
  }
  function renderDetail(ui, section2, entry) {
    const header = el("div", "dp-drill");
    const back = button("dp-drill-back", { "data-dex-detail-back": section2.key }, function() {
      ui.drill.pick = null;
      ui.renderContent();
      ui.content.scrollTop = 0;
    });
    back.textContent = "\u2039";
    header.appendChild(back);
    header.appendChild(el("b", "dp-drill-title", section2.emoji + " " + section2.label));
    header.appendChild(el("span", "dp-drill-info", entry.acquired ? "\u5DF2\u6536\u5F55" : "\u672A\u89E3\u9501"));
    ui.content.appendChild(header);
    const flash = section2.key === "forms" || section2.key === "skins";
    const wrap = el("div", "dp-dex-detail");
    wrap.setAttribute("data-dex-detail", entry.key);
    const card2 = el("div", flash ? "dp-dex-big" + (entry.acquired ? " dp-dex-big-foil" : " dp-dex-big-locked") : "dp-dex-info" + (entry.acquired ? "" : " dp-dex-info-locked"));
    const art = el("div", flash ? "dp-dex-big-art" : "dp-dex-info-art");
    appendArt(art, entry, flash);
    if (!entry.acquired) art.appendChild(el("span", "dp-dex-lock", "\u{1F512}"));
    card2.appendChild(art);
    card2.appendChild(el("div", "dp-dex-big-title", entry.acquired ? entry.emoji + " " + entry.label : "\u{1F512} \u672A\u77E5" + section2.label));
    if (entry.acquired) {
      card2.appendChild(el("div", "dp-dex-story", entry.description || "\u8FD9\u6BB5\u6545\u4E8B\u8FD8\u6CA1\u6709\u5199\u8FDB\u56FE\u9274\u3002"));
      if (typeof entry.foot === "string") {
        if (entry.foot) card2.appendChild(el("div", "dp-dex-foot", entry.foot));
      } else card2.appendChild(el("div", "dp-dex-foot", firstSeen(entry.firstAt) + " \xB7 \u83B7\u5F97 " + entry.count + " \u6B21" + (typeof entry.maxSizeCm === "number" ? " \xB7 \u6700\u5927 " + entry.maxSizeCm.toFixed(1) + " cm" : "")));
      if (section2.key === "skins") {
        const current = ui.view.skins.current === entry.key;
        const pick = button("dp-mini", { "data-dex-skin": entry.key }, function() {
          ui.send("skin", { skin: entry.key });
        });
        pick.textContent = current ? "\u4F7F\u7528\u4E2D" : "\u4F7F\u7528\u8FD9\u6B3E\u76AE\u80A4";
        pick.disabled = current;
        const action = el("div", "dp-dex-skin-action");
        action.appendChild(pick);
        card2.appendChild(action);
      }
    } else {
      const riddle = el("div", "dp-dex-riddle");
      riddle.appendChild(el("b", null, "\u89E3\u9501\u8C1C\u9762"));
      riddle.appendChild(el("span", null, entry.hint || "\u5B83\u85CF\u5728\u4E00\u6B21\u5C1A\u672A\u542F\u7A0B\u7684\u76F8\u9047\u91CC\u3002"));
      card2.appendChild(riddle);
    }
    wrap.appendChild(card2);
    ui.content.appendChild(wrap);
    if (flash && entry.acquired) tilt2(card2);
  }
  function openDetail(ui, key) {
    ui.drill.pick = key;
    ui.renderContent();
    ui.content.scrollTop = 0;
  }
  function appendArt(parent, entry, large) {
    if (entry.art) {
      const img = (
        /** @type {HTMLImageElement} */
        el("img", "dp-dex-art")
      );
      img.src = artSource(entry.art);
      img.alt = entry.acquired ? entry.label : "";
      parent.appendChild(img);
    } else {
      parent.appendChild(el("span", large ? "dp-dex-emoji dp-dex-emoji-large" : "dp-dex-emoji", entry.emoji));
    }
  }
  function firstSeen(value) {
    if (typeof value !== "number") return "\u9996\u6B21\u53D1\u73B0\u65F6\u95F4\u672A\u77E5";
    return "\u9996\u6B21\u53D1\u73B0 " + new Date(value).toLocaleDateString("zh-CN");
  }
  function tilt2(node) {
    node.addEventListener("pointermove", function(event) {
      const box = node.getBoundingClientRect();
      const x = ((event.clientX ?? box.left + box.width / 2) - box.left) / Math.max(1, box.width) - 0.5;
      const y = ((event.clientY ?? box.top + box.height / 2) - box.top) / Math.max(1, box.height) - 0.5;
      node.style.setProperty("--dex-rx", (-y * 5).toFixed(2) + "deg");
      node.style.setProperty("--dex-ry", (x * 7).toFixed(2) + "deg");
    });
    node.addEventListener("pointerleave", function() {
      node.style.removeProperty("--dex-rx");
      node.style.removeProperty("--dex-ry");
    });
  }

  // src/client/icon-style.js
  var BUNDLED = /* @__PURE__ */ new Set([
    "status",
    "card",
    "dex",
    "skins",
    "study",
    "work",
    "shop",
    "travel",
    "bag",
    "pomodoro",
    "fishing",
    "settings",
    "update",
    "quit",
    "dev"
  ]);
  function iconStyle() {
    return "system";
  }
  function appIcon(key, emoji, className) {
    if (iconStyle() !== "built-in" || !BUNDLED.has(key)) return el("span", className, emoji);
    const img = (
      /** @type {HTMLImageElement} */
      el("img", className + " dp-tile-svg")
    );
    img.src = ART_URL + "ui-" + key + ".svg";
    img.alt = emoji;
    img.addEventListener("error", function() {
      const replacement = el("span", className, emoji);
      img.parentNode?.replaceChild(replacement, img);
    });
    return img;
  }

  // src/client/ext-apps.js
  var registry = {};
  var requested = {};
  var rerender = null;
  function bridge() {
    var host3 = (
      /** @type {any} */
      window
    );
    if (!host3.dshPiggyExtensions) {
      host3.dshPiggyExtensions = {
        register: function(key, impl) {
          if (typeof key !== "string" || impl === null || typeof impl !== "object") return;
          registry[key] = impl;
          if (typeof rerender === "function") rerender();
        }
      };
    }
    return host3.dshPiggyExtensions;
  }
  function ensureScript(key, version) {
    bridge();
    var id = key + "@" + version;
    if (requested[id] || typeof document === "undefined" || typeof document.createElement !== "function") return;
    requested[id] = true;
    var script = (
      /** @type {HTMLScriptElement} */
      document.createElement("script")
    );
    script.src = "/dsh-piggy/ext/" + encodeURIComponent(key) + "/client.js?v=" + encodeURIComponent(version);
    script.async = true;
    (document.head || document.body)?.appendChild(script);
  }
  function renderDownloadedApp(ui, key) {
    var extension = (ui.view.extensions || []).find(function(entry) {
      return entry.key === key;
    });
    if (!extension) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD9\u4E2A\u6269\u5C55\u5DF2\u7ECF\u5220\u6389\u4E86"));
      return;
    }
    if (extension.error) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD9\u4E2A\u6269\u5C55\u51FA\u9519\u4E86\uFF1A" + extension.error));
      return;
    }
    ensureScript(key, extension.version);
    rerender = function() {
      if (ui.tab === "ext:" + key) ui.renderContent();
    };
    var impl = registry[key];
    if (!impl || typeof impl.render !== "function") {
      ui.content.appendChild(el("div", "dp-empty", "\u6B63\u5728\u52A0\u8F7D\u2026\u2026"));
      return;
    }
    var data = ui.view.extViews ? ui.view.extViews[key] : void 0;
    var wallet = (ui.view.wallets || []).find(function(entry) {
      return entry.key === key;
    });
    if (wallet) ui.content.appendChild(walletBar(ui, wallet));
    try {
      impl.render({
        content: ui.content,
        data: data === void 0 ? null : data,
        send: function(op, payload) {
          ui.send("ext", { key, op, data: payload || {} });
        },
        el,
        button,
        rerender: function() {
          ui.renderContent();
        },
        openDex: function(section2) {
          ui.select("dex");
          ui.drill.dex = "ext:" + key + ":" + section2;
          ui.renderContent();
        },
        // 跳到商店里这个扩展的货架（比如菜园缺种子 → 种子货架），按返回回到扩展页（用户 2026-10-09）。
        openShop: function() {
          ui.select("shop");
          ui.drill.shop = "ext:" + key;
          ui.drill.from = "ext:" + key;
          ui.renderContent();
        }
      });
    } catch (error) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD9\u4E2A\u6269\u5C55\u51FA\u9519\u4E86\uFF1A" + (error instanceof Error ? error.message : String(error))));
    }
  }

  // src/client/ext-import.js
  var NAMES = ["manifest.json", "server.js", "client.js"];
  var pending = null;
  var busy = false;
  async function bundleOf(files) {
    if (files.length === 1) return files[0].text();
    const texts = {};
    for (const file of files) if (NAMES.includes(file.name)) texts[file.name] = await file.text();
    if (!NAMES.every((name) => typeof texts[name] === "string")) return null;
    let key = "";
    try {
      key = str(obj(JSON.parse(texts["manifest.json"])).key, "");
    } catch {
      return null;
    }
    return JSON.stringify({ format: "dsh-piggy-extension", version: 1, key, files: texts });
  }
  function base64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 32768)));
    return btoa(binary);
  }
  var REASONS = {
    "invalid-bundle": "\u8BFB\u4E0D\u61C2\u8FD9\u4E2A\u6587\u4EF6",
    "game-too-old": "\u8FD9\u4E2A\u6269\u5C55\u8981\u66F4\u65B0\u7684\u6E38\u620F",
    "too-large": "\u6269\u5C55\u5305\u592A\u5927",
    "broken-extension": "\u6269\u5C55\u88C5\u4E0A\u4E86\u4F46\u52A0\u8F7D\u51FA\u9519",
    "download-failed": "\u6CA1\u80FD\u5199\u8FDB\u6269\u5C55\u76EE\u5F55",
    absent: "\u8FD8\u6CA1\u6709\u732A"
  };
  function send(ui, bundle, confirm) {
    busy = true;
    ui.renderContent();
    fetch("/dsh-piggy/extensions/import", { method: "POST", headers: { "content-type": "text/plain" }, body: base64(JSON.stringify({ bundle, confirm })) }).then((response) => response.json()).then((data) => {
      busy = false;
      const result = obj(data);
      if (result.ok === true) {
        pending = null;
        if (typeof ui.render === "function") ui.render(result);
        else {
          ui.view = result;
          ui.renderContent();
        }
        ui.showBubble("\u88C5\u597D\u4E86\uFF1A" + str(result.label, "\u6269\u5C55") + (result.official === true ? "" : "\uFF08\u672C\u5730\u5BFC\u5165\uFF09"));
        return;
      }
      if (result.reason === "unofficial") {
        pending = { bundle, label: str(result.label, str(result.key, "\u6269\u5C55")), version: str(result.version, "") };
        ui.renderContent();
        return;
      }
      pending = null;
      ui.renderContent();
      const why = REASONS[str(result.reason, "")] ?? "\u5BFC\u5165\u5931\u8D25";
      ui.showBubble(why + (result.need ? "\uFF08\u8981\u6E38\u620F v" + str(result.need, "") + "\uFF09" : "") + (result.message ? "\uFF1A" + str(result.message, "") : ""));
    }).catch(() => {
      busy = false;
      ui.renderContent();
      ui.showBubble("\u5BFC\u5165\u5931\u8D25\uFF1A\u6CA1\u80FD\u9001\u5230\u5BBF\u4E3B");
    });
  }
  function importCard(ui) {
    const card2 = el("div", "dp-set dp-ext-card dp-ext-import");
    const head = el("div", "dp-set-head");
    head.appendChild(el("span", "dp-ext-emoji", "\u{1F4E6}"));
    head.appendChild(el("b", null, "\u4ECE\u6587\u4EF6\u5BFC\u5165"));
    head.appendChild(el("small", "dp-dim", "\u4E0B\u8F7D\u4E0D\u4E86\u65F6\uFF0C\u7528\u522B\u5904\u62FF\u5230\u7684\u6269\u5C55\u5305\uFF08.piggyext\uFF09\uFF0C\u6216\u4E00\u8D77\u9009\u4E2D\u6269\u5C55\u7684\u4E09\u4E2A\u6587\u4EF6\u3002"));
    card2.appendChild(head);
    if (pending !== null) {
      const ask = pending;
      card2.appendChild(el("div", "dp-ext-note dp-ext-warn", "\u300C" + ask.label + (ask.version ? " " + ask.version : "") + "\u300D\u4E0D\u662F\u5B98\u65B9\u6269\u5C55\u3002\u6269\u5C55\u91CC\u7684\u4EE3\u7801\u5728\u6E38\u620F\u91CC\u4EC0\u4E48\u90FD\u80FD\u505A\uFF0C\u53EA\u88C5\u4F60\u4FE1\u5F97\u8FC7\u7684\u4EBA\u7ED9\u7684\u3002"));
      const row = el("div", "dp-ext-actions");
      const yes = button("dp-mini dp-ext-danger", { "data-ext-import-confirm": "true" }, () => send(ui, ask.bundle, true));
      yes.textContent = busy ? "\u5BFC\u5165\u4E2D\u2026" : "\u4ECD\u8981\u5BFC\u5165";
      yes.disabled = busy;
      const no = button("dp-mini dp-mini-plain", { "data-ext-import-cancel": "true" }, () => {
        pending = null;
        ui.renderContent();
      });
      no.textContent = "\u7B97\u4E86";
      row.appendChild(yes);
      row.appendChild(no);
      card2.appendChild(row);
      return card2;
    }
    const pick = el("label", "dp-mini dp-ext-import-pick");
    pick.appendChild(el("span", null, busy ? "\u5BFC\u5165\u4E2D\u2026" : "\u9009\u62E9\u6587\u4EF6"));
    const input = (
      /** @type {HTMLInputElement} */
      el("input")
    );
    input.type = "file";
    input.multiple = true;
    input.setAttribute("accept", ".piggyext,.json,.js");
    input.setAttribute("data-ext-import", "file");
    input.disabled = busy;
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      bundleOf(files).then((bundle) => {
        if (bundle === null) {
          ui.showBubble("\u8981\u9009\u4E00\u4E2A .piggyext\uFF0C\u6216\u8005 manifest.json\u3001server.js\u3001client.js \u4E09\u4E2A\u4E00\u8D77\u9009");
          return;
        }
        send(ui, bundle, false);
      }).catch(() => ui.showBubble("\u8BFB\u4E0D\u4E86\u8FD9\u4E2A\u6587\u4EF6"));
    });
    pick.appendChild(input);
    card2.appendChild(pick);
    return card2;
  }

  // src/client/tabs/extensions.js
  var confirming = null;
  var online = { loading: false, loaded: false, error: "", entries: (
    /** @type {any[]} */
    []
  ), stamp: "" };
  var download = { key: "", failed: "", error: "" };
  function startInstall(ui, key) {
    if (download.key !== "") return;
    download = { key, failed: "", error: "" };
    ui.renderContent();
    Promise.resolve(ui.send("installExtension", { key })).then(function(result) {
      if (download.key !== key) return;
      if (result !== null && result !== void 0 && result.ok === false) {
        download = { key: "", failed: key, error: str(result.message, "") || "\u4E0B\u8F7D\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5" };
      } else if (result === null || result === void 0) {
        download = { key: "", failed: key, error: "\u521A\u624D\u6CA1\u80FD\u9001\u5230\u5BBF\u4E3B\uFF0C\u518D\u70B9\u4E00\u6B21" };
      } else {
        download = { key: "", failed: "", error: "" };
      }
      online.loaded = false;
      ui.renderContent();
    });
  }
  function stampOf(view) {
    return view.extensions.map(function(extension) {
      return extension.key + "@" + extension.version + ":" + extension.installed;
    }).join(",");
  }
  function closingNote(view, key) {
    if (key === "pomodoro" && view.pomodoro !== null && view.pomodoro.active) return "\u6B63\u5728\u4E13\u6CE8\uFF1A\u5173\u6389\u4F1A\u653E\u5F03\u8FD9\u4E00\u4E2A\uFF0C\u4E0D\u7ED9\u5956\u52B1";
    if (key === "fishing" && view.activity?.kind === "fishing") return "\u732A\u6B63\u5728\u5916\u9762\u9493\u9C7C\uFF1A\u5173\u6389\u4F1A\u628A\u5B83\u53EB\u56DE\u6765\uFF0C\u9C7C\u9975\u9000\u56DE";
    return "";
  }
  var CLEARS = { pomodoro: "\u4ECA\u5929\u548C\u7D2F\u8BA1\u7684\u756A\u8304\u6570", fishing: "\u9C7C\u7BD3\u91CC\u7684\u9C7C\u3001\u56FE\u9274\u91CC\u7684\u9C7C\u3001\u80CC\u5305\u91CC\u7684\u9C7C\u9975" };
  function loadOnline(ui, force) {
    if (online.loading || typeof fetch !== "function") return;
    online.loading = true;
    fetch("/dsh-piggy/extensions/online" + (force ? "?force=1" : ""), { cache: "no-store" }).then(function(response) {
      return response.json();
    }).then(function(data) {
      var body = obj(data);
      online = { loading: false, loaded: true, error: str(body.error, ""), entries: arr(body.entries).filter(function(entry) {
        return typeof obj(entry).key === "string";
      }), stamp: stampOf(ui.view) };
    }).catch(function() {
      online = { loading: false, loaded: true, error: "\u8FDE\u4E0D\u4E0A", entries: online.entries, stamp: stampOf(ui.view) };
    }).then(function() {
      if (["home", "settings", "extensions"].includes(ui.tab)) ui.renderContent();
    });
  }
  var downloading = (key) => download.key === key;
  function installLabel(key, normal) {
    if (downloading(key)) return "\u4E0B\u8F7D\u4E2D\u2026";
    return download.failed === key ? "\u91CD\u8BD5" : normal;
  }
  function extensionUpdateAvailable(ui) {
    if (!online.loaded || online.stamp !== stampOf(ui.view)) loadOnline(ui, false);
    return online.loaded && online.stamp === stampOf(ui.view) && online.entries.some(function(entry) {
      return entry.update === true && ui.view.extensions.some(function(extension) {
        return extension.key === entry.key && extension.installed;
      });
    });
  }
  function renderExtensionsTab(ui) {
    if (String(ui.tab).startsWith("ext:")) {
      renderDownloadedApp(ui, String(ui.tab).slice(4));
      return;
    }
    if (!online.loaded || online.stamp !== stampOf(ui.view)) loadOnline(ui, false);
    ui.content.appendChild(el("div", "dp-ext-intro", "\u7528\u4E0D\u4E0A\u7684\u73A9\u6CD5\u53EF\u4EE5\u5173\u6389\uFF0C\u6570\u636E\u7559\u7740\u968F\u65F6\u6062\u590D\uFF1B\u5220\u9664\u4F1A\u8FDE\u6570\u636E\u4E00\u8D77\u6E05\u6389\uFF0C\u4EE5\u540E\u53EF\u4EE5\u5728\u4E0B\u9762\u91CD\u65B0\u88C5\u3002"));
    ui.content.appendChild(el("div", "dp-ext-section", "\u672C\u5730\u6269\u5C55"));
    var local = ui.view.extensions.filter(function(extension) {
      return extension.installed;
    });
    if (local.length === 0) ui.content.appendChild(el("div", "dp-ext-later", "\u4E00\u4E2A\u6269\u5C55\u90FD\u6CA1\u88C5"));
    for (var i = 0; i < local.length; i += 1) ui.content.appendChild(localCard(ui, local[i]));
    ui.content.appendChild(importCard(ui));
    var head = el("div", "dp-ext-section dp-ext-online-head");
    head.appendChild(el("span", null, "\u5728\u7EBF\u6269\u5C55"));
    var refresh2 = button("dp-mini dp-mini-plain", { "data-ext-refresh": "true" }, function() {
      loadOnline(ui, true);
      ui.renderContent();
    });
    refresh2.textContent = online.loading ? "\u8BFB\u53D6\u4E2D\u2026" : "\u{1F504} \u5237\u65B0";
    refresh2.disabled = online.loading;
    head.appendChild(refresh2);
    ui.content.appendChild(head);
    renderOnline(ui);
  }
  function localCard(ui, extension) {
    var card2 = el("div", "dp-set dp-ext-card");
    card2.setAttribute("data-extension", extension.key);
    var head = el("div", "dp-set-head");
    head.appendChild(el("span", "dp-ext-emoji", extension.emoji));
    head.appendChild(el("b", null, extension.label + (extension.builtin ? "" : " " + extension.version) + (extension.local ? " \xB7 \u672C\u5730\u5BFC\u5165" : "")));
    if (extension.description) head.appendChild(el("small", "dp-dim", extension.description));
    card2.appendChild(head);
    var note = extension.on ? closingNote(ui.view, extension.key) : "";
    if (note) card2.appendChild(el("div", "dp-ext-note", note));
    if (extension.error) card2.appendChild(el("div", "dp-ext-note", "\u52A0\u8F7D\u51FA\u9519\uFF1A" + extension.error));
    if (download.failed === extension.key) card2.appendChild(el("div", "dp-ext-note", "\u6CA1\u88C5\u4E0A\uFF1A" + download.error));
    var newer = online.entries.find(function(entry) {
      return entry.key === extension.key && entry.update === true;
    });
    var row = el("div", "dp-ext-actions");
    var toggle = button("dp-switch", { "data-extension-toggle": extension.key, "aria-pressed": String(extension.on) }, function() {
      ui.send("setExtension", { key: extension.key, on: !extension.on });
    });
    toggle.appendChild(el("span", "dp-switch-knob"));
    toggle.appendChild(el("span", "dp-switch-text", extension.on ? "\u5F00" : "\u5173"));
    row.appendChild(toggle);
    if (newer) {
      var update = button("dp-mini", { "data-ext-update": extension.key }, function() {
        startInstall(ui, extension.key);
      });
      update.textContent = installLabel(extension.key, "\u66F4\u65B0\u5230 " + str(newer.version, ""));
      update.disabled = download.key !== "";
      row.appendChild(update);
    }
    if (confirming === extension.key) {
      row.appendChild(el("span", "dp-ext-warn", "\u5220\u6389\u4F1A\u6E05\u7A7A" + (CLEARS[extension.key] ?? "\u5B83\u7684\u6570\u636E") + "\uFF0C\u786E\u5B9A\u5417\uFF1F"));
      var yes = button("dp-mini dp-ext-danger", { "data-ext-remove-yes": extension.key }, function() {
        confirming = null;
        online.loaded = false;
        ui.send("removeExtension", { key: extension.key });
      });
      yes.textContent = "\u5220\u9664";
      var no = button("dp-mini dp-mini-plain", { "data-ext-remove-no": extension.key }, function() {
        confirming = null;
        ui.renderContent();
      });
      no.textContent = "\u7B97\u4E86";
      row.appendChild(yes);
      row.appendChild(no);
    } else {
      var remove = button("dp-mini dp-mini-plain dp-ext-remove", { "data-ext-remove": extension.key }, function() {
        confirming = extension.key;
        ui.renderContent();
      });
      remove.textContent = "\u5220\u9664";
      row.appendChild(remove);
    }
    card2.appendChild(row);
    return card2;
  }
  function renderOnline(ui) {
    if (!online.loaded) {
      ui.content.appendChild(el("div", "dp-ext-later", "\u6B63\u5728\u8BFB\u53D6\u5728\u7EBF\u6269\u5C55\u2026\u2026"));
      return;
    }
    var installed2 = {};
    for (var i = 0; i < ui.view.extensions.length; i += 1) if (ui.view.extensions[i].installed) installed2[ui.view.extensions[i].key] = true;
    var entries2 = online.entries.filter(function(entry) {
      return !installed2[entry.key];
    });
    if (online.error && entries2.length === 0) {
      ui.content.appendChild(el("div", "dp-ext-later", "\u8BFB\u4E0D\u5230\u5728\u7EBF\u6269\u5C55\u76EE\u5F55\uFF08" + online.error + "\uFF09\uFF0C\u7A0D\u540E\u70B9\u5237\u65B0"));
      return;
    }
    if (entries2.length === 0) {
      ui.content.appendChild(el("div", "dp-ext-later", "\u5728\u7EBF\u7684\u6269\u5C55\u90FD\u88C5\u597D\u4E86\uFF0C\u4EE5\u540E\u6709\u65B0\u7684\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC"));
      return;
    }
    for (var k = 0; k < entries2.length; k += 1) {
      (function(entry) {
        var card2 = el("div", "dp-set dp-ext-card");
        card2.setAttribute("data-online-extension", entry.key);
        var head = el("div", "dp-set-head");
        head.appendChild(el("span", "dp-ext-emoji", str(entry.emoji, "\u{1F9E9}")));
        head.appendChild(el("b", null, str(entry.label, entry.key) + (entry.builtin ? " \xB7 \u5185\u7F6E" : " " + str(entry.version, ""))));
        var get = button("dp-mini", { "data-ext-install": entry.key }, function() {
          startInstall(ui, entry.key);
        });
        get.textContent = installLabel(entry.key, entry.builtin ? "\u91CD\u65B0\u5B89\u88C5" : "\u4E0B\u8F7D");
        get.disabled = downloading(entry.key) || download.key !== "" || entry.blocked !== null && entry.blocked !== void 0;
        head.appendChild(get);
        if (entry.description) head.appendChild(el("small", "dp-dim", str(entry.description, "")));
        card2.appendChild(head);
        if (download.failed === entry.key) card2.appendChild(el("div", "dp-ext-note", "\u6CA1\u88C5\u4E0A\uFF1A" + download.error));
        if (entry.blocked === "game-too-old") card2.appendChild(el("div", "dp-ext-note", "\u9700\u8981\u6E38\u620F v" + str(entry.minGame, "") + "\uFF0C\u5148\u66F4\u65B0\u6E38\u620F"));
        else if (entry.builtin) card2.appendChild(el("div", "dp-ext-note", "\u4EE3\u7801\u5728\u6E38\u620F\u91CC\uFF0C\u88C5\u56DE\u6765\u4E0D\u7528\u4E0B\u8F7D\uFF0C\u4ECE\u96F6\u5F00\u59CB"));
        else if (downloading(entry.key)) card2.appendChild(el("div", "dp-ext-note", "\u6B63\u5728\u4E0B\u8F7D\uFF0C\u7F51\u7EDC\u6162\u7684\u65F6\u5019\u8981\u7B49\u4E00\u4F1A\u513F"));
        ui.content.appendChild(card2);
      })(entries2[k]);
    }
  }

  // src/client/tabs/home.js
  var APP_COLOR = {
    status: "green",
    card: "pink",
    dex: "purple",
    skins: "purple",
    study: "yellow",
    work: "orange",
    shop: "red",
    travel: "blue",
    bag: "teal",
    pomodoro: "red",
    fishing: "blue",
    settings: "peach",
    update: "lime",
    quit: "peach",
    dev: "brown"
  };
  function orderHomeApps(apps) {
    const rank = (key) => key === "quit" ? 4 : key === "dev" ? 3 : key === "settings" ? 2 : key.startsWith("ext:") ? 1 : 0;
    return apps.slice().sort((a, b) => rank(a.key) - rank(b.key));
  }
  function renderHome(ui, apps) {
    var p = ui.view.pig;
    var head = el("div", "dp-title");
    head.appendChild(el("b", null, p.name + (p.sex !== null ? " " + p.sex.symbol : "") + " Lv." + p.level.level));
    head.appendChild(el("span", null, "\u{1FA99} " + p.coins));
    ui.content.appendChild(head);
    const pages = Math.max(1, Math.ceil(apps.length / 9));
    ui.homePage = Math.max(0, Math.min(pages - 1, ui.homePage ?? 0));
    const clip2 = el("div", "dp-home-clip");
    clip2.setAttribute("data-home-swipe", "true");
    const track = el("div", "dp-home-track");
    const grids = [];
    const dots = [];
    for (let page = 0; page < pages; page += 1) {
      const grid = tileGrid();
      grid.className += " dp-home-page";
      grid.setAttribute("data-home-page", String(page));
      for (const app of apps.slice(page * 9, page * 9 + 9)) {
        grid.appendChild(tile({
          emoji: app.emoji,
          icon: appIcon(app.key, app.emoji, "dp-tile-e"),
          label: app.label,
          color: APP_COLOR[app.key] ?? "blue",
          // 更新入口收进了设置：有新正式版时设置格子冒红点（G 批次）。
          tag: app.key === "update" || app.key === "settings" ? "" : alertFor(ui, app.key),
          badge: app.key === "settings" ? alertFor(ui, "update") || (extensionUpdateAvailable(ui) ? "!" : "") : "",
          data: { "data-app": app.key },
          onPick: function() {
            ui.select(app.key);
          }
        }));
      }
      grids.push(grid);
      track.appendChild(grid);
    }
    clip2.appendChild(track);
    ui.content.appendChild(clip2);
    let dotRow = null;
    if (pages > 1) {
      dotRow = el("div", "dp-home-dots");
      for (let page = 0; page < pages; page += 1) {
        const dot = button("dp-home-dot", { "data-home-dot": String(page), "aria-label": "\u7B2C " + (page + 1) + " \u9875" }, function() {
          showPage(page);
        });
        dots.push(dot);
        dotRow.appendChild(dot);
      }
      ui.content.appendChild(dotRow);
    }
    function showPage(page) {
      const next = Math.max(0, Math.min(pages - 1, page));
      ui.homePage = next;
      track.style.transform = "translateX(-" + next * 100 + "%)";
      grids.forEach((grid, index) => {
        grid.setAttribute("data-active", String(index === next));
        grid.setAttribute("aria-hidden", String(index !== next));
        grid.inert = index !== next;
      });
      dots.forEach((dot, index) => dot.setAttribute("aria-pressed", String(index === next)));
    }
    showPage(ui.homePage);
    let drag = null;
    let swallowClick = false;
    clip2.addEventListener("pointerdown", (event) => {
      if (pages < 2 || event.pointerType === "mouse" && event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
    });
    clip2.addEventListener("pointermove", (event) => {
      if (drag === null || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - drag.y)) return;
        drag.moved = true;
        clip2.setPointerCapture?.(event.pointerId);
        track.style.transition = "none";
      }
      const atEdge = ui.homePage === 0 && dx > 0 || ui.homePage === pages - 1 && dx < 0;
      track.style.transform = "translateX(calc(-" + ui.homePage * 100 + "% + " + (atEdge ? dx / 3 : dx) + "px))";
    });
    function endDrag(event) {
      if (drag === null || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const moved = drag.moved || Math.abs(dx) > 40;
      drag = null;
      track.style.transition = "";
      if (!moved) return;
      swallowClick = true;
      setTimeout(() => {
        swallowClick = false;
      }, 0);
      showPage(Math.abs(dx) > 40 ? ui.homePage + (dx < 0 ? 1 : -1) : ui.homePage);
    }
    clip2.addEventListener("pointerup", endDrag);
    clip2.addEventListener("pointercancel", (event) => {
      if (drag !== null) {
        drag.moved = true;
        endDrag(event);
      }
    });
    clip2.addEventListener("click", (event) => {
      if (swallowClick) {
        event.stopPropagation();
        event.preventDefault();
      }
    }, true);
    let wheelLock = 0;
    clip2.addEventListener("wheel", (event) => {
      if (pages < 2) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 4) return;
      const next = ui.homePage + (delta > 0 ? 1 : -1);
      if (next < 0 || next >= pages) return;
      event.preventDefault();
      const now = Date.now();
      if (now < wheelLock) return;
      wheelLock = now + 450;
      showPage(next);
    }, { passive: false });
    var version = el("div", "dp-version", "v" + (ui.view.version === "" ? "\u672A\u77E5" : ui.view.version));
    version.setAttribute("data-version", "true");
    version.addEventListener("click", function(event) {
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      ui.tapVersion();
    });
    ui.content.appendChild(version);
  }
  function alertFor(ui, key) {
    if (key === "update") return ui.updateNotice?.unread ? "!" : "";
    var p = ui.view.pig;
    if (key === "status") {
      if (ui.view.dead) return "\u8D70\u4E86";
      if (p.illness !== null) return "\u751F\u75C5";
      if (ui.view.activity !== null) return "\u5728\u5916\u9762";
      return "";
    }
    var icon = ui.icons[key];
    return icon !== void 0 && icon.getAttribute("data-alert") === "true" ? "!" : "";
  }
  function appHeader(ui, app, info) {
    var row = el("div", "dp-drill dp-app-head");
    var back = el("button", "dp-drill-back");
    back.setAttribute("data-home", "true");
    back.textContent = "\u2039";
    back.addEventListener("click", function(event) {
      if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      ui.select(app.key === "extensions" ? "settings" : "home");
    });
    row.appendChild(back);
    var title = el("b", "dp-drill-title dp-app-title");
    title.appendChild(appIcon(app.key, app.emoji, "dp-app-title-icon"));
    title.appendChild(el("span", null, app.label));
    row.appendChild(title);
    if (info) row.appendChild(el("span", "dp-drill-info", info));
    ui.content.appendChild(row);
  }

  // packages/pet-core/src/data/fish.js
  var fish2 = (key, label, emoji, spot, rarity, times, behavior, difficulty, minCm, maxCm, price) => Object.freeze({ key, label, emoji, spot, rarity, times: Object.freeze(times), behavior, difficulty, minCm, maxCm, price });
  var ALL_DAY = ["early", "noon", "evening", "night"];
  var FISH = Object.freeze([
    // C5 的 15 种（价格、时段、手感都不改，只按水域分到钓点）
    fish2("fish_crucian", "\u9CAB\u9C7C", "\u{1F41F}", "river", "common", ["early", "noon", "evening"], "smooth", 12, 12, 32, 8),
    fish2("fish_carp", "\u9CA4\u9C7C", "\u{1F41F}", "river", "common", ["noon", "evening"], "smooth", 18, 20, 55, 12),
    fish2("fish_sardine", "\u6C99\u4E01\u9C7C", "\u{1F41F}", "sea", "common", ["early", "noon"], "dash", 22, 10, 26, 14),
    fish2("fish_anchovy", "\u9CC0\u9C7C", "\u{1F41F}", "sea", "common", ["early", "evening"], "dash", 25, 8, 22, 16),
    fish2("fish_perch", "\u6CB3\u9C88", "\u{1F420}", "river", "common", ["noon", "evening"], "sink", 28, 16, 38, 18),
    fish2("fish_bream", "\u9CCA\u9C7C", "\u{1F41F}", "river", "common", ["early", "noon"], "rise", 30, 18, 42, 20),
    fish2("fish_catfish", "\u9CB6\u9C7C", "\u{1F421}", "river", "common", ["evening", "night"], "sink", 34, 24, 68, 24),
    fish2("fish_mackerel", "\u9752\u82B1\u9C7C", "\u{1F41F}", "sea", "common", ["noon", "evening"], "mixed", 38, 22, 48, 28),
    fish2("fish_salmon", "\u9C91\u9C7C", "\u{1F41F}", "river", "uncommon", ["early", "evening"], "dash", 48, 38, 92, 48),
    fish2("fish_puffer", "\u6CB3\u8C5A", "\u{1F421}", "sea", "uncommon", ["noon"], "mixed", 55, 18, 40, 62),
    fish2("fish_eel", "\u9CD7\u9C7C", "\u{1F40D}", "river", "uncommon", ["evening", "night"], "rise", 61, 42, 110, 78),
    fish2("fish_tuna", "\u91D1\u67AA\u9C7C", "\u{1F41F}", "sea", "uncommon", ["early", "noon"], "dash", 66, 70, 180, 96),
    fish2("fish_sturgeon", "\u9C9F\u9C7C", "\u{1F41F}", "river", "rare", ["night"], "sink", 78, 85, 220, 160),
    fish2("fish_koi", "\u9EC4\u91D1\u9526\u9CA4", "\u{1F38F}", "river", "rare", ["early", "evening"], "mixed", 86, 30, 88, 220),
    fish2("fish_moon", "\u6708\u5F71\u9C7C", "\u{1F319}", "night", "legend", ["night"], "mixed", 100, 60, 160, 300),
    // 钓鱼 2.0 新加的 25 种
    fish2("fish_loach", "\u6CE5\u9CC5", "\u{1F41F}", "river", "common", ALL_DAY, "smooth", 8, 8, 20, 6),
    fish2("fish_crayfish", "\u5C0F\u9F99\u867E", "\u{1F99E}", "river", "common", ["noon", "evening", "night"], "sink", 14, 8, 15, 10),
    fish2("fish_ricefield_eel", "\u9EC4\u9CDD", "\u{1F40D}", "river", "uncommon", ["evening", "night"], "rise", 45, 25, 70, 40),
    fish2("fish_goldfish", "\u91D1\u9C7C", "\u{1F420}", "lake", "common", ["early", "noon"], "smooth", 10, 5, 15, 6),
    fish2("fish_grass_carp", "\u8349\u9C7C", "\u{1F41F}", "lake", "common", ["early", "noon", "evening"], "smooth", 20, 30, 90, 10),
    fish2("fish_silver_carp", "\u9CA2\u9C7C", "\u{1F41F}", "lake", "common", ["noon", "evening"], "rise", 24, 30, 80, 12),
    fish2("fish_icefish", "\u94F6\u9C7C", "\u{1F41F}", "lake", "common", ["early", "evening"], "dash", 26, 5, 12, 14),
    fish2("fish_trout", "\u8679\u9CDF", "\u{1F41F}", "lake", "uncommon", ["early", "evening"], "dash", 44, 30, 70, 40),
    fish2("fish_crab", "\u5927\u95F8\u87F9", "\u{1F980}", "lake", "uncommon", ["evening", "night"], "sink", 48, 8, 15, 45),
    fish2("fish_mandarin", "\u9CDC\u9C7C", "\u{1F41F}", "lake", "uncommon", ["evening", "night"], "mixed", 54, 25, 60, 50),
    fish2("fish_pike", "\u72D7\u9C7C", "\u{1F41F}", "lake", "uncommon", ["noon", "evening"], "dash", 62, 40, 120, 60),
    fish2("fish_paddlefish", "\u767D\u9C9F", "\u{1F41F}", "lake", "rare", ["night"], "sink", 82, 100, 300, 200),
    fish2("fish_lake_shadow", "\u6E56\u4E2D\u5DE8\u5F71", "\u{1F311}", "lake", "legend", ["night"], "mixed", 98, 200, 500, 600),
    fish2("fish_ribbonfish", "\u5E26\u9C7C", "\u{1F41F}", "sea", "common", ["evening", "night"], "rise", 30, 50, 120, 16),
    fish2("fish_croaker", "\u9EC4\u82B1\u9C7C", "\u{1F41F}", "sea", "common", ["early", "noon"], "smooth", 32, 20, 45, 18),
    fish2("fish_flounder", "\u6BD4\u76EE\u9C7C", "\u{1F41F}", "sea", "uncommon", ["noon", "evening"], "sink", 46, 25, 60, 50),
    fish2("fish_octopus", "\u7AE0\u9C7C", "\u{1F419}", "sea", "uncommon", ["evening", "night"], "mixed", 58, 30, 90, 60),
    fish2("fish_swordfish", "\u65D7\u9C7C", "\u{1F41F}", "sea", "rare", ["noon"], "dash", 84, 150, 300, 220),
    fish2("fish_whale_shark", "\u5C0F\u9CB8\u9CA8", "\u{1F988}", "sea", "legend", ["early", "noon"], "smooth", 95, 300, 600, 700),
    fish2("fish_firefly", "\u8424\u5149\u9C7C", "\u2728", "night", "common", ["night"], "dash", 28, 5, 15, 10),
    fish2("fish_lantern", "\u706F\u7B3C\u9C7C", "\u{1F3EE}", "night", "common", ["night"], "rise", 34, 6, 18, 12),
    fish2("fish_ghost", "\u5E7D\u7075\u9C7C", "\u{1F47B}", "night", "uncommon", ["night"], "mixed", 60, 20, 50, 55),
    fish2("fish_star_ray", "\u661F\u6591\u9CD0", "\u2B50", "night", "rare", ["night"], "sink", 80, 60, 150, 160),
    fish2("fish_arowana", "\u9F99\u9C7C", "\u{1F409}", "night", "rare", ["night"], "dash", 88, 60, 120, 200),
    fish2("fish_night_whale", "\u591C\u4E4B\u9CB8", "\u{1F40B}", "night", "legend", ["night"], "mixed", 100, 400, 900, 600)
  ]);
  var FISH_FIGHTS = Object.freeze(["ring", "bar", "pull"]);
  var FISH_SPOTS = Object.freeze([
    Object.freeze({ key: "river", label: "\u5C0F\u6CB3", emoji: "\u{1F3DE}", price: 0, times: null }),
    Object.freeze({ key: "lake", label: "\u6E56", emoji: "\u{1F3D5}", price: 1500, times: null }),
    Object.freeze({ key: "sea", label: "\u6D77\u8FB9", emoji: "\u{1F3D6}", price: 4e3, times: null }),
    Object.freeze({ key: "night", label: "\u591C\u6F6D", emoji: "\u{1F30C}", price: 9e3, times: Object.freeze(["night"]) })
  ]);
  var RODS = Object.freeze([
    Object.freeze({ level: 1, key: "bamboo", label: "\u7AF9\u7AFF", emoji: "\u{1F38B}", price: 0, bite: Object.freeze([3e3, 8e3]), difficulty: 1.6, rare: 0.8, zone: 0.9, hold: 0.9 }),
    Object.freeze({ level: 2, key: "carbon", label: "\u78B3\u7D20\u7AFF", emoji: "\u{1F3A3}", price: 800, bite: Object.freeze([2500, 6500]), difficulty: 1.4, rare: 1, zone: 1, hold: 1 }),
    Object.freeze({ level: 3, key: "pro", label: "\u4E13\u4E1A\u7AFF", emoji: "\u{1FA9D}", price: 2500, bite: Object.freeze([2e3, 5e3]), difficulty: 1.25, rare: 1.3, zone: 1.12, hold: 1.1 }),
    Object.freeze({ level: 4, key: "legend", label: "\u4F20\u8BF4\u7AFF", emoji: "\u{1F531}", price: 7e3, bite: Object.freeze([1500, 4e3]), difficulty: 1.1, rare: 1.5, zone: 1.25, hold: 1.2 })
  ]);
  var FISH_FEEL = Object.freeze({
    smooth: Object.freeze({ speed: Object.freeze([0.6, 0.95]), burst: 0, burstScale: 1, drift: 0, jitter: 0 }),
    dash: Object.freeze({ speed: Object.freeze([0.75, 1.2]), burst: 0.025, burstScale: 5, drift: 0, jitter: 0.1 }),
    sink: Object.freeze({ speed: Object.freeze([0.8, 1.1]), burst: 6e-3, burstScale: 3, drift: -26, jitter: 0.05 }),
    rise: Object.freeze({ speed: Object.freeze([0.8, 1.1]), burst: 6e-3, burstScale: 3, drift: 26, jitter: 0.05 }),
    mixed: Object.freeze({ speed: Object.freeze([0.85, 1.45]), burst: 0.018, burstScale: 4, drift: 0, jitter: 0.35 })
  });

  // packages/pet-core/src/data/skins.js
  var SKIN_SCENES = Object.freeze(["idle", "eat", "bathe", "play", "pet", "relaxed", "work", "study", "trip", "fish", "sleep"]);
  var REQUIRED_SKIN_SCENES = Object.freeze(SKIN_SCENES.slice(0, 5));
  var CHARACTER_SCENES = Object.freeze(SKIN_SCENES.filter((scene3) => scene3 !== "fish" && scene3 !== "sleep"));
  var SKINS = Object.freeze([
    Object.freeze({
      key: "mint",
      label: "\u8584\u8377\u5C0F\u732A",
      emoji: "\u{1F33F}",
      art: "skin-mint",
      author: "dsh-piggy",
      description: "\u50CF\u4E00\u53E3\u8584\u8377\u6C7D\u6C34\uFF0C\u6E05\u6E05\u51C9\u51C9\u3002",
      scenes: Object.freeze(["idle", "eat", "bathe", "play", "pet", "work"]),
      custom: false
    }),
    Object.freeze({
      key: "chef",
      label: "\u53A8\u5E08\u732A",
      emoji: "\u{1F468}\u200D\u{1F373}",
      art: "career-chef",
      unlockJob: "chef",
      author: "dsh-piggy",
      description: "\u638C\u52FA\u5F52\u6765\uFF0C\u5E3D\u5B50\u4E0A\u8FD8\u6CBE\u7740\u4E00\u70B9\u9762\u7C89\u3002",
      hint: "\u53A8\u623F\u91CC\u7684\u7B2C\u4E00\u73ED\u70DF\u706B\uFF0C\u4F1A\u9001\u6765\u4E00\u9876\u767D\u5E3D\u5B50\u3002",
      scenes: CHARACTER_SCENES,
      custom: false
    }),
    Object.freeze({
      key: "astronaut",
      label: "\u5B87\u822A\u5458\u732A",
      emoji: "\u{1F680}",
      art: "career-astronaut",
      unlockJob: "astronaut",
      author: "dsh-piggy",
      description: "\u628A\u5730\u7403\u88C5\u8FDB\u5934\u76D4\u7684\u5012\u5F71\u91CC\u3002",
      hint: "\u5B8C\u6210\u90A3\u8D9F\u79BB\u5929\u7A7A\u6700\u8FD1\u7684\u5DE5\u4F5C\uFF0C\u624D\u6709\u8D44\u683C\u6234\u4E0A\u5934\u76D4\u3002",
      scenes: CHARACTER_SCENES,
      custom: false
    }),
    Object.freeze({
      key: "detective",
      label: "\u4FA6\u63A2\u732A",
      emoji: "\u{1F50E}",
      art: "skin-detective",
      author: "dsh-piggy",
      description: "\u5C0F\u7EBF\u7D22\u603B\u8EB2\u4E0D\u8FC7\u5B83\u7684\u773C\u775B\u3002",
      scenes: CHARACTER_SCENES,
      custom: false
    }),
    Object.freeze({
      key: "angel",
      label: "\u5929\u4F7F\u732A",
      emoji: "\u{1F607}",
      art: "skin-angel",
      author: "dsh-piggy",
      description: "\u5149\u73AF\u5F88\u4EAE\uFF0C\u813E\u6C14\u8FD8\u662F\u8F6F\u8F6F\u7684\u3002",
      scenes: CHARACTER_SCENES,
      custom: false
    }),
    Object.freeze({
      key: "pirate",
      label: "\u6D77\u76D7\u732A",
      emoji: "\u{1F3F4}\u200D\u2620\uFE0F",
      art: "skin-pirate",
      author: "dsh-piggy",
      description: "\u51FA\u95E8\u627E\u5B9D\u85CF\uFF0C\u56DE\u5BB6\u627E\u665A\u996D\u3002",
      scenes: CHARACTER_SCENES,
      custom: false
    }),
    Object.freeze({
      key: "wizard",
      label: "\u5DEB\u5E08\u732A",
      emoji: "\u{1FA84}",
      art: "skin-wizard",
      author: "dsh-piggy",
      description: "\u5E3D\u5B50\u91CC\u6CA1\u6709\u9B54\u6CD5\uFF0C\u53EA\u6709\u597D\u5947\u5FC3\u3002",
      scenes: CHARACTER_SCENES,
      custom: false
    })
  ]);

  // packages/pet-core/src/data/lines-more.js
  var line = (text, reply) => Object.freeze(reply === void 0 ? { text } : { text, replies: Object.freeze([Object.freeze({ label: reply })]) });
  var scene = (...lines) => Object.freeze(lines);
  var MORE_LINES = Object.freeze({
    // ---- 原有场景翻倍 -----------------------------------------------------------
    eat: scene(
      line("\u4ECA\u5929\u7684\u996D\u6709[\u4E3B\u4EBA]\u7684\u5473\u9053\uFF08\u662F\u5938\u4F60\uFF09"),
      line("\u6162\u70B9\u6162\u70B9\uFF0C\u6211\u8FD8\u6CA1\u56BC\u5B8C"),
      line("\u5403\u4E00\u53E3\uFF0C\u957F\u4E00\u4E24\uFF0C\u6CA1\u5173\u7CFB\uFF0C\u6211\u4E0D\u6015"),
      line("\u8FD9\u4E2A\u597D\u5403\uFF0C\u4E0B\u6B21\u8FD8\u8981\u8FD9\u4E2A", "\u8BB0\u4F4F\u4E86"),
      line("\u6211\u5BA3\u5E03\uFF1A\u8FD9\u662F\u4ECA\u5929\u6700\u597D\u7684\u4E00\u987F"),
      line("\u5403\u996D\u7684\u65F6\u5019\u522B\u770B\u6211\uFF0C\u6211\u4F1A\u5BB3\u7F9E")
    ),
    full: scene(line("\u9971\u4E86\uFF0C\u53EF\u4EE5\u5F00\u59CB\u53D1\u5446\u4E86"), line("\u809A\u5B50\u91CC\u88C5\u6EE1\u4E86\uFF0C\u5FC3\u91CC\u4E5F\u662F"), line("\u9971\u9971\u7684\uFF0C\u4ECA\u5929\u4E0D\u4F1A\u60F3\u522B\u7684\u4E8B\u4E86")),
    overfull: scene(line("\u518D\u5403\u6211\u5C31\u8981\u88AB\u79F0\u91CD\u4E86\u2026\u2026"), line("\u4F60\u662F\u4E0D\u662F\u5728\u7ED9\u6211\u517B\u8198\uFF1F", "\u6CA1\u6709\u6CA1\u6709"), line("\u6211\u7684\u809A\u5B50\u5728\u6297\u8BAE\uFF0C\u542C\u89C1\u4E86\u5417")),
    bathe: scene(
      line("\u6C34\u6E29\u521A\u597D\uFF0C\u4E0D\u662F\u5728\u712F\u6C34\u5427\uFF1F", "\u653E\u5FC3"),
      line("\u6211\u73B0\u5728\u662F\u4E00\u53EA\u4F53\u9762\u7684\u732A\u4E86"),
      line("\u6CE5\u5DF4\u518D\u89C1\uFF0C\u6CE5\u5DF4\u6211\u4F1A\u60F3\u4F60\u7684"),
      line("\u522B\u6D17\u8033\u6735\u540E\u9762\uFF0C\u90A3\u91CC\u6709\u6211\u7684\u79D8\u5BC6"),
      line("\u6D17\u5B8C\u522B\u95FB\u6211\u8BF4\u300C\u597D\u9999\u300D\uFF0C\u6709\u70B9\u5413\u4EBA")
    ),
    play: scene(
      line("\u4F60\u6254\uFF0C\u6211\u6361\uFF0C\u6211\u4EEC\u914D\u5408\u5F97\u5929\u8863\u65E0\u7F1D"),
      line("\u54C7\uFF01\u5DEE\u70B9\u63A5\u5230\uFF01"),
      line("\u518D\u6765\u518D\u6765\uFF0C\u6211\u521A\u70ED\u5B8C\u8EAB", "\u6765\uFF01"),
      line("\u73A9\u800D\u4F7F\u6211\u5FEB\u4E50\uFF0C\u4E5F\u4F7F\u6211\u53D8\u7626"),
      line("\u4F60\u4E5F\u52A8\u52A8\u5427\uFF0C\u5750\u592A\u4E45\u4E86")
    ),
    pet: scene(
      line("\u624B\u611F\u662F\u4E0D\u662F\u5F88\u597D\uFF1F\u4E0D\u8BB8\u8BF4\u300C\u50CF\u4E94\u82B1\u8089\u300D"),
      line("\u518D\u6478\u6211\u5C31\u8981\u7761\u7740\u4E86"),
      line("\u55EF\u2026\u2026\u8FD9\u6837\u5F88\u597D"),
      line("\u4F60\u4ECA\u5929\u6478\u5F97\u7279\u522B\u8BA4\u771F"),
      line("[\u4E3B\u4EBA]\uFF0C\u6211\u4EEC\u7B97\u4E0D\u7B97\u597D\u670B\u53CB\uFF1F", "\u5F53\u7136\u7B97"),
      line("\u8FD9\u662F\u6211\u4E00\u5929\u91CC\u6700\u559C\u6B22\u7684\u65F6\u523B"),
      line("\u6478\u732A\u53EF\u4EE5\u964D\u8840\u538B\uFF0C\u8FD9\u662F\u79D1\u5B66\uFF08\u6211\u7F16\u7684\uFF09")
    ),
    hungry: scene(line("\u6211\u997F\u5F97\u80FD\u770B\u89C1\u5E7B\u89C9\u4E86\uFF0C\u4F60\u5934\u4E0A\u6709\u4E2A\u5305\u5B50"), line("\u518D\u4E0D\u5403\u996D\uFF0C\u6211\u5C31\u8981\u5F00\u59CB\u5403\u81EA\u5DF1\u7684\u5F71\u5B50\u4E86"), line("\u996D\u996D\u2026\u2026\u996D\u996D\u2026\u2026", "\u9A6C\u4E0A\u6765")),
    dirty: scene(line("\u6211\u8EAB\u4E0A\u7684\u6CE5\u5DF4\u5DF2\u7ECF\u53EF\u4EE5\u79CD\u82B1\u4E86"), line("\u82CD\u8747\u7ED5\u7740\u6211\u98DE\uFF0C\u5B83\u4EEC\u5728\u5F00\u4F1A\u8BA8\u8BBA\u6211"), line("\u6211\u9700\u8981\u4E00\u4E2A\u6FA1\uFF0C\u4E00\u4E2A\u70ED\u7684\uFF08\u4E0D\u8981\u592A\u70ED\uFF09", "\u597D")),
    lonely: scene(line("\u6211\u521A\u624D\u8DDF\u5899\u804A\u4E86\u4E00\u4F1A\u513F\uFF0C\u5899\u4E0D\u592A\u4F1A\u804A\u5929"), line("\u4F60\u8FD8\u8BB0\u5F97\u4F60\u517B\u4E86\u4E00\u53EA\u732A\u5417", "\u8BB0\u5F97"), line("\u6CA1\u4E8B\uFF0C\u6211\u5C31\u662F\u60F3\u770B\u770B\u4F60\u8FD8\u5728\u4E0D\u5728")),
    idle: scene(
      line("\u6211\u6570\u4E86\u4E00\u4E0B\uFF0C\u5C4F\u5E55\u4E0A\u6709\u5F88\u591A\u5B57\uFF0C\u6211\u4E00\u4E2A\u90FD\u6CA1\u5199"),
      line("\u4F60\u5199\u7684\u4E1C\u897F\u597D\u957F\uFF0C\u6211\u80FD\u7761\u4E00\u89C9\u5417"),
      line("\u6211\u521A\u624D\u68A6\u89C1\u81EA\u5DF1\u4F1A\u98DE\uFF0C\u9192\u4E86\u53D1\u73B0\u4F1A\u7684\u53EA\u6709\u5403"),
      line("\u5916\u9762\u6709\u4EBA\u5728\u7092\u83DC\uFF0C\u6211\u7D27\u5F20\u4E86\u4E00\u4E0B"),
      line("\u5750\u76F4\uFF0C[\u4E3B\u4EBA]\uFF0C\u4F60\u7684\u80CC\u5728\u54ED"),
      line("\u8981\u4E0D\u8981\u559D\u53E3\u6C34\uFF1F\u6211\u66FF\u4F60\u8BB0\u7740", "\u597D"),
      line("\u4F60\u7684\u5C4F\u5E55\u597D\u4EAE\uFF0C\u6211\u772F\u4E00\u4F1A\u513F"),
      line("\u521A\u624D\u90A3\u4E2A\u529F\u80FD\u6211\u89C9\u5F97\u5199\u5F97\u4E0D\u9519\uFF08\u6211\u770B\u4E0D\u61C2\uFF0C\u4F46\u6211\u652F\u6301\u4F60\uFF09")
    ),
    workDone: scene(line("\u8001\u677F\u95EE\u6211\u80FD\u4E0D\u80FD\u957F\u671F\u5E72\uFF0C\u6211\u8BF4\u8981\u95EE[\u4E3B\u4EBA]"), line("\u8D5A\u7684\u94B1\u7ED9\u4F60\uFF0C\u8BF7\u6211\u5403\u987F\u597D\u7684\u5C31\u884C", "\u6210\u4EA4"), line("\u6253\u5DE5\u597D\u7D2F\uFF0C\u4EBA\u7C7B\u6BCF\u5929\u90FD\u8FD9\u6837\u5417")),
    tired: scene(line("\u6211\u9700\u8981\u8EBA\u5E73\uFF0C\u73B0\u5728\uFF0C\u7ACB\u523B"), line("\u6211\u7684\u56DB\u6761\u817F\u5DF2\u7ECF\u5404\u81EA\u4E0B\u73ED\u4E86"), line("\u7D2F\u5F97\u8FDE\u996D\u90FD\u2026\u2026\u4E0D\uFF0C\u996D\u8FD8\u662F\u8981\u5403\u7684")),
    study: scene(line("\u4ECA\u5929\u5B66\u4E86\u4E00\u4E2A\u65B0\u8BCD\uFF0C\u5FD8\u4E86"), line("\u8001\u5E08\u8BF4\u6211\u5F88\u6709\u6F5C\u529B\uFF0C\u6F5C\u5728\u54EA\u6211\u4E5F\u4E0D\u77E5\u9053"), line("\u5B66\u4E60\u4F7F\u6211\u8FDB\u6B65\uFF0C\u4E5F\u4F7F\u6211\u997F", "\u53BB\u5403\u5427")),
    graduate: scene(line("\u8BC1\u4E66\u6302\u5899\u4E0A\uFF0C\u522B\u6302\u83DC\u5200\u65C1\u8FB9"), line("\u6211\u662F\u5168\u73ED\u6700\u5BBD\u7684\u6BD5\u4E1A\u751F"), line("\u6709\u6587\u5316\u7684\u732A\uFF0C\u4E0D\u5BB9\u6613\u88AB\u9A97\u8FDB\u53A8\u623F")),
    tripBack: scene(line("\u5916\u9762\u5230\u5904\u90FD\u662F\u996D\u9986\uFF0C\u6211\u4E00\u8DEF\u4F4E\u7740\u5934\u8D70\u7684"), line("\u6211\u770B\u89C1\u6D77\u4E86\uFF01\u6D77\u91CC\u6CA1\u6709\u732A"), line("\u62CD\u4E86\u597D\u591A\u7167\u7247\uFF0C\u6BCF\u5F20\u90FD\u5728\u7B11\uFF08\u5176\u5B9E\u5F88\u997F\uFF09")),
    sick: scene(line("\u6211\u89C9\u5F97\u6211\u9700\u8981\u4E00\u4E2A\u62B1\u62B1\uFF0C\u548C\u4E00\u9897\u836F", "\u90FD\u7ED9\u4F60"), line("\u8EAB\u4F53\u91CC\u6709\u4E2A\u5C0F\u574F\u86CB\u5728\u641E\u88C5\u4FEE"), line("\u6211\u751F\u75C5\u4E86\uFF0C\u75C5\u732A\u8089\u4E0D\u80FD\u5403\u2014\u2014\u8FD9\u662F\u597D\u6D88\u606F")),
    wrongMedicine: scene(line("\u8FD9\u4E2A\u836F\u2026\u2026\u597D\u50CF\u662F\u7ED9\u72D7\u5403\u7684"), line("\u6211\u539F\u8C05\u4F60\uFF0C\u4F60\u770B\u8D77\u6765\u6BD4\u6211\u8FD8\u96BE\u53D7"), line("\u4E0B\u6B21\u770B\u6E05\u695A\u8BF4\u660E\u4E66\u597D\u4E0D\u597D", "\u597D")),
    cured: scene(line("\u6211\u6D3B\u8FC7\u6765\u4E86\uFF01\u7B2C\u4E00\u4EF6\u4E8B\uFF1A\u5403\u996D"), line("\u960E\u738B\u7237\u770B\u4E86\u770B\u6211\u7684\u4F53\u91CD\uFF0C\u8BF4\u300C\u518D\u517B\u517B\u300D"), line("\u5065\u5EB7\u771F\u597D\uFF0C\u6211\u73B0\u5728\u53EF\u4EE5\u91CD\u65B0\u62C5\u5FC3\u522B\u7684\u4E8B\u4E86")),
    levelup: scene(line("\u5347\u7EA7\u4E86\uFF0C\u5956\u52B1\u662F\u66F4\u5927\u7684\u996D\u91CF"), line("\u6211\u53D8\u5F3A\u4E86\uFF0C\u81F3\u5C11\u6570\u5B57\u4E0A\u662F\u8FD9\u6837"), line("\u4F60\u770B\u89C1\u4E86\u5417\uFF1F\u6211\u5347\u7EA7\u4E86\uFF01", "\u770B\u89C1\u4E86")),
    growUp: scene(line("\u957F\u5927\u7684\u611F\u89C9\uFF0C\u5C31\u662F\u9505\u53D8\u591A\u4E86"), line("\u6211\u957F\u5F00\u4E86\u2026\u2026\u4F60\u522B\u7528\u8FD9\u4E2A\u8BCD"), line("[\u4E3B\u4EBA]\uFF0C\u4F60\u4E5F\u8981\u4E00\u8D77\u957F\u5927\u54E6")),
    coronation: scene(line("\u672C\u738B\u4ECA\u65E5\u5F00\u6069\uFF0C\u514D\u4F60\u4E00\u987F\u4E0D\u5582\u4E4B\u7F6A"), line("\u738B\u51A0\u597D\u91CD\uFF0C\u8116\u5B50\u8981\u53D8\u957F\u4E86"), line("\u81E3\u6C11\u4EEC\uFF0C\u5F00\u996D\uFF01"), line("[\u4E3B\u4EBA]\u662F\u672C\u738B\u7684\u9996\u5E2D\u5582\u996D\u5B98", "\u9075\u547D")),
    contract: scene(line("\u6211\u73B0\u5728\u662F\u6076\u9B54\u4E86\uFF0C\u4F46\u8FD8\u662F\u6015\u70ED\u6C34"), line("\u89D2\u662F\u65B0\u7684\uFF0C\u6492\u5A07\u662F\u65E7\u7684"), line("\u6076\u9B54\u4E5F\u9700\u8981\u88AB\u6478\u6478"), line("\u7B7E\u4E86\u5951\u7EA6\uFF0C\u4EE5\u540E\u8C01\u4E5F\u4E0D\u80FD\u628A\u6211\u505A\u6210\u83DC", "\u90A3\u5F53\u7136")),
    enter: scene(line("\u4F60\u7EC8\u4E8E\u56DE\u6765\u4E86\uFF0C\u6211\u6570\u4E86\u597D\u4E45\u7684\u50CF\u7D20"), line("\u6B22\u8FCE\u56DE\u6765\uFF0C\u4ECA\u5929\u4E5F\u62DC\u6258\u591A\u5582\u6211\u4E00\u70B9"), line("\u6211\u521A\u521A\u4E00\u76F4\u5728\u8FD9\u91CC\uFF0C\u4E00\u52A8\u4E0D\u52A8\uFF0C\u5F88\u4E56", "\u771F\u4E56")),
    death: scene(line("\u8BB0\u5F97\u7ED9\u6211\u70E7\u70B9\u9972\u6599\u2026\u2026"), line("[\u4E3B\u4EBA]\uFF0C\u522B\u96BE\u8FC7\uFF0C\u6211\u53EA\u662F\u53BB\u4E0B\u4E00\u4E2A\u732A\u5708\u4E86")),
    revive: scene(line("\u90A3\u8FB9\u7684\u732A\u90FD\u5F88\u7626\uFF0C\u6211\u8FD8\u662F\u56DE\u6765\u5427"), line("\u6211\u56DE\u6765\u4E86\uFF0C\u996D\u8FD8\u5728\u5417"), line("\u5DEE\u4E00\u70B9\u5C31\u89C1\u5230\u732A\u516B\u6212\u4E86")),
    signIn: scene(line("\u53C8\u662F\u65B0\u7684\u4E00\u5929\uFF0C\u6211\u8FD8\u5728\uFF0C\u4F60\u4E5F\u5728"), line("\u7B2C 7 \u5929\u6709\u5927\u793C\uFF0C\u575A\u6301\u4F4F")),
    gift: scene(line("\u6253\u5F00\u770B\u770B\uFF1F\u6211\u4E5F\u4E0D\u77E5\u9053\u662F\u4EC0\u4E48"), line("\u6211\u66FF\u4F60\u5B88\u7740\u5B83\u597D\u4E45\u4E86")),
    pomodoroStart: scene(line("\u6211\u95ED\u5634\u4E86\uFF0C\u4ECE\u73B0\u5728\u5F00\u59CB"), line("\u4E13\u5FC3\uFF01\u6211\u5E2E\u4F60\u77AA\u7740\u5C4F\u5E55"), line("\u6211\u5F53\u4E00\u5757\u5B89\u9759\u7684\u4E94\u82B1\u8089")),
    pomodoroDone: scene(line("\u505A\u5B8C\u4E86\uFF01\u5956\u52B1\u81EA\u5DF1\u6478\u4E00\u4E0B\u732A"), line("\u4F60\u597D\u5389\u5BB3\uFF0C\u6211\u90FD\u770B\u7761\u7740\u4E86"), line("\u8D77\u6765\u8D70\u8D70\uFF0C\u987A\u4FBF\u770B\u770B\u6211")),
    pomodoroAbandon: scene(line("\u6CA1\u5173\u7CFB\uFF0C\u756A\u8304\u4E5F\u4F1A\u7D2F"), line("\u90A3\u6211\u4EEC\u5148\u5403\u70B9\u4E1C\u897F\uFF1F"), line("\u4E0B\u6B21\u518D\u4E00\u8D77\u52AA\u529B")),
    // ---- 新场景 ----------------------------------------------------------------
    workStart: scene(line("\u51FA\u95E8\u642C\u7816\u53BB\u4E86"), line("\u6211\u53BB\u7ED9\u5BB6\u91CC\u6323\u9972\u6599\u94B1"), line("\u8001\u677F\uFF0C\u6211\u6765\u4E86\uFF01")),
    studyStart: scene(line("\u4E0A\u5B66\u53BB\uFF01\u4E66\u5305\u91CC\u88C5\u7684\u662F\u96F6\u98DF"), line("\u4ECA\u5929\u4E5F\u8981\u542C\u61C2\u4E00\u53E5"), line("\u8001\u5E08\u522B\u70B9\u6211\u540D")),
    tripStart: scene(line("\u51FA\u53D1\u5566\uFF01"), line("\u6211\u4F1A\u7ED9\u4F60\u5E26\u7279\u4EA7\u7684\uFF08\u4E0D\u662F\u814A\u8089\uFF09"), line("\u8DEF\u4E0A\u522B\u60F3\u6211")),
    buy: scene(line("\u4E70\u5230\u4E86\uFF01"), line("\u8FD9\u4E2A\u94B1\u82B1\u5F97\u503C"), line("\u8C22\u8C22\u8001\u677F\uFF08\u6211\u8BF4\u7684\u662F\u4F60\uFF09")),
    poor: scene(line("\u94B1\u5305\u7A7A\u7A7A\uFF0C\u8DDF\u6211\u7684\u996D\u76C6\u4E00\u6837"), line("\u6211\u4EEC\u597D\u50CF\u6709\u70B9\u7A77"), line("\u8981\u4E0D\u2026\u2026\u6211\u53BB\u6253\u5DE5\uFF1F")),
    fishCatch: scene(line("\u9493\u5230\u5566\uFF01"), line("\u665A\u996D\u6709\u7740\u843D\u4E86"), line("\u8FD9\u6761\u9C7C\u770B\u6211\u7684\u773C\u795E\u4E0D\u592A\u53CB\u597D")),
    fishRare: scene(line("\u662F\u5927\u7684\uFF01\u662F\u5927\u7684\uFF01"), line("\u8FD9\u6761\u9C7C\u503C\u5F97\u5199\u8FDB\u65E5\u8BB0"), line("\u5FEB\u62CD\u7167\uFF01")),
    fishEscape: scene(line("\u5B83\u8DD1\u4E86\u2026\u2026"), line("\u4E0B\u4E00\u6761\u4E00\u5B9A\u662F\u6211\u7684"), line("\u9C7C\u4E5F\u662F\u8981\u9762\u5B50\u7684")),
    skin: scene(line("\u597D\u770B\u5417\uFF1F"), line("\u65B0\u8863\u670D\uFF01\u8F6C\u4E2A\u5708\u7ED9\u4F60\u770B"), line("\u6211\u89C9\u5F97\u6211\u53D8\u5E05\u4E86")),
    bodyChange: scene(line("\u6211\u597D\u50CF\u2026\u2026\u5706\u4E86\u4E00\u70B9"), line("\u8FD9\u4E0D\u662F\u80D6\uFF0C\u662F\u53EF\u7231\u7684\u5BC6\u5EA6\u53D8\u5927\u4E86"), line("\u79E4\u8BF4\u7684\u8BDD\u4E0D\u80FD\u5168\u4FE1")),
    // ---- 按时间说话（core/talk.js 决定什么时候说）---------------------------------
    morning: scene(line("\u65E9\u4E0A\u597D\uFF01\u4ECA\u5929\u4E5F\u8981\u597D\u597D\u5403\u996D"), line("\u8D77\u8FD9\u4E48\u65E9\uFF0C\u4F60\u662F\u8981\u53BB\u5F53\u65E9\u9910\u5417\uFF08\u6211\u5F00\u73A9\u7B11\u7684\uFF09"), line("\u65E9\u5B89\uFF0C[\u4E3B\u4EBA]\uFF0C\u6211\u6628\u665A\u68A6\u89C1\u4F60\u4E86")),
    noon: scene(line("\u4E2D\u5348\u4E86\uFF0C\u5403\u996D\u5403\u996D\uFF01"), line("\u4F60\u5403\u4E86\u5417\uFF1F\u6211\u997F\u4E86\uFF0C\u4F60\u80AF\u5B9A\u4E5F\u997F\u4E86"), line("\u5348\u996D\u522B\u5403\u732A\u8089\u597D\u4E0D\u597D", "\u597D")),
    afternoon: scene(line("\u4E0B\u5348\u597D\u56F0\u2026\u2026\u6211\u5148\u7761\u4E3A\u656C"), line("\u559D\u676F\u8336\u5427\uFF0C\u6211\u966A\u4F60\u53D1\u4F1A\u513F\u5446"), line("\u4E0B\u5348\u6700\u9002\u5408\u6253\u76F9\uFF0C\u79D1\u5B66\u7814\u7A76\uFF08\u6211\u7F16\u7684\uFF09")),
    evening: scene(line("\u5929\u9ED1\u4E86\uFF0C\u4ECA\u5929\u8F9B\u82E6\u5566"), line("\u665A\u996D\u5403\u4EC0\u4E48\uFF1F\u6211\u6295\u7968\u7ED9\u82F9\u679C"), line("\u4E0B\u73ED\u4E86\u5417\uFF1F\u8FD8\u6CA1\uFF1F\u6211\u7B49\u4F60")),
    lateNight: scene(line("\u8FD9\u4E48\u665A\u4E86\u8FD8\u4E0D\u7761\uFF1F", "\u9A6C\u4E0A\u7761"), line("\u71AC\u591C\u7684\u4EBA\u4F1A\u53D8\u6210\u718A\u732B\uFF0C\u71AC\u591C\u7684\u732A\u4F1A\u53D8\u6210\u814A\u8089"), line("\u6211\u5148\u7761\u4E86\uFF0C\u4F60\u4E5F\u65E9\u70B9")),
    deepNight: scene(line("[\u4E3B\u4EBA]\u2026\u2026\u73B0\u5728\u662F\u51CC\u6668\uFF0C\u4F60\u662F\u8BA4\u771F\u7684\u5417"), line("\u6211\u5DF2\u7ECF\u7761\u9192\u4E00\u89C9\u4E86\uFF0C\u4F60\u8FD8\u5728"), line("\u5929\u5FEB\u4EAE\u4E86\uFF0C\u6C42\u4F60\u7761\u4E00\u4F1A\u513F")),
    water: scene(line("\u559D\u53E3\u6C34\u5427\uFF0C\u6211\u66FF\u4F60\u559D\u4E0D\u4E86"), line("\u5634\u5507\u5E72\u4E86\u5427\uFF1F\u53BB\u5012\u676F\u6C34"), line("\u559D\u6C34\u65F6\u95F4\u5230\uFF01\u5495\u561F\u5495\u561F")),
    eyes: scene(line("\u770B\u770B\u8FDC\u5904\uFF0C\u4E09\u5341\u79D2\u5C31\u597D"), line("\u773C\u775B\u7D2F\u4E86\uFF0C\u95ED\u4E00\u4F1A\u513F\uFF0C\u6211\u5E2E\u4F60\u770B\u7740"), line("\u7AD9\u8D77\u6765\u4F38\u4E2A\u61D2\u8170\uFF0C\u6211\u4E5F\u4F38\u4E00\u4E2A")),
    weekend: scene(line("\u5468\u672B\u4E86\u8FD8\u6765\u770B\u6211\uFF0C\u4F60\u771F\u597D"), line("\u4ECA\u5929\u4E0D\u4E0A\u73ED\u5427\uFF1F\u90A3\u5C31\u591A\u966A\u6211\u4E00\u4F1A\u513F")),
    newYear: scene(line("\u65B0\u5E74\u5FEB\u4E50\uFF01\u4ECA\u5E74\u4E5F\u8BF7\u591A\u591A\u5582\u6211")),
    valentine: scene(line("\u4ECA\u5929\u7684\u6211\u662F\u9650\u91CF\u7248\u7684\uFF0C\u9001\u7ED9\u4F60")),
    springFestival: scene(line("\u8FC7\u5E74\u597D\uFF01\u2026\u2026\u4ECA\u5E74\u8BF7\u4E00\u5B9A\u4E0D\u8981\u5403\u732A\u8089", "\u4E0D\u5403")),
    lantern: scene(line("\u5403\u6C64\u5706\u5417\uFF1F\u6C64\u5706\u6CA1\u6709\u732A\uFF0C\u6211\u653E\u5FC3\u4E86")),
    qingming: scene(line("\u60F3\u5FF5\u4E00\u4E0B\u4EE5\u524D\u7684\u732A\u2026\u2026\u6211\u662F\u8BF4\u670B\u53CB\u4EEC")),
    labour: scene(line("\u52B3\u52A8\u8282\uFF01\u6211\u51B3\u5B9A\u4ECA\u5929\u4E0D\u52B3\u52A8")),
    children: scene(line("\u6211\u4E5F\u662F\u5C0F\u670B\u53CB\uFF0C\u793C\u7269\u5728\u54EA\uFF1F")),
    dragonBoat: scene(line("\u7CBD\u5B50\u91CC\u6709\u8089\uFF0C\u6211\u9009\u62E9\u770B\u4E0D\u89C1")),
    qixi: scene(line("\u4ECA\u5929\u8981\u548C\u6700\u91CD\u8981\u7684\u4EBA\u5728\u4E00\u8D77\uFF0C\u6240\u4EE5\u6211\u5728\u8FD9\u91CC")),
    midAutumn: scene(line("\u6708\u4EAE\u597D\u5706\uFF0C\u50CF\u6211\u7684\u809A\u5B50")),
    national: scene(line("\u56FD\u5E86\u5FEB\u4E50\uFF01\u653E\u5047\u8BB0\u5F97\u966A\u966A\u6211")),
    christmas: scene(line("\u5723\u8BDE\u5FEB\u4E50\uFF01\u5723\u8BDE\u8001\u4EBA\u4F1A\u7ED9\u732A\u9001\u793C\u7269\u5417")),
    pigBirthday: scene(line("\u4ECA\u5929\u662F\u6211\u7684\u751F\u65E5\uFF01[\u4E3B\u4EBA]\u8BB0\u5F97\u5417\uFF1F", "\u751F\u65E5\u5FEB\u4E50")),
    // ---- 摸不同部位（客户端按点的位置告诉核心是哪儿）----------------------------
    petHead: scene(line("\u6478\u5934\u4F1A\u957F\u4E0D\u9AD8\u7684\u2026\u2026\u7B97\u4E86\uFF0C\u957F\u4E0D\u9AD8\u4E5F\u597D"), line("\u518D\u6478\u6478\u5934\uFF5E"), line("\u6211\u7684\u5934\u5F88\u5706\uFF0C\u662F\u4E0D\u662F\u5F88\u597D\u6478")),
    petEars: scene(line("\u8033\u6735\u597D\u75D2\uFF01"), line("\u522B\u63EA\uFF0C\u4F1A\u53D8\u6210\u732A\u8033\u6735\u2026\u2026\u6211\u672C\u6765\u5C31\u662F"), line("\u5618\uFF0C\u8033\u6735\u5728\u542C\u4F60\u8BF4\u8BDD")),
    petNose: scene(line("\u963F\u2014\u2014\u568F\uFF01"), line("\u9F3B\u5B50\u662F\u7528\u6765\u95FB\u996D\u7684\uFF0C\u4E0D\u662F\u7528\u6765\u6309\u7684"), line("\u54FC\u54FC\uFF01\uFF08\u8FD9\u662F\u6297\u8BAE\uFF09")),
    petBelly: scene(line("\u54C8\u54C8\u54C8\u597D\u75D2\uFF01"), line("\u522B\u6309\u809A\u5B50\uFF0C\u521A\u5403\u9971"), line("\u8F6F\u5427\uFF1F\u4E0D\u8BB8\u8BF4\u300C\u4E94\u82B1\u300D")),
    petBack: scene(line("\u80CC\u4E0A\u90A3\u5757\uFF0C\u5BF9\uFF0C\u5C31\u662F\u90A3\u91CC"), line("\u6309\u6469\u670D\u52A1\uFF0C\u4E94\u661F\u597D\u8BC4"), line("\u4F60\u7684\u624B\u6CD5\u5F88\u4E13\u4E1A")),
    petTail: scene(line("\u522B\u78B0\u5C3E\u5DF4\uFF01\u2026\u2026\u597D\u5427\u53EF\u4EE5\u78B0\u4E00\u4E0B"), line("\u6211\u7684\u5C3E\u5DF4\u4F1A\u81EA\u5DF1\u8F6C\uFF0C\u4F60\u770B"), line("\u5C3E\u5DF4\u662F\u732A\u7684\u79D8\u5BC6\u6B66\u5668")),
    petFeet: scene(line("\u811A\u4E0D\u80FD\u6478\uFF0C\u4F1A\u75D2"), line("\u6211\u7684\u8E44\u5B50\u521A\u8D70\u8FC7\u6CE5\u5DF4\u54E6"), line("\u5E72\u561B\uFF0C\u60F3\u8DDF\u6211\u63E1\u624B\uFF1F", "\u63E1\u624B")),
    petTooMuch: scene(line("\u591F\u4E86\u591F\u4E86\uFF0C\u6BDB\u8981\u6389\u4E86"), line("\u4F60\u662F\u4E0D\u662F\u5728\u627E\u54EA\u5757\u6700\u5AE9\uFF1F"), line("\u6211\u8981\u6536\u8D39\u4E86\uFF0C\u4E00\u4E0B\u4E00\u4E2A\u82F9\u679C"), line("\u518D\u6478\u6211\u5C31\u751F\u6C14\u4E86\uFF01\uFF08\u5176\u5B9E\u6CA1\u6709\uFF09"), line("\u8BA9\u6211\u4F11\u606F\u4E00\u4E0B\u2026\u2026"))
  });
  var TALK_SLOTS = Object.freeze([
    Object.freeze({ scene: "morning", from: 6, to: 9 }),
    Object.freeze({ scene: "noon", from: 11, to: 13 }),
    Object.freeze({ scene: "afternoon", from: 14, to: 16 }),
    Object.freeze({ scene: "evening", from: 18, to: 20 }),
    Object.freeze({ scene: "lateNight", from: 23, to: 2 }),
    Object.freeze({ scene: "deepNight", from: 2, to: 5 })
  ]);
  var SOLAR_HOLIDAYS = Object.freeze({
    "01-01": "newYear",
    "02-14": "valentine",
    "05-01": "labour",
    "06-01": "children",
    "10-01": "national",
    "12-25": "christmas"
  });
  var DATED_HOLIDAYS = Object.freeze({
    "2026-02-17": "springFestival",
    "2026-03-03": "lantern",
    "2026-04-05": "qingming",
    "2026-06-19": "dragonBoat",
    "2026-08-19": "qixi",
    "2026-09-25": "midAutumn",
    "2027-02-06": "springFestival",
    "2027-02-20": "lantern",
    "2027-04-05": "qingming",
    "2027-06-09": "dragonBoat",
    "2027-08-08": "qixi",
    "2027-09-15": "midAutumn",
    "2028-01-26": "springFestival",
    "2028-02-09": "lantern",
    "2028-04-04": "qingming",
    "2028-05-28": "dragonBoat",
    "2028-08-26": "qixi",
    "2028-10-03": "midAutumn",
    "2029-02-13": "springFestival",
    "2029-02-27": "lantern",
    "2029-04-04": "qingming",
    "2029-06-16": "dragonBoat",
    "2029-08-16": "qixi",
    "2029-09-22": "midAutumn"
  });
  var PET_PARTS = Object.freeze({
    head: "petHead",
    ears: "petEars",
    nose: "petNose",
    belly: "petBelly",
    back: "petBack",
    tail: "petTail",
    feet: "petFeet"
  });
  var PET_ANNOYED = Object.freeze({ windowMs: 3e4, after: 8, calmMs: 6e4 });

  // packages/pet-core/src/data/lines.js
  var IDLE_CHAT_MINUTES2 = Object.freeze({ min: 20, max: 40 });
  var line2 = (text, reply) => Object.freeze(reply === void 0 ? { text } : { text, replies: Object.freeze([Object.freeze({ label: reply })]) });
  var scene2 = (...lines) => Object.freeze(lines);
  var BASE_LINES = Object.freeze({
    // --- 照顾 -----------------------------------------------------------------
    eat: scene2(
      line2("\u597D\u5403\uFF01\u8FD8\u6709\u5417\uFF1F", "\u771F\u4E56"),
      line2("\u5427\u5527\u5427\u5527\u2026\u2026"),
      line2("[\u4E3B\u4EBA]\u6700\u597D\u4E86\uFF5E"),
      line2("\u8FD9\u4E2A\u5473\u9053\u6211\u8BB0\u4F4F\u4E86"),
      line2("\u5403\u9971\u9971\u624D\u6709\u529B\u6C14\u966A\u4F60\u52A0\u73ED"),
      line2("\u55DD\u2014\u2014\uFF08\u4E0D\u597D\u610F\u601D\uFF09")
    ),
    full: scene2(
      line2("\u5403\u9971\u5566\uFF0C\u809A\u5B50\u5706\u6EDA\u6EDA\u7684"),
      line2("\u597D\u9971\u597D\u9971\uFF0C\u518D\u5403\u5C31\u8981\u6491\u7740\u4E86"),
      line2("\u55DD\u2014\u2014\u8C22\u8C22[\u4E3B\u4EBA]\uFF0C\u9971\u9971\u7684")
    ),
    overfull: scene2(
      line2("\u6491\u2026\u2026\u6491\u4F4F\u4E86\u2026\u2026"),
      line2("\u771F\u7684\u5403\u4E0D\u4E0B\u4E86\uFF0C\u4F60\u770B\u6211\u809A\u5B50"),
      line2("\u518D\u5582\u6211\u5C31\u8981\u53D8\u6210\u7403\u4E86", "\u6700\u540E\u4E00\u53E3")
    ),
    bathe: scene2(
      line2("\u9999\u55B7\u55B7\u7684\uFF01"),
      line2("\u6C34\u6709\u70B9\u51C9\u2026\u2026", "\u9A6C\u4E0A\u64E6\u5E72"),
      line2("\u6413\u6413\u80CC\uFF0C\u8212\u670D\uFF5E"),
      line2("\u6CE1\u6CE1\uFF01\u662F\u6CE1\u6CE1\uFF01"),
      line2("\u6D17\u5E72\u51C0\u4E86\uFF0C\u53EF\u4EE5\u62B1\u4E86")
    ),
    play: scene2(
      line2("\u518D\u6765\u4E00\u6B21\uFF01"),
      line2("\u63A5\u4F4F\u5566\uFF01", "\u771F\u68D2"),
      line2("\u54C8\u54C8\u54C8\u597D\u597D\u73A9"),
      line2("\u6211\u8DD1\u5F97\u6BD4\u7403\u5FEB"),
      line2("\u73A9\u7D2F\u4E86\u2026\u2026\u518D\u73A9\u4E94\u5206\u949F")
    ),
    pet: scene2(
      line2("\u597D\u8212\u670D\u2026\u2026"),
      line2("\u518D\u6478\u6478\uFF5E", "\u597D"),
      line2("\u547C\u565C\u547C\u565C\u2026\u2026"),
      line2("\uFF08\u772F\u8D77\u773C\u775B\uFF09"),
      line2("\u8FD9\u91CC\u8FD9\u91CC\uFF01\u5DE6\u8FB9\u4E00\u70B9\uFF01"),
      line2("\u5514\u2026\u2026\u597D\u75D2"),
      line2("[\u4E3B\u4EBA]\u7684\u624B\u6696\u6696\u7684")
    ),
    // --- 状态提醒（闲着时优先说这些）-------------------------------------------
    hungry: scene2(
      line2("\u809A\u5B50\u5495\u5495\u53EB\u4E86\u2026\u2026"),
      line2("[\u4E3B\u4EBA]\uFF0C\u996D\u996D\uFF01", "\u9A6C\u4E0A\u6765"),
      line2("\u6211\u53EF\u4EE5\u5403\u4E00\u6574\u4E2A\u82F9\u679C\u6811")
    ),
    dirty: scene2(
      line2("\u8EAB\u4E0A\u6709\u70B9\u75D2\u75D2\u7684"),
      line2("\u6211\u662F\u4E0D\u662F\u6709\u70B9\u5473\u9053\u4E86\u2026\u2026"),
      line2("\u60F3\u6D17\u6CE1\u6CE1\u6D74", "\u597D\uFF0C\u8FD9\u5C31\u6D17")
    ),
    lonely: scene2(
      line2("[\u4E3B\u4EBA]\u5728\u5FD9\u4EC0\u4E48\u5440\uFF1F"),
      line2("\u4F60\u597D\u4E45\u6CA1\u7406\u6211\u4E86\u2026\u2026", "\u966A\u4F60\u4E00\u4F1A\u513F"),
      line2("\u6211\u4E00\u4E2A\u4EBA\u5728\u8FD9\u513F\u6570\u50CF\u7D20")
    ),
    idle: scene2(
      line2("\uFF08\u6253\u4E86\u4E2A\u54C8\u6B20\uFF09"),
      line2("\u4ECA\u5929\u5929\u6C14\u597D\u50CF\u4E0D\u9519"),
      line2("\u4F60\u5199\u7684\u4EE3\u7801\u6211\u770B\u61C2\u4E86\u4E00\u884C\uFF01"),
      line2("\u8981\u4E0D\u8981\u4F11\u606F\u4E00\u4E0B\u773C\u775B\uFF1F", "\u597D"),
      line2("\u6211\u5728\u60F3\u665A\u996D\u5403\u4EC0\u4E48"),
      line2("\uFF08\u5728\u89D2\u843D\u91CC\u6EDA\u4E86\u4E00\u5708\uFF09"),
      line2("[\u4E3B\u4EBA]\u52A0\u6CB9\uFF0C\u6211\u5728\u65C1\u8FB9\u770B\u7740"),
      line2("\u521A\u624D\u90A3\u4E2A\u62A5\u9519\u6211\u4E5F\u770B\u89C1\u4E86\u2026\u2026")
    ),
    // --- 出门 -----------------------------------------------------------------
    workDone: scene2(
      line2("\u6211\u56DE\u6765\u5566\uFF01\u8D5A\u5230\u94B1\u4E86\uFF01", "\u8F9B\u82E6\u4E86"),
      line2("\u4ECA\u5929\u8001\u677F\u5938\u6211\u4E86"),
      line2("\u7D2F\u662F\u7D2F\u4E86\u70B9\uFF0C\u4F46\u662F\u6709\u94B1\u4E86")
    ),
    tired: scene2(
      line2("\u597D\u7D2F\u554A\u2026\u2026", "\u6B47\u4F1A\u513F\u5427"),
      line2("\u80FD\u4E0D\u80FD\u5148\u8BA9\u6211\u8EBA\u4E00\u4E0B"),
      line2("\u518D\u5E72\u4E0B\u53BB\u6211\u8981\u5934\u6655\u4E86")
    ),
    study: scene2(
      line2("\u4ECA\u5929\u5B66\u5230\u597D\u591A\uFF01", "\u771F\u4E56"),
      line2("\u8001\u5E08\u8BB2\u7684\u6211\u90FD\u542C\u61C2\u4E86\uFF08\u5927\u6982\uFF09"),
      line2("\u4F5C\u4E1A\u2026\u2026\u660E\u5929\u518D\u8BF4")
    ),
    graduate: scene2(
      line2("\u6211\u6BD5\u4E1A\u5566\uFF01\u6211\u6CA1\u6709\u7559\u7EA7\uFF01", "\u771F\u68D2"),
      line2("\u770B\uFF0C\u6211\u7684\u6BD5\u4E1A\u7167\uFF01"),
      line2("\u4E0B\u4E00\u6BB5\u6211\u4E5F\u80FD\u5FF5\u5B8C")
    ),
    tripBack: scene2(
      line2("\u6211\u7ED9\u4F60\u5E26\u4E86\u4E1C\u897F\uFF01", "\u662F\u4EC0\u4E48\uFF1F"),
      line2("\u5916\u9762\u597D\u5927\u554A"),
      line2("\u4E0B\u6B21\u5E26\u4F60\u4E00\u8D77\u53BB")
    ),
    // --- 生病 -----------------------------------------------------------------
    sick: scene2(
      line2("\u963F\u2014\u2014\u568F\uFF01[\u4E3B\u4EBA]\uFF0C\u6211\u597D\u50CF\u75C5\u4E86\u2026\u2026", "\u4E56\uFF0C\u5403\u836F"),
      line2("\u5934\u6709\u70B9\u6655\u6655\u7684"),
      line2("\u6211\u4E0D\u60F3\u52A8\u2026\u2026")
    ),
    wrongMedicine: scene2(
      line2("\u8FD9\u836F\u597D\u82E6\u2026\u2026\u597D\u50CF\u4E0D\u662F\u8FD9\u4E2A", "\u5BF9\u4E0D\u8D77"),
      line2("\u545C\uFF0C\u66F4\u96BE\u53D7\u4E86"),
      line2("[\u4E3B\u4EBA]\u4F60\u662F\u4E0D\u662F\u770B\u9519\u8BF4\u660E\u4E66\u4E86")
    ),
    cured: scene2(
      line2("\u6211\u597D\u5566\uFF01\u8C22\u8C22[\u4E3B\u4EBA]\uFF5E", "\u771F\u4E56"),
      line2("\u53C8\u80FD\u8DD1\u80FD\u8DF3\u4E86\uFF01"),
      line2("\u4EE5\u540E\u6211\u4F1A\u4E56\u4E56\u5403\u996D\u7684")
    ),
    // --- 成长与生死 -------------------------------------------------------------
    levelup: scene2(
      line2("\u6211\u53C8\u957F\u5927\u4E86\u4E00\u70B9\uFF01", "\u771F\u4E56"),
      line2("\u611F\u89C9\u81EA\u5DF1\u53D8\u5389\u5BB3\u4E86"),
      line2("\u4F60\u770B\u6211\u662F\u4E0D\u662F\u9AD8\u4E86\u4E00\u70B9")
    ),
    growUp: scene2(
      line2("\u6211\u957F\u5927\u5566\uFF01"),
      line2("\u4EE5\u524D\u7684\u8863\u670D\u597D\u50CF\u7A7F\u4E0D\u4E0B\u4E86"),
      line2("[\u4E3B\u4EBA]\uFF0C\u6211\u73B0\u5728\u662F\u5927\u732A\u4E86")
    ),
    coronation: scene2(
      line2("\u738B\u51A0\u6709\u70B9\u91CD\uFF0C\u4F46\u6211\u4F1A\u597D\u597D\u6234\u7740\u7684\uFF0C[\u4E3B\u4EBA]\u3002", "\u4F60\u53EF\u4EE5\u7684"),
      line2("\u4ECE\u4ECA\u5929\u8D77\uFF0C\u96F6\u98DF\u4E5F\u7B97\u738B\u5BA4\u4E8B\u52A1\uFF01"),
      line2("\u6211\u5BA3\u5E03\uFF1A[\u4E3B\u4EBA]\u6C38\u8FDC\u662F\u6211\u7684\u7B2C\u4E00\u4F4D\u8D35\u5BA2\u3002"),
      line2("\u54B3\u54B3\uFF0C\u672C\u738B\u60F3\u5148\u5403\u4E2A\u82F9\u679C\u3002")
    ),
    contract: scene2(
      line2("\u5951\u7EA6\u7B7E\u597D\u4E86\u3002\u5148\u8BF4\u597D\uFF0C\u6211\u8FD8\u662F\u4F60\u90A3\u53EA\u732A\u3002", "\u5F53\u7136"),
      line2("\u89D2\u957F\u51FA\u6765\u4E86\uFF0C\u6492\u5A07\u7684\u672C\u4E8B\u53EF\u6CA1\u4E22\u3002"),
      line2("\u6076\u9B54\u4E5F\u8981\u5403\u996D\u5440\uFF0C[\u4E3B\u4EBA]\u3002"),
      line2("\u8FD9\u7B14\u4EA4\u6613\u6211\u8D5A\u4E86\uFF1A\u4EE5\u540E\u8FD8\u80FD\u548C\u4F60\u5728\u4E00\u8D77\u3002")
    ),
    enter: scene2(
      line2("[\u4E3B\u4EBA]\u4F60\u56DE\u6765\u5566\uFF01", "\u56DE\u6765\u4E86"),
      line2("\u7B49\u4F60\u597D\u4E45\u4E86\uFF5E"),
      line2("\u4ECA\u5929\u4E5F\u8981\u4E00\u8D77\u52A0\u6CB9\u54E6")
    ),
    death: scene2(
      line2("[\u4E3B\u4EBA]\u4FDD\u91CD\uFF0C\u6211\u8D70\u4E86\uFF0C\u4E0D\u5E26\u8D70\u4E00\u7247\u4E91\u5F69\uFF5E"),
      line2("\u4E0B\u8F88\u5B50\u8FD8\u7ED9\u4F60\u5F53\u732A")
    ),
    revive: scene2(
      line2("\u6211\u2026\u2026\u6211\u56DE\u6765\u4E86\uFF1F"),
      line2("\u90A3\u8FB9\u597D\u51B7\uFF0C\u8FD8\u662F\u8FD9\u91CC\u597D"),
      line2("\u8C22\u8C22\u4F60\u6CA1\u653E\u5F03\u6211", "\u6B22\u8FCE\u56DE\u6765")
    ),
    // --- B5 用 ------------------------------------------------------------------
    signIn: scene2(
      line2("\u7B7E\u5230\u5566\uFF01\u4ECA\u5929\u4E5F\u8981\u597D\u597D\u7684"),
      line2("\u8FD9\u662F\u4ECA\u5929\u7684\u793C\u7269\uFF0C\u7ED9\u4F60\uFF5E")
    ),
    gift: scene2(
      line2("\u6211\u5728\u5730\u4E0A\u6361\u5230\u4E00\u4E2A\u76D2\u5B50\uFF01"),
      line2("\u966A\u4F60\u8FD9\u4E48\u4E45\uFF0C\u8FD9\u662F\u5956\u52B1")
    ),
    // --- C2 番茄钟 --------------------------------------------------------------
    pomodoroStart: scene2(
      line2("[\u4E3B\u4EBA]\u5FD9\u5427\uFF0C\u6211\u8DB4\u8FD9\u513F\u4E0D\u52A8"),
      line2("\u4E13\u6CE8\u6A21\u5F0F\uFF01\u6211\u5E2E\u4F60\u770B\u7740\u65F6\u95F4"),
      line2("\u8FD9 25 \u5206\u949F\u6211\u4E5F\u4E0D\u5435\u4F60\uFF0C\u8BF4\u597D\u4E86")
    ),
    pomodoroDone: scene2(
      line2("\u65F6\u95F4\u5230\uFF01[\u4E3B\u4EBA]\u771F\u5389\u5BB3"),
      line2("\u505A\u5B8C\u4E00\u4E2A\u5566\uFF0C\u8D77\u6765\u52A8\u52A8\u8116\u5B50"),
      line2("\u6211\u966A\u4F60\u6570\u7740\u5462\uFF0C\u4E00\u4E2A\u90FD\u4E0D\u5C11")
    ),
    pomodoroAbandon: scene2(
      line2("\u4E0D\u505A\u4E86\u5440\uFF1F\u90A3\u5C31\u6B47\u4F1A\u513F"),
      line2("\u6CA1\u4E8B\uFF0C\u7B49\u4F60\u51C6\u5907\u597D\u518D\u6765"),
      line2("\u6211\u5148\u628A\u756A\u8304\u6536\u8D77\u6765\u5566")
    )
  });
  var LINES = Object.freeze(Object.fromEntries(
    [.../* @__PURE__ */ new Set([...Object.keys(BASE_LINES), ...Object.keys(MORE_LINES)])].map((key) => [key, Object.freeze([...BASE_LINES[key] ?? [], ...MORE_LINES[key] ?? []])])
  ));
  var LINE_SCENES = Object.freeze(Object.keys(LINES));

  // packages/pet-core/src/data/minutes.js
  var MINUTES = Object.freeze({
    quarter: 15,
    half: 30,
    fortyFive: 45,
    hour: 60,
    ninety: 90,
    twoHours: 120,
    threeHours: 180,
    fourHours: 240,
    fiveHours: 300,
    sixHours: 360,
    eightHours: 480,
    halfDay: 720,
    day: 1440
  });

  // packages/pet-core/src/data/interests.js
  var INTERESTS = Object.freeze([
    Object.freeze({ key: "photography", label: "\u6444\u5F71", emoji: "\u{1F4F7}", trait: "charm", minutes: MINUTES.half, cost: 40, gain: 2, certificate: "\u6444\u5F71\u8BC1", blurb: "\u4F1A\u62CD\u7167\u7684\u732A\uFF0C\u8D70\u5230\u54EA\u90FD\u4E0A\u76F8" }),
    Object.freeze({ key: "coding", label: "\u7F16\u7A0B", emoji: "\u{1F4BB}", trait: "intel", minutes: MINUTES.hour, cost: 80, gain: 2, certificate: "\u7F16\u7A0B\u8BC1", blurb: "\u5B66\u4F1A\u8BA9\u522B\u7684\u732A\u5E72\u6D3B" }),
    Object.freeze({ key: "dancing", label: "\u8DF3\u821E", emoji: "\u{1F483}", trait: "charm", minutes: MINUTES.half, cost: 45, gain: 2, certificate: "\u8DF3\u821E\u8BC1", blurb: "\u4F1A\u8DF3\u821E\u7684\u732A\u4E0D\u602F\u573A" }),
    Object.freeze({ key: "fitness", label: "\u5065\u8EAB", emoji: "\u{1F3CB}", trait: "strong", minutes: MINUTES.half, cost: 35, gain: 2, certificate: "\u5065\u8EAB\u8BC1", blurb: "\u4E3E\u5F97\u52A8\u66F4\u91CD\u7684\u4E1C\u897F" }),
    // --- 2026-10-01 用户要求多一些：每一维各加四门，证书先当收藏，以后可以挂新职业 ---
    // 🧠 智力
    Object.freeze({ key: "weiqi", label: "\u56F4\u68CB", emoji: "\u265F\uFE0F", trait: "intel", minutes: MINUTES.half, cost: 45, gain: 2, certificate: "\u56F4\u68CB\u8BC1", blurb: "\u4E0B\u68CB\u7684\u65F6\u5019\u4E00\u52A8\u4E0D\u52A8\uFF0C\u50CF\u7761\u7740\u4E86" }),
    Object.freeze({ key: "english", label: "\u82F1\u8BED", emoji: "\u{1F524}", trait: "intel", minutes: MINUTES.half, cost: 40, gain: 2, certificate: "\u82F1\u8BED\u8BC1", blurb: "Oink oink, hello" }),
    Object.freeze({ key: "astronomy", label: "\u5929\u6587", emoji: "\u{1F52D}", trait: "intel", minutes: MINUTES.hour, cost: 90, gain: 2, certificate: "\u5929\u6587\u8BC1", blurb: "\u8BA4\u5F97\u51FA\u54EA\u9897\u661F\u661F\u50CF\u732A\u9F3B\u5B50" }),
    Object.freeze({ key: "cube", label: "\u9B54\u65B9", emoji: "\u{1F9E9}", trait: "intel", minutes: MINUTES.half, cost: 35, gain: 2, certificate: "\u9B54\u65B9\u8BC1", blurb: "\u8E44\u5B50\u8F6C\u5F97\u6BD4\u624B\u8FD8\u5FEB" }),
    // ✨ 魅力
    Object.freeze({ key: "calligraphy", label: "\u4E66\u6CD5", emoji: "\u{1F58C}\uFE0F", trait: "charm", minutes: MINUTES.half, cost: 40, gain: 2, certificate: "\u4E66\u6CD5\u8BC1", blurb: "\u5199\u7684\u300C\u732A\u300D\u5B57\u7279\u522B\u6709\u795E" }),
    Object.freeze({ key: "guitar", label: "\u5409\u4ED6", emoji: "\u{1F3B8}", trait: "charm", minutes: MINUTES.half, cost: 50, gain: 2, certificate: "\u5409\u4ED6\u8BC1", blurb: "\u4F1A\u5F39\u4E09\u4E2A\u548C\u5F26\u5C31\u591F\u7528\u4E86" }),
    Object.freeze({ key: "magic", label: "\u9B54\u672F", emoji: "\u{1F3A9}", trait: "charm", minutes: MINUTES.hour, cost: 85, gain: 2, certificate: "\u9B54\u672F\u8BC1", blurb: "\u80FD\u4ECE\u5E3D\u5B50\u91CC\u53D8\u51FA\u4E00\u4E2A\u82F9\u679C" }),
    Object.freeze({ key: "ikebana", label: "\u63D2\u82B1", emoji: "\u{1F490}", trait: "charm", minutes: MINUTES.half, cost: 35, gain: 2, certificate: "\u63D2\u82B1\u8BC1", blurb: "\u63D2\u7740\u63D2\u7740\u628A\u82B1\u5403\u4E86" }),
    // 💪 武力
    Object.freeze({ key: "swimming", label: "\u6E38\u6CF3", emoji: "\u{1F3CA}", trait: "strong", minutes: MINUTES.half, cost: 40, gain: 2, certificate: "\u6E38\u6CF3\u8BC1", blurb: "\u4F1A\u72D7\u5228\uFF0C\u4E0D\u5BF9\uFF0C\u732A\u5228" }),
    Object.freeze({ key: "skating", label: "\u8F6E\u6ED1", emoji: "\u{1F6FC}", trait: "strong", minutes: MINUTES.half, cost: 45, gain: 2, certificate: "\u8F6E\u6ED1\u8BC1", blurb: "\u56DB\u53EA\u8E44\u5B50\uFF0C\u56DB\u53CC\u978B" }),
    Object.freeze({ key: "climbing", label: "\u6500\u5CA9", emoji: "\u{1F9D7}", trait: "strong", minutes: MINUTES.hour, cost: 90, gain: 2, certificate: "\u6500\u5CA9\u8BC1", blurb: "\u722C\u5F97\u4E0A\u53BB\uFF0C\u4E0B\u6765\u8981\u4EBA\u62B1" }),
    Object.freeze({ key: "football", label: "\u8DB3\u7403", emoji: "\u26BD", trait: "strong", minutes: MINUTES.half, cost: 35, gain: 2, certificate: "\u8DB3\u7403\u8BC1", blurb: "\u6700\u559C\u6B22\u7528\u5934\u9876\u7403" })
  ]);

  // packages/pet-core/src/data/school.js
  var subject = (key, label, emoji, trait, secondary = null) => Object.freeze({ key, label, emoji, trait, secondary });
  var SUBJECTS = Object.freeze([
    subject("chinese", "\u8BED\u6587", "\u{1F4D6}", "intel", "charm"),
    subject("mathematics", "\u6570\u5B66", "\u{1F522}", "intel"),
    subject("politics", "\u653F\u6CBB", "\u2696\uFE0F", "intel", "strong"),
    subject("music", "\u97F3\u4E50", "\u{1F3B5}", "charm"),
    subject("art", "\u827A\u672F", "\u{1F3A8}", "charm", "intel"),
    subject("manners", "\u793C\u4EEA", "\u{1F3A9}", "charm"),
    subject("pe", "\u4F53\u80B2", "\u{1F3C3}", "strong", "charm"),
    subject("labour", "\u52B3\u6280", "\u{1F527}", "strong", "intel"),
    subject("wushu", "\u6B66\u672F", "\u{1F94B}", "strong")
  ]);
  var SCHOOL_STAGES = Object.freeze([
    Object.freeze({ key: "primary", label: "\u5C0F\u5B66", emoji: "\u{1F4DA}", upTo: 9, minutes: 20, tuition: 10, gain: 1, secondaryGain: 0, satiety: -5, happiness: -1 }),
    Object.freeze({ key: "middle", label: "\u4E2D\u5B66", emoji: "\u{1F3EB}", upTo: 20, minutes: 30, tuition: 25, gain: 2, secondaryGain: 1, satiety: -7, happiness: -2 }),
    Object.freeze({ key: "college", label: "\u5927\u5B66", emoji: "\u{1F3DB}", upTo: 40, minutes: 45, tuition: 60, gain: 3, secondaryGain: 1, satiety: -10, happiness: -3 }),
    Object.freeze({ key: "graduate", label: "\u7814\u7A76\u751F", emoji: "\u{1F52C}", upTo: 95, minutes: 60, tuition: 120, gain: 4, secondaryGain: 2, satiety: -12, happiness: -4 }),
    Object.freeze({ key: "beyond", label: "\u5B66\u65E0\u6B62\u5883", emoji: "\u{1F30C}", upTo: Infinity, minutes: 60, tuition: 150, gain: 5, secondaryGain: 2, satiety: -12, happiness: -4 })
  ]);
  var GRADUATION_LESSONS = Object.freeze(SCHOOL_STAGES.filter((stage2) => Number.isFinite(stage2.upTo)).map((stage2) => stage2.upTo));

  // packages/pet-core/src/data/traits.js
  var TRAIT_PAY_PER_POINT = 1 / 150;
  var TRAITS = Object.freeze({
    intel: Object.freeze({ key: "intel", label: "\u667A\u529B", emoji: "\u{1F9E0}" }),
    charm: Object.freeze({ key: "charm", label: "\u9B45\u529B", emoji: "\u2728" }),
    strong: Object.freeze({ key: "strong", label: "\u6B66\u529B", emoji: "\u{1F4AA}" })
  });
  var TRAIT_ORDER = Object.freeze(["intel", "charm", "strong"]);

  // packages/pet-core/src/data/jobs.js
  var COST_BY_MINUTES = Object.freeze({
    30: Object.freeze({ satiety: -6, cleanliness: -4 }),
    45: Object.freeze({ satiety: -8, cleanliness: -6 }),
    60: Object.freeze({ satiety: -15, cleanliness: -12 }),
    120: Object.freeze({ satiety: -18, cleanliness: -10 }),
    240: Object.freeze({ satiety: -34, cleanliness: -26 }),
    480: Object.freeze({ satiety: -60, cleanliness: -40 })
  });
  var job = (key, label, emoji, trait, minutes, coins, requires) => Object.freeze({ key, label, emoji, trait, minutes, coins, ...COST_BY_MINUTES[minutes], requires: Object.freeze(requires) });
  var JOBS = Object.freeze([
    // --- 起步：不用上学 · 30–45 分钟 ------------------------------------------
    job("bricks", "\u642C\u7816", "\u{1F9F1}", "strong", 30, 40, { level: 1 }),
    job("flyers", "\u53D1\u4F20\u5355", "\u{1F4C4}", "charm", 30, 40, { level: 1 }),
    job("dishes", "\u6D17\u7897\u5DE5", "\u{1F37D}", "strong", 30, 45, { level: 3 }),
    job("delivery", "\u9001\u5916\u5356", "\u{1F6F5}", "strong", 45, 70, { level: 5, lessons: { pe: 3 } }),
    // --- 小学毕业（某门课 9 节）· 1 小时 --------------------------------------
    job("mason", "\u6CE5\u74E6\u5DE5", "\u{1F9F1}", "strong", 60, 150, { level: 3, lessons: { labour: 9 } }),
    job("cashier", "\u6536\u94F6\u5458", "\u{1F9FE}", "intel", 60, 150, { level: 5, lessons: { mathematics: 9 } }),
    job("florist", "\u82B1\u5320", "\u{1F490}", "charm", 60, 160, { level: 6, lessons: { manners: 9 } }),
    job("carpenter", "\u6728\u5320", "\u{1FA9A}", "strong", 60, 160, { level: 6, lessons: { labour: 9 } }),
    job("courier", "\u5FEB\u9012\u5458", "\u{1F4E6}", "strong", 60, 170, { level: 8, lessons: { pe: 9, wushu: 9 } }),
    job("gardener", "\u56ED\u4E01", "\u{1F333}", "charm", 60, 180, { level: 9, lessons: { chinese: 9, art: 9 } }),
    job("guard", "\u4FDD\u5B89", "\u{1F6E1}", "strong", 60, 180, { level: 9, lessons: { politics: 9, wushu: 9 } }),
    job("actor", "\u6F14\u5458", "\u{1F3AD}", "charm", 60, 180, { level: 9, lessons: { manners: 9, labour: 9 } }),
    // --- 中学毕业（20 节）· 2 小时 --------------------------------------------
    job("chef", "\u53A8\u5E08", "\u{1F468}\u200D\u{1F373}", "strong", 120, 480, { level: 12, lessons: { labour: 20, manners: 9 } }),
    job("singer", "\u6B4C\u624B", "\u{1F3A4}", "charm", 120, 500, { level: 12, lessons: { music: 20 } }),
    job("lawyer", "\u5F8B\u5E08", "\u2696\uFE0F", "intel", 120, 520, { level: 12, lessons: { politics: 20 } }),
    job("nurse", "\u62A4\u58EB", "\u{1F489}", "charm", 120, 520, { level: 14, lessons: { chinese: 20, manners: 20 } }),
    job("athlete", "\u8FD0\u52A8\u5458", "\u{1F3C5}", "strong", 120, 540, { level: 14, lessons: { pe: 20, wushu: 20 } }),
    job("cartoonist", "\u6F2B\u753B\u5BB6", "\u270F\uFE0F", "charm", 120, 560, { level: 15, lessons: { art: 20, labour: 20 } }),
    job("police", "\u8B66\u5BDF", "\u{1F46E}", "strong", 120, 560, { level: 15, lessons: { politics: 20, wushu: 20 } }),
    job("songwriter", "\u8BCD\u66F2\u4F5C\u8005", "\u{1F3BC}", "charm", 120, 560, { level: 15, lessons: { chinese: 20, music: 20 } }),
    // --- 大学毕业（40 节）· 4 小时 --------------------------------------------
    job("editor", "\u7F16\u8F91", "\u{1F4F0}", "intel", 240, 1500, { level: 18, lessons: { chinese: 40 } }),
    job("photographer", "\u6444\u5F71\u5E08", "\u{1F4F7}", "charm", 240, 1600, { level: 18, lessons: { art: 40 }, certificate: "photography" }),
    job("coach", "\u6559\u7EC3", "\u{1F3CB}", "strong", 240, 1500, { level: 20, lessons: { pe: 40 }, certificate: "fitness" }),
    job("programmer", "\u7A0B\u5E8F\u5458", "\u{1F4BB}", "intel", 240, 1800, { level: 22, lessons: { mathematics: 40 }, certificate: "coding" }),
    job("dancer", "\u821E\u8E48\u5BB6", "\u{1F483}", "charm", 240, 1800, { level: 22, lessons: { music: 40, pe: 40 }, certificate: "dancing" }),
    job("architect", "\u5EFA\u7B51\u5E08", "\u{1F4D0}", "intel", 240, 1800, { level: 24, lessons: { art: 40, mathematics: 40 } }),
    job("doctor", "\u533B\u751F", "\u{1FA7A}", "intel", 240, 2e3, { level: 26, lessons: { chinese: 40, mathematics: 40, politics: 20 } }),
    // --- 研究生（95 节，或九门都到 40）· 8 小时 -------------------------------
    job("scientist", "\u79D1\u7814\u4EBA\u5458", "\u{1F52C}", "intel", 480, 4800, { level: 30, lessons: { chinese: 40, mathematics: 40, art: 40, pe: 40 } }),
    job("official", "\u516C\u52A1\u5458", "\u{1F3DB}", "intel", 480, 5200, { level: 35, every: 40 }),
    job("professor", "\u5927\u5B66\u6559\u6388", "\u{1F468}\u200D\u{1F3EB}", "intel", 480, 5600, { level: 40, anyOf: { count: 3, lessons: 95 } }),
    job("star", "\u660E\u661F", "\u{1F31F}", "charm", 480, 6e3, { level: 40, lessons: { music: 95, manners: 95, art: 40 } }),
    job("astronaut", "\u5B87\u822A\u5458", "\u{1F680}", "strong", 480, 6400, { level: 45, lessons: { mathematics: 95, pe: 95, wushu: 40 } }),
    job("ceo", "\u603B\u88C1", "\u{1F4BC}", "intel", 480, 8e3, { level: 50, lessons: { mathematics: 95, chinese: 95, manners: 95, politics: 40 } })
  ]);

  // packages/pet-core/src/data/illness.js
  var THRESHOLDS = Object.freeze({
    hungry: 25,
    dirty: 35,
    lonely: 35
  });
  var ILLNESS_STAGE_HOURS = Object.freeze([24, 36, 48, 72]);
  var ILLNESS_STAGE_MINUTES = ILLNESS_STAGE_HOURS[0] * 60;
  var SELF_HEAL_CHANCE = Object.freeze([0.25, 0.12, 0.05, 0]);
  var STAGE_HEALTH = Object.freeze([4, 3, 2, 1]);
  var MEDICINE_PRICE_BY_TIER = Object.freeze([30, 70, 140, 260]);
  var medicine = (key, label, emoji, tier) => Object.freeze({ key, label, emoji, tier, price: MEDICINE_PRICE_BY_TIER[tier - 1], kind: "medicine" });
  var stage = (name, cure) => Object.freeze({ name, cure });
  var ILLNESS_CHAINS = Object.freeze([
    Object.freeze({
      key: "cold",
      name: "\u611F\u5192",
      emoji: "\u{1F927}",
      cause: "\u997F",
      stages: Object.freeze([
        stage("\u611F\u5192", medicine("banlangen", "\u677F\u84DD\u6839", "\u{1F33F}", 1)),
        stage("\u53D1\u70E7", medicine("tuishaoyao", "\u9000\u70E7\u836F", "\u{1F48A}", 2)),
        stage("\u91CD\u611F\u5192", medicine("yinqiaowan", "\u94F6\u7FD8\u4E38", "\u{1F7E4}", 3)),
        stage("\u80BA\u708E", medicine("jinse-xiaoyan", "\u91D1\u8272\u6D88\u708E\u6C34", "\u{1F9EA}", 4))
      ])
    }),
    Object.freeze({
      key: "cough",
      name: "\u54B3\u55FD",
      emoji: "\u{1F637}",
      cause: "\u810F",
      stages: Object.freeze([
        stage("\u54B3\u55FD", medicine("pipa-syrup", "\u6787\u6777\u7CD6\u6D46", "\u{1F36F}", 1)),
        stage("\u652F\u6C14\u7BA1\u708E", medicine("gancaoji", "\u7518\u8349\u5242", "\u{1F33E}", 2)),
        stage("\u54EE\u5598", medicine("dingchuanwan", "\u5B9A\u5598\u4E38", "\u26AA", 3)),
        stage("\u80BA\u7ED3\u6838", medicine("tongfengsan", "\u901A\u98CE\u6563", "\u{1FAD9}", 4))
      ])
    }),
    Object.freeze({
      key: "stomach",
      name: "\u80A0\u80C3",
      emoji: "\u{1F922}",
      cause: "\u5403\u6491",
      stages: Object.freeze([
        stage("\u809A\u5B50\u80C0", medicine("xiaoshipian", "\u6D88\u98DF\u7247", "\u{1F48A}", 1)),
        stage("\u80C3\u708E", medicine("lanse-xiaoyan", "\u84DD\u8272\u6D88\u708E\u6C34", "\u{1F9EA}", 2)),
        stage("\u80C3\u6E83\u75A1", medicine("longdancao", "\u9F99\u80C6\u8349", "\u{1F331}", 3)),
        stage("\u80C3\u764C", medicine("xianrentang", "\u4ED9\u4EBA\u6C64", "\u{1F375}", 4))
      ])
    }),
    Object.freeze({
      key: "dizzy",
      name: "\u5934\u6655",
      emoji: "\u{1F635}",
      cause: "\u5FC3\u60C5\u5DEE\u3001\u8FDE\u7EED\u6253\u5DE5\u4E0A\u8BFE",
      stages: Object.freeze([
        stage("\u5934\u6655", medicine("qingliangyou", "\u6E05\u51C9\u6CB9", "\u{1F7E2}", 1)),
        stage("\u504F\u5934\u75DB", medicine("zhitongpian", "\u6B62\u75DB\u7247", "\u{1F48A}", 2)),
        stage("\u795E\u7ECF\u8870\u5F31", medicine("pupu-shenshui", "\u5657\u5657\u795E\u6C34", "\u{1FAE7}", 3)),
        stage("\u5FC3\u529B\u8870\u7AED", medicine("heshouwu", "\u4F55\u9996\u4E4C", "\u{1F954}", 4))
      ])
    }),
    Object.freeze({
      key: "skin",
      name: "\u76AE\u80A4",
      emoji: "\u{1FA79}",
      cause: "\u5F88\u810F",
      stages: Object.freeze([
        stage("\u7619\u75D2", medicine("runfulu", "\u6DA6\u80A4\u9732", "\u{1F9F4}", 1)),
        stage("\u5E72\u88C2", medicine("bohe-you", "\u8584\u8377\u6CB9", "\u{1F343}", 2)),
        stage("\u6E83\u75A1", medicine("shengjigao", "\u751F\u808C\u818F", "\u{1FA79}", 3)),
        stage("\u611F\u67D3", medicine("chashu-you", "\u8336\u6811\u6CB9", "\u{1F333}", 4))
      ])
    })
  ]);
  var CHAIN_INDEX = Object.freeze(Object.fromEntries(ILLNESS_CHAINS.map((chain, index) => [chain.key, index])));
  var CURE_ALL = Object.freeze({ key: "baicaodan", label: "\u767E\u8349\u4E39", emoji: "\u{1F33F}", price: 500, kind: "medicine", cureAll: true });
  var MEDICINES = Object.freeze([
    ...ILLNESS_CHAINS.flatMap((chain) => chain.stages.map((entry) => entry.cure)),
    CURE_ALL
  ]);
  var REVIVE_ITEM = Object.freeze({ key: "soul", label: "\u8FD8\u9B42\u4E39", emoji: "\u2728", price: 800, kind: "revive" });
  var ILLNESS_ONSET = Object.freeze({
    /** Even a well-kept pig: about one small illness every three weeks. */
    basePerHour: 2e-3,
    /** Hungry (satiety < THRESHOLDS.hungry) → 感冒. */
    hungryPerHour: 0.03,
    /** Dirty (cleanliness < THRESHOLDS.dirty) → 咳嗽; below veryDirty → 皮肤. */
    dirtyPerHour: 0.03,
    veryDirty: 15,
    /** Mood below sadBelow → 头晕. */
    sadBelow: 30,
    sadPerHour: 0.05,
    /** This many outings in a row with no rest between → 头晕. */
    overworkStreak: 3,
    overworkPerHour: 0.05,
    /** Minutes at home that count as a rest and reset the streak. */
    restMinutes: 60,
    /** Feeding a pig already at overfullAt satiety → 肠胃, with this chance.
     *  G2（用户 2026-10-05 确认）：已经 100% 还硬喂才可能胀气，概率 25% → 15%。 */
    overfullAt: 100,
    overfeedChance: 0.15
  });

  // src/client/life.js
  var TIME_TALK_MS = 5 * 6e4;
  var WALK_KEY = "dsh-piggy:walk";
  var IDLE_ACTIONS = [
    { key: "roll", fx: ["\u{1F4AB}"], say: "\uFF08\u6EDA\u4E86\u4E00\u5708\uFF09\u8FD9\u6837\u6BD4\u8F83\u8212\u670D", ms: 1400 },
    { key: "nap", fx: [], say: "\u6211\u5C31\u772F\u4E00\u4E0B\u2026\u2026", ms: 4e3 },
    { key: "butterfly", fx: ["\u{1F98B}"], say: "\u7B49\u7B49\u6211\uFF01", ms: 3e3 },
    { key: "scratch", fx: ["\u3030\uFE0F"], say: "\u80CC\u4E0A\u75D2\u75D2\u7684", ms: 2e3 },
    { key: "stretch", fx: ["\u2728"], say: "\u55EF\u2014\u2014\u4F38\u4E2A\u61D2\u8170", ms: 1800 },
    { key: "look", fx: ["\u2753"], say: "\u4F60\u5728\u5199\u4EC0\u4E48\u5440", ms: 2600 },
    { key: "bubbles", fx: ["\u{1FAE7}", "\u{1FAE7}", "\u{1FAE7}"], say: "\u5657\u565C\u565C\u2026\u2026", ms: 2400 }
  ];
  function walkEnabled() {
    return readStore(WALK_KEY) === "on";
  }
  function setWalk(on) {
    writeStore(WALK_KEY, on ? "on" : "off");
  }
  function attachLife(c) {
    var timers = [];
    var later = function(fn, ms) {
      var id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };
    var between = function(min, max) {
      return (min + Math.random() * (max - min)) * 6e4;
    };
    var hasPig = function() {
      return c.getView().pig !== null && c.getView().hatched === true && !c.getView().dead;
    };
    var home = function() {
      return hasPig() && c.getView().activity === null && !c.isOpen() && !c.isDragging();
    };
    var quiet = function() {
      return c.getView().dialogue?.quiet === true;
    };
    later(function() {
      if (!c.isStopped() && hasPig()) c.send("chat", { reason: "enter" });
    }, GREET_DELAY_MS);
    later(timeTalk, GREET_DELAY_MS + 4e3);
    scheduleChat();
    scheduleIdle();
    scheduleWalk();
    function scheduleChat() {
      later(function() {
        if (!c.isStopped() && !c.isBusy() && hasPig()) c.send("chat", { reason: "idle" });
        scheduleChat();
      }, between(IDLE_CHAT_MINUTES.min, IDLE_CHAT_MINUTES.max));
    }
    function timeTalk() {
      if (c.isStopped()) return;
      if (!c.isBusy() && hasPig()) c.send("chat", { reason: "time" });
      later(timeTalk, TIME_TALK_MS);
    }
    function scheduleIdle() {
      later(function() {
        if (c.isStopped()) return;
        if (home()) doIdle(IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)]);
        scheduleIdle();
      }, between(3, 8));
    }
    function doIdle(action) {
      c.pig.setAttribute("data-idle", action.key);
      syncPigArt(c.pig, c.pigArt, c.pigEmoji);
      if (action.fx.length > 0) c.burst(action.fx, action.fx.length);
      if (!quiet() && Math.random() < 0.35) c.showBubble(action.say, Math.min(3e3, action.ms));
      later(function() {
        c.pig.removeAttribute("data-idle");
        syncPigArt(c.pig, c.pigArt, c.pigEmoji);
      }, action.ms);
    }
    function scheduleWalk() {
      later(function() {
        if (c.isStopped()) return;
        var shell2 = c.desktopShell();
        if (walkEnabled() && !quiet() && home() && shell2 !== null && typeof shell2.moveBy === "function") walk(shell2);
        scheduleWalk();
      }, between(10, 20));
    }
    function walk(shell2) {
      var screenWidth = window.screen?.availWidth ?? 0;
      var toLeft = screenWidth > 0 && (window.screenX ?? 0) > screenWidth / 2;
      var distance = 120 + Math.floor(Math.random() * 180);
      var step = toLeft ? -2 : 2;
      var walked = 0;
      var back = false;
      c.pig.setAttribute("data-idle", "walk");
      syncPigArt(c.pig, c.pigArt, c.pigEmoji);
      c.pig.setAttribute("data-walk", toLeft ? "left" : "right");
      if (!quiet() && Math.random() < 0.5) c.showBubble("\u6211\u53BB\u5DE1\u903B\u4E00\u4E0B", 2e3);
      var timer2 = window.setInterval(function() {
        if (c.isStopped() || c.isOpen() || c.isDragging()) return stop();
        shell2.moveBy(back ? -step : step, 0);
        walked += 2;
        if (!back && walked >= distance) {
          back = true;
          walked = 0;
          c.pig.setAttribute("data-walk", toLeft ? "right" : "left");
        } else if (back && walked >= distance) stop();
      }, 16);
      timers.push(timer2);
      function stop() {
        window.clearInterval(timer2);
        c.pig.removeAttribute("data-idle");
        syncPigArt(c.pig, c.pigArt, c.pigEmoji);
        c.pig.removeAttribute("data-walk");
      }
    }
    return {
      /** 调试页「散步一次」：不等计时，马上走一趟（只有桌面版能走）。 */
      walkNow: function() {
        var shell2 = c.desktopShell();
        if (shell2 === null || typeof shell2.moveBy !== "function") return false;
        walk(shell2);
        return true;
      },
      /** 调试页「做个小动作」。 */
      /** @param {string} [key] 指定哪个小动作（调试页用），不给就随机。 */
      idleNow: function(key) {
        var picked = IDLE_ACTIONS.find(function(action) {
          return action.key === key;
        });
        doIdle(picked || IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)]);
      },
      dispose: function() {
        for (var i = 0; i < timers.length; i += 1) {
          window.clearTimeout(timers[i]);
          window.clearInterval(timers[i]);
        }
        timers = [];
      }
    };
  }

  // src/client/tabs/dev-economy.js
  function sourceLabel(ui, entry) {
    if (entry.label) return entry.label;
    var match = /^ext\.([a-z0-9-]+)\.(.+)$/.exec(entry.source);
    if (match === null) return entry.source;
    var extension = (ui.view.extensions ?? []).find(function(item) {
      return item.key === match[1];
    });
    return (extension ? extension.emoji + " " + extension.label : match[1] + "\uFF08\u5DF2\u5220\u9664\uFF09") + " \xB7 " + match[2];
  }
  function renderEconomy(ui, body) {
    var economy = ui.view.economy;
    if (!economy) {
      body.appendChild(el("div", "dp-dev-note", "\u5BBF\u4E3B\u592A\u65E7\uFF0C\u6CA1\u6709\u8D26\u672C"));
      return;
    }
    var head = el("div", "dp-title");
    head.appendChild(el("b", null, "\u6700\u8FD1\u51E0\u5929"));
    body.appendChild(head);
    for (var d = economy.days.length - 1; d >= 0; d -= 1) {
      var day = el("div", "dp-row");
      day.appendChild(el("span", null, economy.days[d].day));
      day.appendChild(el("b", null, "+" + economy.days[d].in + " / -" + economy.days[d].out));
      body.appendChild(day);
    }
    var title = el("div", "dp-title");
    title.appendChild(el("b", null, "\u6309\u6765\u6E90\uFF08\u7D2F\u8BA1\uFF09"));
    body.appendChild(title);
    if (economy.sources.length === 0) body.appendChild(el("div", "dp-dev-note", "\u8FD8\u6CA1\u6709\u6536\u652F"));
    for (var i = 0; i < economy.sources.length; i += 1) {
      var row = el("div", "dp-row");
      row.setAttribute("data-economy-source", economy.sources[i].source);
      row.appendChild(el("span", null, sourceLabel(ui, economy.sources[i])));
      row.appendChild(el("b", null, (economy.sources[i].in ? "+" + economy.sources[i].in : "") + (economy.sources[i].out ? " -" + economy.sources[i].out : "")));
      body.appendChild(row);
    }
  }

  // src/client/tabs/dev.js
  var SCENE_NAMES = {
    eat: "\u5403\u996D",
    full: "\u5403\u9971",
    overfull: "\u6491\u7740",
    bathe: "\u6D17\u6FA1",
    play: "\u73A9\u800D",
    pet: "\u6478\u6478",
    hungry: "\u997F\u4E86",
    dirty: "\u810F\u4E86",
    lonely: "\u5B64\u5355",
    idle: "\u95F2\u804A",
    workDone: "\u6253\u5DE5\u56DE\u6765",
    tired: "\u7D2F\u4E86",
    study: "\u4E0A\u5B66",
    graduate: "\u6BD5\u4E1A",
    tripBack: "\u65C5\u884C\u56DE\u6765",
    sick: "\u751F\u75C5",
    wrongMedicine: "\u5403\u9519\u836F",
    cured: "\u6CBB\u597D",
    levelup: "\u5347\u7EA7",
    growUp: "\u957F\u5927",
    coronation: "\u52A0\u5195",
    contract: "\u7B7E\u7EA6",
    enter: "\u8FDB\u95E8",
    death: "\u53BB\u4E16",
    revive: "\u590D\u6D3B",
    signIn: "\u7B7E\u5230",
    gift: "\u793C\u5305",
    pomodoroStart: "\u756A\u8304\u5F00\u59CB",
    pomodoroDone: "\u756A\u8304\u5B8C\u6210",
    pomodoroAbandon: "\u756A\u8304\u653E\u5F03"
  };
  var ART_SCENE_NAMES = {
    box: "\u7EB8\u76D2",
    "dead-day": "\u53BB\u4E16\u5F53\u5929",
    grave: "\u5893\u7891\uFF08\u6EE1\u4E00\u5929\uFF09",
    feed: "\u5582\u98DF",
    bathe: "\u6D17\u6FA1",
    play: "\u73A9\u800D",
    pet: "\u6478\u5934",
    cure: "\u6CBB\u75C5",
    levelup: "\u5347\u7EA7",
    sick: "\u751F\u75C5",
    hungry: "\u997F",
    sleepy: "\u56F0",
    lonely: "\u5B64\u5355",
    dirty: "\u810F",
    happy: "\u5F00\u5FC3",
    roll: "\u6253\u6EDA",
    butterfly: "\u8FFD\u8774\u8776",
    scratch: "\u6320\u75D2",
    stretch: "\u4F38\u61D2\u8170",
    look: "\u5F20\u671B",
    bubbles: "\u5439\u6CE1\u6CE1",
    walk: "\u6563\u6B65",
    nap: "\u6253\u76F9",
    other: "\u5176\u4ED6\u5174\u8DA3\u73ED"
  };
  var ART_KIND_NAMES = { stage: "", birthday: "\u751F\u65E5\u5F53\u5929\u70B9\u86CB\u7CD5", illness: "\u751F\u75C5\xB7", reaction: "\u4E92\u52A8\xB7", mood: "\u5FC3\u60C5\xB7", work: "\u6253\u5DE5\xB7", study: "\u4E0A\u5B66", interest: "\u5174\u8DA3\u73ED\xB7", fishing: "\u9493\u9C7C", trip: "\u65C5\u884C", idle: "\u5C0F\u52A8\u4F5C\xB7" };
  function feedbackArtUses() {
    var jobNames = {};
    JOBS.forEach(function(job2) {
      jobNames[job2.key] = job2.label;
    });
    INTERESTS.forEach(function(lesson) {
      jobNames["interest:" + lesson.key] = lesson.label;
    });
    ILLNESS_CHAINS.forEach(function(chain) {
      chain.stages.forEach(function(entry, at) {
        jobNames["illness:" + chain.key + ":" + (at + 1)] = chain.name + "\xB7" + entry.name;
      });
    });
    var uses = {};
    var add = function(name, where) {
      (uses[name] = uses[name] || []).push(where);
    };
    Object.keys(FEEDBACK_ART_TABLES).forEach(function(kind) {
      var table = FEEDBACK_ART_TABLES[kind];
      var prefix = ART_KIND_NAMES[kind];
      if (Array.isArray(table)) {
        table.forEach(function(name) {
          add(name, prefix);
        });
        return;
      }
      Object.keys(table).forEach(function(key) {
        var label = kind === "work" ? jobNames[key] ?? key : kind === "illness" ? jobNames["illness:" + key] ?? key : kind === "interest" ? jobNames["interest:" + key] ?? ART_SCENE_NAMES[key] ?? key : ART_SCENE_NAMES[key] ?? key;
        [].concat(table[key]).forEach(function(name) {
          add(name, prefix + label);
        });
      });
    });
    add("recruit", "\u76F2\u76D2\u5BFB\u8BBF\u9875");
    UNUSED_FEEDBACK_ART.forEach(function(name) {
      add(name, "\u6682\u4E0D\u4F7F\u7528\uFF08\u5F85\u5B9A\uFF09");
    });
    return uses;
  }
  var currentPage = "status";
  function renderDevTab(ui) {
    var topBar = el("div", "dp-dev-row");
    var off = button("dp-mini dp-dev-btn", { "data-dev": "devOff" }, function() {
      ui.devOff();
    });
    off.textContent = "\u{1F527} \u5173\u95ED\u8C03\u8BD5";
    topBar.appendChild(off);
    ui.content.appendChild(topBar);
    ui.content.appendChild(el("div", "dp-dev-note", "\u{1F527} \u5F00\u53D1\u8005\u6A21\u5F0F \xB7 \u6784\u5EFA v" + (ui.view.version === "" ? "\u672A\u77E5" : ui.view.version)));
    if (ui.view.pig !== null && ui.view.pig.ageForced) {
      ui.content.appendChild(el(
        "div",
        "dp-dev-note",
        "\u26A0\uFE0F \u5E74\u9F84\u662F\u8C03\u8BD5\u6539\u7684\uFF08HUD \u4E0A\u6709 \u{1F527}\uFF09\u2014\u2014 \u6309\u300C\u23EA \u5929\u6570\u5F52\u96F6\u300D\u624D\u4F1A\u91CD\u65B0\u6309\u771F\u5B9E\u65F6\u95F4\u7B97"
      ));
    }
    var patch = function(body) {
      ui.send("dev", { patch: body });
    };
    var pages = [];
    function page(key, label) {
      var body = el("div", "dp-dev-page");
      body.setAttribute("data-dev-page-body", key);
      pages.push({ key, label, body });
      return function group(title, entries2, note) {
        var head = el("div", "dp-title");
        head.appendChild(el("b", null, title));
        body.appendChild(head);
        if (note !== void 0 && note !== "") body.appendChild(el("div", "dp-dev-note", note));
        var wrap = el("div", "dp-dev-list");
        for (var i = 0; i < entries2.length; i += 1) {
          (function(entry) {
            var item = el("div", "dp-dev-item");
            var btn = button("dp-mini dp-dev-btn", { "data-dev": entry.key }, function() {
              entry.run();
            });
            btn.textContent = entry.label;
            if (entry.off === true) btn.disabled = true;
            item.appendChild(btn);
            if (entry.desc) item.appendChild(el("small", "dp-dev-desc", entry.desc));
            wrap.appendChild(item);
          })(entries2[i]);
        }
        body.appendChild(wrap);
      };
    }
    var boxed = ui.view.hatched !== true || ui.view.pig === null;
    var dead = ui.view.dead === true;
    var why = boxed ? "\u5148\u5B75\u5316" : dead ? "\u5148\u590D\u6D3B" : "";
    var forms = ui.view.forms === null ? [] : ui.view.forms.forms;
    var looks = page("looks", "\u5F62\u6001\u76AE\u80A4");
    var formEntries = forms.map(function(form) {
      return {
        key: "form:" + form.key,
        label: form.emoji + " " + form.label,
        off: boxed || dead,
        desc: "\u76F4\u63A5\u53D8\u6210" + form.label + "\uFF0C\u4E0D\u770B\u6761\u4EF6\uFF1B\u7B49\u7EA7\u4E0D\u591F\u4F1A\u987A\u624B\u8865\u5230\u8FD9\u4E00\u9636\u6BB5",
        run: function() {
          var body = { form: form.key };
          var level = ui.view.pig === null ? 0 : ui.view.pig.level.level;
          if (level < form.fromLevel) body.level = form.fromLevel;
          patch(body);
        }
      };
    });
    formEntries.push({ key: "form:none", label: "\u{1F416} \u6062\u590D\u666E\u901A", desc: "\u53BB\u6389\u5F62\u6001\uFF0C\u56DE\u5230\u666E\u901A\u5C0F\u732A", run: function() {
      patch({ form: null });
    } });
    looks("\u5F62\u6001", formEntries, why);
    var p = ui.view.pig;
    if (p === null) {
      currentPage = "looks";
      renderPages(ui, pages);
      ui.content.appendChild(el("div", "dp-empty", "\u8FD8\u6CA1\u6709\u732A\u3002\u5148\u300C\u62C6\u5F00\u7EB8\u76D2\u300D\u518D\u8C03\u3002"));
      return;
    }
    var skinRows = ui.view.skins?.entries?.length > 0 ? ui.view.skins.entries : SKINS;
    looks("\u76AE\u80A4", skinRows.map(function(skin) {
      return {
        key: "skin:" + skin.key,
        label: skin.emoji + " " + skin.label,
        desc: skin.unlockJob ? "\u804C\u4E1A\u76AE\u80A4\uFF1A\u4E0D\u7528\u6253\u5DE5\u76F4\u63A5\u8BD5\u7A7F" : "\u6362\u4E0A\u8FD9\u6B3E\u76AE\u80A4",
        run: function() {
          if (skin.unlockJob) patch({ skin: skin.key });
          else ui.send("skin", { skin: skin.key });
        }
      };
    }), "\u5F62\u6001\u663E\u793A\u4F18\u5148\u4E8E\u76AE\u80A4\uFF1B\u6062\u590D\u666E\u901A\u5F62\u6001\u5373\u53EF\u770B\u5230\u76AE\u80A4\u3002");
    looks("\u9053\u5177", forms.filter(function(form) {
      return form.item !== "";
    }).map(function(form) {
      return {
        key: "item:" + form.item,
        label: form.emoji + " \u7ED9" + form.label + "\u9053\u5177",
        desc: "\u80CC\u5305\u91CC\u52A0\u4E00\u4E2A\u664B\u5347\u9053\u5177\uFF0C\u7528\u6765\u6D4B\u6B63\u5E38\u7684\u664B\u5347\u6D41\u7A0B",
        run: function() {
          patch({ inventory: { [form.item]: num(ui.view.inventory[form.item], 0) + 1 } });
        }
      };
    }));
    var status = page("status", "\u72B6\u6001");
    status("\u72B6\u6001", [
      { key: "full", label: "\u{1F60A} \u6EE1\u72B6\u6001", desc: "\u9971\u98DF\u3001\u5FC3\u60C5\u3001\u6E05\u6D01 100\uFF0C\u5065\u5EB7\u6EE1\u683C", run: function() {
        patch({ satiety: 100, happiness: 100, cleanliness: 100, health: 5 });
      } },
      { key: "hungry", label: "\u{1F34E} \u997F", desc: "\u9971\u98DF 10\uFF1A\u770B\u997F\u4E86\u7684\u53F0\u8BCD\u548C\u751F\u75C5\u98CE\u9669", run: function() {
        patch({ satiety: 10 });
      } },
      { key: "dirty", label: "\u{1FAE7} \u810F", desc: "\u6E05\u6D01 10", run: function() {
        patch({ cleanliness: 10 });
      } },
      { key: "lonely", label: "\u{1F97A} \u5B64\u5355", desc: "\u5FC3\u60C5 10", run: function() {
        patch({ happiness: 10 });
      } },
      { key: "sleepy", label: "\u{1F4A4} \u56F0", desc: "\u4E09\u9879\u90FD 90\uFF0C\u6D4B\u8BD5\u56F0\u4E86\u7684\u95F2\u804A", run: function() {
        patch({ satiety: 90, happiness: 90, cleanliness: 90 });
      } }
    ]);
    status("\u8D44\u6E90", [
      { key: "coin100", label: "\u{1FA99} +100", desc: "\u91D1\u5E01\u52A0 100", run: function() {
        patch({ coins: p.coins + 100 });
      } },
      { key: "coin999", label: "\u{1FA99} 9999", desc: "\u91D1\u5E01\u8BBE\u6210 9999", run: function() {
        patch({ coins: 9999 });
      } },
      { key: "traits", label: "\u{1F9E0}+5 \u2728+5 \u{1F4AA}+5", desc: "\u667A\u529B\u3001\u9B45\u529B\u3001\u6B66\u529B\u5404 +5", run: function() {
        patch({ traits: { intel: 5, charm: 5, strong: 5 } });
      } },
      { key: "all", label: "\u{1F381} \u4E00\u952E\u62FF\u9F50", desc: "\u5546\u5E97\u91CC\u6BCF\u6837\u4E1C\u897F\u90FD\u7ED9\u51E0\u4E2A", run: function() {
        ui.send("giveAll");
      } }
    ]);
    status("\u751F\u6B7B", [
      { key: "kill", label: "\u{1F480} \u5F04\u6B7B", desc: "\u5F53\u5929\u4FDD\u7559\u9057\u4F53\uFF0C\u6B21\u65E5\u51FA\u73B0\u5893\u7891\u4E0E\u7075\u9B42\uFF1B\u6D4B\u590D\u6D3B\u548C\u9886\u517B", run: function() {
        patch({ dead: true });
      } },
      { key: "revive", label: "\u2728 \u590D\u6D3B", desc: "\u4E0D\u7528\u8FD8\u9B42\u4E39\u76F4\u63A5\u590D\u6D3B", run: function() {
        patch({ dead: false, health: 5 });
      } },
      { key: "adopt", label: "\u{1F4E6} \u9886\u517B", desc: "\u9886\u517B\u4E00\u53EA\u65B0\u732A\uFF08\u65E7\u732A\u7684\u6545\u4E8B\u7559\u5728\u8BB0\u5FC6\u91CC\uFF09", run: function() {
        ui.send("adopt");
      } },
      { key: "reset", label: "\u{1F504} \u91CD\u7F6E", desc: "\u6E05\u7A7A\u5B58\u6863\uFF0C\u4ECE\u7EB8\u76D2\u91CD\u65B0\u5F00\u59CB", run: function() {
        ui.send("reset");
      } }
    ]);
    var growth = page("growth", "\u6210\u957F\u751F\u75C5");
    growth("\u7B49\u7EA7", [
      { key: "box", label: "\u{1F4E6} \u7EB8\u76D2", desc: "\u56DE\u5230\u6CA1\u62C6\u7684\u7EB8\u76D2", run: function() {
        patch({ hatched: false });
      } },
      { key: "lv1", label: "\u5E7C\u5E74 Lv1", desc: "\u62C6\u76D2\u5E76\u8BBE\u6210 1 \u7EA7", run: function() {
        patch({ hatched: true, level: 1 });
      } },
      { key: "lv10", label: "\u9752\u5E74 Lv10", desc: "\u8BBE\u6210 10 \u7EA7\uFF08\u9752\u5E74\u4F53\u578B\uFF09", run: function() {
        patch({ level: 10 });
      } },
      { key: "lv40", label: "\u6210\u5E74 Lv40", desc: "\u8BBE\u6210 40 \u7EA7\uFF08\u6210\u5E74\u4F53\u578B\uFF09", run: function() {
        patch({ level: 40 });
      } },
      { key: "lv60", label: "\u6EE1\u7EA7 Lv60", desc: "\u8BBE\u6210\u6EE1\u7EA7", run: function() {
        patch({ level: 60 });
      } },
      { key: "real", label: "\u23EA \u5929\u6570\u5F52\u96F6", desc: "\u53D6\u6D88\u8C03\u8BD5\u6539\u8FC7\u7684\u5E74\u9F84\uFF0C\u6309\u771F\u5B9E\u65F6\u95F4\u91CD\u65B0\u7B97", run: function() {
        ui.send("ageFromNow");
      } }
    ]);
    growth("\u4F53\u91CD", [
      { key: "weight:normal", label: "\u2696\uFE0F \u6B63\u5E38", desc: "\u4F53\u91CD\u8BBE\u5230\u7406\u60F3\u4F53\u91CD", run: function() {
        patch({ weightClass: "normal" });
      } },
      { key: "weight:round", label: "\u{1F437} \u5706\u6DA6", desc: "\u4F53\u91CD\u8BBE\u5230\u5706\u6DA6\u6863\uFF08\u6362\u5706\u6DA6\u7ACB\u7ED8\uFF09", run: function() {
        patch({ weightClass: "round" });
      } },
      { key: "weight:fat", label: "\u{1F416} \u80D6\u80D6", desc: "\u4F53\u91CD\u8BBE\u5230\u80D6\u80D6\u6863\uFF08\u6362\u80D6\u80D6\u52A8\u4F5C\u7ACB\u7ED8\uFF09", run: function() {
        patch({ weightClass: "fat" });
      } }
    ]);
    growth("\u751F\u75C5", [
      { key: "cold1", label: "\u{1F927} \u611F\u5192", desc: "\u611F\u5192\u7B2C 1 \u671F\uFF0C\u5065\u5EB7 4", run: function() {
        patch({ illness: { chain: 0, stage: 1 }, health: 4 });
      } },
      { key: "fever", label: "\u{1F912} \u53D1\u70E7", desc: "\u611F\u5192\u7B2C 2 \u671F\uFF08\u53D1\u70E7\u56FE\uFF09", run: function() {
        patch({ illness: { chain: 0, stage: 2 }, health: 3 });
      } },
      { key: "cough1", label: "\u{1F637} \u54B3\u55FD", desc: "\u54B3\u55FD\u7B2C 1 \u671F", run: function() {
        patch({ illness: { chain: 1, stage: 1 }, health: 4 });
      } },
      { key: "belly1", label: "\u{1F922} \u809A\u5B50\u80C0", desc: "\u80A0\u80C3\u7B2C 1 \u671F\uFF08\u80C3\u80C0\u6C14\u90A3\u6761\uFF09", run: function() {
        patch({ illness: { chain: 2, stage: 1 }, health: 4 });
      } },
      { key: "dizzy1", label: "\u{1F635} \u5934\u6655", desc: "\u5934\u6655\u7B2C 1 \u671F\uFF08\u8FDE\u7EED\u51FA\u95E8\u592A\u591A\u90A3\u6761\uFF09", run: function() {
        patch({ illness: { chain: 3, stage: 1 }, health: 4 });
      } },
      { key: "skin1", label: "\u{1FA79} \u7619\u75D2", desc: "\u76AE\u80A4\u7B2C 1 \u671F\uFF08\u592A\u810F\u90A3\u6761\uFF09", run: function() {
        patch({ illness: { chain: 4, stage: 1 }, health: 4 });
      } },
      { key: "cold4", label: "\u2620\uFE0F \u80BA\u708E", desc: "\u611F\u5192\u6700\u540E\u4E00\u671F\uFF0C\u5065\u5EB7 1\uFF1A\u518D\u62D6\u5C31\u4F1A\u6B7B", run: function() {
        patch({ illness: { chain: 0, stage: 4 }, health: 1 });
      } },
      { key: "cure", label: "\u{1F49A} \u6CBB\u597D", desc: "\u76F4\u63A5\u75C5\u597D\uFF0C\u5065\u5EB7\u6EE1\u683C", run: function() {
        patch({ illness: null, health: 5 });
      } }
    ]);
    page("pomodoro", "\u756A\u8304\u949F")("\u756A\u8304\u949F", [
      { key: "pomoDone", label: "\u{1F345} \u5B8C\u6210\u5F53\u524D", desc: "\u6B63\u5728\u4E13\u6CE8\u7684\u8FD9\u4E00\u4E2A\u7ACB\u523B\u5230\u70B9\uFF0C\u7167\u5E38\u53D1\u5956", run: function() {
        patch({ pomodoro: { finish: true } });
      } }
    ]);
    var fishEntries = FISH.map(function(fish3) {
      return { key: "fish:" + fish3.key, label: fish3.emoji + " " + fish3.label, desc: "\u9C7C\u7BD3\u91CC\u76F4\u63A5\u653E\u4E00\u6761", run: function() {
        ui.send("fishGive", { fish: fish3.key });
      } };
    });
    fishEntries.push({ key: "fish:skip", label: "\u2757 \u8DF3\u8FC7\u7B49\u5F85", desc: "\u629B\u7AFF\u540E\u4E0D\u7528\u7B49\uFF0C\u9A6C\u4E0A\u54AC\u94A9", run: function() {
      ui.send("fishSkip");
    } });
    page("fishing", "\u9493\u9C7C")("\u9493\u9C7C", fishEntries);
    var dailyView = ui.view.daily ?? { cycle: 7, signInDay: 1, canSignIn: true, signInTotal: 0, unclaimed: 0 };
    var extensions = ui.view.extensions ?? [];
    var daily = page("daily", "\u7B7E\u5230\u793C\u5305");
    var days = [];
    for (var d = 1; d <= dailyView.cycle; d += 1) {
      (function(day) {
        days.push({ key: "signin:" + day, label: "\u{1F4C5} \u7B2C " + day + " \u5929", desc: "\u4E0B\u4E00\u6B21\u7B7E\u5230\u9886\u7B2C " + day + " \u5929\uFF0C\u4ECA\u5929\u53EF\u4EE5\u518D\u7B7E", run: function() {
          patch({ signInDay: day });
        } });
      })(d);
    }
    daily("\u7B7E\u5230", days, "\u73B0\u5728\uFF1A\u7B2C " + dailyView.signInDay + "/" + dailyView.cycle + " \u5929" + (dailyView.canSignIn ? " \xB7 \u4ECA\u5929\u8FD8\u6CA1\u7B7E" : " \xB7 \u4ECA\u5929\u5DF2\u7B7E"));
    daily("\u5728\u7EBF\u793C\u5305", [
      { key: "gifts:1", label: "\u{1F381} \u6512 1 \u4E2A", desc: "\u732A\u5934\u4E0A\u51FA\u73B0\u793C\u5305\u6309\u94AE", run: function() {
        patch({ gifts: 1 });
      } },
      { key: "gifts:3", label: "\u{1F381} \u6512\u6EE1 3 \u4E2A", desc: "\u793C\u5305\u4E0A\u9650\u662F 3 \u4E2A", run: function() {
        patch({ gifts: 3 });
      } },
      { key: "gifts:0", label: "\u{1F6AB} \u6E05\u7A7A", desc: "\u6CA1\u6709\u5F85\u9886\u7684\u793C\u5305", run: function() {
        patch({ gifts: 0 });
      } }
    ]);
    var system = page("system", "\u66F4\u65B0\u6269\u5C55");
    var notice = ui.updateNotice;
    system("\u66F4\u65B0", [
      {
        key: "update:fake",
        label: "\u{1F534} \u5047\u88C5\u6709\u65B0\u7248",
        desc: "\u8BA9\u8BBE\u7F6E\u56FE\u6807\u548C\u8BBE\u7F6E\u9875\u5192\u7EA2\u70B9\uFF08\u4E0D\u4F1A\u771F\u7684\u4E0B\u8F7D\uFF09",
        off: !notice || typeof notice.simulate !== "function",
        run: function() {
          notice.simulate("9.9.9");
          ui.renderContent();
        }
      },
      {
        key: "update:read",
        label: "\u2705 \u6807\u4E3A\u5DF2\u8BFB",
        desc: "\u7EA2\u70B9\u6D88\u5931\uFF08\u548C\u6253\u5F00\u66F4\u65B0\u9875\u4E00\u6837\uFF09",
        off: !notice,
        run: function() {
          notice.markRead();
          ui.renderContent();
        }
      }
    ]);
    system("\u6269\u5C55", extensions.map(function(extension) {
      return {
        key: "ext:" + extension.key,
        label: extension.emoji + " " + (extension.on ? "\u5173\u6389" : "\u6253\u5F00") + extension.label,
        desc: extension.on ? "\u548C\u6269\u5C55 App \u91CC\u5173\u6389\u4E00\u6837\uFF08\u8FDB\u884C\u4E2D\u7684\u4F1A\u6536\u5C3E\uFF09" : "\u91CD\u65B0\u6253\u5F00\uFF0C\u6570\u636E\u539F\u6837\u56DE\u6765",
        run: function() {
          ui.send("setExtension", { key: extension.key, on: !extension.on });
        }
      };
    }));
    page("lines", "\u53F0\u8BCD")("\u8BA9\u732A\u8BF4\u4E00\u53E5", Object.keys(LINES).map(function(scene3) {
      return {
        key: "say:" + scene3,
        label: "\u{1F4AC} " + (SCENE_NAMES[scene3] ?? scene3),
        desc: "\u968F\u673A\u8BF4\u300C" + scene3 + "\u300D\u573A\u666F\u91CC\u7684\u4E00\u53E5\uFF08\u514D\u6253\u6270\u65F6\u4E0D\u8BF4\uFF09",
        run: function() {
          patch({ say: scene3 });
        }
      };
    }));
    var time = page("time", "\u65F6\u95F4\u9762\u677F");
    time("\u65F6\u95F4", [
      { key: "real", label: "\xD71 \u771F\u5B9E", desc: "\u65F6\u95F4\u6309\u771F\u5B9E\u901F\u5EA6\u8D70", run: function() {
        ui.send("timeScale", { scale: 1 });
      } },
      { key: "fast12", label: "\xD712", desc: "1 \u5206\u949F = \u732A\u7684 12 \u5206\u949F", run: function() {
        ui.send("timeScale", { scale: 12 });
      } },
      { key: "fast30", label: "\xD730", desc: "1 \u5206\u949F = \u732A\u7684\u534A\u5C0F\u65F6", run: function() {
        ui.send("timeScale", { scale: 30 });
      } },
      { key: "fast60", label: "\xD760", desc: "1 \u5206\u949F = \u732A\u7684 1 \u5C0F\u65F6", run: function() {
        ui.send("timeScale", { scale: 60 });
      } }
    ]);
    time("\u9762\u677F", [
      { key: "open", label: "\u5C55\u5F00/\u6536\u8D77", desc: "\u5207\u6362\u9762\u677F\u5F00\u5173\uFF08\u6D4B\u5F00\u5173\u52A8\u753B\uFF09", run: function() {
        ui.setOpen(ui.host.getAttribute("data-open") !== "true");
      } },
      { key: "away1", label: "\u23E9 +1 \u5C0F\u65F6", desc: "\u65F6\u95F4\u76F4\u63A5\u8FC7\u53BB 1 \u5C0F\u65F6\uFF08\u7ED3\u7B97\u6570\u503C\u3001\u6210\u957F\u3001\u6253\u5DE5\uFF09", run: function() {
        patch({ __advanceMs: 36e5 });
      } },
      { key: "away24", label: "\u23E9 +1 \u5929", desc: "\u65F6\u95F4\u76F4\u63A5\u8FC7\u53BB 1 \u5929\uFF08\u6362\u5929\u3001\u7B7E\u5230\u3001\u65E5\u8BB0\uFF09", run: function() {
        patch({ __advanceMs: 864e5 });
      } }
    ]);
    time("\u732A\u81EA\u5DF1\u627E\u4E8B\u505A", [
      { key: "idle", label: "\u{1F437} \u5C0F\u52A8\u4F5C", desc: "\u9A6C\u4E0A\u505A\u4E00\u4E2A\u5C0F\u52A8\u4F5C\uFF08\u6253\u6EDA\u3001\u6253\u76F9\u3001\u8FFD\u8774\u8776\u2026\u2026\uFF09", off: typeof ui.idleNow !== "function", run: function() {
        ui.setOpen(false);
        ui.idleNow();
      } },
      { key: "walk", label: "\u{1F6B6} \u6563\u6B65\u4E00\u6B21", desc: "\u9A6C\u4E0A\u6CBF\u5C4F\u5E55\u5E95\u8FB9\u8D70\u4E00\u8D9F\uFF08\u53EA\u6709\u684C\u9762\u7248\uFF09", off: typeof ui.walkNow !== "function" || desktopShell() === null, run: function() {
        ui.setOpen(false);
        ui.walkNow();
      } },
      { key: "timeTalk", label: "\u{1F550} \u6309\u65F6\u95F4\u8BF4", desc: "\u95EE\u4E00\u6B21\u300C\u73B0\u5728\u6709\u6CA1\u6709\u6309\u65F6\u95F4\u8BE5\u8BF4\u7684\u8BDD\u300D\uFF08\u4E00\u5929\u4E00\u6B21\u7684\u5DF2\u7ECF\u8BF4\u8FC7\u5C31\u4E0D\u8BF4\uFF09", run: function() {
        ui.send("chat", { reason: "time" });
      } }
    ]);
    var art = page("art", "\u7ACB\u7ED8");
    var uses = feedbackArtUses();
    var artEntries = [{ key: "art:auto", label: "\u{1F504} \u6062\u590D\u81EA\u52A8", desc: "\u6309\u72B6\u6001\u81EA\u52A8\u9009\u56FE\uFF08\u540C\u4E00\u72B6\u6001\u51E0\u5F20\u56FE\u6309\u5C0F\u65F6\u8F6E\u6362\uFF09", run: function() {
      ui.previewArt(null);
    } }];
    Object.keys(uses).sort().forEach(function(name) {
      artEntries.push({ key: "art:" + name, label: "\u{1F5BC}\uFE0F " + name, desc: uses[name].join("\u3001"), run: function() {
        ui.previewArt(name);
      } });
    });
    art("\u53CD\u9988\u56FE", artEntries, "\u70B9\u4E00\u5F20\uFF0C\u732A\u5C31\u4E00\u76F4\u663E\u793A\u8FD9\u5F20\uFF0C\u76F4\u5230\u300C\u6062\u590D\u81EA\u52A8\u300D\uFF1B\u53EA\u5F71\u54CD\u753B\u9762\uFF0C\u4E0D\u6539\u5B58\u6863\u3002\u4E13\u5C5E\u5F62\u6001\u548C\u5BFC\u5165\u76AE\u80A4\u5E73\u65F6\u4E0D\u7528\u8FD9\u4E9B\u56FE\u3002");
    art("\u751F\u65E5", [{
      key: "birthday",
      label: "\u{1F382} \u8FC7\u751F\u65E5",
      desc: "\u732A\u5934\u9876\u9A6C\u4E0A\u5192\u86CB\u7CD5\uFF08\u7B7E\u5230\u3001\u793C\u5305\u6CA1\u9886\u65F6\u6392\u5728\u5B83\u4EEC\u540E\u9762\uFF09\uFF0C\u70B9\u86CB\u7CD5\u770B\u751F\u65E5\u56FE",
      off: typeof ui.birthdayNow !== "function",
      run: function() {
        ui.previewArt(null);
        ui.birthdayNow();
      }
    }]);
    art("\u5C0F\u52A8\u4F5C", IDLE_ACTIONS.map(function(action) {
      return {
        key: "idle:" + action.key,
        label: "\u{1F437} " + (ART_SCENE_NAMES[action.key] ?? action.key),
        off: typeof ui.idleNow !== "function",
        desc: action.key === "nap" ? "\u6253\u76F9\uFF1A\u6362\u6210\u7761\u59FF\u7ACB\u7ED8\uFF0C\u5934\u9876\u5192 Zzz" : "\u9A6C\u4E0A\u505A\u8FD9\u4E2A\u5C0F\u52A8\u4F5C\uFF08\u4F1A\u5148\u6062\u590D\u81EA\u52A8\u9009\u56FE\uFF09",
        run: function() {
          ui.previewArt(null);
          ui.idleNow(action.key);
        }
      };
    }), "\u9762\u677F\u5F00\u7740\u4E5F\u80FD\u770B\uFF1A\u684C\u9762\u7248\u7684\u732A\u5728\u81EA\u5DF1\u7684\u7A97\u53E3\u91CC\u3002");
    var money = el("div", "dp-dev-page");
    money.setAttribute("data-dev-page-body", "economy");
    pages.push({ key: "economy", label: "\u7ECF\u6D4E", body: money });
    renderEconomy(ui, money);
    var values = el("div", "dp-dev-page");
    values.setAttribute("data-dev-page-body", "values");
    pages.push({ key: "values", label: "\u6570\u503C", body: values });
    var rows = [
      ["\u9636\u6BB5", p.stage?.label ?? "\u2014"],
      ["\u7B49\u7EA7", p.level ? "Lv." + p.level.level + "\uFF08\u8FD8\u5DEE " + Math.ceil(p.level.toNext) + "\uFF09" : "\u2014"],
      ["\u9971\u98DF", p.satiety],
      ["\u5FC3\u60C5", p.happiness],
      ["\u6E05\u6D01", p.cleanliness],
      ["\u5065\u5EB7", p.health + "/" + (ui.view.maxHealth ?? 5)],
      ["\u4F53\u91CD", p.weight + (p.bodyWeight ? "\uFF08" + p.bodyWeight.weightG + " g \xB7 " + p.bodyWeight.label + "\uFF09" : "")],
      ["\u91D1\u5E01", p.coins],
      ["\u667A\u529B / \u9B45\u529B / \u6B66\u529B", p.traits ? p.traits.intel + " / " + p.traits.charm + " / " + p.traits.strong : "\u2014"],
      ["\u751F\u75C5", p.illness ? p.illness.name : "\u2014"],
      ["\u5728\u5916\u9762", ui.view.activity ? ui.view.activity.label : "\u2014"],
      ["\u7B7E\u5230", "\u7B2C " + dailyView.signInDay + " \u5929 \xB7 \u7D2F\u8BA1 " + dailyView.signInTotal + " \u6B21"],
      ["\u5F85\u9886\u793C\u5305", dailyView.unclaimed],
      ["\u6269\u5C55", extensions.map(function(e) {
        return e.label + (e.on ? "\u5F00" : "\u5173");
      }).join(" \xB7 ")],
      ["\u514D\u6253\u6270", ui.view.dialogue?.quiet ? "\u5F00" : "\u5173"],
      ["\u65F6\u95F4\u500D\u7387", "\xD7" + (ui.view.timeScale ?? 1)]
    ];
    for (var r = 0; r < rows.length; r += 1) {
      var row = el("div", "dp-row");
      row.appendChild(el("span", null, rows[r][0]));
      row.appendChild(el("b", null, String(rows[r][1])));
      values.appendChild(row);
    }
    renderPages(ui, pages);
  }
  function renderPages(ui, pages) {
    if (!pages.some(function(entry) {
      return entry.key === currentPage;
    })) currentPage = pages[0].key;
    var index = pages.findIndex(function(entry) {
      return entry.key === currentPage;
    });
    var go = function(to) {
      currentPage = pages[(to + pages.length) % pages.length].key;
      ui.renderContent();
    };
    var nav = el("div", "dp-dev-nav");
    var prev = button("dp-mini dp-mini-plain", { "data-dev-prev": "true" }, function() {
      go(index - 1);
    });
    prev.textContent = "\u2039";
    nav.appendChild(prev);
    var tabs = el("div", "dp-dev-tabs");
    for (var i = 0; i < pages.length; i += 1) {
      (function(entry, at) {
        var tab = button("dp-dev-tab", { "data-dev-page": entry.key, "aria-pressed": String(at === index) }, function() {
          go(at);
        });
        tab.textContent = entry.label;
        tabs.appendChild(tab);
      })(pages[i], i);
    }
    nav.appendChild(tabs);
    var next = button("dp-mini dp-mini-plain", { "data-dev-next": "true" }, function() {
      go(index + 1);
    });
    next.textContent = "\u203A";
    nav.appendChild(next);
    ui.content.appendChild(nav);
    sideScroller(tabs, tabs.children ? tabs.children[index] : null);
    var start2 = null;
    for (var k = 0; k < pages.length; k += 1) {
      var body = pages[k].body;
      body.hidden = k !== index;
      if (typeof body.addEventListener === "function") {
        body.addEventListener("pointerdown", function(event) {
          start2 = event.clientX;
        });
        body.addEventListener("pointerup", function(event) {
          if (start2 === null || typeof event.clientX !== "number") return;
          var dx = event.clientX - start2;
          start2 = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? index + 1 : index - 1);
        });
      }
      ui.content.appendChild(body);
    }
  }

  // channel.js
  var CHANNEL = {
    name: "github",
    repoPage: "https://github.com/CLICGGER-TYPES/dsh-piggy",
    /** 发行版列表（新的在前），外壳用它找可下载的游戏包。 */
    releasesList: "https://api.github.com/repos/CLICGGER-TYPES/dsh-piggy/releases?per_page=20",
    /** 最新正式版，DSH 插件模式的更新提示用。 */
    latestRelease: "https://api.github.com/repos/CLICGGER-TYPES/dsh-piggy/releases/latest",
    releasesPage: "https://github.com/CLICGGER-TYPES/dsh-piggy/releases",
    /** 发行版附件：<downloadBase>/<tag>/<文件名> */
    downloadBase: "https://github.com/CLICGGER-TYPES/dsh-piggy/releases/download",
    /** 仓库文件（main 分支）：原始内容 / 网页查看 */
    rawBase: "https://raw.githubusercontent.com/CLICGGER-TYPES/dsh-piggy/main",
    blobBase: "https://github.com/CLICGGER-TYPES/dsh-piggy/blob/main",
    /** 在线扩展目录 */
    registry: "https://raw.githubusercontent.com/CLICGGER-TYPES/dsh-piggy/main/extensions/registry.json"
  };

  // src/client/update-notice.js
  var READ_KEY = "dsh-piggy:update-read";
  var NOTIFIED_KEY = "dsh-piggy:update-notified";
  var LATEST_CACHE_KEY = "dsh-piggy:latest-release";
  var LATEST_CACHE_MS = 6 * 60 * 60 * 1e3;
  var GITHUB_LATEST = CHANNEL.latestRelease;
  function compareVersions(a, b) {
    const split = (value) => {
      const [main, pre] = String(value).replace(/^v/, "").split("-", 2);
      return { main: main.split(".").map((part) => Number.parseInt(part, 10) || 0), pre: pre === void 0 ? null : pre.split(".") };
    };
    const left = split(a), right = split(b);
    for (let i = 0; i < Math.max(left.main.length, right.main.length); i += 1) {
      if ((left.main[i] ?? 0) !== (right.main[i] ?? 0)) return (left.main[i] ?? 0) - (right.main[i] ?? 0);
    }
    if (left.pre === null || right.pre === null) return (left.pre === null ? 1 : 0) - (right.pre === null ? 1 : 0);
    for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i += 1) {
      const x = left.pre[i], y = right.pre[i];
      if (x === void 0 || y === void 0) return x === void 0 ? -1 : 1;
      if (x === y) continue;
      const nx = Number(x), ny = Number(y);
      if (Number.isInteger(nx) && Number.isInteger(ny)) return nx - ny;
      return x < y ? -1 : 1;
    }
    return 0;
  }
  function newestRelease(releases) {
    return (Array.isArray(releases) ? releases : []).filter((release) => release && release.prerelease !== true).sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
  }
  async function fetchGithubLatest(doFetch = fetch) {
    const response = await doFetch(GITHUB_LATEST, { headers: { accept: "application/vnd.github+json" }, cache: "no-store" });
    if (!response.ok) throw new Error((CHANNEL.name === "gitee" ? "Gitee " : "GitHub ") + response.status);
    const release = await response.json();
    if (release?.draft === true || release?.prerelease === true) return null;
    const version = String(release?.tag_name ?? "").replace(/^v/, "");
    if (version === "") return null;
    return {
      version,
      // Gitee 的发行版没有 html_url，按 tag 拼出发行版页面。
      page: String(release?.html_url ?? CHANNEL.releasesPage + "/tag/" + String(release?.tag_name ?? "")),
      notes: String(release?.body ?? "").slice(0, 1200),
      prerelease: false
    };
  }
  function createUpdateNotice(options) {
    let remote = null;
    let latest = null;
    let unread = false;
    let checking = false;
    let checked = false;
    let error = null;
    let timer2 = null;
    let interval = null;
    function signalId(candidate) {
      if (candidate === null) return "";
      return [candidate.kind, candidate.version, candidate.latestShell ?? ""].join(":");
    }
    function maybeBubble() {
      if (!unread || latest === null || !options.canBubble()) return;
      const id = signalId(latest);
      if (options.read(NOTIFIED_KEY) === id) return;
      const text = latest.kind === "shell" ? "\u684C\u9762\u7248\u6709\u66F4\u65B0\u5566\uFF0C\u53BB\u66F4\u65B0 App \u770B\u770B\u5427\uFF5E" : "\u6709\u65B0\u7248\u672C v" + latest.version + " \u5566\uFF0C\u53BB\u66F4\u65B0\u770B\u770B\u5427\uFF5E";
      options.showBubble(text);
      options.write(NOTIFIED_KEY, id);
    }
    function accept(candidate, newest) {
      latest = candidate;
      remote = newest;
      const id = signalId(candidate);
      unread = candidate !== null && options.read(READ_KEY) !== id;
      if (unread && options.isViewing?.()) {
        options.write(READ_KEY, id);
        unread = false;
      }
      checking = false;
      checked = true;
      error = null;
      maybeBubble();
      options.changed();
    }
    async function check() {
      if (checking) return;
      checking = true;
      error = null;
      try {
        const desktop2 = options.getDesktop();
        if (desktop2 !== null && desktop2?.updates) {
          const [current, result] = await Promise.all([desktop2.updates.current(), desktop2.updates.list()]);
          if (!result?.ok) throw new Error(result?.reason || "\u6CA1\u95EE\u5230 GitHub");
          const newest2 = newestRelease(result.releases);
          const gameNew = newest2 !== null && compareVersions(newest2.version, current?.version ?? options.currentVersion()) > 0;
          const shellNew = newestRelease((result.releases ?? []).filter((release) => release.shellUpdate === true));
          let candidate2 = null;
          if (gameNew) candidate2 = { ...newest2, kind: newest2.blocked === "shell" ? "shell" : "game" };
          else if (shellNew !== null) candidate2 = { ...shellNew, kind: "shell" };
          accept(candidate2, newest2);
          return;
        }
        const newest = await options.fetchLatest();
        const candidate = newest !== null && compareVersions(newest.version, options.currentVersion()) > 0 ? { ...newest, kind: "game" } : null;
        accept(candidate, newest);
      } catch (caught) {
        checking = false;
        error = caught instanceof Error ? caught.message : "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25";
        options.changed();
      }
    }
    function simulate(version) {
      latest = { version: String(version), kind: "game", prerelease: false };
      unread = true;
      options.changed();
    }
    function markRead() {
      if (latest === null) return;
      options.write(READ_KEY, signalId(latest));
      unread = false;
      options.changed();
    }
    function start2() {
      timer2 = window.setTimeout(check, 1e4);
      interval = window.setInterval(check, 6 * 60 * 60 * 1e3);
    }
    function stop() {
      if (timer2 !== null) window.clearTimeout(timer2);
      if (interval !== null) window.clearInterval(interval);
      timer2 = null;
      interval = null;
    }
    return {
      check,
      markRead,
      maybeBubble,
      simulate,
      start: start2,
      stop,
      get latest() {
        return latest;
      },
      get remote() {
        return remote;
      },
      get unread() {
        return unread;
      },
      get checking() {
        return checking;
      },
      get checked() {
        return checked;
      },
      get error() {
        return error;
      }
    };
  }
  async function cachedLatest(fetchLatest, store) {
    const now = store.now ? store.now() : Date.now();
    let saved = null;
    try {
      saved = JSON.parse(store.read(LATEST_CACHE_KEY) || "null");
    } catch {
      saved = null;
    }
    if (saved !== null && typeof saved.at === "number" && now - saved.at < LATEST_CACHE_MS) return saved.release ?? null;
    try {
      const release = await fetchLatest();
      store.write(LATEST_CACHE_KEY, JSON.stringify({ at: now, release }));
      return release;
    } catch (error) {
      if (saved !== null) return saved.release ?? null;
      throw error;
    }
  }
  function attachUpdateNotice(ctx, getDesktop, doFetch = fetch) {
    const notice = createUpdateNotice({
      currentVersion: () => ctx.view.version,
      getDesktop,
      fetchLatest: () => cachedLatest(() => fetchGithubLatest(doFetch), { read: readStore, write: writeStore }),
      read: readStore,
      write: writeStore,
      canBubble: () => ctx.view.pig !== null && ctx.bubble.hidden !== false,
      showBubble: (text) => ctx.showBubble(text, 4e3),
      isViewing: () => ctx.tab === "update",
      changed: () => {
        if (!ctx.stopped && ctx.isOpen && (ctx.tab === "home" || ctx.tab === "update")) ctx.renderContent();
      }
    });
    ctx.updateNotice = notice;
    notice.start();
    return notice;
  }

  // src/client/tabs/update.js
  var state = {
    current: null,
    list: null,
    error: null,
    loading: false,
    pick: null,
    previews: null,
    busy: null,
    fraction: 0,
    message: null,
    listening: false,
    shellStatus: null,
    shellBusy: false,
    shellReady: null,
    shellFraction: 0,
    shellMessage: null,
    shellListening: false
  };
  function updatesBridge() {
    var shell2 = (
      /** @type {any} */
      window.piggyShell
    );
    return shell2 && shell2.updates ? shell2 : null;
  }
  function refresh(ui, fresh) {
    var shell2 = updatesBridge();
    if (shell2 === null || state.loading) return;
    state.loading = true;
    state.error = null;
    if (!state.listening) {
      state.listening = true;
      shell2.updates.onProgress(function(fraction) {
        state.fraction = fraction;
        ui.renderContent();
      });
    }
    if (shell2.shellUpdates && !state.shellListening) {
      state.shellListening = true;
      shell2.shellUpdates.onProgress(function(fraction) {
        state.shellFraction = fraction;
        ui.renderContent();
      });
    }
    Promise.all([shell2.updates.current(), shell2.updates.list(fresh === true), shell2.shellUpdates ? shell2.shellUpdates.status() : null]).then(function(got) {
      state.current = got[0];
      if (got[1] && got[1].ok) state.list = got[1].releases;
      else state.error = got[1] && got[1].reason || "\u6CA1\u95EE\u5230";
      state.shellStatus = got[2];
    }, function() {
      state.error = "\u6CA1\u95EE\u5230";
    }).then(function() {
      state.loading = false;
      ui.renderContent();
    });
  }
  function downloadShell(ui, version) {
    var shell2 = updatesBridge();
    if (!shell2 || !shell2.shellUpdates || state.shellBusy) return;
    state.shellBusy = true;
    state.shellFraction = 0;
    state.shellMessage = null;
    ui.renderContent();
    shell2.shellUpdates.download(version).then(function(result) {
      if (result.ok) {
        state.shellReady = result.version;
        state.shellMessage = "\u5916\u58F3\u5DF2\u4E0B\u8F7D\uFF0C\u91CD\u542F\u732A\u732A\u540E\u5B89\u88C5\u3002\u5B58\u6863\u4F1A\u5148\u5907\u4EFD\u3002";
      } else state.shellMessage = result.reason || "\u5916\u58F3\u4E0B\u8F7D\u5931\u8D25";
      state.shellBusy = false;
      ui.renderContent();
    }, function(error) {
      state.shellBusy = false;
      state.shellMessage = String(error);
      ui.renderContent();
    });
  }
  function installShell(ui) {
    var shell2 = updatesBridge();
    if (!shell2 || !shell2.shellUpdates) return;
    shell2.shellUpdates.install().then(function(result) {
      if (!result.ok) {
        state.shellMessage = result.reason;
        ui.renderContent();
      }
    });
  }
  function shellManualReason(mode) {
    if (mode === "portable") return "Windows \u4FBF\u643A\u7248\u9700\u8981\u4E0B\u8F7D\u5E76\u66FF\u6362\u65E7 EXE\u3002";
    if (mode === "unsigned-mac") return "macOS \u5305\u6682\u672A\u7B7E\u540D\uFF0C\u65E0\u6CD5\u5728\u5E94\u7528\u5185\u81EA\u52A8\u66F4\u65B0\uFF1B\u8BF7\u4E0B\u8F7D DMG \u5E76\u66FF\u6362\u5E94\u7528\u3002";
    if (mode === "manual") return "\u8FD9\u79CD Linux \u5B89\u88C5\u65B9\u5F0F\u9700\u8981\u4ECE\u53D1\u5E03\u9875\u4E0B\u8F7D\u65B0\u5305\u3002";
    if (mode === "preview-manual") return "\u9884\u89C8\u7248\u7684\u684C\u9762\u5916\u58F3\u8981\u4ECE\u53D1\u5E03\u9875\u4E0B\u8F7D\u5B89\u88C5\u5305\uFF0C\u88C5\u4E00\u6B21\u4E4B\u540E\u5C31\u80FD\u5728\u8FD9\u91CC\u76F4\u63A5\u66F4\u65B0\u3002";
    return "\u5F53\u524D\u7248\u672C\u8FD8\u4E0D\u652F\u6301\u5E94\u7528\u5185\u66F4\u65B0\u5916\u58F3\uFF0C\u9700\u8981\u624B\u52A8\u5B89\u88C5\u4E00\u6B21\u65B0\u7248\u3002";
  }
  function install(ui, version) {
    var shell2 = updatesBridge();
    if (shell2 === null) return;
    state.busy = version;
    state.fraction = 0;
    state.message = null;
    ui.renderContent();
    shell2.updates.install(version).then(function(result) {
      state.message = result.ok ? "\u6362\u597D\u4E86\uFF0C\u732A\u9A6C\u4E0A\u56DE\u6765\u2026" : result.reason;
      if (!result.ok) state.busy = null;
      ui.renderContent();
    });
  }
  function rollback(ui) {
    var shell2 = updatesBridge();
    if (shell2 === null) return;
    state.busy = "rollback";
    ui.renderContent();
    shell2.updates.rollback().then(function(result) {
      state.message = result.ok ? "\u56DE\u53BB\u4E86\uFF0C\u732A\u9A6C\u4E0A\u56DE\u6765\u2026" : result.reason;
      if (!result.ok) state.busy = null;
      ui.renderContent();
    });
  }
  function renderUpdateTab(ui) {
    if (updatesBridge() === null) {
      renderDshUpdate(ui);
      return;
    }
    if (state.current === null && state.list === null && state.error === null) refresh(ui);
    var cur = state.current;
    var head = el("div", "dp-pick dp-tile-card dp-update-now");
    var top = el("div", "dp-update-top");
    top.appendChild(el("div", "dp-pick-head", cur === null ? "\u6B63\u5728\u770B\u73B0\u5728\u7684\u7248\u672C\u2026" : "\u6E38\u620F v" + cur.version + (cur.bundled ? "\uFF08\u5B89\u88C5\u5305\u81EA\u5E26\uFF09" : "")));
    head.appendChild(top);
    if (cur !== null) head.appendChild(el("div", "dp-dim", "\u684C\u9762\u5916\u58F3 v" + cur.shell + " \xB7 \u6E38\u620F\u73A9\u6CD5\u548C\u7A97\u53E3\u529F\u80FD\u5206\u522B\u66F4\u65B0"));
    if (state.message !== null) head.appendChild(el("div", "dp-req", state.message));
    var again = button("dp-mini dp-update-refresh", { "data-update-refresh": "" }, function() {
      state.message = null;
      state.shellMessage = null;
      refresh(ui, true);
    });
    again.textContent = state.loading ? "\u6B63\u5728\u5237\u65B0\u2026" : "\u{1F504} \u5237\u65B0";
    again.disabled = state.loading || state.busy !== null || state.shellBusy;
    top.appendChild(again);
    var eligible = function(r) {
      return !r.prerelease;
    };
    var shellOf = function(r) {
      return r.latestShell || r.manifest && r.manifest.shellVersion || null;
    };
    var shellRelease = state.list === null || cur === null ? null : state.list.find(function(r) {
      return eligible(r) && shellOf(r) !== null && compareVersions(shellOf(r), cur.shell) > 0;
    }) || null;
    if (shellRelease !== null) {
      var shellVersion = shellOf(shellRelease);
      var mode = state.shellStatus && state.shellStatus.mode;
      if (shellRelease.prerelease && compareVersions(cur.shell, "0.2.5") < 0) mode = "preview-manual";
      var required = compareVersions(cur.shell, "0.2.0") < 0 || state.list.some(function(r) {
        return eligible(r) && r.blocked === "shell" && compareVersions(r.version, cur.version) > 0;
      });
      head.appendChild(el("div", required ? "dp-req" : "dp-dim", required ? "\u684C\u9762\u5916\u58F3 v" + cur.shell + " \u2192 v" + shellVersion + "\uFF1A\u65B0\u7248\u672C\u6E38\u620F\u9700\u8981\u5B83" : "\u684C\u9762\u5916\u58F3\u6709\u53EF\u9009\u66F4\u65B0 v" + shellVersion + "\uFF0C\u4E0D\u66F4\u65B0\u4E5F\u80FD\u6B63\u5E38\u73A9"));
      if (compareVersions(cur.shell, "0.2.0") < 0) head.appendChild(el("div", "dp-dim", "\u4F60\u7684\u684C\u9762\u5916\u58F3\u662F\u94FA\u6EE1\u5168\u5C4F\u7684\u65E7\u7248\uFF0C\u4F1A\u5361\u3001\u4F1A\u95EA\uFF1B\u65B0\u5916\u58F3\u53EA\u6846\u4F4F\u732A\u548C\u9762\u677F\u3002\u8BF7\u4E0B\u8F7D\u65B0\u5B89\u88C5\u5305\u8986\u76D6\u5B89\u88C5\uFF0C\u5B58\u6863\u4E0D\u4F1A\u4E22\u3002"));
      if (mode !== "automatic" && required) head.appendChild(el("div", "dp-dim", shellManualReason(mode)));
      if (state.shellMessage !== null) head.appendChild(el("div", "dp-req", state.shellMessage));
      if (state.shellBusy) head.appendChild(el("div", "dp-dim", "\u6B63\u5728\u4E0B\u8F7D\u684C\u9762\u5916\u58F3 " + Math.round(state.shellFraction * 100) + "%"));
      var shellGo = button(required ? "dp-btn dp-btn-wide" : "dp-mini", { "data-update-shell": shellRelease.version }, function() {
        if (mode !== "automatic") updatesBridge().openPage(shellRelease.page);
        else if (state.shellReady === shellVersion) installShell(ui);
        else downloadShell(ui, shellVersion);
      });
      shellGo.textContent = mode !== "automatic" ? "\u6253\u5F00\u53D1\u5E03\u9875\u4E0B\u8F7D" : state.shellReady === shellVersion ? "\u91CD\u542F\u5E76\u5B89\u88C5\u684C\u9762\u5916\u58F3" : "\u4E0B\u8F7D\u684C\u9762\u5916\u58F3 v" + shellVersion;
      shellGo.disabled = state.shellBusy || state.busy !== null;
      head.appendChild(shellGo);
    }
    if (state.busy !== null && state.message === null) {
      head.appendChild(el("div", "dp-dim", state.busy === "rollback" ? "\u6B63\u5728\u6362\u56DE\u53BB\u2026" : "\u4E0B\u8F7D\u4E2D " + Math.round(state.fraction * 100) + "%"));
    }
    var latest = state.list === null ? null : state.list.find(function(r) {
      return r.blocked === null && eligible(r);
    }) || null;
    if (latest !== null && cur !== null && compareVersions(latest.version, cur.version) > 0) {
      var up = button("dp-btn dp-btn-wide", { "data-update-latest": latest.version }, function() {
        install(ui, latest.version);
      });
      up.textContent = "\u2B06\uFE0F \u66F4\u65B0\u5230\u6700\u65B0 v" + latest.version;
      up.disabled = state.busy !== null;
      head.appendChild(up);
    } else if (latest !== null) {
      head.appendChild(el("div", "dp-req dp-req-ok", "\u2713 \u5DF2\u7ECF\u662F\u6700\u65B0"));
    }
    ui.content.appendChild(head);
    if (state.loading && state.list === null) ui.content.appendChild(el("div", "dp-empty", "\u6B63\u5728\u95EE GitHub\u2026"));
    if (state.error !== null) {
      ui.content.appendChild(el("div", "dp-empty", state.error));
      var again = button("dp-btn dp-btn-wide", { "data-update-retry": "" }, function() {
        refresh(ui, true);
      });
      again.textContent = "\u518D\u8BD5\u4E00\u6B21";
      ui.content.appendChild(again);
    }
    if (state.list !== null) renderList(ui, state.list);
    if (cur !== null && cur.previous !== null) {
      var back = button("dp-btn dp-btn-wide dp-update-back", { "data-update-rollback": "" }, function() {
        rollback(ui);
      });
      back.textContent = "\u21A9\uFE0F \u56DE\u5230\u4E0A\u4E00\u4E2A\u7248\u672C v" + cur.previous;
      back.disabled = state.busy !== null;
      ui.content.appendChild(back);
    }
  }
  function renderDshUpdate(ui) {
    var notice = ui.updateNotice;
    var head = el("div", "dp-pick dp-tile-card dp-update-now");
    head.appendChild(el("div", "dp-pick-head", "\u73B0\u5728 v" + (ui.view.version || "\u672A\u77E5")));
    head.appendChild(el("div", "dp-dim", "DSH \u63D2\u4EF6\u53EA\u63D0\u9192\u65B0\u7248\u672C\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u6539\u52A8\u672C\u5730\u6587\u4EF6\u3002"));
    ui.content.appendChild(head);
    if (notice === null || notice === void 0) return;
    if (!notice.checked && !notice.checking && notice.error === null) notice.check();
    if (notice.checking) {
      ui.content.appendChild(el("div", "dp-empty", "\u6B63\u5728\u95EE GitHub\u2026"));
      return;
    }
    if (notice.error !== null) {
      ui.content.appendChild(el("div", "dp-empty", notice.error));
      var retry = button("dp-btn dp-btn-wide", { "data-update-retry": "" }, function() {
        notice.check();
      });
      retry.textContent = "\u518D\u8BD5\u4E00\u6B21";
      ui.content.appendChild(retry);
      return;
    }
    var release = notice.remote;
    if (release === null) return;
    if (notice.latest === null) {
      ui.content.appendChild(el("div", "dp-req dp-req-ok", "\u2713 \u5DF2\u7ECF\u662F\u6700\u65B0"));
      return;
    }
    var box = el("div", "dp-pick dp-tile-card dp-update-detail");
    box.appendChild(el("div", "dp-pick-head", "\u53D1\u73B0\u65B0\u7248\u672C v" + release.version));
    if (release.notes) box.appendChild(el("div", "dp-update-notes", release.notes));
    var go = button("dp-btn dp-btn-wide", { "data-update-page": release.version }, function() {
      window.open(release.page, "_blank", "noopener");
    });
    go.textContent = "\u6253\u5F00\u53D1\u5E03\u9875";
    box.appendChild(go);
    ui.content.appendChild(box);
  }
  function baseOf(version) {
    return String(version).split("-")[0];
  }
  function renderList(ui, list) {
    if (list.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "GitHub \u4E0A\u8FD8\u6CA1\u6709\u80FD\u70ED\u66F4\u65B0\u7684\u7248\u672C"));
      return;
    }
    var groups = [];
    var byBase = {};
    for (var i = 0; i < list.length; i += 1) {
      var release = list[i];
      var base = baseOf(release.version);
      if (byBase[base] === void 0) {
        byBase[base] = { base, stable: null, previews: [] };
        groups.push(byBase[base]);
      }
      if (release.prerelease) byBase[base].previews.push(release);
      else byBase[base].stable = release;
    }
    groups.sort(function(a, b) {
      return compareVersions(b.base, a.base);
    });
    var newestStable = list.find(function(r) {
      return !r.prerelease && r.blocked === null;
    }) || null;
    for (var g = 0; g < groups.length; g += 1) renderGroup(ui, groups[g], newestStable);
  }
  function renderGroup(ui, group, newestStable) {
    var key = group.base;
    var head = group.stable ?? group.previews[0];
    var open = state.pick === key;
    var box = el("div", "dp-rel");
    box.setAttribute("data-release-group", key);
    var row = button("dp-rel-head", { "data-release": head.version }, function() {
      state.pick = open ? null : key;
      ui.renderContent();
    });
    row.appendChild(el("b", null, "v" + key));
    row.appendChild(el("small", null, group.stable !== null ? group.stable.date : "\u8FD8\u6CA1\u53D1\u6B63\u5F0F\u7248"));
    var tags = el("span", "dp-rel-tags");
    var current = group.stable !== null && group.stable.current || group.previews.some(function(r) {
      return r.current;
    });
    if (current) tags.appendChild(tag("current", "\u5728\u7528"));
    if (group.stable !== null && newestStable !== null && group.stable.version === newestStable.version) tags.appendChild(tag("latest", "\u6700\u65B0"));
    if (group.stable !== null && group.stable.blocked !== null) tags.appendChild(tag("blocked", "\u{1F512}"));
    row.appendChild(tags);
    box.appendChild(row);
    if (open) {
      var body = el("div", "dp-rel-body");
      if (group.stable !== null) body.appendChild(details(ui, group.stable));
      if (group.previews.length > 0) {
        var pre = el("div", "dp-rel-pre");
        var showing = state.previews === key;
        var toggle = button("dp-mini dp-mini-plain", { "data-previews": key }, function() {
          state.previews = showing ? null : key;
          ui.renderContent();
        });
        toggle.textContent = (showing ? "\u25BE " : "\u25B8 ") + "\u6D4B\u8BD5\u7248 " + group.previews.length + " \u4E2A \xB7 \u624B\u52A8\u5B89\u88C5";
        pre.appendChild(toggle);
        if (showing) {
          for (var p = 0; p < group.previews.length; p += 1) pre.appendChild(previewRow(ui, group.previews[p]));
        }
        body.appendChild(pre);
      }
      box.appendChild(body);
    }
    ui.content.appendChild(box);
  }
  function tag(kind, text) {
    var node = el("span", "dp-rel-tag", text);
    node.setAttribute("data-tag", kind);
    return node;
  }
  function previewRow(ui, release) {
    var row = el("div", "dp-rel-pre-row");
    row.appendChild(el("span", null, "v" + release.version + (release.date ? " \xB7 " + release.date : "")));
    var go = button("dp-mini", { "data-update-install": release.version }, function() {
      if (release.blocked === "shell") updatesBridge().openPage(release.page);
      else install(ui, release.version);
    });
    go.textContent = release.current ? "\u6B63\u5728\u7528" : release.blocked === "shell" ? "\u9700\u8981\u65B0\u5916\u58F3" : release.blocked === "save" ? "\u6362\u4E0D\u4E86" : "\u5B89\u88C5\u6D4B\u8BD5\u7248";
    go.disabled = release.current || release.blocked === "save" || state.busy !== null;
    row.appendChild(go);
    return row;
  }
  function details(ui, release) {
    var box = el("div", "dp-pick dp-tile-card dp-update-detail");
    box.appendChild(el("div", "dp-pick-head", "v" + release.version + (release.date ? " \xB7 " + release.date : "") + (release.prerelease ? " \xB7 \u9884\u89C8\u7248" : "")));
    if (release.notes) box.appendChild(el("div", "dp-update-notes", release.notes));
    var go = button("dp-btn dp-btn-wide", { "data-update-install": release.version }, function() {
      if (release.blocked === "shell") updatesBridge().openPage(release.page);
      else install(ui, release.version);
    });
    if (release.current) {
      go.textContent = "\u6B63\u5728\u7528\u8FD9\u4E2A";
      go.disabled = true;
    } else if (release.blocked === "shell") {
      box.appendChild(el("div", "dp-req", "\u2717 \u6E38\u620F v" + release.version + " \u8981\u6C42\u684C\u9762\u5916\u58F3\u81F3\u5C11 v" + release.minShell));
      go.textContent = state.shellStatus && state.shellStatus.mode === "automatic" ? "\u5148\u66F4\u65B0\u4E0A\u9762\u7684\u684C\u9762\u5916\u58F3" : "\u53BB\u4E0B\u8F7D\u65B0\u5B89\u88C5\u5305";
      if (state.shellStatus && state.shellStatus.mode === "automatic") go.disabled = true;
    } else if (release.blocked === "save") {
      box.appendChild(el("div", "dp-req", "\u2717 \u5B58\u6863\u592A\u65B0\uFF0C\u8FD9\u4E2A\u7248\u672C\u8BFB\u4E0D\u4E86"));
      go.textContent = "\u6362\u4E0D\u4E86";
      go.disabled = true;
    } else {
      go.textContent = "\u6362\u5230\u8FD9\u4E2A\u7248\u672C";
      go.disabled = state.busy !== null;
    }
    box.appendChild(go);
    return box;
  }

  // src/client/tabs/status.js
  function renderStatusTab(ui) {
    var p = ui.view.pig;
    if (p === null) return;
    renderBanners(ui);
    var lv = p.level;
    labelledBar(
      ui,
      "\u2B50 Lv." + lv.level + " " + lv.titleEmoji + lv.titleLabel,
      lv.maxed ? 100 : lv.percent,
      lv.maxed ? "\u6EE1\u7EA7" : "\u8FD8\u5DEE " + Math.ceil(lv.toNext) + " \u6210\u957F",
      "dp-level"
    );
    labelledBar(ui, "\u{1F35A} \u9971\u98DF", p.satiety, p.satiety + "%");
    labelledBar(ui, "\u2764\uFE0F \u5FC3\u60C5", p.happiness, p.happiness + "%", "dp-mood");
    labelledBar(ui, "\u{1FAE7} \u6E05\u6D01", p.cleanliness, p.cleanliness + "%", "dp-clean");
    labelledBar(ui, "\u{1F49A} \u5065\u5EB7", p.healthPercent, p.health + "/" + ui.view.maxHealth, "dp-health");
    var traits = el("div", "dp-traits");
    traits.appendChild(el("span", null, "\u{1F9E0} \u667A\u529B " + p.traits.intel));
    traits.appendChild(el("span", null, "\u2728 \u9B45\u529B " + p.traits.charm));
    traits.appendChild(el("span", null, "\u{1F4AA} \u6B66\u529B " + p.traits.strong));
    ui.content.appendChild(traits);
    renderWeight(ui, p);
    var daily = ui.view.daily;
    var dailyLine = el("div", "dp-row");
    dailyLine.appendChild(el("span", null, "\u{1F4C5} \u7B7E\u5230"));
    dailyLine.appendChild(el("b", null, "\u7B2C " + daily.signInDay + "/" + daily.cycle + " \u5929" + (daily.canSignIn ? " \xB7 \u4ECA\u5929\u8FD8\u6CA1\u7B7E" : "") + (daily.unclaimed > 0 ? " \xB7 \u{1F381} " + daily.unclaimed : "")));
    ui.content.appendChild(dailyLine);
    var grid = el("div", "dp-actions");
    for (var i = 0; i < MODES.length; i += 1) {
      (function(key) {
        var info = ui.view.actions[key];
        var shelf = ui.view.care[key] ?? [];
        var needsItem = shelf.length > 0;
        var btn = button("dp-btn", { "data-action": key }, function() {
          if (BAG_SHELF[key] !== void 0) {
            ui.select("bag");
            ui.drill.from = "status";
            drillTo(ui, "bag", BAG_SHELF[key]);
          } else {
            ui.send(key);
          }
        });
        btn.appendChild(el("span", null, CARE_LABEL[key][1]));
        btn.appendChild(el("span", null, CARE_LABEL[key][0]));
        if (needsItem) btn.appendChild(el("span", "dp-count", String(shelf.length)));
        if (!info.ready || ui.view.dead) {
          btn.disabled = true;
          if (ui.view.dead) btn.appendChild(el("span", "dp-wait", "\u2014"));
          else if (info.waitSeconds > 0) btn.appendChild(el("span", "dp-wait", info.waitSeconds + "s"));
          else if (info.blocked === "away") btn.appendChild(el("span", "dp-wait", "\u4E0D\u5728\u5BB6"));
        }
        grid.appendChild(btn);
      })(MODES[i]);
    }
    ui.content.appendChild(grid);
    if (p.memories.length > 0) {
      ui.content.appendChild(el("div", "dp-memo", p.memories.slice(-3).join("\n")));
    }
  }
  var BAG_SHELF = { feed: "food", bathe: "bath", play: "toy" };
  function renderWeight(ui, p) {
    var row = el("div", "dp-row");
    row.appendChild(el("span", null, "\u2696\uFE0F \u4F53\u91CD"));
    row.appendChild(el("b", null, p.weight + (p.bodyWeight !== null ? " \xB7 " + p.bodyWeight.label : "")));
    ui.content.appendChild(row);
  }
  function renderBanners(ui) {
    if (ui.view.pig !== null && ui.view.dead) {
      var dead = el("div", "dp-alert dp-dead");
      dead.appendChild(el("b", null, (ui.view.pig.stage.key === "grave" ? "\u{1FAA6} " : "\u{1F416} ") + ui.view.pig.name + " \u8D70\u4E86" + (ui.view.pig.soul ? "\uFF0C\u7075\u9B42\u8FD8\u7559\u5728\u5893\u7891\u65C1 \u{1F47B}" : "")));
      dead.appendChild(el("div", null, ui.view.pig.soul ? "\u7528\u8FD8\u9B42\u4E39\u53EF\u4EE5\u628A\u5B83\u53EB\u56DE\u6765\uFF0C\u4E5F\u53EF\u4EE5\u9886\u517B\u65B0\u7684" : "\u80CC\u5305\u91CC\u7684\u8FD8\u9B42\u4E39\u5C31\u80FD\u6551\u56DE\u6765"));
      ui.content.appendChild(dead);
      var adoptWrap = el("div", "dp-actions");
      var adopt = button("dp-btn dp-btn-wide", { "data-action": "adopt" }, function() {
        ui.send("adopt");
      });
      adopt.appendChild(el("span", null, "\u{1F4E6}"));
      adopt.appendChild(el("span", null, "\u9886\u517B\u65B0\u732A"));
      adoptWrap.appendChild(adopt);
      ui.content.appendChild(adoptWrap);
    } else if (ui.view.pig !== null && ui.view.pig.illness !== null) {
      var illness = ui.view.pig.illness;
      var sick = el("div", "dp-alert dp-sick");
      sick.appendChild(el("b", null, "\u{1F912} " + illness.name + "\uFF08\u7B2C " + illness.stage + "/4 \u671F\uFF09"));
      sick.appendChild(el("div", null, "\u9700\u8981\u300C" + illness.cureEmoji + illness.cure + "\u300D\u2014\u2014 \u5403\u9519\u836F\u4F1A\u52A0\u91CD"));
      var needed = null;
      var shelf = ui.view.shop || [];
      for (var c = 0; c < shelf.length; c += 1) {
        if (shelf[c].needed) needed = shelf[c];
      }
      for (var t = 0; needed === null && t < shelf.length; t += 1) {
        if (shelf[t].kind === "medicine" && shelf[t].tier === illness.stage) needed = shelf[t];
      }
      for (var n = 0; needed === null && n < shelf.length; n += 1) {
        if (shelf[n].label === illness.cure) needed = shelf[n];
      }
      if (ui.view.canGoOut) {
        sick.appendChild(el("div", "dp-dim", "\u5E26\u75C5\u51FA\u95E8\u62A5\u916C\u51CF\u534A\u3001\u75C5\u60C5\u66F4\u5FEB"));
      }
      if (needed !== null && ui.view.canGoOut && ui.view.pig.coins < needed.price) {
        sick.appendChild(el("div", "dp-dim", "\u8FD8\u5DEE " + needed.price + " \u{1FA99} \u4E70\u300C" + needed.label + "\u300D\uFF0C\u5148\u53BB\u6253\u5DE5"));
      }
      ui.content.appendChild(sick);
      if (illness.doctorFee !== null) {
        var clinic = el("div", "dp-actions");
        var doctor = button("dp-btn dp-btn-wide", { "data-action": "doctor" }, function() {
          ui.send("doctor");
        });
        doctor.appendChild(el("span", null, "\u{1F3E5}"));
        doctor.appendChild(el("span", null, "\u770B\u533B\u751F\uFF08" + illness.doctorFee + " \u{1FA99}\uFF09"));
        clinic.appendChild(doctor);
        ui.content.appendChild(clinic);
      }
    } else if (ui.view.pig !== null && ui.view.activity !== null) {
      var away = el("div", "dp-alert dp-work");
      away.appendChild(el("b", null, ui.view.activity.emoji + " \u5728\u5916\u9762\uFF1A" + ui.view.activity.label));
      away.appendChild(el("div", null, "\u8FD8\u6709 " + ui.view.activity.secondsLeft + " \u79D2"));
      ui.content.appendChild(away);
      var wrap = el("div", "dp-actions");
      var call = button("dp-btn dp-btn-wide", { "data-action": "calloff" }, function() {
        ui.send("calloff");
      });
      call.appendChild(el("span", null, "\u21A9\uFE0F"));
      call.appendChild(el("span", null, "\u53EB\u5B83\u56DE\u6765"));
      wrap.appendChild(call);
      ui.content.appendChild(wrap);
    }
  }

  // src/client/tabs/study.js
  var INTEREST_TAB = "interest";
  var STAGE_COLOR = { primary: "yellow", middle: "teal", college: "blue", graduate: "purple", beyond: "pink" };
  var INTEREST_COLOR = "orange";
  var FALLBACK_COLORS = ["yellow", "teal", "blue", "purple", "pink", "green", "lime"];
  function standing(sub, stage2) {
    if (stage2 === null || sub.stageKey === "") return "current";
    if (sub.stageKey === stage2.key) return "current";
    if (stage2.upTo !== null && sub.lessons >= stage2.upTo) return "done";
    return "ahead";
  }
  function renderStudyTab(ui) {
    renderSwitchAsk(ui);
    if (ui.view.activity?.kind === "interest") {
      var active = ui.view.activity;
      var left = Math.max(1, Math.ceil(active.secondsLeft / 60));
      ui.content.appendChild(el("div", "dp-alert", active.emoji + " \u6B63\u5728\u5B66" + active.label.replace(/^兴趣·/, "") + " \xB7 \u8FD8\u6709 " + left + " \u5206\u949F"));
    }
    if (ui.view.subjects.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u5BBF\u4E3B\u8FD8\u6CA1\u63D0\u4F9B\u8BFE\u7A0B\u8868\u3002"));
      return;
    }
    var open = ui.drill.study;
    if (open === INTEREST_TAB && ui.view.interests.length > 0) {
      renderInterests(ui);
      return;
    }
    var stage2 = null;
    for (var d = 0; d < ui.view.stages.length; d += 1) if (ui.view.stages[d].key === open) stage2 = ui.view.stages[d];
    if (stage2 === null) {
      renderStages(ui);
      return;
    }
    renderSubjects(ui, stage2);
  }
  function renderStages(ui) {
    var stageList = ui.view.stages.length > 0 ? ui.view.stages : STAGES;
    var grid = tileGrid();
    for (var s = 0; s < stageList.length; s += 1) {
      (function(entry, index) {
        var locked = entry.unlocked === false;
        var finished = entry.upTo === null || entry.upTo === void 0 ? 0 : ui.view.subjects.filter(function(sub) {
          return sub.lessons >= entry.upTo;
        }).length;
        grid.appendChild(tile({
          emoji: entry.emoji || "\u{1F4DA}",
          label: entry.label,
          color: STAGE_COLOR[entry.key] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
          locked,
          tag: locked ? "\u{1F512}" : "",
          badge: finished > 0 ? "\u2713" + finished : "",
          data: { "data-stage": entry.key },
          onPick: function() {
            drillTo(ui, "study", entry.key);
          }
        }));
      })(stageList[s], s);
    }
    if (ui.view.interests.length > 0) {
      var certified = ui.view.interests.filter(function(entry) {
        return entry.certified;
      }).length;
      grid.appendChild(tile({
        emoji: "\u{1F3AF}",
        label: "\u5174\u8DA3",
        color: INTEREST_COLOR,
        badge: certified > 0 ? "\u{1F4DC}" + certified : "",
        data: { "data-stage": INTEREST_TAB },
        onPick: function() {
          drillTo(ui, "study", INTEREST_TAB);
        }
      }));
    }
    ui.content.appendChild(grid);
  }
  function renderSubjects(ui, stage2) {
    drillHeader(
      ui,
      "study",
      stage2.emoji + " " + stage2.label,
      stage2.minutes + " \u5206\u949F \xB7 " + stage2.tuition + " \u{1FA99} \xB7 +" + stage2.gain
    );
    var color = STAGE_COLOR[stage2.key] ?? FALLBACK_COLORS[Math.max(0, ui.view.stages.indexOf(stage2)) % FALLBACK_COLORS.length];
    var grid = tileGrid();
    for (var i = 0; i < ui.view.subjects.length; i += 1) {
      (function(sub) {
        var where = standing(sub, stage2);
        var note;
        if (where === "done") note = "\u2713 \u6BD5\u4E1A";
        else if (where === "ahead") note = "\u{1F512} " + (sub.stageLabel || "\u6CA1\u5230");
        else if (stage2.upTo !== null) note = sub.lessons - stage2.from + "/" + (stage2.upTo - stage2.from) + " \u8282";
        else note = sub.lessons + " \u8282";
        grid.appendChild(tile({
          emoji: sub.emoji,
          label: sub.label,
          color,
          soft: true,
          note,
          disabled: where !== "current" || !canStart(ui),
          dim: where === "current" && !sub.affordable,
          data: { "data-subject": sub.key },
          onPick: function() {
            startOrSwitch(ui, "\u4E0A" + sub.label + "\u8BFE", "study", { subject: sub.key });
          }
        }));
      })(ui.view.subjects[i]);
    }
    ui.content.appendChild(grid);
  }
  function renderInterests(ui) {
    var after = ui.view.interests[0].certificateAfter;
    drillHeader(ui, "study", "\u{1F3AF} \u5174\u8DA3", after > 0 ? "\u4E0A\u6EE1 " + after + " \u6B21\u62FF\u8BC1" : "");
    var grid = tileGrid();
    for (var n = 0; n < ui.view.interests.length; n += 1) {
      (function(entry) {
        var note = entry.cost + " \u{1FA99} \xB7 \u7EA6 " + entry.minutes + " \u5206\u949F\u540E " + entry.traitLabel + " +" + entry.gain;
        var badge2 = entry.certificate === "" ? "" : entry.certified ? "\u{1F4DC}" : entry.times + "/" + entry.certificateAfter;
        grid.appendChild(tile({
          emoji: entry.emoji,
          label: entry.label,
          color: INTEREST_COLOR,
          soft: true,
          note,
          badge: badge2,
          disabled: !canStart(ui),
          dim: !entry.affordable,
          data: { "data-interest": entry.key },
          onPick: function() {
            startOrSwitch(ui, "\u5B66" + entry.label, "interest", { interest: entry.key });
          }
        }));
      })(ui.view.interests[n]);
    }
    ui.content.appendChild(grid);
  }

  // src/client/tabs/skin-guide.js
  var GUIDE_URL = CHANNEL.blobBase + "/docs/guides/creating-skins.md";
  var EXAMPLE_URL = CHANNEL.rawBase + "/docs/examples/skin-pack-example.zip";
  var POSES = [
    { file: "idle.png", need: true, when: "\u5E73\u65F6\u5F85\u7740\uFF1B\u7F3A\u5C11\u53EF\u9009\u52A8\u4F5C\u65F6\u4E5F\u7528\u5B83", art: "skin-detective" },
    { file: "eat.png", need: true, when: "\u5403\u4E1C\u897F", art: "skin-detective-eat" },
    { file: "bathe.png", need: true, when: "\u6D17\u6FA1", art: "skin-detective-bathe" },
    { file: "play.png", need: true, when: "\u73A9\u800D", art: "skin-detective-play" },
    { file: "pet.png", need: true, when: "\u88AB\u6478\u6478", art: "skin-detective-pet" },
    { file: "relaxed.png", need: false, when: "\u653E\u677E\u3001\u756A\u8304\u949F\u966A\u4F60\u4E13\u6CE8", art: "skin-detective-relaxed" },
    { file: "work.png", need: false, when: "\u6253\u5DE5", art: "skin-detective-work" },
    { file: "study.png", need: false, when: "\u4E0A\u5B66", art: "skin-detective-study" },
    { file: "trip.png", need: false, when: "\u65C5\u884C", art: "skin-detective-trip" },
    { file: "fish.png", need: false, when: "\u9493\u9C7C", art: "skin-detective" },
    { file: "sleep.png", need: false, when: "\u6253\u76F9\u65F6\u6A2A\u8EBA\u7761\u89C9", art: "skin-detective-sleep", ext: ".png" }
  ];
  function openLink(url) {
    const shell2 = updatesBridge();
    if (shell2 !== null && typeof shell2.openPage === "function") shell2.openPage(url);
    else window.open(url, "_blank", "noopener");
  }
  function renderSkinGuide(ui) {
    drillHeader(ui, "skins", "\u{1F4D0} \u600E\u4E48\u505A\u76AE\u80A4", "11 \u5F20\u56FE");
    ui.content.appendChild(el("div", "dp-hint", "\u4E00\u5957\u76AE\u80A4 = \u4E00\u4E2A ZIP\uFF1A\u91CC\u9762\u653E skin.json \u548C\u4E0B\u9762\u8FD9\u4E9B\u900F\u660E PNG \u56FE\uFF08\u517C\u5BB9\u65E7 SVG \u5305\uFF09\u3002\u524D 5 \u5F20\u5FC5\u987B\u6709\uFF0C\u540E 6 \u5F20\u53EF\u4EE5\u4E0D\u753B\u3002\u52A8\u4F5C\u56FE\u7F3A\u5C11\u65F6\u7528 idle\uFF1Bsleep \u7F3A\u5C11\u65F6\u7528\u9ED8\u8BA4\u7761\u59FF\u3002"));
    const grid = el("div", "dp-guide-grid");
    for (const pose of POSES) {
      const cell = el("div", "dp-guide-cell" + (pose.need ? "" : " dp-guide-optional"));
      const img = (
        /** @type {HTMLImageElement} */
        el("img", "dp-guide-img")
      );
      img.src = artSource(pose.art);
      img.alt = "";
      cell.appendChild(img);
      cell.appendChild(el("b", null, pose.file));
      cell.appendChild(el("span", "dp-guide-need", pose.need ? "\u5FC5\u987B" : "\u53EF\u9009"));
      cell.appendChild(el("small", null, pose.when));
      grid.appendChild(cell);
    }
    ui.content.appendChild(grid);
    const rules = el("div", "dp-pick");
    rules.appendChild(el("b", null, "\u89C4\u683C"));
    for (const line3 of [
      "\u6BCF\u5F20\u90FD\u662F\u900F\u660E\u5E95 PNG\uFF0C\u63A8\u8350\u957F\u8FB9 256px\uFF0C\u6700\u591A 1024px",
      "\u732A\u7684\u8EAB\u4F53\u5C45\u4E2D\u3001\u811A\u5E95\u8D34\u7740\u540C\u4E00\u6761\u7EBF\uFF08\u53C2\u7167\u9ED8\u8BA4\u5C0F\u732A\uFF09\uFF0C\u5207\u6362\u52A8\u4F5C\u624D\u4E0D\u4F1A\u8DF3",
      "\u4FDD\u7559\u5B8C\u6574\u9ED1\u8272\u8F6E\u5ED3\u548C\u767D\u8272\u88C5\u626E\uFF0C\u4E0D\u8981\u767D\u5E95\u6216\u8FD0\u884C\u65F6\u62A0\u767D",
      "\u5355\u5F20 \u2264 96 KB\uFF0C\u6574\u4E2A ZIP \u2264 2 MB",
      "ZIP \u6253\u5F00\u76F4\u63A5\u770B\u5230 skin.json \u548C PNG\uFF0C\u4E0D\u8981\u518D\u5305\u4E00\u5C42\u6587\u4EF6\u5939"
    ]) rules.appendChild(el("div", "dp-guide-rule", "\u2022 " + line3));
    rules.appendChild(el("div", "dp-guide-rule", "\u65E7 SVG \u76AE\u80A4\u4ECD\u53EF\u5BFC\u5165\uFF0C\u7EE7\u7EED\u6CBF\u7528\u539F\u6709\u5B89\u5168\u68C0\u67E5\uFF1B\u540C\u4E00\u52A8\u4F5C\u53EA\u653E\u4E00\u79CD\u683C\u5F0F\u3002"));
    ui.content.appendChild(rules);
    const json = el("div", "dp-pick");
    json.appendChild(el("b", null, "skin.json \u5199\u4EC0\u4E48"));
    json.appendChild(el("pre", "dp-guide-code", '{\n  "key": "my-blue-pig",\n  "label": "\u84DD\u8393\u732A",\n  "author": "\u4F60\u7684\u540D\u5B57",\n  "description": "\u4E00\u53E5\u8BDD\u4ECB\u7ECD",\n  "emoji": "\u{1FAD0}"\n}'));
    json.appendChild(el("small", "dp-dim", "key \u53EA\u80FD\u7528\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u77ED\u6A2A\u7EBF\uFF1B\u4EE5\u540E\u66F4\u65B0\u76AE\u80A4\u4FDD\u6301\u540C\u4E00\u4E2A key\uFF0C\u518D\u5BFC\u5165\u5C31\u4F1A\u8986\u76D6"));
    ui.content.appendChild(json);
    const links = el("div", "dp-guide-links");
    const guide = button("dp-btn", { "data-skin-guide-open": "true" }, function() {
      openLink(GUIDE_URL);
    });
    guide.textContent = "\u{1F4D6} \u5B8C\u6574\u56FE\u6587\u6559\u7A0B";
    const example = button("dp-btn", { "data-skin-example": "true" }, function() {
      openLink(EXAMPLE_URL);
    });
    example.textContent = "\u{1F4E6} \u4E0B\u8F7D\u793A\u4F8B\u76AE\u80A4\u5305";
    links.appendChild(guide);
    links.appendChild(example);
    ui.content.appendChild(links);
  }

  // src/client/tabs/skins.js
  function renderSkinsTab(ui) {
    if (ui.drill.skins === "guide") {
      renderSkinGuide(ui);
      return;
    }
    const intro = el("div", "dp-pick dp-skin-intro");
    intro.appendChild(el("b", null, "\u7ED9\u732A\u732A\u6362\u4EF6\u65B0\u8863\u670D"));
    intro.appendChild(el("span", null, "\u53A8\u5E08\u4E0E\u5B87\u822A\u5458\u5B8C\u6210\u5BF9\u5E94\u5DE5\u4F5C\u540E\u89E3\u9501\uFF1B\u5176\u4ED6\u76AE\u80A4\u53EF\u76F4\u63A5\u4F7F\u7528\u3002\u5F62\u6001\u4F1A\u4F18\u5148\u663E\u793A\u3002"));
    ui.content.appendChild(intro);
    const grid = el("div", "dp-skin-grid");
    for (const skin of ui.view.skins.entries) grid.appendChild(skinCard(ui, skin));
    ui.content.appendChild(grid);
    ui.content.appendChild(importCard2(ui));
    const howto = button("dp-btn dp-skin-howto", { "data-skin-guide": "true" }, function() {
      drillTo(ui, "skins", "guide");
    });
    howto.textContent = "\u{1F4D0} \u600E\u4E48\u505A\u76AE\u80A4\uFF1A\u9700\u8981\u54EA\u4E9B\u56FE";
    ui.content.appendChild(howto);
  }
  function skinCard(ui, skin) {
    const card2 = el("div", "dp-item dp-skin-row" + (skin.current ? " dp-skin-current" : ""));
    if (!skin.unlocked) card2.setAttribute("data-locked", "true");
    const img = (
      /** @type {HTMLImageElement} */
      el("img", "dp-skin-art")
    );
    img.src = artSource(skin.art);
    img.alt = skin.label;
    card2.appendChild(img);
    const copy = el("span", "dp-grow dp-skin-copy");
    copy.appendChild(el("b", null, (skin.unlocked ? skin.emoji : "\u{1F512}") + " " + (skin.unlockJob ? "\u804C\u4E1A \xB7 " : "") + skin.label));
    copy.appendChild(el("small", "dp-dim", skin.unlocked ? skin.description || "\u4F5C\u8005\uFF1A" + skin.author : "\u5B8C\u6210" + (ui.view.jobs.find((job2) => job2.key === skin.unlockJob)?.label ?? skin.label.replace(/猪$/, "")) + "\u5DE5\u4F5C\u540E\u89E3\u9501"));
    card2.appendChild(copy);
    const pick = button("dp-mini", { "data-skin": skin.key }, function() {
      if (skin.unlocked) ui.send("skin", { skin: skin.key });
    });
    pick.textContent = !skin.unlocked ? "\u672A\u89E3\u9501" : skin.current ? "\u4F7F\u7528\u4E2D" : "\u4F7F\u7528";
    pick.disabled = !skin.unlocked || skin.current;
    card2.appendChild(pick);
    return card2;
  }
  function importCard2(ui) {
    const wrap = el("label", "dp-pick dp-tile-card dp-skin-import");
    wrap.appendChild(el("b", "dp-pick-head", "\u{1F4E6} \u5BFC\u5165\u81EA\u5DF1\u7684\u76AE\u80A4"));
    wrap.appendChild(el("span", "dp-dim", "\u9009\u62E9\u6309\u6559\u7A0B\u5236\u4F5C\u7684 ZIP\uFF1B\u5BFC\u5165\u6210\u529F\u540E\u4F1A\u81EA\u52A8\u4F7F\u7528\u3002"));
    const input = (
      /** @type {HTMLInputElement} */
      el("input")
    );
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.setAttribute("accept", ".zip,application/zip");
    input.setAttribute("data-skin-import", "zip");
    input.addEventListener("change", function() {
      const file = input.files?.[0];
      if (!file) return;
      file.arrayBuffer().then(function(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 32768)));
        return fetch("/dsh-piggy/skins/import", { method: "POST", headers: { "content-type": "text/plain" }, body: btoa(binary) });
      }).then((response) => response.json()).then((data) => {
        if (data.ok !== true) return ui.showBubble("\u5BFC\u5165\u5931\u8D25\uFF1A" + ((data.errors || [data.reason]).join("\uFF1B") || "\u8BF7\u68C0\u67E5\u76AE\u80A4\u5305"));
        if (typeof ui.render === "function") ui.render(data);
        else {
          ui.view = data;
          ui.renderContent();
        }
        ui.showBubble("\u76AE\u80A4\u5BFC\u5165\u6210\u529F \u{1F3A8}");
      }).catch(() => ui.showBubble("\u5BFC\u5165\u5931\u8D25\uFF1A\u65E0\u6CD5\u8BFB\u53D6\u76AE\u80A4\u5305"));
    });
    wrap.appendChild(input);
    wrap.appendChild(el("span", "dp-mini dp-skin-file", "\u9009\u62E9 ZIP"));
    return wrap;
  }

  // src/client/log-export.js
  var EXPORT_URL = "/dsh-piggy/logs/export";
  function fileName(now = /* @__PURE__ */ new Date()) {
    const pad = (value, width) => String(value).padStart(width, "0");
    return `dsh-piggy-log-${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}-${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}.txt`;
  }
  var isCancel = (error) => error?.name === "AbortError" || error?.name === "NotAllowedError";
  async function saveViaShell(name, text) {
    const shell2 = typeof window === "object" ? (
      /** @type {any} */
      window.piggyShell
    ) : void 0;
    const bridge3 = shell2?.logs;
    if (bridge3 === void 0 || typeof bridge3.save !== "function") return null;
    const result = await bridge3.save(name, text);
    if (result?.ok === true) return { ok: true, path: String(result.path ?? "") };
    if (result?.canceled === true) return { ok: false, canceled: true };
    return { ok: false, reason: String(result?.reason ?? "\u5916\u58F3\u6CA1\u80FD\u4FDD\u5B58") };
  }
  async function saveViaPicker(name, text) {
    const picker = typeof window === "object" ? (
      /** @type {any} */
      window.showSaveFilePicker
    ) : void 0;
    if (typeof picker !== "function") return null;
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: "\u65E5\u5FD7\u6587\u672C", accept: { "text/plain": [".txt"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { ok: true, path: "" };
    } catch (error) {
      if (isCancel(error)) return { ok: false, canceled: true };
      return null;
    }
  }
  function saveViaDownload(name, text) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1e4);
      return { ok: true, path: "", downloaded: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }
  async function exportLogs() {
    await flushBeforeExport();
    let text;
    try {
      const response = await fetch(EXPORT_URL, { cache: "no-store" });
      if (!response.ok) return { ok: false, reason: "\u5BBF\u4E3B\u8FD4\u56DE HTTP " + response.status };
      text = await response.text();
    } catch (error) {
      return { ok: false, reason: "\u62FF\u4E0D\u5230\u65E5\u5FD7\uFF1A" + (error instanceof Error ? error.message : String(error)) };
    }
    const name = fileName();
    const saved = await saveViaShell(name, text) ?? await saveViaPicker(name, text) ?? saveViaDownload(name, text);
    return { ...saved, bytes: text.length };
  }

  // src/client/tabs/proxy.js
  var preference = null;
  var loading = false;
  var busy2 = false;
  var draft = null;
  var message = "";
  var failure = false;
  function renderProxySettings(ui, section2, api) {
    const setting = section2(ui, "\u7F51\u7EDC\u4EE3\u7406", "\u7528\u4E8E\u66F4\u65B0\u4E0B\u8F7D\u548C\u5728\u7EBF\u6269\u5C55");
    if (preference === null) {
      setting.box.appendChild(el("small", "dp-dim", message || "\u6B63\u5728\u8BFB\u53D6\u4EE3\u7406\u914D\u7F6E\u2026"));
      if (!loading && !message) {
        loading = true;
        api.get().then((value) => {
          if (value?.mode) {
            preference = value;
            message = value.warning || "";
          } else message = value?.reason || "\u4EE3\u7406\u914D\u7F6E\u65E0\u6CD5\u8BFB\u53D6";
        }).catch((error) => {
          message = String(error);
        }).finally(() => {
          loading = false;
          if (ui.tab === "settings") ui.renderContent();
        });
      }
      return;
    }
    if (draft === null) draft = { ...preference };
    const form = el("div", "dp-proxy-form");
    const mode = (
      /** @type {HTMLSelectElement} */
      el("select", "dp-setting-field")
    );
    mode.setAttribute("aria-label", "\u4EE3\u7406\u6A21\u5F0F");
    mode.setAttribute("data-proxy-mode", "true");
    for (const [key, label] of [["system", "\u8DDF\u968F\u7CFB\u7EDF\u4EE3\u7406"], ["direct", "\u76F4\u8FDE\uFF08\u4E0D\u4F7F\u7528\u4EE3\u7406\uFF09"], ["http", "HTTP \u4EE3\u7406"], ["socks5", "SOCKS5 \u4EE3\u7406"]]) {
      const option = (
        /** @type {HTMLOptionElement} */
        el("option", null, label)
      );
      option.value = key;
      mode.appendChild(option);
    }
    mode.value = draft.mode;
    mode.disabled = busy2;
    const endpoint = (
      /** @type {HTMLInputElement} */
      el("input", "dp-setting-field")
    );
    endpoint.disabled = busy2;
    endpoint.type = "text";
    endpoint.placeholder = "\u4F8B\u5982 127.0.0.1:7890";
    endpoint.setAttribute("aria-label", "\u4EE3\u7406\u5730\u5740\u548C\u7AEF\u53E3");
    endpoint.setAttribute("data-proxy-address", "true");
    endpoint.value = draft.address;
    endpoint.addEventListener("input", () => {
      draft.address = endpoint.value;
    });
    const address = el("label", "dp-proxy-endpoint");
    address.appendChild(el("span", "dp-dim", "\u4EE3\u7406\u5730\u5740"));
    address.appendChild(endpoint);
    function choose2() {
      draft.mode = mode.value;
      address.hidden = mode.value === "system" || mode.value === "direct";
    }
    mode.addEventListener("change", choose2);
    choose2();
    form.appendChild(mode);
    form.appendChild(address);
    setting.box.appendChild(form);
    const controls = el("div", "dp-proxy-actions");
    const status = el("div", failure ? "dp-proxy-status dp-proxy-error" : "dp-proxy-status", message);
    status.hidden = !message;
    status.setAttribute("role", "status");
    const actions = [];
    async function run(action) {
      if (busy2) return;
      busy2 = true;
      for (const control of actions) control.disabled = true;
      mode.disabled = true;
      endpoint.disabled = true;
      status.hidden = false;
      status.textContent = "\u5904\u7406\u4E2D\u2026";
      try {
        const result = await action();
        failure = result?.ok !== true;
        if (result?.preference) {
          preference = result.preference;
          draft = { ...preference };
        }
        message = failure ? result?.reason || "\u4EE3\u7406\u64CD\u4F5C\u5931\u8D25" : result.route ? "\u8FDE\u63A5\u6B63\u5E38" : "\u4EE3\u7406\u914D\u7F6E\u5DF2\u751F\u6548";
      } catch (error) {
        failure = true;
        message = error instanceof Error ? error.message : String(error);
      } finally {
        busy2 = false;
        if (ui.tab === "settings") ui.renderContent();
      }
    }
    for (const [key, label, action] of [
      ["save", "\u5E94\u7528", () => api.set({ mode: mode.value, address: endpoint.value })],
      ["test", "\u6D4B\u8BD5\u8FDE\u63A5", () => api.test()],
      ["clear", "\u6062\u590D\u7CFB\u7EDF", () => api.clear()]
    ]) {
      const control = button("dp-mini dp-proxy-" + key, { "data-proxy-action": key }, () => run(action));
      control.textContent = label;
      control.disabled = busy2;
      actions.push(control);
      controls.appendChild(control);
    }
    setting.box.appendChild(controls);
    setting.box.appendChild(status);
  }

  // src/client/tabs/settings.js
  function section(ui, title, note) {
    const box = el("div", "dp-set");
    const head = el("div", "dp-set-head");
    head.appendChild(el("b", null, title));
    if (note) head.appendChild(el("small", "dp-dim", note));
    box.appendChild(head);
    ui.content.appendChild(box);
    return { box, head };
  }
  function segmented({ box }, attr, options, current, onPick) {
    const row = el("div", "dp-seg");
    for (const option of options) {
      const pick = button("dp-seg-btn", { [attr]: option.key, "aria-pressed": String(option.key === current) }, function() {
        onPick(option.key);
      });
      pick.textContent = option.label;
      pick.disabled = option.key === current;
      row.appendChild(pick);
    }
    box.appendChild(row);
  }
  function renderSettingsTab(ui) {
    const notice = ui.updateNotice;
    const fresh = notice?.unread === true && notice.latest !== null;
    const update = section(ui, "\u66F4\u65B0", fresh ? "\u6709\u65B0\u7248\u672C v" + notice.latest.version : "\u67E5\u770B\u7248\u672C\u3001\u66F4\u65B0\u6216\u6362\u56DE\u65E7\u7248\u672C");
    const go = button("dp-mini dp-update-entry", { "data-open-update": "true" }, function() {
      ui.select("update");
    });
    go.textContent = "\u{1F504} \u66F4\u65B0";
    if (fresh) go.appendChild(el("b", "dp-tile-badge dp-update-dot", "!"));
    update.head.appendChild(go);
    const extFresh = extensionUpdateAvailable(ui);
    const extensions = section(ui, "\u6269\u5C55", "\u672C\u5730\u73A9\u6CD5\u3001\u5F00\u5173\u4E0E\u5728\u7EBF\u6269\u5C55");
    const openExtensions = button("dp-mini dp-update-entry", { "data-open-extensions": "true" }, function() {
      ui.select("extensions");
    });
    openExtensions.textContent = "\u{1F9E9} \u6269\u5C55";
    if (extFresh) openExtensions.appendChild(el("b", "dp-tile-badge dp-update-dot", "!"));
    extensions.head.appendChild(openExtensions);
    const size = section(ui, "\u5C0F\u732A\u5927\u5C0F", "\u666E\u901A\u732A\u3001\u76AE\u80A4\u548C\u7761\u59FF\u4E00\u8D77\u8C03\u6574\uFF1B\u53EA\u6539\u8FD9\u53F0\u8BBE\u5907\uFF0C\u4E0D\u6539\u5B58\u6863");
    const sizeRow = el("div", "dp-size-control");
    const percent = (
      /** @type {HTMLInputElement} */
      el("input", "dp-size-value")
    );
    percent.type = "number";
    percent.value = String(Math.round(pigSize() * 100));
    percent.setAttribute("aria-label", "\u5C0F\u732A\u5927\u5C0F\u767E\u5206\u6BD4");
    percent.setAttribute("data-pig-scale", "true");
    function applySize(value) {
      if (!Number.isFinite(value) || value <= 0) {
        percent.value = String(Math.round(pigSize() * 100));
        return;
      }
      const stageSize = ui.view.hatched ? ui.view.pig.stage.size : ui.view.boxStage.size;
      const geometry2 = desktopShell()?.geometry?.();
      const area = geometry2?.workArea;
      const available = Math.min(area?.width || window.screen?.availWidth || window.innerWidth, area?.height || window.screen?.availHeight || window.innerHeight);
      const scale = Math.min(value / 100, available / (stageSize * 2));
      setPigSize(scale);
      percent.value = String(Math.round(scale * 100));
      ui.host.style.setProperty("--pig-size", displayedPigSize(stageSize) + "px");
      ui.fitPanel();
      desktopShell()?.syncGeometry?.();
    }
    for (const { key, label, delta } of [{ key: "minus", label: "\u2212", delta: -10 }, { key: "plus", label: "+", delta: 10 }]) {
      const control = button("dp-size-step", { "data-pig-size-step": key, "aria-label": delta < 0 ? "\u7F29\u5C0F\u5C0F\u732A" : "\u653E\u5927\u5C0F\u732A" }, () => applySize(Math.max(10, Math.round(pigSize() * 100) + delta)));
      control.textContent = label;
      if (delta < 0) sizeRow.appendChild(control);
      else {
        const value = el("label", "dp-size-percent");
        value.appendChild(percent);
        value.appendChild(el("span", null, "%"));
        sizeRow.appendChild(value);
        sizeRow.appendChild(control);
      }
    }
    percent.addEventListener("change", () => applySize(Number(percent.value)));
    percent.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        applySize(Number(percent.value));
        percent.blur();
      }
    });
    size.box.appendChild(sizeRow);
    if (hasBundledEmoji()) {
      const emoji = section(ui, "Emoji \u6837\u5F0F", "\u5185\u7F6E\u662F\u968F\u6E38\u620F\u9644\u5E26\u7684\u4E00\u6574\u5957 Noto \u5F69\u8272 emoji\uFF0C\u5404\u7CFB\u7EDF\u770B\u8D77\u6765\u4E00\u6837");
      segmented(emoji, "data-emoji-style", [
        { key: "bundled", label: "\u5185\u7F6E" },
        { key: "system", label: "\u7CFB\u7EDF\u81EA\u5E26" }
      ], emojiStyle(), function(key) {
        setEmojiStyle(key);
        applyEmojiStyle(ui.host);
        ui.renderContent();
      });
    }
    const quiet = section(ui, "\u514D\u6253\u6270", "\u5F00\u7740\u65F6\u732A\u4E0D\u4E3B\u52A8\u8BF4\u8BDD\u3001\u4E0D\u62A5\u65E5\u5E38\u6D88\u606F\uFF1B\u751F\u75C5\u548C\u610F\u5916\u7167\u5E38\u63D0\u9192");
    const quietOn = ui.view.dialogue.quiet === true;
    const quietToggle = button("dp-switch", { "data-quiet": quietOn ? "on" : "off", "aria-pressed": String(quietOn) }, function() {
      ui.send("quiet", { on: !quietOn });
    });
    quietToggle.appendChild(el("span", "dp-switch-knob"));
    quietToggle.appendChild(el("span", "dp-switch-text", quietOn ? "\u5F00" : "\u5173"));
    quiet.head.appendChild(quietToggle);
    const close = section(ui, "\u70B9\u51FB\u522B\u5904\u65F6\u6536\u8D77\u9762\u677F", "\u7F51\u9875\u7248\u70B9\u9762\u677F\u5916\u3001\u684C\u9762\u7248\u5207\u5230\u5176\u4ED6\u7A97\u53E3\u65F6\u6536\u8D77");
    const on = autoCollapseEnabled();
    const toggle = button("dp-switch", { "data-auto-collapse": String(!on), "aria-pressed": String(on) }, function() {
      setAutoCollapse(!autoCollapseEnabled());
      ui.renderContent();
    });
    toggle.appendChild(el("span", "dp-switch-knob"));
    toggle.appendChild(el("span", "dp-switch-text", on ? "\u5F00" : "\u5173"));
    close.head.appendChild(toggle);
    if (desktopShell() !== null) {
      const walk = section(ui, "\u684C\u9762\u6563\u6B65", "\u6BCF 10\u201320 \u5206\u949F\u6CBF\u5C4F\u5E55\u5E95\u8FB9\u8D70\u4E00\u6BB5\u518D\u8D70\u56DE\u6765\uFF1B\u62D6\u5B83\u3001\u5F00\u7740\u9762\u677F\u3001\u514D\u6253\u6270\u65F6\u4E0D\u8D70");
      const walking = walkEnabled();
      const walkToggle = button("dp-switch", { "data-walk": String(!walking), "aria-pressed": String(walking) }, function() {
        setWalk(!walkEnabled());
        ui.renderContent();
      });
      walkToggle.appendChild(el("span", "dp-switch-knob"));
      walkToggle.appendChild(el("span", "dp-switch-text", walking ? "\u5F00" : "\u5173"));
      walk.head.appendChild(walkToggle);
    }
    const proxy = desktopShell()?.proxy;
    if (proxy) renderProxySettings(ui, section, proxy);
    const logs = section(ui, "\u65E5\u5FD7", "\u9047\u5230\u95EE\u9898\u5BFC\u51FA\u8FD9\u4E00\u4EFD\uFF0C\u91CC\u9762\u6709\u7248\u672C\u3001\u52A8\u4F5C\u548C\u62A5\u9519");
    const exportButton = button("dp-mini", { "data-export-logs": "true" }, function() {
      runExport(ui, exportButton);
    });
    exportButton.textContent = "\u{1F4C4} \u5BFC\u51FA";
    logs.head.appendChild(exportButton);
    if (exporting) exportButton.disabled = true;
  }
  var exporting = false;
  function runExport(ui, exportButton) {
    if (exporting) return;
    exporting = true;
    exportButton.disabled = true;
    exportButton.textContent = "\u5BFC\u51FA\u4E2D\u2026";
    exportLogs().then(function(result) {
      exporting = false;
      if (result.canceled === true) ui.renderContent();
      else if (result.ok === true) ui.showBubble(result.downloaded === true ? "\u65E5\u5FD7\u5DF2\u4E0B\u8F7D" : "\u65E5\u5FD7\u5DF2\u4FDD\u5B58", 3200);
      else ui.showBubble("\u65E5\u5FD7\u6CA1\u5BFC\u51FA\uFF1A" + str(result.reason, "\u672A\u77E5\u539F\u56E0"), 4e3);
      if (typeof ui.renderContent === "function") ui.renderContent();
    }).catch(function(error) {
      exporting = false;
      ui.showBubble("\u65E5\u5FD7\u6CA1\u5BFC\u51FA\uFF1A" + (error instanceof Error ? error.message : String(error)), 4e3);
      ui.renderContent();
    });
  }

  // src/client/format.js
  function formatMinutes(minutes) {
    if (minutes < 60) return minutes + " \u5206\u949F";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? hours + " \u5C0F\u65F6" : hours + " \u5C0F\u65F6" + rest + " \u5206";
  }

  // src/client/tabs/travel.js
  function renderTravelTab(ui) {
    renderSwitchAsk(ui);
    if (ui.view.trips.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u5BBF\u4E3B\u8FD8\u6CA1\u63D0\u4F9B\u76EE\u7684\u5730\u3002"));
      return;
    }
    var list = el("div", "dp-list");
    for (var i = 0; i < ui.view.trips.length; i += 1) {
      (function(trip) {
        var row = el("div", "dp-item");
        row.appendChild(el("span", null, trip.emoji));
        var grow = el("div", "dp-grow");
        grow.appendChild(el("div", null, trip.label));
        grow.appendChild(el("div", "dp-dim", formatMinutes(trip.minutes) + " \xB7 " + trip.cost + " \u{1FA99}" + (trip.bestRarity ? " \xB7 \u53EF\u5E26\u56DE " + trip.bestRarityEmoji + trip.bestRarity : "")));
        if (trip.locked) grow.appendChild(el("div", "dp-dim", "\u{1F512} " + trip.locked + "\u624D\u80FD\u53BB"));
        row.appendChild(grow);
        var go = button("dp-mini", { "data-trip": trip.key }, function() {
          startOrSwitch(ui, "\u65C5\u884C\uFF08" + trip.label + "\uFF09", "trip", { trip: trip.key });
        });
        go.textContent = "\u51FA\u53D1";
        go.disabled = !canStart(ui) || !trip.affordable || trip.locked !== "";
        row.appendChild(go);
        list.appendChild(row);
      })(ui.view.trips[i]);
    }
    ui.content.appendChild(list);
  }

  // src/client/tabs/work.js
  var SKILLS = [
    { key: "strong", emoji: "\u{1F4AA}", label: "\u6B66\u529B", color: "orange" },
    { key: "charm", emoji: "\u2728", label: "\u9B45\u529B", color: "pink" },
    { key: "intel", emoji: "\u{1F9E0}", label: "\u667A\u529B", color: "blue" }
  ];
  function renderWorkTab(ui) {
    renderSwitchAsk(ui);
    if (ui.view.jobs.length === 0) {
      ui.content.appendChild(el("div", "dp-empty", "\u5BBF\u4E3B\u8FD8\u6CA1\u63D0\u4F9B\u5DE5\u4F5C\u5217\u8868\u3002"));
      return;
    }
    var bySkill = ui.view.jobs.some(function(job2) {
      return job2.trait !== "";
    });
    if (!bySkill) {
      renderJobs(ui, ui.view.jobs, "orange");
      return;
    }
    var skill = SKILLS.find(function(entry) {
      return entry.key === ui.drill.work;
    });
    if (skill === void 0) {
      renderSkills(ui);
      return;
    }
    var chosen = skill;
    drillHeader(ui, "work", chosen.emoji + " " + chosen.label, "");
    renderJobs(ui, ui.view.jobs.filter(function(job2) {
      return job2.trait === chosen.key;
    }), chosen.color);
  }
  function renderSkills(ui) {
    var grid = tileGrid();
    for (var s = 0; s < SKILLS.length; s += 1) {
      (function(skill) {
        var open = ui.view.jobs.filter(function(job2) {
          return job2.trait === skill.key && job2.qualified;
        }).length;
        grid.appendChild(tile({
          emoji: skill.emoji,
          label: skill.label,
          color: skill.color,
          badge: open > 0 ? String(open) : "",
          data: { "data-skill": skill.key },
          onPick: function() {
            drillTo(ui, "work", skill.key);
          }
        }));
      })(SKILLS[s]);
    }
    ui.content.appendChild(grid);
  }
  function renderJobs(ui, jobs, color) {
    var grid = tileGrid();
    var picked = null;
    for (var i = 0; i < jobs.length; i += 1) {
      (function(job2) {
        var active = ui.drill.pick === job2.key;
        if (active) picked = job2;
        var locked = job2.qualified === false;
        grid.appendChild(tile({
          emoji: job2.emoji,
          label: job2.label,
          color,
          soft: true,
          active,
          note: job2.minutes + "\u5206\xB7" + job2.coins + "\u{1FA99}",
          tag: locked ? "\u{1F512}" : "",
          dim: locked,
          data: { "data-job-tile": job2.key },
          onPick: function() {
            ui.drill.pick = active ? null : job2.key;
            ui.renderContent();
          }
        }));
      })(jobs[i]);
    }
    ui.content.appendChild(grid);
    if (picked !== null) {
      ui.footer.appendChild(jobDetails(ui, picked));
      ui.footer.hidden = false;
    }
  }
  function jobDetails(ui, job2) {
    var box = el("div", "dp-pick dp-tile-card dp-job-detail");
    box.appendChild(el("div", "dp-pick-head", job2.emoji + " " + job2.label + " \xB7 " + (job2.qualified ? "\u6761\u4EF6\u90FD\u591F\u4E86" : "\u8FD8\u5DEE\u8FD9\u4E9B")));
    for (var r = 0; r < job2.requirements.length; r += 1) {
      var need = job2.requirements[r];
      var have = need.kind === "level" ? "\uFF08\u73B0\u5728 Lv." + need.have + "\uFF09" : need.kind === "certificate" ? "\uFF08" + need.have + "/" + need.need + " \u6B21\uFF09" : need.kind === "every" || need.kind === "anyOf" ? "\uFF08" + need.have + "/" + need.need + " \u95E8\uFF09" : "\uFF08\u73B0\u5728 " + need.have + " \u8282\uFF09";
      box.appendChild(el("div", need.met ? "dp-req dp-req-ok" : "dp-req", (need.met ? "\u2713 " : "\u2717 ") + need.text + (need.met ? "" : " " + have)));
    }
    if (job2.requirements.length === 0 && job2.lockText) box.appendChild(el("div", "dp-req", "\u2717 " + job2.lockText));
    box.appendChild(el("div", "dp-dim", job2.minutes + " \u5206\u949F \xB7 " + job2.coins + " \u{1FA99} \xB7 " + job2.traitEmoji + job2.traitLabel + " " + job2.traitPoints + (job2.payPercent > 0 ? "\uFF08+" + job2.payPercent + "%\uFF09" : "") + " \xB7 \u9971\u98DF " + job2.satiety + " \xB7 \u6E05\u6D01 " + job2.cleanliness));
    var go = button("dp-btn dp-btn-wide dp-job-go", { "data-job": job2.key }, function() {
      startOrSwitch(ui, "\u6253\u5DE5\uFF08" + job2.label + "\uFF09", "work", { job: job2.key });
    });
    go.textContent = "\u{1F4BC} \u51FA\u53D1";
    go.disabled = !canStart(ui) || job2.qualified === false;
    box.appendChild(go);
    if (job2.shortMinutes > 0 && job2.shortMinutes < job2.minutes) {
      var quick = button("dp-btn dp-btn-wide dp-job-short", { "data-job-short": job2.key }, function() {
        startOrSwitch(ui, "\u77ED\u73ED\uFF08" + job2.label + "\uFF09", "work", { job: job2.key, short: true });
      });
      quick.textContent = "\u23F1 \u77ED\u73ED " + job2.shortMinutes + " \u5206\u949F \xB7 " + job2.shortCoins + " \u{1FA99}";
      quick.disabled = go.disabled;
      box.appendChild(quick);
    }
    return box;
  }

  // src/client/panel.js
  function createPanel(ctx) {
    var AWAY_LINE = {
      work: "\u5728\u5FD9",
      study: "\u5728\u5FF5\u4E66",
      interest: "\u5728\u5B66\u5174\u8DA3\u8BFE",
      trip: "\u5728\u8DEF\u4E0A"
    };
    function setOpen(next) {
      if (splitSetOpen(ctx, next)) return;
      if (!next) {
        closeFishing(ctx);
        if (ctx.isOpen) animatePanelClose(ctx);
      }
      ctx.isOpen = next;
      ctx.host.setAttribute("data-open", next ? "true" : "false");
      ctx.card.hidden = !next;
      ctx.hud.hidden = !next;
      if (!next) ctx.bubble.hidden = true;
      writeStore(OPEN_KEY, next ? "true" : "false");
      if (next) {
        renderContent();
        ctx.fitPanel();
        animatePanelOpen(ctx);
      } else {
        ctx.card.style.right = "";
        ctx.card.style.top = "auto";
        ctx.card.style.bottom = "";
        ctx.card.style.maxHeight = "";
        ctx.card.style.maxWidth = "";
      }
      desktopShell()?.syncGeometry?.();
    }
    function select(next) {
      var previous = ctx.tab;
      if (next === "crown") next = "dex";
      if (next === "quit") {
        var desk = updatesBridge();
        if (desk !== null && desk.quit) desk.quit();
        return;
      }
      if (next === "update") ctx.updateNotice?.markRead();
      ctx.tab = next;
      ctx.picker = null;
      if (next in ctx.drill) {
        ctx.drill[next] = null;
        ctx.drill.pick = null;
        ctx.drill.from = null;
      }
      renderContent();
      if (previous !== next) {
        ctx.content.scrollTop = 0;
        if (ctx.isOpen) animateAppEntry(ctx.content);
      }
      for (var k in ctx.icons) ctx.icons[k].setAttribute("data-active", k === ctx.tab ? "true" : "false");
    }
    var pomodoroNotifiedAt = null;
    function noticePomodoro(pomodoro) {
      if (pomodoro === null || pomodoro.finishedAt === null || pomodoro.finishedAt === pomodoroNotifiedAt) return;
      pomodoroNotifiedAt = pomodoro.finishedAt;
      var paid = pomodoro.todayDone <= pomodoro.cap;
      var text = "\u4ECA\u5929\u7B2C " + pomodoro.todayDone + " \u4E2A" + (paid ? " \xB7 +" + pomodoro.reward.coins + " \u{1FA99}" : " \xB7 \u4ECA\u5929\u5956\u52B1\u5DF2\u62FF\u6EE1");
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("\u{1F345} \u4E13\u6CE8\u7ED3\u675F", { body: text });
          return;
        }
      } catch (error) {
      }
      ctx.showBubble("\u{1F345} \u4E13\u6CE8\u7ED3\u675F \xB7 " + text, 3200);
    }
    function renderContent() {
      var scrollTop = ctx.content.scrollTop;
      paintContent();
      ctx.content.scrollTop = scrollTop;
      ctx.justBought = null;
    }
    function paintContent() {
      ctx.content.textContent = "";
      ctx.footer.textContent = "";
      ctx.footer.hidden = true;
      for (var k = 0; k < TABS.length; k += 1) {
        ctx.icons[TABS[k].key].setAttribute("data-active", TABS[k].key === ctx.tab ? "true" : "false");
      }
      if (ctx.host.getAttribute("data-open") !== "true") return;
      if (ctx.view.legacy) {
        var legacy = el("div", "dp-alert dp-legacy");
        legacy.appendChild(el("b", null, "\u26A0\uFE0F \u5BBF\u4E3B\u662F\u65E7\u7248\u672C"));
        legacy.appendChild(el("div", null, "\u91D1\u5E01\u3001\u5065\u5EB7\u3001\u6253\u5DE5\u3001\u5546\u5E97\u8FD9\u4E9B\u662F\u65B0\u589E\u7684\uFF0C\u91CD\u542F dsh\uFF08\u4E0D\u662F\u5237\u65B0\u9875\u9762\uFF09\u4E4B\u540E\u624D\u4F1A\u51FA\u73B0\u3002"));
        ctx.content.appendChild(legacy);
      }
      if (ctx.view.pig === null) {
        ctx.content.appendChild(el("div", "dp-empty", "\u95E8\u53E3\u653E\u7740\u4E00\u4E2A\u7EB8\u76D2\uFF0C\u91CC\u9762\u7AB8\u7AB8\u7AA3\u7AA3 \u{1F4E6}"));
        var grid = el("div", "dp-actions");
        var hatch = button("dp-btn dp-btn-wide", { "data-action": "hatch" }, function() {
          ctx.send("hatch");
        });
        hatch.appendChild(el("span", null, "\u{1F95A}"));
        hatch.appendChild(el("span", null, "\u62C6\u5F00\u7EB8\u76D2"));
        grid.appendChild(hatch);
        ctx.content.appendChild(grid);
        return;
      }
      var shell2 = updatesBridge();
      var apps = orderHomeApps(enabledTabs(ctx, TABS).concat([UPDATE_TAB], shell2 !== null && shell2.quit ? [QUIT_TAB] : [], ctx.devMode ? [DEV_TAB] : []));
      if (ctx.tab === "home") {
        renderHome(ctx, apps.filter(function(a) {
          return a.key !== "update" && a.key !== "extensions";
        }));
        ctx.fitPanel();
        return;
      }
      var drilled = ctx.tab in ctx.drill && ctx.drill[ctx.tab] !== null;
      var app = apps.find(function(entry) {
        return entry.key === ctx.tab;
      });
      if (app !== void 0 && !drilled) appHeader(ctx, app, ctx.tab === "shop" ? "\u{1FA99} " + ctx.view.pig.coins : "");
      if (ctx.tab === "status") renderStatusTab(ctx);
      else if (ctx.tab === "card") renderCardTab(ctx);
      else if (ctx.tab === "dex") renderDexTab(ctx);
      else if (ctx.tab === "skins") renderSkinsTab(ctx);
      else if (ctx.tab === "study") renderStudyTab(ctx);
      else if (ctx.tab === "work") renderWorkTab(ctx);
      else if (ctx.tab === "shop") renderShopTab(ctx);
      else if (ctx.tab === "travel") renderTravelTab(ctx);
      else if (ctx.tab === "fishing") renderFishingTab(ctx);
      else if (ctx.tab === "pomodoro") {
        renderPomodoroTab(ctx);
        if (typeof ctx.pomoTick === "function") ctx.pomoTick();
      } else if (ctx.tab === "dev") renderDevTab(ctx);
      else if (ctx.tab === "update") renderUpdateTab(ctx);
      else if (ctx.tab === "settings") renderSettingsTab(ctx);
      else if (ctx.tab === "extensions" || String(ctx.tab).startsWith("ext:")) renderExtensionsTab(ctx);
      else renderBagTab(ctx);
      ctx.fitPanel();
    }
    function render(next) {
      var previousFishing = ctx.view?.fishing?.pending;
      ctx.view = applyExtensions(normalize(next));
      var stageEntry = null;
      var firstOpen = null;
      for (var s = 0; s < ctx.view.stages.length; s += 1) {
        var entry = ctx.view.stages[s];
        if (entry.unlocked !== false && firstOpen === null) firstOpen = entry.key;
        if (entry.key === ctx.stage) stageEntry = entry;
      }
      if (!ctx.stagePicked && firstOpen !== null && (stageEntry === null || stageEntry.unlocked === false)) ctx.stage = firstOpen;
      ctx.host.setAttribute("data-dead", ctx.view.dead ? "true" : "false");
      ctx.host.setAttribute("data-open", ctx.isOpen && desktopRole() !== "pet" ? "true" : "false");
      ctx.host.setAttribute("data-dev", ctx.devMode ? "true" : "false");
      ctx.host.setAttribute("data-away", ctx.view.activity === null ? "false" : ctx.view.activity.kind);
      if (ctx.view.activity === null) {
        ctx.work.hidden = true;
      } else {
        ctx.work.hidden = false;
        ctx.prop.textContent = ctx.view.activity.emoji;
        ctx.progressFill.style.width = ctx.view.activity.progress + "%";
        ctx.work.setAttribute("data-kind", ctx.view.activity.kind);
        ctx.work.title = (AWAY_LINE[ctx.view.activity.kind] ?? "\u5728\u5916\u9762") + "\uFF1A" + ctx.view.activity.label;
      }
      if (ctx.view.hatched !== true) {
        ctx.pig.setAttribute("data-stage", "box");
        ctx.pig.setAttribute("data-art", "");
        ctx.pig.setAttribute("data-activity", "");
        ctx.pig.setAttribute("data-activity-key", "");
        ctx.pigEmoji.textContent = ctx.view.boxStage.emoji;
        ctx.pig.setAttribute("data-mood", "box");
        syncPigArt(ctx.pig, ctx.pigArt, ctx.pigEmoji);
        ctx.host.style.setProperty("--pig-size", displayedPigSize(ctx.view.boxStage.size) + "px");
        applyEmojiStyle(ctx.host);
        ctx.soul.hidden = true;
        ctx.host.setAttribute("data-soul", "false");
        ctx.host.setAttribute("data-faded", "false");
        ctx.host.setAttribute("data-unhatched", "true");
        ctx.pokeHint.hidden = false;
        ctx.hudName.textContent = "\u4E00\u4E2A" + ctx.view.boxStage.label;
        ctx.hudCoins.textContent = "\u70B9\u5F00\u62C6\u5F00\u5B83";
        ctx.hudHealth.textContent = "";
        ctx.lastStage = null;
      } else {
        const pigStage = ctx.view.pig.stage;
        syncSleepArt(pigStage.art, pigStage.artScenes, ctx.pigSleep);
        ctx.pig.setAttribute("data-stage", pigStage.key);
        ctx.pig.setAttribute("data-art", pigStage.art || "");
        ctx.pig.setAttribute("data-art-actions", pigStage.actionArt ? "true" : "false");
        ctx.pig.setAttribute("data-art-scenes", pigStage.artScenes.join(","));
        ctx.host.setAttribute("data-art-actions", pigStage.actionArt ? "true" : "false");
        ctx.pig.setAttribute("data-activity", ctx.view.activity === null ? "" : ctx.view.activity.kind);
        ctx.pig.setAttribute("data-activity-key", ctx.view.activity === null ? "" : ctx.view.activity.key);
        ctx.pig.setAttribute("data-mood", ctx.view.pig.mood);
        var ill = ctx.view.pig.illness;
        ctx.pig.setAttribute("data-illness", ill === null || ill.chainKey === "" ? "" : ill.chainKey + ":" + ill.stage);
        ctx.pigEmoji.textContent = pigStage.emoji;
        syncPigArt(ctx.pig, ctx.pigArt, ctx.pigEmoji);
        ctx.host.style.setProperty("--pig-size", displayedPigSize(pigStage.size) + "px");
        applyEmojiStyle(ctx.host);
        ctx.host.setAttribute("data-soul", ctx.view.pig.soul ? "true" : "false");
        ctx.host.setAttribute("data-faded", pigStage.faded ? "true" : "false");
        ctx.host.setAttribute("data-unhatched", "false");
        ctx.pokeHint.hidden = true;
        ctx.soul.hidden = ctx.view.pig.soul !== true || pigStage.key === "grave";
        ctx.dressSlots.textContent = "";
        for (var wd = 0; wd < ctx.view.dress.length; wd += 1) {
          var piece = ctx.view.dress[wd];
          if (!piece.worn || piece.slot === "") continue;
          if (pigStage.hides.indexOf(piece.slot) >= 0) continue;
          var node = el("span", "dp-slot", piece.emoji);
          node.setAttribute("data-slot", piece.slot);
          ctx.dressSlots.appendChild(node);
        }
        ctx.hudName.textContent = ctx.view.pig.name + (ctx.view.pig.sex !== null ? " " + ctx.view.pig.sex.symbol : "") + " Lv." + ctx.view.pig.level.level + " \xB7 " + pigStage.label + (ctx.view.pig.ageLabel ? " \xB7 " + ctx.view.pig.ageLabel : "") + (ctx.view.pig.ageForced ? " \u{1F527}" : "");
        ctx.hudCoins.textContent = "\u{1FA99} " + ctx.view.pig.coins;
        ctx.hudHealth.textContent = "\u{1F49A} " + ctx.view.pig.health + "/" + ctx.view.maxHealth;
        if (ctx.lastStage !== null && pigStage.key !== ctx.lastStage) {
          ctx.react("levelup", 950);
          ctx.burst(["\u2728", "\u{1F389}", "\u2B50"], 4);
          ctx.showBubble("\u6211\u957F\u5927\u5566\uFF01" + pigStage.emoji, 2600);
        }
        ctx.lastStage = pigStage.key;
      }
      var pomo = ctx.view.pomodoro;
      var pomoOn = pomo !== null && pomo.active;
      ctx.pomoHint.setAttribute("data-pomo", pomoOn ? "on" : "");
      ctx.pomoHint.hidden = !pomoOn || ctx.bubble.hidden === false;
      if (pomoOn) ctx.pomoHint.textContent = "\u{1F345} " + clockText(pomo.secondsLeft);
      if (desktopRole() !== "panel") noticePomodoro(pomo);
      if (typeof ctx.pomoTick === "function") ctx.pomoTick();
      var daily = ctx.view.daily;
      var cake = ctx.view.pig !== null && (ctx.view.pig.birthdayToday || ctx.cakeForced === true) && !cakeTakenToday();
      var dailyAction = daily.canSignIn ? "signIn" : daily.unclaimed > 0 ? "openGift" : cake ? "cake" : null;
      ctx.dailyHint.hidden = dailyAction === null || ctx.view.pig === null;
      if (dailyAction !== null) {
        ctx.dailyHint.textContent = dailyAction === "signIn" ? "\u{1F4C5}" : dailyAction === "cake" ? "\u{1F382}" : "\u{1F381}";
        ctx.dailyHint.title = dailyAction === "signIn" ? "\u7B7E\u5230\u7B2C " + daily.signInDay + "/" + daily.cycle + " \u5929" : dailyAction === "cake" ? "\u4ECA\u5929\u662F" + ctx.view.pig.name + "\u7684\u751F\u65E5" : "\u6709 " + daily.unclaimed + " \u4E2A\u5728\u7EBF\u793C\u5305";
        ctx.dailyHint.setAttribute("data-action", dailyAction);
      }
      var studyStage = null;
      for (var st = 0; st < ctx.view.stages.length; st += 1) {
        if (ctx.view.stages[st].key === ctx.stage) studyStage = ctx.view.stages[st];
      }
      var studyOpen = ctx.view.canGoOut && (studyStage === null || studyStage.unlocked !== false);
      var hasCourse = studyOpen && ctx.view.subjects.some(function(subject2) {
        var onStage = studyStage === null || studyStage.subjects.length === 0 || studyStage.subjects.indexOf(subject2.key) >= 0;
        return onStage && subject2.affordable;
      });
      ctx.icons.study.setAttribute("data-alert", hasCourse ? "true" : "false");
      ctx.icons.shop.setAttribute("data-alert", ctx.view.pig !== null && ctx.view.pig.illness !== null ? "true" : "false");
      ctx.icons.dex.setAttribute("data-alert", "false");
      ctx.icons.travel.setAttribute("data-alert", ctx.view.pig !== null && ctx.view.pig.coins >= 400 ? "true" : "false");
      processPending(ctx, showPigLine);
      if ((ctx.ownerEdit !== null || ctx.pigNameEdit !== null) && ctx.tab === "status") return;
      if (ctx.cardEdit !== null && ctx.tab === "card") return;
      if (ctx.tab === "settings" && (document.activeElement?.getAttribute?.("data-proxy-address") === "true" || document.activeElement?.getAttribute?.("data-pig-scale") === "true")) return;
      if (ctx.tab === "dex" && document.activeElement?.getAttribute?.("data-dex-search") === "items") return;
      var currentFishing = ctx.view.fishing.pending;
      if (ctx.tab === "fishing" && previousFishing && currentFishing && previousFishing.id === currentFishing.id && previousFishing.phase === currentFishing.phase && (currentFishing.phase === "waiting" || currentFishing.phase === "hooked")) return;
      renderContent();
    }
    function showPigLine(event) {
      var lineId = event.id;
      ctx.showLine(event.text, event.replies, function(index) {
        ctx.send("reply", { line: lineId, index });
      });
    }
    return { setOpen, select, renderContent, render };
  }

  // src/client/scene.js
  var WEB_EMOJI_FACE = '@font-face{font-family:"Piggy Emoji";font-style:normal;font-weight:400;font-display:swap;src:url(/dsh-piggy/emoji.woff2) format("woff2")}';
  function createScene() {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700&display=swap";
    document.head.appendChild(font);
    var style = document.createElement("style");
    style.textContent = (desktopShell() === null ? WEB_EMOJI_FACE : "") + CSS;
    document.head.appendChild(style);
    var host3 = document.createElement("div");
    host3.setAttribute(MOUNTED, "");
    var card2 = el("div", "dp-card");
    var scene3 = el("div", "dp-scene");
    var hud = el("div", "dp-hud");
    var hudName = el("div", null, "\u732A\u732A");
    var hudCoins = el("div", null, "\u{1FA99} 0");
    var hudHealth = el("div", null, "\u{1F49A} 5/5");
    hud.appendChild(hudName);
    hud.appendChild(hudCoins);
    hud.appendChild(hudHealth);
    scene3.appendChild(hud);
    var bubble = el("div", "dp-bubble", "");
    bubble.hidden = true;
    scene3.appendChild(bubble);
    var work = el("div", "dp-work");
    var prop = el("span", "dp-prop", "\u{1F4BC}");
    var progressWrap = el("div", "dp-progress");
    var progressFill = document.createElement("i");
    progressWrap.appendChild(progressFill);
    work.appendChild(prop);
    work.appendChild(progressWrap);
    work.hidden = true;
    scene3.appendChild(work);
    var pokeHint = el("div", "dp-poke-hint");
    pokeHint.appendChild(el("span", null, "\u{1F446}"));
    pokeHint.appendChild(el("span", null, "\u6233\u4E09\u4E0B"));
    pokeHint.hidden = true;
    scene3.appendChild(pokeHint);
    var dailyHint = el("button", "dp-daily");
    dailyHint.hidden = true;
    scene3.appendChild(dailyHint);
    var soul = el("span", "dp-soul", "\u{1F47B}");
    soul.hidden = true;
    scene3.appendChild(soul);
    var pigArt = document.createElement("img");
    pigArt.className = "dp-pig-img";
    pigArt.alt = "";
    pigArt.hidden = true;
    var pigSleep = document.createElement("img");
    pigSleep.className = "dp-pig-sleep";
    pigSleep.alt = "";
    pigSleep.draggable = false;
    var pigEmoji = el("span", "dp-pig-emoji", "\u{1F416}");
    var pig = el("div", "dp-pig");
    pig.appendChild(pigArt);
    pig.appendChild(pigEmoji);
    pig.appendChild(pigSleep);
    var napBubble = el("span", "dp-nap-zzz", "Zzz");
    napBubble.setAttribute("aria-hidden", "true");
    pig.appendChild(napBubble);
    var dressSlots = el("div", "dp-dress");
    pig.appendChild(dressSlots);
    var pomoHint = el("div", "dp-pomo");
    pomoHint.setAttribute("data-pomo-pill", "true");
    pomoHint.hidden = true;
    pig.appendChild(pomoHint);
    scene3.appendChild(pig);
    scene3.title = "\u5DE6\u952E\u6478\u6478 \xB7 \u53F3\u952E\u6253\u5F00\u9762\u677F \xB7 \u62D6\u52A8\u53EF\u79FB\u52A8";
    var bar = el("div", "dp-bar");
    var content = el("div", "dp-content");
    var footer = el("div", "dp-panel-footer");
    footer.hidden = true;
    card2.appendChild(content);
    card2.appendChild(footer);
    card2.appendChild(bar);
    host3.appendChild(card2);
    host3.appendChild(scene3);
    if (document.body !== null && document.body !== void 0) {
      document.body.appendChild(host3);
    } else {
      document.addEventListener("DOMContentLoaded", function() {
        try {
          document.body.appendChild(host3);
        } catch (error) {
        }
      }, { once: true });
    }
    return { font, style, host: host3, card: card2, scene: scene3, hud, hudName, hudCoins, hudHealth, bubble, work, prop, progressWrap, progressFill, pokeHint, dailyHint, pomoHint, soul, pigArt, pigSleep, pigEmoji, pig, dressSlots, bar, content, footer };
  }

  // src/client/drag-heartbeat.js
  function startDragHeartbeat(shell2, isDragging) {
    if (typeof shell2?.dragHeartbeat !== "function") return () => {
    };
    const timer2 = window.setInterval(() => {
      if (isDragging()) shell2.dragHeartbeat();
    }, 250);
    return () => window.clearInterval(timer2);
  }

  // src/client/position.js
  function readPosition(raw) {
    if (raw === null || raw === void 0) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.right === "number" && typeof parsed.bottom === "number") {
        return { right: parsed.right, bottom: parsed.bottom };
      }
    } catch (error) {
    }
    return null;
  }

  // src/client/dev-mode.js
  function createDevMode(applyOn, say) {
    var on = false;
    var taps = 0;
    var startedAt = 0;
    function set(next) {
      var value = next === true;
      if (value === on) return;
      on = value;
      taps = 0;
      applyOn(on);
    }
    function tap() {
      var at = Date.now();
      if (taps === 0 || at - startedAt > DEV_TAP_WINDOW_MS) {
        taps = 0;
        startedAt = at;
      }
      taps += 1;
      if (taps >= DEV_TAPS_TO_UNLOCK) {
        set(true);
        return;
      }
      if (taps >= DEV_TAP_HINT_FROM) say("\u518D\u70B9 " + (DEV_TAPS_TO_UNLOCK - taps) + " \u6B21", DEV_TAP_HINT_MS);
    }
    function install3() {
      writeStore(DEV_KEY, "0");
      try {
        window.dshPigDev = { off: function() {
          set(false);
        } };
      } catch (error) {
      }
    }
    function dispose() {
      try {
        delete /** @type {any} */
        window.dshPigDev;
      } catch (error) {
      }
    }
    return { isOn: function() {
      return on;
    }, set, tap, install: install3, dispose };
  }
  function attachDevMode(ui) {
    const dev = createDevMode(function(next) {
      ui.setEnabled(next);
      ui.host.setAttribute("data-dev", next ? "true" : "false");
      ui.paintBar();
      if (next) {
        ui.setOpen(true);
        ui.select("dev");
        ui.showBubble("\u{1F527} \u5F00\u53D1\u8005\u6A21\u5F0F\u5DF2\u5F00", 2e3);
      } else {
        if (ui.getTab() === "dev") ui.select("home");
        ui.showBubble("\u5F00\u53D1\u8005\u6A21\u5F0F\u5DF2\u5173", 1600);
      }
    }, ui.showBubble);
    dev.install();
    return dev;
  }

  // src/client/desktop/geometry.js
  var PAD = 16;
  var STEP = 4;
  var MIN_WINDOW = Object.freeze({ width: 96, height: 96 });
  var round = (value) => Math.round(Number(value) || 0);
  function contentBoundsForPig(content, targetPigScreen) {
    return {
      x: round(targetPigScreen.x) - round(content.pigWindow.x),
      y: round(targetPigScreen.y) - round(content.pigWindow.y),
      width: Math.max(MIN_WINDOW.width, round(content.width)),
      height: Math.max(MIN_WINDOW.height, round(content.height))
    };
  }
  function nearestArea(point, areas) {
    let best = null;
    let bestDistance = Infinity;
    for (const area of areas) {
      const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width));
      const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height));
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        best = area;
        bestDistance = distance;
      }
    }
    return best;
  }
  function sameBounds(a, b, tolerance) {
    return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
  }

  // src/client/desktop/measure.js
  function framedBox(node, box) {
    if (!node.matches?.(".dp-pig-img,.dp-pig-sleep")) return box;
    const path = (node.getAttribute("src") || "").split("/art/")[1];
    const bounds = ART_BOUNDS[path];
    if (!bounds) return box;
    const zoom = Number(node.style.getPropertyValue("--art-zoom")) || 1;
    const shiftX = parseFloat(node.style.getPropertyValue("--art-x")) || 0;
    const shiftY = parseFloat(node.style.getPropertyValue("--art-y")) || 0;
    const mirrored = node.closest(".dp-pig")?.getAttribute("data-walk") === "right";
    const fit = Math.min(box.width, box.height);
    const left = mirrored ? 1 - bounds[2] : bounds[0];
    const right = mirrored ? 1 - bounds[0] : bounds[2];
    return {
      x: box.x + box.width / 2 + (left - 0.5) * fit * zoom + (mirrored ? -shiftX : shiftX) * box.width / 100,
      y: box.y + box.height / 2 + (bounds[1] - 0.5) * fit * zoom + shiftY * box.height / 100,
      width: (right - left) * fit * zoom,
      height: (bounds[3] - bounds[1]) * fit * zoom
    };
  }
  var BUBBLE_ZONE = { width: 272, height: 104 };
  var SHAPE_SLACK = 6;
  var SIDE = Object.freeze({ vertical: "bottom", horizontal: "right" });
  function layoutBox(node) {
    let x = 0;
    let y = 0;
    let walk = node;
    while (walk !== null && walk !== void 0 && walk !== document.body) {
      x += walk.offsetLeft || 0;
      y += walk.offsetTop || 0;
      walk = walk.offsetParent;
    }
    return { x, y, width: node.offsetWidth || 0, height: node.offsetHeight || 0 };
  }
  function visible(node) {
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01;
  }
  function createMeasure(env) {
    const state2 = { pinned: "", bubbleHeight: null, shift: { x: 0, y: 0 } };
    const reserves = env.platform !== "darwin";
    function boxes(host3) {
      const nodes = [host3];
      const all = host3.querySelectorAll("*");
      for (let a = 0; a < all.length; a += 1) {
        const candidate = all[a];
        const inCard = candidate.closest(".dp-card");
        if (inCard !== null && inCard !== candidate || candidate.closest(".dp-fx") !== null) continue;
        nodes.push(candidate);
      }
      const geometry2 = env.geometry();
      let rects = [];
      const bubbleRects = [];
      for (const node of nodes) {
        if (node.closest("[hidden]") !== null || !visible(node)) continue;
        const bubble = node.closest(".dp-bubble");
        const box = framedBox(node, layoutBox(node));
        if (box.width < 1 || box.height < 1) continue;
        const rect = { x: box.x, y: box.y, r: box.x + box.width, b: box.y + box.height };
        if (bubble !== null) bubbleRects.push(rect);
        else rects.push(rect);
      }
      if (rects.length === 0) return null;
      const hostBox = layoutBox(host3);
      const pigNode = host3.querySelector(".dp-pig");
      const pigBox = pigNode === null ? { x: 0, y: 0, width: 0, height: 0 } : layoutBox(pigNode);
      let bubbleZone = null;
      if (reserves && pigNode !== null) {
        const above = geometry2 === null ? BUBBLE_ZONE.height : geometry2.window.y + pigBox.y - geometry2.workArea.y - PAD;
        const want = Math.max(0, Math.min(BUBBLE_ZONE.height, Math.round(above)));
        if (state2.bubbleHeight === null || Math.abs(want - state2.bubbleHeight) >= STEP * 2) state2.bubbleHeight = want;
        const height = state2.bubbleHeight;
        const zoneLeft = host3.getAttribute("data-panel-side") === "right" ? hostBox.x : hostBox.x + hostBox.width - BUBBLE_ZONE.width;
        if (height > 0) bubbleZone = { x: zoneLeft, y: pigBox.y - height, r: zoneLeft + BUBBLE_ZONE.width, b: pigBox.y };
      }
      let merged = true;
      while (merged) {
        merged = false;
        for (let p = 0; p < rects.length && !merged; p += 1) {
          for (let q = p + 1; q < rects.length; q += 1) {
            const one = rects[p];
            const two = rects[q];
            if (one.x <= two.r && two.x <= one.r && one.y <= two.b && two.y <= one.b) {
              rects[p] = { x: Math.min(one.x, two.x), y: Math.min(one.y, two.y), r: Math.max(one.r, two.r), b: Math.max(one.b, two.b) };
              rects.splice(q, 1);
              merged = true;
              break;
            }
          }
        }
      }
      const outline = rects.concat(bubbleZone === null ? [] : [bubbleZone]);
      if (pigNode !== null) {
        const artMargin = Math.max(40, (MAX_ART_ASPECT * FRAME_HEIGHT - 1) * pigBox.width / 2 + SHAPE_SLACK);
        outline.push({
          x: Math.min(pigBox.x + pigBox.width - BUBBLE_ZONE.width, pigBox.x - artMargin),
          y: pigBox.y - BUBBLE_ZONE.height - 24,
          r: pigBox.x + pigBox.width + artMargin,
          b: pigBox.y + pigBox.height + 12
        });
      }
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const o of outline) {
        left = Math.min(left, o.x);
        top = Math.min(top, o.y);
        right = Math.max(right, o.r);
        bottom = Math.max(bottom, o.b);
      }
      const content = {
        x: left - PAD,
        y: top - PAD,
        width: Math.ceil((right - left + PAD * 2) / STEP) * STEP,
        height: Math.ceil((bottom - top + PAD * 2) / STEP) * STEP
      };
      const pig = { x: pigBox.x - content.x, y: pigBox.y - content.y, width: pigBox.width, height: pigBox.height };
      const shape = rects.concat(bubbleRects).map(function(rect) {
        const x = Math.max(0, Math.floor(rect.x) - SHAPE_SLACK);
        const y = Math.max(0, Math.floor(rect.y) - SHAPE_SLACK);
        return { x, y, width: Math.ceil(rect.r) + SHAPE_SLACK - x, height: Math.ceil(rect.b) + SHAPE_SLACK - y };
      });
      if (pigNode !== null && host3.querySelector(".dp-fx") !== null) {
        const fx = { x: Math.max(0, Math.floor(pigBox.x - 36)), y: Math.max(0, Math.floor(pigBox.y - 84)) };
        shape.push({ x: fx.x, y: fx.y, width: Math.ceil(pigBox.x + pigBox.width + 36) - fx.x, height: Math.ceil(pigBox.y + 12) - fx.y });
      }
      return { content, shape, pig, hostBox, pigBox, contentBox: { left, top, right, bottom } };
    }
    function sides() {
      return SIDE;
    }
    function pin(host3, side, hostBox, contentBox) {
      const want = { left: "auto", right: "auto", top: "auto", bottom: "auto" };
      const shift = state2.shift;
      if (side.horizontal === "left") want.left = Math.round(hostBox.x - contentBox.left + PAD + shift.x) + "px";
      else want.right = Math.round(contentBox.right - hostBox.x - hostBox.width + PAD - shift.x) + "px";
      if (side.vertical === "top") want.top = Math.round(hostBox.y - contentBox.top + PAD + shift.y) + "px";
      else want.bottom = Math.round(contentBox.bottom - hostBox.y - hostBox.height + PAD - shift.y) + "px";
      const key = [side.vertical, side.horizontal, want.left, want.right, want.top, want.bottom].join("|");
      if (key === state2.pinned) return;
      state2.pinned = key;
      host3.style.left = want.left;
      host3.style.right = want.right;
      host3.style.top = want.top;
      host3.style.bottom = want.bottom;
    }
    function keyOf(next) {
      const head = [
        Math.floor(next.content.width / STEP),
        Math.floor(next.content.height / STEP),
        Math.floor(next.pig.x / STEP),
        Math.floor(next.pig.y / STEP),
        Math.floor(next.pigBox.x),
        Math.floor(next.pigBox.y)
      ];
      const tail = [];
      for (const s of next.shape) tail.push(s.x, s.y, s.width, s.height);
      return head.concat(tail.map((n) => Math.floor(n / STEP))).join(",");
    }
    return { boxes, sides, pin, keyOf, state: state2 };
  }

  // src/client/desktop/place.js
  var PIG_SCREEN_KEY = "dsh-piggy:desktop-pig";
  var STORE_VERSION = 3;
  function inside(area, point) {
    return point.x >= area.x && point.x < area.x + area.width && point.y >= area.y && point.y < area.y + area.height;
  }
  function areaOf(point, areas) {
    if (!Array.isArray(areas) || areas.length === 0) return null;
    return areas.find((area) => inside(area, point)) ?? nearestArea(point, areas);
  }
  function createPlacement() {
    let home = null;
    let pending2 = (
      /** @type {any} */
      void 0
    );
    let stored = "";
    let lastClamp = { dx: 0, dy: 0 };
    let lastPigSize = { width: 56, height: 56 };
    function readSaved() {
      let raw = null;
      try {
        raw = JSON.parse(localStorage.getItem(PIG_SCREEN_KEY) || "null");
      } catch {
        return null;
      }
      if (raw === null || typeof raw !== "object" || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
      return raw;
    }
    function homeFromSaved(raw, pigSize2, areas) {
      const list = Array.isArray(areas) ? areas : [];
      const relative = raw.v === STORE_VERSION || raw.v === 2;
      const same = relative && raw.area ? list.find((a) => a.x === raw.area.x && a.y === raw.area.y && a.width === raw.area.width && a.height === raw.area.height) : null;
      const origin = relative && raw.area ? same ?? raw.area : { x: 0, y: 0 };
      let point = { x: origin.x + raw.x, y: origin.y + raw.y };
      if (raw.v !== STORE_VERSION) {
        const w = Number.isFinite(raw.w) ? raw.w : pigSize2.width;
        const h = Number.isFinite(raw.h) ? raw.h : pigSize2.height;
        point = { x: point.x + w / 2, y: point.y + h };
      }
      if (relative && raw.area && same === null) {
        const area = areaOf(point, list);
        if (area !== null) point = clampInto(point, area);
      }
      return { x: Math.round(point.x), y: Math.round(point.y) };
    }
    function clampInto(point, area) {
      return {
        x: Math.max(area.x, Math.min(point.x, area.x + area.width - 1)),
        y: Math.max(area.y + 1, Math.min(point.y, area.y + area.height))
      };
    }
    function persist(areas) {
      if (home === null) return;
      const area = areaOf(home, areas);
      const payload = area === null ? { v: STORE_VERSION, area: null, x: home.x, y: home.y } : { v: STORE_VERSION, area: { x: area.x, y: area.y, width: area.width, height: area.height }, x: home.x - area.x, y: home.y - area.y };
      const key = JSON.stringify(payload);
      if (key === stored) return;
      stored = key;
      try {
        localStorage.setItem(PIG_SCREEN_KEY, key);
      } catch {
      }
    }
    function decide(report, bounds, areas) {
      const pigSize2 = report.pig.width > 0 && report.pig.height > 0 ? { width: report.pig.width, height: report.pig.height } : lastPigSize;
      lastPigSize = pigSize2;
      if (pending2 === void 0) pending2 = readSaved();
      if (home === null) {
        home = pending2 !== null ? homeFromSaved(pending2, pigSize2, areas) : { x: Math.round(bounds.x + report.pigNow.x + pigSize2.width / 2), y: Math.round(bounds.y + report.pigNow.y + pigSize2.height) };
        pending2 = null;
      }
      const list = Array.isArray(areas) ? areas : [];
      if (list.length > 0 && !list.some((area2) => inside(area2, home))) {
        const area2 = (
          /** @type {any} */
          nearestArea(home, list)
        );
        home = {
          x: Math.round(Math.max(area2.x + pigSize2.width / 2, Math.min(home.x, area2.x + area2.width - pigSize2.width / 2))),
          y: Math.round(Math.max(area2.y + pigSize2.height, Math.min(home.y, area2.y + area2.height)))
        };
      }
      const shift = report.shift ?? { x: 0, y: 0 };
      const pigPlain = { x: report.pigWindow.x - shift.x, y: report.pigWindow.y - shift.y, ...pigSize2 };
      const topLeft = { x: home.x - pigSize2.width / 2, y: home.y - pigSize2.height };
      const area = nearestArea(home, areas) ?? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      const next = contentBoundsForPig({ width: report.width, height: report.height, pigWindow: pigPlain }, topLeft);
      const rawX = next.x;
      const rawY = next.y;
      next.x = Math.max(area.x, Math.min(next.x, area.x + area.width - next.width));
      next.y = Math.max(area.y, Math.min(next.y, area.y + area.height - next.height));
      lastClamp = { dx: next.x - rawX, dy: next.y - rawY };
      return next;
    }
    function rehome(windowPos, pigLocal, areas) {
      home = { x: Math.round(windowPos.x + pigLocal.x + pigLocal.width / 2), y: Math.round(windowPos.y + pigLocal.y + pigLocal.height) };
      pending2 = null;
      persist(areas);
    }
    return {
      decide,
      rehome,
      /** 家写盘（启动换算完、显示器变了之后调一次）。 */
      persist,
      /** 猪的家（脚底中心）；还不知道是 null。 */
      home: () => home,
      /** 猪在家时左上角在哪（面板预留范围按它判断放不放得下）。 */
      homeTopLeft: () => home === null ? null : { x: home.x - lastPigSize.width / 2, y: home.y - lastPigSize.height },
      /** 上一轮算出来的窗口被工作区夹了多少。 */
      clamp: () => lastClamp,
      pigSize: () => lastPigSize
    };
  }

  // src/client/desktop/index.js
  var DESKTOP_VERSION = 4;
  var FONT_STACK = 'Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif';
  var DESKTOP_CSS = [
    `[data-dsh-pig][data-dsh-pig]{--ac-font:"Piggy Emoji",${FONT_STACK}}`,
    `[data-dsh-pig][data-dsh-pig][data-emoji="system"]{--ac-font:${FONT_STACK}}`,
    '[data-dsh-pig][data-open="false"] .dp-pig{filter:none!important}',
    "[data-dsh-pig] .dp-pig-img,[data-dsh-pig] .dp-pig-emoji{filter:none!important}",
    // 上面两条只为去投影（F11），却把状态变色一起关了（2026-10-08 发现）：这里把变色补回来，不带投影。
    '[data-dsh-pig] .dp-pig[data-mood="sick"] .dp-pig-img,[data-dsh-pig] .dp-pig[data-mood="sick"] .dp-pig-emoji{filter:hue-rotate(-28deg) saturate(.75)!important}',
    '[data-dsh-pig] .dp-pig[data-mood="dirty"] .dp-pig-img,[data-dsh-pig] .dp-pig[data-mood="dirty"] .dp-pig-emoji{filter:sepia(.4)!important}',
    '[data-dsh-pig] .dp-pig[data-mood="dead"] .dp-pig-img,[data-dsh-pig] .dp-pig[data-mood="dead"] .dp-pig-emoji{filter:grayscale(1)!important}',
    '[data-dsh-pig][data-faded="true"] .dp-pig-emoji{filter:grayscale(.5) opacity(.72)!important}',
    '[data-dsh-pig][data-dsh-pig] .dp-pig[data-stage="grave"]{filter:grayscale(.35)!important}',
    "[data-dsh-pig] .dp-card{box-shadow:inset 0 1px 2px rgba(61,52,40,.09)!important}",
    "[data-dsh-pig] .dp-panel-footer{max-height:270px!important}",
    // 收起时拖猪，窗口缩到只包住猪；头顶的签到/礼包小气泡会被窗口边裁成半块白色，拖的时候先藏起来。
    '[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-daily,[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-poke-hint{visibility:hidden!important}',
    // 猪窗口（外壳 0.6.0 起）：面板和名牌在另一个窗口里，这里永远只有猪。
    '[data-piggy-role="pet"] .dp-card,[data-piggy-role="pet"] .dp-hud{display:none!important}'
  ].join("\n");
  var TOLERANCE = 2;
  var bridge2 = (
    /** @type {any} */
    null
  );
  var role = (
    /** @type {'pet'|'panel'|null} */
    null
  );
  var dragSlide = { x: 0, y: 0 };
  var measure = (
    /** @type {any} */
    null
  );
  var placement = (
    /** @type {any} */
    null
  );
  var lastKey = null;
  var hitRects = [];
  var lastHit = null;
  var mouse = { x: -1, y: -1 };
  var scheduled2 = false;
  var staleSince = (
    /** @type {number|null} */
    null
  );
  var STALE_WAIT_MS = 500;
  function host2() {
    return (
      /** @type {any} */
      document.querySelector("[data-dsh-pig]")
    );
  }
  function geometry() {
    return typeof bridge2.geometry === "function" ? bridge2.geometry() : null;
  }
  function dragging() {
    const scene3 = document.querySelector("[data-dsh-pig] .dp-scene");
    return scene3 !== null && scene3.getAttribute("data-dragging") === "true";
  }
  function updateHit(x, y) {
    mouse = { x, y };
    if (typeof bridge2.setHit !== "function") return;
    let inside2 = dragging();
    for (let i = 0; !inside2 && i < hitRects.length; i += 1) {
      const r = hitRects[i];
      inside2 = x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
    }
    if (inside2 === lastHit) return;
    lastHit = inside2;
    bridge2.setHit(inside2);
  }
  function layoutStale(win) {
    return Math.abs(window.innerWidth - win.width) > 1 || Math.abs(window.innerHeight - win.height) > 1;
  }
  function tick() {
    const h = host2();
    if (h === null) return;
    const info = readGeometry();
    if (info !== null && info.window && layoutStale(info.window)) {
      const at = typeof performance === "object" ? performance.now() : Date.now();
      if (staleSince === null) staleSince = at;
      if (at - staleSince < STALE_WAIT_MS) {
        lastKey = null;
        return;
      }
    }
    staleSince = null;
    let next = measure.boxes(h);
    if (next === null) return;
    const side = measure.sides();
    measure.pin(h, side, next.hostBox, next.contentBox);
    next = measure.boxes(h);
    if (next === null) return;
    hitRects = next.shape;
    if (mouse.x >= 0) updateHit(mouse.x, mouse.y);
    if (info === null || !info.window) {
      lastKey = null;
      return;
    }
    if (Math.abs(window.screenX - info.window.x) > 1 || Math.abs(window.screenY - info.window.y) > 1) {
      lastKey = null;
      return;
    }
    const bounds = info.window;
    const areas = info.workAreas ?? [info.workArea];
    const grownX = side.horizontal === "right" ? next.content.width - bounds.width : 0;
    const grownY = side.vertical === "bottom" ? next.content.height - bounds.height : 0;
    const want = placement.decide({
      width: next.content.width,
      height: next.content.height,
      pig: next.pig,
      pigWindow: { x: next.pigBox.x + grownX, y: next.pigBox.y + grownY },
      pigNow: { x: next.pigBox.x, y: next.pigBox.y },
      shift: measure.state.shift
    }, bounds, areas);
    placement.persist(areas);
    const clamp = placement.clamp();
    const old = measure.state.shift;
    const fresh = { x: -clamp.dx, y: -clamp.dy };
    if (fresh.x !== old.x || fresh.y !== old.y) {
      measure.state.shift = fresh;
      measure.pin(h, side, next.hostBox, next.contentBox);
      const dx = fresh.x - old.x;
      const dy = fresh.y - old.y;
      next.shape = next.shape.map((rect) => ({ ...rect, x: rect.x + dx, y: rect.y + dy }));
      hitRects = next.shape;
    }
    const move = !sameBounds(want, bounds, TOLERANCE);
    const key = measure.keyOf(next);
    if (!move && key === lastKey) return;
    lastKey = key;
    const request = { shape: next.shape, bounds: move ? want : void 0, pig: void 0 };
    const pigNode = h.querySelector(".dp-pig");
    if (pigNode) request.pig = layoutBox(pigNode);
    if (move) {
      console.warn("[piggy-desktop] move " + JSON.stringify({
        open: h.getAttribute("data-open"),
        side,
        from: bounds,
        to: want,
        home: placement.home(),
        shift: measure.state.shift,
        content: { w: next.content.width, h: next.content.height },
        pigBox: next.pigBox,
        ghosts: h.querySelectorAll("[data-ghost]").length,
        display: displayNote(info)
      }));
    }
    bridge2.place(request);
  }
  function pigInWindow(win) {
    const h = host2();
    const pigNode = h?.querySelector(".dp-pig");
    const size = placement.pigSize();
    const homeTL = placement.homeTopLeft();
    if (pigNode && !layoutStale(win)) return layoutBox(pigNode);
    if (homeTL !== null) return { x: homeTL.x - win.x, y: homeTL.y - win.y, width: size.width, height: size.height };
    return pigNode ? layoutBox(pigNode) : null;
  }
  function displayNote(info) {
    const list = info?.displays;
    if (!Array.isArray(list) || list.length === 0) return null;
    const win = info.window;
    const hit = list.find((display) => win.x >= display.workArea.x && win.x < display.workArea.x + display.workArea.width && win.y >= display.workArea.y && win.y < display.workArea.y + display.workArea.height);
    const one = hit ?? list[0];
    return { id: one.id, scale: one.scaleFactor, count: list.length };
  }
  function readGeometry() {
    if (typeof bridge2.place === "function") {
      const fresh = bridge2.place({});
      if (fresh !== null && fresh !== void 0 && fresh.window) return fresh;
    }
    return geometry();
  }
  function resetShift() {
    if (measure.state.shift.x === 0 && measure.state.shift.y === 0) return;
    measure.state.shift = { x: 0, y: 0 };
  }
  function schedule3() {
    if (scheduled2) return;
    scheduled2 = true;
    requestAnimationFrame(function() {
      scheduled2 = false;
      if (!dragging()) tick();
    });
  }
  function install2(shell2) {
    bridge2 = shell2;
    const split = shell2.panel !== void 0 && typeof shell2.panel.toggle === "function";
    if (!split) {
      console.warn("[piggy-desktop] shell has no split windows\uFF08\u8BF7\u628A\u684C\u9762\u7A0B\u5E8F\u66F4\u65B0\u5230 0.6.0 \u4EE5\u4E0A\uFF09");
      window.__dshPiggyShellOutdated = true;
      return;
    }
    role = shell2.role === "panel" ? "panel" : "pet";
    if (role === "panel") {
      const style2 = document.createElement("style");
      style2.setAttribute("data-piggy-desktop-style", "");
      style2.textContent = DESKTOP_CSS;
      document.head.appendChild(style2);
      installPanel(shell2);
      return;
    }
    document.documentElement.setAttribute("data-piggy-role", "pet");
    const missing = ["place", "beginDrag", "endDrag"].filter((name) => typeof shell2[name] !== "function");
    if (missing.length > 0) {
      console.warn("[piggy-desktop] shell is too old, missing: " + missing.join(", ") + "\uFF08\u8BF7\u66F4\u65B0\u684C\u9762\u7A0B\u5E8F\uFF09");
      window.__dshPiggyShellOutdated = true;
    }
    placement = createPlacement();
    measure = createMeasure({ platform: shell2.platform || "", geometry });
    const style = document.createElement("style");
    style.setAttribute("data-piggy-desktop-style", "");
    style.textContent = DESKTOP_CSS;
    document.head.appendChild(style);
    if (typeof shell2.onGeometry === "function") shell2.onGeometry(function() {
      schedule3();
    });
    if (typeof shell2.onDragSlide === "function") {
      shell2.onDragSlide(function(slide) {
        if (!dragging()) return;
        dragSlide = { x: Number(slide?.x) || 0, y: Number(slide?.y) || 0 };
        const h = host2();
        if (h !== null) h.style.translate = dragSlide.x === 0 && dragSlide.y === 0 ? "" : dragSlide.x + "px " + dragSlide.y + "px";
      });
    }
    if (typeof shell2.askGeometry === "function") shell2.askGeometry();
    window.__dshPiggyShell = {
      // 面板在另一个窗口里，右键只是叫主进程把它开/关在猪旁边。
      role: "pet",
      proxy: shell2.proxy,
      split: true,
      onStateChanged: shell2.onStateChanged,
      panel: {
        toggle: function(open) {
          const info = readGeometry();
          const pig = info && info.window ? pigInWindow(info.window) : null;
          shell2.panel.toggle(open, pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height });
        },
        on: shell2.panel.on,
        onFx: shell2.panel.onFx
      },
      beginDrag: function() {
        const h = host2();
        if (h !== null && h.getAttribute("data-open") === "false") {
          resetShift();
        }
        const info = readGeometry();
        const pig = info && info.window ? pigInWindow(info.window) : null;
        dragSlide = { x: 0, y: 0 };
        shell2.beginDrag(pig === null ? null : {
          x: pig.x,
          y: pig.y,
          width: pig.width,
          height: pig.height,
          slide: typeof shell2.onDragSlide === "function"
        });
      },
      dragHeartbeat: function() {
        if (typeof shell2.dragHeartbeat === "function") shell2.dragHeartbeat();
      },
      endDrag: function() {
        shell2.endDrag();
        const info = readGeometry();
        if (info && info.window) {
          if (info.dragSlide && Number.isFinite(info.dragSlide.x) && Number.isFinite(info.dragSlide.y)) dragSlide = info.dragSlide;
          const inWindow = pigInWindow(info.window);
          const pig = inWindow === null ? null : { ...inWindow, x: inWindow.x + dragSlide.x, y: inWindow.y + dragSlide.y };
          if (pig !== null) {
            placement.rehome(info.window, pig, info.workAreas ?? [info.workArea]);
          }
        }
        dragSlide = { x: 0, y: 0 };
        const h = host2();
        if (h !== null) h.style.translate = "";
        lastKey = null;
        tick();
      },
      syncGeometry: function() {
        tick();
      },
      // 桌面散步（G 批次）：用外壳本来就有的 moveBy 挪窗口，新位置由主进程推回来的几何记住。
      moveBy: typeof shell2.moveBy === "function" ? function(dx, dy) {
        shell2.moveBy(dx, dy);
        const info = readGeometry();
        const pig = info && info.window ? pigInWindow(info.window) : null;
        if (pig !== null) placement.rehome(info.window, pig, info.workAreas ?? [info.workArea]);
      } : void 0
    };
    document.addEventListener("mouseover", function(event) {
      const target = (
        /** @type {any} */
        event.target
      );
      const titled = target !== null && typeof target.closest === "function" ? target.closest("[title]") : null;
      if (titled === null) return;
      if (!titled.getAttribute("aria-label")) titled.setAttribute("aria-label", titled.getAttribute("title"));
      titled.removeAttribute("title");
    }, true);
    document.addEventListener("mousemove", function(event) {
      updateHit(event.clientX, event.clientY);
    }, true);
    document.documentElement.addEventListener("mouseleave", function() {
      if (dragging()) return;
      mouse = { x: -1, y: -1 };
      lastHit = false;
      if (typeof shell2.setHit === "function") shell2.setHit(false);
    });
  }
  function start() {
    if (role === "panel") {
      startPanel();
      return;
    }
    const h = host2();
    if (h !== null && typeof MutationObserver === "function") {
      new MutationObserver(schedule3).observe(h, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    window.addEventListener("resize", schedule3);
    window.addEventListener("pointerup", schedule3);
    setInterval(function() {
      if (!dragging()) tick();
    }, 1e3);
    tick();
  }
  var desktop = { version: DESKTOP_VERSION, install: install2, start };

  // src/client/index.js
  window.__ModuleLoader__.load({
    id: "dsh-piggy",
    factory: (require2) => {
      var module = { exports: {} };
      var exports = module.exports;
      var devMode = false;
      function apply(ctx) {
        installCapture();
        try {
          return mount();
        } catch (error) {
          console.warn("[dsh-piggy] \u6302\u8F7D\u5931\u8D25\uFF0C\u732A\u5148\u9000\u5230\u4E00\u8FB9", error);
          record("error", "mount", "\u6302\u8F7D\u5931\u8D25\uFF1A" + (error instanceof Error ? error.message : String(error)), { stack: error instanceof Error ? error.stack : "" });
          return () => {
          };
        }
      }
      function mount() {
        if (document.querySelector("[" + MOUNTED + "]") !== null) {
          console.warn("[dsh-piggy] \u5DF2\u5B58\u5728\u5B9E\u4F8B\uFF0C\u8DF3\u8FC7\u91CD\u590D\u6302\u8F7D");
          return () => {
          };
        }
        var parts = createScene();
        var {
          font,
          style,
          host: host3,
          card: card2,
          scene: scene3,
          hud,
          hudName,
          hudCoins,
          hudHealth,
          bubble,
          work,
          prop,
          progressWrap,
          progressFill,
          pokeHint,
          dailyHint,
          pomoHint,
          soul,
          pigArt,
          pigSleep,
          pigEmoji,
          pig,
          dressSlots,
          bar,
          content,
          footer
        } = parts;
        var deskShell = desktopShell();
        var savedPos = deskShell === null ? readPosition(readStore(POSITION_KEY)) : null;
        var userRight = savedPos === null ? 18 : savedPos.right;
        var userBottom = savedPos === null ? 18 : savedPos.bottom;
        if (deskShell === null) {
          host3.style.right = userRight + "px";
          host3.style.bottom = userBottom + "px";
        } else {
          host3.style.right = "auto";
          host3.style.bottom = "auto";
        }
        var icons = {};
        var view = normalize(null);
        var stopSizePreference = attachSizePreference(
          host3,
          () => view.hatched ? view.pig?.stage : view.boxStage,
          () => desktopShell()?.syncGeometry?.()
        );
        var tab = "home";
        var stage2 = "primary";
        var stagePicked = false;
        var drill = { study: null, shop: null, bag: null, work: null, dex: null, skins: null, pick: null, from: null };
        var picker = null;
        var ownerEdit = null;
        var pigNameEdit = null;
        var cardEdit = null;
        var isOpen = desktopShell() === null && readStore(OPEN_KEY) === "true";
        var lastStage = null;
        var lastPendingAt = 0;
        var lastPendingId = 0;
        var pollTimer = null;
        var fx = createEffects({
          scene: scene3,
          pig,
          pigArt,
          pigEmoji,
          card: card2,
          bubble,
          pomoHint,
          isStopped: function() {
            return stopped;
          }
        });
        var react = fx.react, burst = fx.burst, flash = fx.flash;
        var showBubble = fx.showBubble, showLine = fx.showLine, toast = fx.toast;
        var stopped = false;
        var busy3 = false;
        var ctx = {
          host: host3,
          card: card2,
          content,
          footer,
          scene: scene3,
          hud,
          hudName,
          hudCoins,
          hudHealth,
          bubble,
          work,
          prop,
          progressWrap,
          progressFill,
          pokeHint,
          dailyHint,
          pomoHint,
          soul,
          pigArt,
          pigSleep,
          pigEmoji,
          pig,
          dressSlots,
          bar,
          icons,
          flash,
          react,
          burst,
          transform: fx.transform,
          showBubble,
          showLine,
          toast,
          get view() {
            return view;
          },
          set view(next) {
            view = next;
          },
          get tab() {
            return tab;
          },
          set tab(next) {
            tab = next;
          },
          get stage() {
            return stage2;
          },
          set stage(next) {
            stage2 = next;
          },
          get stagePicked() {
            return stagePicked;
          },
          set stagePicked(next) {
            stagePicked = next;
          },
          get tapVersion() {
            return dev.tap;
          },
          get devOff() {
            return function() {
              dev.set(false);
            };
          },
          get drill() {
            return drill;
          },
          get picker() {
            return picker;
          },
          set picker(next) {
            picker = next;
          },
          get ownerEdit() {
            return ownerEdit;
          },
          set ownerEdit(next) {
            ownerEdit = next;
          },
          get pigNameEdit() {
            return pigNameEdit;
          },
          set pigNameEdit(next) {
            pigNameEdit = next;
          },
          get cardEdit() {
            return cardEdit;
          },
          set cardEdit(next) {
            cardEdit = next;
          },
          get isOpen() {
            return isOpen;
          },
          set isOpen(next) {
            isOpen = next;
          },
          get lastStage() {
            return lastStage;
          },
          set lastStage(next) {
            lastStage = next;
          },
          get lastPendingAt() {
            return lastPendingAt;
          },
          set lastPendingAt(next) {
            lastPendingAt = next;
          },
          get lastPendingId() {
            return lastPendingId;
          },
          set lastPendingId(next) {
            lastPendingId = next;
          },
          get userRight() {
            return userRight;
          },
          set userRight(next) {
            userRight = next;
          },
          get userBottom() {
            return userBottom;
          },
          set userBottom(next) {
            userBottom = next;
          },
          get busy() {
            return busy3;
          },
          set busy(next) {
            busy3 = next;
          },
          justBought: null,
          homePage: 0,
          get stopped() {
            return stopped;
          },
          set stopped(next) {
            stopped = next;
          },
          get devMode() {
            return devMode;
          }
        };
        var layout = createLayout(ctx);
        var panel = createPanel(ctx);
        ctx.select = panel.select;
        ctx.setOpen = panel.setOpen;
        ctx.fitPanel = layout.fitPanel;
        ctx.paintBar = layout.paintBar;
        ctx.buildIcon = layout.buildIcon;
        ctx.clampPig = layout.clampPig;
        var render = panel.render, renderContent = panel.renderContent;
        var setOpen = panel.setOpen, select = panel.select;
        var fitPanel = layout.fitPanel, clampPig = layout.clampPig;
        var paintBar = layout.paintBar, buildIcon = layout.buildIcon;
        for (var t = 0; t < TABS.length; t += 1) buildIcon(TABS[t]);
        var io = createIo(ctx);
        var send2 = io.send, refresh2 = io.refresh;
        ctx.send = send2;
        ctx.render = render;
        ctx.renderContent = renderContent;
        ctx.setOpen = setOpen;
        ctx.fitPanel = fitPanel;
        ctx.flash = flash;
        var updateNotice = attachUpdateNotice(ctx, updatesBridge);
        ctx.previewArt = function(name) {
          forceFeedbackArt(name);
          syncPigArt(pig, pigArt, pigEmoji);
        };
        ctx.idleNow = function(key) {
          if (ctx.life) ctx.life.idleNow(key);
        };
        ctx.walkNow = function() {
          if (ctx.life) ctx.life.walkNow();
        };
        var birthday = createBirthday({ ctx, pig, pigArt, pigEmoji, burst, render: function() {
          refresh2();
        } });
        var splitRole = wireSplit(ctx, { refresh: function() {
          refresh2();
        }, isFishing: function() {
          return tab === "fishing" && view.fishing.pending?.phase === "hooked";
        } });
        ["pointerdown", "pointerup"].forEach(function(type) {
          dailyHint.addEventListener(type, function(event) {
            event.stopPropagation();
          });
        });
        dailyHint.addEventListener("click", function(event) {
          event.stopPropagation();
          var action = dailyHint.getAttribute("data-action");
          if (action === "cake") birthday.celebrate();
          else if (action !== null && action !== "") send2(action);
        });
        var drag = null;
        var stopDragHeartbeat = function() {
        };
        scene3.addEventListener("pointerdown", function(event) {
          if (event.button !== 0) return;
          stopDragHeartbeat();
          drag = {
            x: event.clientX,
            y: event.clientY,
            startX: typeof event.screenX === "number" ? event.screenX : event.clientX,
            startY: typeof event.screenY === "number" ? event.screenY : event.clientY,
            lastX: typeof event.screenX === "number" ? event.screenX : event.clientX,
            lastY: typeof event.screenY === "number" ? event.screenY : event.clientY,
            right: parseFloat(getComputedStyle(host3).right) || 18,
            bottom: parseFloat(getComputedStyle(host3).bottom) || 18,
            moved: false
          };
          scene3.setAttribute("data-dragging", "true");
          scene3.setPointerCapture?.(event.pointerId);
          var shellAtStart = desktopShell();
          shellAtStart?.beginDrag?.();
          stopDragHeartbeat = startDragHeartbeat(shellAtStart, function() {
            return drag !== null;
          });
        });
        scene3.addEventListener("pointermove", function(event) {
          if (drag === null) return;
          var dx = event.clientX - drag.x;
          var dy = event.clientY - drag.y;
          var shellNow = desktopShell();
          if (shellNow !== null) {
            shellNow.dragHeartbeat?.();
            var screenX = typeof event.screenX === "number" ? event.screenX : event.clientX;
            var screenY = typeof event.screenY === "number" ? event.screenY : event.clientY;
            if (Math.abs(screenX - drag.startX) > 3 || Math.abs(screenY - drag.startY) > 3) drag.moved = true;
            if (typeof shellNow.beginDrag !== "function") {
              var stepX = screenX - drag.lastX;
              var stepY = screenY - drag.lastY;
              drag.lastX = screenX;
              drag.lastY = screenY;
              if (stepX !== 0 || stepY !== 0) shellNow.moveBy(stepX, stepY);
            }
            return;
          }
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
          userRight = drag.right - dx;
          userBottom = drag.bottom - dy;
          clampPig();
          fitPanel();
        });
        function endDrag() {
          if (drag === null) return false;
          var moved = drag.moved;
          drag = null;
          stopDragHeartbeat();
          stopDragHeartbeat = function() {
          };
          desktopShell()?.endDrag?.();
          scene3.removeAttribute("data-dragging");
          clampPig();
          if (deskShell === null) writeStore(POSITION_KEY, JSON.stringify({ right: userRight, bottom: userBottom }));
          fitPanel();
          return moved;
        }
        var boxPokes = 0;
        function pokeBox() {
          boxPokes += 1;
          react("poke", 560);
          if (boxPokes >= BOX_POKES_TO_OPEN) {
            boxPokes = 0;
            host3.removeAttribute("data-poke");
            showBubble("\u54C7\u2014\u2014\uFF01", 1200);
            burst(["\u2728", "\u{1F389}", "\u{1F4A8}"], 6);
            send2("hatch");
            return;
          }
          host3.setAttribute("data-poke", String(boxPokes));
          burst(["\u{1F4A8}"], 2);
          showBubble(BOX_POKE_LINES[boxPokes - 1], 2200);
        }
        scene3.addEventListener("pointerup", function(event) {
          if (drag === null) return;
          if (endDrag()) return;
          if (view.hatched !== true) {
            pokeBox();
            return;
          }
          if (!view.dead) send2("pet", { part: partAt(pig, event) });
        });
        scene3.addEventListener("pointercancel", function() {
          endDrag();
        });
        scene3.addEventListener("lostpointercapture", function() {
          endDrag();
        });
        scene3.addEventListener("contextmenu", function(event) {
          event.preventDefault();
          setOpen(!isOpen);
        });
        var autoCollapse = splitRole !== null ? { dispose: function() {
        } } : attachAutoCollapse({
          host: host3,
          isOpen: function() {
            return isOpen;
          },
          setOpen,
          isDragging: function() {
            return drag !== null;
          },
          isFishing: function() {
            return tab === "fishing" && view.fishing.pending?.phase === "hooked";
          },
          isDesktop: function() {
            return desktopShell() !== null;
          }
        });
        clampPig();
        setOpen(isOpen);
        render(view);
        refresh2();
        pollTimer = window.setInterval(refresh2, POLL_MS);
        var life = splitRole === "panel" ? null : attachLife({
          send: send2,
          isStopped: function() {
            return stopped;
          },
          isBusy: function() {
            return busy3;
          },
          isOpen: function() {
            return isOpen;
          },
          getView: function() {
            return view;
          },
          isDragging: function() {
            return drag !== null;
          },
          pig,
          pigArt,
          pigEmoji,
          burst: (
            /** @type {any} */
            burst
          ),
          showBubble: (
            /** @type {any} */
            showBubble
          ),
          desktopShell
        });
        ctx.life = life;
        var stopResize = layout.attachResize();
        var dev = attachDevMode({
          setEnabled: function(next) {
            devMode = next;
          },
          host: host3,
          paintBar,
          setOpen,
          select,
          showBubble,
          getTab: function() {
            return tab;
          }
        });
        devMode = false;
        function dispose() {
          stopped = true;
          stopSizePreference();
          stopDragHeartbeat();
          updateNotice.stop();
          stopResize();
          autoCollapse.dispose();
          dev.dispose();
          if (pollTimer !== null) window.clearInterval(pollTimer);
          life?.dispose();
          fx.dispose();
          pollTimer = null;
          host3.remove();
          style.remove();
          font.remove();
        }
        return dispose;
      }
      exports.name = "dsh-piggy";
      exports.apply = apply;
      exports.desktop = desktop;
      return module.exports;
    }
  });
})();
