// @ts-check
/**
 * 回复之后，小猪接一句 —— 静态文案表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 文案来自用户已确认方向的审稿稿：
 *   docs/numbers/reply-followups-20261022.md（总说明）
 *   docs/numbers/reply-followups-20261022-01.md（第 1–48 项）
 *   docs/numbers/reply-followups-20261022-02.md（第 49–96 项）
 *   docs/numbers/reply-followups-20261022-03.md（第 97–144 项）
 *
 * 键 `场景:原总表下标:回复下标` 是稳定身份：场景名、LINES[场景] 里的下标、该行 replies
 * 数组的下标。不要按显示文字、口头禅或主人称呼去找接话——改名、换口头禅、换性格都会变。
 * 下标是"合并后的总表下标"（BASE_LINES 在前、MORE_LINES 在后），和 dialogue.lastByScene
 * 记的是同一套下标。台词表只许在末尾追加：在中间插入会让这里的键、旧存档 open 的身份和
 * lastByScene 一起错位。
 *
 * 每个键都有 `generic` 通用回退句；`personalities` 里是按性格的专属句。
 * 优先用当前性格那一句，性格没有专属句（旧存档、对话途中换性格、未知性格）时用通用句。
 *
 * 数量守卫：144 个回复分支 = 144 句通用 + 580 句性格，共 724 句；
 * 原句、按钮文字、适用性格都对得上现有 LINES。见 test/reply-followups.test.js。
 *
 * @module dsh-piggy/data/reply-followups
 */

/**
 * @typedef {object} ReplyFollowup
 * @property {string} generic - 通用回退句
 * @property {Readonly<Record<string, string>>} personalities - 性格 key → 专属接话
 */

/**
 * 一行文案配一组性格句；数据和 LINES 一样在加载时冻结，运行期不会被改。
 * @param {string} generic @param {Record<string, string>} personalities
 * @returns {ReplyFollowup}
 */
const followup = (generic, personalities) => Object.freeze({ generic, personalities: Object.freeze(personalities) })

/** @type {Readonly<Record<string, ReplyFollowup>>} */
export const REPLY_FOLLOWUPS = Object.freeze({
  // wake
  'wake:9:0': followup('听见你叫我，今天就醒得快些', { peppy: '醒啦，今天也想跟你玩', clingy: '听见你叫我，立刻贴过来' }),
  'wake:10:0': followup('抱到啦，我慢慢睁开眼', { clingy: '抱紧一点，我再清醒', shy: '就抱一下下，别看我脸红' }),

  // eat
  'eat:0:0': followup('饭好吃，夸奖更好吃', { peppy: '夸得我尾巴都要起飞', curious: '你夸我乖，我吃得更香啦' }),
  'eat:9:0': followup('记下这份喜欢，下回再尝', { normal: '好呀，下次就选这份喜欢' }),
  'eat:19:0': followup('好呀，我挨着你慢慢吃', { clingy: '挨着你，饭都香了一点', shy: '我靠近啦，你别笑我' }),
  'eat:20:0': followup('尾巴摇完，心情还在晃', { peppy: '好吃到尾巴自己开工', curious: '我数着尾巴，刚好摇了三下' }),

  // full
  'full:9:0': followup('吃饱靠一会儿，刚刚好', { clingy: '位置留给我，我靠好啦', shy: '那我轻轻挨过去哦', normal: '靠一会儿，什么也不用赶' }),
  'full:13:0': followup('好，饭后就坐你旁边', { normal: '有你坐着，饭后刚刚好', clingy: '我把小凳子挪到你旁边', sisterly: '我慢慢消消食，你陪我坐会儿' }),

  // overfull
  'overfull:2:0': followup('先停停，我的肚子要开圆桌会了', { goofy: '球滚起来还认得回家吗' }),
  'overfull:4:0': followup('别喂啦，肚皮已经开始加班', { cranky: '哼，我只是圆得很有精神' }),
  'overfull:7:0': followup('好，给这口留个位置', { peppy: '好，那就把期待存起来', lazy: '嗯，留着明天慢慢惦记', cranky: '哼，刚好我也不想再吃了', sisterly: '好，吃得舒服最重要', snooty: '少一口也挡不住我可爱', normal: '好呀，留着也没关系', clingy: '好，我先挨着你，不惦记那口了', shy: '好，我偷偷松口气', curious: '好，我记住这口，留着下次再尝', mischievous: '嘿嘿，我把这口藏进想象', goofy: '省下这一口，肚子终于有空位啦', earnest: '记下啦，先停在刚好的时候' }),
  'overfull:13:0': followup('梦里见，记得带上小盘子', { lazy: '好，我慢慢梦到它', goofy: '梦里记得给我配个小盘子' }),

  // bathe
  'bathe:1:0': followup('谢谢你，擦干就暖和了', { shy: '谢谢你，我缩成一小团啦' }),
  'bathe:5:0': followup('我先试试水温，再放心洗', { cranky: '我信你一次，先把蹄子伸进来' }),
  'bathe:15:0': followup('洗香啦，来蹭一下', { clingy: '我来啦，香香地贴一下', shy: '那我蹭一下就乖乖站好' }),
  'bathe:19:0': followup('抱抱收到，干净又暖和', { clingy: '抱抱要把香味也抱住', peppy: '干净抱抱，出发咯', shy: '我准备好啦，轻轻抱哦' }),

  // play
  'play:1:0': followup('接住了，这一下配得上夸奖', { peppy: '再抛一次，我还能接', snooty: '当然啦，我的身手也可爱' }),
  'play:7:0': followup('好，再玩一轮看看', { peppy: '好，下一轮我冲啦' }),
  'play:15:0': followup('再玩一小会儿，然后歇歇', { peppy: '好耶，再玩一小轮', clingy: '再一轮，然后我挨着你' }),
  'play:18:0': followup('好，我把球放下陪你', { clingy: '那我安心把球放一边啦' }),

  // pet
  'pet:1:0': followup('好呀，你的手摸着很舒服', { peppy: '摸摸收到，我开心转圈', clingy: '你的手再多停一会儿嘛' }),
  'pet:11:0': followup('当然算，我喜欢和你待着', { clingy: '那我把这个位置留给你', shy: '我也这么想，悄悄告诉你' }),
  'pet:15:0': followup('好，我就靠在这里', { clingy: '好，我就在你手边趴好' }),
  'pet:20:0': followup('枕到啦，我轻轻的，不压麻你的手', { lazy: '软乎乎的，正适合打盹', clingy: '借到了，我要挨着你睡会儿' }),

  // hungry
  'hungry:1:0': followup('听见啦，我在这里等一等', { peppy: '听见啦，我的肚子在打鼓', clingy: '好呀，我先靠你旁边等' }),
  'hungry:5:0': followup('我先在旁边乖乖等饭', { clingy: '我小声念着，等你有空' }),
  'hungry:12:0': followup('好，先抱一下再等饭饭', { clingy: '那我先抱一下，再等饭', shy: '抱一下就好，我会乖等' }),
  'hungry:15:0': followup('好呀，我乖乖等这口饭', { clingy: '我等你，先贴贴也行', peppy: '收到，我把期待摇成尾巴', shy: '好，我坐好等饭饭啦' }),

  // dirty
  'dirty:2:0': followup('泡泡浴安排上，洗得舒舒服服', { peppy: '泡泡浴开场，我准备好啦', lazy: '泡一会儿，慢慢洗香香', cranky: '水别太凉，我可盯着呢', sisterly: '好，洗舒服了再出来', snooty: '泡泡也要衬得我可爱', normal: '好呀，我们慢慢来', clingy: '洗完还想挨着你', shy: '好，我会把泡泡抱紧', curious: '泡泡叠成小山，我先洗小猪蹄', mischievous: '我先藏进最大的泡泡里', goofy: '泡泡落头上会变帽子吗', earnest: '好，水温合适再开始' }),
  'dirty:5:0': followup('好，温温的水最舒服', { peppy: '好，温温热热刚刚好', lazy: '暖一会儿，洗掉困意', cranky: '我会检查水温的', sisterly: '好，舒服最要紧', snooty: '洗香之后更亮眼', normal: '好呀，调到刚好的温度', clingy: '洗完记得给我抱抱', shy: '太热的话我会躲泡泡里', curious: '温温的水，我想先试试泡泡', mischievous: '我先把泡泡排成队', goofy: '水温刚好，我还不用当汤圆', earnest: '记住了，热但不烫' }),
  'dirty:8:0': followup('听你说不嫌我，我就放心啦', { clingy: '那我放心贴回你身边', shy: '谢谢你，我又敢靠近啦' }),
  'dirty:12:0': followup('好，洗掉脏脏再清清爽爽见你', { peppy: '洗香香去，待会儿见', lazy: '好，慢慢冲掉这一身累', cranky: '知道啦，我自己会洗干净', sisterly: '好，洗完就清清爽爽', snooty: '洗好就恢复闪亮登场', normal: '好呀，洗完再来坐坐', clingy: '洗完我马上回你身边', shy: '好，我带着泡泡进去', curious: '泡泡能藏住小蹄子，我想试试', mischievous: '我去和泡泡打个滚', goofy: '脏脏再见，别跟错猪', earnest: '好，洗干净再回来' }),

  // lonely
  'lonely:1:0': followup('谢谢你来陪我，我挪近一点', { clingy: '好，我挨着你待一会儿', shy: '谢谢你陪我，我心里暖暖的' }),
  'lonely:4:0': followup('记得就好，我也记得你', { cranky: '哼，记得就好', shy: '记得我就很开心了', snooty: '这么可爱的猪，当然难忘' }),
  'lonely:9:0': followup('看见你啦，今天也碰面了', { peppy: '看见你啦，我也亮起来了', lazy: '嗯，我就在这里慢慢等', cranky: '哼，我才没有一直看门', sisterly: '谢谢你来，忙完也记得歇歇', snooty: '一眼就看到我的可爱了吧', normal: '我也看见你啦', clingy: '你一来，我就想挪近些', shy: '被你看到，我有点开心', curious: '被你发现啦，我刚好也在看你', mischievous: '我刚好摆了个等待姿势', goofy: '我刚跟影子说你要来了', earnest: '我记下这次见面啦' }),
  'lonely:13:0': followup('收到啦，这点注意力我收好', { clingy: '借到啦，我靠近一点点', shy: '谢谢你，我把这点温暖收好' }),

  // idle
  'idle:3:0': followup('好，闭一会儿眼再继续', { sisterly: '好，闭一会儿再看也行' }),
  'idle:13:0': followup('好，喝完水再忙也不迟', { sisterly: '好，喝完慢慢回来', earnest: '记得喝几口，别急着忙' }),
  'idle:21:0': followup('好呀，安静坐会儿就很舒服', { normal: '安静坐着也很舒服', sisterly: '好，我们一起放松一会儿' }),
  'idle:25:0': followup('好，一分钟就留给发呆', { lazy: '好，一分钟刚好够发呆', normal: '好呀，这一分钟归我们' }),

  // workDone
  'workDone:0:0': followup('你说辛苦了，我这趟就值啦', { peppy: '听你说辛苦，我尾巴摇得更欢', lazy: '被你一夸，我先坐下歇会儿', cranky: '哼，这点活还难不倒我', sisterly: '听你这么说，我心里暖乎乎', snooty: '勤快又可爱，说的就是我', normal: '谢谢你，我回来就能安心歇会儿', clingy: '夸完让我挨着你待会儿嘛', shy: '我把辛苦藏好，偷偷收下夸奖', curious: '原来被你夸，比赚到钱还开心', mischievous: '辛苦换来几枚，我摇尾巴给你看', goofy: '钱袋鼓鼓的，差点被我当枕头', earnest: '我把这份辛苦和夸奖都记住啦' }),
  'workDone:4:0': followup('成交，先聊聊想吃什么', { sisterly: '成交，先一起坐下来歇会儿', normal: '好呀，咱们慢慢商量吃什么' }),
  'workDone:9:0': followup('你夸我辛苦，我就开心啦', { clingy: '你一夸我，就想挨着你待会儿', peppy: '被你夸到，我尾巴又摇起来' }),
  'workDone:14:0': followup('批准成功，给你一个抱抱', { clingy: '批准收到，我要抱久一点', shy: '谢谢批准，我轻轻抱一下哦' }),

  // tired
  'tired:0:0': followup('好，先休息一会儿再说', { peppy: '好，我歇好再陪你活动', lazy: '嗯，先把自己放软一点', cranky: '我才没逞强，只是坐一下', sisterly: '好，我先歇好，再陪你一会儿', snooty: '累了也不影响我可爱', normal: '好，我挨着你安静歇会儿', clingy: '那我挨着你一起歇', shy: '我靠近一点，轻轻休息', curious: '歇一会儿，脑袋又能装新鲜事啦', mischievous: '我假装充电，嘘', goofy: '歇一下，尾巴也要缓冲', earnest: '好，先休息，再看下一步' }),
  'tired:9:0': followup('好，我们挨着歇一歇', { lazy: '好，我挨着你打个小盹', clingy: '我靠好啦，陪你一起歇', normal: '好，我靠着你慢慢歇' }),
  'tired:13:0': followup('我在呢，安静陪你一会儿', { normal: '听见啦，我安静陪着你', sisterly: '好，沉默也可以很安心' }),

  // study
  'study:0:0': followup('被你夸乖，我把开心收好啦', { peppy: '夸奖收到，脑袋更想开工啦', earnest: '你夸我乖，我就更想学好了' }),
  'study:5:0': followup('好，我先吃饱再接着学', { peppy: '好耶，吃饱再学！', lazy: '正好，先填饱肚子', cranky: '我知道啦，先吃饭嘛', sisterly: '先吃饱再继续，我听你的', snooty: '吃饱了也要保持可爱', normal: '好，我先去吃点东西', clingy: '我先吃饭，回来再学', shy: '好嘛，我这就去吃', curious: '我先找点好吃的补补脑', mischievous: '饭盆在催我啦', goofy: '先喂饱肚子这个同学', earnest: '我先吃饭，再接着学' }),
  'study:9:0': followup('这道题终于被我想通啦', { peppy: '这题想通啦，开心！', snooty: '聪明的小猪值得夸吧', earnest: '这道题我会记牢的' }),
  'study:15:0': followup('说好了，学会就讲给你听', { peppy: '我学会就第一个告诉你！', clingy: '第一个告诉你，约好啦', earnest: '我会认真准备好再讲' }),

  // graduate
  'graduate:0:0': followup('毕业啦，我真的没留级', { peppy: '毕业啦，庆祝开跑！', lazy: '终于能安心睡个午觉', cranky: '没留级，我当然厉害', sisterly: '一路努力，终于毕业啦', snooty: '毕业的小猪还是这么耀眼', normal: '谢谢夸奖，我很开心', clingy: '毕业啦，想和你庆祝', shy: '你夸我，我有点害羞', curious: '毕业后先去看看世界', mischievous: '留级名单没等到我呀', goofy: '毕业证要放哪个抽屉', earnest: '这段努力总算有结果' }),

  // tripBack
  'tripBack:0:0': followup('我带回来的东西给你看', { peppy: '快看，我带了好东西！', lazy: '让我先歇会儿再展示', cranky: '我带的东西可不赖吧', sisterly: '路上挑了好久才带回', snooty: '这份小惊喜很配我吧', normal: '给你看，我带回来的东西', clingy: '快来一起看看嘛', shy: '我有点期待你的反应', curious: '你猜我在哪儿发现的', mischievous: '藏不住啦，是我带回来的', goofy: '我记得把它带回来了', earnest: '这是我特地带给你看的' }),
  'tripBack:9:0': followup('抱一下，再给你讲见闻', { clingy: '抱完我就从第一站讲！', shy: '我先抱会儿，再慢慢讲' }),
  'tripBack:15:0': followup('那我从第一站开始讲啦', { normal: '第一站有好多新鲜事！', earnest: '我慢慢讲，你别急着睡' }),

  // sick
  'sick:0:0': followup('好，我乖乖吃药休息', { peppy: '好，我乖乖吃药休息！', lazy: '我先躺好，慢慢吃药', cranky: '好啦，我会按时吃药', sisterly: '谢谢你提醒我吃药', snooty: '我生病也要保持可爱', normal: '好，我会照顾好自己', clingy: '我吃药时你陪我嘛', shy: '嗯，我会乖乖吃药', curious: '我先看看药盒说明', mischievous: '我先乖乖躺好，不逞强了', goofy: '我跟药片和平相处', earnest: '我会按说明吃药休息' }),
  'sick:3:0': followup('抱抱和药都收到啦', { peppy: '抱抱和药都收到了！', lazy: '先抱抱，我再吃药', cranky: '好，我先抱一下再吃药', sisterly: '抱着吃药也安心些', snooty: '我抱着药也很可爱吧', normal: '抱抱后我就吃药', clingy: '你给的抱抱最安心', shy: '抱一下，我就吃药啦', curious: '药要配温水吗', mischievous: '抱抱药药都不许跑', goofy: '我先收下抱抱和药', earnest: '我会乖乖把药吃了' }),
  'sick:9:0': followup('轻轻摸摸，我就安心些', { peppy: '轻轻摸摸，我会快点好！', lazy: '嗯，轻轻摸就好', cranky: '我知道啦，不会逞强', sisterly: '轻轻摸着就很安心', snooty: '生病也要有好手感', normal: '好，我歇着让你摸摸', clingy: '轻轻摸摸，再靠近一点', shy: '嗯，我就不害羞啦', curious: '你这样摸着，我舒服多啦', mischievous: '摸摸力度刚刚好', goofy: '像小羽毛一样舒服', earnest: '我会好好休息的' }),
  'sick:12:0': followup('好呀，你陪我待一会儿', { peppy: '好呀，你陪着我吧！', lazy: '你在旁边，我就安心睡', cranky: '嗯，你在旁边，我就安心一点', sisterly: '谢谢你陪我慢慢休息', snooty: '有你陪着，我状态更好', normal: '好，我们安静待一会儿', clingy: '你陪着我就不想挪开', shy: '嗯，你在我就安心', curious: '我们可以安静看会儿书', mischievous: '我会乖乖休息不捣蛋', goofy: '我就躺这儿陪你发呆', earnest: '谢谢你愿意陪我一会儿' }),

  // wrongMedicine
  'wrongMedicine:0:0': followup('没关系，我先确认一下药', { peppy: '没关系，我先停下来确认', lazy: '苦得我想先躺一会儿', cranky: '我不吃了，先看清药名', sisterly: '谢谢你道歉，我们先核对', snooty: '我先确认清楚再吃', normal: '没事，先停下来看看', clingy: '你陪我确认一下就好', shy: '没关系，我们慢慢弄清楚', curious: '药盒上写的用法是什么', mischievous: '我先乖乖等，咱们看清再吃', goofy: '我先把药盒翻过来看看', earnest: '先核对药名和说明再说' }),
  'wrongMedicine:5:0': followup('好，下次我先看说明书', { peppy: '好，我下次会先看说明！', lazy: '好，我看清楚再吃', cranky: '我记住啦，下次先核对', sisterly: '好，我们先确认用法', snooty: '我会认真看说明的', normal: '好，下次先看清楚', clingy: '下次你陪我一起看嘛', shy: '嗯，我会仔细看', curious: '说明书的用量要看清', mischievous: '我把说明放显眼一点', goofy: '我来找药盒上的小字', earnest: '我会先核对说明再吃' }),

  // cured
  'cured:0:0': followup('好起来啦，我又能陪你了', { peppy: '好啦，我又能陪你玩啦！', lazy: '我好啦，再慢慢活动', cranky: '我恢复得挺快吧', sisterly: '谢谢你照顾我好起来', snooty: '健康的小猪更可爱了', normal: '谢谢你，我也安心啦', clingy: '康复了，快抱抱庆祝', shy: '我好啦，脸也不红了', curious: '又能好奇东张西望啦，谢谢你', mischievous: '病菌被我赶跑啦', goofy: '药盒终于下班啦', earnest: '康复这天，我记住啦' }),
  'cured:9:0': followup('好起来能见你，我很开心', { peppy: '我好啦，回来报到！', clingy: '康复了就想靠近你', shy: '我回来啦，抱抱庆祝' }),
  'cured:13:0': followup('好，快抱抱康复的我', { clingy: '好，快抱抱康复的我', normal: '我现在可以抱紧一点啦', shy: '好呀，我也想抱抱你' }),

  // levelup
  'levelup:0:0': followup('我又长大一点啦', { peppy: '长大啦，下一站继续玩！', lazy: '长大一点，午睡也升级', cranky: '哼，当然越长越可爱', sisterly: '我一点点长大啦', snooty: '长大后的我更上镜了', normal: '慢慢长大，真开心', clingy: '长大也要挨着你', shy: '你夸得我有点脸热', curious: '我接下来还会长高吗', mischievous: '成长悄悄涨了一点点', goofy: '我是不是高了一咪咪', earnest: '这次成长我认真记下' }),
  'levelup:5:0': followup('有你看着，我升级更开心', { peppy: '被你看见啦，我要摇尾巴庆祝！' }),

  // coronation
  'coronation:0:0': followup('我会戴稳王冠，慢慢适应', { peppy: '王冠戴稳，我要闪亮亮！', lazy: '我先适应一下这顶王冠', cranky: '有点重也难不倒我', sisterly: '我会慢慢戴稳它', snooty: '王冠衬得我更耀眼吧', normal: '谢谢你给我打气', clingy: '我戴着王冠靠近你', shy: '你夸我，我有点脸热', curious: '我会注意别让王冠压耳朵', mischievous: '我把王冠扶正啦', goofy: '它会不会滑到鼻子上', earnest: '加冕这刻我会记住' }),
  'coronation:7:0': followup('首席喂饭官，记得准时上岗', { snooty: '当然，本王挑人很准' }),

  // contract
  'contract:0:0': followup('契约签好啦，我还是你的小猪', { peppy: '签好啦，还是最好的我！', lazy: '签完契约我就安心啦', cranky: '哼，我当然是你的猪', sisterly: '我会好好珍惜这份约定', snooty: '契约也衬得我很体面', normal: '嗯，我还是你的小猪', clingy: '签完也要给我贴贴哦', shy: '签好了，我有点开心', curious: '还有没有有趣的小条款', mischievous: '我把契约收好啦', goofy: '签名要画个猪鼻子吗', earnest: '我会记住我们签的约定' }),
  'contract:7:0': followup('这下我放心当你的小猪啦', { cranky: '哼，这下我放心啦' }),

  // enter
  'enter:0:0': followup('看到你回来，我开心得转圈', { peppy: '回来啦，快夸我乖！' }),
  'enter:5:0': followup('你一夸我，尾巴都翘啦', { earnest: '我等你时一直很乖的' }),
  'enter:8:0': followup('好呀，我就在这儿等你看', { normal: '好呀，我就在这儿', clingy: '你看我时，我就靠近点', shy: '被你看着，我有点脸热' }),
  'enter:12:0': followup('好，我会认真听你讲', { sisterly: '慢慢讲，我会陪你听', curious: '我把耳朵竖起来啦' }),

  // revive
  'revive:2:0': followup('谢谢你一直没有放弃我', { peppy: '我回来啦，继续陪你！', lazy: '我醒来就想好好歇会儿', cranky: '我回来啦，这次想靠你近一点', sisterly: '谢谢你一直照顾我', snooty: '幸好有你，我还是很可爱', normal: '我也很高兴能回来', clingy: '回来先让我抱抱你', shy: '我醒来就想见你', curious: '我昏睡时做了奇怪的梦', mischievous: '我终于回来啦', goofy: '我刚刚还以为在做梦', earnest: '我记得你没有放弃我' }),

  // signIn
  'signIn:7:0': followup('听你说明天还来，我今天都更开心', { peppy: '明天也见面，太好啦！', clingy: '听你说明天来，我赚到啦' }),
  'signIn:13:0': followup('听你说明天会来，我放心啦', { clingy: '我听见啦，明天等你来', shy: '好，我也期待明天见你' }),

  // gift
  'gift:7:0': followup('你看，这是我刚收到的宝贝', { peppy: '给你看，这就是我收到的', goofy: '快看，我把宝贝拿近些' }),
  'gift:13:0': followup('今天的小猪心情特别好', { normal: '我领到礼物啦，谢谢你！', clingy: '你记得我，我特别开心', shy: '你记得我，我心里暖暖的' }),

  // pomodoroStart
  'pomodoroStart:9:0': followup('好，我也给你这一轮打气', { earnest: '好呀，我也陪你加油！', peppy: '先把这一小步做好' }),
  'pomodoroStart:15:0': followup('我已经开始期待那次摸摸啦', { clingy: '约好啦，我会记得的', shy: '我等着这轮结束后贴贴' }),

  // pomodoroDone
  'pomodoroDone:9:0': followup('我挨过来啦，你也歇一歇', { normal: '我靠过来陪你歇会儿', sisterly: '好，我也放松一下', earnest: '我陪你靠一会儿就好' }),
  'pomodoroDone:15:0': followup('好，我陪你安静歇会儿', { normal: '好，我们一起慢慢歇', sisterly: '歇着时我就挨着你' }),

  // pomodoroAbandon
  'pomodoroAbandon:9:0': followup('那先歇会儿，事情可以等等', { peppy: '好，休息完再继续！', lazy: '正好，我也想打个盹', cranky: '我才没有逃避，只是歇会', sisterly: '事情等等，先照顾好自己', snooty: '歇着也要美美的', normal: '我先坐下来缓缓', clingy: '我挨着你一起休息', shy: '嗯，休息一下很舒服', curious: '歇一会儿，我就能缓过来', mischievous: '我宣布进入休息模式', goofy: '那我也给脑袋放个假', earnest: '我会把休息也安排好' }),
  'pomodoroAbandon:14:0': followup('摸摸收到，我心情好多啦', { peppy: '好呀，摸摸我就开心了', lazy: '摸摸我，再一起歇会儿', cranky: '哼，准你摸一小下', sisterly: '我就陪你慢慢换心情', snooty: '摸我也能让人开心吧', normal: '好，我就在这儿', clingy: '多摸一下嘛，我喜欢', shy: '你摸我，我有点脸热', curious: '我的脑袋最喜欢被摸啦', mischievous: '我把烦恼藏进耳朵后', goofy: '摸摸我的头就好啦', earnest: '我会记得你摸摸我' }),

  // workStart
  'workStart:7:0': followup('位置留好啦，下班我就回来', { clingy: '我下班就回来找你', shy: '我会记着回到你身边' }),
  'workStart:12:0': followup('忙完我就回来找你', { peppy: '忙完我就回来找你！', clingy: '下班就回来挨着你' }),

  // studyStart
  'studyStart:7:0': followup('摸摸收到，我去上学啦', { clingy: '摸摸收到了，我去上学啦', shy: '我会带着摸摸去上学' }),
  'studyStart:12:0': followup('放学后我就来找你聊天', { peppy: '放学我就来找你！', clingy: '我会第一个来见你' }),

  // tripStart
  'tripStart:6:0': followup('好，回来我再蹭一下', { clingy: '蹭到啦，出门去旅行咯', shy: '我回来还要再蹭一下' }),
  'tripStart:12:0': followup('好，我一路记着，回来讲给你', { curious: '好，我一路记着回来讲', earnest: '我会把见闻讲给你听' }),

  // buy
  'buy:6:0': followup('喜欢呀，我挑了好久呢', { curious: '喜欢呀，这可是我挑的' }),
  'buy:12:0': followup('好呀，下次一起慢慢挑', { peppy: '下次一起挑，约好啦！', clingy: '我就喜欢和你一起逛' }),

  // poor
  'poor:6:0': followup('一点点攒，离它就近一点', { earnest: '慢慢攒，我们离它近些' }),
  'poor:12:0': followup('嗯，开心不用等金币攒满', { sisterly: '金币慢慢来，开心先到', normal: '你也这么想呀，那就不着急' }),

  // fishCatch
  'fishCatch:6:0': followup('那我刚刚的小得意就分你一半', { peppy: '被你看见啦，我的小尾巴都翘了！', lazy: '嗯，鱼上钩那下真精彩', cranky: '我就知道你看见啦', sisterly: '你看到我钓中就好', snooty: '这下竿配得上本猪吧', normal: '有你看着，这一竿更值得记住', clingy: '你看见我钓到啦，开心', shy: '被你看到，我有点害羞', curious: '鱼和你都看见了，我今天没白等', mischievous: '嘿嘿，没错，我特地等你看呢', goofy: '鱼上钩时我还愣了一下', earnest: '这次钓鱼我记下啦' }),
  'fishCatch:12:0': followup('好呀，我们一起等下一条鱼', { normal: '那我慢慢陪你等', clingy: '你在，我就挨着等', shy: '有你陪，我就不怕冷场' }),

  // fishRare
  'fishRare:6:0': followup('好，这份难得我会记住', { earnest: '我会把这份难得记牢' }),
  'fishRare:12:0': followup('好呀，把这份得意分享给你', { peppy: '分你一半得意，再击掌！', snooty: '这份厉害，准你一起收藏', earnest: '我记下啦，下次也和你分享' }),

  // fishEscape
  'fishEscape:6:0': followup('再试试吧，有你陪着就不亏', { sisterly: '没钓到也没关系，我陪你', normal: '再试试也好，我在旁边' }),
  'fishEscape:12:0': followup('好，笑声和面子都收好啦', { cranky: '笑小声点，我还要面子呢', snooty: '给面子不错，再夸我稳重', shy: '你别笑啦，我会更不好意思' }),

  // skin
  'skin:6:0': followup('都喜欢呀，我开心得转圈', { snooty: '每一处都被喜欢，眼光真好', clingy: '都喜欢我呀，那我贴紧你嘛' }),
  'skin:12:0': followup('好，你喜欢我就多穿一会儿', { snooty: '那我为你的眼光多展示会儿', clingy: '你喜欢，我就穿给你看' }),

  // bodyChange
  'bodyChange:6:0': followup('好呀，这身手感就留给你夸', { snooty: '满意就好，这身很衬我', clingy: '你满意，我就安心挨着你' }),
  'bodyChange:12:0': followup('好，把这一身可爱收下吧', { normal: '那我把这份可爱交给你', clingy: '收下我吧，记得常常抱抱', shy: '你收下啦……我也很开心' }),

  // morning
  'morning:6:0': followup('早上好，我们一起醒醒神', { cranky: '早安，我可没特地等你哦', peppy: '早呀！今天也一起醒醒神！', mischievous: '早安！我先藏起你的困意', normal: '早上好，见到你真好' }),
  'morning:12:0': followup('好呀，今天轮到我听你说', { sisterly: '昨晚没听完，今天我陪你聊', normal: '好呀，我把耳朵留给你' }),

  // noon
  'noon:2:0': followup('好，午饭就选别的菜吧', { cranky: '好哦，午饭可别饿着', shy: '好……这样我就放心啦' }),
  'noon:6:0': followup('好，你吃饱了再回来摸我', { earnest: '好，吃饱了再回来摸我' }),
  'noon:12:0': followup('好呀，回来告诉我味道如何', { curious: '好呀，我想知道哪口最好吃', normal: '等你回来，我认真听你说' }),

  // afternoon
  'afternoon:6:0': followup('好，我们一起伸个懒腰', { peppy: '伸开手脚，困意跑远啦！', earnest: '我也伸好啦，陪你舒展一下' }),
  'afternoon:12:0': followup('不客气，我替你守着安静', { sisterly: '能陪到你，我也觉得安心', normal: '不客气，这份安静我们共享' }),

  // evening
  'evening:6:0': followup('好呀，忙完就来摸摸我吧', { peppy: '摸一下就给今天收个尾！', clingy: '来嘛，我今天也想贴贴', snooty: '辛苦啦，来摸摸这位明星' }),
  'evening:11:0': followup('可以呀，饭后陪我一会儿', { clingy: '一点点也好，我想和你待会', shy: '可以呀……我会珍惜这会儿', normal: '谢谢你，饭后一起歇会儿' }),

  // lateNight
  'lateNight:0:0': followup('好，马上睡，明天再聊', { sisterly: '好，明早再聊也来得及' }),
  'lateNight:6:0': followup('好，明天见，今晚先休息', { sisterly: '晚安，明天醒来再慢慢忙', normal: '好好睡，明天见面再说', earnest: '记好啦，明天的小猪也在' }),
  'lateNight:12:0': followup('晚安，摸摸就留着明天收', { clingy: '晚安，我会留着明天的贴贴', shy: '晚安……明天还想挨着你' }),

  // deepNight
  'deepNight:6:0': followup('好，能停就先睡一会儿', { peppy: '好！充好电再陪你出发', lazy: '好，我陪你慢慢睡着', cranky: '知道啦，你也快去睡', sisterly: '嗯，先歇一会儿照顾自己', snooty: '今晚先放过这张熬夜脸', normal: '好，我们都休息一会儿', clingy: '好呀，隔着屏幕陪你入睡', shy: '好……我陪你安静躺会儿', curious: '睡醒再一起发现新东西', mischievous: '我把夜晚偷偷调成睡觉', goofy: '好，我先把枕头认作云', earnest: '记下了，休息也是正事' }),
  'deepNight:12:0': followup('好，记得你也需要休息', { peppy: '知道啦，睡醒我还陪你！', lazy: '嗯，睡觉这事慢慢来', cranky: '知道就好，快把眼睛闭上', sisterly: '好，陪伴也要留点力气', snooty: '当然，明天还得看我可爱', normal: '知道啦，今晚安心睡吧', clingy: '好，梦里也给你留位置', shy: '嗯……晚安，我在这儿呢', curious: '睡醒再聊那些新发现', mischievous: '我把孤单藏进被窝啦', goofy: '好，我和枕头一起值夜', earnest: '记住啦，你也要照顾自己' }),

  // water
  'water:6:0': followup('好，喝水时我给你摇尾巴', { peppy: '好！喝完我给你摇尾巴', sisterly: '去喝一口，我在这等你', earnest: '记下啦，喝完水再回来' }),
  'water:12:0': followup('好呀，喝完回来我还在', { normal: '好，我就在这里等你', clingy: '快去快回，我会想你一小下', shy: '好……我在这里等你回来' }),

  // eyes
  'eyes:6:0': followup('好，闭眼歇会儿，我在这里', { sisterly: '歇一歇眼睛，我陪你安静会', normal: '慢慢闭眼，我会留在这里' }),
  'eyes:12:0': followup('好，活动肩膀再回来找我', { earnest: '活动完肩膀，再回来找我' }),

  // weekend
  'weekend:5:0': followup('好呀，陪我安静发会儿呆', { clingy: '好呀，今天就挨着发呆', shy: '陪你……我也想安静靠近' }),
  'weekend:11:0': followup('好，今天的开心慢慢享用', { normal: '好，开心不必赶着用完', earnest: '好呀，我陪你把今天放慢' }),

  // springFestival
  'springFestival:0:0': followup('好呀，换道菜安心过年', { peppy: '好耶，年菜换好继续庆祝！', lazy: '好，年菜换好就安心歇着', cranky: '哼，这回我能安心过年啦', sisterly: '好呀，咱们换道年菜庆祝', snooty: '明智选择，年宴更衬我', normal: '好，我们安心过个好年', clingy: '好，过年也要挨着你', shy: '好……年节就放心啦', curious: '好呀，我来看看别的年菜', mischievous: '好，我把猪肉藏进传说里', goofy: '好，猪肉请在门外过年', earnest: '记下啦，今年也平安过年' }),

  // pigBirthday
  'pigBirthday:0:0': followup('谢谢你记得我的生日！', { peppy: '谢谢祝福！开心得想蹦起来！', lazy: '谢谢你呀，这句祝福暖乎乎', cranky: '哼，谢谢啦，我才没感动呢', sisterly: '谢谢你记挂我，我心里暖暖的', snooty: '寿星收到祝福，今天加倍可爱', normal: '谢谢你，听了心里软软的', clingy: '谢谢你呀，快让我贴贴庆祝', shy: '谢谢……我会珍藏这句祝福', curious: '谢谢！你的生日祝福好暖呀', mischievous: '谢谢你，蛋糕分你一小口', goofy: '谢谢！我的生日又长一岁啦', earnest: '谢谢你记得，我好好收下啦' }),

  // petHead
  'petHead:6:0': followup('好，再摸摸就多一份喜欢', { peppy: '再摸摸就再收一份喜欢！', clingy: '再摸摸嘛，我还想贴着你' }),
  'petHead:12:0': followup('好，夸完我就更开心啦', { snooty: '真乖，夸得很有眼光', clingy: '你哄我，我就再靠近点' }),

  // petEars
  'petEars:6:0': followup('我听见啦，你在轻轻摸我', { normal: '我听见啦，你轻轻摸的声音' }),
  'petEars:12:0': followup('好呀，摸耳朵后记得哄哄我', { cranky: '哄好了就不跟耳朵计较', clingy: '哄哄我嘛，我就贴紧一点' }),

  // petNose
  'petNose:6:0': followup('认出你啦，我的鼻子没认错', { clingy: '认出你啦，鼻子想贴贴', shy: '嗯……你的气味我记得', normal: '当然认得，见到你真好' }),
  'petNose:12:0': followup('碰碰鼻尖，我就找到你啦', { peppy: '碰碰鼻尖，今天也找到你啦', clingy: '那就碰一下，别走太远嘛' }),

  // petBelly
  'petBelly:6:0': followup('轻一点哦，我肚子还在消化', { cranky: '轻点就好，我肚子还在消化呢' }),
  'petBelly:12:0': followup('好呀，肚肚和脑袋都摸摸', { clingy: '都摸摸吧，我想多赖你一会', peppy: '好呀，脑袋肚肚都照顾到！', shy: '都摸摸……我会乖乖等你' }),

  // petBack
  'petBack:6:0': followup('好，摸掉一点辛苦，慢慢放松', { sisterly: '谢谢你摸摸，背上松快一些啦', normal: '摸得好舒服，背上的累轻一点啦' }),
  'petBack:12:0': followup('好，再顺一下我就舒服啦', { normal: '再一下就好，我舒服多啦', lazy: '再顺一下，我就打盹啦' }),

  // petTail
  'petTail:6:0': followup('知道啦，我的喜欢也不小', { cranky: '哼，尾巴小也装得下喜欢啦', clingy: '知道就多陪我一小会嘛', shy: '你知道就好……尾巴很开心' }),
  'petTail:12:0': followup('好呀，我还想陪你一会儿', { clingy: '尾巴替我说了，我也想陪你' }),

  // petFeet
  'petFeet:2:0': followup('握手成功，我们是好搭子啦', { peppy: '握手成功，小蹄子盖章啦', curious: '握到你的手啦，我的蹄子很开心' }),
  'petFeet:6:0': followup('好，我站稳了，你轻轻碰吧', { earnest: '谢谢你轻轻碰，我站稳啦' }),
  'petFeet:12:0': followup('好，脚脚休息，换脑袋享受', { peppy: '摸摸头来啦，脚脚换班休息！', lazy: '好，脚脚休息，我继续享受', cranky: '知道啦，脑袋可没喊累', sisterly: '好，照顾好脚脚再摸摸头', snooty: '当然，脑袋值得这份优待', normal: '好，换个地方轻轻摸吧', clingy: '摸摸头嘛，我还想挨着你', shy: '好……摸头我也很喜欢', curious: '头顶是不是也这么痒呀', mischievous: '好，我把脚脚调去午休', goofy: '收到，脑袋报名加班啦', earnest: '好，脚脚休息，头顶接班' }),

  // petTooMuch
  'petTooMuch:8:0': followup('好，先歇一下，我还喜欢你', { cranky: '歇一下就好，我还喜欢你', normal: '谢谢你停下，我们缓缓再来' }),
  'petTooMuch:14:0': followup('好，先歇歇，再宠我一点点', { cranky: '再宠要排队，先让我喘口气', clingy: '再宠一小下嘛，然后我歇歇' }),
})
