// @ts-check
/** 联机房间的静态物品层：每件物品有自己的图、底边深度和 z-index。 */
;(function () {
  var ITEMS = {
    pen: [
      { id: 'pen-house', src: '/dsh-piggy/art/pen-house.webp', depth: 0.54 },
      { id: 'pen-tree', src: '/dsh-piggy/art/room-pen-tree.webp', depth: 0.61 },
      { id: 'pen-pond', src: '/dsh-piggy/art/pen-pond.webp', depth: 0.40 },
      { id: 'pen-bush-left', src: '/dsh-piggy/art/pen-bush-left.webp', depth: 0.33 },
      { id: 'pen-bush-bottomleft', src: '/dsh-piggy/art/pen-bush-bottomleft.webp', depth: 0.095 },
      { id: 'pen-bush-bottomright', src: '/dsh-piggy/art/pen-bush-bottomright.webp', depth: 0.153 },
      { id: 'pen-fence-front', src: '/dsh-piggy/art/pen-fence-front.webp', depth: 0 },
    ],
    room: [
      { id: 'room-bookshelf', src: '/dsh-piggy/art/room-room-bookshelf.webp', depth: 0.34 },
      { id: 'room-desk', src: '/dsh-piggy/art/room-room-desk.webp', depth: 0.43 },
      { id: 'room-sofa', src: '/dsh-piggy/art/room-room-sofa.webp', depth: 0.25 },
    ],
  }

  function mount(container) {
    if (!container) return
    Object.keys(ITEMS).forEach(function (scene) {
      ITEMS[scene].forEach(function (item) {
        var img = document.createElement('img')
        img.className = 'scene-layer'
        img.id = 'layer-' + item.id
        img.setAttribute('data-layer-scene', scene)
        img.src = item.src
        img.alt = ''
        img.draggable = false
        img.style.zIndex = String(100 - Math.round(item.depth * 100))
        container.appendChild(img)
      })
    })
  }

  ;/** @type {any} */ (window).PiggyRoomSceneItems = { mount: mount }
})()
