# 扩展商店货架标准

所有下载扩展的商店都走同一条 `extShelves` 通道；主面板负责渲染，扩展只声明数据，不再自己写商品网格。

## 扩展返回

```js
shelf: {
  extension: 'blindbox',
  key: 'blindbox',
  label: '盲盒',
  emoji: '🎁',
  color: 'orange',
  currency: { label: '资质凭证', emoji: '📜', balance: 128 },
  items: [
    { key: 'ticket', emoji: '🎟', label: '盲盒券', note: '免费寻访 1 次', price: 20, disabled: false, pick: null },
    { key: 'pick5', emoji: '⭐', label: '指定五星', note: '选一件', price: 120, disabled: false,
      pick: [{ key: 'fox', emoji: '🦊', label: '狐狸' }] },
  ],
}
```

## 主面板统一行为

- 商品固定 **3 列 × 每页 9 个**，超过 9 个自动分页，圆点和左右翻页与主商店一致。
- 商品格统一使用 `dp-tile`，显示 emoji、名称、价格 + 扩展货币；`disabled` 变灰不可点。
- 悬停 1.2 秒显示统一悬浮卡：名称、扩展名、价格、说明、余额 / 买后剩余。
- `pick` 不为空时，点击商品先展开选择区；选定后才发 `ext buy`。
- 购买仍由扩展的 `buy` 动作结算；主面板只负责展示和发请求。

## 不是货架的东西

菜地棋盘、矿场 6 列棋盘、盲盒十连结果、扭蛋十连结果不是商店货架，不走这个标准。新增扩展只要按上面的 `shelf` 返回商品，就会自动获得九宫格和悬浮卡。
