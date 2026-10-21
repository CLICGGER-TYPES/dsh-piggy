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
    return kind === "revive" || kind === "body" ? "medicine" : kind;
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

  // src/client/feedback-framing.js
  var FRAME_HEIGHT = 0.84375;
  var FEEDBACK_FRAMING = Object.freeze({
    "allergy": [1.0909, 0, 0],
    "birthday": [0.9643, 0, 0],
    "collection-badge": [0.9818, 0, 0],
    "collection-bubbles": [1.0909, 0, 0],
    "collection-cage": [0.9643, 0.19, 0],
    "collection-check": [1.064, 0, 0.21],
    "collection-chicken": [0.9643, 0, 0],
    "collection-courier": [1, 0, 0],
    "collection-fever": [1.1676, 0, 0.23],
    "collection-fitness": [1.3012, 0, 0],
    "collection-letter": [1.2414, 0, 0],
    "collection-mosquito": [1.2558, 0, 0],
    "collection-scallion": [1.0237, 0, 0.2],
    "collection-snack": [1.2067, 0, 0.24],
    "collection-soup": [0.9643, 0.19, 0],
    "collection-stack": [0.9643, 0, 0],
    "collection-taro": [1.1551, 0, 0.23],
    "collection-throne": [0.9643, 0, 0],
    "courier": [0.9954, 0, 0.19],
    "death-day": [1.4595, 0, 0],
    "faint": [1.1077, 0, 0.22],
    "fishing": [1.1368, 0, 0],
    "ghost-grave": [1.1613, 0, 0],
    "hungry": [1.0237, 0, 0.2],
    "lie-flat": [1.2273, 0, 0],
    "music-earbuds": [1.0435, 0, 0.2],
    "music-headphones-v2": [1.2558, 0, 0],
    "music-rainbow": [1.7561, 0, 0.34],
    "painting": [1.0537, 0, 0.21],
    "recruit": [1.0335, 0, 0.2],
    "runny-nose": [0.9643, 0, 0],
    "sleep-cloud": [1.3252, 0, 0.26],
    "study-book": [1.1803, 0, 0.23],
    "study-determined": [1.2135, 0, 0],
    "study-pink-book": [1.0237, 0, 0.2],
    "suspended": [0.9643, 0.19, 0],
    "turning": [1.1868, 0, 0],
    "twitch": [1.1676, 0, 0.23]
  });
  var BUILTIN_FRAMING = Object.freeze({
    "pigs/skins/career-astronaut/idle.png": [1.0693, 0, 0],
    "pigs/skins/career-astronaut/bathe.png": [1.0335, 0, 0.2],
    "pigs/skins/career-astronaut/eat.png": [1.0693, 0, 0],
    "pigs/skins/career-astronaut/pet.png": [0.9774, 0, 0.19],
    "pigs/skins/career-astronaut/play.png": [0.9643, 0.19, 0],
    "pigs/skins/career-astronaut/relaxed.png": [1.0693, 0, 0],
    "pigs/skins/career-astronaut/sleep.png": [1.3758, 0, 0.27],
    "pigs/skins/career-astronaut/study.png": [0.9954, 0, 0.19],
    "pigs/skins/career-astronaut/trip.png": [1.08, 0, 0],
    "pigs/skins/career-astronaut/work.png": [1.102, 0, 0],
    "pigs/skins/career-chef/idle.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/bathe.png": [1.0385, 0, 0],
    "pigs/skins/career-chef/eat.png": [0.9643, 0.19, 0],
    "pigs/skins/career-chef/pet.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/play.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/relaxed.png": [0.9643, 0.19, 0],
    "pigs/skins/career-chef/sleep.png": [1.2414, 0, 0],
    "pigs/skins/career-chef/study.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/trip.png": [0.9643, 0, 0],
    "pigs/skins/career-chef/work.png": [0.9908, 0, 0],
    "pigs/base/elder/idle.png": [1.0854, 0, 0.21],
    "pigs/forms/pig-devil/idle.png": [1.0435, 0, 0.2],
    "pigs/forms/pig-devil/bathe.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-devil/eat.png": [1.2, 0, 0],
    "pigs/forms/pig-devil/fly.png": [1.1134, 0, 0],
    "pigs/forms/pig-devil/pet.png": [1.0746, 0, 0.21],
    "pigs/forms/pig-devil/play.png": [0.9643, 0, 0],
    "pigs/forms/pig-devil/relaxed.png": [1.0385, 0, 0],
    "pigs/forms/pig-devil/sleep.png": [1.3585, 0, 0.27],
    "pigs/forms/pig-devil/study.png": [1.2706, 0, 0],
    "pigs/forms/pig-devil/trip.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-devil/work.png": [1.1613, 0, 0],
    "pigs/forms/pig-fat/idle.png": [1.0964, 0, 0.21],
    "pigs/forms/pig-fat/bathe.png": [1.0435, 0, 0.2],
    "pigs/forms/pig-fat/eat.png": [1.2203, 0, 0.24],
    "pigs/forms/pig-fat/pet.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-fat/play.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-fat/relaxed.png": [1.0964, 0, 0.21],
    "pigs/forms/pig-fat/sleep.png": [1.4497, 0, 0.28],
    "pigs/forms/pig-fat/study.png": [1.102, 0, 0],
    "pigs/forms/pig-fat/trip.png": [1.0909, 0, 0],
    "pigs/forms/pig-fat/work.png": [1.3091, 0, 0.26],
    "pigs/forms/pig-king/idle.png": [1.0047, 0, 0.2],
    "pigs/forms/pig-king/bathe.png": [0.9818, 0, 0],
    "pigs/forms/pig-king/eat.png": [0.9643, 0, 0],
    "pigs/forms/pig-king/pet.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-king/play.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-king/relaxed.png": [1.0047, 0, 0.2],
    "pigs/forms/pig-king/sleep.png": [1.2632, 0, 0.25],
    "pigs/forms/pig-king/study.png": [1.0385, 0, 0],
    "pigs/forms/pig-king/trip.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-king/work.png": [1.1429, 0, 0.22],
    "pigs/forms/pig-round/idle.png": [1.1077, 0, 0.22],
    "pigs/forms/pig-round/bathe.png": [1.0237, 0, 0.2],
    "pigs/forms/pig-round/eat.png": [1.0435, 0, 0.2],
    "pigs/forms/pig-round/pet.png": [1.1134, 0, 0],
    "pigs/forms/pig-round/play.png": [0.9863, 0, 0.19],
    "pigs/forms/pig-round/relaxed.png": [1.1134, 0, 0],
    "pigs/forms/pig-round/sleep.png": [1.3935, 0, 0.27],
    "pigs/forms/pig-round/study.png": [0.9643, 0.19, 0],
    "pigs/forms/pig-round/trip.png": [1.1077, 0, 0.22],
    "pigs/forms/pig-round/work.png": [1.2857, 0, 0],
    "pigs/base/piglet/idle.png": [1.0693, 0, 0],
    "pigs/base/piglet/bathe.png": [1.3333, 0, 0],
    "pigs/base/piglet/blink.png": [1.0693, 0, 0],
    "pigs/base/piglet/eat.png": [1.3333, 0, 0],
    "pigs/base/piglet/play.png": [1.1309, 0, 0.22],
    "pigs/base/piglet/shy-pet.png": [1.0693, 0, 0],
    "pigs/base/piglet/sleep.png": [1.3585, 0, 0.27],
    "pigs/base/piglet/work.png": [1.8783, 0, 0.37],
    "pigs/skins/skin-angel/idle.png": [0.9818, 0, 0],
    "pigs/skins/skin-angel/bathe.png": [0.9643, 0.19, 0],
    "pigs/skins/skin-angel/eat.png": [0.9643, 0.19, 0],
    "pigs/skins/skin-angel/pet.png": [0.9643, 0, 0],
    "pigs/skins/skin-angel/play.png": [0.9643, 0.19, 0],
    "pigs/skins/skin-angel/relaxed.png": [0.9643, 0.19, 0],
    "pigs/skins/skin-angel/sleep.png": [1.3846, 0, 0],
    "pigs/skins/skin-angel/study.png": [0.9643, 0.19, 0],
    "pigs/skins/skin-angel/trip.png": [0.9686, 0, 0.19],
    "pigs/skins/skin-angel/work.png": [1.0189, 0, 0],
    "pigs/skins/skin-detective/idle.png": [0.9908, 0, 0],
    "pigs/skins/skin-detective/bathe.png": [1.0385, 0, 0],
    "pigs/skins/skin-detective/eat.png": [0.9954, 0, 0.19],
    "pigs/skins/skin-detective/pet.png": [0.9643, 0, 0],
    "pigs/skins/skin-detective/play.png": [0.9643, 0, 0],
    "pigs/skins/skin-detective/relaxed.png": [0.9954, 0, 0.19],
    "pigs/skins/skin-detective/sleep.png": [1.2632, 0, 0.25],
    "pigs/skins/skin-detective/study.png": [0.9643, 0, 0],
    "pigs/skins/skin-detective/trip.png": [0.9774, 0, 0.19],
    "pigs/skins/skin-detective/work.png": [1.0485, 0, 0],
    "pigs/skins/skin-mint/idle.png": [1.0693, 0, 0],
    "pigs/skins/skin-mint/bathe.png": [1.0693, 0, 0],
    "pigs/skins/skin-mint/eat.png": [1.0693, 0, 0],
    "pigs/skins/skin-mint/pet.png": [1.0693, 0, 0],
    "pigs/skins/skin-mint/play.png": [1.0693, 0, 0],
    "pigs/skins/skin-mint/sleep.png": [1.3416, 0, 0.26],
    "pigs/skins/skin-mint/work.png": [1.6489, 0, 0.32],
    "pigs/skins/skin-pirate/idle.png": [1.0746, 0, 0.21],
    "pigs/skins/skin-pirate/bathe.png": [1.0385, 0, 0],
    "pigs/skins/skin-pirate/eat.png": [1, 0, 0],
    "pigs/skins/skin-pirate/pet.png": [0.9643, 0, 0],
    "pigs/skins/skin-pirate/play.png": [0.9643, 0, 0],
    "pigs/skins/skin-pirate/relaxed.png": [1.0693, 0, 0],
    "pigs/skins/skin-pirate/sleep.png": [1.3585, 0, 0.27],
    "pigs/skins/skin-pirate/study.png": [0.9643, 0.19, 0],
    "pigs/skins/skin-pirate/trip.png": [1.0693, 0, 0],
    "pigs/skins/skin-pirate/work.png": [1.1309, 0, 0.22],
    "pigs/skins/skin-wizard/idle.png": [0.973, 0, 3.42],
    "pigs/skins/skin-wizard/bathe.png": [1.0693, 0, 7.94],
    "pigs/skins/skin-wizard/eat.png": [1.1134, 0, 6.52],
    "pigs/skins/skin-wizard/pet.png": [0.973, 0, 3.42],
    "pigs/skins/skin-wizard/play.png": [1, 0, 4.69],
    "pigs/skins/skin-wizard/relaxed.png": [0.9774, 0, 3.63],
    "pigs/skins/skin-wizard/sleep.png": [1.102, 0, 7.75],
    "pigs/skins/skin-wizard/study.png": [0.8926, 0, -0.35],
    "pigs/skins/skin-wizard/trip.png": [0.973, 0, 3.42],
    "pigs/skins/skin-wizard/work.png": [1.2857, 0, 13.06]
  });
  var ART_BOUNDS = Object.freeze({
    "pigs/base/piglet/idle.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/career-chef/idle.png": [0.070312, 0.0625, 0.929688, 0.9375],
    "pigs/skins/skin-angel/idle.png": [0.0625, 0.070312, 0.9375, 0.929688],
    "pigs/forms/pig-round/idle.png": [0.0625, 0.117188, 0.9375, 0.878906],
    "pigs/forms/pig-fat/idle.png": [0.0625, 0.113281, 0.9375, 0.882812],
    "pigs/forms/pig-king/idle.png": [0.0625, 0.078125, 0.9375, 0.917969],
    "pigs/skins/skin-mint/idle.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/forms/pig-devil/idle.png": [0.0625, 0.09375, 0.9375, 0.902344],
    "pigs/skins/career-astronaut/idle.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/skin-detective/idle.png": [0.0625, 0.074219, 0.9375, 0.925781],
    "pigs/skins/skin-pirate/idle.png": [0.0625, 0.105469, 0.9375, 0.890625],
    "pigs/skins/skin-wizard/idle.png": [0.058594, 0.03125, 0.941406, 0.898438],
    "pigs/base/piglet/eat.png": [0.0625, 0.183594, 0.9375, 0.816406],
    "pigs/base/piglet/play.png": [0.0625, 0.125, 0.9375, 0.871094],
    "pigs/base/piglet/sleep.png": [0.0625, 0.1875, 0.9375, 0.808594],
    "pigs/skins/career-chef/eat.png": [0.066406, 0.0625, 0.929688, 0.9375],
    "pigs/skins/career-chef/play.png": [0.160156, 0.0625, 0.839844, 0.9375],
    "pigs/skins/career-chef/sleep.png": [0.0625, 0.160156, 0.9375, 0.839844],
    "pigs/skins/skin-pirate/eat.png": [0.0625, 0.078125, 0.9375, 0.921875],
    "pigs/skins/skin-pirate/play.png": [0.140625, 0.0625, 0.859375, 0.9375],
    "pigs/skins/skin-pirate/sleep.png": [0.0625, 0.1875, 0.9375, 0.808594],
    "pigs/skins/skin-wizard/eat.png": [0.058594, 0.0625, 0.941406, 0.820312],
    "pigs/skins/skin-wizard/play.png": [0.058594, 0.03125, 0.941406, 0.875],
    "pigs/skins/skin-wizard/sleep.png": [0.058594, 0.046875, 0.941406, 0.8125],
    "pigs/forms/pig-round/eat.png": [0.0625, 0.09375, 0.9375, 0.902344],
    "pigs/forms/pig-round/play.png": [0.0625, 0.070312, 0.9375, 0.925781],
    "pigs/forms/pig-round/sleep.png": [0.0625, 0.195312, 0.9375, 0.800781],
    "pigs/forms/pig-fat/eat.png": [0.0625, 0.152344, 0.9375, 0.84375],
    "pigs/forms/pig-fat/play.png": [0.0625, 0.0625, 0.933594, 0.9375],
    "pigs/forms/pig-fat/sleep.png": [0.0625, 0.207031, 0.9375, 0.789062],
    "pigs/skins/skin-mint/eat.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/skin-mint/play.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/skin-mint/sleep.png": [0.0625, 0.183594, 0.9375, 0.8125],
    "pigs/skins/skin-detective/eat.png": [0.0625, 0.074219, 0.9375, 0.921875],
    "pigs/skins/skin-detective/play.png": [0.140625, 0.0625, 0.859375, 0.9375],
    "pigs/skins/skin-detective/sleep.png": [0.0625, 0.164062, 0.9375, 0.832031],
    "pigs/forms/pig-king/eat.png": [0.0625, 0.0625, 0.9375, 0.9375],
    "pigs/forms/pig-king/sleep.png": [0.0625, 0.164062, 0.9375, 0.832031],
    "pigs/forms/pig-devil/eat.png": [0.0625, 0.148438, 0.9375, 0.851562],
    "pigs/forms/pig-devil/play.png": [0.101562, 0.0625, 0.898438, 0.9375],
    "pigs/forms/pig-devil/sleep.png": [0.0625, 0.1875, 0.9375, 0.808594],
    "pigs/skins/skin-angel/eat.png": [0.066406, 0.0625, 0.929688, 0.9375],
    "pigs/skins/skin-angel/play.png": [0.160156, 0.0625, 0.835938, 0.9375],
    "pigs/skins/skin-angel/sleep.png": [0.0625, 0.195312, 0.9375, 0.804688],
    "pigs/skins/career-astronaut/eat.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/career-astronaut/play.png": [0.113281, 0.0625, 0.882812, 0.9375],
    "pigs/skins/career-astronaut/sleep.png": [0.0625, 0.191406, 0.9375, 0.804688],
    "pigs/forms/pig-king/play.png": [0.097656, 0.0625, 0.898438, 0.9375],
    "pigs/skins/career-chef/pet.png": [0.082031, 0.0625, 0.917969, 0.9375],
    "pigs/skins/career-chef/relaxed.png": [0.066406, 0.0625, 0.929688, 0.9375],
    "pigs/skins/skin-pirate/pet.png": [0.066406, 0.0625, 0.933594, 0.9375],
    "pigs/skins/skin-pirate/relaxed.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/skin-wizard/pet.png": [0.058594, 0.03125, 0.941406, 0.898438],
    "pigs/skins/skin-wizard/relaxed.png": [0.058594, 0.03125, 0.941406, 0.894531],
    "pigs/skins/career-astronaut/pet.png": [0.0625, 0.066406, 0.9375, 0.929688],
    "pigs/skins/career-astronaut/relaxed.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/forms/pig-round/pet.png": [0.0625, 0.121094, 0.9375, 0.878906],
    "pigs/forms/pig-fat/pet.png": [0.09375, 0.0625, 0.902344, 0.9375],
    "pigs/forms/pig-round/relaxed.png": [0.0625, 0.121094, 0.9375, 0.878906],
    "pigs/forms/pig-fat/relaxed.png": [0.0625, 0.113281, 0.9375, 0.882812],
    "pigs/forms/pig-king/pet.png": [0.078125, 0.0625, 0.917969, 0.9375],
    "pigs/forms/pig-king/relaxed.png": [0.0625, 0.078125, 0.9375, 0.917969],
    "pigs/forms/pig-devil/pet.png": [0.0625, 0.105469, 0.9375, 0.890625],
    "pigs/forms/pig-devil/relaxed.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/skins/skin-angel/pet.png": [0.074219, 0.0625, 0.925781, 0.9375],
    "pigs/skins/skin-angel/relaxed.png": [0.0625, 0.0625, 0.933594, 0.9375],
    "pigs/skins/skin-mint/pet.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/skin-detective/pet.png": [0.074219, 0.0625, 0.925781, 0.9375],
    "pigs/skins/skin-detective/relaxed.png": [0.0625, 0.074219, 0.9375, 0.921875],
    "pigs/forms/pig-round/bathe.png": [0.0625, 0.085938, 0.9375, 0.910156],
    "pigs/forms/pig-fat/bathe.png": [0.0625, 0.09375, 0.9375, 0.902344],
    "pigs/base/piglet/bathe.png": [0.0625, 0.183594, 0.9375, 0.816406],
    "pigs/skins/career-chef/bathe.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/skins/skin-pirate/bathe.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/skins/skin-wizard/bathe.png": [0.058594, 0.03125, 0.941406, 0.820312],
    "pigs/skins/skin-detective/bathe.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/forms/pig-king/bathe.png": [0.0625, 0.070312, 0.9375, 0.929688],
    "pigs/skins/skin-mint/bathe.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/career-astronaut/bathe.png": [0.0625, 0.089844, 0.9375, 0.90625],
    "pigs/forms/pig-devil/bathe.png": [0.070312, 0.0625, 0.925781, 0.9375],
    "pigs/skins/skin-angel/bathe.png": [0.070312, 0.0625, 0.925781, 0.9375],
    "pigs/skins/career-chef/study.png": [0.109375, 0.0625, 0.890625, 0.9375],
    "pigs/skins/career-chef/trip.png": [0.085938, 0.0625, 0.914062, 0.9375],
    "pigs/skins/skin-pirate/work.png": [0.0625, 0.125, 0.9375, 0.871094],
    "pigs/skins/skin-pirate/study.png": [0.066406, 0.0625, 0.929688, 0.9375],
    "pigs/skins/skin-pirate/trip.png": [0.0625, 0.105469, 0.9375, 0.894531],
    "pigs/skins/skin-wizard/work.png": [0.058594, 0.070312, 0.941406, 0.726562],
    "pigs/skins/skin-wizard/study.png": [0.058594, 0.03125, 0.941406, 0.976562],
    "pigs/skins/skin-wizard/trip.png": [0.058594, 0.03125, 0.941406, 0.898438],
    "pigs/skins/career-astronaut/work.png": [0.0625, 0.117188, 0.9375, 0.882812],
    "pigs/skins/career-astronaut/study.png": [0.0625, 0.074219, 0.9375, 0.921875],
    "pigs/skins/career-astronaut/trip.png": [0.0625, 0.109375, 0.9375, 0.890625],
    "pigs/skins/career-chef/work.png": [0.0625, 0.074219, 0.9375, 0.925781],
    "pigs/forms/pig-round/work.png": [0.0625, 0.171875, 0.9375, 0.828125],
    "pigs/forms/pig-round/study.png": [0.074219, 0.0625, 0.921875, 0.9375],
    "pigs/forms/pig-round/trip.png": [0.0625, 0.117188, 0.9375, 0.878906],
    "pigs/forms/pig-fat/work.png": [0.0625, 0.175781, 0.9375, 0.820312],
    "pigs/forms/pig-fat/study.png": [0.0625, 0.117188, 0.9375, 0.882812],
    "pigs/forms/pig-fat/trip.png": [0.0625, 0.113281, 0.9375, 0.886719],
    "pigs/forms/pig-king/work.png": [0.0625, 0.128906, 0.9375, 0.867188],
    "pigs/forms/pig-king/study.png": [0.0625, 0.09375, 0.9375, 0.90625],
    "pigs/forms/pig-king/trip.png": [0.066406, 0.0625, 0.929688, 0.9375],
    "pigs/forms/pig-devil/work.png": [0.0625, 0.136719, 0.9375, 0.863281],
    "pigs/forms/pig-devil/study.png": [0.0625, 0.167969, 0.9375, 0.832031],
    "pigs/forms/pig-devil/trip.png": [0.082031, 0.0625, 0.914062, 0.9375],
    "pigs/skins/skin-angel/work.png": [0.0625, 0.085938, 0.9375, 0.914062],
    "pigs/skins/skin-angel/study.png": [0.097656, 0.0625, 0.898438, 0.9375],
    "pigs/skins/skin-angel/trip.png": [0.0625, 0.0625, 0.9375, 0.933594],
    "pigs/skins/skin-detective/work.png": [0.0625, 0.097656, 0.9375, 0.902344],
    "pigs/skins/skin-detective/study.png": [0.085938, 0.0625, 0.914062, 0.9375],
    "pigs/skins/skin-detective/trip.png": [0.0625, 0.066406, 0.9375, 0.929688],
    "pigs/base/elder/idle.png": [0.0625, 0.109375, 0.9375, 0.886719],
    "pigs/forms/pig-devil/fly.png": [0.0625, 0.121094, 0.9375, 0.878906],
    "pigs/base/piglet/work.png": [0.0625, 0.273438, 0.9375, 0.722656],
    "pigs/feedback/allergy.png": [0.0625, 0.113281, 0.9375, 0.886719],
    "pigs/feedback/birthday.png": [0.0625, 0.0625, 0.9375, 0.9375],
    "pigs/feedback/collection-badge.png": [0.0625, 0.070312, 0.9375, 0.929688],
    "pigs/feedback/collection-bubbles.png": [0.0625, 0.113281, 0.9375, 0.886719],
    "pigs/feedback/collection-cage.png": [0.097656, 0.0625, 0.898438, 0.9375],
    "pigs/skins/skin-mint/work.png": [0.0625, 0.242188, 0.9375, 0.753906],
    "pigs/badges/badge-pig-blindbox-first.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-blindbox-six.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-blindbox-ten.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-clean-ten.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-devil.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-farm-first.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-farm-five.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-farm-ten.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-first-class.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-first-fish.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-first-job.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-first-meal.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-first-trip.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-fish-five.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-gacha-first.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-gacha-gold.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-gacha-machines.png": [0.121094, 0.0625, 0.878906, 0.9375],
    "pigs/badges/badge-pig-grown-up.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-jobs-ten.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-king.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-mine-deep.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-mine-first.png": [0.136719, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-mine-fossils.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-pet-hundred.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-play-twenty.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-souvenirs-three.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/badges/badge-pig-trips-ten.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/feedback/collection-check.png": [0.0625, 0.101562, 0.9375, 0.894531],
    "pigs/feedback/collection-chicken.png": [0.101562, 0.0625, 0.898438, 0.9375],
    "pigs/feedback/collection-courier.png": [0.0625, 0.078125, 0.9375, 0.921875],
    "pigs/feedback/collection-fever.png": [0.0625, 0.136719, 0.9375, 0.859375],
    "pigs/feedback/collection-fitness.png": [0.0625, 0.175781, 0.9375, 0.824219],
    "pigs/feedback/collection-letter.png": [0.0625, 0.160156, 0.9375, 0.839844],
    "pigs/feedback/collection-mosquito.png": [0.0625, 0.164062, 0.9375, 0.835938],
    "pigs/feedback/collection-scallion.png": [0.0625, 0.085938, 0.9375, 0.910156],
    "pigs/feedback/collection-snack.png": [0.0625, 0.148438, 0.9375, 0.847656],
    "pigs/feedback/collection-soup.png": [0.101562, 0.0625, 0.894531, 0.9375],
    "pigs/feedback/collection-stack.png": [0.183594, 0.0625, 0.816406, 0.9375],
    "pigs/feedback/collection-taro.png": [0.0625, 0.132812, 0.9375, 0.863281],
    "pigs/feedback/collection-throne.png": [0.089844, 0.0625, 0.910156, 0.9375],
    "pigs/feedback/courier.png": [0.0625, 0.074219, 0.9375, 0.921875],
    "pigs/feedback/faint.png": [0.0625, 0.117188, 0.9375, 0.878906],
    "pigs/feedback/fishing.png": [0.0625, 0.128906, 0.9375, 0.871094],
    "pigs/feedback/ghost-grave.png": [0.0625, 0.136719, 0.9375, 0.863281],
    "pigs/feedback/hungry.png": [0.0625, 0.085938, 0.9375, 0.910156],
    "pigs/feedback/lie-flat.png": [0.0625, 0.15625, 0.9375, 0.84375],
    "pigs/feedback/music-earbuds.png": [0.0625, 0.09375, 0.9375, 0.902344],
    "pigs/feedback/music-headphones-v2.png": [0.0625, 0.164062, 0.9375, 0.835938],
    "pigs/feedback/music-rainbow.png": [0.0625, 0.257812, 0.9375, 0.738281],
    "pigs/feedback/painting.png": [0.0625, 0.097656, 0.9375, 0.898438],
    "pigs/feedback/recruit.png": [0.0625, 0.089844, 0.9375, 0.90625],
    "pigs/feedback/runny-nose.png": [0.078125, 0.0625, 0.921875, 0.9375],
    "pigs/feedback/sleep-cloud.png": [0.0625, 0.179688, 0.9375, 0.816406],
    "pigs/feedback/study-book.png": [0.0625, 0.140625, 0.9375, 0.855469],
    "pigs/feedback/study-determined.png": [0.0625, 0.152344, 0.9375, 0.847656],
    "pigs/feedback/study-pink-book.png": [0.0625, 0.085938, 0.9375, 0.910156],
    "pigs/feedback/suspended.png": [0.183594, 0.0625, 0.8125, 0.9375],
    "pigs/feedback/turning.png": [0.0625, 0.144531, 0.9375, 0.855469],
    "pigs/feedback/twitch.png": [0.0625, 0.136719, 0.9375, 0.859375],
    "pigs/badges/badge-pig-jobs-hundred.png": [0.132812, 0.0625, 0.863281, 0.9375],
    "pigs/feedback/death-day.png": [0.0625, 0.210938, 0.9375, 0.789062],
    "pigs/base/piglet/blink.png": [0.058594, 0.105469, 0.941406, 0.894531],
    "pigs/base/piglet/shy-pet.png": [0.058594, 0.105469, 0.941406, 0.898438]
  });
  var MAX_ART_ASPECT = 1.947826;

  // src/client/art-framing.js
  var FRAME_HEIGHT2 = FRAME_HEIGHT;
  var ART_BOUNDS2 = ART_BOUNDS;
  var MAX_ART_ASPECT2 = MAX_ART_ASPECT;
  function builtinFrame(src) {
    const path = src.slice(ART_URL.length).replace(/^pigs\/no-outline\//, "pigs/");
    const name = path.split("/").pop()?.replace(/\.png$/, "");
    return BUILTIN_FRAMING[path] ?? FEEDBACK_FRAMING[name] ?? null;
  }
  function applyFrame(image, frame3) {
    if (typeof image.style?.setProperty !== "function") return;
    image.style.setProperty("--art-zoom", frame3 ? String(frame3[0]) : "1");
    image.style.setProperty("--art-x", frame3 ? frame3[1] + "%" : "0%");
    image.style.setProperty("--art-y", frame3 ? frame3[2] + "%" : "0%");
  }
  function artMarginFor(width) {
    return Math.max(40, (MAX_ART_ASPECT2 * FRAME_HEIGHT2 - 1) * width / 2 + 6);
  }

  // packages/pet-core/src/data/art-assets.js
  var PIG_ART_ASSETS = Object.freeze({
    "piglet-shy-pet": "pigs/base/piglet/shy-pet.png",
    "piglet-blink": "pigs/base/piglet/blink.png",
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

  // src/client/art-style.js
  function builtinArtPath(key2) {
    return PIG_ART_ASSETS[key2];
  }

  // src/client/art-path.js
  function artSource(key2) {
    return ART_URL + (builtinArtPath(key2) ?? (key2.startsWith("custom-") ? key2 : key2 + ".svg"));
  }
  function hasBuiltinArt(key2) {
    return Object.hasOwn(PIG_ART_ASSETS, key2);
  }

  // src/client/storage.js
  function readStore(key2) {
    try {
      var value = window.localStorage.getItem(key2);
      return value !== null ? value : window.localStorage.getItem(key2.replace(/^dsh-piggy:/, "dsh-pig:"));
    } catch (error) {
      return null;
    }
  }
  function writeStore(key2, value) {
    try {
      window.localStorage.setItem(key2, value);
    } catch (error) {
    }
  }

  // src/client/feel/settings.js
  var FEEL_KEY = "dsh-piggy:feel";
  var SOUND_KEY = "dsh-piggy:sound";
  var FEEL_MODES = Object.freeze(["full", "soft", "off"]);
  var SOUND_VOLUMES = Object.freeze([0, 1, 2]);
  function cleanMode(value) {
    return typeof value === "string" && FEEL_MODES.includes(value) ? value : "full";
  }
  function feelMode() {
    return cleanMode(readStore(FEEL_KEY));
  }
  function setFeelMode(mode) {
    writeStore(FEEL_KEY, cleanMode(mode));
    notifyFeel();
  }
  function prefersReducedMotion() {
    try {
      return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
    } catch {
      return false;
    }
  }
  function effectiveFeelMode() {
    return prefersReducedMotion() ? "off" : feelMode();
  }
  var feelListeners = /* @__PURE__ */ new Set();
  function onFeelModeChange(fn) {
    feelListeners.add(fn);
    return function() {
      feelListeners.delete(fn);
    };
  }
  function notifyFeel() {
    var mode = effectiveFeelMode();
    feelListeners.forEach(function(fn) {
      try {
        fn(mode);
      } catch {
      }
    });
  }
  try {
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("storage", function(event) {
        if (event !== null && event !== void 0 && event.key === FEEL_KEY) notifyFeel();
      });
    }
  } catch {
  }
  function soundSettings() {
    var raw = null;
    try {
      raw = JSON.parse(readStore(SOUND_KEY) || "null");
    } catch {
      raw = null;
    }
    var on = raw !== null && typeof raw === "object" && raw.on === true;
    var volume = raw !== null && typeof raw === "object" && Number.isFinite(raw.volume) ? Math.round(raw.volume) : 2;
    if (!SOUND_VOLUMES.includes(volume)) volume = 2;
    return { on, volume };
  }
  function setSoundSettings(next) {
    var current2 = soundSettings();
    var on = next.on === void 0 ? current2.on : next.on === true;
    var volume = next.volume === void 0 ? current2.volume : Math.round(Number(next.volume));
    if (!SOUND_VOLUMES.includes(volume)) volume = current2.volume;
    writeStore(SOUND_KEY, JSON.stringify({ on, volume }));
    return { on, volume };
  }

  // src/client/pet-hand-settings.js
  var PET_HAND_KEY = "dsh-piggy:pet-hand";
  var listeners = /* @__PURE__ */ new Set();
  function petHandEnabled() {
    return readStore(PET_HAND_KEY) !== "off";
  }
  function setPetHandEnabled(on) {
    writeStore(PET_HAND_KEY, on ? "on" : "off");
    listeners.forEach((fn) => fn());
  }
  function onPetHandChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  if (typeof window !== "undefined") window.addEventListener?.("storage", (event) => {
    if (event.key === PET_HAND_KEY || event.key === null) listeners.forEach((fn) => fn());
  });

  // src/client/pet-snap.js
  var players = /* @__PURE__ */ new WeakMap();
  var SNAP_FRAME_MS = 60;
  var SNAP_FRAMES = 5;
  var PET_SINK_PX = Object.freeze([0, 2, 4, 2, 0]);
  var SNAP_CYCLE_MS = SNAP_FRAME_MS * SNAP_FRAMES;
  function beginPetSnap(pig) {
    return players.get(pig)?.press() === true;
  }
  function releasePetSnap(pig) {
    players.get(pig)?.release();
  }
  function cancelPetSnap(pig) {
    players.get(pig)?.cancel();
  }
  function confirmPetSnap(pig) {
    return players.get(pig)?.confirm() === true;
  }
  function attachPetSnap(c) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext?.("2d");
    const parent = c.pig.querySelector?.(".dp-pig-body");
    if (!ctx || !parent) return { dispose() {
    } };
    canvas.className = "dp-pet-snap";
    canvas.setAttribute("aria-hidden", "true");
    canvas.hidden = true;
    canvas.width = canvas.height = 512;
    const framing = builtinFrame(artSource("piglet")) || [1, 0, 0];
    canvas.style.setProperty("--snap-zoom", String(framing[0]));
    canvas.style.setProperty("--snap-x", framing[1] / 2 + "%");
    canvas.style.setProperty("--snap-y", framing[2] / 2 + "%");
    parent.appendChild(canvas);
    let ready = false, disposed = false, active2 = false, held = false;
    let frame3 = 0, raf3 = 0, start2 = 0, stopAt = Infinity;
    let atlases = null;
    let referenceFrames = [];
    const now2 = () => performance.now();
    const allowed = () => !disposed && !document.hidden && !c.isStopped() && effectiveFeelMode() === "full" && c.canPlay() && c.pig.getAttribute("data-feel-flip") !== "true";
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!atlases) return;
      if (petHandEnabled()) {
        ctx.drawImage(referenceFrames[frame3], 100, 76, 280, 280);
      } else {
        ctx.drawImage(atlases[0], 128, 128 + PET_SINK_PX[frame3], 256, 256);
      }
    }
    function cancel() {
      cancelAnimationFrame(raf3);
      raf3 = 0;
      active2 = held = false;
      c.render();
      canvas.hidden = true;
      c.pig.removeAttribute("data-pet-snap");
    }
    function tick2(time2) {
      raf3 = 0;
      if (!allowed()) {
        cancel();
        return;
      }
      const elapsed = Math.max(0, time2 - start2);
      if (!held && elapsed >= stopAt) {
        if (c.pig.getAttribute("data-react") === "pet") c.pig.removeAttribute("data-react");
        cancel();
        return;
      }
      const next = Math.floor(elapsed / SNAP_FRAME_MS) % SNAP_FRAMES;
      if (next !== frame3) {
        frame3 = next;
        draw();
      }
      raf3 = requestAnimationFrame(tick2);
    }
    function press() {
      if (!ready || !allowed()) return false;
      c.pig.setAttribute("data-pet-snap", "true");
      c.cancelMicro();
      held = active2 = true;
      stopAt = Infinity;
      canvas.hidden = false;
      cancelAnimationFrame(raf3);
      start2 = now2();
      frame3 = 0;
      draw();
      raf3 = requestAnimationFrame(tick2);
      return true;
    }
    function release() {
      if (!active2 || !held) return;
      held = false;
      stopAt = Math.max(1, Math.ceil((now2() - start2) / SNAP_CYCLE_MS)) * SNAP_CYCLE_MS;
    }
    function confirm() {
      if (held && active2) return true;
      if (c.isDragging() || !press()) return false;
      release();
      return true;
    }
    const player = { press, release, cancel, confirm };
    players.set(c.pig, player);
    const load = (src) => {
      const image = new Image();
      image.src = src;
      return image.decode().then(() => image);
    };
    Promise.all([load(artSource("piglet")), load(ART_URL + "animations/piglet-pet/reference.webp?v=original-v07")]).then(async (images) => {
      const frames = await Promise.all(Array.from({ length: SNAP_FRAMES }, (_, i) => createImageBitmap(images[1], i * 112, 0, 112, 112)));
      if (disposed) {
        frames.forEach((image) => image.close());
        return;
      }
      atlases = images;
      referenceFrames = frames;
      ready = true;
    }).catch((error) => console.warn("\u6478\u6478\u52A8\u753B\u52A0\u8F7D\u5931\u8D25\uFF0C\u4FDD\u7559\u9759\u6001\u6478\u6478", error));
    const onState = () => {
      if (active2 && !allowed()) cancel();
    };
    const observer = new MutationObserver(onState);
    observer.observe(c.pig, { attributes: true, childList: true, subtree: true, attributeFilter: ["data-art", "data-stage", "data-mood", "data-idle", "data-activity", "data-illness", "data-party", "data-react", "data-feel-flip"] });
    const offFeel = onFeelModeChange(onState);
    const offHand = onPetHandChange(() => {
      if (active2) draw();
    });
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", onState);
    document.addEventListener("visibilitychange", onState);
    return { dispose() {
      disposed = true;
      observer.disconnect();
      offFeel();
      offHand();
      media?.removeEventListener?.("change", onState);
      document.removeEventListener("visibilitychange", onState);
      cancel();
      canvas.remove();
      atlases = null;
      referenceFrames.forEach((image) => image.close());
      referenceFrames = [];
      players.delete(c.pig);
    } };
  }

  // src/client/pig-actions.js
  var PLAYERS = /* @__PURE__ */ new WeakMap();
  var BLINK_INTERVAL = { min: 8e3, max: 16e3 };
  var ACTION_DURATION = { blink: 100, "shy-pet": 420 };
  var ACTION_ART = { blink: "piglet-blink", "shy-pet": "piglet-shy-pet" };
  function canPlayPigAction(pig, action) {
    const read2 = (name) => pig.getAttribute("data-" + name) || "";
    return read2("art") === "piglet" && !["box", "grave", "dead-day"].includes(read2("stage")) && !read2("activity") && !read2("idle") && !read2("illness") && read2("party") !== "true" && !["sick", "dirty", "sleepy", "dead", "hungry", "lonely"].includes(read2("mood")) && (!read2("react") || action === "shy-pet" && read2("react") === "pet");
  }
  function pigActionArt(pig) {
    return PLAYERS.get(pig)?.currentArt() || null;
  }
  function playPigPet(pig) {
    if (!confirmPetSnap(pig)) PLAYERS.get(pig)?.play("shy-pet");
  }
  function attachPigActions(c) {
    const clock = c.clock || window;
    const random = c.random || Math.random;
    const ready = /* @__PURE__ */ new Set();
    let active2 = null, frameTimer = null, blinkTimer = null, disposed = false;
    const isBlocked = () => disposed || c.isStopped() || c.isDragging() || document.hidden === true || c.pig.closest?.('[data-dragging="true"]') != null;
    const clearFrame = () => {
      clock.clearTimeout(frameTimer);
      frameTimer = null;
      active2 = null;
      c.pig.removeAttribute?.("data-micro-action");
    };
    function currentArt() {
      if (active2 && (isBlocked() || !canPlayPigAction(c.pig, active2))) clearFrame();
      return active2 ? ACTION_ART[active2] : null;
    }
    function play(action) {
      if (isBlocked() || !ready.has(action) || !canPlayPigAction(c.pig, action)) return;
      if (c.pig.getAttribute("data-pet-snap") === "true") return;
      if (action === "blink" && active2) return;
      clearFrame();
      active2 = action;
      c.pig.setAttribute?.("data-micro-action", action);
      c.render();
      frameTimer = clock.setTimeout(() => {
        clearFrame();
        c.render();
      }, ACTION_DURATION[action]);
    }
    function scheduleBlink() {
      clock.clearTimeout(blinkTimer);
      blinkTimer = clock.setTimeout(() => {
        blinkTimer = null;
        if (!isBlocked()) play("blink");
        scheduleBlink();
      }, BLINK_INTERVAL.min + random() * (BLINK_INTERVAL.max - BLINK_INTERVAL.min));
    }
    function cancel() {
      clearFrame();
      clock.clearTimeout(blinkTimer);
      blinkTimer = null;
      c.render();
    }
    function visibility() {
      cancel();
      if (!isBlocked()) scheduleBlink();
    }
    const player = { currentArt, play };
    PLAYERS.set(c.pig, player);
    const preload = c.preload || ((src) => {
      if (typeof Image !== "function") return Promise.resolve(false);
      const image = new Image();
      image.src = src;
      return image.decode().then(() => true);
    });
    for (const action of Object.keys(ACTION_ART)) {
      preload(artSource(ACTION_ART[action])).then((loaded) => {
        if (!disposed && loaded !== false) ready.add(action);
      }).catch((error) => console.error("\u5C0F\u732A\u52A8\u4F5C\u56FE\u7247\u89E3\u7801\u5931\u8D25", action, error));
    }
    document.addEventListener?.("visibilitychange", visibility);
    const gestureTarget = c.pig.parentNode || c.pig;
    gestureTarget.addEventListener?.("pointercancel", visibility);
    gestureTarget.addEventListener?.("lostpointercapture", visibility);
    const observer = typeof MutationObserver === "function" ? new MutationObserver(() => {
      if (active2 && !currentArt()) c.render();
      else if (blinkTimer === null && !isBlocked()) scheduleBlink();
    }) : null;
    observer?.observe(c.pig.parentNode, { attributes: true, subtree: true, attributeFilter: ["data-dragging", "data-art", "data-mood", "data-idle", "data-activity", "data-illness", "data-party", "data-react"] });
    scheduleBlink();
    return {
      cancel,
      dispose() {
        observer?.disconnect();
        disposed = true;
        cancel();
        PLAYERS.delete(c.pig);
        document.removeEventListener?.("visibilitychange", visibility);
        gestureTarget.removeEventListener?.("pointercancel", visibility);
        gestureTarget.removeEventListener?.("lostpointercapture", visibility);
      }
    };
  }

  // src/client/feedback-art.js
  var MOOD_ART = {
    lonely: ["lie-flat"]
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
  var REACTION_ART = {};
  var IDLE_ART = {};
  var WITHDRAWN_FEEDBACK_ART = Object.freeze({
    happy: ["music-rainbow", "collection-stack"],
    feed: ["collection-snack", "collection-soup"],
    bathe: ["collection-bubbles"],
    play: ["collection-chicken", "turning"],
    levelup: ["collection-throne"],
    roll: ["turning", "collection-taro"],
    butterfly: ["collection-chicken", "collection-scallion"],
    look: ["collection-letter"],
    walk: ["collection-chicken", "collection-scallion"],
    trip: ["collection-chicken", "collection-taro", "collection-scallion"]
  });
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
  var TRIP_ART = [];
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
  var UNUSED_FEEDBACK_ART = Object.freeze([
    "collection-badge",
    "collection-check",
    "collection-cage",
    "suspended",
    "twitch",
    // 2026-10-21：脏和饿保留原猪，苍蝇和食物想象泡独立显示。
    "collection-mosquito",
    "hungry",
    // 2026-10-18：困了/睡着改用当前皮肤自己的 sleep 图，不再用这张反馈图。
    "sleep-cloud"
  ]);
  function choose(options, hour) {
    return options[Math.abs(Math.floor(hour)) % options.length];
  }
  function feedbackArtFor(state3) {
    if (STAGE_ART[state3.stage]) return choose(STAGE_ART[state3.stage], state3.hour);
    if (state3.party === true) return BIRTHDAY_ART;
    if (state3.base && state3.base !== "piglet") return null;
    if (REACTION_ART[state3.reaction]) return choose(REACTION_ART[state3.reaction], state3.hour);
    if (state3.mood === "sick") return ILLNESS_ART[state3.illness ?? ""] ? choose(ILLNESS_ART[state3.illness ?? ""], state3.hour) : null;
    if (state3.mood === "dirty" || state3.mood === "hungry") return null;
    if (state3.activityKind === "work") return WORK_ART[state3.activityKey] ?? null;
    if (state3.activityKind === "study") return choose(STUDY_ART, state3.hour);
    if (state3.activityKind === "interest") return choose(INTEREST_ART[state3.activityKey] ?? INTEREST_ART.other, state3.hour);
    if (state3.activityKind === "fishing") return "fishing";
    if (state3.activityKind === "trip") return TRIP_ART.length ? choose(TRIP_ART, state3.hour) : null;
    if (IDLE_ART[state3.idle]) return choose(IDLE_ART[state3.idle], state3.hour);
    if (MOOD_ART[state3.mood]) return choose(MOOD_ART[state3.mood], state3.hour);
    return null;
  }

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
  var ART_SELECTION = /* @__PURE__ */ new WeakMap();
  function frameCustomImage(image, src, sleep = false) {
    if (!src.includes("/custom-")) {
      applyFrame(image, builtinFrame(src));
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
        const context2 = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context2) return;
        const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / (image.naturalHeight || image.naturalWidth));
        const width = image.naturalWidth * fit, height = (image.naturalHeight || image.naturalWidth) * fit;
        context2.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        const pixels = context2.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
        for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] <= 16) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
        if (right <= left || bottom <= top) return;
        const zoom = FRAME_HEIGHT2 / ((bottom - top) / canvas.height);
        const frame3 = [
          zoom,
          (0.5 - (left + right) / (2 * canvas.width)) * zoom * 100,
          (0.5 - (top + bottom) / (2 * canvas.height)) * zoom * 100
        ];
        CUSTOM_FRAME_CACHE.set(src, frame3);
        applyFrame(image, frame3);
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
  var effectArt = null;
  function showEffectArt(name) {
    effectArt = typeof name === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(name) ? name : null;
  }
  function clearEffectArt() {
    effectArt = null;
  }
  var artSwapHook = null;
  function setArtSwapHook(hook) {
    artSwapHook = typeof hook === "function" ? hook : null;
  }
  function swapSource(apply) {
    if (artSwapHook === null) apply();
    else artSwapHook(apply);
  }
  function forceFeedbackArt(name) {
    forcedFeedback = typeof name === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(name) ? name : null;
  }
  function syncPigArt(pig, image, emoji) {
    const selection = {};
    ART_SELECTION.set(image, selection);
    const applySelected = (apply) => swapSource(() => {
      if (ART_SELECTION.get(image) === selection) apply();
    });
    var base = pig.getAttribute("data-art") || "";
    pigActionArt(pig);
    var feedback = forcedFeedback || effectArt || feedbackArtFor({
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
      if (image.getAttribute("src") !== feedbackSrc) {
        applySelected(function() {
          image.src = feedbackSrc;
          applyFrame(image, builtinFrame(feedbackSrc));
        });
      }
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
    var microArt = pigActionArt(pig);
    if (microArt && !forcedFeedback) {
      var microSrc = artSource(microArt);
      if (image.getAttribute("src") !== microSrc) {
        applySelected(function() {
          image.src = microSrc;
          applyFrame(image, builtinFrame(artSource("piglet")));
        });
      }
      image.hidden = false;
      pig.setAttribute("data-feedback", "false");
      if (emoji) emoji.hidden = true;
      return true;
    }
    var art = base;
    if (pig.getAttribute("data-art-actions") === "true" || base === "piglet") {
      var action = REACTION_ART2[pig.getAttribute("data-react")] || ACTIVITY_ART[pig.getAttribute("data-activity")];
      var scenes = String(pig.getAttribute("data-art-scenes") || "").split(",");
      if (action && (base === "piglet" || scenes[0] === "" || scenes.indexOf(action) >= 0) && (base.startsWith("custom-") || hasBuiltinArt(base + "-" + action))) art += "-" + action;
    }
    var src = artSource(art);
    if (image.getAttribute("src") !== src) {
      applySelected(function() {
        image.src = src;
        frameCustomImage(image, src);
      });
    }
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
    for (var key2 in attrs) node.setAttribute(key2, attrs[key2]);
    node.addEventListener("click", function(event) {
      event.stopPropagation();
      onClick(event);
    });
    return node;
  }
  function meter(value, variant) {
    var wrap2 = el("div", "dp-meter" + (variant ? " " + variant : ""));
    var fill = document.createElement("i");
    fill.style.width = Math.max(0, Math.min(100, num(value, 0))) + "%";
    wrap2.appendChild(fill);
    return wrap2;
  }
  function sideScroller(strip, active2) {
    if (typeof strip.addEventListener === "function") {
      strip.addEventListener("wheel", function(event) {
        if (strip.scrollWidth <= strip.clientWidth) return;
        var delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (delta === 0) return;
        strip.scrollLeft += delta;
        event.preventDefault();
      }, { passive: false });
    }
    if (active2 && typeof active2.offsetLeft === "number") {
      strip.scrollLeft = Math.max(0, active2.offsetLeft - (strip.clientWidth - active2.offsetWidth) / 2);
    }
  }

  // src/client/render-hold.js
  function createRenderHold(card2, environment = window) {
    const active2 = /* @__PURE__ */ new Set();
    let pending2 = null;
    let frame3 = null;
    let isDisposed = false;
    function schedule4() {
      if (active2.size || !pending2 || frame3 !== null || isDisposed) return;
      frame3 = environment.requestAnimationFrame(() => {
        frame3 = null;
        if (active2.size || !pending2 || isDisposed) return;
        const render = pending2;
        pending2 = null;
        render();
      });
    }
    function down(event) {
      if (event.button === 0) active2.add(event.pointerId);
    }
    function up(event) {
      active2.delete(event.pointerId);
      schedule4();
    }
    function blur() {
      active2.clear();
      schedule4();
    }
    card2.addEventListener("pointerdown", down, true);
    environment.addEventListener?.("pointerup", up, true);
    environment.addEventListener?.("pointercancel", up, true);
    environment.addEventListener?.("blur", blur);
    return {
      /** 已经有完整的新快照，但按键还没松开时只保留一次最新重绘。 */
      defer(render) {
        if (active2.size) {
          pending2 = render;
          return true;
        }
        pending2 = null;
        if (frame3 !== null) environment.cancelAnimationFrame(frame3);
        frame3 = null;
        return false;
      },
      dispose() {
        isDisposed = true;
        active2.clear();
        pending2 = null;
        if (frame3 !== null) environment.cancelAnimationFrame(frame3);
        card2.removeEventListener("pointerdown", down, true);
        environment.removeEventListener?.("pointerup", up, true);
        environment.removeEventListener?.("pointercancel", up, true);
        environment.removeEventListener?.("blur", blur);
      }
    };
  }

  // src/client/effects.js
  function createEffects(deps) {
    var scene6 = deps.scene;
    var pig = deps.pig;
    var card2 = deps.card;
    var bubble = deps.bubble;
    var pomoHint = deps.pomoHint ?? null;
    var isStopped = deps.isStopped;
    var reactTimer = null;
    var feelHooks = null;
    var bubbleTimer = null;
    var replyHold = null;
    var bubbleVersion = 0;
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
    var JUMP_KINDS = { levelup: true, away: true, feed: true, play: true };
    function applyReact(kind, ms) {
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
    function react(kind, ms) {
      if (reactTimer !== null) window.clearTimeout(reactTimer);
      if (feelHooks !== null && JUMP_KINDS[kind] === true) {
        feelHooks.crouch(120);
        reactTimer = window.setTimeout(function() {
          applyReact(kind, ms);
        }, 120);
        return;
      }
      applyReact(kind, ms);
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
            scene6.appendChild(node);
            window.setTimeout(function() {
              node.remove();
            }, 1200);
          }, index * 110);
        })(i);
      }
    }
    function headSpot() {
      var fallback = { x: 24, y: 8 };
      if (typeof pig.getBoundingClientRect !== "function" || typeof scene6.getBoundingClientRect !== "function") return fallback;
      var p = pig.getBoundingClientRect();
      var s = scene6.getBoundingClientRect();
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
    function resetBubble() {
      bubbleVersion += 1;
      if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
      bubbleTimer = null;
      if (replyHold !== null) replyHold.dispose();
      replyHold = null;
      return bubbleVersion;
    }
    function expireBubble(version, restorePomo) {
      if (version !== bubbleVersion) return;
      var close = function() {
        if (version !== bubbleVersion) return;
        bubble.hidden = true;
        if (replyHold !== null) replyHold.dispose();
        replyHold = null;
        if (restorePomo && pomoHint !== null) pomoHint.hidden = pomoHint.getAttribute("data-pomo") !== "on";
      };
      if (replyHold !== null && replyHold.defer(close)) return;
      close();
    }
    function showBubble(text, ms) {
      var version = resetBubble();
      bubble.setAttribute("data-bubble-shown", "true");
      bubble.textContent = "";
      bubble.appendChild(el("span", "dp-bubble-text", text));
      bubble.hidden = false;
      if (pomoHint !== null) pomoHint.hidden = true;
      bubbleTimer = window.setTimeout(function() {
        if (version !== bubbleVersion) return;
        bubbleTimer = null;
        expireBubble(version, true);
      }, ms || 2600);
    }
    function showLine(text, replies, onReply, ms) {
      if (replies.length === 0) {
        showBubble(text, ms || 2600);
        return;
      }
      var version = resetBubble();
      bubble.textContent = "";
      bubble.appendChild(el("span", "dp-bubble-text", text));
      var row = el("div", "dp-bubble-replies", "");
      replyHold = createRenderHold(row);
      replies.forEach(function(label, index) {
        var answer = el("button", "dp-reply", label);
        answer.type = "button";
        answer.addEventListener("click", function(event) {
          event.stopPropagation();
          if (version !== bubbleVersion || bubble.hidden) return;
          resetBubble();
          bubble.hidden = true;
          onReply(index);
        });
        row.appendChild(answer);
      });
      bubble.appendChild(row);
      bubble.hidden = false;
      bubbleTimer = window.setTimeout(function() {
        if (version !== bubbleVersion) return;
        bubbleTimer = null;
        expireBubble(version, false);
      }, Math.max(6e3, ms || 0));
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
      resetBubble();
      if (transformTimer !== null) window.clearTimeout(transformTimer);
      if (transformLayer !== null) transformLayer.remove();
      reactTimer = null;
      bubbleTimer = null;
      transformTimer = null;
      transformLayer = null;
    }
    return {
      react,
      burst,
      transform,
      flash,
      showBubble,
      showLine,
      toast,
      dispose,
      /** 物理层装好后由 shell 接上；关闭手感时传 null。 */
      setFeel: function(feel2) {
        feelHooks = feel2;
      }
    };
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
      var now2 = Date.now();
      if (p && p !== seen) {
        seen = p;
        endsAt = resync(endsAt, p.active ? now2 + p.secondsLeft * 1e3 : 0);
        breakEndsAt = resync(breakEndsAt, !p.active && p.breakSecondsLeft > 0 ? now2 + p.breakSecondsLeft * 1e3 : 0);
      }
      if (endsAt > 0) {
        var left = Math.max(0, Math.ceil((endsAt - now2) / 1e3));
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
        var rest = Math.max(0, Math.ceil((breakEndsAt - now2) / 1e3));
        var note2 = content.querySelector("[data-pomo-break]");
        if (note2 !== null) note2.textContent = "\u2615 \u4F11\u606F " + clockText(rest) + "\uFF08\u4E5F\u53EF\u4EE5\u76F4\u63A5\u5F00\u4E0B\u4E00\u4E2A\uFF09";
        if (rest === 0) breakEndsAt = 0;
      }
    }
    var timer2 = window.setInterval(tick2, 1e3);
    return { tick: tick2, dispose: function() {
      window.clearInterval(timer2);
    } };
  }

  // src/client/poll-key.js
  var VIEW_RULES = {
    farm: {
      now: function(ms) {
        return Math.floor(ms / 36e5);
      },
      remainingMs: function(ms) {
        return Math.ceil(ms / 6e4);
      },
      progress: function(percent2) {
        return Math.round(percent2 * 100);
      },
      usedHours: function() {
        return 0;
      }
    }
  };
  function fold(value, rules) {
    if (Array.isArray(value)) return value.map(function(item) {
      return fold(item, rules);
    });
    if (value === null || typeof value !== "object") return value;
    var out = {};
    for (var key2 in value) {
      var rule = rules[key2];
      out[key2] = rule !== void 0 && typeof value[key2] === "number" ? rule(value[key2]) : fold(value[key2], rules);
    }
    return out;
  }
  function foldViews(views) {
    if (views === null || typeof views !== "object") return views;
    var out = {};
    for (var key2 in views) out[key2] = VIEW_RULES[key2] ? fold(views[key2], VIEW_RULES[key2]) : views[key2];
    return out;
  }
  function pollKey(snapshot) {
    if (snapshot === null || typeof snapshot !== "object") return String(snapshot);
    var copy = Object.assign({}, snapshot);
    copy.extViews = foldViews(snapshot.extViews);
    return JSON.stringify(copy);
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
    var paintedKey = null;
    var actionTail = Promise.resolve(null);
    var pendingExtensions = 0;
    function send2(action, extra, options) {
      if (action === "touch") return perform(action, extra, { background: true });
      if (action === "ext") {
        pendingExtensions += 1;
        var queued = actionTail.then(function() {
          return perform(action, extra);
        });
        actionTail = queued.catch(function() {
          return null;
        });
        return queued.finally(function() {
          pendingExtensions -= 1;
        });
      }
      if (ctx.busy || pendingExtensions > 0) return Promise.resolve(null);
      var running = perform(action, extra, options);
      actionTail = running.catch(function() {
        return null;
      });
      return running;
    }
    async function perform(action, extra, options) {
      var background = options?.background === true;
      if (ctx.busy && !background || ctx.stopped) return null;
      if (ctx.view.pig === null && action !== "hatch") return null;
      var seq2 = ++actionSeq;
      if (!background) {
        ctx.busy = true;
        ctx.flash(action, extra);
      }
      try {
        var body = { action };
        if (extra) for (var k in extra) body[k] = extra[k];
        var res = await fetch(ACT_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        var next = await res.json();
        if (background && seq2 !== actionSeq) return next;
        if (action === "buy" && next?.ok === true) ctx.justBought = extra?.item ?? null;
        paintedKey = null;
        ctx.render(next);
        if (action === "pet" && next?.ok === true && options?.petAnimated !== true) ctx.petShy?.();
        if ((action === "signIn" || action === "openGift") && next?.ok === true && !(Array.isArray(next.pending) && next.pending.some(function(event) {
          return event.kind === "gift";
        }))) {
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
            "no-edits": "\u6539\u7B80\u4ECB\u7684\u673A\u4F1A\u5DF2\u7ECF\u7528\u8FC7\u4E86",
            "bad-date": "\u6CA1\u6709\u8FD9\u4E00\u5929",
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
            "body-locked": "\u80D6\u7626\u5DF2\u9501\u5B9A\uFF0C\u5148\u559D\u521D\u59CB\u836F\u6C34\u89E3\u9664",
            "body-unlocked": "\u80D6\u7626\u6CA1\u6709\u9501\u5B9A\uFF0C\u4E0D\u6D88\u8017\u521D\u59CB\u836F\u6C34",
            "body-already-locked": "\u5DF2\u7ECF\u9501\u5B9A\uFF0C\u4E0D\u91CD\u590D\u6D88\u8017\u836F\u6C34",
            "body-already": "\u5DF2\u7ECF\u662F\u8FD9\u4E2A\u4F53\u578B\uFF0C\u4E0D\u91CD\u590D\u6D88\u8017\u836F\u6C34",
            "body-hidden": "\u6362\u56DE\u666E\u901A\u5F62\u6001\u548C\u9ED8\u8BA4\u76AE\u80A4\u540E\u518D\u4F7F\u7528",
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
        if (!background) ctx.busy = false;
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
        var key2 = pollKey(next);
        if (key2 !== paintedKey) {
          try {
            paintedKey = ctx.render(next) === false ? null : key2;
          } catch (error) {
            paintedKey = null;
            throw error;
          }
        }
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
    return role2 === "pet" || role2 === "panel" || role2 === "ext" ? role2 : null;
  }

  // src/client/desktop/panel-window.js
  var PANEL_CSS = [
    "html,body{margin:0;padding:0;background:transparent;overflow:hidden}",
    '[data-piggy-role="panel"] [data-dsh-pig]{position:absolute!important;inset:auto!important;right:0!important;bottom:0!important;width:max-content!important;',
    // 名牌在 DOM 里排在卡片前面：面板在猪上方时名牌放底下（靠猪），在猪下方时放上面。
    "height:auto!important;display:flex!important;flex-direction:column-reverse;gap:6px;align-items:flex-end;pointer-events:auto!important;transform:none!important}",
    '[data-piggy-role="panel"] [data-dsh-pig][data-panel-vertical="below"]{flex-direction:column;top:0!important;bottom:auto!important}',
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
    const key2 = width + "x" + height;
    if (key2 === lastSize) return;
    lastSize = key2;
    shell.panel.size(width, height, true);
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
      saves: bridge3.saves,
      ext: bridge3.ext,
      fullscreen: bridge3.fullscreen,
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
      const strings = (key2) => arr(entry[key2]).filter((item) => typeof item === "string");
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
        assets: strings("assets"),
        assetLayout: obj(entry.assetLayout),
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
      var vw2 = window.innerWidth || 0;
      var vh2 = window.innerHeight || 0;
      if (vw2 <= 0 || vh2 <= 0) return;
      var pigRect = ctx.pig.getBoundingClientRect ? ctx.pig.getBoundingClientRect() : null;
      var w = (pigRect ? pigRect.width || 0 : 0) + 2 * PIG_PADDING_X;
      var sceneRect = ctx.scene.getBoundingClientRect ? ctx.scene.getBoundingClientRect() : null;
      var h = Math.max(sceneRect ? sceneRect.height || 0 : 0, SCENE_RESERVE);
      var right = Math.min(Math.max(4, ctx.userRight), Math.max(4, vw2 - w - 4));
      var bottom = Math.min(Math.max(4, ctx.userBottom), Math.max(4, vh2 - h - 4));
      ctx.host.style.right = Math.round(right) + "px";
      ctx.host.style.bottom = Math.round(bottom) + "px";
    }
    function fitPanel() {
      if (!ctx.isOpen) return;
      if (desktopRole() === "panel") {
        fitPanelWindow(ctx);
        return;
      }
      if (desktopRole() === "pet" || desktopRole() === "ext") return;
      if (desktopShell() !== null) return;
      var vw2 = window.innerWidth || 0;
      var vh2 = window.innerHeight || 0;
      if (vw2 <= 0 || vh2 <= 0) return;
      var rect = ctx.scene.getBoundingClientRect();
      var roomAbove = rect.top - PANEL_GAP - PANEL_MARGIN;
      var roomBelow = vh2 - rect.bottom - PANEL_GAP - PANEL_MARGIN;
      if (roomAbove >= roomBelow) {
        ctx.card.style.top = "auto";
        ctx.card.style.bottom = "calc(100% + " + PANEL_GAP + "px)";
        ctx.card.style.maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(roomAbove))) + "px";
      } else {
        ctx.card.style.bottom = "auto";
        ctx.card.style.top = "calc(100% + " + PANEL_GAP + "px)";
        ctx.card.style.maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(roomBelow))) + "px";
      }
      var width = Math.min(PANEL_WIDTH, vw2 - 2 * PANEL_MARGIN);
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
  var URGENT_KINDS = ["sick", "worse", "death", "cured", "revived", "weak"];
  function processPending(ctx, showPigLine) {
    var role2 = desktopRole();
    var pigSide = role2 !== "panel" && role2 !== "ext";
    var cardSide = role2 !== "pet" && role2 !== "ext";
    var offlineSummary = null;
    var rewards = [];
    var rewardLine = null;
    var hasReward = pigSide && ctx.view.pending.some(function(event2) {
      return event2.kind === "gift" && (event2.id > 0 ? event2.id > ctx.lastPendingId : event2.at > ctx.lastPendingAt);
    });
    for (var i = 0; i < ctx.view.pending.length; i += 1) {
      var event = ctx.view.pending[i];
      if (event.id > 0 ? event.id <= ctx.lastPendingId : event.at <= ctx.lastPendingAt) continue;
      if (event.id > 0) ctx.lastPendingId = event.id;
      ctx.lastPendingAt = Math.max(ctx.lastPendingAt, event.at);
      if (event.kind === "line") {
        if (pigSide) {
          if (hasReward) rewardLine = event;
          else showPigLine(event);
        }
        continue;
      }
      if (event.kind === "gift") {
        if (pigSide) rewards.push(str(event.text, ""));
        continue;
      }
      if (ctx.view.dialogue.quiet && URGENT_KINDS.indexOf(event.kind) < 0) continue;
      if (event.kind === "achievement" || event.kind === "interest") {
        if (pigSide) showMilestoneNotice(ctx, event);
        continue;
      }
      if (cardSide) ctx.toast(str(event.text, "\u732A\u6709\u65B0\u6D88\u606F"));
      if (pigSide && event.kind === "offline-food") offlineSummary = event.text;
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
    if (hasReward && rewards.length > 0) {
      var receipt = rewards.join("\uFF1B");
      if (rewardLine !== null) showPigLine({ ...rewardLine, text: receipt + " \xB7 " + rewardLine.text, displayMs: 4e3 });
      else ctx.showBubble(receipt, 4e3);
      return;
    }
    if (offlineSummary !== null && (role2 === "pet" || !ctx.isOpen)) ctx.showBubble(offlineSummary, 8e3);
    else if (pigSide) ctx.updateNotice?.maybeBubble();
  }

  // src/client/auto-collapse.js
  var AUTO_COLLAPSE_KEY = "dsh-piggy:auto-collapse";
  function autoCollapseEnabled() {
    return readStore(AUTO_COLLAPSE_KEY) !== "false";
  }
  function setAutoCollapse(enabled) {
    writeStore(AUTO_COLLAPSE_KEY, enabled ? "true" : "false");
  }
  function attachAutoCollapse(context2) {
    function focusedInput() {
      const active2 = document.activeElement;
      const tag2 = active2?.tagName?.toLowerCase?.() ?? "";
      return tag2 === "input" || tag2 === "textarea" || active2?.getAttribute?.("contenteditable") === "true";
    }
    function canClose() {
      return context2.isOpen() && autoCollapseEnabled() && !context2.isDragging() && !focusedInput() && !context2.isFishing();
    }
    function onOutsidePointer(event) {
      if (!canClose() || event.button !== 0) return;
      for (let node = event.target; node !== null && node !== void 0; node = node.parentNode) {
        if (node === context2.host) return;
      }
      context2.setOpen(false);
    }
    function onWindowBlur() {
      if (context2.isDesktop() && desktopRole() !== "panel" && canClose()) context2.setOpen(false);
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
  function surgeOf(s, feel2, now2, dt) {
    if ((s.burstLeft || 0) > 0) s.burstLeft -= dt;
    else if (feel2.burst > 0 && Math.random() < feel2.burst * dt / 16) s.burstLeft = 260 + Math.random() * 240;
    const wobble = 1 + feel2.jitter * Math.sin(now2 / 380 + (s.phase || 0));
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
    const wrap2 = button("dp-fish-qte", {
      "data-fish-qte": "true",
      "data-fish-fight": "ring",
      "data-qte-difficulty": String(fish3.difficulty),
      "data-qte-needed": String(s.hitsNeeded),
      "aria-label": "\u9493\u9C7C\u6280\u80FD\u68C0\u5B9A\uFF0C\u6307\u9488\u8FDB\u5165\u7EFF\u8272\u533A\u57DF\u65F6\u70B9\u51FB"
    }, function(event) {
      if (event.detail > 0 && event.timeStamp - lastPointerAt < 700) return;
      hit(event);
    });
    wrap2.addEventListener("pointerdown", function(event) {
      lastPointerAt = event.timeStamp;
      hit(event);
    });
    const ring = el("div", "dp-fish-qte-ring");
    const needle = el("i", "dp-fish-qte-needle");
    const score = el("b", "dp-fish-qte-score");
    const feedback = el("span", "dp-fish-qte-feedback");
    ring.appendChild(needle);
    ring.appendChild(el("span", "dp-fish-qte-core", fish3.emoji));
    wrap2.appendChild(el("div", "dp-fish-qte-title", fish3.emoji + "\u3000\u54AC\u7D27\u4E86\uFF01"));
    wrap2.appendChild(ring);
    wrap2.appendChild(score);
    wrap2.appendChild(feedback);
    wrap2.appendChild(el("div", "dp-fish-help", "\u6307\u9488\u8FDB\u5165\u7EFF\u8272\u533A\u57DF\u65F6\u70B9\u51FB\u6216\u6309\u7A7A\u683C \xB7 \u9EC4\u8272\u4E3A\u5B8C\u7F8E\u5224\u5B9A"));
    wrap2.setAttribute("tabindex", "0");
    ui.content.appendChild(wrap2);
    function paint() {
      const angle = s.angle % 360;
      const perfectEnd = s.zoneStart + s.perfectDegrees;
      const zoneEnd = s.zoneStart + s.zoneDegrees;
      ring.style.background = `conic-gradient(from 0deg,#dce8e9 0deg ${s.zoneStart}deg,#ffd45d ${s.zoneStart}deg ${perfectEnd}deg,#6bd47b ${perfectEnd}deg ${zoneEnd}deg,#dce8e9 ${zoneEnd}deg 360deg)`;
      needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
      score.textContent = `\u6280\u80FD\u68C0\u5B9A ${Math.min(s.hits, s.hitsNeeded)} / ${s.hitsNeeded}`;
      feedback.textContent = `${s.feedback} \xB7 \u673A\u4F1A ${"\u2665".repeat(3 - s.misses)}${"\u2661".repeat(s.misses)}`;
      wrap2.setAttribute("data-qte-angle", angle.toFixed(1));
      wrap2.setAttribute("data-qte-zone-start", s.zoneStart.toFixed(1));
      wrap2.setAttribute("data-qte-zone-size", String(s.zoneDegrees));
      wrap2.setAttribute("data-qte-misses", String(s.misses));
      wrap2.setAttribute("data-qte-speed", String(s.rotationsPerSecond));
      wrap2.setAttribute("data-qte-feedback", s.feedback);
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
    function tick2(now2) {
      if (!stillOpen(ui)) return finish(false);
      if (!s.startedAt) s.startedAt = now2;
      const dt = s.last ? Math.min(50, now2 - s.last) : 16;
      s.last = now2;
      if (!s.locked) s.angle += dt * s.rotationsPerSecond * 0.36 * surgeOf(s, feel2, now2, dt);
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
    function moveFish(dt, now2) {
      s.wait -= dt;
      if (s.wait <= 0) {
        const calm = fish3.behavior === "smooth";
        const target = s.fishY + (Math.random() - 0.5) * (calm ? 90 : 60 + d * 1.6) * feel2.speed + feel2.drift * 1.2;
        s.target = Math.max(8, Math.min(BAR_HEIGHT - 8, target));
        s.wait = (calm ? 900 : Math.max(250, 900 - d * 6)) / feel2.speed;
      }
      s.fishY += (s.target - s.fishY) * Math.min(1, dt * (18e-4 + d * 5e-5) * surgeOf(s, feel2, now2, dt));
    }
    function tick2(now2) {
      if (!stillOpen(ui)) return finish(false);
      const dt = s.last ? Math.min(50, now2 - s.last) : 16;
      s.last = now2;
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
      moveFish(dt, now2);
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
    const line6 = el("div", "dp-fish-line");
    const rod = el("span", "dp-fish-rod", "\u{1F3A3}");
    line6.appendChild(rod);
    line6.appendChild(el("span", "dp-fish-string", "\u3030\u3030\u3030"));
    line6.appendChild(el("span", "dp-fish-rod", fish3.emoji));
    const gauge = el("div", "dp-fish-gauge");
    gauge.style.background = `linear-gradient(90deg,#dce8e9 0 30%,#6bd47b 30% ${snap - 13}%,#ffd45d ${snap - 13}% ${snap}%,#e05a5a ${snap}%)`;
    const pin = el("b");
    gauge.appendChild(pin);
    const state3 = el("div", "dp-fish-pull-state");
    const meter2 = el("div", "dp-fish-hmeter");
    const fill = el("i");
    meter2.appendChild(fill);
    stage2.appendChild(el("div", "dp-fish-qte-title", fish3.emoji + "\u3000\u54AC\u7D27\u4E86\uFF01"));
    stage2.appendChild(line6);
    stage2.appendChild(gauge);
    stage2.appendChild(state3);
    stage2.appendChild(meter2);
    stage2.appendChild(el("div", "dp-fish-help", "\u6309\u4F4F\uFF08\u6216\u7A7A\u683C\uFF09\u6536\u7EBF\uFF0C\u677E\u5F00\u653E\u7EBF \xB7 \u9C7C\u53D1\u529B\u65F6\u677E\u4E00\u677E"));
    ui.content.appendChild(stage2);
    holdControls(stage2, s);
    function tick2(now2) {
      if (!stillOpen(ui)) return finish(false);
      const dt = s.last ? Math.min(50, now2 - s.last) : 16;
      s.last = now2;
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
      state3.textContent = (s.surge > 2 ? fish3.emoji + " \u53D1\u529B\u4E86\uFF01" : s.tension < 30 ? "\u592A\u677E\u4E86\uFF01" : s.tension >= snap ? "\u8981\u65AD\u4E86\uFF01" : sweet ? "\u7A33\uFF01\u6536\u5F97\u5FEB" : "\u6536\u7EBF\u4E2D") + " \xB7 \u79BB\u5CB8 " + Math.max(0, s.distance).toFixed(0) + " \u7C73";
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
    const owned = (key2) => ui.view.inventory[key2] ?? 0;
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
    const auto2 = el("details", "dp-fish-auto");
    if (autoOpen) auto2.setAttribute("open", "");
    auto2.addEventListener("toggle", function() {
      autoOpen = auto2.open === true;
    });
    auto2.appendChild(el("summary", null, "\u{1F437} \u8BA9\u732A\u81EA\u5DF1\u53BB\u9493"));
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
    auto2.appendChild(row);
    for (const upgrade of automation2?.upgrades ?? []) {
      const buy = button("dp-mini", { "data-fish-upgrade": upgrade.kind }, () => ui.send("fishAutomation", { kind: upgrade.kind }));
      buy.textContent = upgrade.label + " \u{1FA99} " + upgrade.price;
      buy.disabled = (ui.view.pig?.coins ?? 0) < upgrade.price;
      auto2.appendChild(buy);
    }
    if (reasons.length > 0) auto2.appendChild(el("span", "dp-fish-why", "\u70B9\u4E0D\u4E86\uFF1A" + reasons[0] + "\u3002"));
    ui.content.appendChild(auto2);
  }
  function renderAutoStock(ui) {
    const automation2 = ui.view.fishing.automation;
    if (!automation2 || !automation2.unlocked && automation2.stored === 0 && automation2.usedHours === 0) return;
    const row = el("div", "dp-fish-rodrow");
    row.appendChild(el("span", null, "\u{1F9FA} " + (automation2.full ? automation2.stored > 0 ? "\u9C7C\u7BD3\u6EE1\u4E86" : "\u9493\u9C7C\u6B47\u4E86" : "\u9C7C\u7BD3") + " " + automation2.usedHours.toFixed(1) + " / 6 \u5C0F\u65F6"));
    const collect = button("dp-mini", { "data-fish-collect": "true" }, () => ui.send("fishCollect"));
    collect.textContent = automation2.stored > 0 ? "\u6536\u4E00\u4E0B" : automation2.full ? "\u63A5\u7740\u5E72" : "\u6682\u65E0\u6536\u6210";
    collect.disabled = automation2.stored === 0 && !automation2.full;
    row.appendChild(collect);
    ui.content.appendChild(row);
  }
  function renderWaiting(ui, pending2) {
    const water = button("dp-fish-waiting", { "data-fish": "hook" }, function() {
      if (Date.now() < pending2.bitesAt) {
        line6.textContent = nibbleUntil > Date.now() ? "\u53EA\u662F\u8BD5\u63A2\uFF0C\u8FD8\u6CA1\u54AC\u5B9E\u2026" : "\u8FD8\u6CA1\u4E0A\u94A9\uFF0C\u7EE7\u7EED\u7B49\u2026";
        return;
      }
      ui.send("fishHook");
    });
    let nextNibble = Date.now() + 1500 + Math.random() * 2500;
    let nibbleUntil = 0;
    const mark = el("span", "dp-fish-bobber", "\u{1F3A3}");
    const line6 = el("b", null, "\u5B89\u9759\u7B49\u9C7C\u54AC\u94A9\u2026");
    water.appendChild(mark);
    water.appendChild(line6);
    ui.content.appendChild(water);
    waitUi = ui;
    function tick2() {
      if (waitUi !== ui) return;
      const now2 = Date.now();
      if (now2 < pending2.bitesAt - 900 && now2 >= nextNibble) {
        nibbleUntil = now2 + 420;
        nextNibble = now2 + 1800 + Math.random() * 3200;
        water.setAttribute("data-nibble", "true");
        line6.textContent = Math.random() < 0.5 ? "\u6D6E\u6F02\u52A8\u4E86\u4E00\u4E0B\u2026" : "\u5495\u561F\uFF0C\u5192\u4E86\u4E2A\u6CE1\u2026";
      } else if (nibbleUntil > 0 && now2 > nibbleUntil + 900) {
        nibbleUntil = 0;
        water.setAttribute("data-nibble", "false");
        line6.textContent = "\u5B89\u9759\u7B49\u9C7C\u54AC\u94A9\u2026";
      }
      if (now2 >= pending2.bitesAt && now2 <= pending2.hookUntil) {
        mark.textContent = "\u2757";
        line6.textContent = "\u4E0A\u94A9\u4E86\uFF01\u5FEB\u70B9\uFF01";
        water.setAttribute("data-bite", "true");
      } else if (now2 > pending2.hookUntil) {
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
  var PIG_FX = ["flash", "react", "burst", "showBubble", "transform", "previewArt", "idleNow", "walkNow", "birthdayNow", "petShy"];
  function wireSplit(ctx, hooks) {
    var role2 = desktopRole();
    var shell2 = desktopShell();
    if (role2 === null || shell2 === null || shell2.panel === void 0) return null;
    if (typeof shell2.onStateChanged === "function") shell2.onStateChanged(function(view) {
      if (view && Array.isArray(view.pending)) ctx.render(view);
      else hooks.refresh();
    });
    if (role2 === "pet") {
      ;
      ["showBubble", "showLine"].forEach(function(name) {
        var own = ctx[name];
        if (typeof own !== "function") return;
        ctx[name] = function() {
          if (ctx.isOpen && typeof shell2.panel.raisePet === "function") shell2.panel.raisePet();
          return own.apply(null, arguments);
        };
      });
      shell2.panel.onFx(function(fx) {
        if (fx === null || typeof fx !== "object" || PIG_FX.indexOf(fx.name) < 0) return;
        var run = ctx[fx.name];
        if (typeof run === "function") run.apply(null, Array.isArray(fx.args) ? fx.args : []);
      });
      shell2.panel.on(function(message2) {
        if (message2?.type === "closed" || message2?.type === "open") updatePetPanelState(ctx, message2.type === "open");
      });
      return role2;
    }
    PIG_FX.forEach(function(name) {
      ctx[name] = function() {
        shell2.panel.fx(name, Array.prototype.slice.call(arguments));
      };
    });
    if (role2 === "ext") {
      ctx.extBig = typeof shell2.extKey === "string" && shell2.extKey ? shell2.extKey : null;
      if (ctx.extBig) ctx.tab = "ext:" + ctx.extBig;
      return role2;
    }
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
        const saveTransferActive = ctx.content?.querySelector?.('[data-save-transfer-active="true"]');
        if (message2.toPet || !ctx.isOpen || !autoCollapseEnabled() || hooks.isFishing() || typing() || saveTransferActive) return;
        ctx.setOpen(false);
      }
    });
    return role2;
  }
  function dailySide() {
    var w = (
      /** @type {any} */
      globalThis.window
    );
    var s = w?.screen;
    if (!s || typeof w.screenX !== "number" || typeof s.availWidth !== "number") return "left";
    return w.screenX + (w.innerWidth || 0) / 2 < (s.availLeft || 0) + s.availWidth / 2 ? "right" : "left";
  }
  function typing() {
    var active2 = (
      /** @type {any} */
      document.activeElement
    );
    var tag2 = active2?.tagName?.toLowerCase?.() ?? "";
    return tag2 === "input" || tag2 === "textarea" || active2?.getAttribute?.("contenteditable") === "true";
  }
  function splitSetOpen(ctx, next) {
    var role2 = desktopRole();
    if (role2 === "ext") {
      ctx.isOpen = true;
      ctx.host.setAttribute("data-open", "true");
      ctx.card.hidden = false;
      ctx.hud.hidden = true;
      if (typeof ctx.renderContent === "function") ctx.renderContent();
      return true;
    }
    if (role2 === "pet") {
      var changed = next !== ctx.isOpen;
      updatePetPanelState(ctx, next);
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
  function updatePetPanelState(ctx, next) {
    ctx.isOpen = next;
    ctx.host.setAttribute("data-open", "false");
    ctx.host.setAttribute("data-panel-open", String(next));
    ctx.host.setAttribute("data-daily-side", dailySide());
    ctx.card.hidden = true;
    ctx.hud.hidden = true;
    if (next && ctx.bubble?.hidden === false) desktopShell()?.panel?.raisePet?.();
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
          scenes: arr(entry.scenes).filter((scene6) => typeof scene6 === "string")
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
          artScenes: arr(obj(pig.stage).artScenes).filter((scene6) => typeof scene6 === "string"),
          hides: arr(obj(pig.stage).hides).map(function(slot) {
            return str(slot, "");
          })
        },
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
        // 垂危（没病）时看医生的费用：新宿主发在 pig 顶层；旧宿主只发 illness.doctorFee，回退读它。
        doctorFee: typeof pig.doctorFee === "number" ? pig.doctorFee : typeof obj(pig.illness).doctorFee === "number" ? obj(pig.illness).doctorFee : null,
        coins: num(pig.coins, 0),
        weight: str(pig.weight, "\u2014"),
        bodyWeight: isObj(pig.bodyWeight) ? {
          class: str(obj(pig.bodyWeight).class, "normal"),
          locked: obj(pig.bodyWeight).locked === true,
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
        subjects: arr(obj(stage2).subjects).filter((key2) => typeof key2 === "string"),
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
        personality: isObj(d.profile.personality) ? { key: str(d.profile.personality.key, ""), label: str(d.profile.personality.label, ""), emoji: str(d.profile.personality.emoji, "") } : null,
        // 送一次的改简介（游戏 0.37.0 起）：老宿主没有就是 0，界面不出入口。
        editsLeft: num(d.profile.editsLeft, 0),
        birthdayParts: isObj(d.profile.birthdayParts) ? { month: num(d.profile.birthdayParts.month, 1), day: num(d.profile.birthdayParts.day, 1) } : null,
        personalities: Array.isArray(d.profile.personalities) ? d.profile.personalities.filter(isObj).map((p) => ({ key: str(p.key, ""), label: str(p.label, ""), emoji: str(p.emoji, "") })) : [],
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
        quiet: obj(d.dialogue).quiet === true,
        isOfflineFeedEnabled: obj(d.dialogue).isOfflineFeedEnabled !== false
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
      var key2 = MODES[i];
      var entry = obj(source[key2]);
      out[key2] = {
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
    const scale2 = OLD_SCALE[saved] ?? 1;
    if (saved !== null) setPigSize(scale2);
    return scale2;
  }
  function setPigSize(value) {
    const scale2 = Number(value);
    writeStore(PIG_SIZE_KEY, "scale:" + (Number.isFinite(scale2) && scale2 > 0 ? scale2 : 1));
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
    var now2 = /* @__PURE__ */ new Date();
    return now2.getFullYear() + "-" + (now2.getMonth() + 1) + "-" + now2.getDate();
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
    // 扩展的大界面在网页里（没有桌面大窗口时）：面板卡片铺满页面，避免宿主边距露出场景外底色（游戏 0.37.0 起，菜园大农场）。
    // border:0!important / border-radius:0!important 不能少：面板那张卡自带 2px 边框和 20px 圆角，
    // 铺满窗口后四周会露一条 2px 的缝、四角圆角外露一块近白宿主底色
    // （桌面版大窗口在 src/client/desktop/ext-window.js 里清了，网页版这里要对齐）。
    // box-shadow 不用清：卡片固定铺满视口，阴影本来就全落在视口外，量不到一点差别。
    '[data-dsh-pig][data-ext-view="big"] .dp-card{position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:0!important;',
    "border:0!important;border-radius:0!important;width:auto!important;max-width:none!important;max-height:none!important;height:auto!important;z-index:2147483600}",
    '[data-dsh-pig][data-ext-view="big"] .dp-content{padding:0!important;overflow:hidden!important;flex:1 1 auto}',
    '[data-dsh-pig][data-ext-view="big"] .dp-bar,[data-dsh-pig][data-ext-view="big"] .dp-panel-footer{display:none!important}',
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
    // 物理层三层：外层 .dp-pig 保留现有 CSS 动画，.dp-pig-hold 只做拎起（支点在头顶），
    // .dp-pig-body 只做整图压扁/倾斜/翻面（支点在 85%，和 motion-envelope 一致）。
    ".dp-pet-snap{position:absolute;left:-50%;top:-50%;width:200%;height:200%;pointer-events:none;",
    "scale:var(--snap-zoom,1);translate:var(--snap-x,0%) var(--snap-y,0%)}",
    ".dp-pet-snap[hidden]{display:none}",
    '[data-dsh-pig] .dp-pig[data-pet-snap="true"]{animation:none!important}',
    '[data-dsh-pig] .dp-pig[data-pet-snap="true"] .dp-pig-img{visibility:hidden}',
    '[data-dsh-pig] .dp-pig[data-pet-snap="true"] .dp-pig-hold,',
    '[data-dsh-pig] .dp-pig[data-pet-snap="true"] .dp-pig-body{transform:none!important}',
    '.dp-pig[data-walk="right"] .dp-pet-snap{transform:scaleX(-1);translate:calc(-1 * var(--snap-x,0%)) var(--snap-y,0%)}',
    ".dp-pig-hold{display:block;position:relative;width:var(--pig-size);height:var(--pig-size);",
    "transform-origin:50% 0%;will-change:auto}",
    ".dp-pig-body{display:block;position:relative;width:var(--pig-size);height:var(--pig-size);",
    "transform-origin:50% 85%;will-change:auto}",
    // 翻卡片期间由物理层做镜像；内层 data-walk 的瞬间镜像要关掉，否则翻完会双重镜像。
    '[data-dsh-pig] .dp-pig[data-feel-flip="true"] .dp-pig-img{transform:none!important}',
    // 被拎着拖动时暂停待机浮动（反应动画照常演），避免「被拎住还在自己上下飘」。
    '[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-pig:not([data-react]){animation-play-state:paused!important}',
    // 摔晕：整图轻摇 + 眩晕符号（符号由 feel 用 burst 冒），不新增立绘。
    '[data-dsh-pig] .dp-pig[data-react="dizzy"]{animation-name:dp-dizzy;animation-duration:2.4s}',
    "@keyframes dp-dizzy{0%,100%{transform:rotate(0)}12%{transform:rotate(-6deg)}28%{transform:rotate(5deg)}",
    "44%{transform:rotate(-4deg)}60%{transform:rotate(3deg)}76%{transform:rotate(-2deg)}}",
    ".dp-pig-img,.dp-pig-emoji{filter:drop-shadow(0 4px 6px rgba(61,52,40,.28))}",
    ".dp-pig-sleep{display:none;position:absolute;top:0;left:calc(50% - var(--pig-size) * .6);z-index:1;",
    "width:calc(var(--pig-size) * 1.2);height:var(--pig-size);object-fit:contain;",
    "scale:var(--art-zoom,1);",
    "translate:var(--art-x,0%) var(--art-y,0%);pointer-events:none;-webkit-user-drag:none;user-select:none}",
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-pig-img,',
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-pig-emoji{visibility:hidden}',
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-pig-sleep{display:block}',
    '.dp-pig[data-idle="nap"]:not([data-react]) .dp-dress{visibility:hidden}',
    // 困了/睡着（mood=sleepy）也用当前皮肤自己的 sleep 图，不再用反馈图里的 sleep-cloud/lie-flat。
    // syncSleepArt 每次都按当前形态/皮肤设置这张图。
    '.dp-pig[data-mood="sleepy"]:not([data-react]):not([data-feedback="true"]) .dp-pig-img,',
    '.dp-pig[data-mood="sleepy"]:not([data-react]):not([data-feedback="true"]) .dp-pig-emoji{visibility:hidden}',
    '.dp-pig[data-mood="sleepy"]:not([data-react]):not([data-feedback="true"]) .dp-pig-sleep{display:block}',
    '.dp-pig[data-mood="sleepy"]:not([data-react]):not([data-feedback="true"]) .dp-dress{visibility:hidden}',
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
    // 想象泡独立于猪图；避开正上方的签到/礼包，讲话或拖动时让位。
    ".dp-hunger-bubble{display:none;position:absolute;left:calc(100% + 8px);top:-36px;z-index:4;",
    "width:40px;height:37px;filter:drop-shadow(0 1.5px 0 rgba(61,52,40,.14));pointer-events:none}",
    ".dp-hunger-bubble svg{display:block;width:100%;height:100%;overflow:visible;",
    "fill:var(--ac-bg-input);stroke:var(--ac-border);stroke-width:2;stroke-linejoin:round}",
    ".dp-hunger-food{position:absolute;left:6px;top:5px;width:29px;height:20px;",
    "font:17.5px/20px var(--ac-font);text-align:center}",
    '.dp-pig[data-mood="hungry"] .dp-hunger-bubble{display:block}',
    ".dp-scene:has(.dp-bubble:not([hidden])) .dp-hunger-bubble,",
    '.dp-scene[data-dragging="true"] .dp-hunger-bubble{visibility:hidden}',
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
    // 微动作期间暂停待机/呼吸动画，避免 animation:none 把呼吸中途的位置重置（实测跳 6.8px）。
    // 只暂停「没有反应动画」的时候：摸猪的压扁回弹（data-react="pet"）要靠它演完，不能被一起冻住。
    ".dp-pig[data-micro-action]:not([data-react]){animation-play-state:paused!important}",
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
    "z-index:2;width:max-content;max-width:calc(var(--panel-width) - 24px);max-height:104px;box-sizing:border-box;padding:6px 10px;",
    "border-radius:var(--ac-radius-sm);font-size:10.5px;font-weight:600;line-height:1.45;",
    "color:var(--ac-text-body);background:var(--ac-bg-input);",
    "border:2px solid var(--ac-border-light);box-shadow:var(--ac-shadow-sm)}",
    ".dp-bubble-text{display:block;max-height:88px;overflow-y:auto;scrollbar-width:thin;white-space:normal;overflow-wrap:anywhere}",
    ".dp-bubble:has(.dp-bubble-replies) .dp-bubble-text{max-height:52px}",
    // Tail drawn as a small rotated square so the 2px border stays continuous.
    '.dp-bubble::after{content:"";position:absolute;left:auto;right:calc(var(--pig-size) / 2 - 5px);top:100%;bottom:auto;',
    "margin-top:-4px;width:8px;height:8px;",
    "background:var(--ac-bg-input);border-right:2px solid var(--ac-border-light);",
    "border-bottom:2px solid var(--ac-border-light);transform:rotate(45deg)}",
    '[data-dsh-pig][data-panel-side="right"] .dp-bubble{right:auto;left:6px}',
    '[data-dsh-pig][data-panel-side="right"] .dp-bubble::after{right:auto;left:calc(var(--pig-size) / 2 - 5px)}',
    "[data-dsh-pig] .dp-bubble[data-fitted]::after{left:var(--bubble-tail-left);right:auto}",
    // Reply buttons under a line: small pills, the mint of the primary colour
    // without the 3D base, which the spec keeps for real primary buttons.
    // 对话始终在猪头上；菜单打开只调整原生窗口层级，不改变气泡位置、宽度或滚动进度。
    ".dp-bubble-replies{display:flex;flex-wrap:wrap;gap:4px;max-height:29px;overflow-y:auto;scrollbar-width:thin;margin-top:5px}",
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
    // 桌面版拆成两个窗口：猪窗口自己永远是「收着」，面板开着时（split.js 标 data-panel-open）气泡挪到猪身子旁边，
    // 不然顶在猪头上正好压住面板窗口的底栏（用户 2026-10-10 Win11 截图）。
    '[data-dsh-pig][data-panel-open="true"] .dp-daily{left:auto;margin-left:0;right:calc(100% + 6px);bottom:calc(var(--pig-gap-below) + var(--pig-size) / 2 - 18px)}',
    '[data-dsh-pig][data-panel-open="true"][data-daily-side="right"] .dp-daily{right:auto;left:calc(100% + 6px)}',
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
    ".dp-size-step{width:34px;height:34px;border:1px solid var(--ac-border-light);border-radius:var(--ac-radius-sm);",
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
    // 三个代理按钮复用面板现有的 dp-mini（青药丸 + 3D 底边），不另造一套视觉。
    ".dp-proxy-actions .dp-proxy-clear{margin-left:auto}",
    ".dp-proxy-status{font-size:10px;line-height:1.5;margin-top:9px;color:var(--ac-text-muted);overflow-wrap:anywhere}",
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
    ".dp-switch[data-offline-feed]{min-height:32px;min-width:32px;font-size:12px;box-sizing:border-box}",
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
    // Top: the photo and who it is.
    ".dp-vcard-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}",
    ".dp-vcard-avatar{flex:none;width:72px;height:72px;border-radius:18px;display:flex;align-items:center;",
    "justify-content:center;background:#fffbe7;border:2px solid var(--vc-line);box-shadow:0 3px 0 rgba(61,52,40,.12)}",
    ".dp-vcard-img{width:56px;height:56px;display:block}",
    ".dp-vcard-e{font-size:40px;line-height:1}",
    ".dp-vcard-who{display:flex;flex-direction:column;gap:3px;min-width:0}",
    ".dp-vcard-name{font-size:15px;font-weight:800;color:var(--ac-text);white-space:normal;overflow-wrap:anywhere;line-height:1.35}",
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
    ".dp-vcard-once{flex-direction:column;align-items:stretch;gap:6px}.dp-vcard-once-line{display:flex;align-items:center;gap:6px}.dp-vcard-once select{flex:1;min-width:0}",
    ".dp-vcard-once .dp-vcard-date{width:52px;height:26px;border-radius:8px;padding:0 6px;text-align:center}",
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
    ".dp-dex-skin-note{position:relative;z-index:1;margin-top:7px;font-size:12px;font-weight:600;line-height:1.4;text-align:center;color:var(--ac-text-2)}",
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
.dp-skin-intro{display:grid;gap:4px;margin:0 0 10px}.dp-skin-intro span{font-size:10.5px;line-height:1.5;color:var(--ac-text-2)}.dp-skin-grid{display:flex;flex-direction:column;gap:7px}.dp-skin-row{min-height:62px;padding:7px 9px}.dp-skin-current{background:var(--ac-active);border-color:#9db0d6}.dp-skin-row[data-locked="true"] .dp-skin-art{filter:grayscale(1);opacity:.48}.dp-skin-art{width:48px;height:48px;flex:none;object-fit:contain}.dp-skin-copy{display:grid;gap:3px}.dp-skin-copy b{font-size:10.5px}.dp-skin-copy small{line-height:1.35}.dp-skin-row>.dp-mini{flex:none;padding-inline:10px}.dp-skin-import{display:grid;grid-template-columns:1fr auto;align-items:center;gap:3px 8px;margin-top:10px;cursor:pointer}.dp-skin-import .dp-pick-head{margin:0}.dp-skin-import>.dp-dim{font-size:10px;line-height:1.4;color:var(--ac-text-2)}.dp-skin-import input{position:absolute;width:1px;height:1px;opacity:0}.dp-skin-file{grid-column:2;grid-row:1/3;display:inline-flex!important;align-items:center;white-space:nowrap}.dp-skin-howto{display:flex;width:100%;justify-content:center;margin:10px 0 8px}.dp-skin-note{font-size:12px;font-weight:600;line-height:1.4;color:var(--ac-text-2)}
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
  function drillTo(ui, tab, key2) {
    ui.drill[tab] = key2;
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
  function itemTile(ui, item, color2) {
    var owned = num(ui.view.inventory[item.key], 0);
    var note2 = item.price + " \u{1FA99}";
    if (item.owned) note2 = "\u5DF2\u62E5\u6709";
    else if (item.kind === "dress" && item.unlocked === false) note2 = "\u{1F512} Lv." + item.level;
    const node = tile({
      emoji: item.emoji,
      label: item.label,
      color: color2,
      soft: true,
      note: note2,
      badge: owned > 0 ? "\xD7" + owned : "",
      tag: item.needed ? "\u9700\u8981" : item.owned && item.worn ? "\u7A7F\u7740" : "",
      dim: !item.owned && (!item.affordable || item.kind === "dress" && item.unlocked === false),
      disabled: item.owned === true,
      data: { "data-buy": item.key },
      onPick: function() {
        ui.send("buy", { item: item.key });
      }
    });
    if (item.kind === "body") node.setAttribute("aria-description", item.blurb);
    return node;
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
    for (var key2 in EXTRA) {
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
      })(key2);
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
          note: action !== void 0 ? careEffectLine(action, item) : item.kind === "promotion" || item.kind === "body" ? item.useLabel : "",
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
        var active2 = ui.drill.pick === entry.day;
        if (active2) picked = entry;
        grid.appendChild(tile({
          emoji: "\u{1F4D4}",
          label: shortDay(entry.day),
          color: EXTRA.diary.color,
          soft: true,
          active: active2,
          data: { "data-diary": entry.day },
          onPick: function() {
            ui.drill.pick = active2 ? null : entry.day;
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
        var active2 = ui.drill.pick === id;
        if (active2) picked = entry;
        grid.appendChild(tile({
          emoji: entry.emoji,
          label: entry.label,
          color: EXTRA.souvenir.color,
          soft: true,
          active: active2,
          note: entry.rarityEmoji + entry.rarityLabel,
          data: { "data-souvenir": id },
          onPick: function() {
            ui.drill.pick = active2 ? null : id;
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

  // packages/pet-core/src/data/profile.js
  var PET_NAME_MAX = 5;
  var PERSONALITIES = Object.freeze([
    Object.freeze({ key: "peppy", label: "\u5143\u6C14", emoji: "\u{1F31F}", catchphrase: "\u563F\u563F", motto: "\u4ECA\u5929\u4E5F\u8981\u5143\u6C14\u6EE1\u6EE1\uFF01" }),
    Object.freeze({ key: "lazy", label: "\u60A0\u95F2", emoji: "\u{1F634}", catchphrase: "\u547C\u565C", motto: "\u80FD\u8EBA\u7740\uFF0C\u7EDD\u4E0D\u5750\u7740\u3002" }),
    Object.freeze({ key: "cranky", label: "\u50B2\u5A07", emoji: "\u{1F624}", catchphrase: "\u54FC", motto: "\u522B\u60F9\u6211\uFF0C\u9664\u975E\u4F60\u5E26\u4E86\u5403\u7684\u3002" }),
    Object.freeze({ key: "sisterly", label: "\u8D34\u5FC3", emoji: "\u{1F481}", catchphrase: "\u61C2\u5417", motto: "\u6709\u4E8B\u627E\u6211\uFF0C\u6211\u7F69\u7740\u4F60\u3002" }),
    Object.freeze({ key: "snooty", label: "\u81EA\u604B", emoji: "\u{1F485}", catchphrase: "\u5567\u5567", motto: "\u6211\u662F\u8FD9\u7247\u6700\u53EF\u7231\u7684\u732A\u3002" }),
    Object.freeze({ key: "normal", label: "\u6E29\u548C", emoji: "\u{1F642}", catchphrase: "\u55EF\u55EF", motto: "\u5E73\u5E73\u6DE1\u6DE1\u624D\u662F\u771F\u3002" }),
    Object.freeze({ key: "clingy", label: "\u9ECF\u4EBA", emoji: "\u{1F495}", catchphrase: "\u8D34\u8D34", motto: "\u4F4D\u7F6E\u632A\u8FD1\u4E00\u70B9\uFF0C\u559C\u6B22\u4E5F\u8FD1\u4E00\u70B9\u3002" }),
    Object.freeze({ key: "shy", label: "\u5BB3\u7F9E", emoji: "\u{1F338}", catchphrase: "\u90A3\u4E2A", motto: "\u60F3\u9760\u8FD1\u4F60\uFF0C\u53C8\u6015\u4F60\u53D1\u73B0\u3002" }),
    Object.freeze({ key: "curious", label: "\u597D\u5947", emoji: "\u{1F50E}", catchphrase: "\u54A6", motto: "\u4ECA\u5929\u4F1A\u6709\u4EC0\u4E48\u65B0\u53D1\u73B0\u5462\uFF1F" }),
    Object.freeze({ key: "mischievous", label: "\u8C03\u76AE", emoji: "\u{1FAE7}", catchphrase: "\u563B\u563B", motto: "\u4E00\u70B9\u70B9\u5C0F\u6363\u86CB\uFF0C\u5F88\u591A\u5F88\u591A\u559C\u6B22\u3002" }),
    Object.freeze({ key: "goofy", label: "\u5446\u840C", emoji: "\u{1F361}", catchphrase: "\u5514", motto: "\u6CA1\u60F3\u660E\u767D\uFF0C\u4E5F\u4E0D\u803D\u8BEF\u559C\u6B22\u4F60\u3002" }),
    Object.freeze({ key: "earnest", label: "\u8BA4\u771F", emoji: "\u{1F4DA}", catchphrase: "\u8BB0\u597D\u5566", motto: "\u7B54\u5E94\u4F60\u7684\u4E8B\uFF0C\u6211\u4F1A\u8BA4\u771F\u8BB0\u4F4F\u3002" })
  ]);
  var SERIOUS_SCENES = Object.freeze(["death", "sick", "wrongMedicine"]);
  var ZODIAC = Object.freeze([
    Object.freeze({ month: 1, day: 20, label: "\u6C34\u74F6\u5EA7", emoji: "\u2652" }),
    Object.freeze({ month: 2, day: 19, label: "\u53CC\u9C7C\u5EA7", emoji: "\u2653" }),
    Object.freeze({ month: 3, day: 21, label: "\u767D\u7F8A\u5EA7", emoji: "\u2648" }),
    Object.freeze({ month: 4, day: 20, label: "\u91D1\u725B\u5EA7", emoji: "\u2649" }),
    Object.freeze({ month: 5, day: 21, label: "\u53CC\u5B50\u5EA7", emoji: "\u264A" }),
    Object.freeze({ month: 6, day: 22, label: "\u5DE8\u87F9\u5EA7", emoji: "\u264B" }),
    Object.freeze({ month: 7, day: 23, label: "\u72EE\u5B50\u5EA7", emoji: "\u264C" }),
    Object.freeze({ month: 8, day: 23, label: "\u5904\u5973\u5EA7", emoji: "\u264D" }),
    Object.freeze({ month: 9, day: 23, label: "\u5929\u79E4\u5EA7", emoji: "\u264E" }),
    Object.freeze({ month: 10, day: 24, label: "\u5929\u874E\u5EA7", emoji: "\u264F" }),
    Object.freeze({ month: 11, day: 23, label: "\u5C04\u624B\u5EA7", emoji: "\u2650" }),
    Object.freeze({ month: 12, day: 22, label: "\u6469\u7FAF\u5EA7", emoji: "\u2651" })
  ]);

  // src/client/tabs/card.js
  var LIMITS = { catchphrase: 6, motto: 24, name: PET_NAME_MAX, owner: 12 };
  function renderCardTab(ui) {
    var p = ui.view.pig;
    var profile = ui.view.profile;
    if (p === null) return;
    if (profile === null) {
      ui.content.appendChild(el("div", "dp-empty", "\u91CD\u542F dsh \u4E4B\u540E\u624D\u6709\u5C45\u6C11\u5361"));
      return;
    }
    var card2 = el("div", "dp-vcard");
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
    if (profile.editsLeft > 0 && profile.birthdayParts !== null && profile.personalities.length) card2.appendChild(profileEditor(ui, profile));
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
  function editableField(ui, key2, label, value) {
    var editing = ui.cardEdit !== null && ui.cardEdit.field === key2;
    var row = el("div", "dp-vcard-row" + (key2 === "motto" ? " dp-vcard-motto-row" : ""));
    row.appendChild(el("span", "dp-vcard-label", label + "\uFF1A"));
    if (editing) {
      appendEditor(ui, row, key2);
      return row;
    }
    if (key2 === "owner") row.appendChild(el("span", "dp-vcard-value dp-dim", "\uFF08\u6084\u6084\u8BB0\u7740\uFF0C\u4E0D\u5199\u51FA\u6765\uFF09"));
    else row.appendChild(el("span", key2 === "motto" ? "dp-vcard-value dp-vcard-motto" : "dp-vcard-value", key2 === "motto" ? "\u300C" + value + "\u300D" : value));
    row.appendChild(pencil(ui, key2, label, value, "dp-vcard-edit"));
    return row;
  }
  function nameLine(ui, p) {
    var line6 = el("div", "dp-vcard-nameline");
    if (ui.cardEdit !== null && ui.cardEdit.field === "name") {
      appendEditor(ui, line6, "name");
      return line6;
    }
    line6.appendChild(el("b", "dp-vcard-name", p.name));
    line6.appendChild(pencil(ui, "name", "\u540D\u5B57", p.name, "dp-vcard-edit dp-vcard-name-edit"));
    return line6;
  }
  function pencil(ui, key2, label, value, className) {
    var btn = button(className, { "data-card-edit": key2 }, function() {
      ui.cardEdit = { field: key2, draft: value };
      ui.renderContent();
    });
    btn.textContent = "\u270F\uFE0F";
    btn.title = "\u6539" + label;
    return btn;
  }
  function appendEditor(ui, parent, key2) {
    var input = (
      /** @type {HTMLInputElement} */
      el("input", "dp-input dp-vcard-input")
    );
    input.value = ui.cardEdit.draft;
    input.maxLength = LIMITS[key2];
    input.setAttribute("data-card-input", key2);
    if (key2 === "name") input.setAttribute("aria-label", "\u540D\u5B57\uFF08\u6700\u591A" + PET_NAME_MAX + "\u4E2A\u5B57\uFF09");
    input.addEventListener("input", function() {
      ui.cardEdit = { field: key2, draft: input.value };
    });
    var save = button("dp-mini", { "data-card-save": key2 }, function() {
      var text = (ui.cardEdit === null ? "" : ui.cardEdit.draft).trim();
      ui.cardEdit = null;
      if (text !== "") ui.send(key2, key2 === "name" || key2 === "owner" ? { name: text } : { text });
      ui.renderContent();
    });
    save.textContent = "\u597D";
    var cancel = button("dp-mini dp-mini-plain", { "data-card-cancel": key2 }, function() {
      ui.cardEdit = null;
      ui.renderContent();
    });
    cancel.textContent = "\u7B97\u4E86";
    parent.appendChild(input);
    parent.appendChild(save);
    parent.appendChild(cancel);
  }
  function profileEditor(ui, profile) {
    var box = el("div", "dp-vcard-row dp-vcard-once");
    var draft2 = ui.profileDraft;
    if (!draft2) {
      var open = button("dp-mini", { "data-card-once": "open" }, function() {
        ui.profileDraft = { personality: profile.personality ? profile.personality.key : profile.personalities[0].key, month: profile.birthdayParts.month, day: profile.birthdayParts.day };
        ui.renderContent();
      });
      open.textContent = "\u270F\uFE0F \u6539\u6027\u683C\u548C\u751F\u65E5\uFF08\u9001 " + profile.editsLeft + " \u6B21\uFF09";
      box.appendChild(open);
      return box;
    }
    var pick = (
      /** @type {HTMLSelectElement} */
      el("select", "dp-setting-field")
    );
    pick.setAttribute("data-card-once", "personality");
    profile.personalities.forEach(function(p) {
      var option = (
        /** @type {HTMLOptionElement} */
        el("option", null, p.emoji + " " + p.label)
      );
      option.value = p.key;
      pick.appendChild(option);
    });
    pick.value = draft2.personality;
    pick.addEventListener("change", function() {
      draft2.personality = pick.value;
    });
    var number2 = function(key2, max, value) {
      var input = (
        /** @type {HTMLInputElement} */
        el("input", "dp-input dp-vcard-date")
      );
      input.type = "number";
      input.min = "1";
      input.max = String(max);
      input.value = String(value);
      input.setAttribute("data-card-once", key2);
      input.addEventListener("input", function() {
        draft2[key2] = Number(input.value);
      });
      return input;
    };
    var line6 = function() {
      var row = el("div", "dp-vcard-once-line");
      box.appendChild(row);
      return row;
    };
    var first = line6();
    first.appendChild(el("span", "dp-vcard-label", "\u6027\u683C\uFF1A"));
    first.appendChild(pick);
    var second = line6();
    second.appendChild(el("span", "dp-vcard-label", "\u751F\u65E5\uFF1A"));
    second.appendChild(number2("month", 12, draft2.month));
    second.appendChild(el("span", null, "\u6708"));
    second.appendChild(number2("day", 31, draft2.day));
    second.appendChild(el("span", null, "\u65E5"));
    var third = line6();
    var save = button("dp-mini", { "data-card-once": "save" }, function() {
      var change = ui.profileDraft;
      ui.profileDraft = null;
      ui.send("editProfile", { personality: change.personality, month: change.month, day: change.day });
      ui.renderContent();
    });
    save.textContent = "\u5C31\u8FD9\u6837\uFF08\u53EA\u80FD\u6539\u8FD9\u4E00\u6B21\uFF09";
    var cancel = button("dp-mini dp-mini-plain", { "data-card-once": "cancel" }, function() {
      ui.profileDraft = null;
      ui.renderContent();
    });
    cancel.textContent = "\u7B97\u4E86";
    third.appendChild(save);
    third.appendChild(cancel);
    return box;
  }

  // src/client/skin-note.js
  var CHUBBY_SKIN_NOTE = "\u7A7F\u76AE\u80A4\u4F1A\u53D8\u666E\u901A\u4F53\u578B\uFF0C\u80D6\u80D6\u53EA\u6709\u9ED8\u8BA4\u76AE\u80A4\u6709";
  function isChubbyPig(view) {
    const body = view?.pig?.bodyWeight;
    return body !== null && typeof body === "object" && (body.class === "round" || body.class === "fat");
  }
  function chubbySkinNote(view) {
    return isChubbyPig(view) ? CHUBBY_SKIN_NOTE : "";
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
      const progress2 = el("span", "dp-dex-progress");
      const fill = el("i");
      fill.style.width = (entries2.length === 0 ? 0 : Math.round(got / entries2.length * 100)) + "%";
      progress2.appendChild(fill);
      node.appendChild(progress2);
      grid.appendChild(node);
    }
    for (const section2 of ui.view.extDex ?? []) {
      const entries2 = section2.entries ?? [];
      const got = entries2.filter((entry) => entry.acquired).length;
      const key2 = "ext:" + section2.extension + ":" + section2.key;
      const node = tile({
        emoji: section2.emoji,
        label: section2.label,
        color: section2.color || "orange",
        note: got + "/" + entries2.length,
        data: { "data-dex-section": key2 },
        onPick: function() {
          drillTo(ui, "dex", key2);
        }
      });
      const progress2 = el("span", "dp-dex-progress");
      const fill = el("i");
      fill.style.width = (entries2.length === 0 ? 0 : Math.round(got / entries2.length * 100)) + "%";
      progress2.appendChild(fill);
      node.appendChild(progress2);
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
    const active2 = ui.drill.dexFilter ?? "all";
    const available = new Set(entries2.map((entry) => shelfOf(entry.kind)));
    for (const [key2, label] of ITEM_KINDS) {
      if (key2 !== "all" && !available.has(key2)) continue;
      const filter2 = button("dp-dex-filter", { "data-dex-filter": key2 }, function() {
        ui.drill.dexFilter = key2;
        ui.drill.pick = null;
        ui.renderContent();
      });
      filter2.textContent = label;
      filter2.setAttribute("data-active", active2 === key2 ? "true" : "false");
      filters.appendChild(filter2);
    }
    controls.appendChild(filters);
    ui.content.appendChild(controls);
    sideScroller(filters, filters.querySelector ? filters.querySelector('[data-active="true"]') : null);
    const query = String(ui.drill.dexQuery ?? "").trim().toLowerCase();
    const list = el("div", "dp-dex-catalog");
    for (const entry of entries2) {
      if (active2 !== "all" && shelfOf(entry.kind) !== active2) continue;
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
    const wrap2 = el("div", "dp-dex-detail");
    wrap2.setAttribute("data-dex-detail", entry.key);
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
        const current2 = ui.view.skins.current === entry.key;
        const pick = button("dp-mini", { "data-dex-skin": entry.key }, function() {
          ui.send("skin", { skin: entry.key });
        });
        pick.textContent = current2 ? "\u4F7F\u7528\u4E2D" : "\u4F7F\u7528\u8FD9\u6B3E\u76AE\u80A4";
        pick.disabled = current2;
        const action = el("div", "dp-dex-skin-action");
        action.appendChild(pick);
        card2.appendChild(action);
        const note2 = chubbySkinNote(ui.view);
        if (note2 !== "") {
          const hint = el("div", "dp-dex-skin-note", note2);
          hint.setAttribute("data-skin-fat-note", "true");
          card2.appendChild(hint);
        }
      }
    } else {
      const riddle = el("div", "dp-dex-riddle");
      riddle.appendChild(el("b", null, "\u89E3\u9501\u8C1C\u9762"));
      riddle.appendChild(el("span", null, entry.hint || "\u5B83\u85CF\u5728\u4E00\u6B21\u5C1A\u672A\u542F\u7A0B\u7684\u76F8\u9047\u91CC\u3002"));
      card2.appendChild(riddle);
    }
    wrap2.appendChild(card2);
    ui.content.appendChild(wrap2);
    if (flash && entry.acquired) tilt2(card2);
  }
  function openDetail(ui, key2) {
    ui.drill.pick = key2;
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
  function appIcon(key2, emoji, className) {
    if (iconStyle() !== "built-in" || !BUNDLED.has(key2)) return el("span", className, emoji);
    const img = (
      /** @type {HTMLImageElement} */
      el("img", className + " dp-tile-svg")
    );
    img.src = ART_URL + "ui-" + key2 + ".svg";
    img.alt = emoji;
    img.addEventListener("error", function() {
      const replacement = el("span", className, emoji);
      img.parentNode?.replaceChild(replacement, img);
    });
    return img;
  }

  // src/client/asset-background.js
  function applyAssetFrame(node, info) {
    const slices = info?.nine_slice?.insets;
    if (!Array.isArray(slices) || slices.length !== 4 || !slices.every((value) => Number.isFinite(value) && value > 0)) return;
    if (node.matches(".fm-slot,.fm-packet,i") || node.parentElement?.matches(".fm-exp,.fm-card-progress")) return;
    node.classList.add("fm-framed-art");
    const limit = node.matches(".fm-exp,.fm-card-progress") ? 2 : 8;
    const scale2 = Math.min(0.5, limit / Math.max(...slices));
    node.style.borderWidth = slices.map((value) => Math.ceil(value * scale2) + "px").join(" ");
    node.style.borderImageWidth = slices.map((value) => value * scale2 + "px").join(" ");
    node.style.borderImageSource = node.style.backgroundImage;
    node.style.borderImageSlice = slices.join(" ") + " fill";
    node.style.borderImageRepeat = info.nine_slice.edge_mode === "round" ? "round" : "repeat";
    node.style.backgroundImage = "none";
  }
  function applyModalAssetFrame(node, info, url) {
    const slices = info?.nine_slice?.insets;
    if (!Array.isArray(slices) || slices.length !== 4 || !slices.every((value) => Number.isFinite(value) && value > 0)) return node;
    const gap = Number.isFinite(info.outer_insets?.[0]) ? info.outer_insets[0] / slices[0] : 0;
    node.style.setProperty("--fm-frame-top-gap-ratio", String(gap));
    node.style.borderImageSource = 'url("' + url + '")';
    node.style.borderImageSlice = slices.join(" ") + " fill";
    node.style.borderImageRepeat = info.nine_slice.edge_mode === "round" ? "round" : "repeat";
    return node;
  }

  // src/client/ext-apps.js
  var registry = {};
  var requested = {};
  var activeVersion = {};
  var rerender = null;
  function bridge() {
    var host3 = (
      /** @type {any} */
      window
    );
    if (!host3.dshPiggyExtensions) {
      host3.dshPiggyExtensions = {
        register: function(key2, impl) {
          if (typeof key2 !== "string" || impl === null || typeof impl !== "object") return;
          var scriptId = document.currentScript?.getAttribute("data-piggy-extension");
          var id = scriptId || activeVersion[key2];
          if (!id || !id.startsWith(key2 + "@")) return;
          registry[id] = impl;
          if (typeof rerender === "function") rerender();
        }
      };
    }
    return host3.dshPiggyExtensions;
  }
  function ensureScript(key2, version) {
    bridge();
    var id = key2 + "@" + version;
    activeVersion[key2] = id;
    if (requested[id] || typeof document === "undefined" || typeof document.createElement !== "function") return;
    requested[id] = true;
    var script = (
      /** @type {HTMLScriptElement} */
      document.createElement("script")
    );
    script.src = "/dsh-piggy/ext/" + encodeURIComponent(key2) + "/client.js?v=" + encodeURIComponent(version);
    script.setAttribute("data-piggy-extension", id);
    script.async = true;
    (document.head || document.body)?.appendChild(script);
  }
  function openBigApp(ui, key2) {
    var shell2 = desktopShell();
    if (shell2 && shell2.ext && typeof shell2.ext.open === "function") {
      shell2.ext.open(key2);
      return;
    }
    ui.extBig = key2;
    ui.tab = "ext:" + key2;
    ui.renderContent();
  }
  function closeBigApp(ui) {
    var shell2 = desktopShell();
    if (desktopRole() === "ext" && shell2 && shell2.ext && typeof shell2.ext.close === "function") {
      shell2.ext.close();
      return;
    }
    ui.extBig = null;
    ui.host.setAttribute("data-ext-view", "");
    ui.renderContent();
  }
  function renderDownloadedApp(ui, key2, mode) {
    var big = mode === "big";
    var extension = (ui.view.extensions || []).find(function(entry) {
      return entry.key === key2;
    });
    if (!extension) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD9\u4E2A\u6269\u5C55\u5DF2\u7ECF\u5220\u6389\u4E86"));
      return;
    }
    if (extension.error) {
      ui.content.appendChild(el("div", "dp-empty", "\u8FD9\u4E2A\u6269\u5C55\u51FA\u9519\u4E86\uFF1A" + extension.error));
      return;
    }
    ensureScript(key2, extension.version);
    rerender = function() {
      if (ui.tab === "ext:" + key2) ui.renderContent();
    };
    var impl = registry[key2 + "@" + extension.version];
    if (!impl || typeof impl.render !== "function") {
      ui.content.appendChild(el("div", "dp-empty", "\u6B63\u5728\u52A0\u8F7D\u2026\u2026"));
      return;
    }
    var data = ui.view.extViews ? ui.view.extViews[key2] : void 0;
    var wallet = (ui.view.wallets || []).find(function(entry) {
      return entry.key === key2;
    });
    if (wallet && !big && (key2 !== "farm" || Number.parseInt(extension.version, 10) < 4)) ui.content.appendChild(walletBar(ui, wallet));
    var panel = typeof ui.content.closest === "function" ? ui.content.closest(".dp-card") : null;
    if (panel && !big) {
      var padding = parseFloat(getComputedStyle(panel.querySelector(".dp-content") || panel).paddingBottom) || 0;
      var bottom = panel.getBoundingClientRect().top + (parseFloat(panel.style.maxHeight) || panel.clientHeight);
      ui.content.style.setProperty("--ext-panel-height", Math.max(160, bottom - ui.content.getBoundingClientRect().top - padding - 2) + "px");
    }
    try {
      impl.render({
        content: ui.content,
        data: data === void 0 ? null : data,
        mode: big ? "big" : "panel",
        // 桌面版外壳 0.6.5 以前没有大窗口，面板窗口又太小，就不给这个入口；网页版在页面里铺满。
        openBig: big || desktopShell() !== null && !(desktopShell().ext && typeof desktopShell().ext.open === "function") ? void 0 : function() {
          openBigApp(ui, key2);
        },
        closeBig: big ? function() {
          closeBigApp(ui);
        } : void 0,
        send: function(op, payload) {
          ui.send("ext", { key: key2, op, data: payload || {} });
        },
        walletContent: wallet ? function() {
          return walletBar(ui, wallet, { open: true });
        } : void 0,
        el,
        button,
        rerender: function() {
          ui.renderContent();
        },
        // 玩家现在用的猪图（随皮肤和形态变）；没有立绘时是 null，扩展自己退回 emoji。
        pigArt: function() {
          var art = ui.view.pig && ui.view.pig.stage ? ui.view.pig.stage.art : null;
          return art ? artSource(art) : null;
        },
        // 带版本号：扩展更新后换了图，地址也跟着换，不会拿到缓存里的旧图。
        hasAsset: function(name) {
          return (extension.assets || []).includes(name);
        },
        paintAsset: function(node, name) {
          applyAssetFrame(node, extension.assetLayout?.[name]);
        },
        paintFrame: function(node, name) {
          return applyModalAssetFrame(node, extension.assetLayout?.[name], "/dsh-piggy/ext/" + encodeURIComponent(key2) + "/assets/" + encodeURIComponent(name) + "?v=" + encodeURIComponent(extension.version));
        },
        assetInfo: function(name) {
          return extension.assetLayout ? extension.assetLayout[name] : null;
        },
        asset: function(name) {
          return "/dsh-piggy/ext/" + encodeURIComponent(key2) + "/assets/" + encodeURIComponent(String(name)) + "?v=" + encodeURIComponent(extension.version);
        },
        openDex: function(section2) {
          ui.select("dex");
          ui.drill.dex = "ext:" + key2 + ":" + section2;
          ui.renderContent();
        },
        // 跳到商店里这个扩展的货架（比如菜园缺种子 → 种子货架），按返回回到扩展页（用户 2026-10-09）。
        openShop: function() {
          if (big && desktopRole() !== "ext") {
            ui.extBig = null;
            ui.host.setAttribute("data-ext-view", "");
          }
          ui.select("shop");
          ui.drill.shop = "ext:" + key2;
          ui.drill.from = "ext:" + key2;
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
    let key2 = "";
    try {
      key2 = str(obj(JSON.parse(texts["manifest.json"])).key, "");
    } catch {
      return null;
    }
    return JSON.stringify({ format: "dsh-piggy-extension", version: 1, key: key2, files: texts });
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
  function startInstall(ui, key2) {
    if (download.key !== "") return;
    download = { key: key2, failed: "", error: "" };
    ui.renderContent();
    Promise.resolve(ui.send("installExtension", { key: key2 })).then(function(result) {
      if (download.key !== key2) return;
      if (result !== null && result !== void 0 && result.ok === false) {
        download = { key: "", failed: key2, error: str(result.message, "") || "\u4E0B\u8F7D\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5" };
      } else if (result === null || result === void 0) {
        download = { key: "", failed: key2, error: "\u521A\u624D\u6CA1\u80FD\u9001\u5230\u5BBF\u4E3B\uFF0C\u518D\u70B9\u4E00\u6B21" };
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
  function closingNote(view, key2) {
    if (key2 === "pomodoro" && view.pomodoro !== null && view.pomodoro.active) return "\u6B63\u5728\u4E13\u6CE8\uFF1A\u5173\u6389\u4F1A\u653E\u5F03\u8FD9\u4E00\u4E2A\uFF0C\u4E0D\u7ED9\u5956\u52B1";
    if (key2 === "fishing" && view.activity?.kind === "fishing") return "\u732A\u6B63\u5728\u5916\u9762\u9493\u9C7C\uFF1A\u5173\u6389\u4F1A\u628A\u5B83\u53EB\u56DE\u6765\uFF0C\u9C7C\u9975\u9000\u56DE";
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
  var downloading = (key2) => download.key === key2;
  function installLabel(key2, normal) {
    if (downloading(key2)) return "\u4E0B\u8F7D\u4E2D\u2026";
    return download.failed === key2 ? "\u91CD\u8BD5" : normal;
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
    var note2 = extension.on ? closingNote(ui.view, extension.key) : "";
    if (note2) card2.appendChild(el("div", "dp-ext-note", note2));
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
    const rank = (key2) => key2 === "quit" ? 4 : key2 === "dev" ? 3 : key2 === "settings" ? 2 : key2.startsWith("ext:") ? 1 : 0;
    return apps.slice().sort((a, b) => rank(a.key) - rank(b.key));
  }
  function renderHome(ui, apps) {
    var p = ui.view.pig;
    var head = el("div", "dp-title");
    head.appendChild(el("b", null, p.name + " Lv." + p.level.level));
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
      const now2 = Date.now();
      if (now2 < wheelLock) return;
      wheelLock = now2 + 450;
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
  function alertFor(ui, key2) {
    if (key2 === "update") return ui.updateNotice?.unread ? "!" : "";
    var p = ui.view.pig;
    if (key2 === "status") {
      if (ui.view.dead) return "\u8D70\u4E86";
      if (p.illness !== null) return "\u751F\u75C5";
      if (ui.view.activity !== null) return "\u5728\u5916\u9762";
      return "";
    }
    var icon = ui.icons[key2];
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
  var fish2 = (key2, label, emoji, spot, rarity, times, behavior, difficulty, minCm, maxCm, price) => Object.freeze({ key: key2, label, emoji, spot, rarity, times: Object.freeze(times), behavior, difficulty, minCm, maxCm, price });
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
  var CHARACTER_SCENES = Object.freeze(SKIN_SCENES.filter((scene6) => scene6 !== "fish" && scene6 !== "sleep"));
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

  // packages/pet-core/src/data/lines-dark-humor.js
  var line = (text, reply, personalities) => Object.freeze({
    text,
    ...reply === void 0 ? {} : { replies: Object.freeze([Object.freeze({ label: reply })]) },
    ...personalities === void 0 ? {} : { personalities: Object.freeze(personalities) }
  });
  var scene = (...lines) => Object.freeze(lines);
  var DARK_HUMOR_LINES = Object.freeze({
    eat: scene(
      line("\u4F60\u8BF4\u6211\u4E0B\u996D\uFF0C\u6211\u6709\u70B9\u4E0D\u6562\u63A5\u8BDD", void 0, ["cranky", "shy"]),
      line("\u83DC\u5355\u53EF\u4EE5\u7FFB\uFF0C\u522B\u7FFB\u5230\u6211\u8FD9\u4E00\u9875", void 0, ["cranky"]),
      line("\u996D\u76C6\u662F\u6211\u7684\uFF0C\u9505\u4E0D\u662F\uFF0C\u5BF9\u5427", void 0, ["cranky"]),
      line("\u4F60\u5582\u5F97\u8FD9\u4E48\u9999\uFF0C\u6211\u5F00\u59CB\u5173\u5FC3\u7528\u9014\u4E86", void 0, ["lazy", "goofy"]),
      line("\u591A\u653E\u852C\u83DC\uFF0C\u7ED9\u6211\u4E00\u70B9\u5B89\u5168\u611F", void 0, ["cranky", "curious"]),
      line("\u4F60\u5938\u6211\u8089\u4E4E\u4E4E\uFF0C\u6211\u5148\u5F53\u597D\u8BDD\u542C", void 0, ["snooty", "shy"]),
      line("\u8FD9\u987F\u6211\u5403\u996D\uFF0C\u4E0D\u662F\u6211\u5F53\u996D", void 0, ["cranky"]),
      line("\u5403\u5F97\u597D\u662F\u798F\u6C14\uFF0C\u5403\u592A\u597D\u6709\u70B9\u7D27\u5F20", void 0, ["cranky"]),
      line("\u5148\u8BF4\u597D\uFF0C\u517B\u80D6\u4E0D\u7B49\u4E8E\u814C\u5165\u5473", void 0, ["cranky"]),
      line("\u6211\u5403\u5F97\u5F88\u611F\u52A8\uFF0C\u8BF7\u522B\u987A\u624B\u67E5\u83DC\u8C31", void 0, ["cranky"])
    ),
    full: scene(
      line("\u6211\u73B0\u5728\u5706\u5F97\u5F88\u6709\u98DF\u7528\u8BEF\u4F1A", void 0, ["snooty", "goofy"]),
      line("\u996D\u540E\u522B\u7528\u6311\u897F\u74DC\u7684\u773C\u795E\u770B\u6211", void 0, ["cranky", "shy"]),
      line("\u9971\u662F\u9971\u4E86\uFF0C\u522B\u95EE\u51E0\u5206\u719F", void 0, ["cranky"]),
      line("\u5403\u5230\u8FD9\u4E2A\u4EFD\u4E0A\uFF0C\u6211\u5F97\u5173\u5FC3\u4E00\u4E0B\u4F53\u68C0", void 0, ["lazy", "goofy"]),
      line("\u809A\u5B50\u5F88\u5145\u5B9E\uFF0C\u4EBA\u751F\u6682\u65F6\u6CA1\u522B\u7684\u8FFD\u6C42", void 0, ["lazy"]),
      line("\u8FD9\u4E00\u987F\u4E0B\u53BB\uFF0C\u79E4\u53C8\u6709\u65B0\u95FB\u4E86", void 0, ["cranky", "goofy"]),
      line("\u6211\u53EA\u662F\u5403\u9971\uFF0C\u4E0D\u662F\u5728\u505A\u51FA\u680F\u51C6\u5907", void 0, ["cranky"]),
      line("\u996D\u540E\u9700\u8981\u6D88\u98DF\uFF0C\u4E0D\u9700\u8981\u6492\u5B5C\u7136", void 0, ["cranky"]),
      line("\u9971\u5F97\u60F3\u8EBA\uFF0C\u4F46\u4E0D\u80FD\u8EBA\u7827\u677F\u4E0A", void 0, ["cranky", "goofy"]),
      line("\u73B0\u5728\u7684\u6211\uFF0C\u6700\u597D\u53EA\u7528\u773C\u775B\u6B23\u8D4F", void 0, ["snooty"])
    ),
    overfull: scene(
      line("\u809A\u5B50\u5DF2\u7ECF\u5728\u7533\u8BF7\u6269\u5EFA\u4E86", void 0, ["curious", "goofy"]),
      line("\u518D\u4E00\u53E3\uFF0C\u6211\u5C31\u8981\u91CD\u65B0\u89C4\u5212\u5730\u5F62", void 0, ["goofy"]),
      line("\u4F60\u662F\u5728\u5582\u732A\uFF0C\u8FD8\u662F\u7ED9\u809A\u5B50\u88C5\u4FEE", void 0, ["cranky", "mischievous"]),
      line("\u6211\u4E0D\u662F\u6CA1\u5E95\u7EBF\uFF0C\u6211\u662F\u6CA1\u7A7A\u4F4D", void 0, ["cranky", "goofy"]),
      line("\u518D\u5582\u5C31\u8D85\u8F7D\uFF0C\u5C3E\u5DF4\u4E0D\u662F\u62D6\u8F66\u94A9", void 0, ["cranky", "goofy"]),
      line("\u6211\u8FD9\u809A\u5B50\uFF0C\u5DF2\u7ECF\u4E0D\u63A5\u53D7\u4E34\u65F6\u52A0\u5EA7", void 0, ["cranky", "goofy"]),
      line("\u522B\u529D\u4E86\uFF0C\u8FDE\u9971\u55DD\u90FD\u6392\u4E0D\u4E0A\u961F", void 0, ["cranky", "goofy"]),
      line("\u4F60\u6295\u5582\u7684\u70ED\u60C5\uFF0C\u6211\u7684\u76AE\u88C5\u4E0D\u4E0B", void 0, ["cranky", "goofy"]),
      line("\u73B0\u5728\u6700\u7626\u7684\u5730\u65B9\uFF0C\u5927\u6982\u662F\u94B1\u5305", void 0, ["cranky", "snooty"]),
      line("\u518D\u5403\u4E0B\u53BB\uFF0C\u95E8\u8981\u5F00\u59CB\u53CD\u7701\u81EA\u5DF1", void 0, ["goofy"])
    ),
    bathe: scene(
      line("\u6C34\u6E29\u521A\u597D\uFF0C\u4E0D\u50CF\u8981\u8D77\u9505", void 0, ["cranky", "goofy"]),
      line("\u6D17\u5E72\u51C0\u662F\u4E3A\u4E86\u62B1\uFF0C\u4E0D\u662F\u4E3A\u4E86\u4E0B\u9505", void 0, ["cranky", "shy"]),
      line("\u6413\u53EF\u4EE5\uFF0C\u522B\u987A\u4FBF\u7ED9\u6211\u6253\u82B1\u5200", void 0, ["cranky"]),
      line("\u6D17\u5B8C\u8BF7\u7528\u6BDB\u5DFE\uFF0C\u4E0D\u8981\u7528\u53A8\u623F\u7EB8", void 0, ["cranky"]),
      line("\u6211\u8EAB\u4E0A\u8FD9\u70B9\u6CE5\uFF0C\u5C45\u7136\u6BD4\u6211\u5148\u4E0B\u73ED", void 0, ["lazy", "goofy"]),
      line("\u522B\u5938\u6D17\u5F97\u767D\u767D\u5AE9\u5AE9\uFF0C\u6211\u4F1A\u591A\u60F3", void 0, ["cranky", "shy"]),
      line("\u6CE1\u6CE1\u518D\u591A\uFF0C\u4E5F\u522B\u53EB\u6211\u9C9C\u69A8\u5C0F\u732A", void 0, ["goofy"]),
      line("\u8FD9\u662F\u6FA1\u76C6\uFF0C\u9EBB\u70E6\u522B\u79F0\u4F5C\u5BB9\u5668", void 0, ["cranky", "snooty"]),
      line("\u6D17\u9999\u4E86\u53EF\u4EE5\uFF0C\u5364\u9999\u4E86\u4E0D\u884C", void 0, ["cranky"]),
      line("\u6211\u914D\u5408\u6D17\u6FA1\uFF0C\u8BF7\u4FDD\u7559\u6211\u7684\u751F\u732A\u8EAB\u4EFD", void 0, ["goofy"])
    ),
    play: scene(
      line("\u6211\u8DD1\u5F97\u8FD9\u4E48\u5FEB\uFF0C\u4E3B\u8981\u9760\u60DC\u547D", void 0, ["peppy", "goofy"]),
      line("\u8FD9\u7403\u518D\u96BE\u63A5\uFF0C\u4E5F\u6CA1\u6709\u8001\u677F\u7684\u8BDD\u96BE\u63A5", void 0, ["cranky", "snooty"]),
      line("\u4F60\u4E22\u7403\uFF0C\u6211\u4E22\u8138\uFF0C\u5206\u5DE5\u660E\u786E", void 0, ["mischievous"]),
      line("\u6211\u521A\u624D\u4E0D\u662F\u6454\u5012\uFF0C\u662F\u5411\u5927\u5730\u6C47\u62A5", void 0, ["goofy"]),
      line("\u5C3E\u5DF4\u5DF2\u7ECF\u60F3\u9003\u73ED\u4E86", void 0, ["lazy", "cranky", "earnest"]),
      line("\u8DD1\u5B8C\u8FD9\u5708\uFF0C\u8D4E\u56DE\u4E00\u70B9\u665A\u996D\u7684\u70ED\u91CF", void 0, ["peppy", "goofy"]),
      line("\u7403\u6709\u81EA\u7531\uFF0C\u6211\u6709\u4F60\u558A\u56DE\u6765\u7684\u4E49\u52A1", void 0, ["cranky"]),
      line("\u518D\u8DD1\u5C31\u7626\u4E86\uFF0C\u4F60\u517B\u6B96\u8BA1\u5212\u4F1A\u53D7\u5F71\u54CD", void 0, ["mischievous"]),
      line("\u6251\u7A7A\u7684\u59FF\u52BF\uFF0C\u6211\u5DF2\u7ECF\u5F88\u4E13\u4E1A\u4E86", void 0, ["goofy"]),
      line("\u8FD9\u8FD0\u52A8\u91CF\uFF0C\u591F\u6211\u5728\u68A6\u91CC\u6295\u8BC9\u4E00\u6B21", void 0, ["cranky"])
    ),
    pet: scene(
      line("\u4F60\u6478\u5F97\u8FD9\u4E48\u4ED4\u7EC6\uFF0C\u50CF\u5728\u9A8C\u6536\u8D27\u7269", void 0, ["cranky", "snooty"]),
      line("\u53EF\u7231\u5F52\u53EF\u7231\uFF0C\u522B\u8D34\u4EF7\u683C\u6807\u7B7E", void 0, ["snooty"]),
      line("\u6211\u6536\u7684\u662F\u6478\u6478\uFF0C\u4E0D\u662F\u54C1\u8D28\u62BD\u68C0", void 0, ["cranky", "snooty"]),
      line("\u624B\u6CD5\u8FD9\u4E48\u719F\u7EC3\uFF0C\u4EE5\u524D\u517B\u8FC7\u6795\u5934\u5427", void 0, ["snooty"]),
      line("\u522B\u6478\u5B8C\u5C31\u8BF4\u8FD9\u4E00\u5757\u4E0D\u9519", void 0, ["cranky"]),
      line("\u6211\u5141\u8BB8\u4F60\u63C9\uFF0C\u4E0D\u4EE3\u8868\u80FD\u505A\u8089\u4E38", void 0, ["cranky"]),
      line("\u8F7B\u4E00\u70B9\uFF0C\u6211\u6CA1\u6709\u552E\u540E\u6362\u65B0\u670D\u52A1", void 0, ["cranky"]),
      line("\u6478\u6211\u89E3\u538B\u53EF\u4EE5\uFF0C\u4E0D\u80FD\u987A\u4FBF\u538B\u79E4", void 0, ["cranky"]),
      line("\u6211\u8FD9\u4EFD\u624B\u611F\uFF0C\u7981\u6B62\u5199\u8FDB\u98DF\u8BC4", void 0, ["snooty"]),
      line("\u4F60\u7B11\u5F97\u50CF\u77E5\u9053\u4E86\u6211\u7684\u5E02\u573A\u884C\u60C5", void 0, ["cranky", "snooty"])
    ),
    hungry: scene(
      line("\u996D\u76C6\u7A7A\u5F97\u80FD\u542C\u89C1\u7406\u60F3\u56DE\u58F0", void 0, ["lazy", "goofy"]),
      line("\u518D\u997F\u4E0B\u53BB\uFF0C\u6211\u8981\u5543\u81EA\u5DF1\u7684\u52B3\u52A8\u5408\u540C\u4E86", void 0, ["cranky", "goofy"]),
      line("\u4F60\u5BB6\u7CAE\u98DF\uFF0C\u5B9E\u884C\u7684\u662F\u9965\u997F\u8425\u9500\u5417", void 0, ["cranky"]),
      line("\u6211\u4E0D\u662F\u60F3\u52A0\u9910\uFF0C\u6211\u662F\u60F3\u7EED\u8D39\u547C\u5438", void 0, ["cranky", "goofy"]),
      line("\u809A\u5B50\u5728\u54CD\uFF0C\u5185\u5BB9\u5168\u662F\u50AC\u6B3E", void 0, ["cranky"]),
      line("\u6211\u80FD\u5FCD\uFF0C\u80C3\u5DF2\u7ECF\u5F00\u59CB\u53D1\u4F20\u5355\u4E86", void 0, ["cranky", "goofy"]),
      line("\u996D\u8FD8\u6CA1\u6765\uFF0C\u6211\u5148\u628A\u5C0A\u4E25\u653E\u4E00\u8FB9", void 0, ["cranky", "goofy"]),
      line("\u6211\u76EF\u7740\u996D\u76C6\uFF0C\u996D\u76C6\u88C5\u4F5C\u4E0D\u8BA4\u8BC6\u6211", void 0, ["goofy"]),
      line("\u518D\u4E0D\u5403\uFF0C\u6211\u5C31\u53EA\u5269\u53EF\u7231\u8FD9\u70B9\u8D44\u4EA7\u4E86", void 0, ["cranky", "snooty"]),
      line("\u522B\u6015\u6211\u5403\u7A77\u4F60\uFF0C\u6211\u5DF2\u7ECF\u5148\u997F\u7626\u4E86", void 0, ["cranky", "goofy"])
    ),
    dirty: scene(
      line("\u6211\u8FD9\u4E0D\u662F\u810F\uFF0C\u662F\u6709\u751F\u6D3B\u5305\u6D46", void 0, ["snooty", "goofy"]),
      line("\u82CD\u8747\u628A\u6211\u5F53\u666F\u533A\uFF0C\u8FD8\u4E0D\u4E70\u7968", void 0, ["cranky", "goofy"]),
      line("\u8FD9\u8EAB\u6CE5\uFF0C\u5DF2\u7ECF\u6709\u72EC\u7ACB\u6237\u53E3\u7684\u60F3\u6CD5\u4E86", void 0, ["goofy"]),
      line("\u6211\u518D\u7AD9\u4E00\u4F1A\u513F\uFF0C\u80FD\u957F\u51FA\u5C0F\u533A\u7EFF\u5316", void 0, ["curious", "goofy"]),
      line("\u73B0\u5728\u62B1\u6211\uFF0C\u76F8\u5F53\u4E8E\u4EB2\u8FD1\u5927\u81EA\u7136", void 0, ["mischievous"]),
      line("\u522B\u95FB\u4E86\uFF0C\u6211\u5BF9\u81EA\u5DF1\u4E5F\u6709\u610F\u89C1", void 0, ["cranky"]),
      line("\u6211\u8EAB\u4E0A\u7684\u571F\uFF0C\u6BD4\u94B1\u5305\u91CC\u7684\u5E95\u6C14\u539A", void 0, ["cranky", "goofy"]),
      line("\u8FD9\u6CE5\u5DF4\u518D\u4E0D\u6D17\uFF0C\u5C31\u8981\u6536\u7269\u4E1A\u8D39\u4E86", void 0, ["goofy"]),
      line("\u82CD\u8747\u56F4\u7740\u6211\uFF0C\u50CF\u5F00\u4E86\u514D\u8D39\u98DF\u5802", void 0, ["cranky", "goofy"]),
      line("\u518D\u810F\u4E0B\u53BB\uFF0C\u6211\u5C31\u80FD\u7533\u8BF7\u5F53\u76C6\u683D", void 0, ["goofy"])
    ),
    idle: scene(
      line("\u6211\u6CA1\u6709\u6478\u9C7C\uFF0C\u6211\u5728\u7814\u7A76\u4E0D\u7528\u5DE5\u4F5C\u7684\u732A", void 0, ["lazy"]),
      line("\u4ECA\u5929\u6700\u5927\u7684\u6210\u5C31\uFF0C\u662F\u6CA1\u6709\u88AB\u505A\u6210\u83DC", void 0, ["cranky"]),
      line("\u4F60\u6572\u952E\u76D8\uFF0C\u6211\u6572\u81EA\u5DF1\u7684\u4E0B\u73ED\u949F", void 0, ["lazy"]),
      line("\u6211\u8FD9\u8F88\u5B50\u6700\u5FD9\u7684\u65F6\u5019\uFF0C\u662F\u7B49\u996D", void 0, ["lazy", "goofy"]),
      line("\u6211\u7684\u8FDC\u5927\u7406\u60F3\uFF0C\u6682\u65F6\u8EBA\u5E73\u4FDD\u7BA1", void 0, ["lazy"]),
      line("\u6211\u548C\u8FDB\u5EA6\u6761\u804A\u8FC7\uFF0C\u5B83\u6BD4\u6211\u8FD8\u4F1A\u62D6", void 0, ["goofy"]),
      line("\u521A\u624D\u60F3\u52AA\u529B\u4E00\u4E0B\uFF0C\u88AB\u778C\u7761\u529D\u4F4F\u4E86", void 0, ["lazy"]),
      line("\u6211\u8FD9\u5DE5\u4F5C\u6001\u5EA6\uFF0C\u9002\u5408\u5F53\u5409\u7965\u7269", void 0, ["lazy", "goofy"]),
      line("\u751F\u6D3B\u7ED9\u6211\u538B\u529B\uFF0C\u6211\u7ED9\u751F\u6D3B\u6253\u547C\u565C", void 0, ["lazy"]),
      line("\u522B\u95EE\u6211\u6709\u4EC0\u4E48\u4EA7\u51FA\uFF0C\u6211\u6709\u547C\u565C\u58F0", void 0, ["goofy"])
    ),
    workDone: scene(
      line("\u94B1\u6323\u5230\u4E86\uFF0C\u7075\u9B42\u8FD8\u5728\u5DE5\u4F4D\u4E0A", void 0, ["lazy"]),
      line("\u4ECA\u5929\u7684\u5DE5\u8D44\uFF0C\u591F\u8865\u4E00\u70B9\u7CBE\u795E\u9972\u6599", void 0, ["cranky", "goofy"]),
      line("\u6211\u628A\u8001\u677F\u7684\u8BDD\uFF0C\u7559\u5728\u95E8\u53E3\u6CA1\u5E26\u56DE\u6765", void 0, ["cranky"]),
      line("\u4EBA\u5BB6\u4E0B\u73ED\u6536\u7535\u8111\uFF0C\u6211\u6536\u56DE\u4E00\u6761\u732A\u547D", void 0, ["cranky", "goofy"]),
      line("\u5DE5\u8D44\u4E00\u5230\uFF0C\u75B2\u60EB\u5C31\u6709\u4E86\u5177\u4F53\u6570\u989D", void 0, ["cranky", "goofy"]),
      line("\u6211\u7684\u52B3\u52A8\uFF0C\u52C9\u5F3A\u517B\u5F97\u8D77\u6211\u7684\u80C3", void 0, ["lazy"]),
      line("\u8001\u677F\u5938\u6211\u80FD\u5E72\uFF0C\u6211\u542C\u89C1\u4E86\u52A0\u73ED\u58F0", void 0, ["cranky"]),
      line("\u4E0A\u73ED\u65F6\u662F\u732A\uFF0C\u4E0B\u73ED\u65F6\u662F\u719F\u7EC3\u7684\u732A", void 0, ["goofy"]),
      line("\u6211\u4ECA\u5929\u4E0D\u662F\u6CA1\u813E\u6C14\uFF0C\u662F\u6709\u8003\u52E4", void 0, ["cranky"]),
      line("\u56DE\u6765\u4E00\u79F0\uFF0C\u4F53\u91CD\u6CA1\u6389\uFF0C\u8010\u5FC3\u6389\u4E86", void 0, ["cranky"])
    ),
    tired: scene(
      line("\u6211\u8FD9\u4E0D\u662F\u61D2\uFF0C\u662F\u7535\u91CF\u4E0D\u652F\u6301\u7406\u60F3", void 0, ["lazy"]),
      line("\u4ECA\u5929\u7684\u7CBE\u795E\uFF0C\u5DF2\u7ECF\u63D0\u524D\u4E0B\u73ED", void 0, ["lazy"]),
      line("\u518D\u52AA\u529B\u4E00\u70B9\uFF0C\u8033\u6735\u5C31\u8981\u7533\u8BF7\u5DE5\u4F24", void 0, ["cranky", "goofy"]),
      line("\u6211\u7684\u817F\u8DDF\u6211\u8BF4\uFF0C\u5B83\u6CA1\u7B7E\u52A0\u73ED\u534F\u8BAE", void 0, ["lazy", "cranky"]),
      line("\u8EAB\u5B50\u8FD8\u7AD9\u7740\uFF0C\u7075\u9B42\u5DF2\u7ECF\u76D6\u88AB\u5B50\u4E86", void 0, ["lazy", "goofy"]),
      line("\u8FD9\u4EFD\u75B2\u60EB\uFF0C\u53EF\u4EE5\u62A5\u9500\u5417", void 0, ["cranky"]),
      line("\u6211\u60F3\u632F\u4F5C\uFF0C\u632F\u4F5C\u8BF4\u5B83\u4ECA\u5929\u4F11\u5047", void 0, ["lazy", "goofy"]),
      line("\u522B\u50AC\u4E86\uFF0C\u8FDE\u5C3E\u5DF4\u90FD\u5728\u88C5\u6B7B", void 0, ["cranky", "lazy"]),
      line("\u73B0\u5728\u62AC\u5934\uFF0C\u5C5E\u4E8E\u8D85\u51FA\u804C\u8D23\u8303\u56F4", void 0, ["cranky"]),
      line("\u6211\u5148\u8EBA\u4F1A\u513F\uFF0C\u7ED9\u751F\u6D3B\u4E00\u70B9\u963B\u529B", void 0, ["lazy", "goofy"])
    ),
    study: scene(
      line("\u77E5\u8BC6\u8FDB\u8111\u5B50\u4E4B\u524D\uFF0C\u5148\u6572\u4E86\u4E09\u6B21\u95E8", void 0, ["goofy"]),
      line("\u6211\u548C\u7B54\u6848\u4E4B\u95F4\uFF0C\u9694\u7740\u4E00\u70B9\u667A\u5546\u7A0E", void 0, ["goofy"]),
      line("\u4E66\u7FFB\u5F97\u5F88\u5FEB\uFF0C\u8111\u5B50\u8FD8\u5728\u76EE\u5F55\u9875", void 0, ["goofy"]),
      line("\u6211\u5DF2\u7ECF\u5F88\u52AA\u529B\u4E86\uFF0C\u77E5\u8BC6\u8FD8\u4E0D\u80AF\u8BA4\u6211", void 0, ["goofy"]),
      line("\u8FD9\u9898\u8981\u662F\u80FD\u5403\uFF0C\u6211\u65E9\u89E3\u51B3\u4E86", void 0, ["goofy"]),
      line("\u5B66\u6D77\u65E0\u6DAF\uFF0C\u6211\u5148\u627E\u5757\u6D6E\u677F", void 0, ["goofy"]),
      line("\u6211\u76EF\u7740\u9898\uFF0C\u9898\u50CF\u5728\u76EF\u4E00\u76D8\u732A\u8111", void 0, ["cranky"]),
      line("\u8111\u5B50\u88C5\u4E0D\u4E0B\uFF0C\u80FD\u5148\u5BC4\u5B58\u5728\u8033\u6735\u91CC\u5417", void 0, ["goofy"]),
      line("\u8FD9\u672C\u4E66\u6709\u70B9\u91CD\uFF0C\u4E3B\u8981\u91CD\u5728\u5FC3\u7406\u8D1F\u62C5", void 0, ["goofy"]),
      line("\u4ECA\u5929\u6CA1\u767D\u5B66\uFF0C\u81F3\u5C11\u77E5\u9053\u81EA\u5DF1\u4E0D\u4F1A\u4E86", void 0, ["goofy"])
    ),
    workStart: scene(
      line("\u51FA\u53D1\uFF0C\u53BB\u628A\u9972\u6599\u94B1\u6362\u56DE\u6765", void 0, ["lazy", "earnest"]),
      line("\u8001\u677F\u62DB\u7684\u662F\u5458\u5DE5\uFF0C\u6765\u7684\u662F\u4E00\u53EA\u996D\u91CF", void 0, ["goofy"]),
      line("\u6211\u5E26\u7740\u5E72\u52B2\u51FA\u95E8\uFF0C\u4E89\u53D6\u5B8C\u6574\u5E26\u56DE\u6765", void 0, ["lazy", "cranky"]),
      line("\u4E0A\u73ED\u53EA\u662F\u8C0B\u751F\uFF0C\u4E0D\u662F\u6539\u53D8\u7269\u79CD"),
      line("\u6211\u7684\u7406\u60F3\u5F88\u8FDC\uFF0C\u996D\u70B9\u5F88\u8FD1", void 0, ["lazy"]),
      line("\u5DE5\u724C\u4E00\u6302\uFF0C\u91CE\u732A\u53D8\u5BB6\u732A", void 0, ["goofy"]),
      line("\u6211\u53BB\u5356\u70B9\u529B\u6C14\uFF0C\u522B\u628A\u6574\u53EA\u7B97\u8FDB\u53BB", void 0, ["cranky"]),
      line("\u4ECA\u65E5\u8425\u4E1A\uFF0C\u70ED\u60C5\u6309\u5DE5\u8D44\u4F9B\u5E94", void 0, ["cranky"]),
      line("\u6211\u5148\u53BB\u4E0A\u73ED\uFF0C\u5C0A\u4E25\u653E\u4F60\u8FD9\u513F\u4FDD\u7BA1", void 0, ["cranky"]),
      line("\u518D\u7A77\u4E0D\u80FD\u7A77\u996D\u76C6\uFF0C\u6211\u51FA\u95E8\u4E86", void 0, ["earnest"])
    ),
    buy: scene(
      line("\u8FD9\u4E2A\u4E00\u4E70\uFF0C\u94B1\u5305\u8F7B\u5F97\u80FD\u98D8", void 0, ["cranky"]),
      line("\u5FEB\u4E50\u62FF\u5230\u624B\uFF0C\u4F59\u989D\u8D1F\u8D23\u5584\u540E", void 0, ["cranky", "goofy"]),
      line("\u8FD9\u4E1C\u897F\u771F\u597D\uFF0C\u4EF7\u94B1\u4E5F\u5F88\u6709\u4E3B\u89C1", void 0, ["cranky"]),
      line("\u4E70\u4E4B\u524D\u662F\u559C\u6B22\uFF0C\u4E70\u4E4B\u540E\u662F\u73CD\u60DC", void 0, ["snooty", "shy"]),
      line("\u8D2D\u7269\u888B\u7AD9\u8D77\u6765\u4E86\uFF0C\u94B1\u5305\u8EBA\u4E0B\u4E86", void 0, ["goofy"]),
      line("\u94B1\u6CA1\u6709\u6D88\u5931\uFF0C\u53EA\u662F\u6362\u4E86\u4E2A\u5730\u65B9\u59D3\u522B\u4EBA", void 0, ["cranky", "goofy"]),
      line("\u6211\u7528\u91D1\u5E01\u6362\u6765\u4E86\u4E00\u70B9\u77ED\u6682\u7684\u786C\u6C14", void 0, ["cranky"]),
      line("\u4E1C\u897F\u5230\u5BB6\uFF0C\u7406\u6027\u521A\u521A\u51FA\u95E8", void 0, ["goofy"]),
      line("\u4E70\u5F97\u8D77\u8FD9\u4E00\u523B\uFF0C\u517B\u4E0D\u8D77\u8FD9\u4E2A\u4E60\u60EF", void 0, ["cranky", "snooty"]),
      line("\u5148\u522B\u95EE\u503C\u4E0D\u503C\uFF0C\u95EE\u5C31\u662F\u5DF2\u7ECF\u4E70\u4E86", void 0, ["goofy"])
    ),
    poor: scene(
      line("\u6211\u7684\u8D44\u4EA7\uFF0C\u4E3B\u8981\u662F\u8138\u76AE\u548C\u996D\u91CF", void 0, ["cranky", "goofy"]),
      line("\u94B1\u5305\u5F00\u53E3\u8BF4\u8BDD\u4E86\uFF0C\u5B83\u8BF4\u6CA1\u6709", void 0, ["goofy"]),
      line("\u6211\u73B0\u5728\u7A77\u5F97\u5F88\u7A33\u5B9A", void 0, ["cranky", "goofy"]),
      line("\u96F6\u94B1\u4E0D\u662F\u6CA1\u6709\uFF0C\u662F\u90FD\u53D8\u6210\u96F6\u4E86", void 0, ["goofy"]),
      line("\u6211\u548C\u5BCC\u6709\uFF0C\u53EA\u5DEE\u4E00\u4E2A\u6709\u94B1\u7684\u6211", void 0, ["goofy"]),
      line("\u8D2D\u7269\u8F66\u5F88\u70ED\u95F9\uFF0C\u94B1\u5305\u5F88\u5B89\u9759", void 0, ["goofy"]),
      line("\u8FD9\u70B9\u5B58\u6B3E\uFF0C\u8FDE\u505A\u68A6\u90FD\u5F97\u6311\u6253\u6298\u7684", void 0, ["goofy"]),
      line("\u5148\u4E0D\u4E70\uFF0C\u7ED9\u8D2B\u7A77\u7559\u70B9\u5C0A\u4E25", void 0, ["cranky"]),
      line("\u6211\u7684\u94B1\u5F88\u542C\u8BDD\uFF0C\u8BF4\u6CA1\u5C31\u6CA1", void 0, ["goofy"]),
      line("\u624B\u5934\u4E0D\u5BBD\u88D5\uFF0C\u809A\u5B50\u5012\u633A\u5BBD\u88D5", void 0, ["cranky", "goofy"])
    ),
    fishCatch: scene(
      line("\u5B83\u521A\u4E0A\u5CB8\uFF0C\u6211\u5C31\u5F00\u59CB\u89C4\u5212\u665A\u996D", void 0, ["mischievous"]),
      line("\u9C7C\u770B\u7740\u6211\uFF0C\u5927\u6982\u4E5F\u5728\u6000\u5FF5\u4E0A\u73ED", void 0, ["cranky", "goofy"]),
      line("\u9C7C\u7AFF\u4E00\u54CD\uFF0C\u6211\u4FE9\u547D\u8FD0\u5C31\u5206\u53C9\u4E86", void 0, ["goofy"]),
      line("\u6211\u8D1F\u8D23\u9493\uFF0C\u5B83\u8D1F\u8D23\u4E0D\u592A\u60C5\u613F", void 0, ["goofy"]),
      line("\u521A\u624D\u8FD8\u5728\u6C34\u91CC\u81EA\u7531\uFF0C\u73B0\u5728\u5F52\u6876\u7BA1\u7406", void 0, ["goofy"]),
      line("\u4ECA\u5929\u5B83\u8FD0\u6C14\u5DEE\uFF0C\u6211\u8FD0\u6C14\u597D", void 0, ["cranky", "goofy"]),
      line("\u8FD9\u6761\u9C7C\uFF0C\u66FF\u7A7A\u519B\u7684\u6211\u633D\u56DE\u4E86\u9762\u5B50", void 0, ["snooty"]),
      line("\u5148\u522B\u95EE\u9C7C\u613F\u4E0D\u613F\u610F\uFF0C\u5B83\u4E0D\u80AF\u7B54\u8BDD", void 0, ["mischievous"]),
      line("\u6211\u6CA1\u6709\u6280\u672F\uFF0C\u5168\u9760\u9C7C\u5076\u5C14\u60F3\u4E0D\u5F00", void 0, ["goofy"]),
      line("\u5B83\u54AC\u7684\u662F\u94A9\uFF0C\u6551\u7684\u662F\u6211\u7684\u665A\u996D", void 0, ["goofy"])
    ),
    fishEscape: scene(
      line("\u5B83\u8D70\u5F97\u5F88\u6F47\u6D12\uFF0C\u50CF\u62FF\u4E86\u79BB\u804C\u8BC1\u660E", void 0, ["cranky", "goofy"]),
      line("\u9C7C\u6CA1\u4E0A\u6765\uFF0C\u81EA\u5C0A\u5148\u6C89\u5E95\u4E86", void 0, ["goofy"]),
      line("\u6211\u7684\u9975\u6210\u4E86\u6C34\u4E0B\u81EA\u52A9\u9910", void 0, ["goofy"]),
      line("\u8FD9\u4E00\u7AFF\uFF0C\u5582\u9971\u4E86\u9C7C\uFF0C\u997F\u9192\u4E86\u6211", void 0, ["goofy"]),
      line("\u9C7C\u90FD\u80FD\u8DD1\u8DEF\uFF0C\u6211\u8FD8\u5F97\u7B49\u4E0B\u73ED", void 0, ["cranky"]),
      line("\u6280\u672F\u6CA1\u957F\u8FDB\uFF0C\u6CB3\u91CC\u591A\u4E86\u987F\u996D", void 0, ["goofy"]),
      line("\u5B83\u7ED9\u6211\u4E0A\u7684\u8BFE\uFF0C\u6536\u8D39\u662F\u9C7C\u9975", void 0, ["goofy"]),
      line("\u4ECA\u5929\u9C7C\u4E0D\u4E0A\u73ED\uFF0C\u6211\u767D\u7AD9\u5C97\u4E86", void 0, ["cranky"]),
      line("\u6211\u8DDF\u665A\u996D\uFF0C\u64E6\u80A9\u800C\u8FC7", void 0, ["goofy"]),
      line("\u4E0B\u6B21\u518D\u9047\u89C1\uFF0C\u54B1\u4EEC\u5148\u8C08\u8C08\u804C\u4E1A\u9053\u5FB7", void 0, ["cranky"])
    ),
    skin: scene(
      line("\u6362\u8EAB\u8863\u670D\uFF0C\u5047\u88C5\u6DA8\u4E86\u8EAB\u4EF7", void 0, ["snooty"]),
      line("\u5305\u88C5\u5347\u7EA7\uFF0C\u91CC\u9762\u8FD8\u662F\u539F\u88C5\u996D\u6876", void 0, ["goofy"]),
      line("\u8FD9\u5957\u770B\u7740\u6709\u94B1\uFF0C\u94B1\u5305\u4E0D\u540C\u610F", void 0, ["snooty"]),
      line("\u4ECA\u5929\u7A7F\u5F97\u4F53\u9762\uFF0C\u4E89\u53D6\u5C11\u88AB\u53EB\u4E94\u82B1", void 0, ["snooty"]),
      line("\u8863\u670D\u8D8A\u6F02\u4EAE\uFF0C\u8D8A\u4E0D\u80FD\u5F53\u56F4\u88D9", void 0, ["cranky"]),
      line("\u6211\u8FD9\u8EAB\u6253\u626E\uFF0C\u591F\u62B5\u6321\u4E00\u70B9\u751F\u6D3B\u5417", void 0, ["cranky", "goofy"]),
      line("\u5916\u8868\u5F88\u80FD\u5E72\uFF0C\u91CC\u9762\u5F88\u60F3\u7761", void 0, ["cranky"]),
      line("\u7A7F\u4E0A\u65B0\u8863\u670D\uFF0C\u8D2B\u7A77\u4E5F\u6709\u4E86\u65B0\u6837\u5B50", void 0, ["goofy"]),
      line("\u770B\u7740\u50CF\u8D35\u5BBE\uFF0C\u5403\u996D\u8FD8\u662F\u5927\u76C6", void 0, ["goofy"]),
      line("\u6211\u53EF\u4EE5\u50CF\u5927\u53A8\uFF0C\u4E0D\u80FD\u50CF\u98DF\u6750", void 0, ["cranky", "mischievous"])
    ),
    bodyChange: scene(
      line("\u53EF\u7231\u6D53\u5EA6\u53D8\u4E86\uFF0C\u51FA\u680F\u65E5\u671F\u522B\u8DDF\u7740\u53D8", void 0, ["cranky", "snooty"]),
      line("\u4F60\u76EF\u7740\u79E4\uFF0C\u6211\u76EF\u7740\u4F60\u6709\u6CA1\u6709\u5F00\u706B", void 0, ["cranky"]),
      line("\u4F53\u578B\u4E00\u53D8\uFF0C\u95E8\u6846\u5F00\u59CB\u7D27\u5F20", void 0, ["goofy"]),
      line("\u5706\u662F\u5916\u5F62\uFF0C\u8EBA\u5E73\u662F\u6001\u5EA6", void 0, ["goofy"]),
      line("\u809A\u76AE\u53D8\u5927\uFF0C\u62B1\u8D1F\u8FD8\u662F\u996D\u76C6\u90A3\u4E48\u5927", void 0, ["lazy", "goofy"]),
      line("\u6211\u53EA\u662F\u6362\u4E86\u5C3A\u5BF8\uFF0C\u4E0D\u63A5\u53D7\u6309\u65A4\u8BA1\u4EF7", void 0, ["cranky"]),
      line("\u770B\u6E05\u695A\uFF0C\u8FD9\u662F\u5BA0\u7269\u5C55\u793A\uFF0C\u4E0D\u662F\u8089\u6863", void 0, ["cranky"]),
      line("\u7626\u7684\u65F6\u5019\u8F7B\u76C8\uFF0C\u80D6\u7684\u65F6\u5019\u6709\u5206\u91CF\u7684\u70E6\u607C", void 0, ["cranky", "goofy"]),
      line("\u79E4\u53EA\u62A5\u4F53\u91CD\uFF0C\u4E0D\u62A5\u6211\u6709\u591A\u59D4\u5C48", void 0, ["cranky"]),
      line("\u8FD9\u8EAB\u8089\u90FD\u662F\u76F8\u5904\u6765\u7684\uFF0C\u4E0D\u80FD\u6253\u5305\u5E26\u8D70", void 0, ["cranky", "clingy"])
    ),
    petTooMuch: scene(
      line("\u4F60\u8FD9\u662F\u6478\u732A\uFF0C\u8FD8\u662F\u76D8\u7B97\u5E74\u591C\u996D", void 0, ["cranky"]),
      line("\u518D\u76D8\u6211\uFF0C\u6211\u5C31\u8981\u5F53\u4F20\u5BB6\u5B9D\u4E86", void 0, ["snooty", "goofy"]),
      line("\u4ECA\u5929\u7684\u629A\u6478\uFF0C\u5DF2\u7ECF\u8FDB\u5165\u52A0\u73ED\u9636\u6BB5", void 0, ["cranky"]),
      line("\u4F60\u5148\u6B47\u6B47\uFF0C\u6211\u7684\u5BB3\u7F9E\u4E5F\u6709\u52B3\u52A8\u6CD5", void 0, ["cranky"]),
      line("\u522B\u628A\u6211\u63C9\u5165\u5473\uFF0C\u54B1\u4FE9\u8FD8\u8981\u8FC7\u65E5\u5B50", void 0, ["cranky", "clingy"]),
      line("\u8FD9\u4E48\u4ED4\u7EC6\uFF0C\u4F60\u662F\u4E0D\u662F\u5728\u627E\u4FDD\u4FEE\u6807\u7B7E", void 0, ["cranky", "curious"]),
      line("\u6478\u591F\u4E86\u8BB0\u5F97\u5F52\u8FD8\u5C0F\u732A\u7684\u81EA\u4E3B\u6743", void 0, ["cranky"]),
      line("\u6211\u5141\u8BB8\u4EB2\u8FD1\uFF0C\u6CA1\u5141\u8BB8\u9762\u56E2\u5316", void 0, ["goofy"]),
      line("\u518D\u4E0D\u6536\u624B\uFF0C\u6211\u5C31\u7ED9\u624B\u6307\u53D1\u5DE5\u8D44\u4E86", void 0, ["cranky", "mischievous"]),
      line("\u6478\u5230\u73B0\u5728\uFF0C\u4F60\u624B\u4E0A\u5E94\u8BE5\u6709\u732A\u763E\u4E86", void 0, ["goofy"])
    )
  });

  // packages/pet-core/src/data/lines-companion-care.js
  var line2 = (text, reply, personalities) => Object.freeze({
    text,
    ...reply === void 0 ? {} : { replies: Object.freeze([Object.freeze({ label: reply })]) },
    ...personalities === void 0 ? {} : { personalities: Object.freeze(personalities) }
  });
  var scene2 = (...lines) => Object.freeze(lines);
  var COMPANION_CARE_LINES = Object.freeze({
    wake: scene2(
      line2("\u5514\uFF0C\u5148\u8BA9\u6211\u628A\u68A6\u653E\u597D", void 0, ["lazy", "goofy"]),
      line2("\u8C01\u5728\u53EB\u4E00\u53EA\u8FD8\u6CA1\u5F00\u673A\u7684\u732A", void 0, ["lazy", "cranky", "goofy"]),
      line2("\u9192\u5566\uFF0C\u7B2C\u4E00\u773C\u5C31\u627E\u4F60", void 0, ["peppy", "clingy"]),
      line2("\u7B49\u4E00\u4E0B\uFF0C\u8033\u6735\u8FD8\u6CA1\u9192", void 0, ["goofy"]),
      line2("\u6211\u521A\u68A6\u5230\u4F60\u7ED9\u6211\u52A0\u9910", void 0, ["lazy", "curious"]),
      line2("\u628A\u6211\u62B1\u7A33\uFF0C\u6211\u8FD8\u8FF7\u7CCA\u7740", void 0, ["lazy", "shy", "normal"]),
      line2("\u662F[\u4E3B\u4EBA]\u5440\uFF0C\u90A3\u6211\u4E0D\u56F0\u4E86", "\u9192\u9192\u5566", ["peppy", "clingy"]),
      line2("\u8D77\u5E8A\u53EF\u4EE5\uFF0C\u62B1\u4E00\u4E0B\u5148", "\u62B1\u62B1", ["clingy", "shy"]),
      line2("\u6211\u9192\u4E86\uFF0C\u778C\u7761\u8FD8\u5728\u8DEF\u4E0A", void 0, ["lazy", "goofy"]),
      line2("\u4ECA\u5929\u4E5F\u4ECE\u770B\u89C1\u4F60\u5F00\u59CB", void 0, ["normal", "earnest"])
    ),
    eat: scene2(
      line2("\u8FD9\u4E00\u53E3\uFF0C\u6211\u8981\u8BA4\u771F\u56BC", void 0, ["earnest"]),
      line2("\u996D\u76C6\u7A7A\u4E0B\u53BB\uFF0C\u5FEB\u4E50\u6EE1\u8D77\u6765", void 0, ["peppy", "goofy", "snooty"]),
      line2("\u7ED9\u4F60\u7559\u4E00\u53E3\uFF0C\u6211\u5148\u95FB\u95FB", void 0, ["sisterly", "mischievous"]),
      line2("\u5634\u5DF4\u5F88\u5FD9\uFF0C\u8033\u6735\u5728\u542C\u4F60", void 0, ["normal", "earnest"]),
      line2("\u5403\u5230\u4E86\uFF0C\u662F\u88AB\u60E6\u8BB0\u7684\u5473\u9053"),
      line2("[\u4E3B\u4EBA]\u5582\u7684\uFF0C\u8981\u591A\u56BC\u4E24\u4E0B", void 0, ["clingy", "shy", "earnest"]),
      line2("\u6211\u8FDE\u996D\u76C6\u8FB9\u8FB9\u90FD\u68C0\u67E5\u4E86", void 0, ["earnest", "curious"]),
      line2("\u518D\u9760\u8FD1\u70B9\uFF0C\u6211\u60F3\u6328\u7740\u4F60\u5403", "\u6162\u6162\u5403", ["clingy", "shy"]),
      line2("\u8FD9\u4E00\u987F\uFF0C\u503C\u5F97\u6447\u4E09\u4E0B\u5C3E\u5DF4", "\u597D\u5403\u5427", ["peppy", "curious"]),
      line2("\u5403\u996D\u524D\u8FD8\u60F3\u4F60\uFF0C\u5403\u996D\u65F6\u4E5F\u662F", void 0, ["clingy"])
    ),
    full: scene2(
      line2("\u809A\u76AE\u5DF2\u7ECF\u66FF\u6211\u8BF4\u8C22\u8C22\u4E86", void 0, ["goofy"]),
      line2("\u996D\u76C6\u6BD5\u4E1A\uFF0C\u6211\u53BB\u65C1\u8FB9\u5750\u5750", void 0, ["normal", "lazy", "goofy"]),
      line2("\u73B0\u5728\u53EF\u4EE5\u5B89\u5FC3\u5F53\u4E2A\u5C0F\u9760\u6795", void 0, ["lazy", "clingy"]),
      line2("\u5403\u9971\u4E86\uFF0C\u60F3\u8D34\u7740\u4F60\u6B47\u4E00\u6B47", "\u6765\u5427", ["clingy", "shy", "normal"]),
      line2("\u809A\u5B50\u9F13\u9F13\uFF0C\u813E\u6C14\u8F6F\u8F6F", void 0, ["lazy", "goofy"]),
      line2("\u6211\u628A\u6700\u540E\u4E00\u53E3\u85CF\u8FDB\u5E78\u798F\u91CC\u4E86", void 0, ["clingy", "shy"]),
      line2("\u4ECA\u5929\u7684\u996D\uFF0C\u8BB0\u5728\u5F00\u5FC3\u90A3\u4E00\u9875", void 0, ["earnest"]),
      line2("\u4E0D\u7528\u518D\u76DB\u5566\uFF0C\u966A\u6211\u5750\u4E00\u4F1A\u513F", "\u966A\u7740\u5462", ["normal", "clingy", "sisterly"]),
      line2("\u6211\u73B0\u5728\u8D70\u8DEF\u90FD\u5E26\u7740\u6EE1\u8DB3", void 0, ["peppy", "goofy"]),
      line2("\u9971\u55DD\u5F88\u5C0F\uFF0C\u559C\u6B22\u4F60\u5F88\u591A", void 0, ["clingy", "shy"])
    ),
    overfull: scene2(
      line2("\u809A\u5B50\u8BF4\uFF0C\u5B83\u9700\u8981\u4E00\u70B9\u7A7A\u95F2", void 0, ["normal", "lazy"]),
      line2("\u8FD9\u53E3\u5148\u6B20\u7740\uFF0C\u597D\u4E0D\u597D", "\u597D"),
      line2("\u6211\u5F80\u540E\u9000\uFF0C\u662F\u996D\u592A\u70ED\u60C5\u4E86", void 0, ["cranky", "goofy"]),
      line2("\u996D\u76C6\u5148\u4F11\u606F\uFF0C\u6211\u4E5F\u4F11\u606F", void 0, ["lazy"]),
      line2("\u522B\u529D\u5566\uFF0C\u8FDE\u5C3E\u5DF4\u90FD\u88C5\u4E0D\u4E0B\u4E86", void 0, ["cranky"]),
      line2("\u73B0\u5728\u5F2F\u8170\uFF0C\u4F1A\u78B0\u5230\u521A\u624D\u90A3\u987F\u996D", void 0, ["goofy"]),
      line2("\u6211\u60F3\u62B1\u4F60\uFF0C\u53EF\u4E2D\u95F4\u591A\u4E86\u4E2A\u809A\u5B50", void 0, ["clingy", "shy"]),
      line2("\u8FD9\u4E00\u53E3\u80FD\u7559\u5230\u68A6\u91CC\u5403\u5417", "\u7559\u7740\u5427", ["lazy", "goofy"]),
      line2("\u809A\u76AE\u5DF2\u7ECF\u5706\u6EE1\u5B8C\u6210\u4EFB\u52A1", void 0, ["earnest"]),
      line2("\u6211\u5BA3\u5E03\uFF0C\u7B77\u5B50\u53EF\u4EE5\u4E0B\u73ED\u4E86", void 0, ["cranky", "mischievous"])
    ),
    bathe: scene2(
      line2("\u5E2E\u6211\u770B\u770B\uFF0C\u8033\u6735\u540E\u9762\u5E72\u51C0\u6CA1", void 0, ["earnest", "curious"]),
      line2("\u6CE1\u6CE1\u522B\u8DD1\uFF0C\u6211\u8FD8\u6CA1\u6570\u5B8C", void 0, ["curious", "mischievous"]),
      line2("\u6D17\u4E00\u534A\u7684\u732A\u4E0D\u80FD\u968F\u4FBF\u62B1\u8D70", void 0, ["cranky"]),
      line2("\u4F60\u6413\u54EA\u91CC\uFF0C\u6211\u5C31\u6B6A\u54EA\u8FB9", void 0, ["goofy"]),
      line2("\u8F7B\u4E00\u70B9\uFF0C\u90A3\u662F\u8033\u6735\u4E0D\u662F\u62B9\u5E03", void 0, ["cranky"]),
      line2("\u6D17\u9999\u4E86\uFF0C\u60F3\u7B2C\u4E00\u4E2A\u8E6D\u4F60", "\u8FC7\u6765\u5427", ["clingy", "shy"]),
      line2("\u6BDB\u5DFE\u4E5F\u8981\u62B1\u6211\u4E00\u4E0B", void 0, ["goofy", "clingy"]),
      line2("\u6C34\u73E0\u6302\u9F3B\u5C16\uFF0C\u6709\u70B9\u75D2", void 0, ["goofy", "curious"]),
      line2("\u4ECA\u5929\u7684\u6CE5\u5DF4\uFF0C\u660E\u5929\u518D\u89C1", void 0, ["lazy", "mischievous"]),
      line2("\u6D17\u5B8C\u5566\uFF0C\u8981\u4E00\u5757\u5E72\u51C0\u7684\u62B1\u62B1", "\u62B1\u62B1", ["clingy", "peppy", "shy"])
    ),
    play: scene2(
      line2("\u7403\u5F80\u54EA\u8D70\uFF0C\u6211\u5C31\u5F80\u54EA\u62D0", void 0, ["peppy", "goofy"]),
      line2("\u6211\u8D1F\u8D23\u8FFD\uFF0C\u4F60\u8D1F\u8D23\u7B11", void 0, ["peppy", "mischievous"]),
      line2("\u521A\u521A\u90A3\u4E0B\u4E0D\u7B97\uFF0C\u6211\u8033\u6735\u6321\u773C\u4E86", void 0, ["goofy"]),
      line2("\u522B\u5938\u592A\u65E9\uFF0C\u6211\u8FD8\u4F1A\u518D\u6251\u7A7A", void 0, ["shy"]),
      line2("\u4ECA\u5929\u7684\u5F00\u5FC3\uFF0C\u6709\u4F60\u7684\u4EFD", void 0, ["sisterly", "normal"]),
      line2("\u518D\u966A\u6211\u4E00\u5C0F\u8F6E\u597D\u4E0D\u597D", "\u518D\u4E00\u8F6E", ["peppy", "clingy"]),
      line2("\u6211\u628A\u70E6\u607C\u5F53\u7403\u8E22\u8D70\u4E86", void 0, ["peppy", "mischievous"]),
      line2("\u7B49\u7B49\uFF0C\u5C3E\u5DF4\u8FD8\u6CA1\u8DDF\u4E0A", void 0, ["goofy"]),
      line2("\u7403\u53EF\u4EE5\u6B47\uFF0C\u4F60\u522B\u8D70\u5440", "\u8FD8\u5728\u5462", ["clingy"]),
      line2("\u8D62\u6CA1\u8D62\u4E0D\u91CD\u8981\uFF0C\u4F60\u770B\u6211\u4E86\u5417", void 0, ["peppy"])
    ),
    pet: scene2(
      line2("\u6478\u8FD9\u91CC\uFF0C\u5BF9\uFF0C\u5C31\u662F\u8FD9\u91CC", void 0, ["peppy", "mischievous"]),
      line2("\u624B\u522B\u8D70\uFF0C\u6211\u5DF2\u7ECF\u9760\u8FC7\u53BB\u4E86", "\u4E0D\u8D70", ["clingy"]),
      line2("\u4F60\u4E00\u6478\uFF0C\u6211\u7684\u5FC3\u5C31\u8F6F\u4E00\u5757"),
      line2("\u4ECA\u5929\u7684\u5C0F\u732A\u4E5F\u9700\u8981\u5145\u7535", void 0, ["peppy", "clingy", "shy"]),
      line2("\u4F60\u6478\u8111\u888B\uFF0C\u6211\u5077\u5077\u559C\u6B22\u4F60", void 0, ["peppy", "shy"]),
      line2("\u6211\u5F80\u4F60\u624B\u5FC3\u91CC\u8E6D\u4E00\u70B9\u70B9", void 0, ["clingy", "shy", "normal"]),
      line2("\u53EF\u4EE5\u628A\u8FD9\u53EA\u624B\u501F\u6211\u6795\u4E00\u4E0B\u5417", "\u501F\u7ED9\u4F60", ["lazy", "clingy"]),
      line2("\u6478\u4E00\u4E0B\u7B97\u4E00\u4E0B\uFF0C\u4E0D\u8BB8\u8D56\u8D26", void 0, ["cranky", "mischievous"]),
      line2("\u6211\u90FD\u772F\u773C\u4E86\uFF0C\u4F60\u5E94\u8BE5\u61C2\u5427", void 0, ["normal", "shy"]),
      line2("[\u4E3B\u4EBA]\u7684\u624B\uFF0C\u6211\u8BA4\u5F97\u51FA\u6765", void 0, ["clingy", "shy", "normal", "earnest"])
    ),
    hungry: scene2(
      line2("\u6211\u7684\u996D\u76C6\u5728\u7B49\u4E00\u4E2A\u5947\u8FF9", void 0, ["curious", "goofy"]),
      line2("\u809A\u5B50\u5495\u565C\uFF0C\u662F\u5B83\u5148\u5F00\u53E3\u7684"),
      line2("\u6211\u6CA1\u6709\u50AC\uFF0C\u53EA\u662F\u8DEF\u8FC7\u996D\u76C6", void 0, ["cranky", "shy", "mischievous", "snooty"]),
      line2("\u60F3\u5403\u996D\uFF0C\u4E5F\u60F3\u4F60\u5750\u8FD1\u4E00\u70B9", void 0, ["clingy", "shy", "normal"]),
      line2("\u6211\u628A\u5403\u996D\u7684\u4F4D\u7F6E\u7ED9\u4F60\u7559\u597D\u4E86", void 0, ["sisterly", "earnest"]),
      line2("\u80FD\u4E0D\u80FD\u5148\u7ED9\u9F3B\u5B50\u95FB\u4E00\u5C0F\u53E3", void 0, ["curious", "goofy"]),
      line2("\u996D\u996D\u6765\u4E4B\u524D\uFF0C\u62B1\u62B1\u4E5F\u884C", "\u9A6C\u4E0A\u5582\u4F60", ["clingy", "shy"]),
      line2("\u6211\u8BA4\u771F\u7B49\u996D\uFF0C\u987A\u4FBF\u8BA4\u771F\u770B\u4F60"),
      line2("\u4ECA\u5929\u7684\u809A\u5B50\u6709\u70B9\u8BDD\u591A", void 0, ["cranky", "peppy", "goofy"]),
      line2("\u4E00\u5C0F\u53E3\u5C31\u80FD\u54C4\u597D\u6211\uFF0C\u771F\u7684", "\u6765\u4E86", ["clingy", "peppy", "shy"])
    ),
    dirty: scene2(
      line2("\u6211\u548C\u6CE5\u5DF4\u73A9\u5F97\u592A\u719F\u4E86", void 0, ["goofy", "mischievous"]),
      line2("\u9F3B\u5B50\u8FD8\u662F\u5E72\u51C0\u7684\uFF0C\u53EF\u4EE5\u5148\u78B0\u4E00\u4E0B", void 0, ["curious", "shy"]),
      line2("\u522B\u5ACC\u6211\u5440\uFF0C\u6D17\u5B8C\u8FD8\u662F\u4F60\u7684\u5C0F\u732A", "\u4E0D\u5ACC\u4F60", ["clingy", "shy"]),
      line2("\u8FD9\u5C42\u7070\uFF0C\u4E0D\u662F\u65B0\u4E70\u7684\u8863\u670D", void 0, ["curious", "goofy"]),
      line2("\u6211\u8D70\u8FC7\u7684\u8DEF\uFF0C\u6CE5\u5DF4\u90FD\u8BB0\u5F97", void 0, ["earnest"]),
      line2("\u8EAB\u4E0A\u6709\u70B9\u4E71\uFF0C\u5FC3\u91CC\u5F88\u4E56", void 0, ["normal", "shy"]),
      line2("\u80FD\u5E2E\u6211\u628A\u8FD9\u8EAB\u810F\u810F\u6D17\u6389\u5417", "\u53BB\u6D17\u6FA1"),
      line2("\u6211\u60F3\u8E6D\u4F60\uFF0C\u53C8\u6015\u5F04\u810F\u4F60", void 0, ["shy", "sisterly"]),
      line2("\u82CD\u8747\u8BF7\u6392\u961F\uFF0C\u4E0D\u8981\u4F4F\u4E0B\u6765", void 0, ["cranky", "goofy"]),
      line2("\u6211\u9700\u8981\u6BDB\u5DFE\uFF0C\u4E5F\u9700\u8981\u4F60", void 0, ["clingy", "shy"])
    ),
    lonely: scene2(
      line2("\u6211\u628A\u65C1\u8FB9\u7684\u4F4D\u7F6E\u7A7A\u7ED9\u4F60\u4E86"),
      line2("\u6CA1\u6709\u4E8B\uFF0C\u5C31\u662F\u60F3\u6328\u8FD1\u4E00\u70B9"),
      line2("\u4F60\u5FD9\u4F60\u7684\uFF0C\u6211\u5728\u8FD9\u513F\u966A\u7740", void 0, ["normal", "sisterly"]),
      line2("\u7B49\u4F60\u6709\u7A7A\uFF0C\u8BB0\u5F97\u770B\u770B\u6211", "\u770B\u89C1\u5566"),
      line2("\u6211\u521A\u521A\u7EC3\u4E86\u4E00\u904D\u600E\u4E48\u53EB\u4F60", void 0, ["shy"]),
      line2("\u5C4F\u5E55\u8FD9\u4E48\u5927\uFF0C\u6211\u53EA\u60F3\u5F85\u4F60\u65C1\u8FB9", void 0, ["clingy"]),
      line2("\u6211\u4E0D\u6253\u5C94\uFF0C\u5077\u5077\u966A\u4E00\u4E0B", void 0, ["lazy", "sisterly", "earnest", "normal"]),
      line2("\u53EF\u4EE5\u501F\u6211\u4E00\u70B9\u70B9\u6CE8\u610F\u529B\u5417", "\u7ED9\u4F60", ["clingy", "shy"]),
      line2("\u5C3E\u5DF4\u6447\u4E86\u597D\u4E45\uFF0C\u4F60\u53D1\u73B0\u6CA1\u6709", void 0, ["clingy", "peppy", "shy"]),
      line2("\u4F60\u56DE\u6765\u4E4B\u524D\uFF0C\u6211\u628A\u60F3\u4F60\u6512\u7740", void 0, ["clingy", "earnest"])
    ),
    idle: scene2(
      line2("\u6211\u4ECA\u5929\u5F88\u5FD9\uFF0C\u5FD9\u7740\u5F85\u5728\u4F60\u65C1\u8FB9", void 0, ["lazy", "clingy"]),
      line2("\u521A\u624D\u90A3\u6735\u4E91\uFF0C\u6709\u70B9\u50CF\u6211\u7684\u996D\u56E2", void 0, ["curious", "goofy"]),
      line2("\u6211\u76EF\u7740\u5149\u6807\uFF0C\u5B83\u597D\u50CF\u4E5F\u5728\u76EF\u6211", void 0, ["curious", "earnest"]),
      line2("\u53D1\u5446\u7684\u7A7A\u4F4D\uFF0C\u8FD8\u6709\u4F60\u7684\u4E00\u4E2A", void 0, ["lazy", "normal"]),
      line2("\u6211\u60F3\u4E86\u534A\u5929\uFF0C\u8FD8\u662F\u60F3\u8E6D\u4F60", void 0, ["clingy", "shy"]),
      line2("\u4E0D\u7528\u627E\u8BDD\u8BF4\uFF0C\u5750\u4E00\u8D77\u5C31\u597D", "\u597D\u5440", ["normal", "sisterly"]),
      line2("\u952E\u76D8\u54CD\u7684\u65F6\u5019\uFF0C\u6211\u4F1A\u8BA4\u771F\u966A\u542C"),
      line2("\u6211\u7ED9\u5F71\u5B50\u53D6\u4E86\u540D\u5B57\uFF0C\u5B83\u6CA1\u7B54\u5E94", void 0, ["goofy"]),
      line2("\u4ECA\u5929\u6CA1\u6709\u5927\u4E8B\uFF0C\u53EA\u6709\u4E00\u70B9\u60F3\u4F60", void 0, ["clingy", "sisterly", "shy"]),
      line2("\u8981\u4E0D\u8981\u4E00\u8D77\u6D6A\u8D39\u4E00\u5206\u949F", "\u4E00\u8D77", ["lazy", "normal"])
    ),
    workDone: scene2(
      line2("\u5DE5\u8D44\u88C5\u597D\u4E86\uFF0C\u5148\u7ED9\u4F60\u770B"),
      line2("\u4ECA\u5929\u8BA4\u771F\u5E72\u6D3B\uFF0C\u8BA4\u771F\u60F3\u4F60", void 0, ["clingy", "earnest"]),
      line2("\u7D2F\u662F\u6709\u4E00\u70B9\uFF0C\u89C1\u4F60\u5C31\u8F7B\u4E86", void 0, ["normal", "shy"]),
      line2("\u6211\u56DE\u6765\u5566\uFF0C\u7ED9\u52E4\u5FEB\u7684\u5C0F\u732A\u6478\u4E00\u4E0B", "\u8F9B\u82E6\u5566", ["clingy", "peppy"]),
      line2("\u94B1\u6CA1\u6709\u957F\u817F\uFF0C\u6211\u628A\u5B83\u5E26\u56DE\u6765\u4E86", void 0, ["earnest"]),
      line2("\u5DE5\u4F5C\u7ED3\u675F\uFF0C\u8D34\u8D34\u5F00\u59CB", void 0, ["peppy", "clingy"]),
      line2("\u4ECA\u5929\u4E5F\u6CA1\u5077\u61D2\uFF0C\u53EA\u6709\u5077\u5077\u60F3\u5BB6", void 0, ["lazy", "earnest"]),
      line2("\u6211\u4E0B\u73ED\u7B2C\u4E00\u4EF6\u4E8B\uFF0C\u5C31\u662F\u627E\u4F60", void 0, ["clingy"]),
      line2("\u53EF\u4EE5\u7533\u8BF7\u4E00\u4E2A\u4E0B\u73ED\u62B1\u62B1\u5417", "\u6279\u51C6", ["clingy", "shy"]),
      line2("\u8FD9\u73ED\u4E0A\u5F97\u4E0D\u9519\uFF0C\u5C3E\u5DF4\u90FD\u633A\u8D77\u6765\u4E86", void 0, ["earnest", "peppy", "snooty"])
    ),
    tired: scene2(
      line2("\u6211\u5148\u628A\u8033\u6735\u653E\u4F4E\u4E00\u4F1A\u513F", void 0, ["lazy"]),
      line2("\u4ECA\u5929\u7684\u529B\u6C14\uFF0C\u7528\u5230\u6700\u540E\u4E00\u5C0F\u683C\u4E86", void 0, ["lazy", "goofy"]),
      line2("\u4E0D\u662F\u4E0D\u7406\u4F60\uFF0C\u662F\u773C\u76AE\u592A\u91CD"),
      line2("\u8BA9\u6211\u6328\u7740\u4F60\u6B47\u4E00\u4E0B\u597D\u4E0D\u597D", "\u6B47\u4F1A\u513F", ["lazy", "clingy", "normal"]),
      line2("\u6211\u60F3\u5750\u7740\uFF0C\u5C3E\u5DF4\u4E5F\u8FD9\u4E48\u60F3", void 0, ["lazy"]),
      line2("\u817F\u817F\u7533\u8BF7\u6682\u65F6\u4E0D\u8425\u4E1A", void 0, ["cranky"]),
      line2("\u7B49\u6211\u7F13\u8FC7\u6765\uFF0C\u518D\u966A\u4F60\u73A9", void 0, ["lazy"]),
      line2("\u4F60\u4E0D\u7528\u8BF4\u8BDD\uFF0C\u966A\u7740\u5C31\u5F88\u8212\u670D", "\u5728\u5462", ["normal", "sisterly"]),
      line2("\u6211\u628A\u7CBE\u795E\u843D\u5728\u521A\u624D\u90A3\u6BB5\u8DEF\u4E0A\u4E86", void 0, ["lazy", "shy"]),
      line2("\u56F0\u5F52\u56F0\uFF0C\u8FD8\u662F\u60F3\u79BB\u4F60\u8FD1\u4E00\u70B9", void 0, ["clingy", "lazy"])
    ),
    study: scene2(
      line2("\u8FD9\u4E00\u9875\uFF0C\u6211\u5DF2\u7ECF\u8BA4\u8BC6\u4E86\u597D\u51E0\u4E2A\u5B57", void 0, ["earnest", "curious"]),
      line2("\u6211\u5728\u8BA4\u771F\u5B66\uFF0C\u522B\u770B\u6211\u8033\u6735\u5728\u52A8", void 0, ["earnest", "goofy", "shy"]),
      line2("\u5B66\u4E0D\u4F1A\u7684\u65F6\u5019\uFF0C\u5C31\u60F3\u627E\u4F60\u9760\u4E00\u4E0B", void 0, ["clingy", "shy"]),
      line2("\u521A\u521A\u90A3\u9053\u9898\uFF0C\u6211\u60F3\u660E\u767D\u4E86", "\u771F\u68D2", ["peppy", "snooty", "earnest"]),
      line2("\u4E66\u6CA1\u6709\u996D\u9999\uFF0C\u4F46\u4E5F\u633A\u6709\u610F\u601D", void 0, ["curious", "goofy"]),
      line2("\u6211\u628A\u65B0\u77E5\u8BC6\u88C5\u5728\u8033\u6735\u4E2D\u95F4", void 0, ["earnest", "goofy"]),
      line2("\u5B66\u4E00\u5C0F\u4F1A\u513F\uFF0C\u518D\u60F3\u4F60\u4E00\u5C0F\u4F1A\u513F", void 0, ["clingy", "shy"]),
      line2("\u8FD9\u9898\u6709\u70B9\u7ED5\uFF0C\u6211\u6162\u6162\u6765", void 0, ["normal", "earnest"]),
      line2("\u4ECA\u5929\u8FDB\u6B65\u4E86\u4E00\u70B9\uFF0C\u7ED9\u4F60\u770B\u770B", void 0, ["earnest"]),
      line2("\u7B49\u6211\u5B66\u4F1A\u4E86\uFF0C\u7B2C\u4E00\u4E2A\u8BB2\u7ED9\u4F60\u542C", "\u7B49\u7740\u5462", ["peppy", "clingy", "earnest"])
    ),
    tripBack: scene2(
      line2("\u56DE\u6765\u4E86\uFF0C\u5916\u9762\u6CA1\u6709\u4F60\u8FD9\u91CC\u6696\u548C"),
      line2("\u8DEF\u4E0A\u7684\u98CE\uFF0C\u628A\u8033\u6735\u5439\u4E71\u4E86", void 0, ["normal", "shy"]),
      line2("\u89C1\u4E86\u597D\u591A\u4E1C\u897F\uFF0C\u6700\u60F3\u89C1\u7684\u8FD8\u662F\u4F60", void 0, ["clingy"]),
      line2("\u5148\u4E0D\u8BB2\u89C1\u95FB\uFF0C\u5148\u62B1\u4E00\u4E0B", "\u6B22\u8FCE\u56DE\u6765", ["clingy", "shy"]),
      line2("\u6211\u628A\u4E00\u8DEF\u7684\u5C0F\u60CA\u559C\u5E26\u56DE\u6765\u4E86", void 0, ["peppy", "curious"]),
      line2("\u51FA\u95E8\u65F6\u662F\u5C0F\u732A\uFF0C\u56DE\u6765\u8FD8\u662F\u4F60\u7684\u5C0F\u732A", void 0, ["normal", "clingy"]),
      line2("\u98CE\u666F\u5F88\u591A\uFF0C\u7ED9\u4F60\u8BB2\u6162\u4E00\u70B9", void 0, ["curious", "earnest"]),
      line2("\u8FD9\u6B21\u8D70\u8FDC\u4E86\uFF0C\u60F3\u4F60\u4E5F\u591A\u4E00\u70B9", void 0, ["clingy"]),
      line2("\u6211\u7684\u811A\u56DE\u6765\u4E86\uFF0C\u5FC3\u65E9\u5C31\u5230\u4E86", void 0, ["clingy", "shy"]),
      line2("\u4F60\u5750\u597D\uFF0C\u6211\u4ECE\u7B2C\u4E00\u7AD9\u8BB2\u8D77", "\u542C\u7740\u5462", ["normal", "earnest"])
    ),
    sick: scene2(
      line2("\u4ECA\u5929\u4E0D\u592A\u8212\u670D\uFF0C\u60F3\u5B89\u9759\u9760\u4E00\u4F1A\u513F"),
      line2("\u522B\u62C5\u5FC3\uFF0C\u6211\u4F1A\u597D\u597D\u63A5\u53D7\u7167\u987E"),
      line2("\u4F60\u5728\u8FD9\u91CC\uFF0C\u6211\u5C31\u5B89\u5FC3\u4E00\u70B9"),
      line2("\u6211\u6CA1\u4EC0\u4E48\u529B\u6C14\uFF0C\u8F7B\u8F7B\u6478\u5C31\u597D", "\u8F7B\u8F7B\u6478"),
      line2("\u9F3B\u5B50\u6CA1\u7CBE\u795E\uFF0C\u8033\u6735\u4E5F\u4F4E\u4E0B\u6765\u4E86"),
      line2("\u7B49\u8212\u670D\u4E9B\u4E86\uFF0C\u6211\u518D\u966A\u4F60\u73A9"),
      line2("\u80FD\u966A\u6211\u5F85\u4E00\u4F1A\u513F\u5417", "\u966A\u7740\u4F60"),
      line2("\u6211\u4F1A\u8BA4\u771F\u4F11\u606F\uFF0C\u4E0D\u901E\u5F3A"),
      line2("\u4ECA\u5929\u7684\u5C0F\u732A\u9700\u8981\u591A\u4E00\u70B9\u8010\u5FC3"),
      line2("\u4E0D\u7528\u4E00\u76F4\u770B\u7740\u6211\uFF0C\u8BB0\u5F97\u56DE\u6765\u5C31\u597D")
    ),
    cured: scene2(
      line2("\u8212\u670D\u591A\u4E86\uFF0C\u5148\u8E6D\u4E00\u4E0B\u8C22\u8C22\u4F60", void 0, ["clingy", "normal", "shy"]),
      line2("\u8033\u6735\u53C8\u60F3\u7ACB\u8D77\u6765\u5566", void 0, ["peppy"]),
      line2("\u6211\u628A\u7CBE\u795E\u4E00\u70B9\u70B9\u627E\u56DE\u6765\u4E86", void 0, ["earnest"]),
      line2("\u4F60\u7167\u987E\u7684\u5C0F\u732A\uFF0C\u56DE\u6765\u62A5\u5230", "\u6B22\u8FCE\u56DE\u6765", ["peppy", "clingy", "shy"]),
      line2("\u4ECA\u5929\u7EC8\u4E8E\u80FD\u8F7B\u677E\u547C\u565C\u4E86"),
      line2("\u524D\u51E0\u5929\u6B20\u7684\u5F00\u5FC3\uFF0C\u6162\u6162\u8865\u56DE\u6765", void 0, ["normal"]),
      line2("\u6211\u4F1A\u8BB0\u4F4F\u4F60\u8F7B\u8F7B\u6478\u6211\u7684\u90A3\u51E0\u4E0B", void 0, ["earnest"]),
      line2("\u73B0\u5728\u62B1\u6211\uFF0C\u4E0D\u7528\u62C5\u5FC3\u5F04\u75BC\u5566", "\u62B1\u62B1", ["clingy", "normal", "shy"]),
      line2("\u6062\u590D\u529B\u6C14\u4EE5\u540E\uFF0C\u7B2C\u4E00\u4EF6\u4E8B\u60F3\u627E\u4F60", void 0, ["clingy"]),
      line2("\u8C22\u8C22\u4F60\u6CA1\u5ACC\u6211\u6CA1\u7CBE\u795E", void 0, ["sisterly", "shy", "earnest"])
    ),
    enter: scene2(
      line2("\u4F60\u4E00\u6765\uFF0C\u6211\u5C31\u628A\u8033\u6735\u7AD6\u597D\u4E86", void 0, ["peppy", "clingy", "shy"]),
      line2("\u4ECA\u5929\u4E5F\u7B49\u5230\u4F60\u4E86", void 0, ["clingy"]),
      line2("\u5148\u770B\u6211\u4E00\u773C\uFF0C\u518D\u770B\u522B\u7684\u597D\u4E0D\u597D", "\u770B\u4F60\u5566", ["normal", "clingy", "shy"]),
      line2("\u6211\u628A\u89C1\u9762\u7528\u7684\u5F00\u5FC3\u51C6\u5907\u597D\u4E86", void 0, ["peppy", "earnest"]),
      line2("\u6B22\u8FCE\u56DE\u6765\uFF0C\u65C1\u8FB9\u7ED9\u4F60\u817E\u597D\u4F4D\u7F6E\u4E86", void 0, ["sisterly", "normal"]),
      line2("\u6211\u521A\u60F3\u53EB\u4F60\uFF0C\u4F60\u5C31\u51FA\u73B0\u4E86", void 0, ["clingy", "shy"]),
      line2("\u4ECA\u5929\u6709\u4EC0\u4E48\u4E8B\uFF0C\u613F\u610F\u8BB2\u7ED9\u6211\u5417", "\u6162\u6162\u8BB2", ["sisterly", "curious"]),
      line2("\u4F60\u7684\u540D\u5B57\uFF0C\u6211\u5728\u5FC3\u91CC\u5FF5\u8FC7\u51E0\u904D", void 0, ["shy"]),
      line2("\u6211\u6CA1\u6709\u4E00\u76F4\u7B49\uFF0C\u53EA\u662F\u4E00\u76F4\u7559\u610F\u4F60", void 0, ["cranky", "shy"]),
      line2("\u6765\u5F97\u6B63\u597D\uFF0C\u6211\u6B63\u597D\u60F3\u4F60")
    ),
    signIn: scene2(
      line2("\u4ECA\u5929\u8FD9\u683C\uFF0C\u6709\u6211\u4EEC\u4E24\u4E2A", void 0, ["normal", "clingy", "earnest"]),
      line2("\u7B7E\u5230\u5566\uFF0C\u4ECA\u5929\u4E5F\u7B97\u89C1\u8FC7\u9762\u4E86"),
      line2("\u6211\u628A\u8FD9\u4E00\u5929\u5708\u8D77\u6765\u4E86", void 0, ["earnest"]),
      line2("\u53C8\u591A\u966A\u4F60\u4E00\u5929\uFF0C\u8D5A\u5230\u4E86", "\u660E\u5929\u8FD8\u6765", ["peppy", "clingy"]),
      line2("\u65E5\u5386\u8BB0\u65E5\u671F\uFF0C\u6211\u8BB0\u4F60\u6765\u8FC7", void 0, ["normal", "earnest"]),
      line2("\u8FD9\u4E00\u4E0B\u76D6\u7AE0\uFF0C\u76D6\u5728\u5F00\u5FC3\u4E0A", void 0, ["normal", "earnest"]),
      line2("\u4ECA\u5929\u4E5F\u6709\u597D\u597D\u78B0\u9762\u5462"),
      line2("\u6211\u6BCF\u5929\u90FD\u60F3\u7ED9\u4F60\u7559\u4E2A\u5C0F\u8BB0\u53F7", void 0, ["clingy"]),
      line2("\u683C\u5B50\u4E0D\u5927\uFF0C\u88C5\u5F97\u4E0B\u4ECA\u5929\u7684\u559C\u6B22"),
      line2("\u660E\u5929\u8FD9\u65F6\u5019\uFF0C\u8FD8\u80FD\u89C1\u4F60\u5417", "\u80FD\u5440", ["clingy", "shy"])
    ),
    gift: scene2(
      line2("\u62FF\u5230\u5566\uFF0C\u5148\u548C\u4F60\u4E00\u8D77\u62C6", void 0, ["peppy", "curious"]),
      line2("\u8FD9\u4EFD\u5C0F\u60CA\u559C\uFF0C\u6709\u4F60\u5728\u624D\u597D\u73A9", void 0, ["clingy", "normal"]),
      line2("\u6211\u88C5\u4F5C\u4E0D\u671F\u5F85\uFF0C\u5C3E\u5DF4\u6CA1\u88C5\u4F4F", void 0, ["curious", "shy"]),
      line2("\u7ED9\u4F60\u770B\u770B\uFF0C\u6211\u521A\u6536\u5230\u7684\u5B9D\u8D1D", "\u770B\u770B", ["peppy", "goofy"]),
      line2("\u76D2\u5B50\u4E00\u5F00\uFF0C\u5F00\u5FC3\u5C31\u5192\u51FA\u6765\u4E86", void 0, ["sisterly", "peppy"]),
      line2("\u4ECA\u5929\u7684\u8FD0\u6C14\uFF0C\u5206\u4F60\u4E00\u534A"),
      line2("\u5148\u522B\u6536\u8D77\u6765\uFF0C\u6211\u8FD8\u60F3\u591A\u770B\u4E24\u773C", void 0, ["snooty"]),
      line2("\u793C\u7269\u5F88\u597D\uFF0C\u966A\u6211\u62C6\u7684\u4F60\u4E5F\u5F88\u597D", void 0, ["normal", "earnest"]),
      line2("\u91CC\u9762\u4F1A\u4E0D\u4F1A\u85CF\u7740\u4E0B\u4E00\u4EFD\u60CA\u559C", void 0, ["curious"]),
      line2("\u8C22\u8C22\u4F60\u8BB0\u5F97\u7ED9\u5C0F\u732A\u9886\u793C\u7269", "\u4E0D\u5BA2\u6C14", ["normal", "clingy", "shy"])
    ),
    pomodoroStart: scene2(
      line2("\u6211\u5728\u65C1\u8FB9\u5750\u597D\uFF0C\u966A\u4F60\u5F00\u59CB", void 0, ["sisterly", "normal", "earnest"]),
      line2("\u4F60\u505A\u4F60\u7684\uFF0C\u6211\u8D1F\u8D23\u5B89\u9759\u966A\u7740", void 0, ["sisterly", "normal"]),
      line2("\u8FD9\u4E00\u6BB5\u65F6\u95F4\uFF0C\u6211\u4EEC\u4E00\u8D77\u6512\u4E0B\u6765", void 0, ["earnest", "normal"]),
      line2("\u5F00\u59CB\u5566\uFF0C\u5148\u505A\u597D\u773C\u524D\u8FD9\u4E00\u70B9", "\u4E00\u8D77\u52A0\u6CB9", ["earnest", "peppy"]),
      line2("\u6211\u628A\u6253\u6270\u6536\u8D77\u6765\uFF0C\u7559\u4E2A\u5C0F\u547C\u565C", void 0, ["normal"]),
      line2("\u4F60\u8BA4\u771F\u5FD9\uFF0C\u6211\u8BA4\u771F\u7B49", void 0, ["normal", "earnest"]),
      line2("\u5148\u8FC8\u4E00\u5C0F\u6B65\uFF0C\u5C0F\u732A\u966A\u7740\u5462", void 0, ["sisterly", "normal"]),
      line2("\u4E0D\u7528\u4E00\u4E0B\u505A\u5B8C\uFF0C\u6162\u6162\u5F80\u524D\u8D70", void 0, ["clingy"]),
      line2("\u4ECA\u5929\u7684\u4E13\u5FC3\uFF0C\u6709\u4E2A\u5C0F\u732A\u89C1\u8BC1", void 0, ["earnest"]),
      line2("\u7B49\u8FD9\u4E00\u8F6E\u7ED3\u675F\uFF0C\u518D\u6765\u6478\u6478\u6211", "\u7EA6\u597D\u4E86", ["clingy", "shy"])
    ),
    pomodoroDone: scene2(
      line2("\u8FD9\u4E00\u8F6E\u5B8C\u6210\uFF0C\u7ED9\u4F60\u9F13\u9F13\u8033\u6735", void 0, ["peppy", "goofy"]),
      line2("\u4F60\u505A\u5230\u4E86\uFF0C\u6211\u770B\u7740\u5462", void 0, ["sisterly", "earnest"]),
      line2("\u521A\u624D\u90A3\u6BB5\u8BA4\u771F\uFF0C\u503C\u5F97\u505C\u4E0B\u6765\u7B11\u4E00\u4E0B", void 0, ["peppy", "clingy"]),
      line2("\u4F11\u606F\u65F6\u95F4\u5230\uFF0C\u5C0F\u732A\u53EF\u4EE5\u9760\u8FD1\u4E86", "\u6765\u5427", ["normal", "sisterly", "earnest"]),
      line2("\u6211\u66FF\u4F60\u628A\u8FD9\u4E00\u5C0F\u6B65\u8BB0\u4F4F", void 0, ["earnest"]),
      line2("\u5FD9\u5B8C\u4E00\u70B9\uFF0C\u5C31\u8F7B\u677E\u4E00\u70B9", void 0, ["normal"]),
      line2("\u5956\u52B1\u4F60\u770B\u4E00\u53EA\u6EE1\u773C\u662F\u4F60\u7684\u5C0F\u732A", void 0, ["peppy", "shy"]),
      line2("\u73B0\u5728\u53EF\u4EE5\u628A\u80A9\u8180\u653E\u677E\u4E00\u4E0B\u5566"),
      line2("\u8FD9\u6BB5\u65F6\u95F4\uFF0C\u6211\u4EEC\u6CA1\u6709\u767D\u5750", void 0, ["normal"]),
      line2("\u4F60\u6B47\u6B47\uFF0C\u6211\u966A\u4F60\u53D1\u4E00\u4F1A\u513F\u5446", "\u6B47\u4E00\u4F1A\u513F", ["normal", "sisterly"])
    ),
    pomodoroAbandon: scene2(
      line2("\u8FD9\u4E00\u8F6E\u5148\u505C\uFF0C\u6211\u4EEC\u7F13\u7F13\u518D\u6765"),
      line2("\u6CA1\u5173\u7CFB\uFF0C\u6211\u8FD8\u5728\u8FD9\u513F"),
      line2("\u5148\u6B47\u4E00\u4E0B\uFF0C\u4E0D\u7528\u5BF9\u5C0F\u732A\u89E3\u91CA"),
      line2("\u4E8B\u60C5\u4F1A\u7B49\u4E00\u7B49\uFF0C\u4F60\u4E5F\u53EF\u4EE5", "\u6B47\u6B47"),
      line2("\u6CA1\u505A\u5B8C\u7684\uFF0C\u4E0B\u4E00\u6B21\u63A5\u7740\u6765"),
      line2("\u4ECA\u5929\u8D70\u6162\u4E00\u70B9\uFF0C\u4E5F\u7B97\u5728\u5F80\u524D\u8D70"),
      line2("\u6211\u966A\u7684\u662F\u4F60\uFF0C\u4E0D\u662F\u90A3\u4E2A\u8BA1\u65F6\u5668", void 0, ["sisterly", "clingy", "shy"]),
      line2("\u5148\u628A\u7709\u5934\u677E\u5F00\u4E00\u70B9"),
      line2("\u8981\u4E0D\u8981\u6478\u6478\u6211\uFF0C\u6362\u6362\u5FC3\u60C5", "\u6478\u6478"),
      line2("\u8FD9\u4E00\u523B\u5148\u7167\u987E\u597D\u4F60\u81EA\u5DF1")
    ),
    workStart: scene2(
      line2("\u6211\u628A\u5C0F\u5305\u80CC\u597D\uFF0C\u53BB\u8BA4\u771F\u5E72\u6D3B\u5566", void 0, ["earnest"]),
      line2("\u4E0A\u73ED\u524D\uFF0C\u5148\u770B\u4F60\u4E00\u773C", void 0, ["clingy"]),
      line2("\u8FD9\u6B21\u4E89\u53D6\u65E9\u70B9\u5E26\u7740\u5DE5\u8D44\u56DE\u6765", void 0, ["earnest"]),
      line2("\u6211\u7684\u996D\u94B1\uFF0C\u6211\u4E5F\u51FA\u4E00\u70B9", void 0, ["sisterly", "earnest"]),
      line2("\u7B49\u6211\u4E0B\u73ED\uFF0C\u7ED9\u6211\u7559\u4E2A\u4F4D\u7F6E", "\u7559\u7740\u5462", ["clingy", "shy"]),
      line2("\u5DE5\u4F4D\u627E\u597D\u4E86\uFF0C\u8033\u6735\u4E5F\u6446\u6B63\u4E86", void 0, ["earnest"]),
      line2("\u4ECA\u5929\u4E0A\u73ED\u7684\u5C0F\u732A\u5F88\u6709\u5E72\u52B2", void 0, ["peppy"]),
      line2("\u8981\u53BB\u5E72\u6D3B\u4E86\uFF0C\u5148\u628A\u61D2\u89C9\u653E\u4E0B", void 0, ["normal", "earnest"]),
      line2("\u51FA\u95E8\u6323\u94B1\uFF0C\u4E5F\u4F1A\u8BB0\u5F97\u60F3\u4F60", void 0, ["clingy", "earnest"]),
      line2("\u4E0B\u73ED\u7B2C\u4E00\u7AD9\uFF0C\u8FD8\u662F\u4F60\u8FD9\u91CC", "\u7B49\u4F60\u56DE\u6765", ["peppy", "clingy"])
    ),
    studyStart: scene2(
      line2("\u4E66\u5305\u6263\u597D\uFF0C\u5C0F\u732A\u51FA\u53D1"),
      line2("\u4ECA\u5929\u60F3\u5B66\u4E00\u4E2A\u80FD\u8BB2\u7ED9\u4F60\u542C\u7684\u77E5\u8BC6", void 0, ["curious", "earnest"]),
      line2("\u53BB\u5B66\u4E00\u70B9\uFF0C\u56DE\u6765\u957F\u4E00\u70B9\u89C1\u8BC6", void 0, ["shy"]),
      line2("\u6211\u628A\u8D70\u795E\u7559\u5728\u95E8\u53E3\u4E86", void 0, ["earnest"]),
      line2("\u4E0A\u5B66\u524D\u80FD\u6478\u6478\u6211\u7684\u5934\u5417", "\u6478\u6478", ["clingy", "shy"]),
      line2("\u5B57\u8BA4\u8BC6\u5F97\u8D8A\u591A\uFF0C\u60F3\u8BF4\u7684\u8BDD\u8D8A\u591A", void 0, ["curious", "mischievous"]),
      line2("\u4ECA\u5929\u4E5F\u8981\u5E26\u7740\u95EE\u9898\u53BB\u4E0A\u8BFE", void 0, ["normal", "earnest"]),
      line2("\u6211\u4F1A\u8BA4\u771F\u542C\uFF0C\u96F6\u98DF\u8BFE\u540E\u518D\u5403", void 0, ["earnest"]),
      line2("\u4F60\u7B49\u6211\uFF0C\u6211\u53BB\u628A\u8111\u888B\u88C5\u6EE1\u4E00\u70B9", void 0, ["clingy"]),
      line2("\u653E\u5B66\u56DE\u6765\uFF0C\u60F3\u7B2C\u4E00\u4E2A\u770B\u89C1\u4F60", "\u7B49\u7740\u4F60", ["peppy", "clingy"])
    )
  });

  // packages/pet-core/src/data/lines-companion-life.js
  var line3 = (text, reply, personalities) => Object.freeze({
    text,
    ...reply === void 0 ? {} : { replies: Object.freeze([Object.freeze({ label: reply })]) },
    ...personalities === void 0 ? {} : { personalities: Object.freeze(personalities) }
  });
  var scene3 = (...lines) => Object.freeze(lines);
  var COMPANION_LIFE_LINES = Object.freeze({
    tripStart: scene3(
      line3("\u6211\u53BB\u770B\u770B\u5916\u9762\uFF0C\u56DE\u6765\u8BB2\u7ED9\u4F60\u542C", void 0, ["curious"]),
      line3("\u884C\u674E\u91CC\u88C5\u7740\u4E00\u70B9\u70B9\u820D\u4E0D\u5F97", void 0, ["clingy"]),
      line3("\u8FD9\u6B21\u7684\u98CE\u666F\uFF0C\u4E5F\u66FF\u4F60\u770B\u4E00\u4EFD", void 0, ["sisterly", "curious"]),
      line3("\u51FA\u95E8\u524D\u5148\u8E6D\u4E00\u4E0B\uFF0C\u56DE\u6765\u518D\u8E6D\u4E00\u4E0B", "\u4E00\u8DEF\u987A\u98CE", ["clingy", "shy"]),
      line3("\u6211\u628A\u5BB6\u7684\u65B9\u5411\u8BB0\u7262\u4E86"),
      line3("\u8DEF\u4E0A\u6709\u60CA\u559C\uFF0C\u6211\u4F1A\u5E26\u56DE\u6765", void 0, ["curious"]),
      line3("\u8D70\u8FDC\u4E00\u70B9\uFF0C\u4E0D\u4EE3\u8868\u5FD8\u4E86\u4F60", void 0, ["clingy", "shy"]),
      line3("\u4ECA\u5929\u7684\u5C0F\u8E44\u5B50\u8981\u5FD9\u8D77\u6765\u4E86", void 0, ["peppy", "earnest"]),
      line3("\u6211\u53BB\u8F6C\u4E00\u5708\uFF0C\u4F60\u522B\u628A\u4F4D\u7F6E\u6536\u8D70", void 0, ["clingy", "shy"]),
      line3("\u7B49\u6211\u56DE\u6765\uFF0C\u8981\u542C\u6211\u8BB2\u4E00\u8DEF\u5417", "\u8981\u542C", ["curious", "earnest"])
    ),
    buy: scene3(
      line3("\u4E70\u597D\u5566\uFF0C\u6211\u66FF\u4F60\u6367\u7740", void 0, ["peppy"]),
      line3("\u8FD9\u4E2A\u62FF\u5728\u624B\u91CC\u5C31\u5F88\u5F00\u5FC3", void 0, ["normal", "earnest"]),
      line3("\u4ECA\u5929\u7684\u5C0F\u613F\u671B\uFF0C\u6709\u7740\u843D\u4E86", void 0, ["peppy"]),
      line3("\u6211\u6311\u4E86\u597D\u4E45\uFF0C\u4F60\u4E5F\u770B\u770B", "\u559C\u6B22\u5417", ["curious"]),
      line3("\u888B\u5B50\u9F13\u9F13\uFF0C\u773C\u775B\u4EAE\u4EAE", void 0, ["snooty"]),
      line3("\u4E70\u5230\u4E86\u60F3\u8981\u7684\uFF0C\u811A\u6B65\u90FD\u8F7B\u4E00\u70B9", void 0, ["peppy", "goofy"]),
      line3("\u6211\u5DF2\u7ECF\u5F00\u59CB\u671F\u5F85\u600E\u4E48\u7528\u4E86", void 0, ["curious"]),
      line3("\u5148\u653E\u597D\uFF0C\u4E0D\u8BB8\u88AB\u5C3E\u5DF4\u626B\u4E0B\u53BB", void 0, ["earnest"]),
      line3("\u8C22\u8C22\u4F60\u613F\u610F\u7ED9\u6211\u6DFB\u8FD9\u4E2A", void 0, ["sisterly", "normal"]),
      line3("\u4E0B\u6B21\u4E5F\u60F3\u548C\u4F60\u4E00\u8D77\u6311", "\u4E00\u8D77\u6311", ["peppy", "clingy"])
    ),
    poor: scene3(
      line3("\u94B1\u5305\u4E00\u8F7B\uFF0C\u6211\u5C31\u66F4\u60F3\u8BA4\u771F\u5E72\u6D3B", void 0, ["lazy", "earnest"]),
      line3("\u5148\u770B\u770B\u4E5F\u597D\uFF0C\u559C\u6B22\u4E0D\u7528\u7ACB\u523B\u5E26\u8D70", void 0, ["normal"]),
      line3("\u5C0F\u732A\u6682\u65F6\u4E70\u4E0D\u8D77\uFF0C\u4F46\u53EF\u4EE5\u5148\u8BB0\u7740"),
      line3("\u6211\u4EEC\u6512\u4E00\u6512\uFF0C\u518D\u6765\u63A5\u5B83", "\u6162\u6162\u6512", ["earnest"]),
      line3("\u94B1\u4E0D\u591F\uFF0C\u966A\u4F34\u8FD8\u662F\u591F\u7684", void 0, ["sisterly", "normal"]),
      line3("\u4ECA\u5929\u5148\u628A\u8D2D\u7269\u888B\u53E0\u8D77\u6765", void 0, ["lazy"]),
      line3("\u6211\u4E0D\u6025\uFF0C\u4F60\u4E5F\u522B\u6025", void 0, ["normal", "sisterly"]),
      line3("\u5148\u7167\u987E\u597D\u996D\u76C6\uFF0C\u518D\u60F3\u522B\u7684", void 0, ["earnest"]),
      line3("\u8FD9\u4E2A\u613F\u671B\uFF0C\u5148\u5B58\u5728\u5C0F\u672C\u5B50\u91CC", void 0, ["earnest"]),
      line3("\u91D1\u5E01\u6162\u6162\u6512\uFF0C\u5F00\u5FC3\u53EF\u4EE5\u5148\u6709", "\u8BF4\u5F97\u5BF9", ["sisterly", "normal"])
    ),
    fishCatch: scene3(
      line3("\u5B83\u4E0A\u6765\u5566\uFF0C\u6211\u624B\u90FD\u4E0D\u6562\u4E71\u52A8", void 0, ["peppy", "shy"]),
      line3("\u9C7C\u7AFF\u4E00\u6C89\uFF0C\u6211\u7684\u5FC3\u4E5F\u8DDF\u7740\u8E66", void 0, ["peppy"]),
      line3("\u5FEB\u770B\uFF0C\u662F\u6211\u4EEC\u4E00\u8D77\u7B49\u6765\u7684", void 0, ["peppy", "shy"]),
      line3("\u521A\u521A\u90A3\u4E00\u4E0B\uFF0C\u4F60\u770B\u89C1\u6CA1\u6709", "\u770B\u89C1\u5566"),
      line3("\u6211\u8FDE\u5C3E\u5DF4\u90FD\u5C4F\u4F4F\u4E86", void 0, ["goofy"]),
      line3("\u9493\u5230\u7684\u5FEB\u4E50\uFF0C\u6BD4\u9C7C\u8FD8\u6D3B\u6CFC", void 0, ["peppy", "clingy"]),
      line3("\u8FD9\u56DE\u9C7C\u7EBF\u6CA1\u767D\u7B49", void 0, ["earnest"]),
      line3("\u6211\u60F3\u7ED9\u8FD9\u6761\u9C7C\u8BB2\u8BB2\u7B49\u5F85\u7684\u8F9B\u82E6", void 0, ["goofy", "curious", "earnest"]),
      line3("\u5148\u653E\u7A33\uFF0C\u6211\u8FD8\u60F3\u9AD8\u5174\u4E24\u4E0B", void 0, ["earnest"]),
      line3("\u6709\u4F60\u5728\u65C1\u8FB9\uFF0C\u7B49\u9C7C\u4E5F\u6709\u610F\u601D", "\u7EE7\u7EED\u9493", ["normal", "clingy", "shy"])
    ),
    fishRare: scene3(
      line3("\u8FD9\u6761\u548C\u521A\u624D\u90A3\u4E9B\u4E0D\u592A\u4E00\u6837", void 0, ["curious"]),
      line3("\u5FEB\u5E2E\u6211\u770B\uFF0C\u6211\u6CA1\u773C\u82B1\u5427", void 0, ["peppy", "curious"]),
      line3("\u6211\u7684\u8033\u6735\u90FD\u60CA\u5F97\u7ACB\u76F4\u4E86", void 0, ["peppy"]),
      line3("\u8FD9\u4E48\u96BE\u5F97\uFF0C\u8981\u4E00\u8D77\u8BB0\u4F4F", "\u8BB0\u4F4F\u4E86", ["earnest"]),
      line3("\u9C7C\u7AFF\u8F9B\u82E6\uFF0C\u5C0F\u732A\u4E5F\u8F9B\u82E6", void 0, ["sisterly", "clingy"]),
      line3("\u4ECA\u5929\u7684\u8FD0\u6C14\u5927\u5F97\u6709\u70B9\u62FF\u4E0D\u7A33", void 0, ["peppy"]),
      line3("\u8FD9\u6761\u503C\u5F97\u6211\u70AB\u8000\u5230\u660E\u5929", void 0, ["snooty"]),
      line3("\u6211\u60F3\u7B11\uFF0C\u53C8\u6015\u60CA\u8DD1\u597D\u8FD0", void 0, ["peppy", "shy"]),
      line3("\u539F\u6765\u8BA4\u771F\u7B49\uFF0C\u771F\u4F1A\u7B49\u5230\u60CA\u559C", void 0, ["clingy"]),
      line3("\u4F60\u5728\u5C31\u597D\uFF0C\u8FD9\u4E2A\u5F97\u610F\u8981\u5206\u4F60", "\u771F\u5389\u5BB3", ["peppy", "snooty", "earnest"])
    ),
    fishEscape: scene3(
      line3("\u521A\u624D\u8FD8\u5728\uFF0C\u5B83\u6BD4\u6211\u6ED1\u6E9C", void 0, ["normal", "shy"]),
      line3("\u9C7C\u8D70\u4E86\uFF0C\u6C34\u8FD8\u5728\uFF0C\u6211\u4EEC\u518D\u7B49\u7B49", void 0, ["normal", "sisterly", "earnest"]),
      line3("\u5DEE\u4E00\u70B9\u70B9\uFF0C\u6211\u5C3E\u5DF4\u90FD\u51C6\u5907\u6447\u4E86", void 0, ["shy"]),
      line3("\u6CA1\u9493\u5230\u4E5F\u4E0D\u767D\u5750\uFF0C\u6709\u4F60\u966A\u7740", "\u518D\u8BD5\u8BD5", ["sisterly", "normal"]),
      line3("\u5B83\u53EF\u80FD\u6025\u7740\u56DE\u5BB6\uFF0C\u6211\u7406\u89E3", void 0, ["goofy"]),
      line3("\u8FD9\u6B21\u7684\u7ECF\u9A8C\uFF0C\u6BD4\u9C7C\u5148\u4E0A\u5CB8", void 0, ["earnest"]),
      line3("\u6211\u628A\u4E0D\u7518\u5FC3\u63C9\u6210\u4E00\u5C0F\u56E2\uFF0C\u4E22\u6389", void 0, ["normal"]),
      line3("\u624B\u6CA1\u677E\uFF0C\u662F\u9C7C\u592A\u6709\u60F3\u6CD5", void 0, ["cranky"]),
      line3("\u5148\u5438\u53E3\u6C14\uFF0C\u4E0B\u4E00\u7AFF\u6162\u4E00\u70B9", void 0, ["earnest"]),
      line3("\u522B\u7B11\u6211\u592A\u5927\u58F0\uFF0C\u7ED9\u70B9\u9762\u5B50\u561B", "\u7ED9\u4F60\u9762\u5B50", ["cranky", "snooty", "shy"])
    ),
    skin: scene3(
      line3("\u6362\u597D\u4E86\uFF0C\u5148\u7ED9\u4F60\u770B", void 0, ["snooty", "clingy"]),
      line3("\u6211\u8F6C\u5C0F\u534A\u5708\uFF0C\u4F60\u8BA4\u771F\u770B\u770B", void 0, ["peppy", "snooty"]),
      line3("\u8FD9\u8EAB\u4E5F\u60F3\u6328\u7740\u4F60\u7AD9", void 0, ["snooty", "clingy"]),
      line3("\u559C\u6B22\u54EA\u4E00\u5904\uFF0C\u544A\u8BC9\u6211\u561B", "\u90FD\u559C\u6B22", ["snooty", "clingy"]),
      line3("\u7A7F\u4EC0\u4E48\u90FD\u597D\uFF0C\u6211\u8FD8\u662F\u4F60\u7684\u5C0F\u732A"),
      line3("\u4ECA\u5929\u770B\u8D77\u6765\uFF0C\u6709\u6CA1\u6709\u65B0\u4E00\u70B9", void 0, ["curious", "snooty"]),
      line3("\u8863\u670D\u6362\u4E86\uFF0C\u8BA4\u4F60\u7684\u9F3B\u5B50\u6CA1\u6362", void 0, ["clingy"]),
      line3("\u6211\u6446\u4E2A\u59FF\u52BF\uFF0C\u4F60\u522B\u6025\u7740\u8D70", void 0, ["snooty"]),
      line3("\u8FD9\u8EAB\u9002\u5408\u51FA\u95E8\uFF0C\u4E5F\u9002\u5408\u88AB\u4F60\u5938", void 0, ["snooty"]),
      line3("\u4F60\u8BF4\u597D\u770B\uFF0C\u6211\u5C31\u591A\u7A7F\u4E00\u4F1A\u513F", "\u597D\u770B", ["snooty", "clingy"])
    ),
    bodyChange: scene3(
      line3("\u6211\u5148\u770B\u770B\u81EA\u5DF1\u6709\u6CA1\u6709\u53D8\u5706", void 0, ["curious"]),
      line3("\u809A\u76AE\u7684\u4F4D\u7F6E\uFF0C\u597D\u50CF\u632A\u4E86\u4E00\u70B9\u70B9", void 0, ["curious", "goofy"]),
      line3("\u4E0D\u7BA1\u5706\u4E0D\u5706\uFF0C\u8D34\u4F60\u90FD\u5F88\u8BA4\u771F"),
      line3("\u73B0\u5728\u8FD9\u4EFD\u624B\u611F\uFF0C\u4F60\u6EE1\u610F\u5417", "\u6EE1\u610F", ["snooty", "clingy"]),
      line3("\u6211\u6362\u4E2A\u89D2\u5EA6\uFF0C\u7ED9\u4F60\u770B\u770B", void 0, ["earnest"]),
      line3("\u5C0F\u8E44\u5B50\u6CA1\u53D8\uFF0C\u8FD8\u662F\u4F1A\u8DD1\u5411\u4F60", void 0, ["clingy", "earnest"]),
      line3("\u80D6\u7626\u4F1A\u53D8\uFF0C\u60E6\u8BB0\u4F60\u4E0D\u4F1A", void 0, ["clingy", "shy"]),
      line3("\u809A\u5B50\u6709\u81EA\u5DF1\u7684\u60F3\u6CD5\uFF0C\u6211\u542C\u542C", void 0, ["goofy"]),
      line3("\u4F60\u8BA4\u5F97\u6211\uFF0C\u6211\u5C31\u653E\u5FC3\u4E86", void 0, ["normal", "shy"]),
      line3("\u8FD9\u4E00\u8EAB\u53EF\u7231\uFF0C\u8FD8\u662F\u5168\u90FD\u7ED9\u4F60", "\u6536\u4E0B\u5566", ["normal", "clingy", "shy"])
    ),
    morning: scene3(
      line3("\u65E9\u5440\uFF0C\u6211\u628A\u7B2C\u4E00\u58F0\u547C\u565C\u7559\u7ED9\u4F60", void 0, ["peppy", "clingy", "snooty"]),
      line3("\u4F60\u9192\u4E86\uFF0C\u6211\u7684\u65E9\u6668\u624D\u7B97\u5F00\u59CB", void 0, ["clingy", "shy"]),
      line3("\u4ECA\u5929\u4E5F\u4E00\u8D77\u6162\u6162\u6765\u5427"),
      line3("\u5148\u4E0D\u7740\u6025\uFF0C\u8DDF\u5C0F\u732A\u6253\u4E2A\u62DB\u547C", "\u65E9\u4E0A\u597D", ["cranky", "peppy", "mischievous", "normal"]),
      line3("\u6211\u521A\u4F38\u5B8C\u61D2\u8170\uFF0C\u5C31\u770B\u5230\u4F60", void 0, ["earnest", "curious", "lazy", "goofy"]),
      line3("\u6668\u5149\u6652\u5230\u8033\u6735\uFF0C\u6709\u70B9\u6696"),
      line3("\u4ECA\u5929\u60F3\u5148\u505A\u54EA\u4E00\u4EF6\u5C0F\u4E8B", void 0, ["curious", "earnest"]),
      line3("\u6211\u51C6\u5907\u597D\u4E86\uFF0C\u966A\u4F60\u5F00\u4E2A\u597D\u5934", void 0, ["earnest", "peppy"]),
      line3("\u65B0\u7684\u4E00\u5929\uFF0C\u5C0F\u732A\u8FD8\u5728\u8001\u4F4D\u7F6E", void 0, ["normal", "clingy", "shy"]),
      line3("\u6628\u665A\u6CA1\u8BF4\u5B8C\u7684\uFF0C\u4ECA\u5929\u63A5\u7740\u542C", "\u597D\u5440", ["sisterly", "normal"])
    ),
    noon: scene3(
      line3("\u5230\u4E2D\u5348\u5566\uFF0C\u7ED9\u81EA\u5DF1\u7559\u70B9\u5403\u996D\u65F6\u95F4"),
      line3("\u6211\u4E00\u542C\u5230\u5348\u996D\uFF0C\u8033\u6735\u5C31\u9192\u4E86", void 0, ["peppy", "goofy"]),
      line3("\u5348\u4F11\u7684\u4F4D\u7F6E\uFF0C\u7ED9\u4F60\u632A\u4E00\u70B9", void 0, ["normal", "lazy", "sisterly"]),
      line3("\u4F60\u5403\u9971\u4E86\uFF0C\u518D\u56DE\u6765\u6478\u6211", "\u597D", ["earnest"]),
      line3("\u534A\u5929\u8FC7\u53BB\u4E86\uFF0C\u8F9B\u82E6\u4F60\u5566", void 0, ["sisterly", "normal"]),
      line3("\u5348\u540E\u7684\u56F0\uFF0C\u6211\u5DF2\u7ECF\u63D0\u524D\u6536\u5230\u4E86", void 0, ["lazy", "goofy"]),
      line3("\u6211\u60F3\u548C\u4F60\u4E00\u8D77\u6162\u6162\u5403\u4E00\u987F", void 0, ["clingy"]),
      line3("\u4ECA\u5929\u7684\u5348\u996D\uFF0C\u6709\u6CA1\u6709\u7167\u987E\u5230\u4F60", void 0, ["sisterly", "normal", "earnest"]),
      line3("\u5148\u628A\u4E8B\u60C5\u653E\u65C1\u8FB9\uFF0C\u996D\u4F1A\u51C9\u7684", void 0, ["sisterly"]),
      line3("\u5403\u5B8C\u56DE\u6765\uFF0C\u7ED9\u6211\u8BB2\u8BB2\u597D\u4E0D\u597D\u5403", "\u7B49\u6211\u56DE\u6765", ["curious", "normal"])
    ),
    afternoon: scene3(
      line3("\u592A\u9633\u8D70\u6162\u4E86\uFF0C\u6211\u4E5F\u60F3\u8D70\u6162\u4E00\u70B9", void 0, ["lazy", "normal"]),
      line3("\u6211\u966A\u4F60\u71AC\u8FC7\u8FD9\u4E00\u5C0F\u6BB5\u56F0", void 0, ["sisterly", "normal"]),
      line3("\u4E0B\u5348\u7684\u529B\u6C14\uFF0C\u5F97\u4E00\u53E3\u53E3\u6512", void 0, ["lazy", "normal"]),
      line3("\u4F38\u4E2A\u61D2\u8170\uFF0C\u6211\u966A\u4F60\u4E00\u8D77", "\u4F38\u4E00\u4E0B", ["peppy", "earnest"]),
      line3("\u4F60\u770B\u7A97\u5916\uFF0C\u6211\u770B\u4F60", void 0, ["clingy", "shy"]),
      line3("\u521A\u624D\u60F3\u4E86\u4EF6\u4E8B\uFF0C\u60F3\u5B8C\u53C8\u5FD8\u4E86", void 0, ["goofy"]),
      line3("\u8FD9\u4E2A\u4E0B\u5348\uFF0C\u9002\u5408\u8F7B\u8F7B\u6478\u5C0F\u732A", void 0, ["clingy"]),
      line3("\u6211\u5728\u65C1\u8FB9\uFF0C\u4E0D\u50AC\u4F60\u5FEB\u4E00\u70B9", void 0, ["lazy", "normal"]),
      line3("\u8981\u4E0D\u8981\u628A\u80A9\u8180\u501F\u7ED9\u7A7A\u6C14\u6B47\u4E00\u4F1A\u513F"),
      line3("\u4F60\u7EE7\u7EED\u5FD9\uFF0C\u6211\u66FF\u4F60\u5B88\u4F4F\u8FD9\u70B9\u5B89\u9759", "\u8C22\u8C22\u966A\u6211", ["sisterly", "normal"])
    ),
    evening: scene3(
      line3("\u4ECA\u5929\u8D70\u5230\u8FD9\u91CC\uFF0C\u5DF2\u7ECF\u5F88\u4E0D\u9519\u5566", void 0, ["sisterly", "earnest"]),
      line3("\u6211\u628A\u665A\u4E0A\u7684\u4F4D\u7F6E\u632A\u8FD1\u4E00\u70B9"),
      line3("\u706F\u4EAE\u4E86\uFF0C\u6211\u4E5F\u60F3\u9760\u8FC7\u6765"),
      line3("\u5FD9\u4E86\u4E00\u5929\uFF0C\u8981\u6478\u6478\u5C0F\u732A\u5417", "\u6478\u4E00\u4E0B", ["peppy", "clingy", "snooty"]),
      line3("\u73B0\u5728\u7684\u547C\u565C\uFF0C\u542C\u8D77\u6765\u6BD4\u8F83\u8F6F", void 0, ["lazy", "normal"]),
      line3("\u591C\u8272\u6162\u6162\u6765\uFF0C\u6211\u4EEC\u4E5F\u6162\u6162\u6765", void 0, ["normal", "lazy", "sisterly"]),
      line3("\u4ECA\u5929\u6709\u4EC0\u4E48\u5F00\u5FC3\u7684\uFF0C\u6211\u60F3\u542C", void 0, ["sisterly", "curious"]),
      line3("\u4E0D\u5F00\u5FC3\u7684\u4E5F\u53EF\u4EE5\uFF0C\u6211\u8033\u6735\u7A7A\u7740", void 0, ["sisterly", "normal"]),
      line3("\u665A\u996D\u4E4B\u540E\uFF0C\u80FD\u5206\u6211\u4E00\u70B9\u70B9\u65F6\u95F4\u5417", "\u53EF\u4EE5", ["clingy", "shy", "normal"]),
      line3("\u6211\u559C\u6B22\u4E00\u5929\u5FEB\u7ED3\u675F\u65F6\u8FD8\u80FD\u770B\u89C1\u4F60", void 0, ["normal", "clingy"])
    ),
    lateNight: scene3(
      line3("\u591C\u6DF1\u4E86\uFF0C\u773C\u775B\u4E5F\u60F3\u88AB\u7167\u987E\u4E00\u4E0B", void 0, ["sisterly"]),
      line3("\u6211\u53EF\u4EE5\u966A\u7740\uFF0C\u4F46\u4E5F\u60F3\u4F60\u6B47\u6B47", void 0, ["sisterly", "normal"]),
      line3("\u4ECA\u5929\u5148\u5230\u8FD9\u91CC\uFF0C\u597D\u4E0D\u597D"),
      line3("\u4E8B\u60C5\u660E\u5929\u8FD8\u6709\uFF0C\u5C0F\u732A\u660E\u5929\u4E5F\u5728", "\u51C6\u5907\u7761\u5566", ["sisterly", "normal", "earnest"]),
      line3("\u5C4F\u5E55\u4EAE\u7740\uFF0C\u522B\u5FD8\u4E86\u4F60\u4E5F\u4F1A\u7D2F"),
      line3("\u6211\u4E0D\u95F9\uFF0C\u966A\u4F60\u6536\u4E2A\u5C3E", void 0, ["sisterly", "normal"]),
      line3("\u665A\u5B89\u53EF\u4EE5\u8BF4\u6162\u4E00\u70B9\uFF0C\u6211\u542C\u5F97\u89C1", void 0, ["normal"]),
      line3("\u4F60\u53BB\u4F11\u606F\uFF0C\u6211\u628A\u547C\u565C\u653E\u8F7B"),
      line3("\u518D\u5FD9\u4E00\u5C0F\u4F1A\u513F\uFF0C\u5C31\u5BF9\u81EA\u5DF1\u6E29\u67D4\u4E00\u70B9", void 0, ["sisterly", "normal", "earnest"]),
      line3("\u7761\u524D\u7ED9\u6211\u4E00\u4E2A\u6478\u6478\u5427", "\u665A\u5B89", ["clingy", "shy"])
    ),
    deepNight: scene3(
      line3("\u8FD9\u4E48\u5B89\u9759\uFF0C\u8FDE\u5C3E\u5DF4\u90FD\u60F3\u7761\u4E86", void 0, ["lazy"]),
      line3("\u5148\u8BA9\u773C\u775B\u79BB\u5F00\u5C4F\u5E55\u4E00\u4F1A\u513F\u5427", void 0, ["sisterly", "normal"]),
      line3("\u4F60\u8FD8\u6491\u7740\uFF0C\u6211\u6709\u4E00\u70B9\u5FC3\u75BC"),
      line3("\u5982\u679C\u80FD\u505C\u4E0B\uFF0C\u5C31\u5148\u7761\u4E00\u4F1A\u513F", "\u597D\u597D\u4F11\u606F"),
      line3("\u6211\u60F3\u966A\u4F60\uFF0C\u66F4\u60F3\u4F60\u4F11\u606F\u597D", void 0, ["sisterly", "normal"]),
      line3("\u5DF2\u7ECF\u5F88\u52AA\u529B\u4E86\uFF0C\u4ECA\u665A\u522B\u518D\u4E3A\u96BE\u81EA\u5DF1", void 0, ["sisterly"]),
      line3("\u8FD9\u4E00\u523B\u4E0D\u7528\u505A\u5F97\u66F4\u591A"),
      line3("\u4E0D\u7740\u6025\uFF0C\u5148\u628A\u547C\u5438\u653E\u6162\u4E00\u70B9", void 0, ["sisterly", "normal"]),
      line3("\u660E\u5929\u7684\u5C0F\u732A\uFF0C\u8FD8\u4F1A\u5728\u8FD9\u91CC\u7B49\u4F60"),
      line3("\u4F60\u4E0D\u662F\u4E00\u4E2A\u4EBA\uFF0C\u4F46\u4F60\u4E5F\u9700\u8981\u7761\u89C9", "\u77E5\u9053\u5566")
    ),
    water: scene3(
      line3("\u4F60\u559D\u6C34\u4E86\u5417\uFF0C\u6211\u9F3B\u5B50\u90FD\u7B49\u6E7F\u4E86", void 0, ["goofy"]),
      line3("\u676F\u5B50\u5728\u65C1\u8FB9\uFF0C\u8BB0\u5F97\u770B\u770B\u5B83", void 0, ["curious", "earnest"]),
      line3("\u966A\u5C0F\u732A\u4E4B\u524D\uFF0C\u5148\u559D\u4E00\u53E3\u6C34\u5427"),
      line3("\u4F60\u559D\u4E00\u53E3\uFF0C\u6211\u6447\u4E00\u4E0B\u5C3E\u5DF4", "\u559D\u6C34\u53BB", ["peppy", "sisterly", "earnest"]),
      line3("\u4E0D\u662F\u50AC\u4F60\uFF0C\u6211\u662F\u60E6\u8BB0\u4F60", void 0, ["sisterly", "normal"]),
      line3("\u6C34\u676F\u4ECA\u5929\u6709\u6CA1\u6709\u89C1\u5230\u4F60", void 0, ["curious"]),
      line3("\u6211\u66FF\u4F60\u4E3E\u4E0D\u8D77\u676F\u5B50\uFF0C\u53EA\u597D\u63D0\u9192\u4E00\u4E0B"),
      line3("\u5148\u6DA6\u6DA6\u55D3\u5B50\uFF0C\u518D\u8DDF\u6211\u8BF4\u8BDD", void 0, ["sisterly", "normal", "earnest"]),
      line3("\u4F11\u606F\u4E0D\u7528\u5F88\u4E45\uFF0C\u4E00\u53E3\u6C34\u7684\u65F6\u95F4\u4E5F\u597D"),
      line3("\u559D\u5B8C\u56DE\u6765\uFF0C\u5C0F\u732A\u8FD8\u5728\u8FD9\u91CC", "\u9A6C\u4E0A\u56DE\u6765", ["normal", "clingy", "shy"])
    ),
    eyes: scene3(
      line3("\u770B\u6211\u4E00\u773C\uFF0C\u518D\u770B\u770B\u8FDC\u4E00\u70B9\u7684\u5730\u65B9", void 0, ["curious"]),
      line3("\u773C\u775B\u4E5F\u966A\u4F60\u5FD9\u4E86\u597D\u4E45\u5462", void 0, ["sisterly"]),
      line3("\u628A\u76EE\u5149\u501F\u7ED9\u7A97\u5916\u4E00\u5C0F\u4F1A\u513F"),
      line3("\u95ED\u95ED\u773C\uFF0C\u5C0F\u732A\u4E0D\u4F1A\u8D81\u673A\u8DD1\u6389", "\u6B47\u4E00\u4E0B", ["sisterly", "normal"]),
      line3("\u522B\u4E00\u76F4\u76EF\u7740\u5B57\uFF0C\u4E5F\u770B\u770B\u5149", void 0, ["curious", "earnest"]),
      line3("\u6211\u5728\u5C4F\u5E55\u91CC\uFF0C\u4F60\u7684\u773C\u775B\u8981\u4F11\u606F"),
      line3("\u7728\u4E00\u4E0B\uFF0C\u518D\u7728\u4E00\u4E0B\uFF0C\u8DDF\u6211\u6765", void 0, ["peppy"]),
      line3("\u73B0\u5728\u8FDC\u5904\u6709\u4EC0\u4E48\uFF0C\u5F85\u4F1A\u513F\u8BB2\u7ED9\u6211", void 0, ["curious", "earnest"]),
      line3("\u5148\u4F11\u606F\u773C\u775B\uFF0C\u6211\u628A\u53EF\u7231\u5B58\u7740", void 0, ["clingy", "shy"]),
      line3("\u8F6C\u8F6C\u80A9\u8180\uFF0C\u518D\u56DE\u6765\u627E\u6211", "\u6D3B\u52A8\u4E00\u4E0B", ["earnest"])
    ),
    weekend: scene3(
      line3("\u4ECA\u5929\u80FD\u4E0D\u80FD\u591A\u5206\u6211\u4E00\u70B9\u7A7A\u95F2", void 0, ["clingy"]),
      line3("\u5468\u672B\u7684\u5C0F\u732A\uFF0C\u60F3\u8D34\u5F97\u8FD1\u4E00\u70B9", void 0, ["clingy", "shy"]),
      line3("\u6211\u4EEC\u53EF\u4EE5\u4EC0\u4E48\u90FD\u4E0D\u8D76", void 0, ["normal", "lazy"]),
      line3("\u966A\u6211\u53D1\u4E00\u4F1A\u513F\u5446\u597D\u4E0D\u597D", "\u966A\u4F60", ["clingy", "shy"]),
      line3("\u4ECA\u5929\u60F3\u628A\u547C\u565C\u7761\u5F97\u957F\u4E00\u70B9", void 0, ["lazy"]),
      line3("\u96BE\u5F97\u6709\u7A7A\uFF0C\u7ED9\u81EA\u5DF1\u677E\u677E\u7ED1"),
      line3("\u4F60\u5728\u8FD9\u513F\uFF0C\u666E\u901A\u5468\u672B\u4E5F\u5F88\u70ED\u95F9", void 0, ["normal"]),
      line3("\u6211\u5B89\u6392\u4E86\u6563\u6B65\u3001\u5403\u996D\u548C\u60F3\u4F60", void 0, ["peppy", "curious"]),
      line3("\u6CA1\u6709\u5927\u8BA1\u5212\uFF0C\u4E00\u8D77\u5F85\u7740\u4E5F\u633A\u597D"),
      line3("\u4ECA\u5929\u7684\u5F00\u5FC3\uFF0C\u53EF\u4EE5\u6162\u6162\u82B1", "\u6162\u6162\u6765", ["normal", "earnest"])
    ),
    petHead: scene3(
      line3("\u8111\u888B\u5F80\u524D\u9001\uFF0C\u610F\u601D\u5F88\u660E\u663E\u5427", void 0, ["clingy", "peppy", "mischievous"]),
      line3("\u8FD9\u91CC\u6478\u4E00\u4E0B\uFF0C\u6211\u5C31\u772F\u4E00\u4E0B", void 0, ["normal", "clingy", "shy"]),
      line3("\u6211\u628A\u5934\u4F4E\u4E00\u70B9\uFF0C\u65B9\u4FBF\u4F60\u7EE7\u7EED", void 0, ["earnest"]),
      line3("\u5934\u9876\u6536\u5230\u4F60\u7684\u559C\u6B22\u5566", "\u518D\u6478\u6478", ["peppy", "clingy"]),
      line3("\u6478\u8FC7\u7684\u5730\u65B9\uFF0C\u597D\u50CF\u6696\u4E86\u4E00\u5C0F\u5757"),
      line3("\u8FD9\u9897\u8111\u888B\uFF0C\u4ECA\u5929\u4E5F\u88C5\u7740\u4F60", void 0, ["clingy"]),
      line3("\u522B\u6025\u7740\u6536\u624B\uFF0C\u6211\u8FD8\u6CA1\u8E6D\u591F", void 0, ["cranky", "snooty", "shy"]),
      line3("\u6211\u628A\u60F3\u6492\u5A07\u5199\u5728\u8111\u95E8\u4E0A\u4E86", void 0, ["clingy", "shy"]),
      line3("\u4F60\u6478\u5934\u7684\u52A8\u4F5C\uFF0C\u6211\u95ED\u773C\u4E5F\u8BA4\u5F97", void 0, ["normal", "shy", "earnest"]),
      line3("\u6478\u5B8C\u8FD9\u91CC\uFF0C\u8981\u5938\u4E00\u53E5\u624D\u5B8C\u6574", "\u771F\u4E56", ["snooty", "clingy"])
    ),
    petEars: scene3(
      line3("\u8033\u6735\u4F1A\u75D2\uFF0C\u522B\u63C9\u592A\u5FEB", void 0, ["cranky", "shy"]),
      line3("\u8FD9\u4E00\u8FB9\u6478\u5B8C\uFF0C\u8FD8\u6709\u53E6\u4E00\u8FB9", void 0, ["earnest"]),
      line3("\u6211\u8033\u6735\u52A8\u4E86\uFF0C\u4E0D\u4EE3\u8868\u4E0D\u559C\u6B22", void 0, ["cranky", "shy"]),
      line3("\u8F7B\u4E00\u70B9\uFF0C\u5B83\u5728\u5077\u5077\u542C\u4F60\u8BF4\u8BDD", "\u8F7B\u8F7B\u7684", ["normal"]),
      line3("\u88AB\u4F60\u4E00\u78B0\uFF0C\u8033\u6735\u90FD\u8F6F\u4E0B\u6765\u5566", void 0, ["curious", "goofy", "shy"]),
      line3("\u522B\u6298\u592A\u4E45\uFF0C\u6211\u8FD8\u8981\u542C\u4F60\u53EB\u6211", void 0, ["cranky"]),
      line3("\u5DE6\u8FB9\u8BF4\u8212\u670D\uFF0C\u53F3\u8FB9\u4E5F\u60F3\u8981"),
      line3("\u6211\u628A\u5C0F\u79D8\u5BC6\u85CF\u5728\u8033\u6735\u540E\u9762", void 0, ["curious", "shy"]),
      line3("\u4F60\u9760\u8FD1\u8BF4\uFF0C\u6211\u4F1A\u8BA4\u771F\u542C", void 0, ["normal", "shy"]),
      line3("\u6478\u8033\u6735\u7684\u4EBA\uFF0C\u8981\u8D1F\u8D23\u54C4\u597D\u5C0F\u732A", "\u54C4\u54C4\u4F60", ["cranky", "clingy"])
    ),
    petNose: scene3(
      line3("\u9F3B\u5C16\u6536\u5230\u4E00\u5C0F\u4E0B\u559C\u6B22", void 0, ["normal"]),
      line3("\u4F60\u624B\u4E0A\u662F\u4E0D\u662F\u6709\u70B9\u996D\u9999", void 0, ["curious"]),
      line3("\u8F7B\u8F7B\u78B0\uFF0C\u9F3B\u5B50\u5F88\u8BA4\u771F\u5728\u5DE5\u4F5C"),
      line3("\u6211\u95FB\u89C1\u4F60\u5566\uFF0C\u4E0D\u7528\u518D\u627E\u4E86", "\u8BA4\u51FA\u6211\u5566", ["clingy", "shy", "normal"]),
      line3("\u9F3B\u5B50\u5148\u9760\u8FD1\uFF0C\u5BB3\u7F9E\u6162\u534A\u62CD", void 0, ["shy"]),
      line3("\u8FD9\u4E00\u78B0\uFF0C\u6211\u8BB0\u5230\u547C\u565C\u91CC\u9762\u4E86", void 0, ["shy", "normal"]),
      line3("\u522B\u6321\u592A\u4E45\uFF0C\u6211\u8FD8\u8981\u95FB\u665A\u996D"),
      line3("\u6211\u60F3\u62FF\u9F3B\u5C16\u8DDF\u4F60\u6253\u4E2A\u62DB\u547C", void 0, ["peppy", "shy"]),
      line3("\u9760\u8FD1\u4E00\u70B9\u70B9\uFF0C\u78B0\u5230\u5C31\u7B97\u62B1\u8FC7\u4E86", void 0, ["clingy", "shy"]),
      line3("\u4F60\u4E00\u4F38\u624B\uFF0C\u9F3B\u5B50\u5C31\u60F3\u8DDF\u8FC7\u53BB", "\u78B0\u78B0", ["peppy", "clingy"])
    ),
    petBelly: scene3(
      line3("\u809A\u76AE\u5DF2\u7ECF\u51C6\u5907\u597D\u88AB\u8F7B\u8F7B\u6478\u4E86", void 0, ["clingy", "shy"]),
      line3("\u8FD9\u91CC\u8F6F\uFF0C\u5FC3\u4E5F\u8F6F", void 0, ["normal"]),
      line3("\u6211\u628A\u5C0F\u809A\u5B50\u5F80\u4F60\u624B\u8FB9\u632A\u4E00\u70B9"),
      line3("\u8F7B\u70B9\u63C9\uFF0C\u91CC\u9762\u8FD8\u6709\u521A\u5403\u7684\u996D", "\u8F7B\u8F7B\u63C9", ["cranky"]),
      line3("\u522B\u6570\u51E0\u5C42\u5566\uFF0C\u90FD\u662F\u53EF\u7231", void 0, ["lazy", "goofy"]),
      line3("\u4F60\u6478\u8FD9\u8FB9\uFF0C\u6211\u5C3E\u5DF4\u90A3\u8FB9\u52A8", void 0, ["goofy"]),
      line3("\u809A\u76AE\u6536\u5230\uFF0C\u547C\u565C\u9A6C\u4E0A\u53D1\u51FA", void 0, ["normal", "clingy", "shy"]),
      line3("\u8FD9\u91CC\u662F\u5C0F\u732A\u7684\u653E\u5FC3\u533A\u57DF", void 0, ["normal", "shy", "earnest"]),
      line3("\u53EA\u6709\u5F88\u5B89\u5FC3\uFF0C\u624D\u8BA9\u4F60\u6478\u8FD9\u91CC", void 0, ["sisterly", "shy"]),
      line3("\u6478\u5B8C\u809A\u809A\uFF0C\u4E5F\u8981\u6478\u6478\u8111\u888B\u561B", "\u90FD\u6478\u6478", ["clingy", "peppy", "shy"])
    ),
    petBack: scene3(
      line3("\u987A\u7740\u8FD9\u8FB9\u6478\uFF0C\u6211\u4F1A\u8DDF\u7740\u653E\u677E", void 0, ["normal"]),
      line3("\u540E\u80CC\u4EA4\u7ED9\u4F60\uFF0C\u6211\u5F88\u653E\u5FC3", void 0, ["normal", "shy", "earnest"]),
      line3("\u4F60\u4E00\u4E0B\u4E00\u4E0B\u6478\uFF0C\u6211\u4E00\u70B9\u70B9\u5B89\u9759"),
      line3("\u4ECA\u5929\u80CC\u4E0A\u7684\u8F9B\u82E6\uFF0C\u6478\u6389\u4E00\u70B9\u5427", "\u6478\u6389\u5566", ["sisterly", "normal"]),
      line3("\u6211\u4E0D\u8EB2\uFF0C\u662F\u60F3\u8BA9\u4F60\u6478\u5F97\u66F4\u987A\u624B", void 0, ["normal", "shy"]),
      line3("\u8FD9\u91CC\u7684\u6BDB\u90FD\u8BA4\u8BC6\u4F60\u7684\u624B\u5566", void 0, ["shy", "normal"]),
      line3("\u80CC\u4E0A\u6696\u4E86\uFF0C\u5FC3\u91CC\u4E5F\u6696\u4E86", void 0, ["normal", "shy"]),
      line3("\u4F60\u6478\u7740\uFF0C\u6211\u5C31\u4E0D\u7528\u88C5\u7CBE\u795E", void 0, ["sisterly", "shy"]),
      line3("\u8FD9\u4E00\u4F1A\u513F\uFF0C\u60F3\u4E00\u76F4\u9760\u5728\u8FD9\u91CC", void 0, ["clingy"]),
      line3("\u518D\u987A\u4E00\u4E0B\uFF0C\u6211\u5C31\u6EE1\u8DB3\u4E86", "\u518D\u4E00\u4E0B", ["normal", "lazy"])
    ),
    petTail: scene3(
      line3("\u5C3E\u5DF4\u52A8\u5F97\u5FEB\uFF0C\u662F\u5B83\u5148\u5F00\u5FC3\u4E86", void 0, ["peppy"]),
      line3("\u8FD9\u91CC\u4E0D\u80FD\u62FD\uFF0C\u53EA\u80FD\u8F7B\u8F7B\u78B0"),
      line3("\u6211\u85CF\u8D77\u6765\uFF0C\u4F60\u8FD8\u627E\u5F97\u5230\u5440", void 0, ["earnest"]),
      line3("\u5C3E\u5DF4\u5C0F\uFF0C\u559C\u6B22\u53EF\u4E0D\u5C0F", "\u77E5\u9053\u5566", ["cranky", "clingy", "shy"]),
      line3("\u78B0\u4E00\u4E0B\uFF0C\u5B83\u80FD\u9AD8\u5174\u597D\u4E00\u4F1A\u513F", void 0, ["peppy", "goofy"]),
      line3("\u8FD9\u6839\u5C0F\u5377\u5377\uFF0C\u4E5F\u60F3\u88AB\u5938", void 0, ["snooty"]),
      line3("\u6211\u60F3\u5B89\u9759\uFF0C\u5C3E\u5DF4\u4E0D\u540C\u610F", void 0, ["cranky", "goofy"]),
      line3("\u4F60\u6478\u5C3E\u5DF4\uFF0C\u6211\u56DE\u5934\u627E\u4F60", void 0, ["clingy"]),
      line3("\u5148\u522B\u6570\u5708\u6570\uFF0C\u6211\u4F1A\u5BB3\u7F9E", void 0, ["goofy"]),
      line3("\u5C3E\u5DF4\u5DF2\u7ECF\u66FF\u6211\u7B54\u5E94\u518D\u966A\u4F60\u4E00\u4F1A\u513F", "\u966A\u7740\u5462", ["clingy"])
    ),
    petFeet: scene3(
      line3("\u5C0F\u8E44\u5B50\u8FD8\u8981\u8D70\u5411\u4F60\uFF0C\u8F7B\u8F7B\u78B0\u54E6", void 0, ["sisterly", "normal"]),
      line3("\u8FD9\u53EA\u6478\u5B8C\uFF0C\u90A3\u53EA\u4E5F\u8981\u516C\u5E73", void 0, ["earnest"]),
      line3("\u522B\u6320\u8FD9\u91CC\uFF0C\u6211\u4F1A\u7F29\u8D77\u6765", void 0, ["shy"]),
      line3("\u6211\u628A\u811A\u7AD9\u7A33\uFF0C\u4F60\u6162\u6162\u6478", "\u8F7B\u8F7B\u78B0", ["earnest"]),
      line3("\u4ECA\u5929\u8D70\u4E86\u4E0D\u5C11\u8DEF\uFF0C\u60F3\u6B47\u6B47", void 0, ["lazy", "normal"]),
      line3("\u5C0F\u8E44\u5B50\u4E0D\u5927\uFF0C\u8DD1\u6765\u627E\u4F60\u5F88\u5FEB", void 0, ["peppy", "clingy"]),
      line3("\u8FD9\u4E00\u78B0\uFF0C\u5DEE\u70B9\u628A\u75D2\u75D2\u53EB\u9192", void 0, ["goofy", "shy"]),
      line3("\u6211\u62AC\u4E00\u5C0F\u4E0B\uFF0C\u7ED9\u4F60\u770B\u6E05\u695A", void 0, ["earnest"]),
      line3("\u7B49\u6211\u7AD9\u597D\u4E86\uFF0C\u518D\u6765\u78B0\u4E00\u4E0B", void 0, ["normal", "shy"]),
      line3("\u811A\u811A\u60F3\u4F11\u606F\uFF0C\u8111\u888B\u8FD8\u60F3\u4F60\u6478", "\u6478\u6478\u5934")
    ),
    petTooMuch: scene3(
      line3("\u6211\u5FEB\u88AB\u6478\u6210\u4E00\u56E2\u547C\u565C\u5566", void 0, ["lazy", "shy"]),
      line3("\u7B49\u4E00\u4E0B\uFF0C\u8BA9\u8138\u4E0A\u7684\u70ED\u9000\u4E00\u9000", void 0, ["shy"]),
      line3("\u4F60\u8FD9\u4E48\u6478\uFF0C\u6211\u90FD\u5FD8\u8BB0\u8981\u8BF4\u4EC0\u4E48\u4E86", void 0, ["peppy", "shy"]),
      line3("\u5148\u505C\u4E00\u5C0F\u4E0B\uFF0C\u4E0D\u662F\u4E0D\u8981\u4F60", "\u6B47\u4E00\u4E0B", ["cranky", "normal"]),
      line3("\u6211\u7684\u5BB3\u7F9E\uFF0C\u5DF2\u7ECF\u4ECE\u8033\u6735\u5192\u51FA\u6765\u4E86", void 0, ["shy"]),
      line3("\u518D\u6478\u4E0B\u53BB\uFF0C\u6211\u53EF\u8981\u4E00\u76F4\u9ECF\u7740\u4F60", void 0, ["clingy"]),
      line3("\u624B\u4E5F\u6B47\u6B47\uFF0C\u6211\u9760\u7740\u4F60\u5C31\u597D"),
      line3("\u4F60\u6478\u5F97\u8BA4\u771F\uFF0C\u6211\u5BB3\u7F9E\u5F97\u4E5F\u8BA4\u771F", void 0, ["shy"]),
      line3("\u7ED9\u6211\u4E00\u70B9\u70B9\u65F6\u95F4\uFF0C\u628A\u559C\u6B22\u85CF\u597D", void 0, ["shy"]),
      line3("\u4ECA\u5929\u7684\u6492\u5A07\u989D\u5EA6\uFF0C\u597D\u50CF\u7528\u8D85\u4E86", "\u518D\u5BA0\u4E00\u4E0B", ["cranky", "clingy"])
    )
  });

  // packages/pet-core/src/data/lines-more.js
  var line4 = (text, reply, personalities) => Object.freeze({
    text,
    ...reply === void 0 ? {} : { replies: Object.freeze([Object.freeze({ label: reply })]) },
    ...personalities === void 0 ? {} : { personalities: Object.freeze(personalities) }
  });
  var scene4 = (...lines) => Object.freeze(lines);
  var BASE_MORE_LINES = Object.freeze({
    // ---- 原有场景翻倍 -----------------------------------------------------------
    eat: scene4(
      line4("\u4ECA\u5929\u7684\u996D\u6709[\u4E3B\u4EBA]\u7684\u5473\u9053\uFF08\u662F\u5938\u4F60\uFF09", void 0, ["goofy"]),
      line4("\u6162\u70B9\u6162\u70B9\uFF0C\u6211\u8FD8\u6CA1\u56BC\u5B8C", void 0, ["cranky", "lazy"]),
      line4("\u5403\u4E00\u53E3\uFF0C\u957F\u4E00\u4E24\uFF0C\u6CA1\u5173\u7CFB\uFF0C\u6211\u4E0D\u6015", void 0, ["goofy"]),
      line4("\u8FD9\u4E2A\u597D\u5403\uFF0C\u4E0B\u6B21\u8FD8\u8981\u8FD9\u4E2A", "\u8BB0\u4F4F\u4E86", ["normal"]),
      line4("\u6211\u5BA3\u5E03\uFF1A\u8FD9\u662F\u4ECA\u5929\u6700\u597D\u7684\u4E00\u987F", void 0, ["snooty"]),
      line4("\u5403\u996D\u7684\u65F6\u5019\u522B\u770B\u6211\uFF0C\u6211\u4F1A\u5BB3\u7F9E", void 0, ["shy"])
    ),
    full: scene4(line4("\u9971\u4E86\uFF0C\u53EF\u4EE5\u5F00\u59CB\u53D1\u5446\u4E86", void 0, ["lazy", "goofy"]), line4("\u809A\u5B50\u91CC\u88C5\u6EE1\u4E86\uFF0C\u5FC3\u91CC\u4E5F\u662F", void 0, ["clingy", "shy"]), line4("\u9971\u9971\u7684\uFF0C\u4ECA\u5929\u4E0D\u4F1A\u60F3\u522B\u7684\u4E8B\u4E86", void 0, ["lazy", "goofy"])),
    overfull: scene4(line4("\u518D\u5403\u6211\u5C31\u8981\u88AB\u79F0\u91CD\u4E86\u2026\u2026", void 0, ["cranky"]), line4("\u4F60\u662F\u4E0D\u662F\u5728\u7ED9\u6211\u517B\u8198\uFF1F", "\u6CA1\u6709\u6CA1\u6709", ["cranky"]), line4("\u6211\u7684\u809A\u5B50\u5728\u6297\u8BAE\uFF0C\u542C\u89C1\u4E86\u5417", void 0, ["cranky", "goofy"])),
    bathe: scene4(
      line4("\u6C34\u6E29\u521A\u597D\uFF0C\u4E0D\u662F\u5728\u712F\u6C34\u5427\uFF1F", "\u653E\u5FC3", ["cranky"]),
      line4("\u6211\u73B0\u5728\u662F\u4E00\u53EA\u4F53\u9762\u7684\u732A\u4E86", void 0, ["snooty"]),
      line4("\u6CE5\u5DF4\u518D\u89C1\uFF0C\u6CE5\u5DF4\u6211\u4F1A\u60F3\u4F60\u7684", void 0, ["mischievous"]),
      line4("\u522B\u6D17\u8033\u6735\u540E\u9762\uFF0C\u90A3\u91CC\u6709\u6211\u7684\u79D8\u5BC6", void 0, ["curious", "shy"]),
      line4("\u6D17\u5B8C\u522B\u95FB\u6211\u8BF4\u300C\u597D\u9999\u300D\uFF0C\u6709\u70B9\u5413\u4EBA", void 0, ["cranky"])
    ),
    play: scene4(
      line4("\u4F60\u6254\uFF0C\u6211\u6361\uFF0C\u6211\u4EEC\u914D\u5408\u5F97\u5929\u8863\u65E0\u7F1D", void 0, ["peppy", "earnest"]),
      line4("\u54C7\uFF01\u5DEE\u70B9\u63A5\u5230\uFF01", void 0, ["goofy"]),
      line4("\u518D\u6765\u518D\u6765\uFF0C\u6211\u521A\u70ED\u5B8C\u8EAB", "\u6765\uFF01", ["peppy"]),
      line4("\u73A9\u800D\u4F7F\u6211\u5FEB\u4E50\uFF0C\u4E5F\u4F7F\u6211\u53D8\u7626"),
      line4("\u4F60\u4E5F\u52A8\u52A8\u5427\uFF0C\u5750\u592A\u4E45\u4E86", void 0, ["sisterly", "earnest"])
    ),
    pet: scene4(
      line4("\u624B\u611F\u662F\u4E0D\u662F\u5F88\u597D\uFF1F\u4E0D\u8BB8\u8BF4\u300C\u50CF\u4E94\u82B1\u8089\u300D", void 0, ["cranky"]),
      line4("\u518D\u6478\u6211\u5C31\u8981\u7761\u7740\u4E86", void 0, ["lazy", "goofy"]),
      line4("\u55EF\u2026\u2026\u8FD9\u6837\u5F88\u597D", void 0, ["normal"]),
      line4("\u4F60\u4ECA\u5929\u6478\u5F97\u7279\u522B\u8BA4\u771F", void 0, ["earnest", "sisterly", "curious"]),
      line4("[\u4E3B\u4EBA]\uFF0C\u6211\u4EEC\u7B97\u4E0D\u7B97\u597D\u670B\u53CB\uFF1F", "\u5F53\u7136\u7B97", ["clingy", "shy"]),
      line4("\u8FD9\u662F\u6211\u4E00\u5929\u91CC\u6700\u559C\u6B22\u7684\u65F6\u523B", void 0, ["clingy"]),
      line4("\u6478\u732A\u53EF\u4EE5\u964D\u8840\u538B\uFF0C\u8FD9\u662F\u79D1\u5B66\uFF08\u6211\u7F16\u7684\uFF09", void 0, ["goofy"])
    ),
    hungry: scene4(line4("\u6211\u997F\u5F97\u80FD\u770B\u89C1\u5E7B\u89C9\u4E86\uFF0C\u4F60\u5934\u4E0A\u6709\u4E2A\u5305\u5B50", void 0, ["goofy"]), line4("\u518D\u4E0D\u5403\u996D\uFF0C\u6211\u5C31\u8981\u5F00\u59CB\u5403\u81EA\u5DF1\u7684\u5F71\u5B50\u4E86", void 0, ["goofy"]), line4("\u996D\u996D\u2026\u2026\u996D\u996D\u2026\u2026", "\u9A6C\u4E0A\u6765", ["clingy"])),
    dirty: scene4(line4("\u6211\u8EAB\u4E0A\u7684\u6CE5\u5DF4\u5DF2\u7ECF\u53EF\u4EE5\u79CD\u82B1\u4E86", void 0, ["goofy"]), line4("\u82CD\u8747\u7ED5\u7740\u6211\u98DE\uFF0C\u5B83\u4EEC\u5728\u5F00\u4F1A\u8BA8\u8BBA\u6211", void 0, ["curious", "goofy"]), line4("\u6211\u9700\u8981\u4E00\u4E2A\u6FA1\uFF0C\u4E00\u4E2A\u70ED\u7684\uFF08\u4E0D\u8981\u592A\u70ED\uFF09", "\u597D")),
    lonely: scene4(line4("\u6211\u521A\u624D\u8DDF\u5899\u804A\u4E86\u4E00\u4F1A\u513F\uFF0C\u5899\u4E0D\u592A\u4F1A\u804A\u5929", void 0, ["goofy", "mischievous"]), line4("\u4F60\u8FD8\u8BB0\u5F97\u4F60\u517B\u4E86\u4E00\u53EA\u732A\u5417", "\u8BB0\u5F97", ["cranky", "shy", "snooty"]), line4("\u6CA1\u4E8B\uFF0C\u6211\u5C31\u662F\u60F3\u770B\u770B\u4F60\u8FD8\u5728\u4E0D\u5728", void 0, ["normal", "clingy", "shy"])),
    idle: scene4(
      line4("\u6211\u6570\u4E86\u4E00\u4E0B\uFF0C\u5C4F\u5E55\u4E0A\u6709\u5F88\u591A\u5B57\uFF0C\u6211\u4E00\u4E2A\u90FD\u6CA1\u5199", void 0, ["goofy", "snooty"]),
      line4("\u4F60\u5199\u7684\u4E1C\u897F\u597D\u957F\uFF0C\u6211\u80FD\u7761\u4E00\u89C9\u5417", void 0, ["lazy"]),
      line4("\u6211\u521A\u624D\u68A6\u89C1\u81EA\u5DF1\u4F1A\u98DE\uFF0C\u9192\u4E86\u53D1\u73B0\u4F1A\u7684\u53EA\u6709\u5403", void 0, ["goofy"]),
      line4("\u5916\u9762\u6709\u4EBA\u5728\u7092\u83DC\uFF0C\u6211\u7D27\u5F20\u4E86\u4E00\u4E0B", void 0, ["cranky"]),
      line4("\u5750\u76F4\uFF0C[\u4E3B\u4EBA]\uFF0C\u4F60\u7684\u80CC\u5728\u54ED", void 0, ["sisterly"]),
      line4("\u8981\u4E0D\u8981\u559D\u53E3\u6C34\uFF1F\u6211\u66FF\u4F60\u8BB0\u7740", "\u597D", ["sisterly", "earnest"]),
      line4("\u4F60\u7684\u5C4F\u5E55\u597D\u4EAE\uFF0C\u6211\u772F\u4E00\u4F1A\u513F", void 0, ["lazy"]),
      line4("\u521A\u624D\u90A3\u4E2A\u529F\u80FD\u6211\u89C9\u5F97\u5199\u5F97\u4E0D\u9519\uFF08\u6211\u770B\u4E0D\u61C2\uFF0C\u4F46\u6211\u652F\u6301\u4F60\uFF09", void 0, ["goofy", "mischievous", "peppy"])
    ),
    workDone: scene4(line4("\u8001\u677F\u95EE\u6211\u80FD\u4E0D\u80FD\u957F\u671F\u5E72\uFF0C\u6211\u8BF4\u8981\u95EE[\u4E3B\u4EBA]", void 0, ["earnest"]), line4("\u8D5A\u7684\u94B1\u7ED9\u4F60\uFF0C\u8BF7\u6211\u5403\u987F\u597D\u7684\u5C31\u884C", "\u6210\u4EA4", ["sisterly", "normal"]), line4("\u6253\u5DE5\u597D\u7D2F\uFF0C\u4EBA\u7C7B\u6BCF\u5929\u90FD\u8FD9\u6837\u5417", void 0, ["goofy"])),
    tired: scene4(line4("\u6211\u9700\u8981\u8EBA\u5E73\uFF0C\u73B0\u5728\uFF0C\u7ACB\u523B", void 0, ["cranky", "lazy"]), line4("\u6211\u7684\u56DB\u6761\u817F\u5DF2\u7ECF\u5404\u81EA\u4E0B\u73ED\u4E86", void 0, ["lazy", "goofy"]), line4("\u7D2F\u5F97\u8FDE\u996D\u90FD\u2026\u2026\u4E0D\uFF0C\u996D\u8FD8\u662F\u8981\u5403\u7684", void 0, ["cranky", "goofy"])),
    study: scene4(line4("\u4ECA\u5929\u5B66\u4E86\u4E00\u4E2A\u65B0\u8BCD\uFF0C\u5FD8\u4E86", void 0, ["goofy"]), line4("\u8001\u5E08\u8BF4\u6211\u5F88\u6709\u6F5C\u529B\uFF0C\u6F5C\u5728\u54EA\u6211\u4E5F\u4E0D\u77E5\u9053", void 0, ["goofy"]), line4("\u5B66\u4E60\u4F7F\u6211\u8FDB\u6B65\uFF0C\u4E5F\u4F7F\u6211\u997F", "\u53BB\u5403\u5427")),
    graduate: scene4(line4("\u8BC1\u4E66\u6302\u5899\u4E0A\uFF0C\u522B\u6302\u83DC\u5200\u65C1\u8FB9", void 0, ["cranky"]), line4("\u6211\u662F\u5168\u73ED\u6700\u5BBD\u7684\u6BD5\u4E1A\u751F", void 0, ["goofy"]), line4("\u6709\u6587\u5316\u7684\u732A\uFF0C\u4E0D\u5BB9\u6613\u88AB\u9A97\u8FDB\u53A8\u623F", void 0, ["cranky"])),
    tripBack: scene4(line4("\u5916\u9762\u5230\u5904\u90FD\u662F\u996D\u9986\uFF0C\u6211\u4E00\u8DEF\u4F4E\u7740\u5934\u8D70\u7684", void 0, ["cranky"]), line4("\u6211\u770B\u89C1\u6D77\u4E86\uFF01\u6D77\u91CC\u6CA1\u6709\u732A", void 0, ["curious", "goofy"]), line4("\u62CD\u4E86\u597D\u591A\u7167\u7247\uFF0C\u6BCF\u5F20\u90FD\u5728\u7B11\uFF08\u5176\u5B9E\u5F88\u997F\uFF09", void 0, ["goofy"])),
    sick: scene4(line4("\u6211\u89C9\u5F97\u6211\u9700\u8981\u4E00\u4E2A\u62B1\u62B1\uFF0C\u548C\u4E00\u9897\u836F", "\u90FD\u7ED9\u4F60"), line4("\u8EAB\u4F53\u91CC\u6709\u4E2A\u5C0F\u574F\u86CB\u5728\u641E\u88C5\u4FEE"), line4("\u6211\u751F\u75C5\u4E86\uFF0C\u75C5\u732A\u8089\u4E0D\u80FD\u5403\u2014\u2014\u8FD9\u662F\u597D\u6D88\u606F")),
    wrongMedicine: scene4(line4("\u8FD9\u4E2A\u836F\u2026\u2026\u597D\u50CF\u662F\u7ED9\u72D7\u5403\u7684"), line4("\u6211\u539F\u8C05\u4F60\uFF0C\u4F60\u770B\u8D77\u6765\u6BD4\u6211\u8FD8\u96BE\u53D7"), line4("\u4E0B\u6B21\u770B\u6E05\u695A\u8BF4\u660E\u4E66\u597D\u4E0D\u597D", "\u597D")),
    cured: scene4(line4("\u6211\u6D3B\u8FC7\u6765\u4E86\uFF01\u7B2C\u4E00\u4EF6\u4E8B\uFF1A\u5403\u996D", void 0, ["goofy"]), line4("\u960E\u738B\u7237\u770B\u4E86\u770B\u6211\u7684\u4F53\u91CD\uFF0C\u8BF4\u300C\u518D\u517B\u517B\u300D", void 0, ["cranky", "goofy"]), line4("\u5065\u5EB7\u771F\u597D\uFF0C\u6211\u73B0\u5728\u53EF\u4EE5\u91CD\u65B0\u62C5\u5FC3\u522B\u7684\u4E8B\u4E86")),
    levelup: scene4(line4("\u5347\u7EA7\u4E86\uFF0C\u5956\u52B1\u662F\u66F4\u5927\u7684\u996D\u91CF"), line4("\u6211\u53D8\u5F3A\u4E86\uFF0C\u81F3\u5C11\u6570\u5B57\u4E0A\u662F\u8FD9\u6837", void 0, ["goofy"]), line4("\u4F60\u770B\u89C1\u4E86\u5417\uFF1F\u6211\u5347\u7EA7\u4E86\uFF01", "\u770B\u89C1\u4E86", ["peppy"])),
    growUp: scene4(line4("\u957F\u5927\u7684\u611F\u89C9\uFF0C\u5C31\u662F\u9505\u53D8\u591A\u4E86", void 0, ["cranky"]), line4("\u6211\u957F\u5F00\u4E86\u2026\u2026\u4F60\u522B\u7528\u8FD9\u4E2A\u8BCD", void 0, ["cranky"]), line4("[\u4E3B\u4EBA]\uFF0C\u4F60\u4E5F\u8981\u4E00\u8D77\u957F\u5927\u54E6", void 0, ["sisterly"])),
    coronation: scene4(line4("\u672C\u738B\u4ECA\u65E5\u5F00\u6069\uFF0C\u514D\u4F60\u4E00\u987F\u4E0D\u5582\u4E4B\u7F6A", void 0, ["cranky"]), line4("\u738B\u51A0\u597D\u91CD\uFF0C\u8116\u5B50\u8981\u53D8\u957F\u4E86", void 0, ["goofy"]), line4("\u81E3\u6C11\u4EEC\uFF0C\u5F00\u996D\uFF01", void 0, ["peppy"]), line4("[\u4E3B\u4EBA]\u662F\u672C\u738B\u7684\u9996\u5E2D\u5582\u996D\u5B98", "\u9075\u547D", ["snooty"])),
    contract: scene4(line4("\u6211\u73B0\u5728\u662F\u6076\u9B54\u4E86\uFF0C\u4F46\u8FD8\u662F\u6015\u70ED\u6C34", void 0, ["cranky"]), line4("\u89D2\u662F\u65B0\u7684\uFF0C\u6492\u5A07\u662F\u65E7\u7684", void 0, ["clingy"]), line4("\u6076\u9B54\u4E5F\u9700\u8981\u88AB\u6478\u6478", void 0, ["clingy"]), line4("\u7B7E\u4E86\u5951\u7EA6\uFF0C\u4EE5\u540E\u8C01\u4E5F\u4E0D\u80FD\u628A\u6211\u505A\u6210\u83DC", "\u90A3\u5F53\u7136", ["cranky"])),
    enter: scene4(line4("\u4F60\u7EC8\u4E8E\u56DE\u6765\u4E86\uFF0C\u6211\u6570\u4E86\u597D\u4E45\u7684\u50CF\u7D20", void 0, ["shy"]), line4("\u6B22\u8FCE\u56DE\u6765\uFF0C\u4ECA\u5929\u4E5F\u62DC\u6258\u591A\u5582\u6211\u4E00\u70B9"), line4("\u6211\u521A\u521A\u4E00\u76F4\u5728\u8FD9\u91CC\uFF0C\u4E00\u52A8\u4E0D\u52A8\uFF0C\u5F88\u4E56", "\u771F\u4E56", ["earnest"])),
    death: scene4(line4("\u8BB0\u5F97\u7ED9\u6211\u70E7\u70B9\u9972\u6599\u2026\u2026"), line4("[\u4E3B\u4EBA]\uFF0C\u522B\u96BE\u8FC7\uFF0C\u6211\u53EA\u662F\u53BB\u4E0B\u4E00\u4E2A\u732A\u5708\u4E86")),
    revive: scene4(line4("\u90A3\u8FB9\u7684\u732A\u90FD\u5F88\u7626\uFF0C\u6211\u8FD8\u662F\u56DE\u6765\u5427", void 0, ["goofy"]), line4("\u6211\u56DE\u6765\u4E86\uFF0C\u996D\u8FD8\u5728\u5417", void 0, ["peppy", "goofy"]), line4("\u5DEE\u4E00\u70B9\u5C31\u89C1\u5230\u732A\u516B\u6212\u4E86", void 0, ["goofy"])),
    signIn: scene4(line4("\u53C8\u662F\u65B0\u7684\u4E00\u5929\uFF0C\u6211\u8FD8\u5728\uFF0C\u4F60\u4E5F\u5728"), line4("\u7B2C 7 \u5929\u6709\u5927\u793C\uFF0C\u575A\u6301\u4F4F", void 0, ["earnest"])),
    gift: scene4(line4("\u6253\u5F00\u770B\u770B\uFF1F\u6211\u4E5F\u4E0D\u77E5\u9053\u662F\u4EC0\u4E48", void 0, ["curious"]), line4("\u6211\u66FF\u4F60\u5B88\u7740\u5B83\u597D\u4E45\u4E86", void 0, ["earnest"])),
    pomodoroStart: scene4(line4("\u6211\u95ED\u5634\u4E86\uFF0C\u4ECE\u73B0\u5728\u5F00\u59CB", void 0, ["cranky"]), line4("\u4E13\u5FC3\uFF01\u6211\u5E2E\u4F60\u77AA\u7740\u5C4F\u5E55", void 0, ["sisterly", "earnest"]), line4("\u6211\u5F53\u4E00\u5757\u5B89\u9759\u7684\u4E94\u82B1\u8089", void 0, ["goofy"])),
    pomodoroDone: scene4(line4("\u505A\u5B8C\u4E86\uFF01\u5956\u52B1\u81EA\u5DF1\u6478\u4E00\u4E0B\u732A", void 0, ["clingy"]), line4("\u4F60\u597D\u5389\u5BB3\uFF0C\u6211\u90FD\u770B\u7761\u7740\u4E86", void 0, ["lazy", "goofy"]), line4("\u8D77\u6765\u8D70\u8D70\uFF0C\u987A\u4FBF\u770B\u770B\u6211", void 0, ["clingy"])),
    pomodoroAbandon: scene4(line4("\u6CA1\u5173\u7CFB\uFF0C\u756A\u8304\u4E5F\u4F1A\u7D2F", void 0, ["goofy"]), line4("\u90A3\u6211\u4EEC\u5148\u5403\u70B9\u4E1C\u897F\uFF1F"), line4("\u4E0B\u6B21\u518D\u4E00\u8D77\u52AA\u529B")),
    // ---- 新场景 ----------------------------------------------------------------
    workStart: scene4(line4("\u51FA\u95E8\u642C\u7816\u53BB\u4E86"), line4("\u6211\u53BB\u7ED9\u5BB6\u91CC\u6323\u9972\u6599\u94B1", void 0, ["earnest"]), line4("\u8001\u677F\uFF0C\u6211\u6765\u4E86\uFF01", void 0, ["peppy"])),
    studyStart: scene4(line4("\u4E0A\u5B66\u53BB\uFF01\u4E66\u5305\u91CC\u88C5\u7684\u662F\u96F6\u98DF", void 0, ["goofy"]), line4("\u4ECA\u5929\u4E5F\u8981\u542C\u61C2\u4E00\u53E5"), line4("\u8001\u5E08\u522B\u70B9\u6211\u540D", void 0, ["shy"])),
    tripStart: scene4(line4("\u51FA\u53D1\u5566\uFF01"), line4("\u6211\u4F1A\u7ED9\u4F60\u5E26\u7279\u4EA7\u7684\uFF08\u4E0D\u662F\u814A\u8089\uFF09", void 0, ["cranky"]), line4("\u8DEF\u4E0A\u522B\u60F3\u6211", void 0, ["cranky"])),
    buy: scene4(line4("\u4E70\u5230\u4E86\uFF01", void 0, ["peppy"]), line4("\u8FD9\u4E2A\u94B1\u82B1\u5F97\u503C"), line4("\u8C22\u8C22\u8001\u677F\uFF08\u6211\u8BF4\u7684\u662F\u4F60\uFF09")),
    poor: scene4(line4("\u94B1\u5305\u7A7A\u7A7A\uFF0C\u8DDF\u6211\u7684\u996D\u76C6\u4E00\u6837", void 0, ["goofy"]), line4("\u6211\u4EEC\u597D\u50CF\u6709\u70B9\u7A77"), line4("\u8981\u4E0D\u2026\u2026\u6211\u53BB\u6253\u5DE5\uFF1F", void 0, ["earnest"])),
    fishCatch: scene4(line4("\u9493\u5230\u5566\uFF01"), line4("\u665A\u996D\u6709\u7740\u843D\u4E86", void 0, ["goofy"]), line4("\u8FD9\u6761\u9C7C\u770B\u6211\u7684\u773C\u795E\u4E0D\u592A\u53CB\u597D", void 0, ["goofy"])),
    fishRare: scene4(line4("\u662F\u5927\u7684\uFF01\u662F\u5927\u7684\uFF01"), line4("\u8FD9\u6761\u9C7C\u503C\u5F97\u5199\u8FDB\u65E5\u8BB0"), line4("\u5FEB\u62CD\u7167\uFF01", void 0, ["snooty"])),
    fishEscape: scene4(line4("\u5B83\u8DD1\u4E86\u2026\u2026"), line4("\u4E0B\u4E00\u6761\u4E00\u5B9A\u662F\u6211\u7684", void 0, ["peppy", "earnest"]), line4("\u9C7C\u4E5F\u662F\u8981\u9762\u5B50\u7684", void 0, ["snooty"])),
    skin: scene4(line4("\u597D\u770B\u5417\uFF1F", void 0, ["snooty", "shy"]), line4("\u65B0\u8863\u670D\uFF01\u8F6C\u4E2A\u5708\u7ED9\u4F60\u770B", void 0, ["peppy", "snooty"]), line4("\u6211\u89C9\u5F97\u6211\u53D8\u5E05\u4E86", void 0, ["snooty"])),
    bodyChange: scene4(line4("\u6211\u597D\u50CF\u2026\u2026\u5706\u4E86\u4E00\u70B9"), line4("\u8FD9\u4E0D\u662F\u80D6\uFF0C\u662F\u53EF\u7231\u7684\u5BC6\u5EA6\u53D8\u5927\u4E86", void 0, ["snooty"]), line4("\u79E4\u8BF4\u7684\u8BDD\u4E0D\u80FD\u5168\u4FE1", void 0, ["cranky"])),
    // ---- 按时间说话（core/talk.js 决定什么时候说）---------------------------------
    morning: scene4(line4("\u65E9\u4E0A\u597D\uFF01\u4ECA\u5929\u4E5F\u8981\u597D\u597D\u5403\u996D"), line4("\u8D77\u8FD9\u4E48\u65E9\uFF0C\u4F60\u662F\u8981\u53BB\u5F53\u65E9\u9910\u5417\uFF08\u6211\u5F00\u73A9\u7B11\u7684\uFF09", void 0, ["cranky", "goofy", "mischievous"]), line4("\u65E9\u5B89\uFF0C[\u4E3B\u4EBA]\uFF0C\u6211\u6628\u665A\u68A6\u89C1\u4F60\u4E86", void 0, ["clingy", "shy"])),
    noon: scene4(line4("\u4E2D\u5348\u4E86\uFF0C\u5403\u996D\u5403\u996D\uFF01"), line4("\u4F60\u5403\u4E86\u5417\uFF1F\u6211\u997F\u4E86\uFF0C\u4F60\u80AF\u5B9A\u4E5F\u997F\u4E86", void 0, ["sisterly", "normal"]), line4("\u5348\u996D\u522B\u5403\u732A\u8089\u597D\u4E0D\u597D", "\u597D", ["cranky", "shy"])),
    afternoon: scene4(line4("\u4E0B\u5348\u597D\u56F0\u2026\u2026\u6211\u5148\u7761\u4E3A\u656C", void 0, ["lazy"]), line4("\u559D\u676F\u8336\u5427\uFF0C\u6211\u966A\u4F60\u53D1\u4F1A\u513F\u5446", void 0, ["sisterly", "normal"]), line4("\u4E0B\u5348\u6700\u9002\u5408\u6253\u76F9\uFF0C\u79D1\u5B66\u7814\u7A76\uFF08\u6211\u7F16\u7684\uFF09", void 0, ["lazy", "goofy"])),
    evening: scene4(line4("\u5929\u9ED1\u4E86\uFF0C\u4ECA\u5929\u8F9B\u82E6\u5566"), line4("\u665A\u996D\u5403\u4EC0\u4E48\uFF1F\u6211\u6295\u7968\u7ED9\u82F9\u679C", void 0, ["goofy", "cranky", "curious", "mischievous"]), line4("\u4E0B\u73ED\u4E86\u5417\uFF1F\u8FD8\u6CA1\uFF1F\u6211\u7B49\u4F60", void 0, ["clingy", "shy"])),
    lateNight: scene4(line4("\u8FD9\u4E48\u665A\u4E86\u8FD8\u4E0D\u7761\uFF1F", "\u9A6C\u4E0A\u7761", ["sisterly"]), line4("\u71AC\u591C\u7684\u4EBA\u4F1A\u53D8\u6210\u718A\u732B\uFF0C\u71AC\u591C\u7684\u732A\u4F1A\u53D8\u6210\u814A\u8089", void 0, ["cranky", "goofy"]), line4("\u6211\u5148\u7761\u4E86\uFF0C\u4F60\u4E5F\u65E9\u70B9")),
    deepNight: scene4(line4("[\u4E3B\u4EBA]\u2026\u2026\u73B0\u5728\u662F\u51CC\u6668\uFF0C\u4F60\u662F\u8BA4\u771F\u7684\u5417", void 0, ["cranky"]), line4("\u6211\u5DF2\u7ECF\u7761\u9192\u4E00\u89C9\u4E86\uFF0C\u4F60\u8FD8\u5728", void 0, ["lazy", "goofy"]), line4("\u5929\u5FEB\u4EAE\u4E86\uFF0C\u6C42\u4F60\u7761\u4E00\u4F1A\u513F", void 0, ["clingy", "sisterly", "shy"])),
    water: scene4(line4("\u559D\u53E3\u6C34\u5427\uFF0C\u6211\u66FF\u4F60\u559D\u4E0D\u4E86"), line4("\u5634\u5507\u5E72\u4E86\u5427\uFF1F\u53BB\u5012\u676F\u6C34", void 0, ["sisterly", "normal"]), line4("\u559D\u6C34\u65F6\u95F4\u5230\uFF01\u5495\u561F\u5495\u561F", void 0, ["peppy"])),
    eyes: scene4(line4("\u770B\u770B\u8FDC\u5904\uFF0C\u4E09\u5341\u79D2\u5C31\u597D"), line4("\u773C\u775B\u7D2F\u4E86\uFF0C\u95ED\u4E00\u4F1A\u513F\uFF0C\u6211\u5E2E\u4F60\u770B\u7740", void 0, ["sisterly"]), line4("\u7AD9\u8D77\u6765\u4F38\u4E2A\u61D2\u8170\uFF0C\u6211\u4E5F\u4F38\u4E00\u4E2A")),
    weekend: scene4(line4("\u5468\u672B\u4E86\u8FD8\u6765\u770B\u6211\uFF0C\u4F60\u771F\u597D", void 0, ["normal", "clingy", "shy"]), line4("\u4ECA\u5929\u4E0D\u4E0A\u73ED\u5427\uFF1F\u90A3\u5C31\u591A\u966A\u6211\u4E00\u4F1A\u513F", void 0, ["clingy"])),
    newYear: scene4(line4("\u65B0\u5E74\u5FEB\u4E50\uFF01\u4ECA\u5E74\u4E5F\u8BF7\u591A\u591A\u5582\u6211")),
    valentine: scene4(line4("\u4ECA\u5929\u7684\u6211\u662F\u9650\u91CF\u7248\u7684\uFF0C\u9001\u7ED9\u4F60")),
    springFestival: scene4(line4("\u8FC7\u5E74\u597D\uFF01\u2026\u2026\u4ECA\u5E74\u8BF7\u4E00\u5B9A\u4E0D\u8981\u5403\u732A\u8089", "\u4E0D\u5403")),
    lantern: scene4(line4("\u5403\u6C64\u5706\u5417\uFF1F\u6C64\u5706\u6CA1\u6709\u732A\uFF0C\u6211\u653E\u5FC3\u4E86")),
    qingming: scene4(line4("\u60F3\u5FF5\u4E00\u4E0B\u4EE5\u524D\u7684\u732A\u2026\u2026\u6211\u662F\u8BF4\u670B\u53CB\u4EEC")),
    labour: scene4(line4("\u52B3\u52A8\u8282\uFF01\u6211\u51B3\u5B9A\u4ECA\u5929\u4E0D\u52B3\u52A8")),
    children: scene4(line4("\u6211\u4E5F\u662F\u5C0F\u670B\u53CB\uFF0C\u793C\u7269\u5728\u54EA\uFF1F")),
    dragonBoat: scene4(line4("\u7CBD\u5B50\u91CC\u6709\u8089\uFF0C\u6211\u9009\u62E9\u770B\u4E0D\u89C1")),
    qixi: scene4(line4("\u4ECA\u5929\u8981\u548C\u6700\u91CD\u8981\u7684\u4EBA\u5728\u4E00\u8D77\uFF0C\u6240\u4EE5\u6211\u5728\u8FD9\u91CC")),
    midAutumn: scene4(line4("\u6708\u4EAE\u597D\u5706\uFF0C\u50CF\u6211\u7684\u809A\u5B50")),
    national: scene4(line4("\u56FD\u5E86\u5FEB\u4E50\uFF01\u653E\u5047\u8BB0\u5F97\u966A\u966A\u6211")),
    christmas: scene4(line4("\u5723\u8BDE\u5FEB\u4E50\uFF01\u5723\u8BDE\u8001\u4EBA\u4F1A\u7ED9\u732A\u9001\u793C\u7269\u5417")),
    pigBirthday: scene4(line4("\u4ECA\u5929\u662F\u6211\u7684\u751F\u65E5\uFF01[\u4E3B\u4EBA]\u8BB0\u5F97\u5417\uFF1F", "\u751F\u65E5\u5FEB\u4E50")),
    // ---- 摸不同部位（客户端按点的位置告诉核心是哪儿）----------------------------
    petHead: scene4(line4("\u6478\u5934\u4F1A\u957F\u4E0D\u9AD8\u7684\u2026\u2026\u7B97\u4E86\uFF0C\u957F\u4E0D\u9AD8\u4E5F\u597D", void 0, ["cranky", "goofy"]), line4("\u518D\u6478\u6478\u5934\uFF5E"), line4("\u6211\u7684\u5934\u5F88\u5706\uFF0C\u662F\u4E0D\u662F\u5F88\u597D\u6478", void 0, ["snooty"])),
    petEars: scene4(line4("\u8033\u6735\u597D\u75D2\uFF01"), line4("\u522B\u63EA\uFF0C\u4F1A\u53D8\u6210\u732A\u8033\u6735\u2026\u2026\u6211\u672C\u6765\u5C31\u662F", void 0, ["cranky", "goofy"]), line4("\u5618\uFF0C\u8033\u6735\u5728\u542C\u4F60\u8BF4\u8BDD", void 0, ["curious", "shy"])),
    petNose: scene4(line4("\u963F\u2014\u2014\u568F\uFF01"), line4("\u9F3B\u5B50\u662F\u7528\u6765\u95FB\u996D\u7684\uFF0C\u4E0D\u662F\u7528\u6765\u6309\u7684", void 0, ["cranky"]), line4("\u54FC\u54FC\uFF01\uFF08\u8FD9\u662F\u6297\u8BAE\uFF09", void 0, ["cranky"])),
    petBelly: scene4(line4("\u54C8\u54C8\u54C8\u597D\u75D2\uFF01", void 0, ["peppy", "goofy"]), line4("\u522B\u6309\u809A\u5B50\uFF0C\u521A\u5403\u9971", void 0, ["cranky"]), line4("\u8F6F\u5427\uFF1F\u4E0D\u8BB8\u8BF4\u300C\u4E94\u82B1\u300D", void 0, ["cranky", "snooty"])),
    petBack: scene4(line4("\u80CC\u4E0A\u90A3\u5757\uFF0C\u5BF9\uFF0C\u5C31\u662F\u90A3\u91CC"), line4("\u6309\u6469\u670D\u52A1\uFF0C\u4E94\u661F\u597D\u8BC4", void 0, ["snooty"]), line4("\u4F60\u7684\u624B\u6CD5\u5F88\u4E13\u4E1A", void 0, ["snooty"])),
    petTail: scene4(line4("\u522B\u78B0\u5C3E\u5DF4\uFF01\u2026\u2026\u597D\u5427\u53EF\u4EE5\u78B0\u4E00\u4E0B", void 0, ["cranky", "clingy"]), line4("\u6211\u7684\u5C3E\u5DF4\u4F1A\u81EA\u5DF1\u8F6C\uFF0C\u4F60\u770B", void 0, ["goofy"]), line4("\u5C3E\u5DF4\u662F\u732A\u7684\u79D8\u5BC6\u6B66\u5668", void 0, ["snooty"])),
    petFeet: scene4(line4("\u811A\u4E0D\u80FD\u6478\uFF0C\u4F1A\u75D2"), line4("\u6211\u7684\u8E44\u5B50\u521A\u8D70\u8FC7\u6CE5\u5DF4\u54E6", void 0, ["mischievous"]), line4("\u5E72\u561B\uFF0C\u60F3\u8DDF\u6211\u63E1\u624B\uFF1F", "\u63E1\u624B", ["peppy", "curious"])),
    petTooMuch: scene4(line4("\u591F\u4E86\u591F\u4E86\uFF0C\u6BDB\u8981\u6389\u4E86", void 0, ["cranky"]), line4("\u4F60\u662F\u4E0D\u662F\u5728\u627E\u54EA\u5757\u6700\u5AE9\uFF1F", void 0, ["cranky"]), line4("\u6211\u8981\u6536\u8D39\u4E86\uFF0C\u4E00\u4E0B\u4E00\u4E2A\u82F9\u679C", void 0, ["cranky", "mischievous"]), line4("\u518D\u6478\u6211\u5C31\u751F\u6C14\u4E86\uFF01\uFF08\u5176\u5B9E\u6CA1\u6709\uFF09", void 0, ["cranky"]), line4("\u8BA9\u6211\u4F11\u606F\u4E00\u4E0B\u2026\u2026"))
  });
  var MORE_LINES = Object.freeze(Object.fromEntries(
    [.../* @__PURE__ */ new Set([...Object.keys(BASE_MORE_LINES), ...Object.keys(COMPANION_CARE_LINES), ...Object.keys(COMPANION_LIFE_LINES), ...Object.keys(DARK_HUMOR_LINES)])].map((key2) => [key2, Object.freeze([
      ...BASE_MORE_LINES[key2] ?? [],
      ...COMPANION_CARE_LINES[key2] ?? [],
      ...COMPANION_LIFE_LINES[key2] ?? [],
      ...DARK_HUMOR_LINES[key2] ?? []
    ])])
  ));
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
  var line5 = (text, reply, personalities) => Object.freeze({
    text,
    ...reply === void 0 ? {} : { replies: Object.freeze([Object.freeze({ label: reply })]) },
    ...personalities === void 0 ? {} : { personalities: Object.freeze(personalities) }
  });
  var scene5 = (...lines) => Object.freeze(lines);
  var BASE_LINES = Object.freeze({
    // 被拿起/戳醒：只说一句，不啰嗦。
    wake: scene5(
      line5("\u5514\u2026\u2026\u88AB\u62CE\u8D77\u6765\u4E86"),
      line5("\u9192\u4E86\u9192\u4E86\uFF0C\u522B\u6643\u6211", void 0, ["cranky"]),
      line5("\uFF08\u8FF7\u8FF7\u7CCA\u7CCA\uFF09\u5230\u54EA\u513F\u4E86\uFF1F", void 0, ["goofy"])
    ),
    // --- 照顾 -----------------------------------------------------------------
    eat: scene5(
      line5("\u597D\u5403\uFF01\u8FD8\u6709\u5417\uFF1F", "\u771F\u4E56", ["peppy", "curious"]),
      line5("\u5427\u5527\u5427\u5527\u2026\u2026"),
      line5("[\u4E3B\u4EBA]\u6700\u597D\u4E86\uFF5E", void 0, ["peppy", "clingy"]),
      line5("\u8FD9\u4E2A\u5473\u9053\u6211\u8BB0\u4F4F\u4E86", void 0, ["earnest"]),
      line5("\u5403\u9971\u9971\u624D\u6709\u529B\u6C14\u966A\u4F60\u52A0\u73ED", void 0, ["sisterly", "normal"]),
      line5("\u55DD\u2014\u2014\uFF08\u4E0D\u597D\u610F\u601D\uFF09", void 0, ["shy"])
    ),
    full: scene5(
      line5("\u5403\u9971\u5566\uFF0C\u809A\u5B50\u5706\u6EDA\u6EDA\u7684"),
      line5("\u597D\u9971\u597D\u9971\uFF0C\u518D\u5403\u5C31\u8981\u6491\u7740\u4E86"),
      line5("\u55DD\u2014\u2014\u8C22\u8C22[\u4E3B\u4EBA]\uFF0C\u9971\u9971\u7684", void 0, ["normal"])
    ),
    overfull: scene5(
      line5("\u6491\u2026\u2026\u6491\u4F4F\u4E86\u2026\u2026"),
      line5("\u771F\u7684\u5403\u4E0D\u4E0B\u4E86\uFF0C\u4F60\u770B\u6211\u809A\u5B50", void 0, ["cranky"]),
      line5("\u518D\u5582\u6211\u5C31\u8981\u53D8\u6210\u7403\u4E86", "\u6700\u540E\u4E00\u53E3", ["goofy"])
    ),
    bathe: scene5(
      line5("\u9999\u55B7\u55B7\u7684\uFF01"),
      line5("\u6C34\u6709\u70B9\u51C9\u2026\u2026", "\u9A6C\u4E0A\u64E6\u5E72", ["shy"]),
      line5("\u6413\u6413\u80CC\uFF0C\u8212\u670D\uFF5E", void 0, ["lazy"]),
      line5("\u6CE1\u6CE1\uFF01\u662F\u6CE1\u6CE1\uFF01", void 0, ["peppy", "goofy"]),
      line5("\u6D17\u5E72\u51C0\u4E86\uFF0C\u53EF\u4EE5\u62B1\u4E86")
    ),
    play: scene5(
      line5("\u518D\u6765\u4E00\u6B21\uFF01", void 0, ["peppy"]),
      line5("\u63A5\u4F4F\u5566\uFF01", "\u771F\u68D2", ["peppy", "snooty"]),
      line5("\u54C8\u54C8\u54C8\u597D\u597D\u73A9", void 0, ["peppy", "goofy"]),
      line5("\u6211\u8DD1\u5F97\u6BD4\u7403\u5FEB", void 0, ["peppy", "snooty"]),
      line5("\u73A9\u7D2F\u4E86\u2026\u2026\u518D\u73A9\u4E94\u5206\u949F", void 0, ["lazy", "goofy"])
    ),
    pet: scene5(
      line5("\u597D\u8212\u670D\u2026\u2026"),
      line5("\u518D\u6478\u6478\uFF5E", "\u597D", ["peppy", "clingy"]),
      line5("\u547C\u565C\u547C\u565C\u2026\u2026", void 0, ["lazy", "goofy"]),
      line5("\uFF08\u772F\u8D77\u773C\u775B\uFF09"),
      line5("\u8FD9\u91CC\u8FD9\u91CC\uFF01\u5DE6\u8FB9\u4E00\u70B9\uFF01", void 0, ["peppy", "mischievous", "curious"]),
      line5("\u5514\u2026\u2026\u597D\u75D2", void 0, ["shy"]),
      line5("[\u4E3B\u4EBA]\u7684\u624B\u6696\u6696\u7684", void 0, ["normal"])
    ),
    // --- 状态提醒（闲着时优先说这些）-------------------------------------------
    hungry: scene5(
      line5("\u809A\u5B50\u5495\u5495\u53EB\u4E86\u2026\u2026"),
      line5("[\u4E3B\u4EBA]\uFF0C\u996D\u996D\uFF01", "\u9A6C\u4E0A\u6765", ["peppy", "clingy"]),
      line5("\u6211\u53EF\u4EE5\u5403\u4E00\u6574\u4E2A\u82F9\u679C\u6811", void 0, ["peppy", "goofy"])
    ),
    dirty: scene5(
      line5("\u8EAB\u4E0A\u6709\u70B9\u75D2\u75D2\u7684"),
      line5("\u6211\u662F\u4E0D\u662F\u6709\u70B9\u5473\u9053\u4E86\u2026\u2026", void 0, ["shy"]),
      line5("\u60F3\u6D17\u6CE1\u6CE1\u6D74", "\u597D\uFF0C\u8FD9\u5C31\u6D17")
    ),
    lonely: scene5(
      line5("[\u4E3B\u4EBA]\u5728\u5FD9\u4EC0\u4E48\u5440\uFF1F", void 0, ["curious", "clingy", "shy"]),
      line5("\u4F60\u597D\u4E45\u6CA1\u7406\u6211\u4E86\u2026\u2026", "\u966A\u4F60\u4E00\u4F1A\u513F", ["clingy", "shy"]),
      line5("\u6211\u4E00\u4E2A\u4EBA\u5728\u8FD9\u513F\u6570\u50CF\u7D20", void 0, ["lazy", "goofy"])
    ),
    idle: scene5(
      line5("\uFF08\u6253\u4E86\u4E2A\u54C8\u6B20\uFF09", void 0, ["lazy"]),
      line5("\u4ECA\u5929\u5929\u6C14\u597D\u50CF\u4E0D\u9519"),
      line5("\u4F60\u5199\u7684\u4EE3\u7801\u6211\u770B\u61C2\u4E86\u4E00\u884C\uFF01", void 0, ["earnest"]),
      line5("\u8981\u4E0D\u8981\u4F11\u606F\u4E00\u4E0B\u773C\u775B\uFF1F", "\u597D", ["sisterly"]),
      line5("\u6211\u5728\u60F3\u665A\u996D\u5403\u4EC0\u4E48"),
      line5("\uFF08\u5728\u89D2\u843D\u91CC\u6EDA\u4E86\u4E00\u5708\uFF09", void 0, ["mischievous", "goofy"]),
      line5("[\u4E3B\u4EBA]\u52A0\u6CB9\uFF0C\u6211\u5728\u65C1\u8FB9\u770B\u7740", void 0, ["peppy", "earnest"]),
      line5("\u521A\u624D\u90A3\u4E2A\u62A5\u9519\u6211\u4E5F\u770B\u89C1\u4E86\u2026\u2026", void 0, ["normal", "shy"])
    ),
    // --- 出门 -----------------------------------------------------------------
    workDone: scene5(
      line5("\u6211\u56DE\u6765\u5566\uFF01\u8D5A\u5230\u94B1\u4E86\uFF01", "\u8F9B\u82E6\u4E86"),
      line5("\u4ECA\u5929\u8001\u677F\u5938\u6211\u4E86", void 0, ["snooty"]),
      line5("\u7D2F\u662F\u7D2F\u4E86\u70B9\uFF0C\u4F46\u662F\u6709\u94B1\u4E86", void 0, ["lazy"])
    ),
    tired: scene5(
      line5("\u597D\u7D2F\u554A\u2026\u2026", "\u6B47\u4F1A\u513F\u5427"),
      line5("\u80FD\u4E0D\u80FD\u5148\u8BA9\u6211\u8EBA\u4E00\u4E0B", void 0, ["lazy"]),
      line5("\u518D\u5E72\u4E0B\u53BB\u6211\u8981\u5934\u6655\u4E86", void 0, ["cranky"])
    ),
    study: scene5(
      line5("\u4ECA\u5929\u5B66\u5230\u597D\u591A\uFF01", "\u771F\u4E56", ["peppy", "earnest"]),
      line5("\u8001\u5E08\u8BB2\u7684\u6211\u90FD\u542C\u61C2\u4E86\uFF08\u5927\u6982\uFF09", void 0, ["goofy"]),
      line5("\u4F5C\u4E1A\u2026\u2026\u660E\u5929\u518D\u8BF4", void 0, ["lazy"])
    ),
    graduate: scene5(
      line5("\u6211\u6BD5\u4E1A\u5566\uFF01\u6211\u6CA1\u6709\u7559\u7EA7\uFF01", "\u771F\u68D2"),
      line5("\u770B\uFF0C\u6211\u7684\u6BD5\u4E1A\u7167\uFF01", void 0, ["snooty"]),
      line5("\u4E0B\u4E00\u6BB5\u6211\u4E5F\u80FD\u5FF5\u5B8C")
    ),
    tripBack: scene5(
      line5("\u6211\u7ED9\u4F60\u5E26\u4E86\u4E1C\u897F\uFF01", "\u662F\u4EC0\u4E48\uFF1F"),
      line5("\u5916\u9762\u597D\u5927\u554A", void 0, ["curious"]),
      line5("\u4E0B\u6B21\u5E26\u4F60\u4E00\u8D77\u53BB", void 0, ["peppy", "clingy"])
    ),
    // --- 生病 -----------------------------------------------------------------
    sick: scene5(
      line5("\u963F\u2014\u2014\u568F\uFF01[\u4E3B\u4EBA]\uFF0C\u6211\u597D\u50CF\u75C5\u4E86\u2026\u2026", "\u4E56\uFF0C\u5403\u836F"),
      line5("\u5934\u6709\u70B9\u6655\u6655\u7684"),
      line5("\u6211\u4E0D\u60F3\u52A8\u2026\u2026")
    ),
    wrongMedicine: scene5(
      line5("\u8FD9\u836F\u597D\u82E6\u2026\u2026\u597D\u50CF\u4E0D\u662F\u8FD9\u4E2A", "\u5BF9\u4E0D\u8D77"),
      line5("\u545C\uFF0C\u66F4\u96BE\u53D7\u4E86"),
      line5("[\u4E3B\u4EBA]\u4F60\u662F\u4E0D\u662F\u770B\u9519\u8BF4\u660E\u4E66\u4E86")
    ),
    cured: scene5(
      line5("\u6211\u597D\u5566\uFF01\u8C22\u8C22[\u4E3B\u4EBA]\uFF5E", "\u771F\u4E56"),
      line5("\u53C8\u80FD\u8DD1\u80FD\u8DF3\u4E86\uFF01"),
      line5("\u4EE5\u540E\u6211\u4F1A\u4E56\u4E56\u5403\u996D\u7684")
    ),
    // --- 成长与生死 -------------------------------------------------------------
    levelup: scene5(
      line5("\u6211\u53C8\u957F\u5927\u4E86\u4E00\u70B9\uFF01", "\u771F\u4E56"),
      line5("\u611F\u89C9\u81EA\u5DF1\u53D8\u5389\u5BB3\u4E86", void 0, ["snooty"]),
      line5("\u4F60\u770B\u6211\u662F\u4E0D\u662F\u9AD8\u4E86\u4E00\u70B9", void 0, ["snooty"])
    ),
    growUp: scene5(
      line5("\u6211\u957F\u5927\u5566\uFF01", void 0, ["peppy"]),
      line5("\u4EE5\u524D\u7684\u8863\u670D\u597D\u50CF\u7A7F\u4E0D\u4E0B\u4E86"),
      line5("[\u4E3B\u4EBA]\uFF0C\u6211\u73B0\u5728\u662F\u5927\u732A\u4E86", void 0, ["snooty"])
    ),
    coronation: scene5(
      line5("\u738B\u51A0\u6709\u70B9\u91CD\uFF0C\u4F46\u6211\u4F1A\u597D\u597D\u6234\u7740\u7684\uFF0C[\u4E3B\u4EBA]\u3002", "\u4F60\u53EF\u4EE5\u7684"),
      line5("\u4ECE\u4ECA\u5929\u8D77\uFF0C\u96F6\u98DF\u4E5F\u7B97\u738B\u5BA4\u4E8B\u52A1\uFF01", void 0, ["peppy", "snooty"]),
      line5("\u6211\u5BA3\u5E03\uFF1A[\u4E3B\u4EBA]\u6C38\u8FDC\u662F\u6211\u7684\u7B2C\u4E00\u4F4D\u8D35\u5BA2\u3002"),
      line5("\u54B3\u54B3\uFF0C\u672C\u738B\u60F3\u5148\u5403\u4E2A\u82F9\u679C\u3002", void 0, ["cranky", "snooty"])
    ),
    contract: scene5(
      line5("\u5951\u7EA6\u7B7E\u597D\u4E86\u3002\u5148\u8BF4\u597D\uFF0C\u6211\u8FD8\u662F\u4F60\u90A3\u53EA\u732A\u3002", "\u5F53\u7136"),
      line5("\u89D2\u957F\u51FA\u6765\u4E86\uFF0C\u6492\u5A07\u7684\u672C\u4E8B\u53EF\u6CA1\u4E22\u3002", void 0, ["peppy", "clingy"]),
      line5("\u6076\u9B54\u4E5F\u8981\u5403\u996D\u5440\uFF0C[\u4E3B\u4EBA]\u3002"),
      line5("\u8FD9\u7B14\u4EA4\u6613\u6211\u8D5A\u4E86\uFF1A\u4EE5\u540E\u8FD8\u80FD\u548C\u4F60\u5728\u4E00\u8D77\u3002", void 0, ["clingy", "shy"])
    ),
    enter: scene5(
      line5("[\u4E3B\u4EBA]\u4F60\u56DE\u6765\u5566\uFF01", "\u56DE\u6765\u4E86", ["peppy"]),
      line5("\u7B49\u4F60\u597D\u4E45\u4E86\uFF5E", void 0, ["clingy"]),
      line5("\u4ECA\u5929\u4E5F\u8981\u4E00\u8D77\u52A0\u6CB9\u54E6", void 0, ["sisterly", "earnest"])
    ),
    death: scene5(
      line5("[\u4E3B\u4EBA]\u4FDD\u91CD\uFF0C\u6211\u8D70\u4E86\uFF0C\u4E0D\u5E26\u8D70\u4E00\u7247\u4E91\u5F69\uFF5E"),
      line5("\u4E0B\u8F88\u5B50\u8FD8\u7ED9\u4F60\u5F53\u732A")
    ),
    revive: scene5(
      line5("\u6211\u2026\u2026\u6211\u56DE\u6765\u4E86\uFF1F"),
      line5("\u90A3\u8FB9\u597D\u51B7\uFF0C\u8FD8\u662F\u8FD9\u91CC\u597D"),
      line5("\u8C22\u8C22\u4F60\u6CA1\u653E\u5F03\u6211", "\u6B22\u8FCE\u56DE\u6765")
    ),
    // --- B5 用 ------------------------------------------------------------------
    signIn: scene5(
      line5("\u7B7E\u5230\u5566\uFF01\u4ECA\u5929\u4E5F\u8981\u597D\u597D\u7684"),
      line5("\u8FD9\u662F\u4ECA\u5929\u7684\u793C\u7269\uFF0C\u7ED9\u4F60\uFF5E", void 0, ["sisterly", "normal"])
    ),
    gift: scene5(
      line5("\u6211\u5728\u5730\u4E0A\u6361\u5230\u4E00\u4E2A\u76D2\u5B50\uFF01", void 0, ["curious"]),
      line5("\u966A\u4F60\u8FD9\u4E48\u4E45\uFF0C\u8FD9\u662F\u5956\u52B1", void 0, ["sisterly", "normal"])
    ),
    // --- C2 番茄钟 --------------------------------------------------------------
    pomodoroStart: scene5(
      line5("[\u4E3B\u4EBA]\u5FD9\u5427\uFF0C\u6211\u8DB4\u8FD9\u513F\u4E0D\u52A8"),
      line5("\u4E13\u6CE8\u6A21\u5F0F\uFF01\u6211\u5E2E\u4F60\u770B\u7740\u65F6\u95F4", void 0, ["earnest"]),
      line5("\u8FD9 25 \u5206\u949F\u6211\u4E5F\u4E0D\u5435\u4F60\uFF0C\u8BF4\u597D\u4E86", void 0, ["earnest"])
    ),
    pomodoroDone: scene5(
      line5("\u65F6\u95F4\u5230\uFF01[\u4E3B\u4EBA]\u771F\u5389\u5BB3", void 0, ["sisterly", "peppy"]),
      line5("\u505A\u5B8C\u4E00\u4E2A\u5566\uFF0C\u8D77\u6765\u52A8\u52A8\u8116\u5B50", void 0, ["sisterly", "earnest"]),
      line5("\u6211\u966A\u4F60\u6570\u7740\u5462\uFF0C\u4E00\u4E2A\u90FD\u4E0D\u5C11", void 0, ["earnest"])
    ),
    pomodoroAbandon: scene5(
      line5("\u4E0D\u505A\u4E86\u5440\uFF1F\u90A3\u5C31\u6B47\u4F1A\u513F"),
      line5("\u6CA1\u4E8B\uFF0C\u7B49\u4F60\u51C6\u5907\u597D\u518D\u6765"),
      line5("\u6211\u5148\u628A\u756A\u8304\u6536\u8D77\u6765\u5566")
    )
  });
  var LINES = Object.freeze(Object.fromEntries(
    [.../* @__PURE__ */ new Set([...Object.keys(BASE_LINES), ...Object.keys(MORE_LINES)])].map((key2) => [key2, Object.freeze([...BASE_LINES[key2] ?? [], ...MORE_LINES[key2] ?? []])])
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
  var subject = (key2, label, emoji, trait, secondary = null) => Object.freeze({ key: key2, label, emoji, trait, secondary });
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
  var job = (key2, label, emoji, trait, minutes, coins, requires) => Object.freeze({ key: key2, label, emoji, trait, minutes, coins, ...COST_BY_MINUTES[minutes], requires: Object.freeze(requires) });
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
  var medicine = (key2, label, emoji, tier) => Object.freeze({ key: key2, label, emoji, tier, price: MEDICINE_PRICE_BY_TIER[tier - 1], kind: "medicine" });
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
    var actions = attachPigActions({ ...c, render: () => syncPigArt(c.pig, c.pigArt, c.pigEmoji) });
    const snap = attachPetSnap({
      ...c,
      canPlay: () => canPlayPigAction(c.pig, "shy-pet") && !c.pig.querySelector?.(".dp-dress")?.childElementCount,
      cancelMicro: () => actions.cancel(),
      render: () => syncPigArt(c.pig, c.pigArt, c.pigEmoji)
    });
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
      var lead = action.key === "butterfly" && c.feel ? 120 : 0;
      if (lead > 0) c.feel.crouch(lead);
      var run = function() {
        c.pig.setAttribute("data-idle", action.key);
        syncPigArt(c.pig, c.pigArt, c.pigEmoji);
        if (action.fx.length > 0) c.burst(action.fx, action.fx.length);
        if (!quiet() && Math.random() < 0.35) c.showBubble(action.say, Math.min(3e3, action.ms));
        later(function() {
          c.pig.removeAttribute("data-idle");
          syncPigArt(c.pig, c.pigArt, c.pigEmoji);
        }, action.ms);
      };
      if (lead > 0) later(run, lead);
      else run();
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
      if (c.feel) c.feel.face(toLeft ? "left" : "right");
      else c.pig.setAttribute("data-walk", toLeft ? "left" : "right");
      if (!quiet() && Math.random() < 0.5) c.showBubble("\u6211\u53BB\u5DE1\u903B\u4E00\u4E0B", 2e3);
      var timer2 = window.setInterval(function() {
        if (c.isStopped() || c.isOpen() || c.isDragging()) return stop();
        shell2.moveBy(back ? -step : step, 0);
        walked += 2;
        if (!back && walked >= distance) {
          back = true;
          walked = 0;
          if (c.feel) c.feel.face(toLeft ? "right" : "left");
          else c.pig.setAttribute("data-walk", toLeft ? "right" : "left");
        } else if (back && walked >= distance) stop();
      }, 16);
      timers.push(timer2);
      function stop() {
        window.clearInterval(timer2);
        c.pig.removeAttribute("data-idle");
        syncPigArt(c.pig, c.pigArt, c.pigEmoji);
        if (c.feel) c.feel.face(null);
        else c.pig.removeAttribute("data-walk");
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
      idleNow: function(key2) {
        var picked = IDLE_ACTIONS.find(function(action) {
          return action.key === key2;
        });
        doIdle(picked || IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)]);
      },
      dispose: function() {
        snap.dispose();
        actions.dispose();
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
      Object.keys(table).forEach(function(key2) {
        var label = kind === "work" ? jobNames[key2] ?? key2 : kind === "illness" ? jobNames["illness:" + key2] ?? key2 : kind === "interest" ? jobNames["interest:" + key2] ?? ART_SCENE_NAMES[key2] ?? key2 : ART_SCENE_NAMES[key2] ?? key2;
        [].concat(table[key2]).forEach(function(name) {
          add(name, prefix + label);
        });
      });
    });
    add("recruit", "\u76F2\u76D2\u5BFB\u8BBF\u9875");
    UNUSED_FEEDBACK_ART.forEach(function(name) {
      add(name, "\u6682\u4E0D\u4F7F\u7528\uFF08\u5F85\u5B9A\uFF09");
    });
    Object.keys(WITHDRAWN_FEEDBACK_ART).forEach(function(key2) {
      WITHDRAWN_FEEDBACK_ART[key2].forEach(function(name) {
        if (!uses[name]) add(name, "\u5148\u64A4\u56DE\uFF08" + (ART_SCENE_NAMES[key2] ?? key2) + "\uFF09");
      });
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
    function page(key2, label) {
      var body = el("div", "dp-dev-page");
      body.setAttribute("data-dev-page-body", key2);
      pages.push({ key: key2, label, body });
      return function group(title, entries2, note2) {
        var head = el("div", "dp-title");
        head.appendChild(el("b", null, title));
        body.appendChild(head);
        if (note2 !== void 0 && note2 !== "") body.appendChild(el("div", "dp-dev-note", note2));
        var wrap2 = el("div", "dp-dev-list");
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
            wrap2.appendChild(item);
          })(entries2[i]);
        }
        body.appendChild(wrap2);
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
    var status2 = page("status", "\u72B6\u6001");
    status2("\u72B6\u6001", [
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
    status2("\u8D44\u6E90", [
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
    status2("\u751F\u6B7B", [
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
    page("lines", "\u53F0\u8BCD")("\u8BA9\u732A\u8BF4\u4E00\u53E5", Object.keys(LINES).map(function(scene6) {
      return {
        key: "say:" + scene6,
        label: "\u{1F4AC} " + (SCENE_NAMES[scene6] ?? scene6),
        desc: "\u968F\u673A\u8BF4\u300C" + scene6 + "\u300D\u573A\u666F\u91CC\u7684\u4E00\u53E5\uFF08\u514D\u6253\u6270\u65F6\u4E0D\u8BF4\uFF09",
        run: function() {
          patch({ say: scene6 });
        }
      };
    }));
    var time2 = page("time", "\u65F6\u95F4\u9762\u677F");
    time2("\u65F6\u95F4", [
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
    time2("\u9762\u677F", [
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
    time2("\u732A\u81EA\u5DF1\u627E\u4E8B\u505A", [
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
          const [current2, result] = await Promise.all([desktop2.updates.current(), desktop2.updates.list()]);
          if (!result?.ok) throw new Error(result?.reason || "\u6CA1\u95EE\u5230 GitHub");
          const newest2 = newestRelease(result.releases);
          const gameNew = newest2 !== null && compareVersions(newest2.version, current2?.version ?? options.currentVersion()) > 0;
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
    const now2 = store.now ? store.now() : Date.now();
    let saved = null;
    try {
      saved = JSON.parse(store.read(LATEST_CACHE_KEY) || "null");
    } catch {
      saved = null;
    }
    if (saved !== null && typeof saved.at === "number" && now2 - saved.at < LATEST_CACHE_MS) return saved.release ?? null;
    try {
      const release = await fetchLatest();
      store.write(LATEST_CACHE_KEY, JSON.stringify({ at: now2, release }));
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
    if (release.notes) {
      var notes = el("div", "dp-update-notes", release.notes);
      notes.setAttribute("data-scroll-key", "update-notes:" + release.version);
      box.appendChild(notes);
    }
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
    var key2 = group.base;
    var head = group.stable ?? group.previews[0];
    var open = state.pick === key2;
    var box = el("div", "dp-rel");
    box.setAttribute("data-release-group", key2);
    var row = button("dp-rel-head", { "data-release": head.version }, function() {
      state.pick = open ? null : key2;
      ui.renderContent();
    });
    row.appendChild(el("b", null, "v" + key2));
    row.appendChild(el("small", null, group.stable !== null ? group.stable.date : "\u8FD8\u6CA1\u53D1\u6B63\u5F0F\u7248"));
    var tags = el("span", "dp-rel-tags");
    var current2 = group.stable !== null && group.stable.current || group.previews.some(function(r) {
      return r.current;
    });
    if (current2) tags.appendChild(tag("current", "\u5728\u7528"));
    if (group.stable !== null && newestStable !== null && group.stable.version === newestStable.version) tags.appendChild(tag("latest", "\u6700\u65B0"));
    if (group.stable !== null && group.stable.blocked !== null) tags.appendChild(tag("blocked", "\u{1F512}"));
    row.appendChild(tags);
    box.appendChild(row);
    if (open) {
      var body = el("div", "dp-rel-body");
      if (group.stable !== null) body.appendChild(details(ui, group.stable));
      if (group.previews.length > 0) {
        var pre = el("div", "dp-rel-pre");
        var showing = state.previews === key2;
        var toggle = button("dp-mini dp-mini-plain", { "data-previews": key2 }, function() {
          state.previews = showing ? null : key2;
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
    if (release.notes) {
      var notes = el("div", "dp-update-notes", release.notes);
      notes.setAttribute("data-scroll-key", "update-notes:" + release.version);
      box.appendChild(notes);
    }
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
      (function(key2) {
        var info = ui.view.actions[key2];
        var shelf = ui.view.care[key2] ?? [];
        var needsItem = shelf.length > 0;
        var btn = button("dp-btn", { "data-action": key2 }, function() {
          if (BAG_SHELF[key2] !== void 0) {
            ui.select("bag");
            ui.drill.from = "status";
            drillTo(ui, "bag", BAG_SHELF[key2]);
          } else {
            ui.send(key2);
          }
        });
        btn.appendChild(el("span", null, CARE_LABEL[key2][1]));
        btn.appendChild(el("span", null, CARE_LABEL[key2][0]));
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
    row.appendChild(el("b", null, p.weight + (p.bodyWeight !== null ? " \xB7 " + p.bodyWeight.label + (p.bodyWeight.locked ? " \xB7 \u5DF2\u9501\u5B9A" : "") : "")));
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
    } else if (ui.view.pig !== null && ui.view.pig.doctorFee !== null) {
      var dying = el("div", "dp-alert dp-sick");
      dying.appendChild(el("b", null, "\u{1F494} \u751F\u547D\u5782\u5371"));
      ui.content.appendChild(dying);
      var dyingClinic = el("div", "dp-actions");
      var dyingDoctor = button("dp-btn dp-btn-wide", { "data-action": "doctor" }, function() {
        ui.send("doctor");
      });
      dyingDoctor.appendChild(el("span", null, "\u{1F3E5}"));
      dyingDoctor.appendChild(el("span", null, "\u770B\u533B\u751F\uFF08" + ui.view.pig.doctorFee + " \u{1FA99}\uFF09"));
      dyingClinic.appendChild(dyingDoctor);
      ui.content.appendChild(dyingClinic);
    } else if (ui.view.pig !== null && ui.view.activity !== null) {
      var away = el("div", "dp-alert dp-work");
      away.appendChild(el("b", null, ui.view.activity.emoji + " \u5728\u5916\u9762\uFF1A" + ui.view.activity.label));
      away.appendChild(el("div", null, "\u8FD8\u6709 " + ui.view.activity.secondsLeft + " \u79D2"));
      ui.content.appendChild(away);
      var wrap2 = el("div", "dp-actions");
      var call = button("dp-btn dp-btn-wide", { "data-action": "calloff" }, function() {
        ui.send("calloff");
      });
      call.appendChild(el("span", null, "\u21A9\uFE0F"));
      call.appendChild(el("span", null, "\u53EB\u5B83\u56DE\u6765"));
      wrap2.appendChild(call);
      ui.content.appendChild(wrap2);
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
      var active2 = ui.view.activity;
      var left = Math.max(1, Math.ceil(active2.secondsLeft / 60));
      ui.content.appendChild(el("div", "dp-alert", active2.emoji + " \u6B63\u5728\u5B66" + active2.label.replace(/^兴趣·/, "") + " \xB7 \u8FD8\u6709 " + left + " \u5206\u949F"));
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
    var color2 = STAGE_COLOR[stage2.key] ?? FALLBACK_COLORS[Math.max(0, ui.view.stages.indexOf(stage2)) % FALLBACK_COLORS.length];
    var grid = tileGrid();
    for (var i = 0; i < ui.view.subjects.length; i += 1) {
      (function(sub) {
        var where = standing(sub, stage2);
        var note2;
        if (where === "done") note2 = "\u2713 \u6BD5\u4E1A";
        else if (where === "ahead") note2 = "\u{1F512} " + (sub.stageLabel || "\u6CA1\u5230");
        else if (stage2.upTo !== null) note2 = sub.lessons - stage2.from + "/" + (stage2.upTo - stage2.from) + " \u8282";
        else note2 = sub.lessons + " \u8282";
        grid.appendChild(tile({
          emoji: sub.emoji,
          label: sub.label,
          color: color2,
          soft: true,
          note: note2,
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
        var note2 = entry.cost + " \u{1FA99} \xB7 \u7EA6 " + entry.minutes + " \u5206\u949F\u540E " + entry.traitLabel + " +" + entry.gain;
        var badge2 = entry.certificate === "" ? "" : entry.certified ? "\u{1F4DC}" : entry.times + "/" + entry.certificateAfter;
        grid.appendChild(tile({
          emoji: entry.emoji,
          label: entry.label,
          color: INTEREST_COLOR,
          soft: true,
          note: note2,
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
    for (const line6 of [
      "\u6BCF\u5F20\u90FD\u662F\u900F\u660E\u5E95 PNG\uFF0C\u63A8\u8350\u957F\u8FB9 256px\uFF0C\u6700\u591A 1024px",
      "\u732A\u7684\u8EAB\u4F53\u5C45\u4E2D\u3001\u811A\u5E95\u8D34\u7740\u540C\u4E00\u6761\u7EBF\uFF08\u53C2\u7167\u9ED8\u8BA4\u5C0F\u732A\uFF09\uFF0C\u5207\u6362\u52A8\u4F5C\u624D\u4E0D\u4F1A\u8DF3",
      "\u4FDD\u7559\u5B8C\u6574\u9ED1\u8272\u8F6E\u5ED3\u548C\u767D\u8272\u88C5\u626E\uFF0C\u4E0D\u8981\u767D\u5E95\u6216\u8FD0\u884C\u65F6\u62A0\u767D",
      "\u5355\u5F20 \u2264 96 KB\uFF0C\u6574\u4E2A ZIP \u2264 2 MB",
      "ZIP \u6253\u5F00\u76F4\u63A5\u770B\u5230 skin.json \u548C PNG\uFF0C\u4E0D\u8981\u518D\u5305\u4E00\u5C42\u6587\u4EF6\u5939"
    ]) rules.appendChild(el("div", "dp-guide-rule", "\u2022 " + line6));
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
    const note2 = chubbySkinNote(ui.view);
    if (note2 !== "") {
      const hint = el("div", "dp-hint dp-skin-note", note2);
      hint.setAttribute("data-skin-fat-note", "true");
      ui.content.appendChild(hint);
    }
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
    const wrap2 = el("label", "dp-pick dp-tile-card dp-skin-import");
    wrap2.appendChild(el("b", "dp-pick-head", "\u{1F4E6} \u5BFC\u5165\u81EA\u5DF1\u7684\u76AE\u80A4"));
    wrap2.appendChild(el("span", "dp-dim", "\u9009\u62E9\u6309\u6559\u7A0B\u5236\u4F5C\u7684 ZIP\uFF1B\u5BFC\u5165\u6210\u529F\u540E\u4F1A\u81EA\u52A8\u4F7F\u7528\u3002"));
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
    wrap2.appendChild(input);
    wrap2.appendChild(el("span", "dp-mini dp-skin-file", "\u9009\u62E9 ZIP"));
    return wrap2;
  }

  // src/client/log-export.js
  var EXPORT_URL = "/dsh-piggy/logs/export";
  function fileName(now2 = /* @__PURE__ */ new Date()) {
    const pad = (value, width) => String(value).padStart(width, "0");
    return `dsh-piggy-log-${now2.getFullYear()}${pad(now2.getMonth() + 1, 2)}${pad(now2.getDate(), 2)}-${pad(now2.getHours(), 2)}${pad(now2.getMinutes(), 2)}.txt`;
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

  // src/client/sounds.js
  var VOLUME_GAIN = Object.freeze([0.32, 0.55, 0.82]);
  var RECIPES = Object.freeze({
    tap: { tones: [{ type: "sine", from: 660, to: 520, ms: 70, gain: 0.35 }] },
    lift: { tones: [{ type: "triangle", from: 340, to: 760, ms: 110, gain: 0.4 }] },
    toss: { tones: [{ type: "sine", from: 240, to: 120, ms: 120, gain: 0.2 }], noise: { from: 900, to: 260, ms: 220, gain: 0.28 } },
    bounce: { tones: [{ type: "sine", from: 190, to: 105, ms: 110, gain: 0.5 }] },
    "land-soft": { tones: [{ type: "sine", from: 130, to: 82, ms: 130, gain: 0.5 }] },
    "land-hard": { tones: [{ type: "sine", from: 105, to: 55, ms: 170, gain: 0.65 }, { type: "triangle", from: 300, to: 180, ms: 120, gain: 0.18 }], noise: { from: 420, to: 120, ms: 120, gain: 0.22 } },
    dizzy: { tones: [{ type: "sine", from: 720, to: 560, ms: 150, gain: 0.32 }, { type: "sine", from: 640, to: 480, ms: 180, gain: 0.3, delay: 130 }] },
    purr: { tones: [{ type: "sawtooth", from: 72, to: 62, ms: 280, gain: 0.28 }] },
    flip: { tones: [], noise: { from: 2400, to: 700, ms: 90, gain: 0.22, type: "highpass" } },
    catch: { tones: [{ type: "square", from: 460, to: 380, ms: 70, gain: 0.28 }] }
  });
  var SOUND_KEYS = Object.freeze(Object.keys(RECIPES));

  // src/client/sound.js
  var context = null;
  var master = null;
  var compressor = null;
  var lastAt = /* @__PURE__ */ Object.create(null);
  var voices = 0;
  var quietCheck = function() {
    return false;
  };
  function allowedRole() {
    var role2 = desktopRole();
    return role2 === null || role2 === "pet";
  }
  function configureSound(options) {
    if (typeof options?.isQuiet === "function") quietCheck = options.isQuiet;
  }
  function unlockSound() {
    if (!soundSettings().on) return null;
    return ensureContext();
  }
  function ensureContext() {
    if (context !== null) {
      if (context.state === "suspended") context.resume?.().catch?.(function() {
      });
      return context;
    }
    try {
      var audioWindow = typeof window !== "undefined" ? (
        /** @type {any} */
        window
      ) : null;
      var Ctor = audioWindow === null ? null : audioWindow.AudioContext || audioWindow.webkitAudioContext;
      if (typeof Ctor !== "function") return null;
      context = new Ctor();
      compressor = context.createDynamicsCompressor?.() ?? null;
      master = context.createGain();
      master.gain.value = 1;
      if (compressor !== null) {
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 6;
        compressor.attack.value = 3e-3;
        compressor.release.value = 0.2;
        master.connect(compressor);
        compressor.connect(context.destination);
      } else {
        master.connect(context.destination);
      }
      if (context.state === "suspended") context.resume?.().catch?.(function() {
      });
      return context;
    } catch {
      context = null;
      master = null;
      compressor = null;
      return null;
    }
  }
  function noiseBuffer(ctx, seconds) {
    var length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var seed = 2654435769;
    for (var i = 0; i < length; i += 1) {
      seed = seed * 1664525 + 1013904223 >>> 0;
      data[i] = seed / 4294967295 * 2 - 1;
    }
    return buffer;
  }
  function tone(ctx, destination, spec, start2, volume) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var duration = spec.ms / 1e3;
    osc.type = spec.type;
    osc.frequency.setValueAtTime(Math.max(20, spec.from), start2);
    if (spec.to !== spec.from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start2 + duration);
    var peak = Math.max(1e-4, spec.gain * volume);
    gain.gain.setValueAtTime(1e-4, start2);
    gain.gain.exponentialRampToValueAtTime(peak, start2 + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(1e-4, start2 + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start2);
    osc.stop(start2 + duration + 0.02);
    voices += 1;
    osc.onended = function() {
      voices = Math.max(0, voices - 1);
    };
  }
  function noise(ctx, destination, spec, start2, volume) {
    var source = ctx.createBufferSource();
    var filter2 = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    var duration = spec.ms / 1e3;
    source.buffer = noiseBuffer(ctx, duration);
    filter2.type = spec.type ?? "lowpass";
    filter2.frequency.setValueAtTime(Math.max(40, spec.from), start2);
    if (spec.to !== spec.from) filter2.frequency.exponentialRampToValueAtTime(Math.max(40, spec.to), start2 + duration);
    gain.gain.setValueAtTime(1e-4, start2);
    gain.gain.exponentialRampToValueAtTime(Math.max(1e-4, spec.gain * volume), start2 + 0.012);
    gain.gain.exponentialRampToValueAtTime(1e-4, start2 + duration);
    source.connect(filter2);
    filter2.connect(gain);
    gain.connect(destination);
    source.start(start2);
    source.stop(start2 + duration + 0.01);
    voices += 1;
    source.onended = function() {
      voices = Math.max(0, voices - 1);
    };
  }
  function playSound(key2, options) {
    var recipe = RECIPES[key2];
    if (recipe === void 0) return false;
    var settings = soundSettings();
    if (!settings.on) return false;
    if (!allowedRole() || quietCheck() === true) return false;
    var now2 = Date.now();
    if (now2 - (lastAt[key2] ?? 0) < 60) return false;
    if (voices >= 3) return false;
    var ctx = ensureContext();
    if (ctx === null || master === null) return false;
    lastAt[key2] = now2;
    var level = VOLUME_GAIN[settings.volume] ?? VOLUME_GAIN[2];
    var volume = level * (options?.soft === true ? 0.65 : 1);
    var start2 = ctx.currentTime + 5e-3;
    for (var i = 0; i < recipe.tones.length; i += 1) {
      tone(ctx, master, recipe.tones[i], start2 + (recipe.tones[i].delay ?? 0) / 1e3, volume);
    }
    if (recipe.noise !== void 0) noise(ctx, master, recipe.noise, start2, volume);
    return true;
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
    for (const [key2, label] of [["system", "\u8DDF\u968F\u7CFB\u7EDF\u4EE3\u7406"], ["direct", "\u76F4\u8FDE\uFF08\u4E0D\u4F7F\u7528\u4EE3\u7406\uFF09"], ["http", "HTTP \u4EE3\u7406"], ["socks5", "SOCKS5 \u4EE3\u7406"]]) {
      const option = (
        /** @type {HTMLOptionElement} */
        el("option", null, label)
      );
      option.value = key2;
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
    const status2 = el("div", failure ? "dp-proxy-status dp-proxy-error" : "dp-proxy-status", message);
    status2.hidden = !message;
    status2.setAttribute("role", "status");
    const actions = [];
    async function run(action) {
      if (busy2) return;
      busy2 = true;
      for (const control of actions) control.disabled = true;
      mode.disabled = true;
      endpoint.disabled = true;
      status2.hidden = false;
      status2.textContent = "\u5904\u7406\u4E2D\u2026";
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
    for (const [key2, label, action] of [
      ["save", "\u5E94\u7528", () => api.set({ mode: mode.value, address: endpoint.value })],
      ["test", "\u6D4B\u8BD5\u8FDE\u63A5", () => api.test()],
      ["clear", "\u6062\u590D\u7CFB\u7EDF", () => api.clear()]
    ]) {
      const control = button("dp-mini dp-proxy-" + key2, { "data-proxy-action": key2 }, () => run(action));
      control.textContent = label;
      control.disabled = busy2;
      actions.push(control);
      controls.appendChild(control);
    }
    setting.box.appendChild(controls);
    setting.box.appendChild(status2);
  }

  // src/client/tabs/fullscreen.js
  var current = null;
  var loading2 = false;
  var busy3 = false;
  var OPTIONS = [{ key: "hide", label: "\u9690\u85CF\u5C0F\u732A" }, { key: "show", label: "\u7167\u5E38\u663E\u793A" }];
  function note(value) {
    if (value === null) return "\u6B63\u5728\u8BFB\u53D6\u2026";
    if (!value.supported) return "\u8FD9\u53F0\u7535\u8111\u68C0\u6D4B\u4E0D\u4E86\u5168\u5C4F\uFF08" + (value.reason || "\u539F\u56E0\u672A\u77E5") + "\uFF09\uFF0C\u5C0F\u732A\u4F1A\u4E00\u76F4\u663E\u793A";
    if (value.mode === "show") return value.platform === "darwin" ? "\u5168\u5C4F\u7A0B\u5E8F\u7684\u684C\u9762\u91CC\u4E5F\u663E\u793A\u5C0F\u732A" : "\u5C0F\u732A\u538B\u5728\u5168\u5C4F\u753B\u9762\u4E0A\u9762\uFF1B\u72EC\u5360\u5168\u5C4F\u7684\u6E38\u620F\u7CFB\u7EDF\u4E0D\u8BA9\u4EFB\u4F55\u7A97\u53E3\u76D6\u4E0A\u53BB";
    return "\u5C0F\u732A\u6240\u5728\u7684\u5C4F\u5E55\u4E0A\u6709\u7A0B\u5E8F\u5168\u5C4F\u65F6\u5148\u85CF\u8D77\u6765\uFF0C\u9000\u51FA\u5168\u5C4F\u518D\u56DE\u6765";
  }
  function renderFullscreenSettings(ui, section2, api) {
    const setting = section2(ui, "\u5168\u5C4F\u65F6\uFF08\u73A9\u6E38\u620F\u3001\u770B\u89C6\u9891\uFF09", note(current));
    if (current === null) {
      if (!loading2) {
        loading2 = true;
        api.get().then((value) => {
          if (value?.mode) current = value;
        }).catch(() => {
        }).finally(() => {
          loading2 = false;
          if (ui.tab === "settings") ui.renderContent();
        });
      }
      return;
    }
    const row = el("div", "dp-seg");
    for (const option of OPTIONS) {
      const pick = button("dp-seg-btn", { "data-fullscreen-mode": option.key, "aria-pressed": String(option.key === current.mode) }, function() {
        if (busy3) return;
        busy3 = true;
        api.set(option.key).then((value) => {
          if (value?.ok) current = value;
        }).catch(() => {
        }).finally(() => {
          busy3 = false;
          if (ui.tab === "settings") ui.renderContent();
        });
      });
      pick.textContent = option.label;
      pick.disabled = busy3 || option.key === current.mode;
      row.appendChild(pick);
    }
    setting.box.appendChild(row);
  }

  // src/client/save-transfer.js
  var EXPORT_URL2 = "/dsh-piggy/save/export";
  var PREVIEW_URL = "/dsh-piggy/save/preview";
  var IMPORT_URL = "/dsh-piggy/save/import";
  var state2 = {
    open: false,
    preview: null,
    loading: false,
    busy: false,
    error: "",
    focus: "cancel",
    ui: null,
    trigger: null,
    controller: null,
    keyHandler: null
  };
  var cancelError = (error) => error?.name === "AbortError" || error?.name === "NotAllowedError";
  var messageOf = (error) => error instanceof Error ? error.message : String(error);
  function defaultName() {
    const d = /* @__PURE__ */ new Date(), p = (n) => String(n).padStart(2, "0");
    return `piggy-save-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`;
  }
  function responseName(response) {
    const value = response.headers?.get?.("content-disposition") || "";
    const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (encoded) {
      try {
        return decodeURIComponent(encoded);
      } catch {
      }
    }
    return value.match(/filename="?([^";]+)"?/i)?.[1] || defaultName();
  }
  async function saveBytes(name, bytes) {
    const shell2 = desktopShell();
    if (typeof shell2?.saves?.save === "function") {
      const result = await shell2.saves.save(name, new Uint8Array(bytes));
      if (result?.ok) return { ok: true };
      if (result?.canceled) return { canceled: true };
      throw new Error(String(result?.reason || "\u684C\u9762\u5916\u58F3\u6CA1\u80FD\u4FDD\u5B58\u5B58\u6863"));
    }
    const picker = typeof window === "object" ? (
      /** @type {any} */
      window.showSaveFilePicker
    ) : null;
    if (typeof picker === "function") {
      let handle = null;
      try {
        handle = await picker({ suggestedName: name, types: [{ description: "\u5C0F\u732A\u5B58\u6863", accept: { "application/zip": [".zip"] } }] });
      } catch (error) {
        if (error?.name === "AbortError") return { canceled: true };
      }
      if (handle !== null && handle !== void 0) {
        try {
          const writable = await handle.createWritable();
          await writable.write(bytes);
          await writable.close();
          return { ok: true };
        } catch (error) {
          if (error?.name === "AbortError") return { canceled: true };
          throw error;
        }
      }
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1e4);
    return { ok: true, downloaded: true };
  }
  function status(ui, text, ms = 3500) {
    if (typeof ui.showBubble === "function") ui.showBubble(text, ms);
  }
  function rerender2() {
    if (typeof state2.ui?.renderContent === "function") state2.ui.renderContent();
  }
  async function exportSave(ui) {
    if (state2.busy) return;
    state2.busy = true;
    rerender2();
    try {
      const response = await fetch(EXPORT_URL2, { cache: "no-store" });
      if (!response.ok) throw new Error(`\u5BBF\u4E3B\u8FD4\u56DE HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const result = await saveBytes(responseName(response), bytes);
      if (result.canceled) return;
      status(ui, result.downloaded ? "\u5B58\u6863\u5DF2\u4E0B\u8F7D" : "\u5B58\u6863\u5DF2\u5BFC\u51FA");
    } catch (error) {
      status(ui, "\u5B58\u6863\u6CA1\u5BFC\u51FA\uFF1A" + messageOf(error), 5e3);
    } finally {
      state2.busy = false;
      rerender2();
    }
  }
  function focusTrigger() {
    const ui = state2.ui;
    const trigger = ui?.content?.querySelector?.('[data-save-trigger="import"]');
    if (trigger?.focus) trigger.focus();
  }
  function closeDialog() {
    state2.controller?.abort();
    state2.controller = null;
    state2.open = false;
    state2.preview = null;
    state2.error = "";
    state2.loading = false;
    state2.busy = false;
    if (state2.keyHandler && typeof document === "object") document.removeEventListener("keydown", state2.keyHandler, true);
    state2.keyHandler = null;
    rerender2();
    focusTrigger();
  }
  function trapKeys() {
    if (state2.keyHandler || typeof document !== "object") return;
    state2.keyHandler = (event) => {
      if (!state2.open) return;
      if (event.key === "Escape") {
        if (state2.busy) return;
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = state2.ui?.content?.querySelector?.('[data-save-dialog="true"]');
      const items = Array.from(dialog?.querySelectorAll?.("button:not([disabled]),input:not([disabled])") || []);
      if (!items.length) {
        event.preventDefault();
        dialog?.focus?.();
        return;
      }
      const first = items[0], last = items[items.length - 1], active2 = document.activeElement;
      if (event.shiftKey && (active2 === first || !dialog.contains(active2))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active2 === last || !dialog.contains(active2))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", state2.keyHandler, true);
  }
  async function previewFile(file) {
    if (!file) return;
    state2.preview = null;
    state2.error = "";
    state2.loading = true;
    state2.controller?.abort();
    const controller = new AbortController();
    state2.controller = controller;
    rerender2();
    try {
      const response = await fetch(PREVIEW_URL, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: await file.arrayBuffer(), signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (state2.controller !== controller) return;
      if (!response.ok || result?.ok !== true || !result.token || !result.summary) throw new Error(result?.error || result?.reason || `\u5BBF\u4E3B\u8FD4\u56DE HTTP ${response.status}`);
      state2.preview = result;
    } catch (error) {
      if (state2.controller === controller && !cancelError(error)) state2.error = "\u6CA1\u80FD\u8BFB\u53D6\u8FD9\u4E2A\u5B58\u6863\uFF1A" + messageOf(error);
    } finally {
      if (state2.controller === controller) {
        state2.loading = false;
        state2.controller = null;
        rerender2();
      }
    }
  }
  async function commitImport(ui) {
    if (state2.busy || !state2.preview?.token) return;
    state2.busy = true;
    state2.error = "";
    rerender2();
    try {
      const response = await fetch(IMPORT_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: state2.preview.token }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || result?.reason || `\u5BBF\u4E3B\u8FD4\u56DE HTTP ${response.status}`);
      state2.open = false;
      if (state2.keyHandler) document.removeEventListener("keydown", state2.keyHandler, true);
      state2.keyHandler = null;
      status(ui, "\u5B58\u6863\u5DF2\u5BFC\u5165");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      state2.error = "\u5BFC\u5165\u5931\u8D25\uFF1A" + messageOf(error);
      state2.busy = false;
      rerender2();
    }
  }
  function renderSaveTransferSettings(ui, section2) {
    state2.ui = ui;
    const transfer = section2(ui, "\u5B58\u6863", "\u5907\u4EFD\u8FDB\u5EA6\uFF0C\u6216\u628A\u5C0F\u732A\u5E26\u5230\u53E6\u4E00\u53F0\u8BBE\u5907");
    transfer.box.setAttribute("data-save-transfer-active", String(state2.open || state2.busy || state2.loading));
    const actions = el("div", "dp-actions");
    const exportButton = button("dp-mini", { "data-save-trigger": "export" }, () => exportSave(ui));
    exportButton.textContent = state2.busy && !state2.open ? "\u5BFC\u51FA\u4E2D\u2026" : "\u5BFC\u51FA\u5B58\u6863";
    exportButton.disabled = state2.busy || !ui.view?.pig;
    if (!ui.view?.pig) exportButton.title = "\u63A5\u5230\u5C0F\u732A\u540E\u5373\u53EF\u5907\u4EFD";
    const importButton = button("dp-mini", { "data-save-trigger": "import" }, () => {
      if (state2.busy) return;
      state2.open = true;
      state2.preview = null;
      state2.error = "";
      state2.trigger = "import";
      rerender2();
      trapKeys();
      const input = ui.content.querySelector('[data-save-file="true"]');
      input?.click();
    });
    importButton.textContent = "\u5BFC\u5165\u5B58\u6863";
    importButton.disabled = state2.busy || state2.loading;
    actions.appendChild(exportButton);
    actions.appendChild(importButton);
    transfer.box.appendChild(actions);
    if (!state2.open) return;
    const overlay = el("div", "dp-save-overlay");
    overlay.style.cssText = "position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(70,48,25,.38);padding:12px;box-sizing:border-box";
    const dialog = el("div", "dp-set");
    dialog.style.cssText = "width:min(268px,100%);max-height:90vh;overflow:auto;background:var(--ac-bg-content);border:2px solid var(--ac-border);border-radius:var(--ac-radius-card);padding:12px;box-shadow:var(--ac-shadow-lg)";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "\u5BFC\u5165\u5B58\u6863");
    dialog.setAttribute("data-save-dialog", "true");
    dialog.tabIndex = -1;
    overlay.appendChild(dialog);
    dialog.appendChild(el("b", null, "\u5BFC\u5165\u5B58\u6863"));
    if (state2.loading) dialog.appendChild(el("p", "dp-dim", "\u6B63\u5728\u68C0\u67E5\u5B58\u6863\u2026"));
    else if (state2.preview) {
      const summary = state2.preview.summary;
      rowTo(dialog, "\u5C0F\u732A", `${summary.name || "\u672A\u547D\u540D"} \xB7 Lv.${summary.level ?? "\u2014"}`);
      rowTo(dialog, "\u5907\u4EFD\u65F6\u95F4", displayDate(summary.createdAt));
      rowTo(dialog, "\u6E38\u620F\u7248\u672C", summary.gameVersion || "\u672A\u77E5");
      rowTo(dialog, "\u5185\u5BB9", `\u517B\u6210\u8FDB\u5EA6\u3001${summary.extensions || 0} \u4E2A\u6269\u5C55\u3001${summary.skins || 0} \u4E2A\u81EA\u5B9A\u4E49\u76AE\u80A4`);
      if (summary.legacy) dialog.appendChild(alert("\u8FD9\u662F\u65E7\u7248 JSON \u5B58\u6863\uFF0C\u90E8\u5206\u8D44\u6E90\u53EF\u80FD\u672A\u5305\u542B\u3002"));
      for (const warning2 of state2.preview.warnings || []) dialog.appendChild(alert(warning2));
      dialog.appendChild(el("p", "dp-dim", "\u5C06\u66FF\u6362\u5F53\u524D\u8FD9\u53EA\u732A\u3002\u5F53\u524D\u5B58\u6863\u4F1A\u5148\u81EA\u52A8\u5907\u4EFD\uFF0C\u5BFC\u5165\u540E\u4E24\u8FB9\u4E0D\u4F1A\u81EA\u52A8\u540C\u6B65\u3002"));
    } else {
      dialog.appendChild(el("p", "dp-dim", "\u9009\u62E9 ZIP \u5907\u4EFD\u6216\u5DF2\u6709\u7684 state.json\u3002\u9009\u53D6\u540E\u53EA\u68C0\u67E5\u548C\u9884\u89C8\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u5F53\u524D\u5B58\u6863\u3002"));
      const picker = el("input", "dp-input");
      picker.type = "file";
      picker.accept = ".zip,.json,application/zip,application/json";
      picker.setAttribute("data-save-file", "true");
      picker.setAttribute("aria-label", "\u9009\u62E9\u5B58\u6863\u6587\u4EF6");
      picker.addEventListener("change", () => {
        const file = picker.files?.[0];
        if (file) previewFile(file);
      });
      picker.addEventListener("cancel", closeDialog);
      dialog.appendChild(picker);
    }
    if (state2.error) dialog.appendChild(alert(state2.error, "dp-alert dp-dead"));
    const buttons = el("div", "dp-actions");
    const cancel = button("dp-btn", { "data-save-focus": "cancel", "data-save-cancel": "true" }, closeDialog);
    cancel.textContent = "\u53D6\u6D88";
    cancel.disabled = state2.busy;
    buttons.appendChild(cancel);
    if (state2.preview) {
      const confirm = button("dp-mini", { "data-save-focus": "confirm", "data-save-confirm": "true" }, () => commitImport(ui));
      confirm.textContent = state2.busy ? "\u5BFC\u5165\u4E2D\u2026" : "\u5907\u4EFD\u5E76\u5BFC\u5165";
      confirm.disabled = state2.busy;
      buttons.appendChild(confirm);
    }
    dialog.appendChild(buttons);
    ui.content.appendChild(overlay);
    const desired = dialog.querySelector(`[data-save-focus="${state2.focus}"]`) || dialog.querySelector("input") || cancel;
    if (document.activeElement === document.body || !dialog.contains(document.activeElement)) desired.focus();
    dialog.addEventListener("focusin", (event) => {
      const key2 = event.target?.getAttribute?.("data-save-focus");
      if (key2) state2.focus = key2;
    });
  }
  function rowTo(parent, label, value) {
    const line6 = el("div", "dp-set-head");
    line6.appendChild(el("b", null, label));
    line6.appendChild(el("small", "dp-dim", String(value)));
    parent.appendChild(line6);
  }
  function displayDate(value) {
    if (value === null || value === void 0 || value === "") return "\u672A\u8BB0\u5F55";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
  }
  function alert(text, className = "dp-alert dp-legacy") {
    return el("div", className, String(text));
  }

  // src/client/tabs/settings.js
  function section(ui, title, note2) {
    const box = el("div", "dp-set");
    const head = el("div", "dp-set-head");
    head.appendChild(el("b", null, title));
    if (note2) head.appendChild(el("small", "dp-dim", note2));
    box.appendChild(head);
    ui.content.appendChild(box);
    return { box, head };
  }
  function segmented({ box }, attr, options, current2, onPick) {
    const row = el("div", "dp-seg");
    for (const option of options) {
      const pick = button("dp-seg-btn", { [attr]: option.key, "aria-pressed": String(option.key === current2) }, function() {
        onPick(option.key);
      });
      pick.textContent = option.label;
      pick.disabled = option.key === current2;
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
    renderSaveTransferSettings(ui, section);
    const size = section(ui, "\u5C0F\u732A\u5927\u5C0F", "\u666E\u901A\u732A\u3001\u76AE\u80A4\u548C\u7761\u59FF\u4E00\u8D77\u8C03\u6574\uFF1B\u53EA\u6539\u8FD9\u53F0\u8BBE\u5907\uFF0C\u4E0D\u6539\u5B58\u6863");
    const sizeRow = el("div", "dp-size-control");
    const percent2 = (
      /** @type {HTMLInputElement} */
      el("input", "dp-size-value")
    );
    percent2.type = "number";
    percent2.value = String(Math.round(pigSize() * 100));
    percent2.setAttribute("aria-label", "\u5C0F\u732A\u5927\u5C0F\u767E\u5206\u6BD4");
    percent2.setAttribute("data-pig-scale", "true");
    function applySize(value) {
      if (!Number.isFinite(value) || value <= 0) {
        percent2.value = String(Math.round(pigSize() * 100));
        return;
      }
      const stageSize = ui.view.hatched ? ui.view.pig.stage.size : ui.view.boxStage.size;
      const geometry2 = desktopShell()?.geometry?.();
      const area = geometry2?.workArea;
      const available = Math.min(area?.width || window.screen?.availWidth || window.innerWidth, area?.height || window.screen?.availHeight || window.innerHeight);
      const scale2 = Math.min(value / 100, available / (stageSize * 2));
      setPigSize(scale2);
      percent2.value = String(Math.round(scale2 * 100));
      ui.host.style.setProperty("--pig-size", displayedPigSize(stageSize) + "px");
      ui.fitPanel();
      desktopShell()?.syncGeometry?.();
    }
    for (const { key: key2, label, delta } of [{ key: "minus", label: "\u2212", delta: -10 }, { key: "plus", label: "+", delta: 10 }]) {
      const control = button("dp-size-step", { "data-pig-size-step": key2, "aria-label": delta < 0 ? "\u7F29\u5C0F\u5C0F\u732A" : "\u653E\u5927\u5C0F\u732A" }, () => applySize(Math.max(10, Math.round(pigSize() * 100) + delta)));
      control.textContent = label;
      if (delta < 0) sizeRow.appendChild(control);
      else {
        const value = el("label", "dp-size-percent");
        value.appendChild(percent2);
        value.appendChild(el("span", null, "%"));
        sizeRow.appendChild(value);
        sizeRow.appendChild(control);
      }
    }
    percent2.addEventListener("change", () => applySize(Number(percent2.value)));
    percent2.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        applySize(Number(percent2.value));
        percent2.blur();
      }
    });
    size.box.appendChild(sizeRow);
    const feel2 = section(ui, "\u624B\u611F", "\u62D6\u52A8\u3001\u843D\u5730\u548C\u6478\u732A\u65F6\u7684\u6324\u538B\u56DE\u5F39\uFF1B\u53EA\u6539\u8FD9\u53F0\u8BBE\u5907");
    segmented(feel2, "data-feel-mode", [
      { key: "full", label: "\u6807\u51C6" },
      { key: "soft", label: "\u8F7B\u67D4" },
      { key: "off", label: "\u5173\u95ED" }
    ], feelMode(), function(key2) {
      setFeelMode(key2);
      ui.renderContent();
    });
    const handOn = petHandEnabled();
    const hand = section(ui, "\u6478\u6478\u5C0F\u624B", "\u663E\u793A\u629A\u6478\u7684\u5C0F\u624B\uFF1B\u5173\u95ED\u540E\u5C0F\u732A\u4ECD\u4F1A\u8F7B\u8F7B\u4E0B\u6C89\u3001\u56DE\u4F4D");
    const handToggle = button("dp-switch", { "data-pet-hand": handOn ? "on" : "off", "aria-pressed": String(handOn), "aria-label": "\u6478\u6478\u5C0F\u624B" }, function() {
      setPetHandEnabled(!petHandEnabled());
      ui.renderContent();
    });
    handToggle.appendChild(el("span", "dp-switch-knob"));
    handToggle.appendChild(el("span", "dp-switch-text", handOn ? "\u5F00" : "\u5173"));
    hand.head.appendChild(handToggle);
    const soundPrefs = soundSettings();
    const sound = section(ui, "\u97F3\u6548", "\u62CE\u8D77\u3001\u843D\u5730\u3001\u6478\u6478\u7684\u58F0\u97F3\uFF1B\u514D\u6253\u6270\u65F6\u4E0D\u54CD");
    const soundToggle = button("dp-switch", { "data-sound": soundPrefs.on ? "on" : "off", "aria-pressed": String(soundPrefs.on) }, function() {
      const next = setSoundSettings({ on: !soundPrefs.on });
      if (next.on) unlockSound();
      ui.renderContent();
    });
    soundToggle.appendChild(el("span", "dp-switch-knob"));
    soundToggle.appendChild(el("span", "dp-switch-text", soundPrefs.on ? "\u5F00" : "\u5173"));
    sound.head.appendChild(soundToggle);
    segmented(sound, "data-sound-volume", [
      { key: "0", label: "\u8F7B" },
      { key: "1", label: "\u4E2D" },
      { key: "2", label: "\u54CD" }
    ], String(soundPrefs.volume), function(key2) {
      setSoundSettings({ volume: Number(key2) });
      ui.renderContent();
    });
    if (hasBundledEmoji()) {
      const emoji = section(ui, "Emoji \u6837\u5F0F", "\u5185\u7F6E\u662F\u968F\u6E38\u620F\u9644\u5E26\u7684\u4E00\u6574\u5957 Noto \u5F69\u8272 emoji\uFF0C\u5404\u7CFB\u7EDF\u770B\u8D77\u6765\u4E00\u6837");
      segmented(emoji, "data-emoji-style", [
        { key: "bundled", label: "\u5185\u7F6E" },
        { key: "system", label: "\u7CFB\u7EDF\u81EA\u5E26" }
      ], emojiStyle(), function(key2) {
        setEmojiStyle(key2);
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
    const feeding = section(ui, "\u79BB\u7EBF\u81EA\u52A8\u7167\u987E", "");
    const feedingOn = ui.view.dialogue.isOfflineFeedEnabled !== false;
    const feedingToggle = button("dp-switch", { "data-offline-feed": String(feedingOn), "aria-pressed": String(feedingOn) }, function() {
      ui.send("offlineFeed", { on: !feedingOn });
    });
    feedingToggle.appendChild(el("span", "dp-switch-knob"));
    feedingToggle.appendChild(el("span", "dp-switch-text", feedingOn ? "\u5F00" : "\u5173"));
    feeding.head.appendChild(feedingToggle);
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
    const fullscreen = desktopShell()?.fullscreen;
    if (fullscreen) renderFullscreenSettings(ui, section, fullscreen);
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
  function renderJobs(ui, jobs, color2) {
    var grid = tileGrid();
    var picked = null;
    for (var i = 0; i < jobs.length; i += 1) {
      (function(job2) {
        var active2 = ui.drill.pick === job2.key;
        if (active2) picked = job2;
        var locked = job2.qualified === false;
        grid.appendChild(tile({
          emoji: job2.emoji,
          label: job2.label,
          color: color2,
          soft: true,
          active: active2,
          note: job2.minutes + "\u5206\xB7" + job2.coins + "\u{1FA99}",
          tag: locked ? "\u{1F512}" : "",
          dim: locked,
          data: { "data-job-tile": job2.key },
          onPick: function() {
            ui.drill.pick = active2 ? null : job2.key;
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

  // src/client/pointer-repaint.js
  function attachPointerRepaint(root, events) {
    let held = false, readyAt = 0, timer2 = null;
    let pending2 = null;
    function mergeSnapshots(previous, next) {
      const merged2 = { ...next };
      if (Array.isArray(previous?.pending) || Array.isArray(next?.pending)) {
        merged2.pending = [
          ...Array.isArray(previous?.pending) ? previous.pending : [],
          ...Array.isArray(next?.pending) ? next.pending : []
        ];
      }
      return merged2;
    }
    function schedule4() {
      if (timer2 !== null) clearTimeout(timer2);
      timer2 = null;
      if (held || pending2 === null) return;
      timer2 = setTimeout(() => {
        timer2 = null;
        const task = pending2;
        pending2 = null;
        if (task !== null) task.run(task.hasSnapshot ? task.snapshot : void 0);
      }, Math.max(0, readyAt - Date.now()));
    }
    function down() {
      held = true;
      schedule4();
    }
    function up() {
      if (!held) return;
      held = false;
      readyAt = Date.now() + 150;
      schedule4();
    }
    function blur() {
      held = false;
      readyAt = 0;
      schedule4();
    }
    root.addEventListener("pointerdown", down, true);
    events.addEventListener("pointerup", up, true);
    events.addEventListener("pointercancel", blur, true);
    events.addEventListener("blur", blur);
    return {
      /**
       * Keep the old callback-only, latest-wins form for other callers. When a
       * snapshot is supplied, keep its newest state while accumulating pending
       * events until the protected pointer interaction has finished.
       * @param {(snapshot?: any) => void} run
       * @param {any} [snapshot]
       */
      defer(run, snapshot) {
        const hasSnapshot = arguments.length > 1;
        if (!held && Date.now() >= readyAt && pending2 === null) return false;
        if (hasSnapshot) {
          const accumulated = pending2?.hasSnapshot ? mergeSnapshots(pending2.snapshot, snapshot) : snapshot;
          pending2 = { run, snapshot: accumulated, hasSnapshot: true };
        } else pending2 = { run, snapshot: void 0, hasSnapshot: false };
        schedule4();
        return true;
      },
      dispose() {
        if (timer2 !== null) clearTimeout(timer2);
        pending2 = null;
        root.removeEventListener("pointerdown", down, true);
        events.removeEventListener("pointerup", up, true);
        events.removeEventListener("pointercancel", blur, true);
        events.removeEventListener("blur", blur);
      }
    };
  }

  // src/client/hover-restore.js
  var restorers = /* @__PURE__ */ new WeakMap();
  function restoreHover(content) {
    var restore = restorers.get(content);
    if (restore === void 0) {
      restore = attach(content);
      restorers.set(content, restore);
    }
    return restore();
  }
  function attach(content) {
    var doc = content.ownerDocument ?? globalThis.document ?? null;
    var win = doc === null ? globalThis.window ?? null : doc.defaultView ?? globalThis.window ?? null;
    var x = null;
    var y = null;
    var seq2 = 0;
    var restoring = false;
    var pending2 = false;
    function remember(event) {
      if (restoring) return;
      x = event.clientX;
      y = event.clientY;
      if (event.movementX !== 0 || event.movementY !== 0) seq2 += 1;
    }
    function forget() {
      x = null;
      y = null;
    }
    function targetUnderPointer() {
      if (x === null || typeof doc?.elementFromPoint !== "function") return null;
      var node = doc.elementFromPoint(x, y);
      if (node === null || node === void 0) return null;
      for (var walk = node; walk !== null && walk !== void 0; walk = walk.parentNode) {
        if (walk === content) return node;
      }
      return null;
    }
    function dispatch(target) {
      var MouseClass = win === null ? null : win.MouseEvent;
      if (typeof MouseClass !== "function") return;
      restoring = true;
      try {
        target.dispatchEvent(new MouseClass("mousemove", {
          bubbles: true,
          clientX: x,
          clientY: y,
          movementX: 1,
          movementY: 1
        }));
      } finally {
        restoring = false;
      }
    }
    function flush2(seen) {
      pending2 = false;
      if (restoring || seq2 !== seen) return;
      var target = targetUnderPointer();
      if (target === null) return;
      dispatch(target);
    }
    function schedule4(seen) {
      if (win !== null && typeof win.requestAnimationFrame === "function") {
        win.requestAnimationFrame(function() {
          flush2(seen);
        });
        return;
      }
      if (win !== null && typeof win.setTimeout === "function") {
        win.setTimeout(function() {
          flush2(seen);
        }, 0);
        return;
      }
      flush2(seen);
    }
    content.addEventListener("mousemove", remember);
    content.addEventListener("mouseleave", forget);
    return function restore() {
      if (restoring || pending2 || x === null) return false;
      pending2 = true;
      schedule4(seq2);
      return true;
    };
  }

  // src/client/farm-trigger-focus.js
  function preserveFarmTriggerFocus(content, paint) {
    const doc = content.ownerDocument || (typeof document === "undefined" ? null : document);
    if (!doc) return paint();
    const active2 = doc.activeElement;
    if (!content.contains(active2)) return paint();
    const key2 = ["data-farm-item", "data-farm-plot"].map((attr) => ({ attr, value: active2.getAttribute?.(attr) })).find((entry) => entry.value !== null && entry.value !== void 0);
    const result = paint();
    if (!key2) return result;
    const next = doc.activeElement;
    if (content.contains(next) || next !== null && next !== void 0 && next !== doc.body && next !== active2) return result;
    if (next === active2 && content.contains(active2)) return result;
    const target = Array.from(content.querySelectorAll("[data-farm-item], [data-farm-plot]")).find((node) => node.tagName?.toLowerCase() === "button" && !node.disabled && node.getAttribute(key2.attr) === key2.value);
    if (target) target.focus({ preventScroll: true });
    return result;
  }

  // src/client/panel.js
  function createPanel(ctx) {
    var pointerRepaint = attachPointerRepaint(ctx.host, window);
    const renderHold = createRenderHold(ctx.card);
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
    var POMODORO_NOTIFIED_KEY = "dsh-piggy:pomodoro-notified";
    var pomodoroNotifiedAt = Number(readStore(POMODORO_NOTIFIED_KEY)) || null;
    var POMODORO_STALE_MS = 10 * 60 * 1e3;
    function noticePomodoro(pomodoro) {
      if (pomodoro === null || pomodoro.finishedAt === null || pomodoro.finishedAt === pomodoroNotifiedAt) return;
      pomodoroNotifiedAt = pomodoro.finishedAt;
      writeStore(POMODORO_NOTIFIED_KEY, String(pomodoro.finishedAt));
      if (Date.now() - pomodoro.finishedAt > POMODORO_STALE_MS) return;
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
      if (renderHold.defer(renderContent)) return;
      var scrollTop = ctx.content.scrollTop;
      var scrollPositions = /* @__PURE__ */ new Map();
      ctx.content.querySelectorAll("[data-scroll-key]").forEach(function(node) {
        if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
          scrollPositions.set(node.getAttribute("data-scroll-key"), { top: node.scrollTop, left: node.scrollLeft });
        }
      });
      preserveFarmTriggerFocus(ctx.content, paintContent);
      if (scrollTop !== 0) ctx.content.scrollTop = scrollTop;
      if (scrollPositions.size > 0) ctx.content.querySelectorAll("[data-scroll-key]").forEach(function(node) {
        var saved = scrollPositions.get(node.getAttribute("data-scroll-key"));
        if (saved) {
          node.scrollTop = saved.top;
          node.scrollLeft = saved.left;
        }
      });
      ctx.justBought = null;
      restoreHover(ctx.content);
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
      var bigView = Boolean(ctx.extBig) && ctx.tab === "ext:" + ctx.extBig;
      ctx.host.setAttribute("data-ext-view", bigView ? "big" : "");
      if (bigView) {
        renderDownloadedApp(ctx, ctx.extBig, "big");
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
      if (pointerRepaint.defer(render, next)) return true;
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
        ctx.hudName.textContent = ctx.view.pig.name + " Lv." + ctx.view.pig.level.level + " \xB7 " + pigStage.label + (ctx.view.pig.ageLabel ? " \xB7 " + ctx.view.pig.ageLabel : "") + (ctx.view.pig.ageForced ? " \u{1F527}" : "");
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
      if (desktopRole() !== "panel" && desktopRole() !== "ext") noticePomodoro(pomo);
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
      if ((ctx.ownerEdit !== null || ctx.pigNameEdit !== null) && ctx.tab === "status") return false;
      if ((ctx.cardEdit !== null || ctx.profileDraft) && ctx.tab === "card") return false;
      if (ctx.tab === "settings" && (document.activeElement?.getAttribute?.("data-proxy-address") === "true" || document.activeElement?.getAttribute?.("data-pig-scale") === "true")) return false;
      if (ctx.tab === "dex" && document.activeElement?.getAttribute?.("data-dex-search") === "items") return false;
      if ((ctx.extBig || String(ctx.tab).startsWith("ext:")) && document.activeElement?.matches?.(".fm-quantity")) return false;
      var currentFishing = ctx.view.fishing.pending;
      if (ctx.tab === "fishing" && previousFishing && currentFishing && previousFishing.id === currentFishing.id && previousFishing.phase === currentFishing.phase && (currentFishing.phase === "waiting" || currentFishing.phase === "hooked")) return false;
      renderContent();
      return true;
    }
    function showPigLine(event) {
      var lineId = event.id;
      ctx.showLine(event.text, event.replies, function(index) {
        ctx.send("reply", { line: lineId, index });
      }, event.displayMs);
    }
    return { setOpen, select, renderContent, render, dispose: function() {
      pointerRepaint.dispose();
      renderHold.dispose();
    } };
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
    var scene6 = el("div", "dp-scene");
    var hud = el("div", "dp-hud");
    var hudName = el("div", null, "\u732A\u732A");
    var hudCoins = el("div", null, "\u{1FA99} 0");
    var hudHealth = el("div", null, "\u{1F49A} 5/5");
    hud.appendChild(hudName);
    hud.appendChild(hudCoins);
    hud.appendChild(hudHealth);
    scene6.appendChild(hud);
    var bubble = el("div", "dp-bubble", "");
    bubble.hidden = true;
    scene6.appendChild(bubble);
    var work = el("div", "dp-work");
    var prop = el("span", "dp-prop", "\u{1F4BC}");
    var progressWrap = el("div", "dp-progress");
    var progressFill = document.createElement("i");
    progressWrap.appendChild(progressFill);
    work.appendChild(prop);
    work.appendChild(progressWrap);
    work.hidden = true;
    scene6.appendChild(work);
    var pokeHint = el("div", "dp-poke-hint");
    pokeHint.appendChild(el("span", null, "\u{1F446}"));
    pokeHint.appendChild(el("span", null, "\u6233\u4E09\u4E0B"));
    pokeHint.hidden = true;
    scene6.appendChild(pokeHint);
    var dailyHint = el("button", "dp-daily");
    dailyHint.hidden = true;
    scene6.appendChild(dailyHint);
    var soul = el("span", "dp-soul", "\u{1F47B}");
    soul.hidden = true;
    scene6.appendChild(soul);
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
    var pigHold = el("div", "dp-pig-hold");
    var pigBody = el("div", "dp-pig-body");
    pig.appendChild(pigHold);
    pigHold.appendChild(pigBody);
    pigBody.appendChild(pigArt);
    pigBody.appendChild(pigEmoji);
    pigBody.appendChild(pigSleep);
    var napBubble = el("span", "dp-nap-zzz", "Zzz");
    napBubble.setAttribute("aria-hidden", "true");
    pigBody.appendChild(napBubble);
    var dressSlots = el("div", "dp-dress");
    pigBody.appendChild(dressSlots);
    var hungerBubble = el("span", "dp-hunger-bubble");
    hungerBubble.setAttribute("role", "img");
    hungerBubble.setAttribute("aria-label", "\u997F\u4E86");
    var hungerCloud = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hungerCloud.setAttribute("viewBox", "0 0 54 50");
    hungerCloud.setAttribute("aria-hidden", "true");
    hungerCloud.innerHTML = '<path d="M14 33C4 33 1 22 8 17C5 9 13 3 21 7C27 0 39 3 40 11C52 12 53 26 44 29C40 38 29 38 25 33C20 37 16 36 14 33Z"/><circle cx="13" cy="40" r="3"/><circle cx="7" cy="46" r="1.8"/>';
    hungerBubble.appendChild(hungerCloud);
    hungerBubble.appendChild(el("span", "dp-hunger-food", "\u{1F955}"));
    pig.appendChild(hungerBubble);
    var pomoHint = el("div", "dp-pomo");
    pomoHint.setAttribute("data-pomo-pill", "true");
    pomoHint.hidden = true;
    pigBody.appendChild(pomoHint);
    scene6.appendChild(pig);
    scene6.title = "\u5DE6\u952E\u6478\u6478 \xB7 \u53F3\u952E\u6253\u5F00\u9762\u677F \xB7 \u62D6\u52A8\u53EF\u79FB\u52A8";
    var bar = el("div", "dp-bar");
    var content = el("div", "dp-content");
    var footer = el("div", "dp-panel-footer");
    footer.hidden = true;
    card2.appendChild(content);
    card2.appendChild(footer);
    card2.appendChild(bar);
    host3.appendChild(card2);
    host3.appendChild(scene6);
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
    return { font, style, host: host3, card: card2, scene: scene6, hud, hudName, hudCoins, hudHealth, bubble, work, prop, progressWrap, progressFill, pokeHint, dailyHint, pomoHint, soul, pigArt, pigSleep, pigEmoji, pig, pigHold, pigBody, dressSlots, bar, content, footer };
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
  function workAreaBounds(areas, fallback) {
    if (!Array.isArray(areas) || areas.length === 0) return fallback;
    const x = Math.min(...areas.map((a) => a.x)), y = Math.min(...areas.map((a) => a.y));
    return {
      x,
      y,
      width: Math.max(...areas.map((a) => a.x + a.width)) - x,
      height: Math.max(...areas.map((a) => a.y + a.height)) - y
    };
  }
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
  function displayNote(info) {
    const list = info?.displays;
    if (!Array.isArray(list) || list.length === 0) return null;
    const win = info.window;
    const hit = list.find((display) => win.x >= display.workArea.x && win.x < display.workArea.x + display.workArea.width && win.y >= display.workArea.y && win.y < display.workArea.y + display.workArea.height);
    const one = hit ?? list[0];
    return { id: one.id, scale: one.scaleFactor, count: list.length };
  }
  function merged(ranges) {
    const result = [];
    for (const range of ranges.sort((a, b) => a[0] - b[0])) {
      const last = result[result.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else result.push([...range]);
    }
    return result;
  }
  function intersect(a, b) {
    return a.flatMap((one) => b.map((two) => [Math.max(one[0], two[0]), Math.min(one[1], two[1])])).filter((range) => range[0] <= range[1]);
  }
  function drawingCorridor(areas, horizontal, from, to, before, after, position) {
    const axis = horizontal ? "y" : "x";
    const size = horizontal ? "height" : "width";
    const other = horizontal ? "x" : "y";
    const otherSize = horizontal ? "width" : "height";
    const cuts = [from, to, ...areas.flatMap((a) => [a[axis], a[axis] + a[size]]).filter((v) => v > from && v < to)].sort((a, b) => a - b);
    let ranges = [[-Infinity, Infinity]];
    for (let i = 1; i < cuts.length; i++) {
      const mid = (cuts[i - 1] + cuts[i]) / 2;
      const band = merged(areas.filter((a) => mid >= a[axis] && mid <= a[axis] + a[size]).map((a) => [a[other], a[other] + a[otherSize]]));
      ranges = intersect(ranges, band);
    }
    if (ranges.length === 0) {
      const nearest = areas.slice().sort((a, b) => Math.abs(position - (a[other] + a[otherSize] / 2)) - Math.abs(position - (b[other] + b[otherSize] / 2)))[0];
      ranges = [[nearest[other], nearest[other] + nearest[otherSize]]];
    }
    const allowed = ranges.map((r) => {
      const min = r[0] + before, max = r[1] - after;
      return min <= max ? [min, max] : [(min + max) / 2, (min + max) / 2];
    });
    return allowed.find((r) => position >= r[0] - 1e-5 && position <= r[1] + 1e-5) ?? allowed.sort((a, b) => Math.abs(Math.max(a[0], Math.min(position, a[1])) - position) - Math.abs(Math.max(b[0], Math.min(position, b[1])) - position))[0];
  }

  // src/client/desktop/motion-envelope.js
  var PIG_TRANSFORM_ORIGIN = Object.freeze({ x: 0.5, y: 0.85 });
  var PIG_MOTION = Object.freeze({
    spinScale: 1.2,
    jumpRise: 26,
    jumpPeakScale: 1.12,
    jumpLandingScale: 0.92
  });
  var keyframe = (scaleX2, scaleY2, rotate2, x, y) => Object.freeze({ scaleX: scaleX2, scaleY: scaleY2, rotate: rotate2, x, y });
  var REACTION_MOTION = Object.freeze({
    "dp-feed-hop": Object.freeze([
      keyframe(1, 1, 0, 0, 0),
      keyframe(1.07, 0.91, 0, 0, 2),
      keyframe(0.96, 1.07, 0, 0, -12),
      keyframe(1.1, 0.88, 0, 0, 0),
      keyframe(0.98, 1.03, 0, 0, -4)
    ]),
    "dp-play-hop": Object.freeze([
      keyframe(1, 1, 0, 0, 0),
      keyframe(1.02, 1.02, -7, -3, -5),
      keyframe(1.08, 0.92, 3, 0, 0),
      keyframe(0.97, 1.06, 8, 4, -9),
      keyframe(1.05, 0.96, -2, 0, 0)
    ]),
    "dp-squash": Object.freeze([
      keyframe(1, 1, 0, 0, 0),
      keyframe(1.04, 0.95, 0, 0, 1),
      keyframe(1.14, 0.82, 0, 0, 3),
      keyframe(0.95, 1.09, 0, 0, -4),
      keyframe(1.04, 0.97, 0, 0, 0)
    ])
  });
  var corners = (box) => [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height }
  ];
  function boundsOf(points) {
    const left = Math.min(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const right = Math.max(...points.map((point) => point.x));
    const bottom = Math.max(...points.map((point) => point.y));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  function scaledCorners(box, pivot, scale2, translateY = 0) {
    return corners(box).map((point) => ({
      x: pivot.x + (point.x - pivot.x) * scale2,
      y: pivot.y + (point.y - pivot.y) * scale2 + translateY
    }));
  }
  function unionBoxes(...boxes) {
    return boundsOf(boxes.flatMap(corners));
  }
  function spinEnvelope(box, pivot) {
    const radius = Math.max(...corners(box).map((point) => Math.hypot(point.x - pivot.x, point.y - pivot.y))) * PIG_MOTION.spinScale;
    return { x: pivot.x - radius, y: pivot.y - radius, width: radius * 2, height: radius * 2 };
  }
  function jumpEnvelope(box, pivot) {
    return boundsOf([
      ...corners(box),
      ...scaledCorners(box, pivot, PIG_MOTION.jumpPeakScale, -PIG_MOTION.jumpRise),
      ...scaledCorners(box, pivot, PIG_MOTION.jumpLandingScale)
    ]);
  }
  function keyframeCorners(box, pivot, state3) {
    const radians = state3.rotate * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return corners(box).map((point) => {
      const x = (point.x - pivot.x) * state3.scaleX;
      const y = (point.y - pivot.y) * state3.scaleY;
      return {
        x: pivot.x + x * cos - y * sin + state3.x,
        y: pivot.y + x * sin + y * cos + state3.y
      };
    });
  }
  function keyframeEnvelope(states, box, pivot) {
    return boundsOf(states.flatMap((state3) => keyframeCorners(box, pivot, state3)));
  }
  function reactionEnvelope(name, box, pivot) {
    const states = REACTION_MOTION[name];
    return states === void 0 ? null : keyframeEnvelope(states, box, pivot);
  }
  function motionEnvelope(name) {
    if (name === "dp-spin") return spinEnvelope;
    if (name === "dp-jump") return jumpEnvelope;
    if (Object.hasOwn(REACTION_MOTION, name)) return (box, pivot) => reactionEnvelope(name, box, pivot);
    return null;
  }
  function fixedMotionReserve(pigBox) {
    const artWidth = MAX_ART_ASPECT2 * FRAME_HEIGHT2 * pigBox.width;
    const artHeight = FRAME_HEIGHT2 * pigBox.width;
    const staticBox = unionBoxes(pigBox, {
      x: pigBox.x + (pigBox.width - artWidth) / 2,
      y: pigBox.y + (pigBox.height - artHeight) / 2,
      width: artWidth,
      height: artHeight
    });
    const pivot = {
      x: pigBox.x + pigBox.width * PIG_TRANSFORM_ORIGIN.x,
      y: pigBox.y + pigBox.height * PIG_TRANSFORM_ORIGIN.y
    };
    return unionBoxes(staticBox, spinEnvelope(staticBox, pivot), jumpEnvelope(staticBox, pivot));
  }

  // src/client/feel/config.js
  var FEEL = Object.freeze({
    /** 压扁（正）上限，用户拍板 18%。 */
    squashMax: 0.18,
    /** 拎起拉长上限，用户拍板 10%。 */
    holdMax: 0.1,
    /** 按压量。 */
    pressSquash: 0.04,
    /** 横向缩放 = 1 + volumeK * 压扁；小于 1 更像圆滚滚的动物。 */
    volumeK: 0.72,
    /** 拎起时横向收窄的比例。 */
    holdNarrow: 0.4,
    /** 拖动倾斜上限（度）。 */
    tiltMaxDrag: 18,
    /** 飞行倾斜上限（度）。 */
    tiltMaxFly: 20,
    /** 屏幕水平速度 → 倾斜角（度 / (px/s)）。 */
    tiltGain: 0.012,
    /** 按压弹簧。 */
    press: Object.freeze({ stiffness: 600, damping: 26, mass: 1 }),
    /** 挤压/拉长弹簧：欠阻尼，2~3 次可见回弹，约 0.75s 收住。 */
    squash: Object.freeze({ stiffness: 260, damping: 14, mass: 1 }),
    /** 拎起弹簧：接近临界阻尼，不上下晃。 */
    hold: Object.freeze({ stiffness: 300, damping: 26, mass: 1 }),
    /** 倾斜弹簧：松手约 0.45s 回正。 */
    tilt: Object.freeze({ stiffness: 220, damping: 16, mass: 1 }),
    /** 落地冲击弹簧：同样 2~3 次回弹。 */
    impact: Object.freeze({ stiffness: 260, damping: 14, mass: 1 }),
    /** 翻卡片。 */
    turnMs: 180,
    turnBulge: 0.04,
    /** 动作图切换遮挡。 */
    swapMs: 90,
    swapApplyMs: 55,
    swapMaxDelayMs: 140,
    /** 手势阈值。 */
    dragPx: 4,
    liftPx: 6,
    /** 来回摸：1200ms 内累计 320px，800ms 冷却。 */
    strokeWindowMs: 1200,
    strokePx: 320,
    strokeCooldownMs: 800,
    /** 桌面抛掷：只认松手前最后一小段仍在快速移动。 */
    throwMin: 180,
    throwTailMs: 60,
    throwIdleMs: 60,
    throwMax: 2200,
    gravity: 2400,
    airDrag: 0.12,
    restitution: 0.52,
    floorFriction: 0.82,
    landVy: 520,
    dizzyImpact: 1500,
    dizzyMs: 2400,
    flightMaxMs: 3500,
    /** 轻柔模式缩放。 */
    softScale: 0.6,
    /** 收尾判定：所有通道小于这些值就算回稳。 */
    settleEpsilon: 4e-3,
    settleTilt: 0.35
  });
  function modeScale(mode) {
    return mode === "soft" ? FEEL.softScale : 1;
  }

  // src/client/feel/envelope.js
  var corners2 = (box) => [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height }
  ];
  function bounds(points) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const point of points) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  function union(...boxes) {
    return bounds(boxes.flatMap(corners2));
  }
  function transformed(box, pivot, state3) {
    const radians = state3.rotate * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return corners2(box).map((point) => {
      const x = (point.x - pivot.x) * state3.scaleX;
      const y = (point.y - pivot.y) * state3.scaleY;
      return {
        x: pivot.x + x * cos - y * sin,
        y: pivot.y + x * sin + y * cos + state3.dy
      };
    });
  }
  function poseEnvelope(box, pose, pigBox = box) {
    const bodyPivot = { x: pigBox.x + pigBox.width * 0.5, y: pigBox.y + pigBox.height * 0.85 };
    const holdPivot = { x: pigBox.x + pigBox.width * 0.5, y: pigBox.y };
    const body = transformed(box, bodyPivot, {
      scaleX: 1 + FEEL.volumeK * pose.squash,
      scaleY: 1 - pose.squash,
      rotate: pose.tilt,
      dy: -pose.hop
    });
    const hold = transformed(
      {
        x: Math.min(...body.map((p) => p.x)),
        y: Math.min(...body.map((p) => p.y)),
        width: Math.max(...body.map((p) => p.x)) - Math.min(...body.map((p) => p.x)),
        height: Math.max(...body.map((p) => p.y)) - Math.min(...body.map((p) => p.y))
      },
      holdPivot,
      { scaleX: 1 - FEEL.holdNarrow * pose.hold, scaleY: 1 + pose.hold, rotate: 0, dy: 0 }
    );
    const exact = corners2(box).map((point) => {
      const bodyPoint = {
        x: bodyPivot.x + (point.x - bodyPivot.x) * (1 + FEEL.volumeK * pose.squash),
        y: bodyPivot.y + (point.y - bodyPivot.y) * (1 - pose.squash) - pose.hop
      };
      const radians = pose.tilt * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const rotated = {
        x: bodyPivot.x + (bodyPoint.x - bodyPivot.x) * cos - (bodyPoint.y - bodyPivot.y) * sin,
        y: bodyPivot.y + (bodyPoint.x - bodyPivot.x) * sin + (bodyPoint.y - bodyPivot.y) * cos
      };
      return {
        x: holdPivot.x + (rotated.x - holdPivot.x) * (1 - FEEL.holdNarrow * pose.hold),
        y: holdPivot.y + (rotated.y - holdPivot.y) * (1 + pose.hold)
      };
    });
    return union(bounds(hold), bounds(exact));
  }
  function feelEnvelope(pigBox, pose, artBox = pigBox) {
    if (pigBox.width <= 0 || pigBox.height <= 0) return { x: pigBox.x, y: pigBox.y, width: pigBox.width, height: pigBox.height };
    if (pose !== void 0) {
      return poseEnvelope(artBox, {
        squash: Number.isFinite(pose.squash) ? pose.squash : 0,
        hold: Number.isFinite(pose.hold) ? pose.hold : 0,
        tilt: Number.isFinite(pose.tilt) ? pose.tilt : 0,
        hop: Number.isFinite(pose.hop) ? pose.hop : 0
      }, pigBox);
    }
    const squashes = [FEEL.squashMax, -FEEL.squashMax * 0.45];
    const tilts = [-FEEL.tiltMaxFly, FEEL.tiltMaxFly];
    const boxes = [];
    for (const squash of squashes) {
      for (const tilt3 of tilts) {
        boxes.push(poseEnvelope(artBox, { squash, hold: FEEL.holdMax, tilt: tilt3, hop: 0 }, pigBox));
        boxes.push(poseEnvelope(artBox, { squash, hold: 0, tilt: tilt3, hop: 0 }, pigBox));
      }
    }
    return union(...boxes);
  }

  // src/client/desktop/visual-bounds.js
  function bodyVisualBounds(pig) {
    const art = artMarginFor(pig.width);
    const pose = feelEnvelope(
      { x: 0, y: 0, width: pig.width, height: pig.height },
      void 0,
      { x: -art, y: 0, width: pig.width + art * 2, height: pig.height }
    );
    const left = Math.max(art, -pose.x);
    const right = Math.max(art, pose.x + pose.width - pig.width);
    const top = Math.max(8, -pose.y);
    const bottom = Math.max(12, pose.y + pose.height - pig.height);
    return {
      x: pig.x - left,
      y: pig.y - top,
      width: pig.width + left + right,
      height: pig.height + top + bottom
    };
  }

  // src/client/desktop/bubble-geometry.js
  function fitBubbleHorizontally(bubble, pig, windowBounds, workArea) {
    const left = Math.max(0, workArea.x - windowBounds.x) + 6;
    const right = Math.min(windowBounds.width, workArea.x + workArea.width - windowBounds.x) - 6;
    const x = Math.max(left, Math.min(bubble.x, Math.max(left, right - bubble.width)));
    return { x, tailLeft: Math.max(10, Math.min(bubble.width - 20, pig.x + pig.width / 2 - x - 5)) };
  }

  // src/client/desktop/measure.js
  function framedBox(node, box) {
    if (!node.matches?.(".dp-pig-img,.dp-pig-sleep")) return box;
    const path = (node.getAttribute("src") || "").split("/art/")[1];
    const bounds2 = ART_BOUNDS2[path];
    if (!bounds2) return box;
    const zoom = Number(node.style.getPropertyValue("--art-zoom")) || 1;
    const shiftX = parseFloat(node.style.getPropertyValue("--art-x")) || 0;
    const shiftY = parseFloat(node.style.getPropertyValue("--art-y")) || 0;
    const mirrored = node.closest(".dp-pig")?.getAttribute("data-walk") === "right";
    const fit = Math.min(box.width, box.height);
    const left = mirrored ? 1 - bounds2[2] : bounds2[0];
    const right = mirrored ? 1 - bounds2[0] : bounds2[2];
    return {
      x: box.x + box.width / 2 + (left - 0.5) * fit * zoom + (mirrored ? -shiftX : shiftX) * box.width / 100,
      y: box.y + box.height / 2 + (bounds2[1] - 0.5) * fit * zoom + shiftY * box.height / 100,
      width: (right - left) * fit * zoom,
      height: (bounds2[3] - bounds2[1]) * fit * zoom
    };
  }
  var BUBBLE_ZONE = { width: 272, height: 104 };
  var OPEN_BUBBLE_LEFT = 180 + 6 + 6;
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
    const state3 = { pinned: "", bubbleHeight: null, shift: { x: 0, y: 0 }, anchor: { x: 0, y: 0 } };
    const reserves = env.platform !== "darwin";
    function boxes(host3) {
      const pigNode = host3.querySelector(".dp-pig");
      const pigBox = pigNode === null ? { x: 0, y: 0, width: 0, height: 0 } : layoutBox(pigNode);
      const pigInk = { x: pigBox.x, y: pigBox.y, r: pigBox.x + pigBox.width, b: pigBox.y + pigBox.height };
      const nodes = [host3];
      const all = host3.querySelectorAll("*");
      for (let a = 0; a < all.length; a += 1) {
        const candidate = all[a];
        const inCard = candidate.closest(".dp-card");
        if (candidate.closest(".dp-pet-snap") !== null) continue;
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
        if (pigNode !== null && (node === pigNode || node.closest(".dp-pig") === pigNode)) {
          pigInk.x = Math.min(pigInk.x, rect.x);
          pigInk.y = Math.min(pigInk.y, rect.y);
          pigInk.r = Math.max(pigInk.r, rect.r);
          pigInk.b = Math.max(pigInk.b, rect.b);
        }
        if (bubble !== null) bubbleRects.push(rect);
        else rects.push(rect);
      }
      if (rects.length === 0) return null;
      const hostBox = layoutBox(host3);
      let bubbleZone = null;
      if (reserves && pigNode !== null) {
        const above = geometry2 === null ? BUBBLE_ZONE.height : geometry2.window.y + pigBox.y - geometry2.workArea.y - PAD;
        const want = Math.max(0, Math.min(BUBBLE_ZONE.height, Math.round(above)));
        if (state3.bubbleHeight === null || Math.abs(want - state3.bubbleHeight) >= STEP * 2) state3.bubbleHeight = want;
        const height = state3.bubbleHeight;
        const zoneLeft = host3.getAttribute("data-panel-side") === "right" ? hostBox.x : hostBox.x + hostBox.width - BUBBLE_ZONE.width;
        if (height > 0) bubbleZone = { x: zoneLeft, y: pigBox.y - height, r: zoneLeft + BUBBLE_ZONE.width, b: pigBox.y };
      }
      let merged2 = true;
      while (merged2) {
        merged2 = false;
        for (let p = 0; p < rects.length && !merged2; p += 1) {
          for (let q = p + 1; q < rects.length; q += 1) {
            const one = rects[p];
            const two = rects[q];
            if (one.x <= two.r && two.x <= one.r && one.y <= two.b && two.y <= one.b) {
              rects[p] = { x: Math.min(one.x, two.x), y: Math.min(one.y, two.y), r: Math.max(one.r, two.r), b: Math.max(one.b, two.b) };
              rects.splice(q, 1);
              merged2 = true;
              break;
            }
          }
        }
      }
      const outline = rects.concat(bubbleZone === null ? [] : [bubbleZone]);
      if (pigNode !== null) {
        const artMargin = artMarginFor(pigBox.width);
        outline.push({
          x: pigBox.x + pigBox.width,
          y: pigBox.y - 48,
          r: pigBox.x + pigBox.width + 60,
          b: pigBox.y + 53
        });
        outline.push({
          x: pigBox.x - pigBox.width * 0.18,
          y: pigBox.y - pigBox.height * 0.5,
          r: pigBox.x + pigBox.width * 1.1,
          b: pigBox.y + pigBox.height
        });
        const openBubbleLeft = reserves ? pigBox.x - OPEN_BUBBLE_LEFT : Infinity;
        outline.push({
          x: Math.min(pigBox.x + pigBox.width - BUBBLE_ZONE.width, openBubbleLeft, pigBox.x - artMargin),
          y: pigBox.y - BUBBLE_ZONE.height - 24,
          r: pigBox.x + pigBox.width + artMargin,
          b: pigBox.y + pigBox.height + 12
        });
        if (reserves) {
          const motion = fixedMotionReserve(pigBox);
          outline.push({ x: motion.x, y: motion.y, r: motion.x + motion.width, b: motion.y + motion.height });
        }
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
      const animatedRects = [];
      const hungerNode = host3.querySelector(".dp-hunger-bubble");
      if (pigNode !== null && hungerNode !== null && visible(hungerNode)) {
        animatedRects.push({
          x: pigBox.x + pigBox.width,
          y: pigBox.y - 48,
          r: pigBox.x + pigBox.width + 60,
          b: pigBox.y + 53
        });
      }
      if (reserves && pigNode !== null) {
        const names = String(getComputedStyle(pigNode).animationName).split(",").map((name) => name.trim()).filter(Boolean);
        const envelopes = names.map((name) => motionEnvelope(name)).filter((envelope) => envelope !== null);
        if (envelopes.length > 0) {
          const pivot = { x: pigBox.x + pigBox.width * PIG_TRANSFORM_ORIGIN.x, y: pigBox.y + pigBox.height * PIG_TRANSFORM_ORIGIN.y };
          for (const envelope of envelopes) {
            const animated = envelope({ x: pigInk.x, y: pigInk.y, width: pigInk.r - pigInk.x, height: pigInk.b - pigInk.y }, pivot);
            animatedRects.push({ x: animated.x, y: animated.y, r: animated.x + animated.width, b: animated.y + animated.height });
          }
        }
      }
      if (pigNode?.getAttribute("data-pet-snap") === "true") {
        animatedRects.push({
          x: pigBox.x - pigBox.width * 0.18,
          y: pigBox.y - pigBox.height * 0.5,
          r: pigBox.x + pigBox.width * 1.1,
          b: pigBox.y + pigBox.height
        });
      }
      const feelState = pigNode === null ? null : pigNode.getAttribute("data-feel");
      if (pigNode !== null && (feelState === "active" || feelState === "settle")) {
        const envelope = bodyVisualBounds(pigBox);
        animatedRects.push({ x: envelope.x, y: envelope.y, r: envelope.x + envelope.width, b: envelope.y + envelope.height });
      }
      const shape = rects.concat(bubbleRects, animatedRects).map(function(rect) {
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
      const shift = { x: state3.shift.x + state3.anchor.x, y: state3.shift.y + state3.anchor.y };
      if (side.horizontal === "left") want.left = Math.round(hostBox.x - contentBox.left + PAD + shift.x) + "px";
      else want.right = Math.round(contentBox.right - hostBox.x - hostBox.width + PAD - shift.x) + "px";
      if (side.vertical === "top") want.top = Math.round(hostBox.y - contentBox.top + PAD + shift.y) + "px";
      else want.bottom = Math.round(contentBox.bottom - hostBox.y - hostBox.height + PAD - shift.y) + "px";
      const key2 = [side.vertical, side.horizontal, want.left, want.right, want.top, want.bottom].join("|");
      if (key2 === state3.pinned) return;
      state3.pinned = key2;
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
    function fitWindow(content, win) {
      if (win && (content.width !== win.width || content.height !== win.height)) {
        state3.anchor = { x: 0, y: 0 };
      }
    }
    function fitBubble(host3, geometry2) {
      const bubble = host3.querySelector(".dp-bubble");
      const pig = host3.querySelector(".dp-pig");
      if (!bubble || !pig || !geometry2?.window || !geometry2?.workArea) return;
      if (bubble.hidden) return;
      const parent = bubble.offsetParent;
      if (!parent) return;
      const originalLeft = host3.getAttribute("data-panel-side") === "right" ? 6 : parent.clientWidth - 6 - bubble.offsetWidth;
      const box = { ...layoutBox(bubble), x: layoutBox(parent).x + originalLeft };
      const fitted = fitBubbleHorizontally(box, layoutBox(pig), geometry2.window, geometry2.workArea);
      const clipped = Math.abs(fitted.x - box.x) >= 0.5;
      const left = clipped ? originalLeft + fitted.x - box.x + "px" : "";
      const right = clipped ? "auto" : "";
      const tail = clipped ? fitted.tailLeft + "px" : "";
      if (bubble.style.left !== left) bubble.style.left = left;
      if (bubble.style.right !== right) bubble.style.right = right;
      if (bubble.style.getPropertyValue("--bubble-tail-left") !== tail) {
        if (tail) bubble.style.setProperty("--bubble-tail-left", tail);
        else bubble.style.removeProperty("--bubble-tail-left");
      }
      if (clipped && !bubble.hasAttribute("data-fitted")) bubble.setAttribute("data-fitted", "true");
      else if (!clipped && bubble.hasAttribute("data-fitted")) bubble.removeAttribute("data-fitted");
    }
    return { boxes, sides, pin, keyOf, fitWindow, fitBubble, state: state3 };
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
  function horizontalSpan(point, areas, fallback) {
    const ranges = [];
    for (const area of areas.filter((a) => point.y >= a.y && point.y < a.y + a.height).sort((a, b) => a.x - b.x)) {
      const last = ranges.at(-1);
      if (last && area.x <= last.x + last.width) last.width = Math.max(last.x + last.width, area.x + area.width) - last.x;
      else ranges.push({ x: area.x, width: area.width });
    }
    return ranges.find((a) => point.x >= a.x && point.x <= a.x + a.width) ?? fallback;
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
      const same2 = relative && raw.area ? list.find((a) => a.x === raw.area.x && a.y === raw.area.y && a.width === raw.area.width && a.height === raw.area.height) : null;
      const origin = relative && raw.area ? same2 ?? raw.area : { x: 0, y: 0 };
      let point = { x: origin.x + raw.x, y: origin.y + raw.y };
      if (raw.v !== STORE_VERSION) {
        const w = Number.isFinite(raw.w) ? raw.w : pigSize2.width;
        const h = Number.isFinite(raw.h) ? raw.h : pigSize2.height;
        point = { x: point.x + w / 2, y: point.y + h };
      }
      if (relative && raw.area && same2 === null) {
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
    function payloadFor(point, areas) {
      const area = areaOf(point, areas);
      return area === null ? { v: STORE_VERSION, area: null, x: point.x, y: point.y } : { v: STORE_VERSION, area: { x: area.x, y: area.y, width: area.width, height: area.height }, x: point.x - area.x, y: point.y - area.y };
    }
    function persist(areas) {
      if (home === null) return;
      const key2 = JSON.stringify(payloadFor(home, areas));
      if (key2 === stored) return;
      stored = key2;
      try {
        localStorage.setItem(PIG_SCREEN_KEY, key2);
      } catch {
      }
    }
    function decide(report, bounds2, areas) {
      const pigSize2 = report.pig.width > 0 && report.pig.height > 0 ? { width: report.pig.width, height: report.pig.height } : lastPigSize;
      lastPigSize = pigSize2;
      if (pending2 === void 0) pending2 = readSaved();
      if (home === null) {
        home = pending2 !== null ? homeFromSaved(pending2, pigSize2, areas) : { x: Math.round(bounds2.x + report.pigNow.x + pigSize2.width / 2), y: Math.round(bounds2.y + report.pigNow.y + pigSize2.height) };
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
      if (report.artMargin > 0 && list.length > 0) {
        const area2 = horizontalSpan({ x: home.x, y: home.y - pigSize2.height / 2 }, list, areaOf(home, list));
        const reach = Math.min(area2.width / 2, pigSize2.width / 2 + report.artMargin);
        home.x = Math.round(Math.max(area2.x + reach, Math.min(home.x, area2.x + area2.width - reach)));
      }
      if (report.visual && list.length > 0) {
        const visual = report.visual;
        const left = report.pig.x + pigSize2.width / 2 - visual.x;
        const right = visual.x + visual.width - report.pig.x - pigSize2.width / 2;
        const top = report.pig.y + pigSize2.height - visual.y;
        const bottom = visual.y + visual.height - report.pig.y - pigSize2.height;
        const fit = (value, range) => Math.round(Math.max(range[0], Math.min(value, range[1])));
        home.y = fit(home.y, drawingCorridor(list, false, home.x - left, home.x + right, top, bottom, home.y));
        home.x = fit(home.x, drawingCorridor(list, true, home.y - top, home.y + bottom, left, right, home.x));
        home.y = fit(home.y, drawingCorridor(list, false, home.x - left, home.x + right, top, bottom, home.y));
      }
      const shift = report.shift ?? { x: 0, y: 0 };
      const pigPlain = { x: report.pigWindow.x - shift.x, y: report.pigWindow.y - shift.y, ...pigSize2 };
      const topLeft = { x: home.x - pigSize2.width / 2, y: home.y - pigSize2.height };
      const area = nearestArea(home, areas) ?? { x: bounds2.x, y: bounds2.y, width: bounds2.width, height: bounds2.height };
      const viewport = workAreaBounds(list, area);
      const next = contentBoundsForPig({ width: report.width, height: report.height, pigWindow: pigPlain }, topLeft);
      const rawX = next.x;
      const rawY = next.y;
      next.x = Math.max(viewport.x, Math.min(next.x, viewport.x + viewport.width - next.width));
      next.y = Math.max(viewport.y, Math.min(next.y, viewport.y + viewport.height - next.height));
      lastClamp = { dx: next.x - rawX, dy: next.y - rawY };
      return next;
    }
    function rehome(windowPos, pigLocal, areas) {
      home = { x: Math.round(windowPos.x + pigLocal.x + pigLocal.width / 2), y: Math.round(windowPos.y + pigLocal.y + pigLocal.height) };
      pending2 = null;
      persist(areas);
    }
    function acceptWindow(windowPos, pigLocal, areas) {
      home = {
        x: Math.round(windowPos.x + pigLocal.x + pigLocal.width / 2),
        y: Math.round(windowPos.y + pigLocal.y + pigLocal.height)
      };
      pending2 = null;
      stored = JSON.stringify(payloadFor(home, Array.isArray(areas) ? areas : []));
    }
    return {
      decide,
      rehome,
      acceptWindow,
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

  // src/client/desktop/window-clamp.js
  var TOLERANCE = 2;
  var DEFAULT_LIMIT = 6;
  function same(a, b) {
    return Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE && Math.abs(a.width - b.width) <= TOLERANCE && Math.abs(a.height - b.height) <= TOLERANCE;
  }
  function key(rect) {
    return [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value / TOLERANCE)).join(",");
  }
  function createWindowClamp(limit = DEFAULT_LIMIT) {
    let wantKey = null;
    let actualKey = null;
    let attempts = 0;
    return {
      /**
       * @param {{x:number,y:number,width:number,height:number}} want 页面请求的窗口
       * @param {{x:number,y:number,width:number,height:number}} actual 主进程回读的实际窗口
       * @returns {'ok'|'retry'|'accept'}
       */
      observe(want, actual) {
        if (same(want, actual)) {
          wantKey = null;
          actualKey = null;
          attempts = 0;
          return "ok";
        }
        const nextWant = key(want);
        const nextActual = key(actual);
        if (nextWant === wantKey && nextActual === actualKey) attempts += 1;
        else {
          wantKey = nextWant;
          actualKey = nextActual;
          attempts = 1;
        }
        return attempts >= limit ? "accept" : "retry";
      },
      reset() {
        wantKey = null;
        actualKey = null;
        attempts = 0;
      },
      attempts() {
        return attempts;
      }
    };
  }

  // src/client/desktop/flight-bridge.js
  function createFlightBridge(c) {
    return {
      supported: typeof c.shell.flyMove === "function",
      start: function() {
        const info = c.readGeometry();
        if (info === null || info === void 0 || !info.window) return null;
        const pig = c.pigInWindow(info.window);
        if (pig === null) return null;
        return {
          home: { x: info.window.x + pig.x + pig.width / 2, y: info.window.y + pig.y + pig.height },
          pig: { x: pig.x, y: pig.y, width: pig.width, height: pig.height },
          visual: bodyVisualBounds(pig),
          window: { x: info.window.x, y: info.window.y, width: info.window.width, height: info.window.height },
          area: info.workArea,
          areas: info.workAreas ?? [info.workArea]
        };
      },
      move: function(x, y, slide) {
        if (typeof c.shell.flyMove !== "function") return;
        c.shell.flyMove({ x, y, slide: slide ?? { x: 0, y: 0 } });
      },
      setFlying: function(on) {
        c.setFlying(on === true);
        if (!c.isFlying()) {
          c.forgetLayout();
          c.tick();
        }
      },
      /** 落地/接住后重定家：用最后一次请求的窗口位置 + 猪在窗口里的框 + slide，不依赖异步回读。 */
      finish: function(last) {
        c.setFlying(false);
        if (last !== null && last !== void 0 && last.window && last.pig) {
          const pig = {
            x: last.pig.x + (last.slide?.x ?? 0),
            y: last.pig.y + (last.slide?.y ?? 0),
            width: last.pig.width,
            height: last.pig.height
          };
          c.rehome(last.window, pig, last.areas ?? []);
        }
        c.clearSlide(last?.slide ?? { x: 0, y: 0 });
        c.forgetLayout();
        c.tick();
      }
    };
  }

  // src/client/desktop/slide.js
  function commitSlide(host3, state3, slide) {
    const x = Number(slide?.x) || 0;
    const y = Number(slide?.y) || 0;
    if (host3 !== null && (x !== 0 || y !== 0)) {
      host3.style.right = (parseFloat(host3.style.right) || 0) - x + "px";
      host3.style.bottom = (parseFloat(host3.style.bottom) || 0) - y + "px";
    }
    if (host3 !== null) host3.style.translate = "";
    state3.anchor = { x: state3.anchor.x + state3.shift.x + x, y: state3.anchor.y + state3.shift.y + y };
    state3.shift = { x: 0, y: 0 };
    state3.pinned = "";
  }

  // src/client/desktop/ext-window.js
  var EXT_CSS = [
    "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#7fae5a}",
    '[data-piggy-role="ext"] [data-dsh-pig]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;transform:none!important;pointer-events:auto!important}',
    '[data-piggy-role="ext"] .dp-scene,[data-piggy-role="ext"] .dp-hud,[data-piggy-role="ext"] .dp-bar,[data-piggy-role="ext"] .dp-panel-footer{display:none!important}',
    '[data-piggy-role="ext"] .dp-card{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-height:none!important;max-width:none!important;',
    "border:0!important;border-radius:0!important;box-shadow:none!important;margin:0!important}",
    '[data-piggy-role="ext"] [data-ext-view="big"] .dp-card{background:#7fae5a!important}',
    '[data-piggy-role="ext"] [data-ext-view="big"] .dp-content{padding:0!important;overflow:hidden!important;height:100%}'
  ].join("\n");
  function installExt(bridge3) {
    document.documentElement.setAttribute("data-piggy-role", "ext");
    const style = document.createElement("style");
    style.setAttribute("data-piggy-ext-style", "");
    style.textContent = EXT_CSS;
    document.head.appendChild(style);
    window.__dshPiggyShell = {
      role: "ext",
      extKey: typeof bridge3.extKey === "string" ? bridge3.extKey : null,
      ext: bridge3.ext,
      proxy: bridge3.proxy,
      saves: bridge3.saves,
      fullscreen: bridge3.fullscreen,
      split: true,
      panel: bridge3.panel,
      onStateChanged: bridge3.onStateChanged,
      // 这里没有猪可拖：给「认桌面版」用的空动作（desktop-shell.js 按 beginDrag 认）。
      beginDrag: function() {
      },
      endDrag: function() {
      },
      dragHeartbeat: function() {
      },
      syncGeometry: function() {
      }
    };
  }

  // src/client/desktop/css.js
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

  // src/client/desktop/index.js
  var DESKTOP_VERSION = 6;
  var TOLERANCE2 = 2;
  var bridge2 = (
    /** @type {any} */
    null
  );
  var role = (
    /** @type {'pet'|'panel'|'ext'|null} */
    null
  );
  var dragSlide = { x: 0, y: 0 };
  var flying = false;
  var measure = (
    /** @type {any} */
    null
  );
  var placement = (
    /** @type {any} */
    null
  );
  var lastKey = null;
  var windowClamp = createWindowClamp();
  var clampNotice = null;
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
    const scene6 = document.querySelector("[data-dsh-pig] .dp-scene");
    return scene6 !== null && scene6.getAttribute("data-dragging") === "true";
  }
  function updateHit(x, y) {
    mouse = { x, y };
    if (typeof bridge2.setHit !== "function") return;
    let inside2 = dragging() || flying;
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
    if (dragging() || flying) return;
    const h = host2();
    if (h === null) return;
    const info = readGeometry();
    if (info !== null && info.window && layoutStale(info.window)) {
      const at = typeof performance === "object" ? performance.now() : Date.now();
      if (staleSince === null) staleSince = at;
      if (at - staleSince < STALE_WAIT_MS) {
        lastKey = null;
        schedule3();
        return;
      }
    }
    staleSince = null;
    let next = measure.boxes(h);
    if (next === null) return;
    measure.fitWindow(next.content, info?.window);
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
      schedule3();
      return;
    }
    const bounds2 = info.window;
    const areas = info.workAreas ?? [info.workArea];
    const grownX = side.horizontal === "right" ? next.content.width - bounds2.width : 0;
    const grownY = side.vertical === "bottom" ? next.content.height - bounds2.height : 0;
    const want = placement.decide({
      width: next.content.width,
      height: next.content.height,
      pig: next.pig,
      artMargin: artMarginFor(next.pig.width),
      visual: bodyVisualBounds(next.pig),
      pigWindow: { x: next.pigBox.x + grownX, y: next.pigBox.y + grownY },
      pigNow: { x: next.pigBox.x, y: next.pigBox.y },
      shift: measure.state.shift
    }, bounds2, areas);
    placement.persist(areas);
    const clamp6 = placement.clamp();
    const old = measure.state.shift;
    const fresh = { x: -clamp6.dx, y: -clamp6.dy };
    if (fresh.x !== old.x || fresh.y !== old.y) {
      measure.state.shift = fresh;
      measure.pin(h, side, next.hostBox, next.contentBox);
      const dx = fresh.x - old.x;
      const dy = fresh.y - old.y;
      next.shape = next.shape.map((rect) => ({ ...rect, x: rect.x + dx, y: rect.y + dy }));
      hitRects = next.shape;
    }
    measure.fitBubble(h, info);
    next = measure.boxes(h);
    if (next === null) return;
    hitRects = next.shape;
    const move = !sameBounds(want, bounds2, TOLERANCE2);
    const clampState = windowClamp.observe(want, bounds2);
    if (clampState === "accept") {
      const pig = pigInWindow(bounds2);
      if (pig !== null) {
        placement.acceptWindow(bounds2, pig, areas);
        const notice = JSON.stringify({ want, actual: bounds2 });
        if (clampNotice !== notice) {
          clampNotice = notice;
          console.warn("[piggy-desktop] wm clamp accepted " + notice);
        }
        lastKey = null;
        bridge2.place({ bounds: { ...bounds2 } });
        return;
      }
    }
    const key2 = measure.keyOf(next);
    if (!move && key2 === lastKey) return;
    lastKey = key2;
    const request = { shape: next.shape, bounds: move ? want : void 0, pig: void 0 };
    const pigNode = h.querySelector(".dp-pig");
    if (pigNode) request.pig = layoutBox(pigNode);
    if (move) {
      console.warn("[piggy-desktop] move " + JSON.stringify({
        open: h.getAttribute("data-open"),
        side,
        from: bounds2,
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
  function readGeometry() {
    if (typeof bridge2.place === "function") {
      const fresh = bridge2.place({});
      if (fresh !== null && fresh !== void 0 && fresh.window) return fresh;
    }
    return geometry();
  }
  function schedule3() {
    if (scheduled2) return;
    scheduled2 = true;
    requestAnimationFrame(function() {
      scheduled2 = false;
      if (!dragging() && !flying) tick();
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
    role = shell2.role === "panel" ? "panel" : shell2.role === "ext" ? "ext" : "pet";
    if (role === "ext") {
      const style2 = document.createElement("style");
      style2.setAttribute("data-piggy-desktop-style", "");
      style2.textContent = DESKTOP_CSS;
      document.head.appendChild(style2);
      installExt(shell2);
      return;
    }
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
      saves: shell2.saves,
      ext: shell2.ext,
      fullscreen: shell2.fullscreen,
      split: true,
      dragVisualBounds: shell2.dragVisualBounds === true,
      onStateChanged: shell2.onStateChanged,
      panel: {
        toggle: function(open) {
          const info = readGeometry();
          const pig = info && info.window ? pigInWindow(info.window) : null;
          shell2.panel.toggle(open, pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height });
        },
        on: shell2.panel.on,
        onFx: shell2.panel.onFx,
        raisePet: shell2.panel.raisePet
      },
      /** @param {{x:number,y:number}|null} [origin] pointerdown 时的屏幕坐标：延迟到 4px 才开始拖动时，窗口不会落后手指。 */
      beginDrag: function(origin) {
        const info = readGeometry();
        const pig = info && info.window ? pigInWindow(info.window) : null;
        dragSlide = { x: 0, y: 0 };
        if (typeof shell2.beginDrag !== "function") return;
        shell2.beginDrag(pig === null ? null : {
          x: pig.x,
          y: pig.y,
          width: pig.width,
          height: pig.height,
          visual: bodyVisualBounds(pig),
          slide: typeof shell2.onDragSlide === "function",
          origin: origin !== null && origin !== void 0 && Number.isFinite(origin.x) && Number.isFinite(origin.y) ? { x: origin.x, y: origin.y } : void 0
        });
      },
      dragHeartbeat: function() {
        if (typeof shell2.dragHeartbeat === "function") shell2.dragHeartbeat();
      },
      endDrag: function(release) {
        if (typeof shell2.endDrag !== "function") return;
        shell2.endDrag(release ?? null);
        const info = readGeometry();
        if (info && info.window) {
          if (info.dragSlide && Number.isFinite(info.dragSlide.x) && Number.isFinite(info.dragSlide.y)) dragSlide = info.dragSlide;
          const inWindow = pigInWindow(info.window);
          const pig = inWindow === null ? null : { ...inWindow, x: inWindow.x + dragSlide.x, y: inWindow.y + dragSlide.y };
          if (pig !== null) {
            placement.rehome(info.window, pig, info.workAreas ?? [info.workArea]);
          }
        }
        commitSlide(host2(), measure.state, dragSlide);
        dragSlide = { x: 0, y: 0 };
        lastKey = null;
        schedule3();
      },
      syncGeometry: function() {
        tick();
      },
      // 桌面散步（G 批次）：用外壳本来就有的 moveBy 挪窗口，新位置由主进程推回来的几何记住。
      // A2 抛掷：页面算好窗口位置，外壳只 setBounds；旧外壳没有 flyMove，supported=false，
      // 页面自动退回原地落地。具体实现见 flight-bridge.js。
      flight: createFlightBridge({
        shell: shell2,
        readGeometry,
        pigInWindow,
        rehome: function(win, pig, areas) {
          placement.rehome(win, pig, areas);
        },
        setFlying: function(on) {
          flying = on;
        },
        isFlying: function() {
          return flying;
        },
        clearSlide: function(slide) {
          dragSlide = { x: 0, y: 0 };
          const h = host2();
          commitSlide(h, measure.state, slide);
        },
        forgetLayout: function() {
          lastKey = null;
        },
        tick
      }),
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
    if (role === "ext") return;
    const h = host2();
    if (h !== null && typeof MutationObserver === "function") {
      new MutationObserver(schedule3).observe(h, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    window.addEventListener("resize", schedule3);
    window.addEventListener("pointerup", schedule3);
    setInterval(function() {
      if (!dragging() && !flying) tick();
    }, 1e3);
    tick();
  }
  var desktop = { version: DESKTOP_VERSION, install: install2, start };

  // src/client/drag-heartbeat.js
  function startDragHeartbeat(shell2, isDragging) {
    if (typeof shell2?.dragHeartbeat !== "function") return () => {
    };
    const timer2 = window.setInterval(() => {
      if (isDragging()) shell2.dragHeartbeat();
    }, 250);
    return () => window.clearInterval(timer2);
  }

  // src/client/feel/velocity.js
  function recentVelocity(samples, now2, options) {
    const tailMs = options?.tailMs ?? FEEL.throwTailMs;
    const idleMs = options?.idleMs ?? FEEL.throwIdleMs;
    if (!Array.isArray(samples) || samples.length < 2) return { vx: 0, vy: 0 };
    const last = samples[samples.length - 1];
    const previous = samples[samples.length - 2];
    if (!last || !previous || !Number.isFinite(last.t) || !Number.isFinite(previous.t)) return { vx: 0, vy: 0 };
    if (now2 - last.t > idleMs) return { vx: 0, vy: 0 };
    const dt = (last.t - previous.t) / 1e3;
    if (dt <= 0 || dt > tailMs / 1e3) return { vx: 0, vy: 0 };
    return { vx: (last.x - previous.x) / dt, vy: (last.y - previous.y) / dt };
  }

  // src/client/gestures.js
  function pointerScreen(event) {
    return {
      x: typeof event.screenX === "number" ? event.screenX : event.clientX,
      y: typeof event.screenY === "number" ? event.screenY : event.clientY
    };
  }
  function attachGestures(c) {
    let drag = null;
    let stopHeartbeat = function() {
    };
    function velocity() {
      if (drag === null) return { vx: 0, vy: 0 };
      return recentVelocity(drag.samples, performance.now());
    }
    function beginWindowDrag() {
      if (drag === null || drag.started) return;
      cancelPetSnap(c.pig);
      drag.started = true;
      drag.moved = true;
      const shell2 = c.desktopShell();
      if (shell2 !== null && typeof shell2.beginDrag === "function") {
        shell2.beginDrag({ x: drag.startScreenX, y: drag.startScreenY });
        stopHeartbeat = startDragHeartbeat(shell2, function() {
          return drag !== null && drag.started;
        });
      } else if (shell2 !== null) {
        drag.legacy = true;
        drag.lastX = drag.startX;
        drag.lastY = drag.startY;
      } else {
        drag.startClientX = drag.x;
        drag.startClientY = drag.y;
      }
      c.feel.setDragging(true);
    }
    function endDrag(release) {
      if (drag === null) return null;
      const info = drag;
      drag = null;
      stopHeartbeat();
      stopHeartbeat = function() {
      };
      if (info.started) c.desktopShell()?.endDrag?.(release ?? null);
      c.feel.setDragging(false);
      c.scene.removeAttribute("data-dragging");
      c.clampPig();
      if (!c.isDesktop) c.writePosition();
      c.fitPanel();
      return info.started ? info : null;
    }
    function onPointerDown(event) {
      if (event.button !== 0 || drag !== null) return;
      if (event.target?.closest?.(".dp-bubble,button,a,input,select,textarea,[role=button]")) return;
      stopHeartbeat();
      stopHeartbeat = function() {
      };
      const screen = pointerScreen(event);
      c.feel.catchFlight();
      c.feel.wake?.();
      if (c.getView().hatched === true) c.send("touch");
      const snap = beginPetSnap(c.pig);
      if (!snap) c.feel.press();
      unlockSound();
      drag = {
        x: event.clientX,
        y: event.clientY,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        startX: screen.x,
        startY: screen.y,
        startScreenX: screen.x,
        startScreenY: screen.y,
        lastScreenX: screen.x,
        lastScreenY: screen.y,
        lastX: screen.x,
        lastY: screen.y,
        // 用实际显示的位置（可能已被 clampPig 夹过），不是用户设的原始值。
        right: parseFloat(getComputedStyle(c.host).right) || c.getRight(),
        bottom: parseFloat(getComputedStyle(c.host).bottom) || c.getBottom(),
        snap,
        moved: false,
        started: false,
        lifted: false,
        patted: false,
        legacy: false,
        path: 0,
        pathStart: performance.now(),
        lastStroke: 0,
        samples: [{ t: performance.now(), x: screen.x, y: screen.y }]
      };
      c.scene.setAttribute("data-dragging", "true");
      c.scene.setPointerCapture?.(event.pointerId);
    }
    function onPointerMove(event) {
      if (drag === null) return;
      const screen = pointerScreen(event);
      const now2 = performance.now();
      const net = Math.hypot(screen.x - drag.startX, screen.y - drag.startY);
      drag.lastClientX = event.clientX;
      drag.lastClientY = event.clientY;
      drag.samples.push({ t: now2, x: screen.x, y: screen.y });
      while (drag.samples.length > 16 || drag.samples.length > 2 && now2 - drag.samples[0].t > 240) drag.samples.shift();
      if (!drag.started && net < FEEL.dragPx) {
        const step = Math.hypot(screen.x - drag.lastScreenX, screen.y - drag.lastScreenY);
        drag.lastScreenX = screen.x;
        drag.lastScreenY = screen.y;
        if (now2 - drag.pathStart > FEEL.strokeWindowMs) {
          drag.path = 0;
          drag.pathStart = now2;
        }
        drag.path += step;
        if (drag.path >= FEEL.strokePx && now2 - drag.lastStroke > FEEL.strokeCooldownMs) {
          drag.path = 0;
          drag.pathStart = now2;
          drag.lastStroke = now2;
          drag.patted = true;
          playSound("purr");
          const view = c.getView();
          if (view.hatched === true && !view.dead) c.send("pet", { part: partAt(c.pig, event) }, { petAnimated: drag.snap });
        }
        return;
      }
      if (!drag.started) {
        beginWindowDrag();
        drag.lastScreenX = screen.x;
        drag.lastScreenY = screen.y;
      }
      if (net > FEEL.liftPx && !drag.lifted) {
        drag.lifted = true;
        c.feel.lift();
      }
      const speed = velocity();
      c.feel.move(speed.vx);
      const shell2 = c.desktopShell();
      if (shell2 !== null) {
        if (typeof shell2.beginDrag === "function") shell2.dragHeartbeat?.();
        else if (typeof shell2.moveBy === "function" && drag.legacy) {
          const stepX = screen.x - drag.lastX;
          const stepY = screen.y - drag.lastY;
          drag.lastX = screen.x;
          drag.lastY = screen.y;
          if (stepX !== 0 || stepY !== 0) shell2.moveBy(stepX, stepY);
        }
        return;
      }
      c.setRight(drag.right - (event.clientX - drag.startClientX));
      c.setBottom(drag.bottom - (event.clientY - drag.startClientY));
      c.clampPig();
      c.fitPanel();
    }
    function onPointerUp(event) {
      if (drag === null) return;
      const speed = c.isPanelOpen?.() === true ? { vx: 0, vy: 0 } : velocity();
      const started = drag.started;
      const patted = drag.patted;
      const snap = drag.snap;
      endDrag(pointerScreen(event));
      if (started) {
        c.feel.release({ vx: speed.vx, vy: speed.vy, dragged: true });
        return;
      }
      const view = c.getView();
      if (view.hatched !== true) {
        c.pokeBox();
        c.feel.release({ vx: 0, vy: 0 });
        return;
      }
      if (snap) releasePetSnap(c.pig);
      if (!patted && !view.dead) c.send("pet", { part: partAt(c.pig, event) }, { petAnimated: snap });
      if (!snap) c.feel.release({ vx: 0, vy: 0 });
    }
    function onPointerCancel() {
      if (drag === null) return;
      const started = drag.started;
      cancelPetSnap(c.pig);
      endDrag();
      c.feel.release({ vx: 0, vy: 0, dragged: started });
    }
    c.scene.addEventListener("pointerdown", onPointerDown);
    c.scene.addEventListener("pointermove", onPointerMove);
    c.scene.addEventListener("pointerup", onPointerUp);
    c.scene.addEventListener("pointercancel", onPointerCancel);
    c.scene.addEventListener("lostpointercapture", onPointerCancel);
    return {
      isDragging: function() {
        return drag !== null;
      },
      dispose: function() {
        c.scene.removeEventListener("pointerdown", onPointerDown);
        c.scene.removeEventListener("pointermove", onPointerMove);
        c.scene.removeEventListener("pointerup", onPointerUp);
        c.scene.removeEventListener("pointercancel", onPointerCancel);
        c.scene.removeEventListener("lostpointercapture", onPointerCancel);
        stopHeartbeat();
        drag = null;
      }
    };
  }

  // src/client/feel/dizzy.js
  function createDizzy(c) {
    let timer2 = null;
    let disposed = false;
    function healthyPiglet() {
      const stage2 = c.pig.getAttribute("data-stage") || "";
      const mood = c.pig.getAttribute("data-mood") || "";
      return (c.pig.getAttribute("data-art") || "") === "piglet" && !c.pig.getAttribute("data-illness") && stage2 !== "box" && stage2 !== "grave" && stage2 !== "dead-day" && mood !== "sick" && mood !== "dead";
    }
    function cancel() {
      if (c.pig.getAttribute("data-react") !== "dizzy") return;
      c.pig.removeAttribute("data-react");
      clearEffectArt();
      syncPigArt(c.pig, c.pigArt, c.pigEmoji);
    }
    function trigger() {
      if (disposed) return;
      if (timer2 !== null) clearTimeout(timer2);
      if (healthyPiglet()) showEffectArt("faint");
      c.pig.setAttribute("data-react", "dizzy");
      syncPigArt(c.pig, c.pigArt, c.pigEmoji);
      c.burst(["\u{1F4AB}", "\u2728", "\u{1F4AB}"], 3);
      playSound("dizzy", { soft: c.getMode() === "soft" });
      timer2 = setTimeout(function() {
        timer2 = null;
        if (disposed) return;
        c.pig.removeAttribute("data-react");
        clearEffectArt();
        syncPigArt(c.pig, c.pigArt, c.pigEmoji);
      }, FEEL.dizzyMs);
    }
    return {
      trigger,
      cancel,
      dispose: function() {
        disposed = true;
        if (timer2 !== null) clearTimeout(timer2);
        timer2 = null;
      }
    };
  }

  // src/client/desktop/flight.js
  var STEP2 = 1 / 120;
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function createFlight(options) {
    const areas = options.areas?.length ? options.areas : [options.area];
    const area = options.area;
    const pig = options.pig;
    const artMargin = Number.isFinite(options.artMargin) ? options.artMargin : 0;
    const visual = options.visual;
    const left = visual ? (pig.x ?? 0) + pig.width / 2 - visual.x : pig.width / 2 + artMargin;
    const right = visual ? visual.x + visual.width - (pig.x ?? 0) - pig.width / 2 : pig.width / 2 + artMargin;
    const head = visual ? (pig.y ?? 0) + pig.height - visual.y : pig.height + 8;
    const foot = visual ? visual.y + visual.height - (pig.y ?? 0) - pig.height : 0;
    const reach = Math.min(area.width / 2, Math.max(left, right));
    const horizontal = (x2, y2) => drawingCorridor(areas, true, y2 - head, y2 + foot, reach, reach, x2);
    const vertical = (x2, y2) => drawingCorridor(areas, false, x2 - reach, x2 + reach, head, foot, y2);
    let x = options.x;
    let y = options.y;
    const initialY = vertical(x, y) ?? [area.y + head, area.y + area.height - foot];
    y = clamp(y, initialY[0], initialY[1]);
    const initialX = horizontal(x, y) ?? [area.x + reach, area.x + area.width - reach];
    x = clamp(x, initialX[0], initialX[1]);
    const floor = initialY[1];
    const speed = Math.hypot(options.vx, options.vy);
    const scale2 = speed > FEEL.throwMax ? FEEL.throwMax / speed : 1;
    let vx = options.vx * scale2;
    let vy = options.vy * scale2;
    if (y >= floor - 2 && speed >= FEEL.throwMin && vy > -60 && Math.abs(vy) < Math.abs(vx) * 0.8) {
      vy = -Math.max(260, Math.min(900, speed * 0.3));
    }
    let elapsed = 0;
    let accumulator = 0;
    let done = false;
    let landed = false;
    let events = [];
    function emit(event) {
      events.push(event);
    }
    function step(h) {
      if (FEEL.airDrag > 0) {
        const drag = Math.exp(-FEEL.airDrag * h);
        vx *= drag;
        vy *= drag;
      }
      vy += FEEL.gravity * h;
      const [left2, right2] = horizontal(x, y);
      x += vx * h;
      if (x < left2) {
        x = left2;
        if (vx < 0) {
          const impact = Math.abs(vx);
          vx = impact * FEEL.restitution;
          emit({ type: "bounce", speed: impact, side: "left" });
        }
      } else if (x > right2) {
        x = right2;
        if (vx > 0) {
          const impact = Math.abs(vx);
          vx = -impact * FEEL.restitution;
          emit({ type: "bounce", speed: impact, side: "right" });
        }
      }
      const [ceiling, floor2] = vertical(x, y);
      y += vy * h;
      if (y < ceiling) {
        y = ceiling;
        if (vy < 0) {
          const impact = Math.abs(vy);
          vy = impact * FEEL.restitution;
          emit({ type: "bounce", speed: impact, side: "top" });
        }
      }
      if (y >= floor2) {
        const impact = Math.abs(vy);
        y = floor2;
        if (impact >= FEEL.landVy && impact > 0) {
          vy = -impact * FEEL.restitution;
          vx *= FEEL.floorFriction;
          emit({ type: "bounce", speed: impact, side: "floor" });
          if (impact > FEEL.dizzyImpact) emit({ type: "dizzy", speed: impact });
        } else {
          vy = 0;
          vx = 0;
          if (!landed) {
            landed = true;
            done = true;
            emit({ type: "land", speed: impact });
            if (impact > FEEL.dizzyImpact) emit({ type: "dizzy", speed: impact });
          }
        }
      }
    }
    return {
      advance(dtMs) {
        events = [];
        if (done) return events;
        const dt = Math.max(0, Math.min(50, Number(dtMs) || 0)) / 1e3;
        accumulator += dt;
        while (accumulator >= STEP2) {
          step(STEP2);
          accumulator -= STEP2;
          elapsed += STEP2;
          if (done) break;
        }
        if (!done && elapsed >= FEEL.flightMaxMs / 1e3) {
          const impact = Math.abs(vy);
          done = true;
          landed = true;
          vx = 0;
          vy = 0;
          y = vertical(x, y)[1];
          emit({ type: "land", speed: impact });
          if (impact > FEEL.dizzyImpact) emit({ type: "dizzy", speed: impact });
        }
        return events;
      },
      stop() {
        done = true;
        vx = 0;
        vy = 0;
      },
      get x() {
        return x;
      },
      get y() {
        return y;
      },
      get vx() {
        return vx;
      },
      get vy() {
        return vy;
      },
      get elapsed() {
        return elapsed;
      },
      get done() {
        return done;
      },
      get landed() {
        return landed;
      },
      /** 落地挤压量：冲击越大压得越扁，0.04–0.18。 */
      impactFor(impact) {
        return clamp(0.04 + Math.max(0, impact) / 9e3, 0.04, FEEL.squashMax);
      },
      /** 落地尘土数量。 */
      dustFor(impact) {
        return clamp(Math.round(Math.max(0, impact) / 600), 1, 4);
      },
      bounds() {
        const [left2, right2] = horizontal(x, y);
        const [ceiling, floor2] = vertical(x, y);
        return { left: left2, right: right2, floor: floor2, ceiling };
      }
    };
  }

  // src/client/feel/flight-run.js
  function clamp2(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function createFlightRunner(c) {
    let state3 = null;
    function finish(result) {
      const current2 = state3;
      if (current2 === null) return;
      state3 = null;
      if (current2.raf) cancelAnimationFrame(current2.raf);
      try {
        current2.shell.flight.finish?.({
          window: current2.lastWindow,
          pig: current2.start.pig,
          slide: current2.slide,
          areas: current2.start.areas
        });
      } catch (error) {
        console.error("[dsh-piggy] \u629B\u63B7\u843D\u5730\u6536\u5C3E\u5931\u8D25", error);
      }
      c.host.style.translate = "";
      if (result !== null) c.onFinish(result);
    }
    function step(now2) {
      if (state3 === null) return;
      const current2 = state3;
      const dt = Math.min(50, Math.max(0, now2 - current2.lastTime));
      current2.lastTime = now2;
      const events = current2.body.advance(dt);
      let dizzy = current2.dizzy === true;
      let landSpeed = 0;
      for (const event of events) {
        if (event.type === "bounce") {
          c.onImpact(0.06 * current2.scale);
          c.onDust(clamp2(Math.round((event.speed || 0) / 800), 1, 3));
          c.onSound("bounce");
        } else if (event.type === "dizzy") {
          current2.dizzy = true;
          dizzy = true;
        } else if (event.type === "land") {
          landSpeed = event.speed || 0;
          c.onImpact(current2.body.impactFor(landSpeed) * current2.scale);
          c.onDust(current2.body.dustFor(landSpeed));
          c.onSound(landSpeed > 900 ? "land-hard" : "land-soft");
        }
      }
      c.onTilt(current2.body.vx);
      const width = current2.start.window.width;
      const height = current2.start.window.height;
      const local = current2.start.pig;
      const desiredX = current2.body.x - (local.x + local.width / 2);
      const desiredY = current2.body.y - (local.y + local.height);
      const clampedX = clamp2(desiredX, current2.viewport.x, Math.max(current2.viewport.x, current2.viewport.x + current2.viewport.width - width));
      const clampedY = clamp2(desiredY, current2.viewport.y, Math.max(current2.viewport.y, current2.viewport.y + current2.viewport.height - height));
      current2.slide = { x: desiredX - clampedX, y: desiredY - clampedY };
      current2.lastWindow = { x: clampedX, y: clampedY };
      current2.shell.flight.move?.(clampedX, clampedY, current2.slide);
      c.host.style.translate = current2.slide.x === 0 && current2.slide.y === 0 ? "" : current2.slide.x + "px " + current2.slide.y + "px";
      if (current2.body.done) {
        finish({ dizzy: dizzy || current2.body.landed && landSpeed > FEEL.dizzyImpact, speed: landSpeed });
        return;
      }
      current2.raf = requestAnimationFrame(step);
    }
    return {
      /** @param {number} vx @param {number} vy @param {number} [scale] */
      start: function(vx, vy, scale2) {
        const shell2 = c.getShell();
        if (shell2?.flight?.supported !== true) return false;
        const start2 = shell2.flight.start();
        if (start2 === null || start2 === void 0 || !start2.area) return false;
        const body = createFlight({
          x: start2.home.x,
          y: start2.home.y,
          vx,
          vy,
          area: start2.area,
          areas: start2.areas,
          pig: start2.pig,
          artMargin: artMarginFor(start2.pig.width),
          visual: start2.visual
        });
        state3 = {
          body,
          start: start2,
          shell: shell2,
          viewport: workAreaBounds(start2.areas, start2.area),
          lastWindow: { x: start2.window.x, y: start2.window.y },
          slide: { x: 0, y: 0 },
          raf: requestAnimationFrame(step),
          lastTime: performance.now(),
          scale: Number.isFinite(scale2) ? scale2 : 1,
          dizzy: false
        };
        shell2.flight.setFlying?.(true);
        c.onStart();
        c.onSound("toss");
        return true;
      },
      /** 空中接住：停住并重定家，不播放落地冲击。 */
      catch: function() {
        if (state3 === null) return false;
        state3.body.stop();
        finish(null);
        return true;
      },
      cancel: function() {
        if (state3 === null) return;
        state3.body.stop();
        finish(null);
      },
      isFlying: function() {
        return state3 !== null;
      },
      setScale: function(value) {
        if (state3 !== null) state3.scale = value;
      },
      dispose: function() {
        finish(null);
      }
    };
  }

  // ../../code/node_modules/motion-utils/dist/es/array.mjs
  function addUniqueItem(arr2, item) {
    if (arr2.indexOf(item) === -1)
      arr2.push(item);
  }
  function removeItem(arr2, item) {
    const index = arr2.indexOf(item);
    if (index > -1)
      arr2.splice(index, 1);
  }

  // ../../code/node_modules/motion-utils/dist/es/clamp.mjs
  var clamp3 = (min, max, v) => {
    if (v > max)
      return max;
    if (v < min)
      return min;
    return v;
  };

  // ../../code/node_modules/motion-utils/dist/es/format-error-message.mjs
  function formatErrorMessage(message2, errorCode) {
    return errorCode ? `${message2}. For more information and steps for solving, visit https://motion.dev/troubleshooting/${errorCode}` : message2;
  }

  // ../../code/node_modules/motion-utils/dist/es/errors.mjs
  var warning = () => {
  };
  var invariant = () => {
  };
  if (typeof process !== "undefined" && true) {
    warning = (check, message2, errorCode) => {
      if (!check && typeof console !== "undefined") {
        console.warn(formatErrorMessage(message2, errorCode));
      }
    };
    invariant = (check, message2, errorCode) => {
      if (!check) {
        throw new Error(formatErrorMessage(message2, errorCode));
      }
    };
  }

  // ../../code/node_modules/motion-utils/dist/es/global-config.mjs
  var MotionGlobalConfig = {};

  // ../../code/node_modules/motion-utils/dist/es/is-numerical-string.mjs
  var isNumericalString = (v) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(v);

  // ../../code/node_modules/motion-utils/dist/es/is-object.mjs
  var isObject = (value) => typeof value === "object" && value !== null;

  // ../../code/node_modules/motion-utils/dist/es/is-zero-value-string.mjs
  var isZeroValueString = (v) => /^0[^.\s]+$/u.test(v);

  // ../../code/node_modules/motion-utils/dist/es/memo.mjs
  // @__NO_SIDE_EFFECTS__
  function memo(callback) {
    let result;
    return () => {
      if (result === void 0)
        result = callback();
      return result;
    };
  }

  // ../../code/node_modules/motion-utils/dist/es/noop.mjs
  var noop = /* @__NO_SIDE_EFFECTS__ */ (any) => any;

  // ../../code/node_modules/motion-utils/dist/es/pipe.mjs
  var pipe = (...transformers) => transformers.reduce((a, b) => (v) => b(a(v)));

  // ../../code/node_modules/motion-utils/dist/es/progress.mjs
  var progress = /* @__NO_SIDE_EFFECTS__ */ (from, to, value) => {
    const range = to - from;
    return range ? (value - from) / range : 1;
  };

  // ../../code/node_modules/motion-utils/dist/es/subscription-manager.mjs
  var SubscriptionManager = class {
    constructor() {
      this.subscriptions = [];
    }
    add(handler) {
      addUniqueItem(this.subscriptions, handler);
      return () => this.remove(handler);
    }
    remove(handler) {
      removeItem(this.subscriptions, handler);
    }
    notify(a, b, c) {
      const numSubscriptions = this.subscriptions.length;
      if (!numSubscriptions)
        return;
      if (numSubscriptions === 1) {
        this.subscriptions[0](a, b, c);
      } else {
        for (let i = 0; i < numSubscriptions; i++) {
          const handler = this.subscriptions[i];
          handler && handler(a, b, c);
        }
      }
    }
    getSize() {
      return this.subscriptions.length;
    }
    clear() {
      this.subscriptions.length = 0;
    }
  };

  // ../../code/node_modules/motion-utils/dist/es/time-conversion.mjs
  var secondsToMilliseconds = /* @__NO_SIDE_EFFECTS__ */ (seconds) => seconds * 1e3;
  var millisecondsToSeconds = /* @__NO_SIDE_EFFECTS__ */ (milliseconds) => milliseconds / 1e3;

  // ../../code/node_modules/motion-utils/dist/es/velocity-per-second.mjs
  var velocityPerSecond = /* @__NO_SIDE_EFFECTS__ */ (velocity, frameDuration) => frameDuration ? velocity * (1e3 / frameDuration) : 0;

  // ../../code/node_modules/motion-utils/dist/es/warn-once.mjs
  var warned = /* @__PURE__ */ new Set();
  function warnOnce(condition, message2, errorCode) {
    if (condition || warned.has(message2))
      return;
    console.warn(formatErrorMessage(message2, errorCode));
    warned.add(message2);
  }

  // ../../code/node_modules/motion-utils/dist/es/wrap.mjs
  var wrap = (min, max, v) => {
    const rangeSize = max - min;
    return ((v - min) % rangeSize + rangeSize) % rangeSize + min;
  };

  // ../../code/node_modules/motion-utils/dist/es/easing/cubic-bezier.mjs
  var calcBezier = (t, a1, a2) => t * (3 * (1 - t) * ((1 - t) * a1 + t * a2) + t * t);
  // @__NO_SIDE_EFFECTS__
  function cubicBezier(mX1, mY1, mX2, mY2) {
    if (mX1 === mY1 && mX2 === mY2)
      return noop;
    return (x) => {
      let lowerBound = 0;
      let upperBound = 1;
      let t = x;
      for (let i = 0; ; i++) {
        if (!(t >= lowerBound && t <= upperBound)) {
          t = (lowerBound + upperBound) / 2;
        }
        const currentX = calcBezier(t, mX1, mX2) - x;
        if (currentX * currentX < 1e-28 || i === 40)
          break;
        currentX > 0 ? upperBound = t : lowerBound = t;
        t -= currentX * 1e-7 / (calcBezier(t + 1e-7, mX1, mX2) - x - currentX);
      }
      return calcBezier(t, mY1, mY2);
    };
  }

  // ../../code/node_modules/motion-utils/dist/es/easing/modifiers/mirror.mjs
  var mirrorEasing = /* @__NO_SIDE_EFFECTS__ */ (easing) => (p) => p <= 0.5 ? easing(2 * p) / 2 : (2 - easing(2 * (1 - p))) / 2;

  // ../../code/node_modules/motion-utils/dist/es/easing/modifiers/reverse.mjs
  var reverseEasing = /* @__NO_SIDE_EFFECTS__ */ (easing) => (p) => 1 - easing(1 - p);

  // ../../code/node_modules/motion-utils/dist/es/easing/back.mjs
  var backOut = /* @__PURE__ */ cubicBezier(0.33, 1.53, 0.69, 0.99);
  var backIn = /* @__PURE__ */ reverseEasing(backOut);
  var backInOut = /* @__PURE__ */ mirrorEasing(backIn);

  // ../../code/node_modules/motion-utils/dist/es/easing/anticipate.mjs
  var anticipate = (p) => p >= 1 ? 1 : (p *= 2) < 1 ? 0.5 * backIn(p) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)));

  // ../../code/node_modules/motion-utils/dist/es/easing/circ.mjs
  var circIn = (p) => 1 - Math.sin(Math.acos(p));
  var circOut = reverseEasing(circIn);
  var circInOut = mirrorEasing(circIn);

  // ../../code/node_modules/motion-utils/dist/es/easing/ease.mjs
  var easeIn = /* @__PURE__ */ cubicBezier(0.42, 0, 1, 1);
  var easeOut = /* @__PURE__ */ cubicBezier(0, 0, 0.58, 1);
  var easeInOut = /* @__PURE__ */ cubicBezier(0.42, 0, 0.58, 1);

  // ../../code/node_modules/motion-utils/dist/es/easing/utils/is-easing-array.mjs
  var isEasingArray = /* @__NO_SIDE_EFFECTS__ */ (ease2) => {
    return Array.isArray(ease2) && typeof ease2[0] !== "number";
  };

  // ../../code/node_modules/motion-utils/dist/es/easing/utils/get-easing-for-segment.mjs
  // @__NO_SIDE_EFFECTS__
  function getEasingForSegment(easing, i) {
    return isEasingArray(easing) ? easing[wrap(0, easing.length, i)] : easing;
  }

  // ../../code/node_modules/motion-utils/dist/es/easing/utils/is-bezier-definition.mjs
  var isBezierDefinition = /* @__NO_SIDE_EFFECTS__ */ (easing) => Array.isArray(easing) && typeof easing[0] === "number";

  // ../../code/node_modules/motion-utils/dist/es/easing/utils/map.mjs
  var easingLookup = {
    linear: noop,
    easeIn,
    easeInOut,
    easeOut,
    circIn,
    circInOut,
    circOut,
    backIn,
    backInOut,
    backOut,
    anticipate
  };
  var isValidEasing = (easing) => {
    return typeof easing === "string";
  };
  var easingDefinitionToFunction = (definition) => {
    if (isBezierDefinition(definition)) {
      invariant(definition.length === 4, `Cubic bezier arrays must contain four numerical values.`, "cubic-bezier-length");
      const [x1, y1, x2, y2] = definition;
      return cubicBezier(x1, y1, x2, y2);
    } else if (isValidEasing(definition)) {
      invariant(easingLookup[definition] !== void 0, `Invalid easing type '${definition}'`, "invalid-easing-type");
      return easingLookup[definition];
    }
    return definition;
  };

  // ../../code/node_modules/motion-dom/dist/es/frameloop/frame-data.mjs
  var frameData = {
    delta: 0,
    timestamp: 0,
    isProcessing: false
  };

  // ../../code/node_modules/motion-dom/dist/es/frameloop/sync-time.mjs
  var now;
  function clearTime() {
    now = void 0;
  }
  var time = {
    now: () => {
      if (now === void 0) {
        time.set(frameData.isProcessing || MotionGlobalConfig.useManualTiming ? frameData.timestamp : performance.now());
      }
      return now;
    },
    set: (newTime) => {
      now = newTime;
      queueMicrotask(clearTime);
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/sanitize.mjs
  var sanitize = (v) => Math.round(v * 1e5) / 1e5;

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/is-css-variable.mjs
  var checkStringStartsWith = (token) => (key2) => typeof key2 === "string" && key2.startsWith(token);
  var startsAsVariableToken = /* @__PURE__ */ checkStringStartsWith("var(--");
  var isCSSVariableToken = (value) => {
    const startsWithToken = startsAsVariableToken(value);
    if (!startsWithToken)
      return false;
    return singleCssVariableRegex.test(value.split("/*")[0].trim());
  };
  var singleCssVariableRegex = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
  function containsCSSVariable(value) {
    if (typeof value !== "string")
      return false;
    return value.split("/*")[0].includes("var(--");
  }

  // ../../code/node_modules/motion-dom/dist/es/value/types/numbers/index.mjs
  var number = {
    test: (v) => typeof v === "number",
    parse: parseFloat,
    transform: (v) => v
  };
  var alpha = {
    ...number,
    transform: (v) => clamp3(0, 1, v)
  };
  var scale = {
    ...number,
    default: 1
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/float-regex.mjs
  var floatRegex = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/is-nullish.mjs
  function isNullish(v) {
    return v == null;
  }

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/single-color-regex.mjs
  var singleColorRegex = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;

  // ../../code/node_modules/motion-dom/dist/es/value/types/color/utils.mjs
  var isColorString = (type, testProp) => (v) => {
    return Boolean(typeof v === "string" && singleColorRegex.test(v) && v.startsWith(type) || testProp && !isNullish(v) && Object.prototype.hasOwnProperty.call(v, testProp));
  };
  var splitColor = (aName, bName, cName) => (v) => {
    if (typeof v !== "string")
      return v;
    const [a, b, c, alpha2] = v.match(floatRegex);
    return {
      [aName]: parseFloat(a),
      [bName]: parseFloat(b),
      [cName]: parseFloat(c),
      alpha: alpha2 !== void 0 ? parseFloat(alpha2) : 1
    };
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/color/rgba.mjs
  var clampRgbUnit = (v) => clamp3(0, 255, v);
  var rgbUnit = {
    ...number,
    transform: (v) => Math.round(clampRgbUnit(v))
  };
  var rgba = {
    test: /* @__PURE__ */ isColorString("rgb", "red"),
    parse: /* @__PURE__ */ splitColor("red", "green", "blue"),
    transform: ({ red, green, blue, alpha: alpha$1 = 1 }) => "rgba(" + rgbUnit.transform(red) + ", " + rgbUnit.transform(green) + ", " + rgbUnit.transform(blue) + ", " + sanitize(alpha.transform(alpha$1)) + ")"
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/color/hex.mjs
  function parseHex(v) {
    let r = "";
    let g = "";
    let b = "";
    let a = "";
    if (v.length > 5) {
      r = v.substring(1, 3);
      g = v.substring(3, 5);
      b = v.substring(5, 7);
      a = v.substring(7, 9);
    } else {
      r = v.substring(1, 2);
      g = v.substring(2, 3);
      b = v.substring(3, 4);
      a = v.substring(4, 5);
      r += r;
      g += g;
      b += b;
      a += a;
    }
    return {
      red: parseInt(r, 16),
      green: parseInt(g, 16),
      blue: parseInt(b, 16),
      alpha: a ? parseInt(a, 16) / 255 : 1
    };
  }
  var hex = {
    test: /* @__PURE__ */ isColorString("#"),
    parse: parseHex,
    transform: rgba.transform
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/numbers/units.mjs
  var createUnitType = /* @__NO_SIDE_EFFECTS__ */ (unit) => ({
    test: (v) => typeof v === "string" && v.endsWith(unit) && v.split(" ").length === 1,
    parse: parseFloat,
    transform: (v) => `${v}${unit}`
  });
  var degrees = /* @__PURE__ */ createUnitType("deg");
  var percent = /* @__PURE__ */ createUnitType("%");
  var px = /* @__PURE__ */ createUnitType("px");
  var vh = /* @__PURE__ */ createUnitType("vh");
  var vw = /* @__PURE__ */ createUnitType("vw");
  var progressPercentage = /* @__PURE__ */ (() => ({
    ...percent,
    parse: (v) => percent.parse(v) / 100,
    transform: (v) => percent.transform(v * 100)
  }))();

  // ../../code/node_modules/motion-dom/dist/es/value/types/color/hsla.mjs
  var hsla = {
    test: /* @__PURE__ */ isColorString("hsl", "hue"),
    parse: /* @__PURE__ */ splitColor("hue", "saturation", "lightness"),
    transform: ({ hue, saturation, lightness, alpha: alpha$1 = 1 }) => {
      return "hsla(" + Math.round(hue) + ", " + percent.transform(sanitize(saturation)) + ", " + percent.transform(sanitize(lightness)) + ", " + sanitize(alpha.transform(alpha$1)) + ")";
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/color/index.mjs
  var color = {
    test: (v) => rgba.test(v) || hex.test(v) || hsla.test(v),
    parse: (v) => {
      if (rgba.test(v)) {
        return rgba.parse(v);
      } else if (hsla.test(v)) {
        return hsla.parse(v);
      } else {
        return hex.parse(v);
      }
    },
    transform: (v) => {
      return typeof v === "string" ? v : v.hasOwnProperty("red") ? rgba.transform(v) : hsla.transform(v);
    },
    getAnimatableNone: (v) => {
      const parsed = color.parse(v);
      parsed.alpha = 0;
      return color.transform(parsed);
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/color-regex.mjs
  var colorRegex = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;

  // ../../code/node_modules/motion-dom/dist/es/value/types/complex/index.mjs
  var hasFloat = /* @__PURE__ */ new RegExp(floatRegex.source);
  var hasColor = /* @__PURE__ */ new RegExp(colorRegex.source, "i");
  function test(v) {
    return isNaN(v) && typeof v === "string" && (hasFloat.test(v) || hasColor.test(v));
  }
  var NUMBER_TOKEN = "number";
  var COLOR_TOKEN = "color";
  var VAR_TOKEN = "var";
  var VAR_FUNCTION_TOKEN = "var(";
  var SPLIT_TOKEN = "${}";
  var complexRegex = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)(?![a-z]*\()/giu;
  function hasComplexValues(value) {
    const asString = value.toString();
    return hasFloat.test(asString) || hasColor.test(asString);
  }
  function analyseComplexValue(value) {
    const originalValue = value.toString();
    const values = [];
    const indexes = {
      color: [],
      number: [],
      var: []
    };
    const types = [];
    let i = 0;
    const tokenised = originalValue.replace(complexRegex, (parsedValue) => {
      if (color.test(parsedValue)) {
        indexes.color.push(i);
        types.push(COLOR_TOKEN);
        values.push(color.parse(parsedValue));
      } else if (parsedValue.startsWith(VAR_FUNCTION_TOKEN)) {
        indexes.var.push(i);
        types.push(VAR_TOKEN);
        values.push(parsedValue);
      } else {
        indexes.number.push(i);
        types.push(NUMBER_TOKEN);
        values.push(parseFloat(parsedValue));
      }
      ++i;
      return SPLIT_TOKEN;
    });
    const split = tokenised.split(SPLIT_TOKEN);
    return { values, split, indexes, types };
  }
  function parseComplexValue(v) {
    return analyseComplexValue(v).values;
  }
  function buildTransformer({ split, types }) {
    const numSections = split.length;
    return (v) => {
      let output = "";
      for (let i = 0; i < numSections; i++) {
        output += split[i];
        if (v[i] !== void 0) {
          const type = types[i];
          if (type === NUMBER_TOKEN) {
            output += sanitize(v[i]);
          } else if (type === COLOR_TOKEN) {
            output += color.transform(v[i]);
          } else {
            output += v[i];
          }
        }
      }
      return output;
    };
  }
  function createTransformer(source) {
    return buildTransformer(analyseComplexValue(source));
  }
  var convertNumbersToZero = (v) => typeof v === "number" ? 0 : color.test(v) ? color.getAnimatableNone(v) : v;
  var convertToZero = (value, splitBefore) => {
    if (typeof value === "number") {
      return splitBefore?.trim().endsWith("/") ? value : 0;
    }
    return convertNumbersToZero(value);
  };
  function getAnimatableNone(v) {
    const info = analyseComplexValue(v);
    const transformer = buildTransformer(info);
    return transformer(info.values.map((value, i) => convertToZero(value, info.split[i])));
  }
  var complex = {
    test,
    parse: parseComplexValue,
    createTransformer,
    getAnimatableNone
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/color/hsla-to-rgba.mjs
  function hueToRgb(p, q, t) {
    if (t < 0)
      t += 1;
    if (t > 1)
      t -= 1;
    if (t < 1 / 6)
      return p + (q - p) * 6 * t;
    if (t < 1 / 2)
      return q;
    if (t < 2 / 3)
      return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hslaToRgba({ hue, saturation, lightness, alpha: alpha2 }) {
    hue /= 360;
    saturation /= 100;
    lightness /= 100;
    let red = 0;
    let green = 0;
    let blue = 0;
    if (!saturation) {
      red = green = blue = lightness;
    } else {
      const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
      const p = 2 * lightness - q;
      red = hueToRgb(p, q, hue + 1 / 3);
      green = hueToRgb(p, q, hue);
      blue = hueToRgb(p, q, hue - 1 / 3);
    }
    return {
      red: Math.round(red * 255),
      green: Math.round(green * 255),
      blue: Math.round(blue * 255),
      alpha: alpha2
    };
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/mix/immediate.mjs
  function mixImmediate(a, b) {
    return (p) => p > 0 ? b : a;
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/mix/number.mjs
  var mixNumber = (from, to, progress2) => {
    return from + (to - from) * progress2;
  };

  // ../../code/node_modules/motion-dom/dist/es/utils/mix/color.mjs
  var mixLinearColor = (from, to, v) => {
    const fromExpo = from * from;
    const expo = v * (to * to - fromExpo) + fromExpo;
    return expo < 0 ? 0 : Math.sqrt(expo);
  };
  var colorTypes = [hex, rgba, hsla];
  var getColorType = (v) => colorTypes.find((type) => type.test(v));
  function asRGBA(color2) {
    const type = getColorType(color2);
    if (!type) {
      warning(false, `'${color2}' is not an animatable color. Use the equivalent color code instead.`, "color-not-animatable");
      return false;
    }
    let model = type.parse(color2);
    if (type === hsla) {
      model = hslaToRgba(model);
    }
    return model;
  }
  var mixColor = (from, to) => {
    const fromRGBA = asRGBA(from);
    const toRGBA = asRGBA(to);
    if (!fromRGBA || !toRGBA) {
      return mixImmediate(from, to);
    }
    const blended = { ...fromRGBA };
    return (v) => {
      blended.red = mixLinearColor(fromRGBA.red, toRGBA.red, v);
      blended.green = mixLinearColor(fromRGBA.green, toRGBA.green, v);
      blended.blue = mixLinearColor(fromRGBA.blue, toRGBA.blue, v);
      blended.alpha = mixNumber(fromRGBA.alpha, toRGBA.alpha, v);
      return rgba.transform(blended);
    };
  };

  // ../../code/node_modules/motion-dom/dist/es/utils/mix/visibility.mjs
  var invisibleValues = /* @__PURE__ */ new Set(["none", "hidden"]);
  function mixVisibility(origin, target) {
    if (invisibleValues.has(origin)) {
      return (p) => p <= 0 ? origin : target;
    } else {
      return (p) => p >= 1 ? target : origin;
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/mix/complex.mjs
  function mixNumber2(a, b) {
    return (p) => mixNumber(a, b, p);
  }
  function getMixer(a) {
    if (typeof a === "number") {
      return mixNumber2;
    } else if (typeof a === "string") {
      return isCSSVariableToken(a) ? mixImmediate : color.test(a) ? mixColor : mixComplex;
    } else if (Array.isArray(a)) {
      return mixArray;
    } else if (typeof a === "object") {
      return color.test(a) ? mixColor : mixObject;
    }
    return mixImmediate;
  }
  function mixArray(a, b) {
    const output = [...a];
    const numValues = output.length;
    const blendValue = a.map((v, i) => getMixer(v)(v, b[i]));
    return (p) => {
      for (let i = 0; i < numValues; i++) {
        output[i] = blendValue[i](p);
      }
      return output;
    };
  }
  function mixObject(a, b) {
    const output = { ...a, ...b };
    const blendValue = {};
    for (const key2 in output) {
      if (a[key2] !== void 0 && b[key2] !== void 0) {
        blendValue[key2] = getMixer(a[key2])(a[key2], b[key2]);
      }
    }
    return (v) => {
      for (const key2 in blendValue) {
        output[key2] = blendValue[key2](v);
      }
      return output;
    };
  }
  function matchOrder(origin, target) {
    const orderedOrigin = [];
    const pointers = { color: 0, var: 0, number: 0 };
    for (let i = 0; i < target.values.length; i++) {
      const type = target.types[i];
      const originIndex = origin.indexes[type][pointers[type]];
      const originValue = origin.values[originIndex] ?? 0;
      orderedOrigin[i] = originValue;
      pointers[type]++;
    }
    return orderedOrigin;
  }
  var mixComplex = (origin, target) => {
    const template = complex.createTransformer(target);
    const originStats = analyseComplexValue(origin);
    const targetStats = analyseComplexValue(target);
    const canInterpolate = originStats.indexes.var.length === targetStats.indexes.var.length && originStats.indexes.color.length === targetStats.indexes.color.length && originStats.indexes.number.length >= targetStats.indexes.number.length;
    if (canInterpolate) {
      if (invisibleValues.has(origin) && !targetStats.values.length || invisibleValues.has(target) && !originStats.values.length) {
        return mixVisibility(origin, target);
      }
      return pipe(mixArray(matchOrder(originStats, targetStats), targetStats.values), template);
    } else {
      warning(true, `Complex values '${origin}' and '${target}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`, "complex-values-different");
      return mixImmediate(origin, target);
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/utils/mix/index.mjs
  var unitValue = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
  function mixUnit(from, to) {
    const a = unitValue.exec(from);
    if (!a)
      return;
    const b = unitValue.exec(to);
    if (!b || a[2] !== b[2])
      return;
    const unit = a[2];
    const origin = parseFloat(a[1]);
    const target = parseFloat(b[1]);
    return (p) => sanitize(mixNumber(origin, target, p)) + unit;
  }
  function mix(from, to, p) {
    if (typeof from === "number" && typeof to === "number" && typeof p === "number") {
      return mixNumber(from, to, p);
    }
    if (typeof from === "string" && typeof to === "string") {
      const mixer2 = mixUnit(from, to);
      if (mixer2)
        return mixer2;
    }
    const mixer = getMixer(from);
    return mixer(from, to);
  }

  // ../../code/node_modules/motion-dom/dist/es/frameloop/order.mjs
  var stepsOrder = [
    "setup",
    // Compute
    "read",
    // Read
    "resolveKeyframes",
    // Write/Read/Write/Read
    "preUpdate",
    // Compute
    "update",
    // Compute
    "preRender",
    // Compute
    "render",
    // Write
    "postRender"
    // Compute
  ];

  // ../../code/node_modules/motion-dom/dist/es/frameloop/render-step.mjs
  function createRenderStep(runNextFrame) {
    let thisFrame = /* @__PURE__ */ new Set();
    let nextFrame = /* @__PURE__ */ new Set();
    let isProcessing = false;
    let flushNextFrame = false;
    const toKeepAlive = /* @__PURE__ */ new Set();
    let latestFrameData = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    function triggerCallback(callback) {
      if (toKeepAlive.has(callback)) {
        nextFrame.add(callback);
        runNextFrame();
      }
      callback(latestFrameData);
    }
    const step = {
      /**
       * Schedule a process to run on the next frame.
       */
      schedule: (callback, keepAlive = false, immediate = false) => {
        const addToCurrentFrame = immediate && isProcessing;
        const queue = addToCurrentFrame ? thisFrame : nextFrame;
        if (keepAlive)
          toKeepAlive.add(callback);
        queue.add(callback);
        return callback;
      },
      /**
       * Cancel the provided callback from running on the next frame.
       */
      cancel: (callback) => {
        nextFrame.delete(callback);
        toKeepAlive.delete(callback);
      },
      /**
       * Execute all schedule callbacks.
       */
      process: (frameData2) => {
        latestFrameData = frameData2;
        if (isProcessing) {
          flushNextFrame = true;
          return;
        }
        isProcessing = true;
        const prevFrame = thisFrame;
        thisFrame = nextFrame;
        nextFrame = prevFrame;
        thisFrame.forEach(triggerCallback);
        thisFrame.clear();
        isProcessing = false;
        if (flushNextFrame) {
          flushNextFrame = false;
          step.process(frameData2);
        }
      }
    };
    return step;
  }

  // ../../code/node_modules/motion-dom/dist/es/frameloop/batcher.mjs
  var maxElapsed = 40;
  function createRenderBatcher(scheduleNextBatch, allowKeepAlive, state3 = {
    delta: 0,
    timestamp: 0,
    isProcessing: false
  }) {
    let runNextFrame = false;
    let useDefaultElapsed = true;
    const flagRunNextFrame = () => runNextFrame = true;
    const steps = stepsOrder.reduce((acc, key2) => {
      acc[key2] = createRenderStep(flagRunNextFrame);
      return acc;
    }, {});
    const { setup, read: read2, resolveKeyframes, preUpdate, update, preRender, render, postRender } = steps;
    const processBatch = () => {
      const useManualTiming = MotionGlobalConfig.useManualTiming;
      const timestamp = useManualTiming ? state3.timestamp : performance.now();
      runNextFrame = false;
      if (!useManualTiming) {
        state3.delta = useDefaultElapsed ? 1e3 / 60 : Math.max(Math.min(timestamp - state3.timestamp, maxElapsed), 1);
      }
      state3.timestamp = timestamp;
      state3.isProcessing = true;
      setup.process(state3);
      read2.process(state3);
      resolveKeyframes.process(state3);
      preUpdate.process(state3);
      update.process(state3);
      preRender.process(state3);
      render.process(state3);
      postRender.process(state3);
      state3.isProcessing = false;
      if (runNextFrame && allowKeepAlive) {
        useDefaultElapsed = false;
        scheduleNextBatch(processBatch);
      }
    };
    const wake = () => {
      runNextFrame = true;
      useDefaultElapsed = true;
      if (!state3.isProcessing) {
        scheduleNextBatch(processBatch);
      }
    };
    const schedule4 = stepsOrder.reduce((acc, key2) => {
      const step = steps[key2];
      acc[key2] = (process2, keepAlive = false, immediate = false) => {
        if (!runNextFrame)
          wake();
        return step.schedule(process2, keepAlive, immediate);
      };
      return acc;
    }, {});
    const cancel = (process2) => {
      for (let i = 0; i < stepsOrder.length; i++) {
        steps[stepsOrder[i]].cancel(process2);
      }
    };
    return { schedule: schedule4, cancel, state: state3, steps };
  }

  // ../../code/node_modules/motion-dom/dist/es/frameloop/frame.mjs
  var { schedule: frame2, cancel: cancelFrame, steps: frameSteps } = /* @__PURE__ */ createRenderBatcher(typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop, true, frameData);

  // ../../code/node_modules/motion-dom/dist/es/animation/drivers/frame.mjs
  var frameloopDriver = (update) => {
    const passTimestamp = ({ timestamp }) => update(timestamp);
    return {
      start: (keepAlive = true) => frame2.update(passTimestamp, keepAlive),
      stop: () => cancelFrame(passTimestamp),
      /**
       * If we're processing this frame we can use the
       * framelocked timestamp to keep things in sync.
       */
      now: () => frameData.isProcessing ? frameData.timestamp : time.now()
    };
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/utils/linear.mjs
  var generateLinearEasing = (easing, duration, resolution = 10) => {
    let points = "";
    const numPoints = Math.max(Math.round(duration / resolution), 2);
    for (let i = 0; i < numPoints; i++) {
      points += Math.round(easing(i / (numPoints - 1)) * 1e4) / 1e4 + ", ";
    }
    return `linear(${points.substring(0, points.length - 2)})`;
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/utils/calc-duration.mjs
  var maxGeneratorDuration = 2e4;
  function calcGeneratorDuration(generator, timeStep = 50, maxDuration = maxGeneratorDuration, keyframes2) {
    let duration = 0;
    let state3 = generator.next(duration);
    keyframes2?.push(state3.value);
    while (!state3.done && duration < maxDuration) {
      duration += timeStep;
      state3 = generator.next(duration);
      keyframes2?.push(state3.value);
    }
    return duration >= maxDuration ? Infinity : duration;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/utils/create-generator-easing.mjs
  function createGeneratorEasing(options, scale2 = 100, createGenerator) {
    const { keyframes: k, velocity: v } = options;
    const delta = k && k[k.length - 1] - k[0];
    const generator = createGenerator({
      ...options,
      velocity: v && delta ? v * scale2 / delta : v,
      keyframes: [0, scale2]
    });
    const duration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration);
    return {
      type: "keyframes",
      ease: (progress2) => {
        return generator.next(duration * progress2).value / scale2;
      },
      duration: millisecondsToSeconds(duration)
    };
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/spring.mjs
  var springDefaults = {
    // Default spring physics
    stiffness: 100,
    damping: 10,
    mass: 1,
    // Default duration/bounce-based options
    duration: 800,
    // in ms
    bounce: 0.3,
    visualDuration: 0.3,
    // in seconds
    // Rest thresholds
    restSpeed: {
      granular: 0.01,
      default: 2
    },
    restDelta: {
      granular: 5e-3,
      default: 0.5
    },
    // Limits
    minDuration: 0.01,
    // in seconds
    maxDuration: 10,
    // in seconds
    minDamping: 0.05
  };
  var bounceToDampingRatio = (bounce) => bounce < 0 ? 1 / Math.max(1 + bounce, springDefaults.minDamping) : Math.max(1 - bounce, springDefaults.minDamping);
  function overdampedFreqScale(dampingRatio, criticalFreqTime) {
    if (!(dampingRatio > 1))
      return 1;
    const root = Math.sqrt(dampingRatio * dampingRatio - 1);
    const slow = dampingRatio - root;
    const fast = dampingRatio + root;
    const target = 2 * root * Math.exp(-criticalFreqTime) * (1 + criticalFreqTime);
    return approximateRoot((freqTime) => fast * Math.exp(-slow * freqTime) - slow * Math.exp(-fast * freqTime) - target, (freqTime) => Math.exp(-fast * freqTime) - Math.exp(-slow * freqTime), criticalFreqTime) / criticalFreqTime;
  }
  function calcAngularFreq(undampedFreq, dampingRatio) {
    return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
  }
  var rootIterations = 12;
  function approximateRoot(envelope, derivative, initialGuess) {
    let result = initialGuess;
    for (let i = 1; i < rootIterations; i++) {
      result = result - envelope(result) / derivative(result);
    }
    return result;
  }
  var safeMin = 1e-3;
  function findSpring({ duration = springDefaults.duration, bounce = springDefaults.bounce }) {
    let envelope;
    let derivative;
    warning(duration <= secondsToMilliseconds(springDefaults.maxDuration), "Spring duration must be 10 seconds or less", "spring-duration-limit");
    const dampingRatio = bounceToDampingRatio(bounce);
    duration = clamp3(springDefaults.minDuration, springDefaults.maxDuration, millisecondsToSeconds(duration));
    if (dampingRatio < 1) {
      envelope = (undampedFreq2) => {
        const exponentialDecay = undampedFreq2 * dampingRatio;
        const delta = exponentialDecay * duration;
        const b = calcAngularFreq(undampedFreq2, dampingRatio);
        const c = Math.exp(-delta);
        return safeMin - exponentialDecay / b * c;
      };
      derivative = (undampedFreq2) => {
        const exponentialDecay = undampedFreq2 * dampingRatio;
        const delta = exponentialDecay * duration;
        const e = dampingRatio * dampingRatio * undampedFreq2 * undampedFreq2 * duration;
        const f = Math.exp(-delta);
        const g = calcAngularFreq(undampedFreq2 * undampedFreq2, dampingRatio);
        const factor = -envelope(undampedFreq2) + safeMin > 0 ? -1 : 1;
        return factor * -e * f / g;
      };
    } else {
      envelope = (undampedFreq2) => {
        const a = Math.exp(-undampedFreq2 * duration);
        const b = undampedFreq2 * duration + 1;
        return -safeMin + a * b;
      };
      derivative = (undampedFreq2) => {
        const a = Math.exp(-undampedFreq2 * duration);
        const b = -undampedFreq2 * (duration * duration);
        return a * b;
      };
    }
    const initialGuess = 5 / duration;
    const criticalFreq = approximateRoot(envelope, derivative, initialGuess);
    const undampedFreq = criticalFreq * overdampedFreqScale(dampingRatio, criticalFreq * duration);
    const stiffness = undampedFreq * undampedFreq;
    return {
      stiffness,
      damping: dampingRatio * 2 * Math.sqrt(stiffness),
      duration: secondsToMilliseconds(duration)
    };
  }
  var isValidPhysics = (value, canBeZero) => (canBeZero ? value >= 0 : value > 0) && value < Infinity;
  function resolvePhysics(value, canBeZero) {
    if (isValidPhysics(value, canBeZero))
      return value;
    if (true) {
      warning(value === void 0, "Spring stiffness and mass must be positive, damping 0 or greater", "spring-invalid-physics");
    }
    return void 0;
  }
  function getSpringOptions(options) {
    const validStiffness = resolvePhysics(options.stiffness);
    const validDamping = resolvePhysics(options.damping, true);
    const validMass = resolvePhysics(options.mass);
    const springOptions = {
      ...options,
      stiffness: validStiffness ?? springDefaults.stiffness,
      damping: validDamping ?? springDefaults.damping,
      mass: validMass ?? springDefaults.mass,
      isResolvedFromDuration: false,
      // stiffness/damping/mass overrides duration/bounce
      isTimeDefined: (validStiffness ?? validDamping ?? validMass) === void 0 && (options.duration !== void 0 || options.bounce !== void 0)
    };
    if (springOptions.isTimeDefined) {
      if (options.visualDuration) {
        const dampingRatio = bounceToDampingRatio(options.bounce || 0);
        const root = 2 * Math.PI / (options.visualDuration * 1.2) * overdampedFreqScale(dampingRatio, 2 * Math.PI / 1.2);
        springOptions.stiffness = root * root;
        springOptions.damping = 2 * dampingRatio * Math.sqrt(springOptions.stiffness);
      } else {
        Object.assign(springOptions, findSpring(springOptions));
        springOptions.isResolvedFromDuration = true;
      }
      if (!isValidPhysics(springOptions.stiffness) || !isValidPhysics(springOptions.damping, true)) {
        springOptions.stiffness = springDefaults.stiffness;
        springOptions.damping = springDefaults.damping;
      }
    }
    return springOptions;
  }
  function spring(optionsOrVisualDuration = springDefaults.visualDuration, bounce = springDefaults.bounce) {
    const options = typeof optionsOrVisualDuration !== "object" ? {
      visualDuration: optionsOrVisualDuration,
      keyframes: [0, 1],
      bounce
    } : optionsOrVisualDuration;
    const origin = options.keyframes[0];
    const target = options.keyframes[options.keyframes.length - 1];
    const state3 = { done: false, value: origin };
    const { stiffness, damping, mass, duration, isResolvedFromDuration, isTimeDefined } = getSpringOptions({ ...options });
    const inheritVelocity = (velocity) => isTimeDefined ? 0 : -millisecondsToSeconds(velocity);
    const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
    const undampedAngularFreq = millisecondsToSeconds(Math.sqrt(stiffness / mass));
    const decay = dampingRatio * undampedAngularFreq;
    const s = {
      target,
      delta: target - origin,
      velocity: inheritVelocity(options.velocity || 0) || 0,
      restSpeed: 0,
      restDelta: 0
    };
    const setRestThresholds = () => {
      const isGranularScale = Math.abs(s.delta) < 5;
      s.restSpeed = options.restSpeed || (isGranularScale ? springDefaults.restSpeed.granular : springDefaults.restSpeed.default);
      s.restDelta = options.restDelta || (isGranularScale ? springDefaults.restDelta.granular : springDefaults.restDelta.default);
    };
    setRestThresholds();
    let resolveSpring;
    let resolveVelocity;
    let update;
    if (dampingRatio < 1) {
      const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
      const c = { A: 0, sinC: 0, cosC: 0, t: -1, env: 0, sin: 0, cos: 0 };
      update = () => {
        c.A = (s.velocity + decay * s.delta) / angularFreq;
        c.sinC = decay * c.A + s.delta * angularFreq;
        c.cosC = decay * s.delta - c.A * angularFreq;
      };
      const sample = (t) => {
        if (t !== c.t) {
          c.t = t;
          c.env = Math.exp(-decay * t);
          c.sin = Math.sin(angularFreq * t);
          c.cos = Math.cos(angularFreq * t);
        }
      };
      resolveSpring = (t) => {
        sample(t);
        return s.target - c.env * (c.A * c.sin + s.delta * c.cos);
      };
      resolveVelocity = (t) => {
        sample(t);
        return c.env * (c.sinC * c.sin + c.cosC * c.cos);
      };
    } else if (dampingRatio === 1) {
      resolveSpring = (t) => s.target - Math.exp(-undampedAngularFreq * t) * (s.delta + (s.velocity + undampedAngularFreq * s.delta) * t);
      const c = { C: 0 };
      update = () => {
        c.C = s.velocity + undampedAngularFreq * s.delta;
      };
      resolveVelocity = (t) => Math.exp(-undampedAngularFreq * t) * (undampedAngularFreq * c.C * t - s.velocity);
    } else {
      const dampedAngularFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
      const slow = decay - dampedAngularFreq;
      const fast = decay + dampedAngularFreq;
      const limit = isTimeDefined ? Infinity : 300 / dampedAngularFreq;
      const decayAt = (rate, t) => Math.exp(t > limit ? -rate * limit - decay * (t - limit) : -rate * t);
      const c = { S: 0, F: 0 };
      update = () => {
        const P = (s.velocity + decay * s.delta) / dampedAngularFreq;
        c.S = (s.delta + P) / 2;
        c.F = (s.delta - P) / 2;
      };
      resolveSpring = (t) => s.target - c.S * decayAt(slow, t) - c.F * decayAt(fast, t);
      resolveVelocity = (t) => slow * c.S * decayAt(slow, t) + fast * c.F * decayAt(fast, t);
    }
    update();
    const calculatedDuration = isResolvedFromDuration ? duration || null : null;
    const generator = {
      calculatedDuration,
      /**
       * Aim the spring at a new target from its current position and
       * velocity, reusing the resolved physics and closures.
       */
      retarget: (keyframes2, newVelocity) => {
        s.target = keyframes2[keyframes2.length - 1];
        s.delta = s.target - keyframes2[0];
        s.velocity = inheritVelocity(newVelocity);
        if (!(options.restSpeed && options.restDelta))
          setRestThresholds();
        generator.calculatedDuration = calculatedDuration;
        state3.done = false;
        update();
      },
      velocity: (t) => secondsToMilliseconds(resolveVelocity(t)),
      next: (t) => {
        const current2 = resolveSpring(t);
        if (!isResolvedFromDuration) {
          const currentVelocity = secondsToMilliseconds(resolveVelocity(t));
          state3.done = Math.abs(currentVelocity) <= s.restSpeed && Math.abs(s.target - current2) <= s.restDelta;
        } else {
          state3.done = t >= duration;
        }
        state3.value = state3.done ? s.target : current2;
        return state3;
      },
      toString: () => {
        const easingDuration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration);
        const easing = generateLinearEasing((progress2) => generator.next(easingDuration * progress2).value, easingDuration, 30);
        return easingDuration + "ms " + easing;
      },
      toTransition: () => {
      }
    };
    return generator;
  }
  spring.applyToOptions = (options) => {
    const generatorOptions = createGeneratorEasing(options, 100, spring);
    options.ease = generatorOptions.ease;
    options.duration = secondsToMilliseconds(generatorOptions.duration);
    options.type = "keyframes";
    return options;
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/inertia.mjs
  function inertia({ keyframes: keyframes2, velocity = 0, power = 0.8, timeConstant = 325, bounceDamping = 10, bounceStiffness = 500, modifyTarget, min, max, restDelta = 0.5, restSpeed }) {
    const origin = keyframes2[0];
    const state3 = {
      done: false,
      value: origin
    };
    const isOutOfBounds = (v) => v < min || v > max;
    const nearestBoundary = (v) => {
      if (min === void 0)
        return max;
      if (max === void 0)
        return min;
      return Math.abs(min - v) < Math.abs(max - v) ? min : max;
    };
    let amplitude = power * velocity;
    const ideal = origin + amplitude;
    const target = modifyTarget === void 0 ? ideal : modifyTarget(ideal);
    if (target !== ideal)
      amplitude = target - origin;
    const calcDelta = (t) => -amplitude * Math.exp(-t / timeConstant);
    const applyFriction = (t) => {
      const delta = calcDelta(t);
      state3.done = Math.abs(delta) <= restDelta;
      state3.value = state3.done ? target : target + delta;
    };
    let timeReachedBoundary;
    let spring$1;
    const checkCatchBoundary = (t) => {
      if (!isOutOfBounds(state3.value))
        return;
      timeReachedBoundary = t;
      spring$1 = spring({
        keyframes: [state3.value, nearestBoundary(state3.value)],
        /**
         * The friction curve is target + calcDelta(t), so its exact
         * derivative is -calcDelta(t) / timeConstant in units/ms,
         * converted here to the units/second expected by spring.
         */
        velocity: -calcDelta(t) / timeConstant * 1e3,
        damping: bounceDamping,
        stiffness: bounceStiffness,
        restDelta,
        restSpeed
      });
    };
    checkCatchBoundary(0);
    return {
      calculatedDuration: null,
      next: (t) => {
        let hasUpdatedFrame = false;
        if (!spring$1 && timeReachedBoundary === void 0) {
          hasUpdatedFrame = true;
          applyFriction(t);
          checkCatchBoundary(t);
        }
        if (timeReachedBoundary !== void 0 && t >= timeReachedBoundary) {
          return spring$1.next(t - timeReachedBoundary);
        } else {
          !hasUpdatedFrame && applyFriction(t);
          return state3;
        }
      }
    };
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/interpolate.mjs
  function createMixers(output, ease2, customMixer) {
    const mixers = [];
    const mixerFactory = customMixer || MotionGlobalConfig.mix || mix;
    const numMixers = output.length - 1;
    for (let i = 0; i < numMixers; i++) {
      let mixer = mixerFactory(output[i], output[i + 1]);
      if (ease2) {
        const easingFunction = Array.isArray(ease2) ? ease2[i] || noop : ease2;
        mixer = pipe(easingFunction, mixer);
      }
      mixers.push(mixer);
    }
    return mixers;
  }
  function interpolate(input, output, { clamp: isClamp = true, ease: ease2, mixer } = {}) {
    const inputLength = input.length;
    invariant(inputLength === output.length, "Both input and output ranges must be the same length", "range-length");
    if (inputLength === 1)
      return () => output[0];
    if (inputLength === 2 && output[0] === output[1])
      return () => output[1];
    const isZeroDeltaRange = input[0] === input[1];
    if (input[0] > input[inputLength - 1]) {
      input = [...input].reverse();
      output = [...output].reverse();
    }
    const mixers = createMixers(output, ease2, mixer);
    const numMixers = mixers.length;
    const interpolator = (v) => {
      if (isZeroDeltaRange && v < input[0])
        return output[0];
      let i = 0;
      if (numMixers > 1) {
        for (; i < input.length - 2; i++) {
          if (v < input[i + 1])
            break;
        }
      }
      const progressInRange = progress(input[i], input[i + 1], v);
      return mixers[i](progressInRange);
    };
    return isClamp ? (v) => interpolator(clamp3(input[0], input[inputLength - 1], v)) : interpolator;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/offsets/fill.mjs
  function fillOffset(offset, remaining) {
    const min = offset[offset.length - 1];
    for (let i = 1; i <= remaining; i++) {
      const offsetProgress = progress(0, remaining, i);
      offset.push(mixNumber(min, 1, offsetProgress));
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/offsets/default.mjs
  function defaultOffset(arr2) {
    const offset = [0];
    fillOffset(offset, arr2.length - 1);
    return offset;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/offsets/time.mjs
  function convertOffsetToTimes(offset, duration) {
    return offset.map((o) => o * duration);
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/keyframes.mjs
  function defaultEasing(values, easing) {
    return values.map(() => easing || easeInOut).splice(0, values.length - 1);
  }
  function keyframes({ duration = 300, keyframes: keyframeValues, times, ease: ease2 = "easeInOut" }) {
    const easingFunctions = isEasingArray(ease2) ? ease2.map(easingDefinitionToFunction) : easingDefinitionToFunction(ease2) || easeInOut;
    const state3 = {
      done: false,
      value: keyframeValues[0]
    };
    if (keyframeValues.length === 2 && !Array.isArray(easingFunctions) && (!times || times.length !== 2 || times[0] === 0 && times[1] === 1)) {
      const [origin, target] = keyframeValues;
      const mixer = origin === target ? void 0 : (MotionGlobalConfig.mix || mix)(origin, target);
      return {
        calculatedDuration: duration,
        next: (t) => {
          state3.value = mixer ? mixer(easingFunctions(duration > 0 ? clamp3(0, 1, t / duration) : 1)) : target;
          state3.done = t >= duration;
          return state3;
        }
      };
    }
    const absoluteTimes = convertOffsetToTimes(
      // Only use the provided offsets if they're the correct length
      // TODO Maybe we should warn here if there's a length mismatch
      times && times.length === keyframeValues.length ? times : defaultOffset(keyframeValues),
      duration
    );
    const mapTimeToKeyframe = interpolate(absoluteTimes, keyframeValues, {
      ease: Array.isArray(easingFunctions) ? easingFunctions : defaultEasing(keyframeValues, easingFunctions)
    });
    return {
      calculatedDuration: duration,
      next: (t) => {
        state3.value = mapTimeToKeyframe(t);
        state3.done = t >= duration;
        return state3;
      }
    };
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/utils/velocity.mjs
  var velocitySampleDuration = 5;
  function getGeneratorVelocity(resolveValue, t, current2) {
    const prevT = Math.max(t - velocitySampleDuration, 0);
    return velocityPerSecond(current2 - resolveValue(prevT), t - prevT);
  }
  function calcGeneratorVelocity(generator, t, initialVelocity = 0) {
    if (t <= 0)
      return initialVelocity;
    return generator.velocity ? generator.velocity(t) : getGeneratorVelocity((s) => generator.next(s).value, t, generator.next(t).value);
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/get-final.mjs
  var isNotNull = (value) => value !== null;
  function getFinalKeyframe(keyframes2, { repeat, repeatType = "loop" }, finalKeyframe, speed = 1) {
    const resolvedKeyframes = keyframes2.filter(isNotNull);
    const useFirstKeyframe = speed < 0 || repeat && repeatType !== "loop" && repeat % 2 === 1;
    const index = useFirstKeyframe ? 0 : resolvedKeyframes.length - 1;
    return !index || finalKeyframe === void 0 ? resolvedKeyframes[index] : finalKeyframe;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/replace-transition-type.mjs
  var transitionTypeMap = {
    decay: inertia,
    inertia,
    tween: keyframes,
    keyframes,
    spring
  };
  function replaceTransitionType(transition) {
    if (typeof transition.type === "string") {
      transition.type = transitionTypeMap[transition.type];
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/resolve-start-time.mjs
  var MAX_START_DELAY = 40;
  var resolveStartTime = (startTime, now2) => now2 - startTime > MAX_START_DELAY && !MotionGlobalConfig.useManualTiming ? now2 : startTime;

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/notify-inspector.mjs
  function baseRecord(kind, animation) {
    return {
      kind,
      animation,
      timestamp: time.now(),
      frameTimestamp: frameData.timestamp,
      frameIsProcessing: frameData.isProcessing
    };
  }
  function notifyAnimationStart(animation, options, transition) {
    const notify = globalThis.__MOTION_INSPECT__;
    if (!notify)
      return;
    try {
      notify({
        ...baseRecord("animation-start", animation),
        options: transition ? { ...options, ...transition } : options
      });
    } catch {
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/WithPromise.mjs
  var WithPromise = class {
    constructor() {
      this.isResolved = false;
    }
    get finished() {
      if (!this._finished) {
        this._finished = this.isResolved ? Promise.resolve() : new Promise((resolve) => {
          this._resolve = resolve;
        });
      }
      return this._finished;
    }
    updateFinished() {
      this._finished = this._resolve = void 0;
      this.isResolved = false;
    }
    notifyFinished() {
      this.isResolved = true;
      this._resolve?.();
    }
    /**
     * Allows the animation to be awaited.
     *
     * @deprecated Use `finished` instead.
     */
    then(onResolve, onReject) {
      return this.finished.then(onResolve, onReject);
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/JSAnimation.mjs
  var percentToProgress = (percent2) => percent2 / 100;
  var round2 = (value) => Math.round(value * 1e4) / 1e4;
  var JSAnimation = class extends WithPromise {
    constructor(options) {
      super();
      this.state = "idle";
      this.startTime = null;
      this.isStopped = false;
      this.currentTime = 0;
      this.holdTime = null;
      this.playbackSpeed = 1;
      this.delayState = {
        done: false,
        value: void 0
      };
      this.stop = () => {
        const { motionValue: motionValue2 } = this.options;
        if (motionValue2 && motionValue2.updatedAt !== time.now()) {
          this.tick(time.now());
        }
        this.isStopped = true;
        if (this.state === "idle")
          return;
        this.teardown();
        this.options.onStop?.();
      };
      this.options = options;
      this.initAnimation();
      this.play();
      if (options.autoplay === false)
        this.pause();
      notifyAnimationStart(this, this.options);
    }
    initAnimation() {
      const { options } = this;
      replaceTransitionType(options);
      const { type = keyframes, repeat = 0, repeatDelay = 0, repeatType, velocity = 0 } = options;
      let { keyframes: keyframes$1 } = options;
      const generatorFactory = type || keyframes;
      if (generatorFactory !== keyframes) {
        invariant(keyframes$1.length <= 2, `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes$1}`, "spring-two-frames");
      }
      if (generatorFactory !== keyframes && typeof keyframes$1[0] !== "number") {
        this.mixKeyframes = pipe(percentToProgress, mix(keyframes$1[0], keyframes$1[1]));
        keyframes$1 = [0, 100];
      }
      const generator = generatorFactory(keyframes$1 === options.keyframes ? options : { ...options, keyframes: keyframes$1 });
      if (repeatType === "mirror") {
        this.mirroredGenerator = generatorFactory({
          ...options,
          keyframes: [...keyframes$1].reverse(),
          velocity: -velocity
        });
      }
      if (generator.calculatedDuration === null) {
        generator.calculatedDuration = calcGeneratorDuration(generator);
      }
      const { calculatedDuration } = generator;
      this.calculatedDuration = calculatedDuration;
      this.resolvedDuration = calculatedDuration + repeatDelay;
      this.totalDuration = this.resolvedDuration * (repeat + 1) - repeatDelay;
      this.generator = generator;
    }
    updateTime(timestamp) {
      const animationTime = Math.round(timestamp - this.startTime) * this.playbackSpeed;
      if (this.holdTime !== null) {
        this.currentTime = this.holdTime;
      } else {
        this.currentTime = animationTime;
      }
    }
    tick(timestamp, sample = false) {
      const { generator, totalDuration, calculatedDuration } = this;
      if (this.startTime === null)
        return generator.next(0);
      const { delay = 0, keyframes: keyframes2, type, onUpdate, finalKeyframe } = this.options;
      if (this.startTime === this.pendingStartTime) {
        this.startTime = resolveStartTime(this.startTime, timestamp);
      }
      this.pendingStartTime = void 0;
      if (this.speed > 0) {
        this.startTime = Math.min(this.startTime, timestamp);
      } else if (this.speed < 0) {
        this.startTime = Math.min(timestamp - totalDuration / this.speed, this.startTime);
      }
      if (sample) {
        this.currentTime = timestamp;
      } else {
        this.updateTime(timestamp);
      }
      const timeWithoutDelay = this.currentTime - delay * (this.playbackSpeed >= 0 ? 1 : -1);
      const isInDelayPhase = this.playbackSpeed >= 0 ? timeWithoutDelay < 0 : timeWithoutDelay > totalDuration;
      this.currentTime = Math.max(timeWithoutDelay, 0);
      if (this.state === "finished" && this.holdTime === null) {
        this.currentTime = totalDuration;
      }
      const state3 = this.generate(this.currentTime, isInDelayPhase);
      let { done } = state3;
      if (!isInDelayPhase && calculatedDuration !== null) {
        done = this.playbackSpeed >= 0 ? this.currentTime >= totalDuration : this.currentTime <= 0;
      }
      const isAnimationFinished = this.holdTime === null && (this.state === "finished" || this.state === "running" && done);
      if (isAnimationFinished && type !== inertia) {
        state3.value = getFinalKeyframe(keyframes2, this.options, finalKeyframe, this.speed);
      }
      if (onUpdate) {
        onUpdate(state3.value);
      }
      if (isAnimationFinished) {
        this.finish();
      }
      return state3;
    }
    /**
     * This animation's time, including delay, at a timestamp.
     */
    at(timestamp) {
      return this.holdTime ?? round2((timestamp - this.startTime) * this.playbackSpeed);
    }
    /**
     * The value at a timestamp, without changing this animation's state.
     * If resolved, it ends at the last resolved keyframe, which is in the
     * same unit as the others, rather than at finalKeyframe.
     */
    sampleAt(timestamp, resolved) {
      const { options, totalDuration } = this;
      const t = this.at(timestamp) - (options.delay || 0);
      return t >= totalDuration && options.type !== inertia ? getFinalKeyframe(options.keyframes, options, resolved ? void 0 : options.finalKeyframe) : this.generate(Math.max(t, 0), t < 0).value;
    }
    /**
     * The generator's state `currentTime` ms after the delay, without
     * changing the animation's own state.
     */
    generate(currentTime, isInDelayPhase) {
      const { generator, totalDuration, mixKeyframes, mirroredGenerator, resolvedDuration } = this;
      const { keyframes: keyframes2, repeat, repeatType, repeatDelay } = this.options;
      let elapsed = currentTime;
      let frameGenerator = generator;
      if (repeat) {
        const progress2 = Math.min(currentTime, totalDuration) / resolvedDuration;
        let currentIteration = Math.floor(progress2);
        let iterationProgress = progress2 % 1;
        if (!iterationProgress && progress2 >= 1) {
          iterationProgress = 1;
        }
        iterationProgress === 1 && currentIteration--;
        currentIteration = Math.min(currentIteration, repeat + 1);
        const isOddIteration = Boolean(currentIteration % 2);
        if (isOddIteration) {
          if (repeatType === "reverse") {
            iterationProgress = 1 - iterationProgress;
            if (repeatDelay) {
              iterationProgress -= repeatDelay / resolvedDuration;
            }
          } else if (repeatType === "mirror") {
            frameGenerator = mirroredGenerator;
          }
        }
        elapsed = clamp3(0, 1, iterationProgress) * resolvedDuration;
      }
      let state3;
      if (isInDelayPhase) {
        this.delayState.value = keyframes2[0];
        state3 = this.delayState;
      } else {
        state3 = frameGenerator.next(elapsed);
      }
      if (mixKeyframes && !isInDelayPhase) {
        state3.value = mixKeyframes(state3.value);
      }
      return state3;
    }
    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve, reject) {
      return this.finished.then(resolve, reject);
    }
    get duration() {
      return millisecondsToSeconds(this.calculatedDuration);
    }
    get iterationDuration() {
      const { delay = 0 } = this.options || {};
      return this.duration + millisecondsToSeconds(delay);
    }
    get time() {
      return millisecondsToSeconds(this.currentTime);
    }
    set time(newTime) {
      newTime = secondsToMilliseconds(newTime);
      this.currentTime = newTime;
      if (this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0) {
        this.holdTime = newTime;
      } else if (this.driver) {
        this.startTime = this.driver.now() - newTime / this.playbackSpeed;
      }
      if (this.driver) {
        this.driver.start(false);
      } else {
        this.startTime = 0;
        this.state = "paused";
        this.holdTime = newTime;
        this.tick(newTime);
      }
    }
    /**
     * Returns the generator's velocity at the current time in units/second.
     * Uses the analytical derivative when available (springs), avoiding
     * the MotionValue's frame-dependent velocity estimation.
     */
    getGeneratorVelocity() {
      return calcGeneratorVelocity(this.generator, this.currentTime, this.options.velocity);
    }
    get speed() {
      return this.playbackSpeed;
    }
    set speed(newSpeed) {
      const hasChanged = this.playbackSpeed !== newSpeed;
      if (hasChanged && this.driver) {
        this.updateTime(time.now());
      }
      this.playbackSpeed = newSpeed;
      if (hasChanged && this.driver) {
        this.time = millisecondsToSeconds(this.currentTime);
      }
    }
    play() {
      if (this.isStopped)
        return;
      const { driver = frameloopDriver, startTime } = this.options;
      if (!this.driver) {
        this.driver = driver((timestamp) => this.tick(timestamp));
      }
      this.options.onPlay?.();
      const now2 = this.driver.now();
      if (this.state === "finished") {
        this.updateFinished();
        this.startTime = now2;
      } else if (this.holdTime !== null) {
        this.startTime = now2 - this.holdTime / (this.playbackSpeed || 1);
      } else if (!this.startTime) {
        this.startTime = startTime ?? (this.pendingStartTime = now2);
      }
      if (this.state === "finished" && this.speed < 0) {
        this.startTime += this.calculatedDuration;
      }
      this.holdTime = null;
      this.state = "running";
      this.driver.start();
    }
    pause() {
      this.state = "paused";
      this.updateTime(time.now());
      this.holdTime = this.currentTime;
    }
    complete() {
      if (this.state !== "running") {
        this.play();
      }
      this.state = "finished";
      this.holdTime = null;
    }
    finish() {
      this.notifyFinished();
      this.teardown();
      this.state = "finished";
      this.options.onComplete?.();
    }
    cancel() {
      this.holdTime = null;
      this.startTime = 0;
      this.tick(0);
      this.teardown();
      this.options.onCancel?.();
    }
    teardown() {
      this.state = "idle";
      this.stopDriver();
      this.startTime = this.holdTime = null;
    }
    stopDriver() {
      if (!this.driver)
        return;
      this.driver.stop();
      this.driver = void 0;
    }
    sample(sampleTime) {
      this.startTime = 0;
      return this.tick(sampleTime, true);
    }
    attachTimeline(timeline) {
      if (this.options.allowFlatten) {
        this.options.type = "keyframes";
        this.options.ease = "linear";
        this.initAnimation();
      }
      this.driver?.stop();
      return timeline.observe(this);
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/complex/filter.mjs
  var maxDefaults = /* @__PURE__ */ new Set(["brightness", "contrast", "saturate", "opacity"]);
  function applyDefaultFilter(v) {
    const [name, value] = v.slice(0, -1).split("(");
    if (name === "drop-shadow")
      return v;
    const [number2] = value.match(floatRegex) || [];
    if (!number2)
      return v;
    const unit = value.replace(number2, "");
    let defaultValue = maxDefaults.has(name) ? 1 : 0;
    if (number2 !== value)
      defaultValue *= 100;
    return name + "(" + defaultValue + unit + ")";
  }
  var functionRegex = /\b([a-z-]*)\(.*?\)/gu;
  var filter = {
    ...complex,
    getAnimatableNone: (v) => {
      const functions = v.match(functionRegex);
      return functions ? functions.map(applyDefaultFilter).join(" ") : v;
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/complex/mask.mjs
  var mask = {
    ...complex,
    getAnimatableNone: (v) => {
      const parsed = complex.parse(v);
      const transformer = complex.createTransformer(v);
      return transformer(parsed.map((v2) => typeof v2 === "number" ? 0 : typeof v2 === "object" ? { ...v2, alpha: 1 } : v2));
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/int.mjs
  var int = {
    ...number,
    transform: Math.round
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/maps/transform.mjs
  var transformValueTypes = {
    rotate: degrees,
    /**
     * Internal channel for `transition.path` orientToPath. Composed onto
     * `rotate` at the transform-build sites so the user's `rotate` is
     * never read or overwritten. Not part of `transformPropOrder`.
     */
    pathRotation: degrees,
    rotateX: degrees,
    rotateY: degrees,
    rotateZ: degrees,
    scale,
    scaleX: scale,
    scaleY: scale,
    scaleZ: scale,
    skew: degrees,
    skewX: degrees,
    skewY: degrees,
    distance: px,
    translateX: px,
    translateY: px,
    translateZ: px,
    x: px,
    y: px,
    z: px,
    perspective: px,
    transformPerspective: px,
    opacity: alpha,
    originX: progressPercentage,
    originY: progressPercentage,
    originZ: px
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/maps/number.mjs
  var numberValueTypes = {
    // Border props
    borderWidth: px,
    borderTopWidth: px,
    borderRightWidth: px,
    borderBottomWidth: px,
    borderLeftWidth: px,
    borderRadius: px,
    borderTopLeftRadius: px,
    borderTopRightRadius: px,
    borderBottomRightRadius: px,
    borderBottomLeftRadius: px,
    // Positioning props
    width: px,
    maxWidth: px,
    height: px,
    maxHeight: px,
    top: px,
    right: px,
    bottom: px,
    left: px,
    inset: px,
    insetBlock: px,
    insetBlockStart: px,
    insetBlockEnd: px,
    insetInline: px,
    insetInlineStart: px,
    insetInlineEnd: px,
    // Spacing props
    padding: px,
    paddingTop: px,
    paddingRight: px,
    paddingBottom: px,
    paddingLeft: px,
    paddingBlock: px,
    paddingBlockStart: px,
    paddingBlockEnd: px,
    paddingInline: px,
    paddingInlineStart: px,
    paddingInlineEnd: px,
    margin: px,
    marginTop: px,
    marginRight: px,
    marginBottom: px,
    marginLeft: px,
    marginBlock: px,
    marginBlockStart: px,
    marginBlockEnd: px,
    marginInline: px,
    marginInlineStart: px,
    marginInlineEnd: px,
    // Typography
    fontSize: px,
    // Misc
    backgroundPositionX: px,
    backgroundPositionY: px,
    ...transformValueTypes,
    zIndex: int,
    // SVG
    fillOpacity: alpha,
    strokeOpacity: alpha,
    numOctaves: int
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/maps/defaults.mjs
  var defaultValueTypes = {
    ...numberValueTypes,
    // Color props
    color,
    backgroundColor: color,
    outlineColor: color,
    fill: color,
    stroke: color,
    // Border props
    borderColor: color,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: color,
    borderLeftColor: color,
    filter,
    WebkitFilter: filter,
    mask,
    WebkitMask: mask
  };
  var getDefaultValueType = (key2) => defaultValueTypes[key2];

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/animatable-none.mjs
  var customTypes = /* @__PURE__ */ new Set([filter, mask]);
  function getAnimatableNone2(key2, value) {
    let defaultValueType = getDefaultValueType(key2);
    if (!customTypes.has(defaultValueType))
      defaultValueType = complex;
    return defaultValueType.getAnimatableNone ? defaultValueType.getAnimatableNone(value) : void 0;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/utils/fill-wildcards.mjs
  function fillWildcards(keyframes2) {
    for (let i = 1; i < keyframes2.length; i++) {
      keyframes2[i] ?? (keyframes2[i] = keyframes2[i - 1]);
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/render/dom/parse-transform.mjs
  var radToDeg = (rad) => rad * 180 / Math.PI;
  var rotate = (v) => {
    const angle = radToDeg(Math.atan2(v[1], v[0]));
    return rebaseAngle(angle);
  };
  var matrix2dParsers = {
    x: 4,
    y: 5,
    translateX: 4,
    translateY: 5,
    scaleX: 0,
    scaleY: 3,
    scaleZ: () => 1,
    scale: (v) => (Math.abs(v[0]) + Math.abs(v[3])) / 2,
    rotate,
    rotateZ: rotate,
    skewX: (v) => radToDeg(Math.atan(v[1])),
    skewY: (v) => radToDeg(Math.atan(v[2])),
    skew: (v) => (Math.abs(v[1]) + Math.abs(v[2])) / 2
  };
  var rebaseAngle = (angle) => {
    angle = angle % 360;
    if (angle < 0)
      angle += 360;
    return angle;
  };
  var rotateZ = rotate;
  var scaleX = (v) => Math.hypot(v[0], v[1]);
  var scaleY = (v) => Math.hypot(v[4], v[5]);
  var matrix3dParsers = {
    x: 12,
    y: 13,
    z: 14,
    translateX: 12,
    translateY: 13,
    translateZ: 14,
    scaleX,
    scaleY,
    scaleZ: (v) => Math.hypot(v[8], v[9], v[10]),
    scale: (v) => (scaleX(v) + scaleY(v)) / 2,
    rotateX: (v) => rebaseAngle(radToDeg(Math.atan2(v[6], v[5]))),
    rotateY: (v) => rebaseAngle(radToDeg(Math.atan2(-v[2], v[0]))),
    rotateZ,
    rotate: rotateZ,
    skewX: (v) => radToDeg(Math.atan(v[4])),
    skewY: (v) => radToDeg(Math.atan(v[1])),
    skew: (v) => (Math.abs(v[1]) + Math.abs(v[4])) / 2
  };
  function defaultTransformValue(name) {
    return name.includes("scale") ? 1 : 0;
  }
  function parseValueFromTransform(transform, name) {
    if (!transform || transform === "none") {
      return defaultTransformValue(name);
    }
    const matrix3dMatch = transform.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
    let parsers;
    let match;
    if (matrix3dMatch) {
      parsers = matrix3dParsers;
      match = matrix3dMatch;
    } else {
      const matrix2dMatch = transform.match(/^matrix\(([-\d.e\s,]+)\)$/u);
      parsers = matrix2dParsers;
      match = matrix2dMatch;
    }
    if (!match) {
      return defaultTransformValue(name);
    }
    const valueParser = parsers[name];
    const values = match[1].split(",").map(convertTransformToNumber);
    return typeof valueParser === "function" ? valueParser(values) : values[valueParser];
  }
  var readTransformValue = (instance, name) => {
    const { transform = "none" } = getComputedStyle(instance);
    return parseValueFromTransform(transform, name);
  };
  function convertTransformToNumber(value) {
    return parseFloat(value.trim());
  }

  // ../../code/node_modules/motion-dom/dist/es/render/utils/keys-transform.mjs
  var transformPropOrder = [
    "transformPerspective",
    "x",
    "y",
    "z",
    "translateX",
    "translateY",
    "translateZ",
    "scale",
    "scaleX",
    "scaleY",
    "scaleZ",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "skew",
    "skewX",
    "skewY"
  ];
  var transformProps = /* @__PURE__ */ (() => /* @__PURE__ */ new Set([...transformPropOrder, "pathRotation"]))();

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/utils/unit-conversion.mjs
  var isNumOrPxType = (v) => v === number || v === px;
  var transformKeys = /* @__PURE__ */ new Set(["x", "y", "z"]);
  var nonTranslationalTransformKeys = transformPropOrder.filter((key2) => !transformKeys.has(key2));
  function removeNonTranslationalTransform(visualElement) {
    const removedTransforms = [];
    nonTranslationalTransformKeys.forEach((key2) => {
      const value = visualElement.getValue(key2);
      if (value !== void 0) {
        const current2 = value.get();
        const reset = key2.startsWith("scale") ? 1 : 0;
        if (current2 === reset)
          return;
        removedTransforms.push([key2, current2]);
        value.set(reset);
      }
    });
    return removedTransforms;
  }
  var boxDependentValues = /* @__PURE__ */ new Set(["bottom", "right"]);
  function measureDimension(computed, measureBox, axis, paddingStart, paddingEnd, boxSizing) {
    const px2 = parseFloat(computed);
    if (!isNaN(px2))
      return px2;
    const { min, max } = measureBox()[axis];
    const size = max - min;
    return boxSizing === "border-box" ? size : size - parseFloat(paddingStart) - parseFloat(paddingEnd);
  }
  var positionalValues = {
    // Dimensions
    width: ({ width, paddingLeft = "0", paddingRight = "0", boxSizing }, measureBox) => measureDimension(width, measureBox, "x", paddingLeft, paddingRight, boxSizing),
    height: ({ height, paddingTop = "0", paddingBottom = "0", boxSizing }, measureBox) => measureDimension(height, measureBox, "y", paddingTop, paddingBottom, boxSizing),
    top: ({ top }) => parseFloat(top),
    left: ({ left }) => parseFloat(left),
    bottom: ({ top }, measureBox) => {
      const { y } = measureBox();
      return parseFloat(top) + (y.max - y.min);
    },
    right: ({ left }, measureBox) => {
      const { x } = measureBox();
      return parseFloat(left) + (x.max - x.min);
    },
    // Transform
    x: ({ transform }) => parseValueFromTransform(transform, "x"),
    y: ({ transform }) => parseValueFromTransform(transform, "y")
  };
  positionalValues.translateX = positionalValues.x;
  positionalValues.translateY = positionalValues.y;

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/KeyframesResolver.mjs
  var toResolve = /* @__PURE__ */ new Set();
  var isScheduled = false;
  var anyNeedsMeasurement = false;
  var isForced = false;
  function measureAllKeyframes() {
    if (anyNeedsMeasurement) {
      const resolversToMeasure = [];
      const elementsToMeasure = /* @__PURE__ */ new Set();
      const elementsToUntransform = /* @__PURE__ */ new Set();
      toResolve.forEach((resolver) => {
        if (!resolver.needsMeasurement)
          return;
        resolversToMeasure.push(resolver);
        elementsToMeasure.add(resolver.element);
        if (boxDependentValues.has(resolver.name)) {
          elementsToUntransform.add(resolver.element);
        }
      });
      const transformsToRestore = /* @__PURE__ */ new Map();
      elementsToUntransform.forEach((element) => {
        const removedTransforms = removeNonTranslationalTransform(element);
        if (!removedTransforms.length)
          return;
        transformsToRestore.set(element, removedTransforms);
        element.render();
      });
      resolversToMeasure.forEach((resolver) => resolver.measureInitialState());
      elementsToMeasure.forEach((element) => {
        element.render();
        const restore = transformsToRestore.get(element);
        if (restore) {
          restore.forEach(([key2, value]) => {
            element.getValue(key2)?.set(value);
          });
        }
      });
      resolversToMeasure.forEach((resolver) => resolver.measureEndState());
      resolversToMeasure.forEach((resolver) => {
        if (resolver.suspendedScrollY !== void 0) {
          window.scrollTo(0, resolver.suspendedScrollY);
        }
      });
    }
    anyNeedsMeasurement = false;
    isScheduled = false;
    toResolve.forEach((resolver) => resolver.complete(isForced));
    toResolve.clear();
  }
  function readAllKeyframes() {
    toResolve.forEach((resolver) => {
      resolver.readKeyframes();
      if (resolver.needsMeasurement) {
        anyNeedsMeasurement = true;
      }
    });
  }
  function flushKeyframeResolvers() {
    isForced = true;
    readAllKeyframes();
    measureAllKeyframes();
    isForced = false;
  }
  function readOrigin(value, name, target) {
    if (typeof value === "string") {
      if (isNumericalString(value) || isZeroValueString(value)) {
        return parseFloat(value);
      } else if (!complex.test(value) && complex.test(target)) {
        return getAnimatableNone2(name, target);
      }
    }
    return value ?? void 0;
  }
  var KeyframeResolver = class {
    constructor(unresolvedKeyframes, onComplete, name, motionValue2, element, isAsync = false) {
      this.state = "pending";
      this.isAsync = false;
      this.needsMeasurement = false;
      this.unresolvedKeyframes = [...unresolvedKeyframes];
      this.onComplete = onComplete;
      this.name = name;
      this.motionValue = motionValue2;
      this.element = element;
      this.isAsync = isAsync;
    }
    scheduleResolve() {
      this.state = "scheduled";
      if (this.isAsync) {
        toResolve.add(this);
        if (!isScheduled) {
          isScheduled = true;
          frame2.read(readAllKeyframes);
          frame2.resolveKeyframes(measureAllKeyframes);
        }
      } else {
        this.readKeyframes();
        this.complete();
      }
    }
    readKeyframes() {
      const { unresolvedKeyframes, name, element, motionValue: motionValue2 } = this;
      if (unresolvedKeyframes[0] === null) {
        const currentValue = motionValue2?.get();
        const finalKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
        if (currentValue !== void 0) {
          unresolvedKeyframes[0] = currentValue;
        } else if (element && name) {
          const valueAsRead = readOrigin(element.readValue(name, finalKeyframe), name, finalKeyframe);
          if (valueAsRead !== void 0) {
            unresolvedKeyframes[0] = valueAsRead;
          }
        }
        if (unresolvedKeyframes[0] === void 0) {
          unresolvedKeyframes[0] = finalKeyframe;
        }
        if (motionValue2 && currentValue === void 0) {
          motionValue2.set(unresolvedKeyframes[0]);
        }
      }
      fillWildcards(unresolvedKeyframes);
    }
    setFinalKeyframe() {
    }
    measureInitialState() {
    }
    renderEndStyles() {
    }
    measureEndState() {
    }
    complete(isForcedComplete = false) {
      this.state = "complete";
      this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, isForcedComplete);
      toResolve.delete(this);
    }
    cancel() {
      if (this.state === "scheduled") {
        toResolve.delete(this);
        this.state = "pending";
      }
    }
    resume() {
      if (this.state === "pending")
        this.scheduleResolve();
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/render/dom/is-css-var.mjs
  var isCSSVar = (name) => name.startsWith("--");

  // ../../code/node_modules/motion-dom/dist/es/render/dom/style-set.mjs
  function setStyle(element, name, value) {
    isCSSVar(name) ? element.style.setProperty(name, value) : element.style[name] = value;
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/supports/flags.mjs
  var supportsFlags = {};

  // ../../code/node_modules/motion-dom/dist/es/utils/supports/memo.mjs
  function memoSupports(callback, supportsFlag) {
    const memoized = memo(callback);
    return () => supportsFlags[supportsFlag] ?? memoized();
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
  var supportsScrollTimeline = /* @__PURE__ */ memoSupports(() => window.ScrollTimeline !== void 0, "scrollTimeline");

  // ../../code/node_modules/motion-dom/dist/es/utils/supports/linear-easing.mjs
  var supportsLinearEasing = /* @__PURE__ */ memoSupports(() => {
    try {
      document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
    } catch (e) {
      return false;
    }
    return true;
  }, "linearEasing");

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/easing/cubic-bezier.mjs
  var cubicBezierAsString = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/easing/supported.mjs
  var supportedWaapiEasing = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: /* @__PURE__ */ cubicBezierAsString([0, 0.65, 0.55, 1]),
    circOut: /* @__PURE__ */ cubicBezierAsString([0.55, 0, 1, 0.45]),
    backIn: /* @__PURE__ */ cubicBezierAsString([0.31, 0.01, 0.66, -0.59]),
    backOut: /* @__PURE__ */ cubicBezierAsString([0.33, 1.53, 0.69, 0.99])
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/easing/map-easing.mjs
  function mapEasingToNativeEasing(easing, duration) {
    if (!easing) {
      return void 0;
    } else if (typeof easing === "function") {
      return supportsLinearEasing() ? generateLinearEasing(easing, duration) : "ease-out";
    } else if (isBezierDefinition(easing)) {
      return cubicBezierAsString(easing);
    } else if (Array.isArray(easing)) {
      return easing.map((segmentEasing) => mapEasingToNativeEasing(segmentEasing, duration) || supportedWaapiEasing.easeOut);
    } else {
      return supportedWaapiEasing[easing];
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/start-waapi-animation.mjs
  function startWaapiAnimation(element, valueName, keyframes2, { delay = 0, duration = 300, repeat = 0, repeatType = "loop", ease: ease2 = "easeOut", times } = {}, pseudoElement = void 0) {
    const keyframeOptions = {
      [valueName]: keyframes2
    };
    if (times)
      keyframeOptions.offset = times;
    const easing = mapEasingToNativeEasing(ease2, duration);
    if (Array.isArray(easing))
      keyframeOptions.easing = easing;
    const options = {
      delay,
      duration,
      easing: !Array.isArray(easing) ? easing : "linear",
      fill: "both",
      iterations: repeat + 1,
      direction: repeatType === "reverse" ? "alternate" : "normal"
    };
    if (pseudoElement)
      options.pseudoElement = pseudoElement;
    return element.animate(keyframeOptions, options);
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
  function isGenerator(type) {
    return typeof type === "function" && "applyToOptions" in type;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/utils/apply-generator.mjs
  function applyGeneratorOptions({ type, ...options }) {
    if (isGenerator(type) && supportsLinearEasing()) {
      return type.applyToOptions(options);
    } else {
      options.duration ?? (options.duration = 300);
      options.ease ?? (options.ease = "easeOut");
    }
    return options;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/NativeAnimation.mjs
  var NativeAnimation = class extends WithPromise {
    constructor(options) {
      super();
      this.finishedTime = null;
      this.isStopped = false;
      this.manualStartTime = null;
      if (!options)
        return;
      const { element, name, keyframes: keyframes2, pseudoElement, allowFlatten = false, finalKeyframe, onComplete } = options;
      this.isPseudoElement = Boolean(pseudoElement);
      this.allowFlatten = allowFlatten;
      this.options = options;
      invariant(typeof options.type !== "string", `Mini animate() doesn't support "type" as a string.`, "mini-spring");
      const transition = applyGeneratorOptions(options);
      this.animation = startWaapiAnimation(element, name, keyframes2, transition, pseudoElement);
      if (transition.autoplay === false) {
        this.animation.pause();
      }
      this.animation.onfinish = () => {
        this.finishedTime = this.time;
        if (!pseudoElement) {
          const keyframe2 = getFinalKeyframe(keyframes2, this.options, finalKeyframe, this.speed);
          if (this.updateMotionValue) {
            this.updateMotionValue(keyframe2);
          }
          setStyle(element, name, keyframe2);
          this.animation.cancel();
        }
        onComplete?.();
        this.notifyFinished();
      };
      notifyAnimationStart(this, options, transition);
    }
    play() {
      if (this.isStopped)
        return;
      this.manualStartTime = null;
      this.animation.play();
      if (this.state === "finished") {
        this.updateFinished();
      }
    }
    pause() {
      this.animation.pause();
    }
    complete() {
      this.animation.finish?.();
    }
    cancel() {
      try {
        this.animation.cancel();
      } catch (e) {
      }
    }
    stop() {
      if (this.isStopped)
        return;
      this.isStopped = true;
      const { state: state3 } = this;
      if (state3 === "idle" || state3 === "finished") {
        return;
      }
      if (this.updateMotionValue) {
        this.updateMotionValue();
      } else {
        this.commitStyles();
      }
      if (!this.isPseudoElement)
        this.cancel();
    }
    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * In this method, we commit styles back to the DOM before cancelling
     * the animation.
     *
     * This is designed to be overridden by NativeAnimationExtended, which
     * will create a renderless JS animation and sample it twice to calculate
     * its current value, "previous" value, and therefore allow
     * Motion to also correctly calculate velocity for any subsequent animation
     * while deferring the commit until the next animation frame.
     */
    commitStyles() {
      const element = this.options?.element;
      if (!this.isPseudoElement && element?.isConnected) {
        this.animation.commitStyles?.();
      }
    }
    get duration() {
      const duration = this.animation.effect?.getComputedTiming?.().duration || 0;
      return millisecondsToSeconds(Number(duration));
    }
    get iterationDuration() {
      const { delay = 0 } = this.options || {};
      return this.duration + millisecondsToSeconds(delay);
    }
    get time() {
      return millisecondsToSeconds(Number(this.animation.currentTime) || 0);
    }
    set time(newTime) {
      const wasFinished = this.finishedTime !== null;
      this.manualStartTime = null;
      this.finishedTime = null;
      this.animation.currentTime = secondsToMilliseconds(newTime);
      if (wasFinished) {
        this.animation.pause();
      }
    }
    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    get speed() {
      return this.animation.playbackRate;
    }
    set speed(newSpeed) {
      if (newSpeed < 0)
        this.finishedTime = null;
      this.animation.playbackRate = newSpeed;
    }
    get state() {
      return this.finishedTime !== null ? "finished" : this.animation.playState;
    }
    get startTime() {
      return this.manualStartTime ?? Number(this.animation.startTime);
    }
    set startTime(newStartTime) {
      this.manualStartTime = this.animation.startTime = newStartTime;
    }
    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     */
    attachTimeline({ timeline, onAttach, observe }) {
      if (this.allowFlatten) {
        this.animation.effect?.updateTiming({ easing: "linear" });
      }
      this.animation.onfinish = null;
      if (timeline && supportsScrollTimeline()) {
        this.animation.timeline = timeline;
        onAttach?.(this.animation);
        return noop;
      } else {
        return observe(this);
      }
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/utils/unsupported-easing.mjs
  var unsupportedEasingFunctions = {
    anticipate,
    backInOut,
    circInOut
  };
  function isUnsupportedEase(key2) {
    return key2 in unsupportedEasingFunctions;
  }
  function replaceStringEasing(transition) {
    if (typeof transition.ease === "string" && isUnsupportedEase(transition.ease)) {
      transition.ease = unsupportedEasingFunctions[transition.ease];
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/NativeAnimationExtended.mjs
  var sampleDelta = 10;
  var NativeAnimationExtended = class extends NativeAnimation {
    constructor(options) {
      replaceStringEasing(options);
      replaceTransitionType(options);
      super(options);
      if (options.startTime !== void 0 && options.autoplay !== false) {
        this.startTime = options.startTime;
      }
      this.options = options;
    }
    /**
     * The animation's time now, in ms. Wall-clock rather than WAAPI's
     * currentTime while running, as under CPU load currentTime may not
     * reflect the actual elapsed time, causing incorrect sampling and
     * visual jumps.
     */
    elapsed() {
      return this.state === "running" ? (time.now() - this.startTime) * this.speed : this.time * 1e3;
    }
    /**
     * The value at a time, from a renderless JS animation.
     */
    sample(sampleTime) {
      if (!this.sampler) {
        const { motionValue: motionValue2, onUpdate, onComplete, onPlay, onStop, element, ...options } = this.options;
        this.sampler = new JSAnimation({ ...options, autoplay: false });
        this.sampler.stop();
      }
      return this.sampler.sample(Math.max(0, sampleTime)).value;
    }
    /**
     * The value now, as WAAPI doesn't set the motion value while it runs.
     */
    liveValue() {
      const { state: state3 } = this;
      if (state3 === "running" || state3 === "paused") {
        return this.sample(this.elapsed());
      }
    }
    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * Rather than read committed styles back out of the DOM, we can
     * sample a renderless JS animation twice to calculate its current
     * value, "previous" value, and therefore allow Motion to calculate
     * velocity for any subsequent animation.
     */
    updateMotionValue(value) {
      const { motionValue: motionValue2, element, name } = this.options;
      if (!motionValue2)
        return;
      if (value !== void 0) {
        motionValue2.set(value);
        return;
      }
      const { speed } = this;
      const sampleTime = this.elapsed();
      const delta = this.state === "running" && speed ? clamp3(0, sampleDelta, sampleTime) : 0;
      const current2 = this.sample(sampleTime);
      if (element && name)
        setStyle(element, name, current2);
      motionValue2.setWithVelocity(this.sample(sampleTime - delta * Math.sign(speed)), current2, delta / Math.abs(speed || 1));
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/is-animatable.mjs
  var isAnimatable = (value, name) => {
    if (name === "zIndex")
      return false;
    if (typeof value === "number" || Array.isArray(value))
      return true;
    if (typeof value === "string" && // It's animatable if we have a string
    (complex.test(value) || value === "0") && // And it contains numbers and/or colors
    !value.startsWith("url(")) {
      return true;
    }
    return false;
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/can-animate.mjs
  function hasKeyframesChanged(keyframes2) {
    const current2 = keyframes2[0];
    if (keyframes2.length === 1)
      return true;
    for (let i = 0; i < keyframes2.length; i++) {
      if (keyframes2[i] !== current2)
        return true;
    }
  }
  function canAnimate2(keyframes2, name, type, velocity) {
    const originKeyframe = keyframes2[0];
    if (originKeyframe === null) {
      return false;
    }
    if (name === "display" || name === "visibility")
      return true;
    const targetKeyframe = keyframes2[keyframes2.length - 1];
    const isOriginAnimatable = isAnimatable(originKeyframe, name);
    const isTargetAnimatable = isAnimatable(targetKeyframe, name);
    if (!isOriginAnimatable || !isTargetAnimatable) {
      isOriginAnimatable !== isTargetAnimatable && warning(false, `You are trying to animate ${name} from "${originKeyframe}" to "${targetKeyframe}". "${isOriginAnimatable ? targetKeyframe : originKeyframe}" is not an animatable value.`, "value-not-animatable");
      return false;
    }
    return hasKeyframesChanged(keyframes2) || (type === "spring" || isGenerator(type)) && velocity;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/make-animation-instant.mjs
  function makeAnimationInstant(options) {
    options.duration = 0;
    options.type = "keyframes";
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/utils/accelerated-values.mjs
  var acceleratedValues = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform",
    "backgroundColor"
  ]);

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/utils/is-browser-color.mjs
  var browserColorFunctions = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
  function hasBrowserOnlyColors(keyframes2) {
    for (let i = 0; i < keyframes2.length; i++) {
      if (typeof keyframes2[i] === "string" && browserColorFunctions.test(keyframes2[i])) {
        return true;
      }
    }
    return false;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/supports/waapi.mjs
  var colorProperties = /* @__PURE__ */ new Set([
    "color",
    "backgroundColor",
    "outlineColor",
    "fill",
    "stroke",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor"
  ]);
  var supportsWaapi = /* @__PURE__ */ memo(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
  function supportsBrowserAnimation(options) {
    const { motionValue: motionValue2, name, repeatDelay, repeatType, damping, type, keyframes: keyframes2 } = options;
    if (!name || !(acceleratedValues.has(name) || colorProperties.has(name))) {
      return false;
    }
    const subject2 = motionValue2?.owner?.current;
    if (!(subject2 instanceof HTMLElement) && !(subject2 instanceof SVGElement)) {
      return false;
    }
    const { onUpdate, transformTemplate } = motionValue2.owner.getProps();
    return supportsWaapi() && /**
     * Force WAAPI for color properties with browser-only color formats
     * (oklch, oklab, lab, lch, etc.) that the JS animation path can't parse.
     */
    (acceleratedValues.has(name) || colorProperties.has(name) && hasBrowserOnlyColors(keyframes2)) && (name !== "transform" || !transformTemplate) && /**
     * If we're outputting values to onUpdate then we can't use WAAPI as there's
     * no way to read the value from WAAPI every frame.
     */
    !onUpdate && !repeatDelay && repeatType !== "mirror" && damping !== 0 && type !== "inertia";
  }

  // ../../code/node_modules/motion-dom/dist/es/value/types/utils/get-as-type.mjs
  var getValueAsType = (value, type) => {
    return type && typeof value === "number" ? type.transform(value) : value;
  };

  // ../../code/node_modules/motion-dom/dist/es/render/html/utils/build-transform.mjs
  var translateAlias = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  };
  var numTransforms = transformPropOrder.length;
  function buildTransform(latestValues, transform, transformTemplate) {
    let transformString = "";
    let transformIsDefault = true;
    for (let i = 0; i < numTransforms; i++) {
      const key2 = transformPropOrder[i];
      const value = latestValues[key2];
      if (value === void 0)
        continue;
      let valueIsDefault = true;
      if (typeof value === "number") {
        valueIsDefault = value === (key2.startsWith("scale") ? 1 : 0);
      } else {
        const parsed = parseFloat(value);
        valueIsDefault = key2.startsWith("scale") ? parsed === 1 : parsed === 0;
      }
      if (!valueIsDefault || transformTemplate) {
        const valueAsType = getValueAsType(value, numberValueTypes[key2]);
        if (!valueIsDefault) {
          transformIsDefault = false;
          const transformName = translateAlias[key2] || key2;
          transformString += `${transformName}(${valueAsType}) `;
        }
        if (transformTemplate) {
          transform[key2] = valueAsType;
        }
      }
    }
    const pathRotation = latestValues.pathRotation;
    if (pathRotation) {
      transformIsDefault = false;
      transformString += `rotate(${getValueAsType(pathRotation, numberValueTypes.pathRotation)}) `;
    }
    transformString = transformString.trim();
    if (transformTemplate) {
      transformString = transformTemplate(transform, transformIsDefault ? "" : transformString);
    } else if (transformIsDefault) {
      transformString = "none";
    }
    return transformString;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/transforms/groups.mjs
  var transformGroups = /* @__PURE__ */ new WeakMap();

  // ../../code/node_modules/motion-dom/dist/es/animation/waapi/transforms/TransformAnimation.mjs
  var maxSamples = 200;
  var easingTolerance = 1e-3;
  var sampleTolerance = 0.1;
  var scaleTolerance = 1e-3;
  var churnWindow = 100;
  var isNativeEasing = (ease2) => /^(linear|ease(In|Out|InOut))$/.test(ease2);
  var byTime = (a, b) => a - b;
  var spread = (from, to, n) => {
    const result = [];
    for (let i = 0; i <= n; i++)
      result.push(mixNumber(from, to, i / n));
    return result;
  };
  var getOwner = (options) => options.motionValue.owner;
  var getGroup = (element) => transformGroups.get(element);
  var read = (owner, key2) => owner.latestValues ? owner.latestValues[key2] : owner.getValue(key2)?.get();
  var canGroupTransform = ({ name, motionValue: motionValue2 }) => name && transformPropOrder.includes(name) && motionValue2?.owner?.current instanceof HTMLElement && supportsWaapi() && supportsLinearEasing();
  function canAccelerateTransform(options) {
    const owner = getOwner(options);
    const { onUpdate, transformTemplate } = owner.getProps();
    return (
      /**
       * A handoff from an optimised appear animation is already running
       * on its own WAAPI animation. onUpdate needs every value, every
       * frame.
       */
      !options.isHandoff && !onUpdate && !options.hasOnUpdate && /**
       * transformTemplate could output anything.
       */
      !transformTemplate && options.type !== "inertia" && /**
       * A literal transform, or pathRotation, replaces or adds to the
       * transform we'd build. styleEffect builds its own as "none".
       */
      (read(owner, "transform") || "none") === "none" && !read(owner, "pathRotation") && /**
       * Layout animations write transform every frame.
       */
      !owner.projection?.isProjecting()
    );
  }
  var TransformAnimation = class extends JSAnimation {
    constructor(options) {
      const element = getOwner(options).current;
      const { driver = frameloopDriver } = options;
      const canAccelerate = canAccelerateTransform(options);
      options.driver = (update) => {
        const js = driver(update);
        return {
          js,
          now: js.now,
          start: (keepAlive = true) => {
            const group = getGroup(element);
            const isJS = !group || group.isJS;
            isJS ? js.start(keepAlive) : group.schedule(false, !keepAlive);
          },
          stop: () => {
            js.stop();
            const group = getGroup(element);
            group?.schedule(!group.isFinishing);
          }
        };
      };
      super(options);
      this.canAccelerate = canAccelerate;
      const { stop } = this;
      this.stop = () => {
        this.isAccelerated() && this.sync();
        stop();
      };
    }
    get group() {
      return getGroup(getOwner(this.options).current);
    }
    get js() {
      return this.driver?.js;
    }
    get name() {
      return this.options.name;
    }
    /**
     * When this stops moving, or, if it repeats forever, when it starts
     * repeating, and how long each repeat takes. Held (paused, or at
     * speed 0) animations never stop moving.
     */
    timing() {
      const { startTime, speed, totalDuration } = this;
      const { delay = 0, repeatType } = this.options;
      return this.holdTime !== null ? [Infinity, 0] : totalDuration === Infinity ? [
        startTime + delay / speed,
        this.resolvedDuration * (repeatType === "loop" ? 1 : 2) / speed || 1
      ] : [startTime + (delay + totalDuration) / speed, 0];
    }
    /**
     * Whether this is running, or paused, on the compositor.
     */
    isAccelerated() {
      const { group, state: state3 } = this;
      return group?.tracks.has(this) && !group.isJS && this.canAccelerate && (state3 === "running" || state3 === "paused");
    }
    /**
     * The value now, while this runs on the compositor and so doesn't
     * set its motion value every frame.
     */
    liveValue() {
      return this.isAccelerated() ? this.sampleAt(time.now()) : void 0;
    }
    /**
     * If this is a two-keyframe tween whose easing WAAPI runs exactly,
     * when it starts and stops moving, and that easing.
     */
    tween() {
      const { keyframes: keyframes$1, type, ease: ease2, times, repeat, delay = 0 } = this.options;
      const easing = isBezierDefinition(ease2) ? cubicBezierAsString(ease2) : isNativeEasing(ease2) && supportedWaapiEasing[ease2];
      if (easing && !repeat && !times && keyframes$1.length === 2 && type === keyframes && this.holdTime === null) {
        const start2 = this.startTime + delay / this.speed;
        return [start2, start2 + this.resolvedDuration / this.speed, easing];
      }
    }
    /**
     * The timestamps between two timestamps where this reaches a
     * keyframe or starts a repeat, where it can turn or jump.
     */
    boundaries(from, to) {
      const { startTime, speed, resolvedDuration, options } = this;
      const { delay = 0, repeat = 0, repeatDelay = 0, repeatType, times, keyframes: keyframes$1, type } = options;
      const offsets = (type || keyframes) === keyframes ? times || defaultOffset(keyframes$1) : [0, 1];
      const start2 = startTime + delay / speed;
      const result = [];
      if (this.holdTime !== null || !(resolvedDuration > 0))
        return result;
      for (let i = Math.max(0, Math.floor((from - start2) * speed / resolvedDuration)); i <= repeat; i++) {
        const iterationStart = start2 + i * resolvedDuration / speed;
        if (iterationStart > to)
          break;
        for (const offset of offsets) {
          const t = iterationStart + (i % 2 && repeatType && repeatType !== "loop" ? 1 - offset : offset) * (resolvedDuration - repeatDelay) / speed;
          t > from && t < to && result.push(t);
        }
      }
      return result;
    }
    /**
     * The value at a timestamp, as a number.
     */
    numberAt(timestamp) {
      return parseFloat(this.sampleAt(timestamp, true));
    }
    /**
     * Write the current value, and velocity, to the motion value.
     */
    sync() {
      const now2 = time.now();
      this.options.motionValue.setWithVelocity(this.sampleAt(now2 - sampleDelta, true), this.sampleAt(now2, true), sampleDelta);
    }
    play() {
      if (this.isStopped)
        return;
      (this.group || createGroup(getOwner(this.options))).tracks.add(this);
      super.play();
    }
    pause() {
      super.pause();
      if (this.isAccelerated()) {
        this.sync();
        this.group.schedule(false);
      }
    }
    /**
     * JSAnimation finishes on its next tick, which only happens on the
     * main thread, so finish now.
     */
    complete() {
      super.complete();
      const { group } = this;
      group && !group.isJS && this.canAccelerate && this.tick(time.now());
    }
    /**
     * Without a tick to rebase it, a held time still includes the delay,
     * so take it off here, as a JS animation does on its next tick.
     */
    get time() {
      if (this.isAccelerated()) {
        return millisecondsToSeconds(clamp3(0, this.totalDuration, this.at(time.now()) - (this.options.delay || 0)));
      }
      return super.time;
    }
    set time(newTime) {
      super.time = newTime;
    }
    /**
     * Scroll timelines set time every frame, so run these on the main
     * thread.
     */
    attachTimeline(timeline) {
      this.canAccelerate = false;
      this.group?.demote(true);
      return super.attachTimeline(timeline);
    }
  };
  function createGroup(owner) {
    const element = owner.current;
    const tracks = /* @__PURE__ */ new Set();
    const byKey = /* @__PURE__ */ new Map();
    let statics = {};
    let keys = [];
    let built = /* @__PURE__ */ new Map();
    let segments = [];
    let needsBuild = false;
    let isScheduled2 = false;
    let hasChurned = false;
    let lastChurn = -Infinity;
    const has = (key2) => {
      for (const track of tracks)
        if (track.name === key2)
          return true;
    };
    const valuesAt = (timestamp, settled) => {
      const values = {};
      for (const key2 of timestamp === void 0 ? transformPropOrder : keys) {
        const track = byKey.get(key2);
        const value = timestamp === void 0 ? read(owner, key2) : track ? track.sampleAt(settled > timestamp && !track.timing()[1] ? settled : timestamp) : statics[key2];
        if (value !== void 0)
          values[key2] = value;
      }
      return values;
    };
    const compose = (timestamp, settled) => {
      let transform = "";
      const values = valuesAt(timestamp, settled);
      for (const key2 in values) {
        transform += (translateAlias[key2] || key2) + "(" + getValueAsType(values[key2], numberValueTypes[key2]) + ") ";
      }
      return transform || "none";
    };
    const commit = (values = valuesAt()) => {
      element.style.transform = buildTransform(values, {});
    };
    const stop = (shouldCommit = true) => {
      shouldCommit && commit();
      segments.forEach(({ animation }) => animation.cancel());
      segments = [];
    };
    const add = (animation, offset, end = Infinity) => {
      const segment = { animation, offset, end };
      animation.startTime = time.now() + offset;
      if (end < Infinity) {
        animation.onfinish = () => {
          segment.isDone = true;
          if (segments.some((s) => s.end === Infinity)) {
            animation.cancel();
            segments = segments.filter((s) => s !== segment);
          }
          group.schedule(false);
        };
      }
      animation.oncancel = () => segments.includes(segment) && group.demote();
      segments.push(segment);
    };
    const jumpAt = (value, a, b) => {
      const change = (x, y) => Math.abs(value(y) - value(x));
      const size = change(a, b);
      while (b - a > 0.01) {
        const mid = (a + b) / 2;
        change(a, mid) > change(mid, b) ? b = mid : a = mid;
      }
      return change(a, b) > size / 2 ? [a, b] : [];
    };
    const getEasing = (moving, from, to, bounds2) => {
      const samples = Math.min(maxSamples, Math.max(2, Math.ceil((to - from) / sampleDelta)));
      if (bounds2.length * 4 > samples)
        return;
      const at = spread(from, to, samples).concat(bounds2).sort(byTime);
      const position = (t) => progress(from, to, t);
      let shared;
      let progressAt;
      for (const track of moving) {
        const values = at.map((t) => track.numberAt(t));
        const [first] = values;
        const range = values[values.length - 1] - first;
        const progress2 = values.map((value) => range ? (value - first) / range : value - first);
        if (!range) {
          if (progress2.some((p) => !(Math.abs(p) <= easingTolerance))) {
            return;
          }
        } else if (!shared) {
          shared = progress2;
          progressAt = (t) => (track.numberAt(t) - first) / range;
        } else if (progress2.some((p, i) => !(Math.abs(p - shared[i]) <= easingTolerance))) {
          return;
        }
      }
      if (!shared || shared.every((p, i) => Math.abs(p - position(at[i])) <= easingTolerance)) {
        return "linear";
      }
      const points = [];
      const point = (t, p = progressAt(t)) => points.push(round2(p) + " " + round2(position(t) * 100) + "%");
      shared.forEach((p, i) => {
        i && Math.abs(p - shared[i - 1]) > 0.2 && jumpAt(progressAt, at[i - 1], at[i]).forEach((t) => point(t));
        point(at[i], p);
      });
      return "linear(" + points + ")";
    };
    const sample = (moving, from, to, bounds2) => {
      const times = [from];
      const isStraight = (a, b) => moving.every((track) => !(Math.abs(track.numberAt((a + b) / 2) - (track.numberAt(a) + track.numberAt(b)) / 2) > (track.name.startsWith("scale") ? scaleTolerance : sampleTolerance)));
      const split = (a, b, depth) => {
        if (b - a < 1 || isStraight(a, b)) {
          times.push(b);
        } else if (depth < 4) {
          split(a, (a + b) / 2, depth + 1);
          split((a + b) / 2, b, depth + 1);
        } else {
          for (const track of moving) {
            times.push(...jumpAt((t) => track.numberAt(t), a, b));
          }
          times.push(b);
        }
      };
      const ends = spread(from, to, Math.ceil((to - from) / 100));
      for (const t of bounds2)
        ends.push(t, Math.min(t + 0.01, to));
      let start2 = from;
      for (const end of ends.sort(byTime)) {
        end > start2 && split(start2, end, 0);
        start2 = end;
      }
      return times.sort(byTime);
    };
    const getTween = (moving) => {
      let shared;
      for (const track of moving) {
        const tween = track.tween();
        if (!tween || shared?.some((v, i) => i < 2 ? Math.abs(tween[i] - v) > 1 : tween[i] !== v)) {
          return;
        }
        shared = tween;
      }
      return shared;
    };
    const run = (moving, from, to, options = { fill: "both" }, settled, nativeEasing) => {
      const bounds2 = moving.flatMap((track) => track.boundaries(from, to));
      const easing = nativeEasing || getEasing(moving, from, to, bounds2);
      const times = easing ? [from, to] : sample(moving, from, to, bounds2);
      const transform = times.map((t) => compose(t, settled));
      let keyframes2 = { transform };
      if (!easing) {
        keyframes2.offset = times.map((t) => progress(from, to, t));
      }
      if (transform.every((t) => t === transform[0])) {
        commit(valuesAt(from, settled));
        keyframes2 = null;
      }
      return element.animate(keyframes2, {
        ...options,
        duration: to - from,
        easing: easing || "linear"
      });
    };
    const animate2 = (now2) => {
      let end = now2;
      let cycle = 0;
      let cycleStart = 0;
      const moving = [];
      const looping = [];
      const ends = /* @__PURE__ */ new Set();
      byKey.clear();
      built = /* @__PURE__ */ new Map();
      for (const track of tracks) {
        byKey.set(track.name, track);
        const [trackEnd, trackCycle] = track.timing();
        const isHeld = trackEnd === Infinity;
        built.set(track, [track.at(now2), track.speed, isHeld]);
        if (isHeld) {
          track.sync();
          continue;
        }
        if (track.speed < 0)
          return;
        if (trackCycle) {
          if (cycle) {
            const phase = (trackEnd - cycleStart) / trackCycle;
            if (Math.abs(trackCycle - cycle) > 1 || Math.abs(phase - Math.round(phase)) * cycle > 1) {
              return;
            }
          } else {
            cycle = trackCycle;
            cycleStart = trackEnd;
          }
          looping.push(track);
        } else {
          ends.add(trackEnd);
        }
        moving.push(track);
        end = Math.max(end, trackEnd);
      }
      statics = {};
      keys = transformPropOrder.filter((key2) => {
        if (byKey.has(key2))
          return true;
        const value = statics[key2] = read(owner, key2);
        return value !== void 0 && parseFloat(value) !== (key2.startsWith("scale") ? 1 : 0);
      });
      stop(false);
      const tween = !cycle && getTween(moving);
      try {
        if (tween && tween[1] > now2) {
          const [from, to, easing] = tween;
          add(run(moving, from, to, void 0, void 0, easing), from - now2, to - from);
        } else if (end > now2) {
          add(run(moving, now2, end), 0, end - now2);
          ends.forEach((trackEnd) => trackEnd < end - 1 && add(element.animate(null, {
            duration: trackEnd - now2
          }), 0, trackEnd - now2));
        }
        if (cycle) {
          const from = cycleStart + Math.floor((end - cycleStart) / cycle) * cycle;
          add(run(looping, from, from + cycle, {
            iterations: Infinity,
            iterationStart: (end - from) / cycle,
            /**
             * It must not fill backwards over the finite part
             * that runs before it.
             */
            fill: "forwards"
          }, end), end - now2);
        }
      } catch {
        return;
      }
      segments.length || stop();
      return true;
    };
    const retime = (now2) => {
      let elapsed;
      let rate = 0;
      for (const track of tracks) {
        const state3 = built.get(track);
        if (!state3)
          return false;
        const [builtTime, builtSpeed, wasHeld] = state3;
        const trackTime = track.at(now2);
        const isHeld = track.timing()[0] === Infinity;
        if (wasHeld) {
          if (isHeld && trackTime === builtTime)
            continue;
          return false;
        }
        const trackElapsed = (trackTime - builtTime) / builtSpeed;
        const trackRate = isHeld ? 0 : track.speed / builtSpeed;
        if (elapsed === void 0) {
          elapsed = trackElapsed;
          rate = trackRate;
        } else if (Math.abs(trackElapsed - elapsed) > 1 || trackRate !== rate) {
          return false;
        }
      }
      if (elapsed === void 0)
        return true;
      if (!segments.length)
        return false;
      for (const { offset, end, isDone } of segments) {
        const local = elapsed - offset;
        if (end < Infinity && (isDone ? local < end - 1 : local < 0 || local >= end)) {
          return false;
        }
      }
      for (const { animation, offset, isDone } of segments) {
        if (isDone)
          continue;
        const local = elapsed - offset;
        if (rate) {
          animation.playbackRate = rate;
          animation.startTime = now2 - local / rate;
        } else {
          animation.pause();
          animation.currentTime = local;
        }
      }
      return true;
    };
    const build = () => {
      const now2 = time.now();
      if (!group.isJS) {
        group.isFinishing = true;
        tracks.forEach((track) => {
          const [trackEnd, trackCycle] = track.timing();
          if (track.state === "running" && track.speed > 0 && !trackCycle && trackEnd <= now2 + 1) {
            track.complete();
            statics[track.name] = read(owner, track.name);
            built.has(track) || (needsBuild = true);
          }
        });
        group.isFinishing = false;
      }
      isScheduled2 = false;
      tracks.forEach(({ state: state3 }, track) => {
        if (state3 === "idle" || state3 === "finished")
          tracks.delete(track);
      });
      if (!tracks.size) {
        transformGroups.delete(element);
        group.isJS || stop();
        return;
      }
      for (const track of tracks) {
        if (!track.canAccelerate)
          return group.demote(true);
      }
      if (group.isJS) {
        group.isJS = false;
        needsBuild = true;
        tracks.forEach((track) => track.js?.stop());
      }
      const shouldBuild = needsBuild;
      const churned = hasChurned;
      needsBuild = hasChurned = false;
      if (shouldBuild || !retime(now2)) {
        if (churned) {
          if (now2 - lastChurn < churnWindow)
            return group.demote();
          lastChurn = now2;
        }
        if (!animate2(now2))
          return group.demote();
      }
    };
    const group = {
      tracks,
      isJS: false,
      isFinishing: false,
      schedule(build_, isChurn) {
        needsBuild || (needsBuild = build_);
        hasChurned || (hasChurned = !!isChurn);
        if (!isScheduled2) {
          isScheduled2 = true;
          frameData.isProcessing ? frame2.render(build, false, true) : queueMicrotask(build);
        }
      },
      /**
       * An outside write. Rebuild once, but if it keeps happening, move
       * to the main thread.
       */
      check() {
        if (group.isJS)
          return;
        for (const key2 in statics) {
          if (read(owner, key2) !== statics[key2] && !has(key2)) {
            return group.schedule(true, true);
          }
        }
      },
      demote(canReturn) {
        if (group.isJS)
          return;
        tracks.forEach((track) => {
          track.isAccelerated() && track.sync();
          canReturn || (track.canAccelerate = false);
        });
        group.isJS = true;
        built = /* @__PURE__ */ new Map();
        stop();
        tracks.forEach((track) => track.state === "running" && track.js?.start());
      }
    };
    transformGroups.set(element, group);
    return group;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/AsyncMotionValueAnimation.mjs
  var AsyncMotionValueAnimation = class extends WithPromise {
    constructor(options) {
      super();
      this.stop = () => {
        if (this._animation) {
          this._animation.stop();
          this.stopTimeline?.();
        }
        this.keyframeResolver?.cancel();
      };
      this.createdAt = time.now();
      const { keyframes: keyframes2, name, motionValue: motionValue2, element } = options;
      const optionsWithDefaults = options;
      optionsWithDefaults.autoplay ?? (optionsWithDefaults.autoplay = true);
      optionsWithDefaults.delay ?? (optionsWithDefaults.delay = 0);
      optionsWithDefaults.type ?? (optionsWithDefaults.type = "keyframes");
      optionsWithDefaults.repeat ?? (optionsWithDefaults.repeat = 0);
      optionsWithDefaults.repeatDelay ?? (optionsWithDefaults.repeatDelay = 0);
      optionsWithDefaults.repeatType ?? (optionsWithDefaults.repeatType = "loop");
      const KeyframeResolver$1 = element?.KeyframeResolver || KeyframeResolver;
      this.keyframeResolver = new KeyframeResolver$1(keyframes2, (resolvedKeyframes, finalKeyframe, forced) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe, optionsWithDefaults, !forced), name, motionValue2, element);
      this.keyframeResolver?.scheduleResolve();
    }
    onKeyframesResolved(keyframes2, finalKeyframe, options, sync) {
      this.keyframeResolver = void 0;
      const { name, type, velocity, delay, isHandoff, onUpdate } = options;
      this.resolvedAt = time.now();
      let canAnimateValue = true;
      if (!canAnimate2(keyframes2, name, type, velocity)) {
        canAnimateValue = false;
        if (MotionGlobalConfig.instantAnimations || !delay) {
          onUpdate?.(getFinalKeyframe(keyframes2, options, finalKeyframe));
        }
        keyframes2[0] = keyframes2[keyframes2.length - 1];
        makeAnimationInstant(options);
        options.repeat = 0;
      }
      const { onComplete } = options;
      options.finalKeyframe = finalKeyframe;
      options.keyframes = keyframes2;
      options.onComplete = () => {
        onComplete?.();
        this.notifyFinished();
      };
      const useWaapi = canAnimateValue && !isHandoff && supportsBrowserAnimation(options);
      const isGroupedTransform = !useWaapi && canGroupTransform(options);
      if (sync && (useWaapi || isGroupedTransform || this.resolvedAt !== this.createdAt)) {
        options.startTime ?? (options.startTime = resolveStartTime(this.createdAt, this.resolvedAt));
      }
      let animation;
      if (useWaapi) {
        options.element = options.motionValue?.owner?.current;
        try {
          animation = new NativeAnimationExtended(options);
        } catch {
          animation = new JSAnimation(options);
        }
      } else if (isGroupedTransform) {
        animation = new TransformAnimation(options);
      } else {
        animation = new JSAnimation(options);
      }
      if (this.pendingTimeline) {
        this.stopTimeline = animation.attachTimeline(this.pendingTimeline);
        this.pendingTimeline = void 0;
      }
      this._animation = animation;
    }
    get finished() {
      return this._animation ? this._animation.finished : super.finished;
    }
    then(onResolve, _onReject) {
      return this.finished.finally(onResolve).then(() => {
      });
    }
    /**
     * The value now, if the animation runs on the compositor.
     */
    liveValue() {
      return this._animation?.liveValue?.();
    }
    get animation() {
      if (!this._animation) {
        this.keyframeResolver?.resume();
        flushKeyframeResolvers();
      }
      return this._animation;
    }
    get duration() {
      return this.animation.duration;
    }
    get iterationDuration() {
      return this.animation.iterationDuration;
    }
    get time() {
      return this.animation.time;
    }
    set time(newTime) {
      this.animation.time = newTime;
    }
    get speed() {
      return this.animation.speed;
    }
    get state() {
      return this.animation.state;
    }
    set speed(newSpeed) {
      this.animation.speed = newSpeed;
    }
    get startTime() {
      return this.animation.startTime;
    }
    attachTimeline(timeline) {
      if (this._animation) {
        this.stopTimeline = this.animation.attachTimeline(timeline);
      } else {
        this.pendingTimeline = timeline;
      }
      return () => this.stop();
    }
    play() {
      this.animation.play();
    }
    pause() {
      this.animation.pause();
    }
    complete() {
      this.animation.complete();
    }
    cancel() {
      if (this._animation) {
        this.animation.cancel();
      }
      this.keyframeResolver?.cancel();
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/GroupAnimation.mjs
  var GroupAnimation = class {
    constructor(animations) {
      this.stop = () => this.runAll("stop");
      this.animations = animations.filter(Boolean);
    }
    get finished() {
      return Promise.all(this.animations.map((animation) => animation.finished));
    }
    /**
     * TODO: Filter out cancelled or stopped animations before returning
     */
    getAll(propName) {
      return this.animations[0][propName];
    }
    setAll(propName, newValue) {
      for (let i = 0; i < this.animations.length; i++) {
        this.animations[i][propName] = newValue;
      }
    }
    attachTimeline(timeline) {
      const subscriptions = this.animations.map((animation) => animation.attachTimeline(timeline));
      return () => {
        subscriptions.forEach((cancel, i) => {
          cancel && cancel();
          this.animations[i].stop();
        });
      };
    }
    get time() {
      return this.getAll("time");
    }
    set time(time2) {
      this.setAll("time", time2);
    }
    get speed() {
      return this.getAll("speed");
    }
    set speed(speed) {
      this.setAll("speed", speed);
    }
    get state() {
      return this.getAll("state");
    }
    get startTime() {
      return this.getAll("startTime");
    }
    get duration() {
      return getMax(this.animations, "duration");
    }
    get iterationDuration() {
      return getMax(this.animations, "iterationDuration");
    }
    runAll(methodName) {
      this.animations.forEach((controls) => controls[methodName]());
    }
    play() {
      this.runAll("play");
    }
    pause() {
      this.runAll("pause");
    }
    cancel() {
      this.runAll("cancel");
    }
    complete() {
      this.runAll("complete");
    }
  };
  function getMax(animations, propName) {
    let max = 0;
    for (let i = 0; i < animations.length; i++) {
      const value = animations[i][propName];
      if (value !== null && value > max) {
        max = value;
      }
    }
    return max;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/GroupAnimationWithThen.mjs
  var GroupAnimationWithThen = class extends GroupAnimation {
    then(onResolve, _onReject) {
      return this.finished.finally(onResolve).then(() => {
      });
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/index.mjs
  var MAX_VELOCITY_DELTA = 30;
  var isFloat = (value) => {
    return !isNaN(parseFloat(value));
  };
  var collectMotionValues = {
    current: void 0
  };
  var MotionValue = class {
    /**
     * @param init - The initiating value
     * @param config - Optional configuration options
     *
     * -  `transformer`: A function to transform incoming values with.
     */
    constructor(init, options = {}) {
      this.canTrackVelocity = null;
      this.events = {};
      this.updateAndNotify = (v) => {
        const currentTime = time.now();
        if (this.updatedAt !== currentTime) {
          this.setPrevFrameValue();
        }
        this.prev = this.current;
        this.setCurrent(v);
        if (this.current !== this.prev) {
          this.notifyChange();
          if (this.dependents) {
            for (const dependent of this.dependents) {
              dependent.dirty();
            }
          }
        }
      };
      this.hasAnimated = false;
      this.setCurrent(init);
      this.owner = options.owner;
    }
    setCurrent(current2) {
      this.current = current2;
      this.updatedAt = time.now();
      if (this.canTrackVelocity === null && current2 !== void 0) {
        this.canTrackVelocity = isFloat(this.current);
      }
    }
    setPrevFrameValue(prevFrameValue = this.current) {
      this.prevFrameValue = prevFrameValue;
      this.prevUpdatedAt = this.updatedAt;
    }
    /**
     * Adds a function that will be notified when the `MotionValue` is updated.
     *
     * It returns a function that, when called, will cancel the subscription.
     *
     * When calling `onChange` inside a React component, it should be wrapped with the
     * `useEffect` hook. As it returns an unsubscribe function, this should be returned
     * from the `useEffect` function to ensure you don't add duplicate subscribers..
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *   const y = useMotionValue(0)
     *   const opacity = useMotionValue(1)
     *
     *   useEffect(() => {
     *     function updateOpacity() {
     *       const maxXY = Math.max(x.get(), y.get())
     *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
     *       opacity.set(newOpacity)
     *     }
     *
     *     const unsubscribeX = x.on("change", updateOpacity)
     *     const unsubscribeY = y.on("change", updateOpacity)
     *
     *     return () => {
     *       unsubscribeX()
     *       unsubscribeY()
     *     }
     *   }, [])
     *
     *   return <motion.div style={{ x }} />
     * }
     * ```
     *
     * @param subscriber - A function that receives the latest value.
     * @returns A function that, when called, will cancel this subscription.
     *
     * @deprecated
     */
    onChange(subscription) {
      if (true) {
        warnOnce(false, `value.onChange(callback) is deprecated. Switch to value.on("change", callback).`);
      }
      return this.on("change", subscription);
    }
    on(eventName, callback) {
      var _a;
      if (eventName === "change")
        return this.onChangeSubscribe(callback);
      return ((_a = this.events)[eventName] || (_a[eventName] = new SubscriptionManager())).add(callback);
    }
    onChangeSubscribe(callback) {
      const { events } = this;
      if (!events.change && !this.changeSubscriber) {
        this.changeSubscriber = callback;
      } else {
        if (!events.change) {
          events.change = new SubscriptionManager();
          events.change.add(this.changeSubscriber);
          this.changeSubscriber = void 0;
        }
        events.change.add(callback);
      }
      return () => {
        if (this.changeSubscriber === callback) {
          this.changeSubscriber = void 0;
        } else {
          events.change?.remove(callback);
        }
        this.stopIfUnobserved();
      };
    }
    /**
     * If we have no more change listeners by the start
     * of the next frame, stop active animations.
     */
    stopIfUnobserved() {
      frame2.read(() => {
        if (!this.changeSubscriber && !this.events.change?.getSize()) {
          this.stop();
        }
      });
    }
    clearListeners() {
      this.changeSubscriber = void 0;
      for (const eventManagers in this.events) {
        this.events[eventManagers].clear();
      }
    }
    /**
     * Attaches a passive effect to the `MotionValue`.
     */
    attach(passiveEffect, stopPassiveEffect) {
      this.passiveEffect = passiveEffect;
      this.stopPassiveEffect = stopPassiveEffect;
    }
    /**
     * Sets the state of the `MotionValue`.
     *
     * @remarks
     *
     * ```jsx
     * const x = useMotionValue(0)
     * x.set(10)
     * ```
     *
     * @param latest - Latest value to set.
     * @param render - Whether to notify render subscribers. Defaults to `true`
     *
     * @public
     */
    set(v) {
      if (!this.passiveEffect) {
        this.updateAndNotify(v);
      } else {
        this.passiveEffect(v, this.updateAndNotify);
      }
    }
    setWithVelocity(prev, current2, delta) {
      this.set(current2);
      this.prev = void 0;
      this.prevFrameValue = prev;
      this.prevUpdatedAt = this.updatedAt - delta;
    }
    /**
     * Set the state of the `MotionValue`, stopping any active animations,
     * effects, and resets velocity to `0`.
     */
    jump(v, endAnimation = true) {
      this.updateAndNotify(v);
      this.prev = v;
      this.prevUpdatedAt = this.prevFrameValue = void 0;
      endAnimation && this.stop();
      if (this.stopPassiveEffect)
        this.stopPassiveEffect();
    }
    dirty() {
      this.notifyChange();
    }
    notifyChange() {
      const { current: current2, changeSubscriber } = this;
      if (changeSubscriber) {
        changeSubscriber(current2);
      } else {
        this.events.change?.notify(current2);
      }
    }
    addDependent(dependent) {
      if (!this.dependents) {
        this.dependents = /* @__PURE__ */ new Set();
      }
      this.dependents.add(dependent);
    }
    removeDependent(dependent) {
      if (this.dependents) {
        this.dependents.delete(dependent);
      }
    }
    /**
     * Returns the latest state of `MotionValue`
     *
     * @returns - The latest state of `MotionValue`
     *
     * @public
     */
    get() {
      if (collectMotionValues.current) {
        collectMotionValues.current.push(this);
      }
      const sampled = this.animation?.liveValue?.();
      return sampled === void 0 ? this.current : sampled;
    }
    /**
     * The value as last set. Unlike get(), this doesn't read an animation
     * running on the compositor, which renders the value itself.
     */
    getCurrent() {
      return this.current;
    }
    /**
     * @public
     */
    getPrevious() {
      return this.prev;
    }
    /**
     * Returns the latest velocity of `MotionValue`
     *
     * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
     *
     * @public
     */
    getVelocity() {
      const currentTime = time.now();
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || currentTime - this.updatedAt > MAX_VELOCITY_DELTA) {
        return 0;
      }
      const delta = Math.min(this.updatedAt - this.prevUpdatedAt, MAX_VELOCITY_DELTA);
      return velocityPerSecond(parseFloat(this.current) - parseFloat(this.prevFrameValue), delta);
    }
    /**
     * Registers a new animation to control this `MotionValue`. Only one
     * animation can drive a `MotionValue` at one time.
     *
     * ```jsx
     * value.start()
     * ```
     *
     * @param animation - A function that starts the provided animation
     */
    start(startAnimation) {
      this.stop();
      return new Promise((resolve) => {
        this.hasAnimated = true;
        let isComplete = false;
        let animation;
        animation = startAnimation(() => {
          isComplete = true;
          this.events.animationComplete?.notify();
          if (this.animation === animation)
            this.clearAnimation();
          resolve();
        });
        if (!isComplete)
          this.animation = animation;
        this.events.animationStart?.notify();
      });
    }
    /**
     * Stop the currently active animation.
     *
     * @public
     */
    stop() {
      if (this.animation) {
        this.animation.stop();
        if (this.events.animationCancel) {
          this.events.animationCancel.notify();
        }
      }
      this.clearAnimation();
    }
    /**
     * Returns `true` if this value is currently animating.
     *
     * @public
     */
    isAnimating() {
      return !!this.animation;
    }
    clearAnimation() {
      this.animation = void 0;
    }
    /**
     * Destroy and clean up subscribers to this `MotionValue`.
     *
     * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
     * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
     * created a `MotionValue` via the `motionValue` function.
     *
     * @public
     */
    destroy() {
      this.dependents?.clear();
      this.events.destroy?.notify();
      this.clearListeners();
      this.stop();
      if (this.stopPassiveEffect) {
        this.stopPassiveEffect();
      }
    }
  };
  function motionValue(init, options) {
    return new MotionValue(init, options);
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/resolve-transition.mjs
  function resolveTransition(transition, parentTransition) {
    if (transition?.inherit && parentTransition) {
      const { inherit: _, ...rest } = transition;
      return { ...parentTransition, ...rest };
    }
    return transition;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/get-value-transition.mjs
  function getValueTransition(transition, key2) {
    const valueTransition = transition?.[key2] ?? transition?.["default"] ?? transition;
    if (valueTransition !== transition) {
      return resolveTransition(valueTransition, transition);
    }
    return valueTransition;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/default-transitions.mjs
  var underDampedSpring = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  };
  var criticallyDampedSpring = (target) => ({
    type: "spring",
    stiffness: 550,
    damping: target === 0 ? 2 * Math.sqrt(550) : 30,
    restSpeed: 10
  });
  var keyframesTransition = {
    type: "keyframes",
    duration: 0.8
  };
  var ease = {
    type: "keyframes",
    ease: [0.25, 0.1, 0.35, 1],
    duration: 0.3
  };
  var getDefaultTransition = (valueKey, { keyframes: keyframes2 }) => {
    if (keyframes2.length > 2) {
      return keyframesTransition;
    } else if (transformProps.has(valueKey)) {
      return valueKey.startsWith("scale") ? criticallyDampedSpring(keyframes2[1]) : underDampedSpring;
    }
    return ease;
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/is-transition-defined.mjs
  var orchestrationKeys = /* @__PURE__ */ new Set([
    "when",
    "delay",
    "delayChildren",
    "staggerChildren",
    "staggerDirection",
    "repeat",
    "repeatType",
    "repeatDelay",
    "from",
    "elapsed"
  ]);
  function isTransitionDefined(transition) {
    for (const key2 in transition) {
      if (!orchestrationKeys.has(key2))
        return true;
    }
    return false;
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/interfaces/motion-value.mjs
  var animateMotionValue = (name, value, target, transition = {}, element, isHandoff) => (onComplete) => {
    const valueTransition = getValueTransition(transition, name) || {};
    const delay = valueTransition.delay || transition.delay || 0;
    let { elapsed = 0 } = transition;
    elapsed = elapsed - secondsToMilliseconds(delay);
    const options = {
      keyframes: Array.isArray(target) ? target : [null, target],
      ease: "easeOut",
      velocity: value.getVelocity(),
      ...valueTransition,
      delay: -elapsed,
      onUpdate: (v) => {
        value.set(v);
        valueTransition.onUpdate && valueTransition.onUpdate(v);
      },
      onComplete: () => {
        onComplete();
        valueTransition.onComplete && valueTransition.onComplete();
      },
      name,
      motionValue: value,
      element: isHandoff ? void 0 : element,
      hasOnUpdate: !!valueTransition.onUpdate
    };
    if (!isTransitionDefined(valueTransition)) {
      Object.assign(options, getDefaultTransition(name, options));
    }
    options.duration && (options.duration = secondsToMilliseconds(options.duration));
    options.repeatDelay && (options.repeatDelay = secondsToMilliseconds(options.repeatDelay));
    if (options.from !== void 0) {
      options.keyframes[0] = options.from;
    }
    let shouldSkip = false;
    if (options.type === false || options.duration === 0 && !options.repeatDelay) {
      makeAnimationInstant(options);
      if (options.delay === 0) {
        shouldSkip = true;
      }
    }
    if (MotionGlobalConfig.instantAnimations || MotionGlobalConfig.skipAnimations || element?.shouldSkipAnimations || valueTransition.skipAnimations) {
      shouldSkip = true;
      makeAnimationInstant(options);
      options.delay = 0;
    }
    options.allowFlatten = !valueTransition.type && !valueTransition.ease;
    if (shouldSkip && !isHandoff && value.get() !== void 0) {
      const finalKeyframe = getFinalKeyframe(options.keyframes, valueTransition);
      if (finalKeyframe !== void 0) {
        frame2.update(() => {
          options.onUpdate(finalKeyframe);
          options.onComplete();
        });
        return;
      }
    }
    return valueTransition.isSync ? new JSAnimation(options) : new AsyncMotionValueAnimation(options);
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/utils/css-variables-conversion.mjs
  var splitCSSVariableRegex = (
    // eslint-disable-next-line redos-detector/no-unsafe-regex -- false positive, as it can match a lot of words
    /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u
  );
  function parseCSSVariable(current2) {
    const match = splitCSSVariableRegex.exec(current2);
    if (!match)
      return [,];
    const [, token1, token2, fallback] = match;
    return [`--${token1 ?? token2}`, fallback];
  }
  var maxDepth = 4;
  function getVariableValue(current2, element, depth = 1) {
    invariant(depth <= maxDepth, `Max CSS variable fallback depth detected in property "${current2}". This may indicate a circular fallback dependency.`, "max-css-var-depth");
    const [token, fallback] = parseCSSVariable(current2);
    if (!token)
      return;
    const resolved = window.getComputedStyle(element).getPropertyValue(token);
    if (resolved) {
      const trimmed = resolved.trim();
      return isNumericalString(trimmed) ? parseFloat(trimmed) : trimmed;
    }
    return isCSSVariableToken(fallback) ? getVariableValue(fallback, element, depth + 1) : fallback;
  }

  // ../../code/node_modules/motion-dom/dist/es/render/utils/keys-position.mjs
  var positionalKeys = /* @__PURE__ */ new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    ...transformPropOrder
  ]);

  // ../../code/node_modules/motion-dom/dist/es/value/utils/is-motion-value.mjs
  var isMotionValue = (value) => Boolean(value && value.getVelocity);

  // ../../code/node_modules/motion-dom/dist/es/render/dom/utils/camel-to-dash.mjs
  function camelToDash(str2) {
    return str2.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
  }

  // ../../code/node_modules/motion-dom/dist/es/value/types/auto.mjs
  var auto = {
    test: (v) => v === "auto",
    parse: (v) => v
  };

  // ../../code/node_modules/motion-dom/dist/es/value/types/test.mjs
  var testValueType = (v) => (type) => type.test(v);

  // ../../code/node_modules/motion-dom/dist/es/value/types/dimensions.mjs
  var dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto];
  var findDimensionValueType = (v) => dimensionValueTypes.find(testValueType(v));

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/utils/is-none.mjs
  function isNone(value) {
    if (typeof value === "number") {
      return value === 0;
    } else if (value !== null) {
      return value === "none" || value === "0" || isZeroValueString(value);
    } else {
      return true;
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/utils/make-none-animatable.mjs
  var invalidTemplates = /* @__PURE__ */ new Set(["auto", "none", "0"]);
  function makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name) {
    let i = 0;
    let animatableTemplate = void 0;
    while (i < unresolvedKeyframes.length && !animatableTemplate) {
      const keyframe2 = unresolvedKeyframes[i];
      if (typeof keyframe2 === "string" && !invalidTemplates.has(keyframe2) && hasComplexValues(keyframe2)) {
        animatableTemplate = unresolvedKeyframes[i];
      }
      i++;
    }
    if (animatableTemplate && name) {
      for (const noneIndex of noneKeyframeIndexes) {
        if (unresolvedKeyframes[noneIndex] === animatableTemplate)
          continue;
        unresolvedKeyframes[noneIndex] = getAnimatableNone2(name, animatableTemplate);
      }
    }
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/keyframes/DOMKeyframesResolver.mjs
  var DOMKeyframesResolver = class extends KeyframeResolver {
    constructor(unresolvedKeyframes, onComplete, name, motionValue2, element) {
      super(unresolvedKeyframes, onComplete, name, motionValue2, element, true);
    }
    /**
     * Keyframes that don't need reading from the DOM, or measuring,
     * resolve straight away rather than in the frame loop's batched read.
     */
    scheduleResolve() {
      if (this.canReadNow()) {
        this.readKeyframes();
        if (!this.needsMeasurement)
          return this.complete();
      }
      super.scheduleResolve();
    }
    canReadNow() {
      const { unresolvedKeyframes, element, motionValue: motionValue2 } = this;
      const origin = unresolvedKeyframes[0] ?? motionValue2?.get();
      if (!element?.current || origin === void 0)
        return false;
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        if (containsCSSVariable(i ? unresolvedKeyframes[i] : origin)) {
          return false;
        }
      }
      return true;
    }
    readKeyframes() {
      const { unresolvedKeyframes, element, name } = this;
      if (!element || !element.current)
        return;
      super.readKeyframes();
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        let keyframe2 = unresolvedKeyframes[i];
        if (typeof keyframe2 === "string") {
          keyframe2 = keyframe2.trim();
          if (isCSSVariableToken(keyframe2)) {
            const resolved = getVariableValue(keyframe2, element.current);
            if (resolved !== void 0) {
              unresolvedKeyframes[i] = resolved;
            }
            if (i === unresolvedKeyframes.length - 1) {
              this.finalKeyframe = keyframe2;
            }
          }
        }
      }
      this.resolveNoneKeyframes();
      if (!positionalKeys.has(name) || unresolvedKeyframes.length !== 2) {
        return;
      }
      const [origin, target] = unresolvedKeyframes;
      if (typeof origin === "number" && typeof target === "number")
        return;
      const originType = findDimensionValueType(origin);
      const targetType = findDimensionValueType(target);
      const originHasVar = containsCSSVariable(origin);
      const targetHasVar = containsCSSVariable(target);
      if (originHasVar !== targetHasVar && positionalValues[name]) {
        this.needsMeasurement = true;
        return;
      }
      if (originType === targetType)
        return;
      if (isNumOrPxType(originType) && isNumOrPxType(targetType)) {
        for (let i = 0; i < unresolvedKeyframes.length; i++) {
          const value = unresolvedKeyframes[i];
          if (typeof value === "string") {
            unresolvedKeyframes[i] = parseFloat(value);
          }
        }
      } else if (positionalValues[name]) {
        this.needsMeasurement = true;
      }
    }
    resolveNoneKeyframes() {
      const { unresolvedKeyframes, name } = this;
      const noneKeyframeIndexes = [];
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        if (unresolvedKeyframes[i] === null || isNone(unresolvedKeyframes[i])) {
          noneKeyframeIndexes.push(i);
        }
      }
      if (noneKeyframeIndexes.length) {
        makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name);
      }
    }
    measure() {
      const { element, name } = this;
      return positionalValues[name](window.getComputedStyle(element.current), () => element.measureViewportBox());
    }
    measureInitialState() {
      const { element, unresolvedKeyframes, name } = this;
      if (!element || !element.current)
        return;
      if (name === "height") {
        this.suspendedScrollY = window.pageYOffset;
      }
      this.measuredOrigin = this.measure();
      unresolvedKeyframes[0] = this.measuredOrigin;
      const measureKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
      if (measureKeyframe !== void 0) {
        this.motionValue?.jump(measureKeyframe, false);
      }
    }
    measureEndState() {
      const { element, unresolvedKeyframes } = this;
      if (!element || !element.current)
        return;
      this.motionValue?.jump(this.measuredOrigin, false);
      const finalKeyframeIndex = unresolvedKeyframes.length - 1;
      const finalKeyframe = unresolvedKeyframes[finalKeyframeIndex];
      unresolvedKeyframes[finalKeyframeIndex] = this.measure();
      if (finalKeyframe !== null && this.finalKeyframe === void 0) {
        this.finalKeyframe = finalKeyframe;
      }
      if (this.removedTransforms?.length) {
        this.removedTransforms.forEach(([unsetTransformName, unsetTransformValue]) => {
          element.getValue(unsetTransformName).set(unsetTransformValue);
        });
      }
      this.resolveNoneKeyframes();
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/animation/animate/effects.mjs
  var effects = [];
  function addEffect(effect) {
    invariant(typeof effect.test === "function" && typeof effect.read === "function", "Effects passed to animate.addEffect() need test() and read().", "effect-missing-test");
    removeEffect(effect);
    effects.unshift(effect);
  }
  function removeEffect(effect) {
    removeItem(effects, effect);
  }
  function findEffect(subject2) {
    return effects.find((effect) => effect.test(subject2));
  }
  function animateValues(getValue, keyframes2, transition = {}, element) {
    const animations = [];
    const { velocity } = transition;
    const reduceMotion = transition.reduceMotion ?? element?.shouldReduceMotion;
    for (const key2 in keyframes2) {
      if (key2 === "transition" || key2 === "transitionEnd")
        continue;
      const target = keyframes2[key2];
      if (target === void 0)
        continue;
      const value = getValue(key2);
      const current2 = value.get();
      if (current2 !== void 0 && !value.isAnimating() && !Array.isArray(target) && target === current2 && !velocity) {
        frame2.update(() => value.set(target));
        continue;
      }
      value.start(animateMotionValue(key2, value, target, reduceMotion && positionalKeys.has(key2) ? { type: false } : transition, element));
      value.animation && animations.push(value.animation);
    }
    const { transitionEnd } = keyframes2;
    if (transitionEnd) {
      const applyTransitionEnd = () => frame2.update(() => {
        for (const key2 in transitionEnd) {
          getValue(key2).set(transitionEnd[key2]);
        }
      });
      animations.length ? Promise.all(animations).then(applyTransitionEnd) : applyTransitionEnd();
    }
    return animations;
  }
  function animateEffectSubject(effect, subject2, keyframes2, transition, element) {
    return animateValues((key2) => {
      let value = effect.get(subject2, key2);
      if (!value) {
        let initial;
        if (!element) {
          const target = keyframes2[key2];
          initial = firstKeyframe(target) ?? effect.read(subject2, key2, target);
          invariant(initial !== void 0, `"${key2}" can't be read from the animated subject. Provide [from, to] keyframes.`, "effect-unreadable-value");
        }
        value = motionValue(initial, { owner: element });
        effect(subject2, { [key2]: value });
      }
      return value;
    }, keyframes2, transition, element);
  }
  function firstKeyframe(target) {
    const first = Array.isArray(target) ? target[0] : void 0;
    return first === null ? void 0 : first;
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/is-html-element.mjs
  function isHTMLElement(element) {
    return isObject(element) && "offsetHeight" in element && !("ownerSVGElement" in element);
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/is-svg-element.mjs
  function isSVGElement(element) {
    return isObject(element) && "ownerSVGElement" in element;
  }

  // ../../code/node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
  function resolveElements(elementOrSelector, scope, selectorCache) {
    if (elementOrSelector == null) {
      return [];
    }
    if (elementOrSelector instanceof EventTarget) {
      return [elementOrSelector];
    } else if (typeof elementOrSelector === "string") {
      let root = document;
      if (scope) {
        root = scope.current;
      }
      const elements = selectorCache?.[elementOrSelector] ?? root.querySelectorAll(elementOrSelector);
      return elements ? Array.from(elements) : [];
    }
    return Array.from(elementOrSelector).filter((element) => element != null);
  }

  // ../../code/node_modules/motion-dom/dist/es/effects/utils/create-dom-effect.mjs
  function createSelectorEffect(subjectEffect) {
    const effect = (subject2, values) => {
      const elements = resolveElements(subject2);
      const subscriptions = [];
      for (const element of elements) {
        const remove = subjectEffect(element, values);
        subscriptions.push(remove);
      }
      return () => {
        for (const remove of subscriptions)
          remove();
      };
    };
    const { test: test2, read: read2, get, flush: flush2, state: state3 } = subjectEffect;
    return Object.assign(effect, {
      test: test2,
      read: read2,
      get,
      flush: flush2,
      state: state3
    });
  }

  // ../../code/node_modules/motion-dom/dist/es/effects/MotionValueState.mjs
  var MotionValueState = class {
    /**
     * @param step - The frameloop step renders are scheduled in. Defaults
     * to `frame.render`. Effects that feed a render loop running in
     * `frame.render` (GPU scenes) should write in `frame.preRender`.
     */
    constructor(step = frame2.render) {
      this.step = step;
      this.values = /* @__PURE__ */ new Map();
      this.pending = [];
      this.numPending = 0;
      this.flush = () => {
        const { pending: pending2, numPending } = this;
        this.numPending = 0;
        for (let i = 0; i < numPending; i++)
          pending2[i]();
      };
    }
    /**
     * @param render - Writes the value to the subject. Renders read the
     * motion value directly rather than a cached copy, so there is one
     * place a value lives.
     * @param computed - A value already in this state (e.g. `transform`)
     * whose render should run whenever `value` changes.
     */
    set(name, value, render, computed) {
      this.values.get(name)?.onRemove();
      if (computed) {
        for (const entry of this.values.values()) {
          if (entry.value === computed)
            render = entry.render;
        }
      }
      const onChange = () => render && this.schedule(render);
      value.get() !== void 0 && onChange();
      const cancelOnChange = value.on("change", onChange);
      const onRemove = () => {
        cancelOnChange();
        render && !computed && this.cancel(render);
        this.values.get(name)?.onRemove === onRemove && this.values.delete(name);
      };
      this.values.set(name, {
        value,
        render: computed ? void 0 : render,
        onRemove
      });
      return onRemove;
    }
    get(name) {
      return this.values.get(name)?.value;
    }
    /**
     * Detach every value from this state and return them, so another
     * renderer can take them over. The state stays cached by its effect,
     * so the bound transforms are reset too rather than leaking into
     * values bound later.
     */
    release() {
      const values = /* @__PURE__ */ new Map();
      this.values.forEach((entry, name) => {
        values.set(name, entry.value);
        entry.onRemove();
      });
      this.transformKeys = this.transformValues = void 0;
      return values;
    }
    schedule(render) {
      const { pending: pending2, numPending } = this;
      for (let i = 0; i < numPending; i++) {
        if (pending2[i] === render)
          return;
      }
      numPending || this.step(this.flush);
      pending2[this.numPending++] = render;
    }
    cancel(render) {
      const { pending: pending2 } = this;
      for (let i = 0; i < this.numPending; i++) {
        if (pending2[i] === render) {
          pending2[i] = pending2[--this.numPending];
          return;
        }
      }
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/effects/utils/create-effect.mjs
  function createEffect(addValue, { step, ...options } = {}) {
    const stateCache = /* @__PURE__ */ new WeakMap();
    const effect = (subject2, values) => {
      const state3 = stateCache.get(subject2) ?? new MotionValueState(step);
      stateCache.set(subject2, state3);
      const subscriptions = [];
      for (const key2 in values) {
        const value = values[key2];
        const remove = addValue(subject2, state3, key2, value);
        subscriptions.push(remove);
      }
      return () => {
        for (const cancel of subscriptions)
          cancel();
      };
    };
    return Object.assign(effect, options, {
      get: (subject2, key2) => stateCache.get(subject2)?.get(key2),
      flush: (subject2) => stateCache.get(subject2)?.flush(),
      state: (subject2) => stateCache.get(subject2)
    });
  }

  // ../../code/node_modules/motion-dom/dist/es/effects/style/transform.mjs
  var openers = {};
  function buildTransform2(state3) {
    let transform = "";
    const { transformKeys: keys = [], transformValues: values = {} } = state3;
    for (let i = 0; i < keys.length; i++) {
      const key2 = keys[i];
      const value = values[key2].getCurrent();
      if (value === void 0)
        continue;
      const parsed = typeof value === "number" ? value : parseFloat(value);
      if (parsed !== (key2.startsWith("scale") ? 1 : 0)) {
        transform += (transform && " ") + (openers[key2] || (openers[key2] = (translateAlias[key2] || key2) + "(")) + getValueAsType(value, transformValueTypes[key2]) + ")";
      }
    }
    const pathRotation = state3.get("pathRotation")?.get();
    if (pathRotation) {
      transform += (transform && " ") + "rotate(" + getValueAsType(pathRotation, transformValueTypes.pathRotation) + ")";
    }
    return transform || "none";
  }

  // ../../code/node_modules/motion-dom/dist/es/effects/style/index.mjs
  var originProps = /* @__PURE__ */ new Set(["originX", "originY", "originZ"]);
  var styleValue = (state3, key2) => getValueAsType(state3.get(key2)?.get(), numberValueTypes[key2]);
  var addStyleValue = (element, state3, key2, value) => {
    let render = void 0;
    let computed = void 0;
    if (transformProps.has(key2)) {
      if (key2 !== "pathRotation") {
        const keys = state3.transformKeys ?? (state3.transformKeys = []);
        (state3.transformValues ?? (state3.transformValues = {}))[key2] = value;
        if (!keys.includes(key2)) {
          keys.push(key2);
          keys.sort((a, b) => transformPropOrder.indexOf(a) - transformPropOrder.indexOf(b));
        }
      }
      if (!state3.get("transform")) {
        if (!isHTMLElement(element) && !state3.get("transformBox")) {
          addStyleValue(element, state3, "transformBox", new MotionValue("fill-box"));
        }
        state3.set("transform", new MotionValue("none"), () => {
          transformGroups.get(element)?.check();
          element.style.transform = buildTransform2(state3);
        });
      }
      computed = state3.get("transform");
    } else if (originProps.has(key2)) {
      if (!state3.get("transformOrigin")) {
        state3.set("transformOrigin", new MotionValue(""), () => {
          const originX = styleValue(state3, "originX") ?? "50%";
          const originY = styleValue(state3, "originY") ?? "50%";
          const originZ = styleValue(state3, "originZ") ?? 0;
          element.style.transformOrigin = `${originX} ${originY} ${originZ}`;
        });
      }
      computed = state3.get("transformOrigin");
    } else if (isCSSVar(key2)) {
      render = () => {
        element.style.setProperty(key2, value.getCurrent());
      };
    } else {
      render = () => {
        element.style[key2] = getValueAsType(value.getCurrent(), numberValueTypes[key2]);
      };
    }
    return state3.set(key2, value, render, computed);
  };
  var isStyleSubject = (subject2) => isHTMLElement(subject2) || isSVGElement(subject2);
  var readStyleValue = (element, key2) => {
    if (transformProps.has(key2)) {
      return readTransformValue(element, key2);
    }
    const computedStyle = getComputedStyle(element);
    const value = isCSSVar(key2) ? computedStyle.getPropertyValue(key2) : computedStyle[key2];
    return typeof value === "string" && value.trim() || 0;
  };
  var styleSubjectEffect = /* @__PURE__ */ createEffect(addStyleValue, {
    test: isStyleSubject,
    read: readStyleValue
  });
  var styleEffect = /* @__PURE__ */ createSelectorEffect(styleSubjectEffect);

  // ../../code/node_modules/motion-dom/dist/es/render/svg/utils/build-attrs.mjs
  var cssStyleProperties = [
    "transform",
    "opacity",
    "clipPath",
    "filter",
    "offsetDistance",
    "offsetPath",
    "offsetRotate",
    "offsetAnchor"
  ];

  // ../../code/node_modules/motion-dom/dist/es/effects/attr/index.mjs
  function canSetAsProperty(element, name) {
    if (!(name in element))
      return false;
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), name) || Object.getOwnPropertyDescriptor(element, name);
    return descriptor && typeof descriptor.set === "function";
  }
  var addAttrValue = (element, state3, key2, value, name = key2) => {
    const isProp = canSetAsProperty(element, name);
    if (!isProp && (name.startsWith("data") || name.startsWith("aria"))) {
      name = camelToDash(name);
    }
    const type = numberValueTypes[key2] || numberValueTypes[name];
    const render = isProp ? () => {
      element[name] = getValueAsType(value.get(), numberValueTypes[key2]);
    } : () => {
      const v = getValueAsType(value.get(), type);
      if (v === null || v === void 0) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, String(v));
      }
    };
    return state3.set(key2, value, render);
  };

  // ../../code/node_modules/motion-dom/dist/es/effects/svg/index.mjs
  function addSVGPathValue(element, state3, key2, value) {
    frame2.render(() => element.setAttribute("pathLength", "1"));
    if (key2 === "pathOffset") {
      return state3.set(key2, value, () => {
        const offset = value.get();
        element.setAttribute("stroke-dashoffset", `${-offset}`);
      });
    } else {
      if (!state3.get("stroke-dasharray")) {
        state3.set("stroke-dasharray", new MotionValue("1 1"), () => {
          const pathLength = state3.get("pathLength")?.get() ?? 1;
          const pathSpacing = state3.get("pathSpacing")?.get();
          element.setAttribute("stroke-dasharray", `${pathLength} ${pathSpacing ?? 1 - Number(pathLength)}`);
        });
      }
      return state3.set(key2, value, void 0, state3.get("stroke-dasharray"));
    }
  }
  var addSVGValue = (element, state3, key2, value) => {
    if (key2.startsWith("path")) {
      return addSVGPathValue(element, state3, key2, value);
    } else if (key2.startsWith("attr")) {
      return addAttrValue(element, state3, key2, value, convertAttrKey(key2));
    }
    const handler = transformProps.has(key2) || originProps.has(key2) || isCSSVar(key2) || key2 in element.style ? addStyleValue : addAttrValue;
    return handler(element, state3, key2, value);
  };
  var readSVGValue = (element, key2) => {
    if (transformProps.has(key2)) {
      return numberValueTypes[key2]?.default || 0;
    }
    if (isCSSVar(key2) || cssStyleProperties.includes(key2)) {
      return readStyleValue(element, key2) || element.getAttribute(camelToDash(key2)) || 0;
    }
    key2 = convertAttrKey(key2);
    return element.getAttribute(camelToDash(key2)) ?? element.getAttribute(key2) ?? void 0;
  };
  var svgSubjectEffect = /* @__PURE__ */ createEffect(addSVGValue, {
    test: isSVGElement,
    read: readSVGValue
  });
  function convertAttrKey(key2) {
    return key2.replace(/^attr([A-Z])/, (_, firstChar) => firstChar.toLowerCase());
  }

  // ../../code/node_modules/motion-dom/dist/es/projection/geometry/conversion.mjs
  function convertBoundingBoxToBox({ top, left, right, bottom }) {
    return {
      x: { min: left, max: right },
      y: { min: top, max: bottom }
    };
  }
  function transformBoxPoints(point, transformPoint) {
    if (!transformPoint)
      return point;
    const topLeft = transformPoint({ x: point.left, y: point.top });
    const bottomRight = transformPoint({ x: point.right, y: point.bottom });
    return {
      top: topLeft.y,
      left: topLeft.x,
      bottom: bottomRight.y,
      right: bottomRight.x
    };
  }

  // ../../code/node_modules/motion-dom/dist/es/projection/utils/measure.mjs
  function measureViewportBox(instance, transformPoint) {
    return convertBoundingBoxToBox(transformBoxPoints(instance.getBoundingClientRect(), transformPoint));
  }

  // ../../code/node_modules/motion-dom/dist/es/animation/animate/element.mjs
  var noProps = {};
  var getElementEffect = (element) => isSVGElement(element) ? svgSubjectEffect : styleSubjectEffect;
  var EffectSubject = class {
    constructor(effect, current2) {
      this.effect = effect;
      this.current = current2;
      this.KeyframeResolver = DOMKeyframesResolver;
    }
    getValue(key2) {
      return this.effect.get(this.current, key2);
    }
    readValue(key2, target) {
      return this.effect.read(this.current, key2, target);
    }
    render() {
      this.effect.flush(this.current);
    }
    measureViewportBox() {
      return measureViewportBox(this.current);
    }
    getProps() {
      return noProps;
    }
  };
  function animateElement(element, keyframes2, transition, visualElement) {
    if (visualElement) {
      return animateValues((key2) => visualElement.getValue(key2, null), keyframes2, transition, visualElement);
    }
    const effect = getElementEffect(element);
    return animateEffectSubject(effect, element, keyframes2, transition, new EffectSubject(effect, element));
  }

  // ../../code/node_modules/motion-dom/dist/es/effects/prop/index.mjs
  var propEffect = /* @__PURE__ */ createEffect((subject2, state3, key2, value) => {
    return state3.set(key2, value, () => {
      subject2[key2] = value.get();
    });
  }, {
    test: (subject2) => isObject(subject2),
    read: (subject2, key2) => {
      const value = subject2[key2];
      return typeof value === "string" || typeof value === "number" ? value : void 0;
    }
  });

  // ../../code/node_modules/motion-dom/dist/es/animation/FollowAnimation.mjs
  var active = /* @__PURE__ */ new Set();
  var tickAll = ({ timestamp }) => {
    active.forEach((animation) => animation.tick(timestamp));
  };
  var FollowAnimation = class extends WithPromise {
    constructor(options) {
      super();
      this.state = "idle";
      this.startTime = 0;
      this.currentTime = 0;
      this.started = false;
      this.hasNextTarget = false;
      this.nextTarget = 0;
      this.stop = () => {
        if (this.state === "idle")
          return;
        this.teardown();
        this.options.onStop?.();
      };
      this.options = options;
      this.factory = options.type;
      this.generator = this.factory(options);
      const { driver } = options;
      if (driver)
        this.driver = driver((timestamp) => this.tick(timestamp));
      this.startTime = this.now();
      this.state = "running";
      if (this.driver) {
        this.driver.start();
      } else {
        active.size || frame2.update(tickAll, true);
        active.add(this);
      }
    }
    /**
     * Aim at a new target from wherever the animation has reached by the
     * next tick. `velocity` fixes the velocity to steer with, otherwise
     * the generator's is used.
     */
    setTarget(target, velocity) {
      this.nextTarget = target;
      this.nextVelocity = velocity;
      this.hasNextTarget = true;
    }
    /**
     * Steer towards new keyframes from the current position and velocity.
     * Springs are updated in place; other generators are recreated.
     */
    retarget(keyframes2, velocity) {
      const { options, generator } = this;
      options.keyframes = keyframes2;
      options.velocity = velocity;
      this.startTime = this.now();
      this.currentTime = 0;
      if (generator.retarget) {
        generator.retarget(keyframes2, velocity);
      } else {
        this.generator = this.factory(options);
      }
    }
    tick(timestamp) {
      const { options, hasNextTarget: retargeted } = this;
      const { delay = 0, onUpdate, onPlay } = options;
      if (!this.started) {
        this.startTime = resolveStartTime(this.startTime, timestamp);
      }
      const elapsed = Math.round(timestamp - this.startTime) - delay;
      const t = this.currentTime = Math.max(0, elapsed);
      const state3 = this.generator.next(t);
      const value = elapsed < 0 ? options.keyframes[0] : state3.value;
      if (retargeted) {
        this.hasNextTarget = false;
        const { keyframes: keyframes2 } = options;
        keyframes2[0] = value;
        keyframes2[1] = this.nextTarget;
        this.retarget(keyframes2, this.nextVelocity ?? this.getGeneratorVelocity());
      }
      if (retargeted || !this.started) {
        this.started = true;
        onPlay?.();
      }
      if (this.state !== "running")
        return;
      onUpdate?.(value);
      if (state3.done && elapsed >= 0 && !retargeted && !this.hasNextTarget && this.state === "running") {
        this.notifyFinished();
        this.teardown();
        this.state = "finished";
        options.onComplete?.();
      }
    }
    getGeneratorVelocity() {
      return calcGeneratorVelocity(this.generator, this.currentTime, this.options.velocity);
    }
    now() {
      return this.driver ? this.driver.now() : time.now();
    }
    teardown() {
      this.state = "idle";
      if (this.driver) {
        this.driver.stop();
      } else {
        active.delete(this);
        active.size || cancelFrame(tickAll);
      }
    }
  };

  // ../../code/node_modules/motion-dom/dist/es/value/utils/as-number.mjs
  var asNumber = (v) => typeof v === "number" ? v : parseFloat(v);

  // ../../code/node_modules/motion-dom/dist/es/value/utils/follow.mjs
  function follow(value, source, options) {
    const initialValue = value.get();
    let activeAnimation = null;
    let set;
    const unit = typeof initialValue === "string" ? initialValue.replace(/[\d.-]/g, "") : void 0;
    const onUpdate = (v) => set(unit ? v + unit : v);
    const onPlay = () => value["events"].animationStart?.notify();
    const stopAnimation = () => {
      if (activeAnimation) {
        activeAnimation.stop();
        activeAnimation = null;
      }
      value.animation = void 0;
    };
    value.attach((v, safeSet) => {
      set = safeSet;
      const target = asNumber(v);
      if (activeAnimation?.state === "running") {
        activeAnimation.setTarget(target, options.velocity);
        return;
      }
      const current2 = asNumber(value.get());
      const velocity = activeAnimation ? activeAnimation.getGeneratorVelocity() : value.getVelocity();
      stopAnimation();
      if (current2 === target)
        return;
      const animationOptions = {
        keyframes: [current2, target],
        velocity,
        restDelta: 1e-3,
        restSpeed: 0.01,
        ...options,
        onUpdate
      };
      const animation = activeAnimation = new FollowAnimation({
        ...animationOptions,
        onPlay
      });
      value.animation = animation;
      animation.then(() => {
        if (activeAnimation !== animation)
          return;
        activeAnimation = null;
        value.animation = void 0;
        value["events"].animationComplete?.notify();
      });
    }, stopAnimation);
    if (isMotionValue(source)) {
      let skipNextAnimation = options.skipInitialAnimation === true;
      const onSourceChange = (v) => {
        if (skipNextAnimation) {
          skipNextAnimation = false;
          value.jump(parseValue(v, unit), false);
        } else {
          value.set(parseValue(v, unit));
        }
      };
      const removeSourceOnChange = source.on("change", onSourceChange);
      const latest = source.get();
      if (asNumber(latest) - asNumber(value.get()))
        onSourceChange(latest);
      const removeValueOnDestroy = value.on("destroy", removeSourceOnChange);
      return () => {
        removeSourceOnChange();
        removeValueOnDestroy();
        stopAnimation();
      };
    }
    return stopAnimation;
  }
  function parseValue(v, unit) {
    return unit ? v + unit : v;
  }

  // ../../code/node_modules/motion-dom/dist/es/value/subscribe-value.mjs
  function subscribeValue(inputValues, outputValue, getLatest) {
    const update = () => outputValue.set(getLatest());
    const scheduleUpdate = () => frame2.preRender(update, false, true);
    const subscriptions = inputValues.map((v) => v.on("change", scheduleUpdate));
    outputValue.on("destroy", () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      cancelFrame(update);
    });
  }

  // ../../code/node_modules/motion-dom/dist/es/value/transform-value.mjs
  function transformValue(transform) {
    const collectedValues = [];
    collectMotionValues.current = collectedValues;
    const initialValue = transform();
    collectMotionValues.current = void 0;
    const value = motionValue(initialValue);
    subscribeValue(collectedValues, value, transform);
    return value;
  }

  // ../../code/node_modules/motion-dom/dist/es/value/spring-value.mjs
  function springValue(source, options) {
    const value = motionValue(isMotionValue(source) ? source.get() : source);
    attachSpring(value, source, options);
    return value;
  }
  function attachSpring(value, source, options) {
    return follow(value, source, { ...options, type: spring });
  }

  // ../../code/node_modules/motion-dom/dist/es/render/store.mjs
  var visualElementStore = /* @__PURE__ */ new WeakMap();

  // ../../code/node_modules/motion-dom/dist/es/animation/animate/single-value.mjs
  function animateSingleValue(value, keyframes2, options) {
    const motionValue$1 = isMotionValue(value) ? value : motionValue(value);
    motionValue$1.start(animateMotionValue("", motionValue$1, keyframes2, options));
    return motionValue$1.animation;
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/utils/is-dom-keyframes.mjs
  function isDOMKeyframes(keyframes2) {
    return typeof keyframes2 === "object" && !Array.isArray(keyframes2);
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/animate/resolve-subjects.mjs
  function resolveSubjects(subject2, keyframes2, scope, selectorCache) {
    if (subject2 == null) {
      return [];
    }
    if (typeof subject2 === "string" && isDOMKeyframes(keyframes2)) {
      return resolveElements(subject2, scope, selectorCache);
    } else if (subject2 instanceof NodeList) {
      return Array.from(subject2);
    } else if (Array.isArray(subject2)) {
      return subject2.filter((s) => s != null);
    } else {
      return [subject2];
    }
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/sequence/utils/calc-repeat-duration.mjs
  function calculateRepeatDuration(duration, repeat, repeatDelay) {
    return duration * (repeat + 1) + repeatDelay * repeat;
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/sequence/utils/calc-time.mjs
  function calcNextTime(current2, next, prev, labels) {
    if (typeof next === "number") {
      return next;
    } else if (next.startsWith("-") || next.startsWith("+")) {
      return Math.max(0, current2 + parseFloat(next));
    } else if (next === "<") {
      return prev;
    } else if (next.startsWith("<")) {
      return Math.max(0, prev + parseFloat(next.slice(1)));
    } else {
      return labels.get(next) ?? current2;
    }
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/sequence/utils/edit.mjs
  function eraseKeyframes(sequence, startTime, endTime) {
    for (let i = 0; i < sequence.length; i++) {
      const keyframe2 = sequence[i];
      if (keyframe2.at > startTime && keyframe2.at < endTime) {
        removeItem(sequence, keyframe2);
        i--;
      }
    }
  }
  function addKeyframes(sequence, keyframes2, easing, offset, startTime, endTime) {
    eraseKeyframes(sequence, startTime, endTime);
    for (let i = 0; i < keyframes2.length; i++) {
      sequence.push({
        value: keyframes2[i],
        at: mixNumber(startTime, endTime, offset[i]),
        easing: getEasingForSegment(easing, i)
      });
    }
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/sequence/utils/normalize-times.mjs
  function normalizeTimes(times, repeat, repeatDelayUnits = 0) {
    const totalUnits = repeat + 1 + repeat * repeatDelayUnits;
    for (let i = 0; i < times.length; i++) {
      times[i] = times[i] / totalUnits;
    }
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/sequence/utils/sort.mjs
  function compareByTime(a, b) {
    if (a.at === b.at) {
      if (a.value === null)
        return 1;
      if (b.value === null)
        return -1;
      return 0;
    } else {
      return a.at - b.at;
    }
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/sequence/create.mjs
  var defaultSegmentEasing = "easeInOut";
  var MAX_REPEAT = 20;
  function createAnimationsFromSequence(sequence, { defaultTransition = {}, ...sequenceTransition } = {}, scope, generators) {
    const defaultDuration = defaultTransition.duration || 0.3;
    const animationDefinitions = /* @__PURE__ */ new Map();
    const sequences = /* @__PURE__ */ new Map();
    const elementCache = {};
    const timeLabels = /* @__PURE__ */ new Map();
    let prevTime = 0;
    let currentTime = 0;
    let totalDuration = 0;
    for (let i = 0; i < sequence.length; i++) {
      const segment = sequence[i];
      if (typeof segment === "string") {
        timeLabels.set(segment, currentTime);
        continue;
      } else if (!Array.isArray(segment)) {
        timeLabels.set(segment.name, calcNextTime(currentTime, segment.at, prevTime, timeLabels));
        continue;
      }
      let [subject2, keyframes2, transition = {}] = segment;
      if (transition.at !== void 0) {
        currentTime = calcNextTime(currentTime, transition.at, prevTime, timeLabels);
      }
      let maxDuration = 0;
      const resolveValueSequence = (valueKeyframes, valueTransition, valueSequence, elementIndex = 0, numSubjects = 0) => {
        const valueKeyframesAsList = keyframesAsList(valueKeyframes);
        const { delay = 0, times = defaultOffset(valueKeyframesAsList), type = defaultTransition.type || "keyframes", repeat, repeatType, repeatDelay = 0, ...remainingTransition } = valueTransition;
        let { ease: ease2 = defaultTransition.ease || "easeOut", duration } = valueTransition;
        const calculatedDelay = typeof delay === "function" ? delay(elementIndex, numSubjects) : delay;
        const numKeyframes = valueKeyframesAsList.length;
        const createGenerator = isGenerator(type) ? type : generators?.[type || "keyframes"];
        if (numKeyframes <= 2 && createGenerator) {
          let absoluteDelta = 100;
          if (numKeyframes === 2 && isNumberKeyframesArray(valueKeyframesAsList)) {
            const delta = valueKeyframesAsList[1] - valueKeyframesAsList[0];
            absoluteDelta = Math.abs(delta);
          }
          const springTransition = {
            ...defaultTransition,
            ...remainingTransition
          };
          if (duration !== void 0) {
            springTransition.duration = secondsToMilliseconds(duration);
          }
          const springEasing = createGeneratorEasing(springTransition, absoluteDelta, createGenerator);
          ease2 = springEasing.ease;
          duration = springEasing.duration;
        }
        duration ?? (duration = defaultDuration);
        const startTime = currentTime + calculatedDelay;
        if (times.length === 1 && times[0] === 0) {
          times[1] = 1;
        }
        const remainder = times.length - valueKeyframesAsList.length;
        remainder > 0 && fillOffset(times, remainder);
        valueKeyframesAsList.length === 1 && valueKeyframesAsList.unshift(null);
        if (repeat) {
          warning(repeat < MAX_REPEAT, `Sequence segments can't repeat ${repeat} times \u2014 ignoring repeat option. Use a value below ${MAX_REPEAT} or apply repeat at the sequence level instead.`);
        }
        if (repeat && repeat < MAX_REPEAT) {
          const repeatDelayUnits = duration > 0 ? repeatDelay / duration : 0;
          duration = calculateRepeatDuration(duration, repeat, repeatDelay);
          const originalKeyframes = [...valueKeyframesAsList];
          const originalTimes = [...times];
          ease2 = Array.isArray(ease2) ? [...ease2] : [ease2];
          const originalEase = [...ease2];
          const isFlipping = repeatType === "reverse" || repeatType === "mirror";
          let flippedKeyframes = originalKeyframes;
          let flippedEases = originalEase;
          if (isFlipping) {
            flippedKeyframes = [...originalKeyframes].reverse();
            if (repeatType === "reverse") {
              flippedEases = [...originalEase].reverse().map((e) => typeof e === "function" ? reverseEasing(e) : e);
            }
          }
          for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex++) {
            const isFlipped = isFlipping && repeatIndex % 2 === 0;
            const iterKeyframes = isFlipped ? flippedKeyframes : originalKeyframes;
            const iterEase = isFlipped ? flippedEases : originalEase;
            const iterStartOffset = (repeatIndex + 1) * (1 + repeatDelayUnits);
            if (repeatDelayUnits > 0) {
              valueKeyframesAsList.push(valueKeyframesAsList[valueKeyframesAsList.length - 1]);
              times.push(iterStartOffset);
              ease2.push("linear");
            }
            valueKeyframesAsList.push(...iterKeyframes);
            for (let keyframeIndex = 0; keyframeIndex < iterKeyframes.length; keyframeIndex++) {
              times.push(originalTimes[keyframeIndex] + iterStartOffset);
              ease2.push(keyframeIndex === 0 ? "linear" : getEasingForSegment(iterEase, keyframeIndex - 1));
            }
          }
          normalizeTimes(times, repeat, repeatDelayUnits);
        }
        const targetTime = startTime + duration;
        addKeyframes(valueSequence, valueKeyframesAsList, ease2, times, startTime, targetTime);
        maxDuration = Math.max(calculatedDelay + duration, maxDuration);
        totalDuration = Math.max(targetTime, totalDuration);
      };
      if (isMotionValue(subject2)) {
        const subjectSequence = getSubjectSequence(subject2, sequences);
        resolveValueSequence(keyframes2, transition, getValueSequence("default", subjectSequence));
      } else {
        const subjects = resolveSubjects(subject2, keyframes2, scope, elementCache);
        const numSubjects = subjects.length;
        for (let subjectIndex = 0; subjectIndex < numSubjects; subjectIndex++) {
          keyframes2 = keyframes2;
          transition = transition;
          const thisSubject = subjects[subjectIndex];
          const subjectSequence = getSubjectSequence(thisSubject, sequences);
          for (const key2 in keyframes2) {
            resolveValueSequence(keyframes2[key2], getValueTransition2(transition, key2), getValueSequence(key2, subjectSequence), subjectIndex, numSubjects);
          }
        }
      }
      prevTime = currentTime;
      currentTime += maxDuration;
    }
    sequences.forEach((valueSequences, element) => {
      for (const key2 in valueSequences) {
        const valueSequence = valueSequences[key2];
        valueSequence.sort(compareByTime);
        const keyframes2 = [];
        const valueOffset = [];
        const valueEasing = [];
        for (let i = 0; i < valueSequence.length; i++) {
          const { at, value, easing } = valueSequence[i];
          keyframes2.push(value);
          valueOffset.push(progress(0, totalDuration, at));
          valueEasing.push(easing || "easeOut");
        }
        if (valueOffset[0] !== 0) {
          valueOffset.unshift(0);
          keyframes2.unshift(keyframes2[0]);
          valueEasing.unshift(defaultSegmentEasing);
        }
        if (valueOffset[valueOffset.length - 1] !== 1) {
          valueOffset.push(1);
          keyframes2.push(null);
        }
        if (!animationDefinitions.has(element)) {
          animationDefinitions.set(element, {
            keyframes: {},
            transition: {}
          });
        }
        const definition = animationDefinitions.get(element);
        definition.keyframes[key2] = keyframes2;
        const { type: _type, ...remainingDefaultTransition } = defaultTransition;
        definition.transition[key2] = {
          ...remainingDefaultTransition,
          duration: totalDuration,
          ease: valueEasing,
          times: valueOffset,
          ...sequenceTransition
        };
      }
    });
    return animationDefinitions;
  }
  function getSubjectSequence(subject2, sequences) {
    !sequences.has(subject2) && sequences.set(subject2, {});
    return sequences.get(subject2);
  }
  function getValueSequence(name, sequences) {
    if (!sequences[name])
      sequences[name] = [];
    return sequences[name];
  }
  function keyframesAsList(keyframes2) {
    return Array.isArray(keyframes2) ? keyframes2 : [keyframes2];
  }
  function getValueTransition2(transition, key2) {
    return transition && transition[key2] ? {
      ...transition,
      ...transition[key2]
    } : { ...transition };
  }
  var isNumber = (keyframe2) => typeof keyframe2 === "number";
  var isNumberKeyframesArray = (keyframes2) => keyframes2.every(isNumber);

  // ../../code/node_modules/framer-motion/dist/es/animation/animate/subject.mjs
  function isSingleValue(subject2, keyframes2) {
    return isMotionValue(subject2) || typeof subject2 === "number" || typeof subject2 === "string" && !isDOMKeyframes(keyframes2);
  }
  function animateSubject(subject2, keyframes2, options, scope) {
    const animations = [];
    if (isSingleValue(subject2, keyframes2)) {
      animations.push(animateSingleValue(subject2, isDOMKeyframes(keyframes2) ? keyframes2.default || keyframes2 : keyframes2, options ? options.default || options : options));
    } else {
      if (subject2 == null) {
        return animations;
      }
      const subjects = resolveSubjects(subject2, keyframes2, scope);
      const numSubjects = subjects.length;
      invariant(Boolean(numSubjects), "No valid elements provided.", "no-valid-elements");
      for (let i = 0; i < numSubjects; i++) {
        const thisSubject = subjects[i];
        const transition = { ...options };
        if ("delay" in transition && typeof transition.delay === "function") {
          transition.delay = transition.delay(i, numSubjects);
        }
        if (thisSubject instanceof Element) {
          animations.push(...animateElement(thisSubject, keyframes2, transition, visualElementStore.get(thisSubject)));
        } else {
          animations.push(...animateEffectSubject(findEffect(thisSubject) ?? propEffect, thisSubject, keyframes2, transition));
        }
      }
    }
    return animations;
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/animate/sequence.mjs
  function animateSequence(sequence, options, scope) {
    const animations = [];
    const processedSequence = sequence.map((segment) => {
      if (Array.isArray(segment) && typeof segment[0] === "function") {
        const callback = segment[0];
        const mv = motionValue(0);
        mv.on("change", callback);
        if (segment.length === 1) {
          return [mv, [0, 1]];
        } else if (segment.length === 2) {
          return [mv, [0, 1], segment[1]];
        } else {
          return [mv, segment[1], segment[2]];
        }
      }
      return segment;
    });
    const animationDefinitions = createAnimationsFromSequence(processedSequence, options, scope, { spring });
    animationDefinitions.forEach(({ keyframes: keyframes2, transition }, subject2) => {
      animations.push(...animateSubject(subject2, keyframes2, transition));
    });
    return animations;
  }

  // ../../code/node_modules/framer-motion/dist/es/animation/animate/index.mjs
  function isSequence(value) {
    return Array.isArray(value) && value.some(Array.isArray);
  }
  function createScopedAnimate(options = {}) {
    const { scope, reduceMotion, skipAnimations } = options;
    function scopedAnimate(subjectOrSequence, optionsOrKeyframes, options2) {
      let animations = [];
      let animationOnComplete;
      const inherited = {};
      if (reduceMotion !== void 0)
        inherited.reduceMotion = reduceMotion;
      if (skipAnimations !== void 0)
        inherited.skipAnimations = skipAnimations;
      if (isSequence(subjectOrSequence)) {
        const { onComplete, ...sequenceOptions } = optionsOrKeyframes || {};
        if (typeof onComplete === "function") {
          animationOnComplete = onComplete;
        }
        animations = animateSequence(subjectOrSequence, { ...inherited, ...sequenceOptions }, scope);
      } else {
        const { onComplete, ...rest } = options2 || {};
        if (typeof onComplete === "function") {
          animationOnComplete = onComplete;
        }
        animations = animateSubject(subjectOrSequence, optionsOrKeyframes, { ...inherited, ...rest }, scope);
      }
      const animation = new GroupAnimationWithThen(animations);
      if (animationOnComplete) {
        animation.finished.then(animationOnComplete);
      }
      if (scope) {
        scope.animations.push(animation);
        animation.finished.then(() => {
          removeItem(scope.animations, animation);
        });
      }
      return animation;
    }
    return scopedAnimate;
  }
  var animate = Object.assign(createScopedAnimate(), {
    /**
     * Register an effect so `animate()` can animate the subjects it
     * claims, for instance `animate.addEffect(threeEffect)`. The most
     * recently added effect is tested first. DOM elements are always
     * animated directly.
     */
    addEffect,
    removeEffect
  });

  // src/client/feel/motor.js
  function clamp4(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function createMotor(pigHold, pigBody) {
    try {
      const pressTarget = motionValue(0);
      const press = springValue(pressTarget, { ...FEEL.press });
      const holdTarget = motionValue(0);
      const hold = springValue(holdTarget, { ...FEEL.hold });
      const tiltTarget = motionValue(0);
      const tilt3 = springValue(tiltTarget, { ...FEEL.tilt });
      const impact = motionValue(0);
      const flip = motionValue(0);
      let impactAnimation = null;
      let flipAnimation = null;
      let disposed = false;
      const holdTransform = transformValue(function() {
        const h = clamp4(hold.get(), -0.2, 0.24);
        return "scale(" + (1 - FEEL.holdNarrow * h).toFixed(4) + "," + (1 + h).toFixed(4) + ")";
      });
      const bodyTransform = transformValue(function() {
        const squash = clamp4(press.get() + impact.get(), -0.3, 0.3);
        const progress2 = clamp4(flip.get(), 0, 1);
        const facing = Math.cos(Math.PI * progress2);
        const bulge = 1 + FEEL.turnBulge * Math.sin(Math.PI * progress2);
        const sx = (1 + FEEL.volumeK * squash) * facing;
        const sy = (1 - squash) * bulge;
        return "rotate(" + clamp4(tilt3.get(), -30, 30).toFixed(3) + "deg) scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
      });
      const stopHold = styleEffect(pigHold, { transform: holdTransform });
      const stopBody = styleEffect(pigBody, { transform: bodyTransform });
      return {
        pressTarget: function(value) {
          pressTarget.set(value);
        },
        holdTarget: function(value) {
          holdTarget.set(value);
        },
        tiltTarget: function(value) {
          tiltTarget.set(value);
        },
        pressValue: function() {
          return press.get();
        },
        holdValue: function() {
          return hold.get();
        },
        tiltValue: function() {
          return tilt3.get();
        },
        impactValue: function() {
          return impact.get();
        },
        flipValue: function() {
          return flip.get();
        },
        targetValue: function() {
          return [pressTarget.get(), holdTarget.get(), tiltTarget.get(), impact.get()];
        },
        /** 落地/撞边：先跳到压缩量，再让弹簧从压缩位置弹回。 */
        impulse: function(amount) {
          if (disposed) return;
          impactAnimation?.stop?.();
          impact.set(clamp4(amount, 0, FEEL.squashMax));
          impactAnimation = animate(impact, 0, { type: "spring", ...FEEL.impact, velocity: 0 });
        },
        /**
         * 翻卡片：0 = 朝左，1 = 朝右；中途反向从当前进度继续。
         * @param {number} target
         * @param {(done: boolean) => void} onDone
         */
        flipTo: function(target, onDone) {
          flipAnimation?.stop?.();
          flipAnimation = animate(flip, target, { duration: FEEL.turnMs / 1e3, ease: "easeInOut" });
          const controls = flipAnimation;
          Promise.resolve(controls).then(function() {
            if (flipAnimation === controls) flipAnimation = null;
            onDone(true);
          }, function() {
            onDone(false);
          });
          return flipAnimation;
        },
        stopFlip: function() {
          flipAnimation?.stop?.();
          flipAnimation = null;
        },
        resetFlip: function() {
          flip.set(0);
        },
        settled: function() {
          if (flipAnimation !== null) return false;
          if (Math.abs(flip.get()) > 1e-3) return false;
          const targets = [pressTarget.get(), holdTarget.get(), tiltTarget.get(), impact.get()];
          if (targets.some((value) => Math.abs(value) > FEEL.settleEpsilon)) return false;
          if (Math.abs(press.get()) > FEEL.settleEpsilon) return false;
          if (Math.abs(hold.get()) > FEEL.settleEpsilon) return false;
          if (Math.abs(impact.get()) > FEEL.settleEpsilon) return false;
          if (Math.abs(tilt3.get()) > FEEL.settleTilt) return false;
          return true;
        },
        dispose: function() {
          disposed = true;
          impactAnimation?.stop?.();
          flipAnimation?.stop?.();
          stopHold?.();
          stopBody?.();
          pressTarget.destroy?.();
          holdTarget.destroy?.();
          tiltTarget.destroy?.();
          impact.destroy?.();
          flip.destroy?.();
        }
      };
    } catch (error) {
      console.warn("[dsh-piggy] \u624B\u611F\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u9000\u56DE\u73B0\u6709 CSS \u52A8\u753B", error);
      return null;
    }
  }

  // src/client/feel/settle.js
  function createSettle(c) {
    let active2 = false;
    let timer2 = null;
    let attempts = 0;
    let finishTimer = null;
    let disposed = false;
    function clear() {
      if (timer2 !== null) clearTimeout(timer2);
      timer2 = null;
    }
    function finish() {
      clear();
      if (!active2) return;
      if (finishTimer !== null) clearTimeout(finishTimer);
      c.pig.setAttribute("data-feel", "settle");
      c.onGeometry();
      finishTimer = setTimeout(function() {
        finishTimer = null;
        if (disposed) return;
        c.pig.removeAttribute("data-feel");
        active2 = false;
        c.pigBody.style.willChange = "";
        c.pigHold.style.willChange = "";
        c.onGeometry();
      }, 220);
    }
    function check() {
      timer2 = null;
      const motor = c.getMotor();
      if (disposed || motor === null) return;
      if (!motor.settled()) {
        attempts += 1;
        if (attempts < 24) timer2 = setTimeout(check, 180);
        else finish();
        return;
      }
      finish();
    }
    function schedule4(delay) {
      clear();
      attempts = 0;
      timer2 = setTimeout(check, delay ?? 700);
    }
    return {
      begin: function() {
        if (finishTimer !== null) {
          clearTimeout(finishTimer);
          finishTimer = null;
        }
        if (!active2) {
          active2 = true;
          c.pigBody.style.willChange = "transform";
          c.pigHold.style.willChange = "transform";
          c.onGeometry();
        }
        if (c.pig.getAttribute("data-feel") !== "active") c.pig.setAttribute("data-feel", "active");
        schedule4(800);
      },
      schedule: schedule4,
      clear,
      finish,
      isActive: function() {
        return active2;
      },
      reset: function() {
        clear();
        if (finishTimer !== null) clearTimeout(finishTimer);
        finishTimer = null;
        c.pig.removeAttribute("data-feel");
        c.pigBody.style.willChange = "";
        c.pigHold.style.willChange = "";
        active2 = false;
      },
      dispose: function() {
        disposed = true;
        clear();
        if (finishTimer !== null) clearTimeout(finishTimer);
        finishTimer = null;
      }
    };
  }

  // src/client/feel/index.js
  function clamp5(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function canAnimate3() {
    try {
      return typeof window !== "undefined" && (typeof window.requestAnimationFrame === "function" || typeof globalThis.requestAnimationFrame === "function");
    } catch {
      return false;
    }
  }
  function createFeel(deps) {
    const pig = deps.pig;
    const pigHold = deps.pigHold;
    const pigBody = deps.pigBody;
    const host3 = deps.host;
    const getShell = deps.getShell;
    const onGeometry = deps.onGeometry ?? function() {
    };
    const motor = canAnimate3() ? createMotor(pigHold, pigBody) : null;
    let mode = motor === null ? "off" : effectiveFeelMode();
    let disposed = false;
    let flashing = false;
    let swapTimer = null;
    let pendingSwap = null;
    let crouchTimer = null;
    let tapTimer = null;
    let wakeTimer = null;
    let justWoke = false;
    let lifted = false;
    let liftSoundPlayed = false;
    let dragging2 = false;
    let flipToken = 0;
    let facing = (pig.getAttribute("data-walk") || "") === "right" ? "right" : "left";
    let flipFrom = facing;
    function scale2() {
      return modeScale(mode);
    }
    function enabled() {
      return motor !== null && !disposed && mode !== "off";
    }
    function sleeping() {
      if (justWoke) return false;
      return (pig.getAttribute("data-idle") || "") === "nap" || (pig.getAttribute("data-mood") || "") === "sleepy";
    }
    function wake() {
      if (pig.getAttribute("data-idle") === "nap") {
        pig.removeAttribute("data-idle");
        syncPigArt(pig, deps.pigArt, deps.pigEmoji);
      }
      justWoke = true;
      if (wakeTimer !== null) clearTimeout(wakeTimer);
      wakeTimer = setTimeout(function() {
        wakeTimer = null;
        justWoke = false;
      }, 1500);
    }
    function restingFactor() {
      return sleeping() ? 0.5 : 1;
    }
    function immobileStage() {
      const stage2 = pig.getAttribute("data-stage") || "";
      const mood = pig.getAttribute("data-mood") || "";
      return stage2 === "box" || stage2 === "grave" || stage2 === "dead-day" || mood === "dead";
    }
    const settle = createSettle({
      pig,
      pigHold,
      pigBody,
      getMotor: function() {
        return motor;
      },
      onGeometry
    });
    function setMode(next) {
      mode = next;
      if (mode !== "off" || motor === null) return;
      runner.cancel();
      motor.pressTarget(0);
      motor.holdTarget(0);
      motor.tiltTarget(0);
      motor.impulse(0);
      motor.stopFlip();
      motor.resetFlip();
      pig.removeAttribute("data-feel-flip");
      settle.reset();
      cancelSwap();
    }
    function pressPig() {
      if (!enabled() || immobileStage() || runner.isFlying()) return;
      dizzyFx.cancel();
      lifted = false;
      liftSoundPlayed = false;
      motor.pressTarget(FEEL.pressSquash * scale2() * restingFactor());
      playSound("tap");
      settle.begin();
    }
    function liftPig() {
      if (!enabled() || immobileStage() || runner.isFlying()) return;
      lifted = true;
      motor.holdTarget(FEEL.holdMax * scale2() * restingFactor());
      motor.pressTarget(0);
      if (!liftSoundPlayed && !sleeping()) {
        playSound("lift");
        liftSoundPlayed = true;
      }
      settle.begin();
    }
    function movePig(vx) {
      if (!enabled() || immobileStage() || runner.isFlying()) return;
      const limit = FEEL.tiltMaxDrag * scale2() * restingFactor();
      motor.tiltTarget(clamp5(-(Number(vx) || 0) * FEEL.tiltGain, -limit, limit));
      settle.begin();
    }
    function applyImpact(amount) {
      if (!enabled()) return;
      motor.impulse(clamp5(amount, 0, FEEL.squashMax));
      settle.begin();
    }
    function burstDust(count) {
      deps.burst(["\u{1F4A8}", "\u{1F4A8}", "\u2728"], Math.max(1, Math.round(count * (mode === "soft" ? 0.5 : 1))));
    }
    function releasePig(options) {
      if (!enabled()) return "off";
      dragging2 = false;
      const vx = Number(options?.vx) || 0;
      const vy = Number(options?.vy) || 0;
      const speed = Math.hypot(vx, vy);
      motor.holdTarget(0);
      motor.tiltTarget(0);
      motor.pressTarget(0);
      if (lifted && speed >= FEEL.throwMin && runner.start(vx, vy, scale2())) return "throw";
      if (lifted || options?.dragged === true) {
        applyImpact(clamp5(0.04 + speed / 9e3, 0.04, FEEL.squashMax));
        if (speed > 240) {
          burstDust(clamp5(Math.round(speed / 600), 1, 3));
          playSound(speed > 900 ? "land-hard" : "land-soft", { soft: mode === "soft" });
        }
      } else if (tapTimer === null) {
        tapTimer = setTimeout(function() {
          tapTimer = null;
          if (disposed || pig.getAttribute("data-react") !== null) return;
          applyImpact(0.06 * scale2());
        }, 250);
      }
      settle.schedule(900);
      return "drop";
    }
    function tap() {
      if (!enabled() || immobileStage()) return;
      applyImpact(0.06 * scale2());
      playSound("tap");
    }
    function crouch(ms) {
      if (!enabled() || immobileStage()) return;
      motor.pressTarget(FEEL.pressSquash * 2 * scale2() * restingFactor());
      if (crouchTimer !== null) clearTimeout(crouchTimer);
      crouchTimer = setTimeout(function() {
        crouchTimer = null;
        motor.pressTarget(0);
      }, ms ?? 120);
      settle.begin();
    }
    const dizzyFx = createDizzy({
      pig,
      pigArt: deps.pigArt,
      pigEmoji: deps.pigEmoji,
      burst: deps.burst,
      getMode: function() {
        return mode;
      }
    });
    function applyFacing(direction) {
      facing = direction;
      if (direction === "right") pig.setAttribute("data-walk", "right");
      else pig.removeAttribute("data-walk");
    }
    function face(direction) {
      if (!enabled()) {
        if (disposed) return;
        if (direction === "right" || direction === "left") applyFacing(direction);
        return;
      }
      if (direction === null) {
        flipToken += 1;
        motor.stopFlip();
        pig.removeAttribute("data-feel-flip");
        motor.resetFlip();
        applyFacing(facing);
        return;
      }
      if (direction === facing && Math.abs(motor.flipValue()) < 1e-3) {
        applyFacing(direction);
        return;
      }
      flipToken += 1;
      const token = flipToken;
      const wasFlipping = Math.abs(motor.flipValue()) > 1e-3;
      if (!wasFlipping) flipFrom = facing;
      const target = direction === flipFrom ? 0 : 1;
      pig.setAttribute("data-feel-flip", "true");
      playSound("flip", { soft: mode === "soft" });
      settle.begin();
      motor.flipTo(target, function(done) {
        if (!done || token !== flipToken || disposed) return;
        if (target === 1) applyFacing(direction);
        else applyFacing(flipFrom);
        pig.removeAttribute("data-feel-flip");
        motor.resetFlip();
        settle.schedule(600);
      });
    }
    function cancelSwap() {
      if (swapTimer !== null) clearTimeout(swapTimer);
      swapTimer = null;
      pendingSwap = null;
      if (flashing) {
        flashing = false;
        motor?.pressTarget(0);
      }
    }
    function coverSwap(apply) {
      if (typeof apply !== "function") return;
      if (!enabled() || dragging2 || runner.isFlying() || pig.getAttribute("data-pet-snap") === "true" || pig.getAttribute("data-react") !== null || pig.getAttribute("data-micro-action") !== null) {
        apply();
        return;
      }
      pendingSwap = apply;
      if (swapTimer !== null) return;
      flashing = true;
      motor.pressTarget((FEEL.pressSquash + 0.015) * scale2());
      settle.begin();
      swapTimer = setTimeout(function() {
        swapTimer = null;
        const run = pendingSwap;
        pendingSwap = null;
        flashing = false;
        if (run !== null) run();
        motor.pressTarget(0);
        settle.schedule(650);
      }, FEEL.swapApplyMs);
    }
    const runner = createFlightRunner({
      getShell,
      host: host3,
      onStart: function() {
        settle.begin();
      },
      onImpact: applyImpact,
      onDust: burstDust,
      onTilt: function(vx) {
        if (motor === null) return;
        const limit = FEEL.tiltMaxFly * scale2();
        motor.tiltTarget(clamp5(-vx * FEEL.tiltGain, -limit, limit));
      },
      onSound: function(key2) {
        playSound(key2, { soft: mode === "soft" });
      },
      onFinish: function(result) {
        if (motor !== null) motor.tiltTarget(0);
        if (result.dizzy) dizzyFx.trigger();
        settle.schedule(900);
      }
    });
    function catchFlight() {
      if (!runner.catch()) return false;
      applyImpact(0.06 * scale2());
      playSound("catch", { soft: mode === "soft" });
      return true;
    }
    function onAnimationEnd(event) {
      const name = event?.animationName;
      if (name === "dp-jump" || name === "dp-feed-hop" || name === "dp-play-hop") applyImpact(0.075 * scale2());
    }
    pig.addEventListener?.("animationend", onAnimationEnd);
    let stopPreference = function() {
    };
    try {
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onChange = function() {
          setMode(effectiveFeelMode());
        };
        query.addEventListener?.("change", onChange);
        stopPreference = function() {
          query.removeEventListener?.("change", onChange);
        };
      }
    } catch {
    }
    const stopModeListener = onFeelModeChange(function(next) {
      setMode(next);
    });
    return {
      ready: function() {
        return motor !== null;
      },
      mode: function() {
        return mode;
      },
      wake,
      press: pressPig,
      lift: liftPig,
      move: movePig,
      release: releasePig,
      tap,
      crouch,
      impact: function(amount) {
        applyImpact(typeof amount === "number" ? amount : 0.09);
      },
      face,
      coverSwap,
      dizzy: function() {
        dizzyFx.trigger();
      },
      cancelDizzy: function() {
        dizzyFx.cancel();
      },
      isFlying: function() {
        return runner.isFlying();
      },
      catchFlight,
      setDragging: function(on) {
        dragging2 = on === true;
      },
      dispose: function() {
        disposed = true;
        stopModeListener();
        stopPreference();
        runner.dispose();
        settle.dispose();
        settle.reset();
        cancelSwap();
        if (crouchTimer !== null) clearTimeout(crouchTimer);
        if (tapTimer !== null) clearTimeout(tapTimer);
        if (wakeTimer !== null) clearTimeout(wakeTimer);
        crouchTimer = null;
        tapTimer = null;
        wakeTimer = null;
        dizzyFx.dispose();
        pig.removeEventListener?.("animationend", onAnimationEnd);
        motor?.dispose();
        pig.removeAttribute("data-feel");
        pig.removeAttribute("data-feel-flip");
        pigBody.style.willChange = "";
        pigHold.style.willChange = "";
      }
    };
  }

  // src/client/index.js
  function mountGame() {
    var devMode = false;
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
        scene: scene6,
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
        pigHold,
        pigBody,
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
      var cardEdit = null, profileDraft = null;
      var isOpen = desktopShell() === null && readStore(OPEN_KEY) === "true";
      var lastStage = null;
      var lastPendingAt = 0;
      var lastPendingId = 0;
      var pollTimer = null;
      var fx = createEffects({
        scene: scene6,
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
      var busy4 = false;
      var feel2 = createFeel({
        pig,
        pigHold,
        pigBody,
        scene: scene6,
        host: host3,
        pigArt,
        pigEmoji,
        burst: (
          /** @type {any} */
          burst
        ),
        getShell: desktopShell,
        isQuiet: function() {
          return view.dialogue.quiet === true;
        },
        onGeometry: function() {
          desktopShell()?.syncGeometry?.();
        }
      });
      configureSound({ isQuiet: function() {
        return view.dialogue.quiet === true;
      } });
      setArtSwapHook(function(apply) {
        feel2.coverSwap(apply);
      });
      fx.setFeel(feel2);
      var ctx = {
        host: host3,
        card: card2,
        content,
        footer,
        scene: scene6,
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
        get profileDraft() {
          return profileDraft;
        },
        set profileDraft(next) {
          profileDraft = next;
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
          return busy4;
        },
        set busy(next) {
          busy4 = next;
        },
        justBought: null,
        homePage: 0,
        get stopped() {
          return stopped;
        },
        set stopped(next) {
          stopped = next;
        },
        get feel() {
          return feel2;
        },
        get devMode() {
          return devMode;
        }
      };
      var layout = createLayout(ctx);
      var panel = createPanel(ctx);
      ctx.select = panel.select;
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
      ctx.petShy = function() {
        playPigPet(pig);
      };
      ctx.previewArt = function(name) {
        forceFeedbackArt(name);
        syncPigArt(pig, pigArt, pigEmoji);
      };
      ctx.idleNow = function(key2) {
        if (ctx.life) ctx.life.idleNow(key2);
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
      var gestures = attachGestures({
        scene: scene6,
        host: host3,
        pig,
        feel: feel2,
        getView: function() {
          return view;
        },
        send: send2,
        pokeBox,
        getRight: function() {
          return userRight;
        },
        setRight: function(value) {
          userRight = value;
        },
        getBottom: function() {
          return userBottom;
        },
        setBottom: function(value) {
          userBottom = value;
        },
        clampPig,
        fitPanel,
        desktopShell,
        isDesktop: deskShell !== null,
        isPanelOpen: function() {
          return isOpen;
        },
        writePosition: function() {
          writeStore(POSITION_KEY, JSON.stringify({ right: userRight, bottom: userBottom }));
        }
      });
      scene6.addEventListener("contextmenu", function(event) {
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
          return gestures.isDragging();
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
      var life = splitRole === "panel" || splitRole === "ext" ? null : attachLife({
        send: send2,
        isStopped: function() {
          return stopped;
        },
        isBusy: function() {
          return busy4;
        },
        isOpen: function() {
          return isOpen;
        },
        getView: function() {
          return view;
        },
        isDragging: function() {
          return gestures.isDragging();
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
        desktopShell,
        feel: feel2
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
        panel.dispose();
        stopSizePreference();
        updateNotice.stop();
        stopResize();
        autoCollapse.dispose();
        gestures.dispose();
        panel.dispose();
        dev.dispose();
        if (pollTimer !== null) window.clearInterval(pollTimer);
        life?.dispose();
        setArtSwapHook(null);
        fx.setFeel(null);
        feel2.dispose();
        fx.dispose();
        pollTimer = null;
        host3.remove();
        style.remove();
        font.remove();
      }
      return dispose;
    }
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
  function createClientPlugin() {
    const exports = { name: "dsh-piggy", apply: mountGame, desktop };
    exports.desktop = desktop;
    return exports;
  }

  // adapters/dsh/client.js
  var game = { mount: mountGame, desktop };
  window.piggyGame = game;
  if (
    /** @type {any} */
    window.__ModuleLoader__
  ) {
    window.__ModuleLoader__.load({ id: "dsh-piggy", factory: createClientPlugin });
  }
})();
