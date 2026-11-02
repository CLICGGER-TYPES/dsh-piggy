// Checked images are structural repair requests. Save directly to the shared local service.
;(async () => {
  if (location.protocol === 'file:') {
    const page = location.pathname.split('/').pop()
    location.replace('http://127.0.0.1:9388/' + (['comparison.html', 'designs.html'].includes(page) ? page : 'index.html'))
    return
  }
  const cards = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll('[data-review-id]')))
  const sceneControl = /** @type {HTMLSelectElement | null} */ (document.querySelector('#scene'))
  const pending = new Map(), timers = new Map(), controls = new Map()
  let state = { issues: [] }, onlyIssues = false, queue = Promise.resolve(), ready = false, readFailed = false
  const keyOf = item => `${item.id}@${item.sha256}`
  const panel = document.createElement('div')
  panel.className = 'review-feedback-panel'
  panel.innerHTML = '<strong data-review-count>正在读取问题清单…</strong><span>勾选表示结构有问题，需要返修；备注自动保存。</span><button type="button" data-review-filter aria-pressed="false">只看已勾选</button><span data-review-status role="status" aria-live="polite"></span>'
  document.querySelector('header').append(panel)
  const count = panel.querySelector('[data-review-count]')
  const hint = panel.querySelector('[data-review-status]')
  const filter = panel.querySelector('[data-review-filter]')
  const issueMap = () => new Map(state.issues.filter(i => i.active !== false).map(i => [keyOf(i), i]))

  function render() {
    const saved = issueMap()
    let localCount = 0
    for (const [key, ui] of controls) {
      const item = pending.has(key) ? pending.get(key) : saved.get(key)
      const checked = Boolean(item?.needs_revision)
      ui.check.checked = checked
      ui.noteLabel.hidden = !checked
      ui.card.classList.toggle('needs-revision', checked)
      if (document.activeElement !== ui.note && !pending.has(key)) ui.note.value = item?.note || ''
      if (checked) localCount++
      const scene = sceneControl?.value || 'all'
      ui.card.hidden = (scene !== 'all' && ui.card.dataset.scene !== scene) || (onlyIssues && !checked)
    }
    const all = new Map(saved)
    for (const [key, value] of pending) value.needs_revision ? all.set(key, value) : all.delete(key)
    count.textContent = `已勾选 ${all.size} 张结构问题，本页 ${localCount} 张`
    filter.setAttribute('aria-pressed', String(onlyIssues))
  }

  function adopt(data) {
    if (!data || !Array.isArray(data.issues)) throw new Error('问题清单响应不完整')
    if (Date.parse(data.updated_at || '') < Date.parse(state.updated_at || '')) return
    state = data
  }

  function save(payload) {
    const key = keyOf(payload)
    pending.set(key, payload)
    render()
    hint.textContent = '正在保存…'
    hint.classList.remove('save-error')
    queue = queue.catch(() => {}).then(async () => {
      try {
        const response = await fetch('/__review/issue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), keepalive: true,
        })
        const data = await response.json()
        const messages = { sha256_mismatch: '图片版本已更新，请刷新页面', unknown_id: '图片已更新，请刷新页面',
          note_too_long: '备注最多2000字', invalid_note: '备注格式不正确', state_unavailable: '问题清单暂时无法读取' }
        if (!response.ok) throw new Error(messages[data.error] || '保存失败')
        adopt(data)
        if (pending.get(key) === payload) pending.delete(key)
        hint.textContent = pending.size ? '正在保存…' : '已自动保存'
        render()
      } catch (error) {
        hint.textContent = `保存未完成：${error.message}，正在重试，请保持页面打开。`
        hint.classList.add('save-error')
        setTimeout(() => { if (pending.get(key) === payload) save(payload) }, 3000)
      }
    })
  }

  for (const card of cards) {
    const info = { id: card.dataset.reviewId, sha256: card.dataset.reviewHash }
    const key = keyOf(info)
    const box = document.createElement('div')
    box.className = 'review-feedback-controls'
    const label = document.createElement('label')
    label.className = 'review-feedback-check'
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.disabled = true
    check.setAttribute('aria-label', `${card.dataset.reviewLabel}：结构有问题，需要修改`)
    label.append(check, document.createTextNode('结构有问题，需要修改'))
    const noteLabel = document.createElement('label')
    noteLabel.className = 'review-feedback-note'
    noteLabel.hidden = true
    noteLabel.append(document.createTextNode('问题描述（可选）'))
    const note = document.createElement('textarea')
    note.rows = 2
    note.maxLength = 2000
    note.placeholder = '例如：鼻孔位置偏左，左前脚多出一截'
    note.setAttribute('aria-label', `${card.dataset.reviewLabel}：问题描述`)
    noteLabel.append(note)
    box.append(label, noteLabel)
    const caption = card.querySelector(':scope > h2')
    caption ? caption.after(box) : card.prepend(box)
    controls.set(key, { card, check, note, noteLabel })
    const payload = () => ({ ...info, needs_revision: check.checked, note: note.value })
    check.addEventListener('change', () => {
      clearTimeout(timers.get(key)); timers.delete(key)
      save(payload())
    })
    note.addEventListener('input', () => {
      const value = payload()
      pending.set(key, value)
      hint.textContent = '正在保存备注…'
      clearTimeout(timers.get(key))
      timers.set(key, setTimeout(() => { timers.delete(key); save(value) }, 600))
    })
    note.addEventListener('blur', () => {
      if (!timers.has(key)) return
      clearTimeout(timers.get(key)); timers.delete(key)
      save(payload())
    })
  }
  sceneControl?.addEventListener('change', render)
  filter.addEventListener('click', () => { onlyIssues = !onlyIssues; render() })
  addEventListener('pagehide', () => {
    for (const value of pending.values()) fetch('/__review/issue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value), keepalive: true,
    }).catch(() => {})
  })
  async function refresh() {
    try {
      const response = await fetch('/__review/state', { cache: 'no-store' })
      if (!response.ok) throw new Error('读取问题清单失败')
      adopt(await response.json())
      if (readFailed) {
        readFailed = false
        hint.classList.remove('save-error')
        hint.textContent = pending.size ? '正在保存…' : '已连接，勾选和备注会自动保存'
      }
      if (!ready) {
        ready = true
        for (const ui of controls.values()) ui.check.disabled = false
        hint.textContent = '勾选和备注会自动保存'
      }
      render()
    } catch (error) {
      readFailed = true
      hint.textContent = `${error.message}，正在重连…`
      hint.classList.add('save-error')
    }
  }
  await refresh()
  setInterval(refresh, 2000)
})()
