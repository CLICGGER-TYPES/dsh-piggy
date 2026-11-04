// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  enumerateOwnerNetworkAddresses,
  isOwnerNetworkListenAddress,
  ownerNetworkAddressKind,
} from '../lib/owner-network-addresses.js'

test('地址分类只认具体 IPv4，公网与主机名不在候选里', () => {
  assert.equal(ownerNetworkAddressKind('127.0.0.1'), 'loopback')
  assert.equal(ownerNetworkAddressKind('10.1.2.3'), 'private')
  assert.equal(ownerNetworkAddressKind('172.16.0.1'), 'private')
  assert.equal(ownerNetworkAddressKind('172.31.255.254'), 'private')
  assert.equal(ownerNetworkAddressKind('192.168.1.20'), 'private')
  assert.equal(ownerNetworkAddressKind('169.254.3.4'), 'link-local')
  assert.equal(ownerNetworkAddressKind('172.32.0.1'), 'public')
  assert.equal(ownerNetworkAddressKind('192.0.2.8'), 'public')
  assert.equal(ownerNetworkAddressKind('8.8.8.8'), 'public')
  assert.equal(ownerNetworkAddressKind('0.0.0.0'), 'public')
  assert.equal(ownerNetworkAddressKind('localhost'), null)
  assert.equal(ownerNetworkAddressKind('192.168.1.0/24'), null)
  assert.equal(ownerNetworkAddressKind('::1'), null)

  assert.equal(isOwnerNetworkListenAddress('192.168.1.20'), true)
  assert.equal(isOwnerNetworkListenAddress('127.0.0.1'), true)
  assert.equal(isOwnerNetworkListenAddress('169.254.3.4'), true)
  assert.equal(isOwnerNetworkListenAddress('0.0.0.0'), false)
  assert.equal(isOwnerNetworkListenAddress('192.0.2.8'), false)
  assert.equal(isOwnerNetworkListenAddress('example.local'), false)
})

test('网卡枚举保留顺序、去重，并跳过 IPv6 与公网地址', () => {
  const list = enumerateOwnerNetworkAddresses({
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    'Wi-Fi': [
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '192.168.1.20', family: 'IPv4', internal: false },
      { address: '192.168.1.20', family: 'IPv4', internal: false },
      { address: '203.0.113.9', family: 'IPv4', internal: false },
    ],
    eth0: [
      { address: '10.0.0.5', family: 4, internal: false },
      { address: '169.254.7.7', family: 'IPv4', internal: false },
    ],
    broken: null,
  })
  assert.deepEqual(list, [
    { address: '127.0.0.1', interface: 'lo', kind: 'loopback' },
    { address: '192.168.1.20', interface: 'Wi-Fi', kind: 'private' },
    { address: '10.0.0.5', interface: 'eth0', kind: 'private' },
    { address: '169.254.7.7', interface: 'eth0', kind: 'link-local' },
  ])
  assert.deepEqual(enumerateOwnerNetworkAddresses(null), [])
  assert.deepEqual(enumerateOwnerNetworkAddresses({}), [])
})
