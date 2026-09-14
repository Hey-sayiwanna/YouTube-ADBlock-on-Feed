# YouTube（music）去广告自制更新版

这是一个面向 **Surge / iOS / iPadOS** 的 YouTube & YouTube Music 去广告模块。

当前版本把两部分整合到同一个模块中：

- 自制 **YouTube 首页 Sponsored / Feed 广告过滤 v9**：专门处理 `/youtubei/v1/browse` 中官方 Enhance 仍会漏掉的首页赞助广告、广告空壳和相邻分隔节点；
- **Maasea - YouTube (Music) Enhance** 固定历史快照：负责播放器广告、`get_watch`、`next`、搜索、Shorts、设置等原有 Enhance 去广告能力。

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

```text
https://raw.githubusercontent.com/Hey-sayiwanna/YouTube-ADBlock-on-Feed/main/YouTube%EF%BC%88music%EF%BC%89%E5%8E%BB%E5%B9%BF%E5%91%8A%E8%87%AA%E5%88%B6%E6%9B%B4%E6%96%B0%E7%89%88.sgmodule
```

以后 Surge 中只需要更新这一份去广告模块，不再单独启用原版 `Youtube (Music) Enhance` 和旧的 `YouTube 首页去广告` 模块。

## 功能分工

为了避免 Surge 同一条 HTTP response 被多个脚本同时匹配，本项目不是把两个模块简单叠在一起，而是做了明确分工：

```text
/youtubei/v1/browse
→ YouTube.HomeFeedAdBlock.v9
→ 只负责首页 Sponsored / Feed 广告

/player / get_watch / next / search / reel / guide / settings / config / log_event
→ Maasea Enhance 固定快照
→ 负责播放器广告、Shorts 广告、推荐/搜索广告及 Enhance 原有非字幕增强

googlevideo initplayback / log_event request
→ Maasea Enhance 固定 request 脚本
```

因此 `/browse` 不再交给 Enhance 的 response 脚本处理，避免首页广告脚本和 Enhance 同时修改同一个 `/browse` 响应。

## 与双语字幕模块共存

**双语字幕仓库不做任何修改。** 你的 `YouTube-Bilingual-Subtitles-Surge` 继续独立使用。

为了避免之前出现过的 response 脚本互相抢处理权问题，本模块从 `2026.09.15.2` 开始进一步隔离字幕逻辑：

- 本模块已经移除可配置的“字幕翻译语言”选项；
- Enhance 内部 `captionLang` 被**强制固定为 `off`**；
- 首页广告 `/browse` 只走 `YouTube.HomeFeedAdBlock.js`；
- 双语字幕继续使用它自己的字幕 request / timedtext 等链路；
- 不把首页赞助广告处理、Enhance 去广告和双语字幕翻译硬塞进同一个 JS。

仍需注意：双语字幕模块与 Enhance 在某些 `/player`、`get_watch` response 上可能存在匹配重叠，而 Surge 对同一个 response 只会执行第一个命中的脚本。因此请保持你之前已经验证可用的模块生效顺序，不要随意调整。

如果后续字幕异常，优先检查 Surge 最近请求中 `/player` 和 `/get_watch` 的 `Modified by script`，确认实际由哪个 response 脚本处理。

## 安装

1. 删除或关闭 Surge 中原来的 `Youtube (Music) Enhance`。
2. 删除或关闭旧的 `YouTube 首页去广告` 模块。
3. **保留你的双语字幕模块，不需要修改。**
4. 使用上面的订阅地址安装 **YouTube（music）去广告自制更新版**。
5. 保持你之前已经验证可用的模块生效顺序。
6. 完全退出 YouTube / YouTube Music 后重新打开测试。

建议开启 Surge 的 QUIC 屏蔽；本模块也会对 `youtubei.googleapis.com` 和 `*.googlevideo.com` 的 UDP/QUIC 做拦截，以保证 MITM 与脚本链路稳定生效。

## 更新记录

### 2026-09-15

- **2026.09.15.2**：进一步隔离双语字幕逻辑，移除 Enhance 字幕翻译配置项，并将 `captionLang` 强制设为 `off`，避免与独立双语字幕模块发生功能重叠。
- 将自制首页 Feed 去广告与 Maasea `Youtube (Music) Enhance` 合并为单一 Surge 去广告模块。
- Enhance 固定为 2026-09-03 之前使用的提交 `65075cdb388fc5e3094afd7e7314c67b243f3525`，不跟随上游 master 自动变化。
- 上游 `sgmodule`、`youtube.response.js`、`youtube.request.js` 与 Apache-2.0 License 已完整迁入本仓库。
- `/browse` 由自制 v9 独占，Enhance response 显式排除 `/browse`，避免两个 response 脚本互相抢响应。
- 模块文件更名为 `YouTube（music）去广告自制更新版.sgmodule`。

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
- 本仓库首页 Feed 广告补丁基于实际 iOS YouTube HAR / protobuf 抓包持续修正。
