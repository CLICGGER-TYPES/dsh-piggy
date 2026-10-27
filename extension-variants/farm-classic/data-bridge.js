// Inserted inside the classic client by the bundle builder. Only adapts the
// view and action names; the canonical farm server owns all saved data.
function classicApp(app) {
  const source = app.data
  if (!source || !Array.isArray(source.plots)) return app
  const fertilizer = (source.fert || []).find(item => item.count > 0)
  const data = {
    ...source,
    prices: source.plots.map(() => source.reclaimPrice),
    fertilizer: fertilizer?.count || 0,
    tools: [
      ...(source.tools || []).map(tool => tool.key === 'sprayer' ? { ...tool, key: 'can', emoji: '💧' } : tool),
      { key: 'fertilizer', label: fertilizer?.label || '肥料', emoji: '🧪', owned: !!fertilizer },
    ],
    plots: source.plots.map(plot => {
      if (!plot || plot.wild) return null
      if (plot.empty && !plot.stubble && !(plot.pests || []).includes('weed')) return null
      return {
        ...plot,
        stage: plot.ripe ? 3 : plot.empty || plot.withered ? 0 : plot.stage === 'seedling' ? 1 : 2,
        helperManaged: plot.helper === true,
        cropEmoji: plot.emoji || '',
        label: plot.label || (plot.stubble ? '枯苗' : '荒地'),
        thirsty: !plot.ripe && (plot.pests || []).length > 0,
        needsClear: plot.withered || plot.stubble,
      }
    }),
  }
  return {
    ...app, data,
    send(op, payload) {
      if (op === 'water') op = 'care'
      if (op === 'waterAll') op = 'careAll'
      if (op === 'fertilize') {
        if (!fertilizer) return
        payload = { ...payload, item: fertilizer.key }
      }
      return app.send(op, payload)
    },
  }
}
