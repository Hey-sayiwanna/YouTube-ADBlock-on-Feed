# YouTube（music）去广告自制更新版

这是一个面向 **Surge / iOS / iPadOS** 的 YouTube & YouTube Music 去广告模块。

当前版本把两部分整合到同一个模块中：

- 自制 **YouTube Browse / Sponsored 广告过滤 v10**：保留原来的首页 Sponsored / Feed v9 能力，同时补回迁移前 Enhance 对非首页 `/browse` 广告 item 的广泛识别，并新增 `/youtubei/v1/player/ad_break` 视频下方“赞助”伴随广告过滤；
- **Maasea - YouTube (Music) Enhance** 固定历史快照：负责 `/player`、`get_watch`、`next`、搜索、Shorts、设置等原有 Enhance 去广告与非字幕增强能力。

> 本项目不会跟随 Maasea `master` 自动更新。Enhance 部分固定在 **2026-09-03 之前的最后版本**，避免后续结构变化引起功能混乱。

## 固定的上游版本

经检查，2026-09-03 之前采用的 Maasea Enhance 基线为：

```text
Commit: 65075cdb388fc5e3094afd7e7314c67b243f3525
Date:   2026-07-19
Message: #100 fix ad judgment
```

对应源码已经完整复制到本仓库：

```text
Upstream/Maasea/YouTube.Enhance.sgmodule
Upstream/Maasea/Script/Youtube/youtube.response.js
Upstream/Maasea/Script/Youtube/youtube.request.js
Upstream/Maasea/UPSTREAM_COMMIT.txt
Upstream/Maasea/LICENSE
```

上游部分遵循原项目 Apache-2.0 License。

## 模块订阅地址

推荐新用户使用：

```text
https://raw.githubusercontent.com/Hey-sayiwanna/YouTube-ADBlock-on-Feed/main/YouTube%EF%BC%88music%EF%BC%89%E5%8E%BB%E5%B9%BF%E5%91%8A%E8%87%AA%E5%88%B6%E6%9B%B4%E6%96%B0%E7%89%88.sgmodule
```

旧用户原订阅地址继续保留，并与新版保持同步：

```text
https://raw.githubusercontent.com/Hey-sayiwanna/YouTube-ADBlock-on-Feed/main/YouTube.HomeFeedAdBlock.sgmodule
```

因此以前已经使用旧链接订阅的人无需重新安装，只要在 Surge 中“立即更新”即可收到新版。

## 功能分工

为了避免 Surge 同一条 HTTP response 被多个脚本同时匹配，本项目不是把两个模块简单叠在一起，而是按接口拆分：

```text
/youtubei/v1/browse
→ YouTube.BrowseAndAdBreak.v10
→ 首页 Sponsored / Feed v9 规则
→ 非首页 browse 广告 item 广泛识别

/youtubei/v1/player/ad_break
→ YouTube.BrowseAndAdBreak.v10
→ 清空独立广告 protobuf
→ 处理视频播放页下方“赞助”伴随广告

/player / get_watch / next / search / reel / guide / settings / config / log_event
→ Maasea Enhance 固定快照
→ 播放器广告、Shorts 广告、推荐/搜索广告及 Enhance 原有非字幕增强

googlevideo initplayback / log_event request
→ Maasea Enhance 固定 request 脚本
```

### 为什么 v10 不再只处理“首页 browse”

迁移初版为了避免自制首页脚本与 Enhance 同时命中 `/browse`，曾把 Enhance 的 `browse` 从 response 规则里完全移除。但 YouTube 的 `/browse` 并不只用于首页，播放页、推荐区和其他内容也会复用该接口，因此这样会丢失原 Enhance 对非首页 browse 广告的过滤能力。

v10 的处理方式是：**仍然只保留一个 `/browse` response 脚本，但把首页 v9 规则和原 Enhance 风格的通用 browse 广告识别合并到这个脚本内部。** 这样既不会出现两个 JS 抢同一个 response，也不会删掉原版 Enhance 的 browse 去广告覆盖范围。

## 与双语字幕模块共存

**双语字幕仓库不做任何修改。** 你的 `YouTube-Bilingual-Subtitles-Surge` 继续独立使用。

为了避免之前出现过的 response 脚本互相抢处理权问题，本模块继续隔离字幕逻辑：

- 本模块不提供“字幕翻译语言”选项；
- Enhance 内部 `captionLang` 被**强制固定为 `off`**；
- `/browse` 与 `/player/ad_break` 只做广告处理，不碰 timedtext / caption；
- 双语字幕继续使用它自己的字幕 request / timedtext 等链路；
- 不修改双语字幕仓库。

仍需注意：双语字幕模块与 Enhance 在某些 `/player`、`get_watch` response 上可能存在匹配重叠，而 Surge 对同一个 response 只会执行第一个命中的脚本。因此请保持你之前已经验证可用的模块生效顺序，不要随意调整。

如果后续字幕异常，优先检查 Surge 最近请求中 `/player` 和 `/get_watch` 的 `Modified by script`，确认实际由哪个 response 脚本处理。

## 安装

1. 删除或关闭 Surge 中原来的官方 `Youtube (Music) Enhance`。
2. 只保留本仓库这一份去广告模块；旧订阅链接和新订阅链接二选一即可，不要同时安装两份。
3. **保留你的双语字幕模块，不需要修改。**
4. 保持你之前已经验证可用的模块生效顺序。
5. 完全退出 YouTube / YouTube Music 后重新打开测试。

建议开启 Surge 的 QUIC 屏蔽；本模块也会对 `youtubei.googleapis.com` 和 `*.googlevideo.com` 的 UDP/QUIC 做拦截，以保证 MITM 与脚本链路稳定生效。

## 更新记录

### 2026-09-15

- **2026.09.15.3 / v10**：恢复迁移前非首页 `/browse` 广告过滤覆盖范围。自制脚本不再只盯 Home Feed 容器，而会在有效 protobuf 层级中识别明确 Sponsored / pagead / ad UI 特征的 `field #1 / #32` 广告 item。
- **新增 `/youtubei/v1/player/ad_break` 处理**：针对实际抓到的 `Last Asylum: Plague` 等视频下方“赞助”伴随广告，直接返回空 protobuf message，阻止广告卡片内容下发。
- 保持 `/browse` 只有一个 response JS，避免 Home Feed 脚本与 Enhance 同时匹配同一响应。
- **2026.09.15.2**：进一步隔离双语字幕逻辑，移除 Enhance 字幕翻译配置项，并将 `captionLang` 强制设为 `off`。
- 将自制首页 Feed 去广告与 Maasea `Youtube (Music) Enhance` 合并为单一 Surge 去广告模块。
- Enhance 固定为 2026-09-03 之前使用的提交 `65075cdb388fc5e3094afd7e7314c67b243f3525`，不跟随上游 master 自动变化。
- 上游 `sgmodule`、`youtube.response.js`、`youtube.request.js` 与 Apache-2.0 License 已完整迁入本仓库。
- 模块文件更名为 `YouTube（music）去广告自制更新版.sgmodule`，同时保留旧 `YouTube.HomeFeedAdBlock.sgmodule` 作为兼容订阅入口。

### 2026-09-03

- **Home Feed v9**：扩展广告身份识别，兼容 MyRepublic 等使用 `paralleladinteraction`、DoubleClick pagead 新链路的 Sponsored item；含 `aboutthisad` 的 Feed item 可直接判定为广告。

### 2026-09-02

- **v8**：动态定位 Home Feed 容器，兼容 `field #1` 与 `field #32` 广告结构。
- **v7**：切换 WebView 引擎并降低大响应递归重建带来的内存压力。
- **v6**：改为删除完整 Feed item，解决广告清空后残留灰框。
- **v5**：移除 Surge JSC 不支持的 `TextEncoder`。
- **v1-v4**：根据多份真实 HAR 逐步定位 iOS Feed Sponsored protobuf 结构。

## 致谢与上游

- Maasea/sgmodule - YouTube (Music) Enhance
- 本仓库 Browse / Sponsored 广告补丁基于实际 iOS YouTube HAR / protobuf 抓包持续修正。
