// @ts-check
/**
 * G 批次的台词（docs/numbers/G4-lines.md，用户 2026-10-05：按稿直接上）。
 *
 * - MORE_LINES：原有场景翻倍加的句子，和新场景（出门、买东西、钓鱼、换皮肤……）；
 *   data/lines.js 把它们并进 LINES。
 * - 按时间说话的场景（时段、提醒、节日）和摸不同部位的场景也在这里，规则在 core/talk.js。
 * @module dsh-piggy/data/lines-more
 */

/** @param {string} text @param {string} [reply] */
const line = (text, reply) => Object.freeze(reply === undefined
  ? { text }
  : { text, replies: Object.freeze([Object.freeze({ label: reply })]) })
const scene = (...lines) => Object.freeze(lines)

export const MORE_LINES = Object.freeze({
  // ---- 原有场景翻倍 -----------------------------------------------------------
  eat: scene(
    line('今天的饭有[主人]的味道（是夸你）'), line('慢点慢点，我还没嚼完'), line('吃一口，长一两，没关系，我不怕'),
    line('这个好吃，下次还要这个', '记住了'), line('我宣布：这是今天最好的一顿'), line('吃饭的时候别看我，我会害羞'),
  ),
  full: scene(line('饱了，可以开始发呆了'), line('肚子里装满了，心里也是'), line('饱饱的，今天不会想别的事了')),
  overfull: scene(line('再吃我就要被称重了……'), line('你是不是在给我养膘？', '没有没有'), line('我的肚子在抗议，听见了吗')),
  bathe: scene(
    line('水温刚好，不是在焯水吧？', '放心'), line('我现在是一只体面的猪了'), line('泥巴再见，泥巴我会想你的'),
    line('别洗耳朵后面，那里有我的秘密'), line('洗完别闻我说「好香」，有点吓人'),
  ),
  play: scene(
    line('你扔，我捡，我们配合得天衣无缝'), line('哇！差点接到！'), line('再来再来，我刚热完身', '来！'),
    line('玩耍使我快乐，也使我变瘦'), line('你也动动吧，坐太久了'),
  ),
  pet: scene(
    line('手感是不是很好？不许说「像五花肉」'), line('再摸我就要睡着了'), line('嗯……这样很好'), line('你今天摸得特别认真'),
    line('[主人]，我们算不算好朋友？', '当然算'), line('这是我一天里最喜欢的时刻'), line('摸猪可以降血压，这是科学（我编的）'),
  ),
  hungry: scene(line('我饿得能看见幻觉了，你头上有个包子'), line('再不吃饭，我就要开始吃自己的影子了'), line('饭饭……饭饭……', '马上来')),
  dirty: scene(line('我身上的泥巴已经可以种花了'), line('苍蝇绕着我飞，它们在开会讨论我'), line('我需要一个澡，一个热的（不要太热）', '好')),
  lonely: scene(line('我刚才跟墙聊了一会儿，墙不太会聊天'), line('你还记得你养了一只猪吗', '记得'), line('没事，我就是想看看你还在不在')),
  idle: scene(
    line('我数了一下，屏幕上有很多字，我一个都没写'), line('你写的东西好长，我能睡一觉吗'), line('我刚才梦见自己会飞，醒了发现会的只有吃'),
    line('外面有人在炒菜，我紧张了一下'), line('坐直，[主人]，你的背在哭'), line('要不要喝口水？我替你记着', '好'),
    line('你的屏幕好亮，我眯一会儿'), line('刚才那个功能我觉得写得不错（我看不懂，但我支持你）'),
  ),
  workDone: scene(line('老板问我能不能长期干，我说要问[主人]'), line('赚的钱给你，请我吃顿好的就行', '成交'), line('打工好累，人类每天都这样吗')),
  tired: scene(line('我需要躺平，现在，立刻'), line('我的四条腿已经各自下班了'), line('累得连饭都……不，饭还是要吃的')),
  study: scene(line('今天学了一个新词，忘了'), line('老师说我很有潜力，潜在哪我也不知道'), line('学习使我进步，也使我饿', '去吃吧')),
  graduate: scene(line('证书挂墙上，别挂菜刀旁边'), line('我是全班最宽的毕业生'), line('有文化的猪，不容易被骗进厨房')),
  tripBack: scene(line('外面到处都是饭馆，我一路低着头走的'), line('我看见海了！海里没有猪'), line('拍了好多照片，每张都在笑（其实很饿）')),
  sick: scene(line('我觉得我需要一个抱抱，和一颗药', '都给你'), line('身体里有个小坏蛋在搞装修'), line('我生病了，病猪肉不能吃——这是好消息')),
  wrongMedicine: scene(line('这个药……好像是给狗吃的'), line('我原谅你，你看起来比我还难受'), line('下次看清楚说明书好不好', '好')),
  cured: scene(line('我活过来了！第一件事：吃饭'), line('阎王爷看了看我的体重，说「再养养」'), line('健康真好，我现在可以重新担心别的事了')),
  levelup: scene(line('升级了，奖励是更大的饭量'), line('我变强了，至少数字上是这样'), line('你看见了吗？我升级了！', '看见了')),
  growUp: scene(line('长大的感觉，就是锅变多了'), line('我长开了……你别用这个词'), line('[主人]，你也要一起长大哦')),
  coronation: scene(line('本王今日开恩，免你一顿不喂之罪'), line('王冠好重，脖子要变长了'), line('臣民们，开饭！'), line('[主人]是本王的首席喂饭官', '遵命')),
  contract: scene(line('我现在是恶魔了，但还是怕热水'), line('角是新的，撒娇是旧的'), line('恶魔也需要被摸摸'), line('签了契约，以后谁也不能把我做成菜', '那当然')),
  enter: scene(line('你终于回来了，我数了好久的像素'), line('欢迎回来，今天也拜托多喂我一点'), line('我刚刚一直在这里，一动不动，很乖', '真乖')),
  death: scene(line('记得给我烧点饲料……'), line('[主人]，别难过，我只是去下一个猪圈了')),
  revive: scene(line('那边的猪都很瘦，我还是回来吧'), line('我回来了，饭还在吗'), line('差一点就见到猪八戒了')),
  signIn: scene(line('又是新的一天，我还在，你也在'), line('第 7 天有大礼，坚持住')),
  gift: scene(line('打开看看？我也不知道是什么'), line('我替你守着它好久了')),
  pomodoroStart: scene(line('我闭嘴了，从现在开始'), line('专心！我帮你瞪着屏幕'), line('我当一块安静的五花肉')),
  pomodoroDone: scene(line('做完了！奖励自己摸一下猪'), line('你好厉害，我都看睡着了'), line('起来走走，顺便看看我')),
  pomodoroAbandon: scene(line('没关系，番茄也会累'), line('那我们先吃点东西？'), line('下次再一起努力')),

  // ---- 新场景 ----------------------------------------------------------------
  workStart: scene(line('出门搬砖去了'), line('我去给家里挣饲料钱'), line('老板，我来了！')),
  studyStart: scene(line('上学去！书包里装的是零食'), line('今天也要听懂一句'), line('老师别点我名')),
  tripStart: scene(line('出发啦！'), line('我会给你带特产的（不是腊肉）'), line('路上别想我')),
  buy: scene(line('买到了！'), line('这个钱花得值'), line('谢谢老板（我说的是你）')),
  poor: scene(line('钱包空空，跟我的饭盆一样'), line('我们好像有点穷'), line('要不……我去打工？')),
  fishCatch: scene(line('钓到啦！'), line('晚饭有着落了'), line('这条鱼看我的眼神不太友好')),
  fishRare: scene(line('是大的！是大的！'), line('这条鱼值得写进日记'), line('快拍照！')),
  fishEscape: scene(line('它跑了……'), line('下一条一定是我的'), line('鱼也是要面子的')),
  skin: scene(line('好看吗？'), line('新衣服！转个圈给你看'), line('我觉得我变帅了')),
  bodyChange: scene(line('我好像……圆了一点'), line('这不是胖，是可爱的密度变大了'), line('秤说的话不能全信')),

  // ---- 按时间说话（core/talk.js 决定什么时候说）---------------------------------
  morning: scene(line('早上好！今天也要好好吃饭'), line('起这么早，你是要去当早餐吗（我开玩笑的）'), line('早安，[主人]，我昨晚梦见你了')),
  noon: scene(line('中午了，吃饭吃饭！'), line('你吃了吗？我饿了，你肯定也饿了'), line('午饭别吃猪肉好不好', '好')),
  afternoon: scene(line('下午好困……我先睡为敬'), line('喝杯茶吧，我陪你发会儿呆'), line('下午最适合打盹，科学研究（我编的）')),
  evening: scene(line('天黑了，今天辛苦啦'), line('晚饭吃什么？我投票给苹果'), line('下班了吗？还没？我等你')),
  lateNight: scene(line('这么晚了还不睡？', '马上睡'), line('熬夜的人会变成熊猫，熬夜的猪会变成腊肉'), line('我先睡了，你也早点')),
  deepNight: scene(line('[主人]……现在是凌晨，你是认真的吗'), line('我已经睡醒一觉了，你还在'), line('天快亮了，求你睡一会儿')),
  water: scene(line('喝口水吧，我替你喝不了'), line('嘴唇干了吧？去倒杯水'), line('喝水时间到！咕嘟咕嘟')),
  eyes: scene(line('看看远处，三十秒就好'), line('眼睛累了，闭一会儿，我帮你看着'), line('站起来伸个懒腰，我也伸一个')),
  weekend: scene(line('周末了还来看我，你真好'), line('今天不上班吧？那就多陪我一会儿')),
  newYear: scene(line('新年快乐！今年也请多多喂我')),
  valentine: scene(line('今天的我是限量版的，送给你')),
  springFestival: scene(line('过年好！……今年请一定不要吃猪肉', '不吃')),
  lantern: scene(line('吃汤圆吗？汤圆没有猪，我放心了')),
  qingming: scene(line('想念一下以前的猪……我是说朋友们')),
  labour: scene(line('劳动节！我决定今天不劳动')),
  children: scene(line('我也是小朋友，礼物在哪？')),
  dragonBoat: scene(line('粽子里有肉，我选择看不见')),
  qixi: scene(line('今天要和最重要的人在一起，所以我在这里')),
  midAutumn: scene(line('月亮好圆，像我的肚子')),
  national: scene(line('国庆快乐！放假记得陪陪我')),
  christmas: scene(line('圣诞快乐！圣诞老人会给猪送礼物吗')),
  pigBirthday: scene(line('今天是我的生日！[主人]记得吗？', '生日快乐')),

  // ---- 摸不同部位（客户端按点的位置告诉核心是哪儿）----------------------------
  petHead: scene(line('摸头会长不高的……算了，长不高也好'), line('再摸摸头～'), line('我的头很圆，是不是很好摸')),
  petEars: scene(line('耳朵好痒！'), line('别揪，会变成猪耳朵……我本来就是'), line('嘘，耳朵在听你说话')),
  petNose: scene(line('阿——嚏！'), line('鼻子是用来闻饭的，不是用来按的'), line('哼哼！（这是抗议）')),
  petBelly: scene(line('哈哈哈好痒！'), line('别按肚子，刚吃饱'), line('软吧？不许说「五花」')),
  petBack: scene(line('背上那块，对，就是那里'), line('按摩服务，五星好评'), line('你的手法很专业')),
  petTail: scene(line('别碰尾巴！……好吧可以碰一下'), line('我的尾巴会自己转，你看'), line('尾巴是猪的秘密武器')),
  petFeet: scene(line('脚不能摸，会痒'), line('我的蹄子刚走过泥巴哦'), line('干嘛，想跟我握手？', '握手')),
  petTooMuch: scene(line('够了够了，毛要掉了'), line('你是不是在找哪块最嫩？'), line('我要收费了，一下一个苹果'), line('再摸我就生气了！（其实没有）'), line('让我休息一下……')),
})

/** 一天里的时段（本地时间，含起点不含终点；深夜跨零点）。 */
export const TALK_SLOTS = Object.freeze([
  Object.freeze({ scene: 'morning', from: 6, to: 9 }),
  Object.freeze({ scene: 'noon', from: 11, to: 13 }),
  Object.freeze({ scene: 'afternoon', from: 14, to: 16 }),
  Object.freeze({ scene: 'evening', from: 18, to: 20 }),
  Object.freeze({ scene: 'lateNight', from: 23, to: 2 }),
  Object.freeze({ scene: 'deepNight', from: 2, to: 5 }),
])

/** 在线满多久提醒一次（分钟）。 */
export const WATER_EVERY_MINUTES = 90
export const EYES_EVERY_MINUTES = 120

/** 公历节日：月-日 → 场景。 */
export const SOLAR_HOLIDAYS = Object.freeze({
  '01-01': 'newYear', '02-14': 'valentine', '05-01': 'labour', '06-01': 'children', '10-01': 'national', '12-25': 'christmas',
})

/** 农历节日和清明按年份写死（lunardate 算的，2026–2029），以后再补。 */
export const DATED_HOLIDAYS = Object.freeze({
  '2026-02-17': 'springFestival', '2026-03-03': 'lantern', '2026-04-05': 'qingming', '2026-06-19': 'dragonBoat', '2026-08-19': 'qixi', '2026-09-25': 'midAutumn',
  '2027-02-06': 'springFestival', '2027-02-20': 'lantern', '2027-04-05': 'qingming', '2027-06-09': 'dragonBoat', '2027-08-08': 'qixi', '2027-09-15': 'midAutumn',
  '2028-01-26': 'springFestival', '2028-02-09': 'lantern', '2028-04-04': 'qingming', '2028-05-28': 'dragonBoat', '2028-08-26': 'qixi', '2028-10-03': 'midAutumn',
  '2029-02-13': 'springFestival', '2029-02-27': 'lantern', '2029-04-04': 'qingming', '2029-06-16': 'dragonBoat', '2029-08-16': 'qixi', '2029-09-22': 'midAutumn',
})

/** 摸的部位 → 场景。 */
export const PET_PARTS = Object.freeze({
  head: 'petHead', ears: 'petEars', nose: 'petNose', belly: 'petBelly', back: 'petBack', tail: 'petTail', feet: 'petFeet',
})

/** 30 秒内摸到第 8 下开始不耐烦，不再加心情；停手 1 分钟消气。 */
export const PET_ANNOYED = Object.freeze({ windowMs: 30_000, after: 8, calmMs: 60_000 })

/** 每个场景记住最近几句，不重复。 */
export const LINE_MEMORY = 3
