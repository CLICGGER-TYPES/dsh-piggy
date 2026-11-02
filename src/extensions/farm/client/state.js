// @ts-check
/** 单次 farm client 的临时交互状态；服务端快照仍是所有游戏数据的唯一来源。 */
/** @returns {any} */
export function createFarmState() {
  const AUTO = { kind: 'auto', key: null }
  const CARE_TOOLS = [
    { key: 'can', art: 'tool-can', emoji: '💧', label: '浇水：点干了的地', hand: { kind: 'care', key: 'dry' }, hint: '点干了的地浇水' },
    { key: 'weedkiller', art: 'tool-weedkiller', emoji: '🌿', label: '除草：点长草的地', hand: { kind: 'care', key: 'weed' }, hint: '点长草的地除草' },
    { key: 'pesticide', art: 'tool-pesticide', emoji: '🐛', label: '杀虫：点生虫的地', hand: { kind: 'care', key: 'bug' }, hint: '点生虫的地杀虫' },
    { key: 'gloves', art: 'tool-gloves', emoji: '🧤', label: '手套：只收成熟作物', hand: AUTO },
  ]
  const ONE_CLICK = [
    { key: 'sickle', op: 'harvestAll', label: '一键收获', tool: '收割镰' },
    { key: 'sprayer', op: 'careAll', label: '一键照料', tool: '喷雾桶' },
    { key: 'rake', op: 'clearAll', label: '一键铲除', tool: '平地耙' },
    { key: 'planter', op: 'plantAll', label: '一键播种', tool: '播种器' },
  ]
  return {
    hand: { kind: 'auto', key: null },
    popup: null, revealTools: false, drawerOpen: false, openCrop: null, selectedPlot: null,
    confirmClear: null, tip: null, tipAt: 0, tipPlot: null, shopTab: 'seed', bagTab: 'seed',
    purchase: null, quantity: 1, currentApp: null, keyboardBound: false, pendingAction: null,
    cancelLayer: null, inflight: null, lessonRewardAt: 0, fx: null, modalOpen: false,
    modalFocus: null, modalReturn: null, SMALL_PLOTS: 6, scrollMemory: {}, currentKey: '',
    watchingContent: false, lastRoot: null, PEST_LABEL: { dry: '干了', weed: '长草', bug: '生虫' },
    ONE_CLICK, AUTO, CARE_TOOLS,
  }
}
