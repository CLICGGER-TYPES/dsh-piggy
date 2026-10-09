// @ts-check
/**
 * 样式入口：基础样式 + 页签样式拼成一张表。
 *
 * @module dsh-piggy/client/styles
 */
import { CSS_ACHIEVEMENTS } from './css-achievements.js'
import { CSS_BASE } from './css-base.js'
import { CSS_TABS } from './css-tabs.js'
import { CSS_TILES } from './css-tiles.js'
import { CSS_CARD } from './css-card.js'
import { CSS_DEX } from './css-dex.js'
import { CSS_FISHING } from './css-fishing.js'
import { CSS_SKINS } from './css-skins.js'
import { CSS_HOLO } from './css-holo.js'
import { CSS_WALLET } from './wallet.js'

/** The whole stylesheet, in the order it must be applied. */
export const CSS = CSS_BASE + CSS_TABS + CSS_TILES + CSS_CARD + CSS_DEX + CSS_FISHING + CSS_SKINS + CSS_HOLO + CSS_ACHIEVEMENTS + CSS_WALLET
