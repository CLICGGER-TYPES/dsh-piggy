// Gitee 渠道的打包配置：在 package.json 的 build 上覆盖几项（GitHub 包不用这个文件，照旧）。
// Gitee 发行版附件单个 ≤100MB：最大压缩、只留中英文语言包（另有 tools/slim-emoji-font.py 瘦 emoji 字体）。
// 外壳更新清单：Gitee 没有「最新版」固定地址，运行时 lib/shell-update.js 会按 tag 改 feed，这里只给个占位。
const { rmSync } = require('node:fs')
const { join } = require('node:path')
const base = require('./package.json').build
module.exports = {
  ...base,
  compression: 'maximum',
  electronLanguages: ['zh-CN', 'en-US'],
  // Windows 包去掉 DirectX 着色器编译器（dxcompiler.dll 25.7MB、dxil.dll 1.5MB）：只有 WebGPU 用它，
  // 猪不用 WebGPU。v0.33.0 的 Gitee Windows 安装包 105.3MB，超了 Gitee 单附件 100MiB 一点点，被 CI 跳过没传上去。
  // d3dcompiler_47.dll（ANGLE 画 WebGL/D3D 要用）和 SwiftShader（没显卡的机器靠它画）保留。
  afterPack: context => {
    if (context.electronPlatformName !== 'win32') return
    for (const name of ['dxcompiler.dll', 'dxil.dll']) rmSync(join(context.appOutDir, name), { force: true })
  },
  publish: [{ provider: 'generic', url: 'https://gitee.com/clicgger/dsh-piggy/releases/download/latest' }],
}
