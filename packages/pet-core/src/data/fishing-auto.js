// @ts-check
/** K1 自动钓鱼数值，见 J2；六小时仓不加格数；抄网提高新长时行程的收鱼效率。 */
export const AUTO_FISH_INTERVAL = 270000
export const AUTO_FISH_WINDOW = 6 * 3600000
export const AUTO_FISH_SUCCESS_FACTOR = 0.7
export const AUTO_FISH_GEAR = {
  basket: [
    { label: '普通抄网', price: 0, value: 0.8 },
    { label: '顺手抄网', price: 1500, value: 0.9 },
    { label: '轻巧抄网', price: 4000, value: 1 },
  ],
  duration: [
    { label: '短时自动钓', price: 0, value: 60 },
    { label: '两小时自动钓', price: 2000, value: 120 },
    { label: '四小时自动钓', price: 5000, value: 240 },
  ],
  baitBox: [
    { label: '没有鱼饵盒', price: 0, value: 0 },
    { label: '小鱼饵盒', price: 1500, value: 16 },
    { label: '大鱼饵盒', price: 4000, value: 64 },
  ],
}
