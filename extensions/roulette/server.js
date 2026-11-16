// @ts-check
/**
 * 左轮轮盘 0.1.0：本地面板玩法。
 *
 * 对局、下注和 AI 金库都在 client.js 的内存里跑，不写主存档、不碰真实金币，
 * 也没有房间协议。宿主仍要求下载扩展带 server.js，所以这里只提供空动作和
 * 一个只读视图标记；不声明 init，安装时数据是空对象。
 */
export default {
  actions: {},
  view() {
    return { localDemo: true }
  },
}
