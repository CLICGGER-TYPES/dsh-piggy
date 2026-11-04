// @ts-check
/**
 * 第三方素材包的稳定入口：常量、schema、安装前校验和已安装摘要。
 *
 * 具体实现按职责拆在：
 * - ext-asset-schema.js：路径/schema 基础校验
 * - ext-asset-validate.js：安装前完整校验
 * - ext-asset-summary.js：已安装目录的只读摘要
 * @module dsh-piggy/store/ext-asset-packs
 */
export {
  MAX_PACK_FILES, MAX_PACK_BYTES, MAX_EXTENSION_PACK_FILES, MAX_EXTENSION_PACK_BYTES,
  MAX_ACTIONS_PER_PACK, MAX_SOUNDS_PER_PACK, MAX_PACK_JSON_BYTES, MIN_FRAMES, MAX_FRAMES,
  MAX_FRAME_BYTES, MAX_FRAME_EDGE, MAX_ACTION_MS, MAX_FRAME_MS, MAX_SOUND_BYTES, MAX_SOUND_MS,
  PACK_ID, ASSET_KEY, isAssetPackPath, imageSize, declaredAssetPacks,
} from './ext-asset-schema.js'
export { validateAssetPackFiles } from './ext-asset-validate.js'
export { assetPackSummaryFromDisk } from './ext-asset-summary.js'
