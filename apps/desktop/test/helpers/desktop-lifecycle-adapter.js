// @ts-check
/** VM 片段测试只消费主进程关闭状态；此 adapter 始终回读 sandbox 的真实测试状态。 */
export function desktopLifecycleStateAdapter(sandbox) {
  return Object.freeze({ get quitting() { return sandbox.quitting === true } })
}
