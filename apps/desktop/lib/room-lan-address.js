// @ts-check
/** 建房时选局域网地址：优先物理网卡，避开虚拟机/容器网桥。 */
import { networkInterfaces as systemNetworkInterfaces } from 'node:os'

import { enumerateOwnerNetworkAddresses } from './owner-network-addresses.js'

/**
 * @param {ReturnType<typeof systemNetworkInterfaces>} [interfaces]
 * @returns {{ address: string, interface: string }|null}
 */
export function preferredLanAddress(interfaces = systemNetworkInterfaces()) {
  const list = enumerateOwnerNetworkAddresses(interfaces)
  const usable = list.filter(entry => entry.kind === 'private' || entry.kind === 'link-local')
  // 有虚拟机/容器网桥时优先物理网卡，避免房间建在别人连不进来的网段。
  const physical = usable.find(entry => !/^(?:docker|veth|virbr|br-|vmnet|vboxnet|tailscale|zt)/iu.test(entry.interface))
  return physical ?? usable[0] ?? null
}
