# npm 可信发布：需要维护者配合的步骤

核对日期：2026-10-25。官方依据：https://docs.npmjs.com/trusted-publishers/

## 维护者要做什么

等 `.github/workflows/npm-publish.yml` 审阅并合入后，再用维护者账号登录 npm 网页。两个包都要各配置一次：

- https://www.npmjs.com/package/dsh-piggy → Settings → Trusted publishing
- https://www.npmjs.com/package/dsh-plugin-piggy → Settings → Trusted publishing

选择 GitHub Actions，填写：

| 字段 | 值 |
| --- | --- |
| Organization or user | CLICGGER-TYPES |
| Repository | dsh-piggy |
| Workflow filename | npm-publish.yml（只填文件名） |
| Environment | 留空（当前候选工作流未声明 environment） |
| Allowed actions | 允许 npm publish；本候选不调用 npm dist-tag |

保存设置时按 npm 提示自行完成账号验证，不向聊天发送密码、验证码或 token。新绑定必须两天内首次成功发布，所以不要在工作流未合入、版本尚未验收时先配。

## 我负责的部分

- 保留可审的工作流和只读发布计划；Node/npm 版本满足官方要求，GitHub-hosted runner、id-token: write。
- 维护版本/标签/仓库/两包依赖一致性，RC 用 rc 标签，不覆盖 latest。
- 先 inspect 只读检查；取得本次发布授权后才执行 publish，主包先于别名。
- 已发布且内容一致则跳过；内容漂移或 registry 状态不明则停止，不覆盖既有版本。
- 首次真实 OIDC 发布后核对两包版本、内容、dist-tag 和来源证明。只有这一步完成才可称自动认证链路通过。

工作流已放入 `.github/workflows/npm-publish.yml`，采用 GitHub Actions 内 inspect/publish 操作，发布认证由 OIDC 完成；不需要每次执行 npm login 或扫码。工作流默认只检查；npm账号尚需维护者绑定，未由代理执行真实npm发布。项目现行维护者发布规则仍保留，正式切换另行确认。

## 首次成功后

可以在两个包的 Publishing access 中选择 Require two-factor authentication and disallow tokens；这是后续账号设置，不应在首轮未验证时改动。
