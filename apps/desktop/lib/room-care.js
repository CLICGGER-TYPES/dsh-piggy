// @ts-check
/** 联机照顾：客人发意图，目标回结果；只广播最近 32 条，客户端按 nonce 去重。 */
import { normalizeCareIntent, normalizeCareStats } from './room-protocol.js'

/**
 * @param {{
 *   players: Map<string, any>,
 *   careEvents: any[],
 *   careResults: any[],
 *   now: () => number,
 *   bump: () => void,
 *   send: (response:any,status:number,body:any)=>void,
 *   fail: (status:number,reason:string)=>any,
 *   readJson: (request:any)=>Promise<any>,
 *   exactKeys: (value:any,keys:string[])=>boolean,
 *   randomUUID: () => string,
 *   findPlayer: (request:any)=>{player:any},
 *   version: ()=>number,
 * }} deps
 */
export function createRoomCare(deps) {
  function care(request, response) {
    const { player } = deps.findPlayer(request)
    return deps.readJson(request).then(input => {
      if (!deps.exactKeys(input, ['targetId', 'itemKey', 'op', 'nonce'])) throw deps.fail(400, 'care-shape-invalid')
      const intent = normalizeCareIntent(input)
      const target = [...deps.players.values()].find(candidate => candidate.id === intent.targetId)
      if (target === undefined) throw deps.fail(404, 'care-target-missing')
      const event = {
        id: deps.randomUUID(), from: player.id, targetId: intent.targetId,
        itemKey: intent.itemKey, op: intent.op, nonce: intent.nonce, at: deps.now(),
      }
      deps.careEvents.push(event)
      if (deps.careEvents.length > 32) deps.careEvents.shift()
      deps.bump()
      return deps.send(response, 200, { ok: true, eventId: event.id, version: deps.version() })
    })
  }

  function careResult(request, response) {
    const { player } = deps.findPlayer(request)
    return deps.readJson(request).then(input => {
      if (!deps.exactKeys(input, ['targetId', 'nonce', 'ok', 'reason', 'care'])) throw deps.fail(400, 'care-result-shape-invalid')
      if (input.targetId !== player.id) throw deps.fail(403, 'care-result-target-invalid')
      if (typeof input.nonce !== 'string' || input.nonce === '') throw deps.fail(400, 'care-result-nonce-invalid')
      const care = input.ok === true ? normalizeCareStats(input.care) : null
      if (input.ok === true && care === null) throw deps.fail(400, 'care-result-care-invalid')
      if (care !== null) player.care = care
      const result = {
        from: player.id, targetId: player.id, nonce: input.nonce,
        ok: input.ok === true, reason: typeof input.reason === 'string' ? input.reason.slice(0, 80) : '', care, at: deps.now(),
      }
      deps.careResults.push(result)
      if (deps.careResults.length > 32) deps.careResults.shift()
      deps.bump()
      return deps.send(response, 200, { ok: true, version: deps.version() })
    })
  }

  return Object.freeze({ care, careResult })
}
