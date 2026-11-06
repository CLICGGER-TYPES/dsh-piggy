// @ts-check
/** 边界编辑器的撤销/重做栈。 */
;(function () {
  function create(options) {
    var past = []
    var future = []

    function clone(value) { return JSON.parse(JSON.stringify(value)) }
    function notify() {
      if (options.onChange) options.onChange(past.length > 0, future.length > 0)
    }
    function push() {
      past.push(clone(options.getArea()))
      if (past.length > 40) past.shift()
      future = []
      notify()
    }
    function undo() {
      if (past.length === 0) return false
      future.push(clone(options.getArea()))
      options.restore(past.pop())
      options.commit()
      options.render()
      notify()
      return true
    }
    function redo() {
      if (future.length === 0) return false
      past.push(clone(options.getArea()))
      options.restore(future.pop())
      options.commit()
      options.render()
      notify()
      return true
    }
    function reset() {
      past = []
      future = []
      notify()
    }

    return { push: push, redo: redo, reset: reset, undo: undo }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorHistory = { create: create }
})()
