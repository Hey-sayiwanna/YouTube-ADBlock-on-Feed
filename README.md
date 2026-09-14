# YouTube（music）去广告自制更新版

这是一个面向 Surge / iOS / iPadOS 的 YouTube & YouTube Music 去广告模块。

当前版本把两部分整合到同一个模块中：

- 自制 **YouTube 首页 Sponsored / Feed 广告过滤 v9**，专门处理 `/youtubei/v1/browse` 中官方 Enhance 仍会漏掉的首页赞助广告、广告空壳和分隔节点；
- **Maasea - YouTube (Music) Enhance** 的固定历史快照，用于处理播放器广告、`get_watch`、`next`、搜索、Shorts、设置等原有 Enhance 功能。

> 本项目不是直接跟随 Maasea `master`。为避免后续更新改变 protobuf 结构导致功能混乱，Enhance 部分固定在 **2026-09-03 之前的最后版本**。

## 固定的上游版本

经检查 Maasea/sgmodule 提交历史，2026-09-03 之前最后一条相关提交为：

```text
Commit: 65075cdb388fc5e3094afd7e7314c67b243f3525
Date:   2026-07-19
Message: #100 fix ad judgment
```

2026-07-19 到 2026-09-03 之间没有更晚的提交，因此本仓库将该提交作为固定 Enhance 基线。

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

以后只需要在 Surge 中更新这一份模块，不需要再单独启用原版 `Youtube (Music) Enhance` 和旧的 `YouTube 首页去广告` 模块。

## 功能分工

为了避免同一条 HTTP response 被两个脚本同时匹配造成冲突，本项目没有简单把两个模块原样叠在一起，而是做了明确分工：

```text
/youtubei/v1/browse
→ YouTube.HomeFeedAdBlock.v9
→ 自制首页 Sponsored / Feed 广告过滤

/player / get_watch / next / search / reel / guide / settings / config / log_event
→ Maasea Enhance 固定快照
→ 播放器广告、Shorts 广告、推荐/搜索广告及 Enhance 原有处理

googlevideo initplayback / log_event request
→ Maasea Enhance 固定 request 脚本
```

因此 `/browse` 不再交给 Enhance 的 response 脚本处理，避免与自制首页脚本重复修改同一响应；首页广告过滤由自制 v9 完整接管。

## 与双语字幕模块共存

本模块可以继续和你的 `YouTube-Bilingual-Subtitles-Surge` 一起使用，但请注意：

1. 本模块里的 **“字幕翻译语言”保持 `off`**，不要再启用 Enhance 自带字幕翻译，否则会和双语字幕的翻译逻辑重复。
2. 你原来已经验证可用的模块生效顺序不要乱改；把本模块放在原来 `Youtube (Music) Enhance` 所在的有效优先级位置即可。
3. Surge 对同一个 response 只执行第一个匹配脚本，因此 `/player`、`get_watch` 等重叠接口仍以本模块的 Enhance 去广告处理为准；双语字幕继续使用其 request / timedtext 等字幕链路。
4. 如果以后双语字幕某次更新后出现字幕异常，先检查最近请求里 `/player`、`get_watch` 到底由哪个 response 脚本命中，不要同时调整多个模块。

## 安装

1. 删除或关闭 Surge 中原来的 `Youtube (Music) Enhance`。
2. 删除或关闭旧的 `YouTube 首页去广告` 模块。
3. 保留双语字幕模块。
4. 使用上面的订阅地址安装 **YouTube（music）去广告自制更新版**。
5. 保持 `字幕翻译语言=off`。
6. 完全退出 YouTube / YouTube Music 后重新打开测试。

建议开启 Surge 的 QUIC 屏蔽；模块本身也对 `youtubei.googleapis.com` 与 `*.googlevideo.com` 的 UDP/QUIC 做了拦截，以确保 MITM 与脚本链路能够生效。

## 更新记录

### 2026-09-15

- 将自制首页 Feed 去广告与 Maasea `Youtube (Music) Enhance` 合并为单一 Surge 模块。
- Enhance 固定为 2026-09-03 之前最后提交 `65075cdb388fc5e3094afd7e7314c67b243f3525`，不跟随上游 master 自动变化。
- 上游 `sgmodule`、`youtube.response.js`、`youtube.request.js` 与 Apache-2.0 License 已完整迁入本仓库。
- `/browse` 由自制 v9 独占，Enhance response 显式排除 `/browse`，避免两个 response 脚本互相抢响应。
- 模块文件更名为 `YouTube（music）去广告自制更新版.sgmodule`。
- 为和双语字幕共存，Enhance 内置字幕翻译默认保持关闭。

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
- 本仓库的首页 Feed 广告补丁基于实际 iOS YouTube HAR / protobuf 抓包持续修正。
