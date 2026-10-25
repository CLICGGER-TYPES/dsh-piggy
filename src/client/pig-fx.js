// @ts-check
/**
 * 猪窗口才能演的反应。面板窗口、扩展大窗口里的调用都按这份名单转给猪那一侧。
 *
 * 单独一个文件是为了让网页版舞台适配器（stage-shell.js）和 split 共用同一份名单，
 * 不把整个 split 的窗口逻辑拖进纯 Node 测试。
 * @module dsh-piggy/client/pig-fx
 */

export var PIG_FX = ['flash', 'react', 'burst', 'showBubble', 'transform', 'previewArt', 'idleNow', 'walkNow', 'birthdayNow', 'petShy', 'cancelNap']
