// @ts-check
// 插画地址带内容指纹，桌面和 DSH 使用相同缓存规则。
import { FISHING_ART_HASHES } from '../../packages/pet-core/src/data/fishing-art.js'
import { ART_URL } from './constants.js'
/** @param {string} name @returns {string} */
export const fishingArtUrl = name => ART_URL + 'fishing/' + name + '?v=' + FISHING_ART_HASHES[name]
