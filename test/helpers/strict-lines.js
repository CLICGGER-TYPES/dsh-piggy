// @ts-check
/**
 * 全部测试启动前加载（package.json 的 test 脚本 --import）：代码里让猪说一个台词表里没有的场景，
 * 测试直接失败。正式运行时只是不说话，写错场景名以前会悄无声息地少一句台词。
 */
import { setUnknownSceneHandler } from '../../packages/pet-core/src/core/lines.js'

setUnknownSceneHandler(scene => { throw new Error('unknown line scene: "' + scene + '" (add it to packages/pet-core/src/data/lines*.js)') })
