# YouTube（music）去广告自制更新版

这是一个面向 **Surge / iOS / iPadOS** 的 YouTube & YouTube Music 去广告模块。

当前版本的原则是：**原版 Enhance 的功能不删，只解决 `/browse` 合并时的冲突问题，并保留我们自己抓包修出来的首页 Sponsored 补丁。**

本项目不是用自制规则替代 Maasea，而是以固定历史版 Maasea `YouTube (Music) Enhance` 为基础，在同一个 response 脚本里把 Home Feed v9 和原版 Browse 串起来执行，避免 Surge 多个 response 脚本争抢同一个响应。

## 固定的上游版本

为避免上游后续更新改变 protobuf 结构导致功能混乱，本仓库固定使用 **2026-09-03 之前的版本**：

```text
Commit: 65075cdb388fc5e3094afd7e7314c67b243f3525
Date:   2026-07-19
Message: #100 fix ad judgment
```

对应上游代码已完整保存到本仓库：

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

旧用户原来的订阅地址继续保留，并与新版内容同步：

```text
https://raw.githubusercontent.com/Hey-sayiwanna/YouTube-ADBlock-on-Feed/main/YouTube.HomeFeedAdBlock.sgmodule
```

因此以前已经安装旧链接的人仍然可以正常收到后续更新。

## 当前执行结构

### 1. `/browse`：Home Feed v9 先过滤，再交给原版 Enhance

`2026.09.15.4` 曾采用“原版 Enhance Browse 先处理，再把重新序列化后的 protobuf 交给 Home Feed v9”的后置结构。实际测试发现 Surge 虽然显示 `YouTube.Enhance.response.merged` 已修改响应，但抓到的首页 HAR 中仍保留完整 Sponsored item，说明该后置合并路径没有可靠地把 Home Feed v9 的结果带到最终响应。

`2026.09.15.5` 改为更直接的单脚本顺序：

```text
/youtubei/v1/browse 原始 protobuf
        ↓
Home Feed v9 在原始二进制中先删除已验证的 Sponsored / Feed item
        ↓
固定版 Maasea Enhance 使用自己的原版 Browse protobuf 解析器继续处理
        ↓
一次性序列化并返回给 YouTube
```

这样做有三个目的：

- Home Feed v9 直接面对我们已经验证过的原始 `/browse` protobuf，不再依赖原版重新序列化后的结构；
- 原版 Enhance 的 Browse 处理仍然完整执行，原版功能没有删除；
- Surge 侧仍然只有一个 `http-response` 脚本命中 `/browse`，不会重新出现两个脚本抢处理权的问题。

生成后的合并脚本位于：

```text
Upstream/Maasea/Script/Youtube/youtube.response.merged.js
```

它由仓库构建工作流从固定版 `youtube.response.js` 与 `YouTube.HomeFeedExtra.js` 自动生成。

### 2. 其他 Enhance 接口：保持固定版原版能力

以下接口继续由固定版 Maasea Enhance 原版代码处理：

```text
/player
/get_watch
/next
/search
/reel/reel_watch_sequence
/guide
/account/get_setting
/log_event
/config
```

播放器广告、Shorts 广告、搜索/推荐内容处理、后台播放、画中画以及其他 Enhance 原有逻辑均继续保留。

### 3. 不再单独处理 `/player/ad_break`

之前根据一次播放页抓包临时增加过 `/youtubei/v1/player/ad_break` 的独立拦截。进一步对比迁移前后的行为后，当前判断是：播放页出现“赞助”更可能是合并阶段破坏了原版去广告链路，而不是必须新增一个独立广告接口规则。

因此从 `2026.09.15.5` 开始，已经移除该临时 `player/ad_break` response 脚本，恢复到迁移前原版 Enhance 的功能边界。后续如果在原版链路完整恢复后仍能稳定复现该接口独立下发广告，再单独根据 HAR 处理。

## 与双语字幕模块共存

**双语字幕仓库完全不修改。**

你的 `YouTube-Bilingual-Subtitles-Surge` 继续作为独立模块使用。

为了降低冲突：

- 本去广告模块不提供字幕翻译开关；
- Enhance 内部 `captionLang` 强制为 `off`；
- `/browse` 只有本仓库的合并 response 脚本处理；
- 双语字幕继续负责它自己的字幕 request / `timedtext` 等链路；
- 不把双语字幕翻译逻辑合并进本仓库。

仍需注意，双语字幕模块本身在某些版本可能会匹配 `/player` 或 `/get_watch`。Surge 对同一个 response 的多个脚本存在优先级关系，因此请保持你之前已经验证可用的模块生效顺序。如果字幕异常，优先查看最近请求里的 `Modified by script`。

## 安装

1. 删除或关闭原来的官方/上游 `Youtube (Music) Enhance` 模块，避免和本仓库重复匹配。
2. 保留你的双语字幕模块，不需要修改。
3. 使用上面的任一订阅地址安装或更新本模块。
4. 确认版本为 `2026.09.15.5`。
5. 完全退出 YouTube / YouTube Music 后重新打开。
6. 建议开启 Surge QUIC 屏蔽；本模块本身也会屏蔽 `youtubei.googleapis.com` 和 `*.googlevideo.com` 的 UDP/QUIC，以保证 MITM 与脚本处理稳定生效。

## 更新记录

### 2026-09-15

- **2026.09.15.5**：修复合并版 `/browse` 后置补丁没有可靠生效的问题。改为 Home Feed v9 直接在原始 `/browse` protobuf 上先过滤，再交给固定版原版 Enhance Browse 继续执行。
- 已用最新实测首页 HAR 复核：该 HAR 中仍包含一个 `field #32` Sponsored item，带 `aboutthisad` 与 `pagead/adview`，Home Feed v9 对这份数据应删除该完整 item。
- 移除临时 `/player/ad_break` 独立处理，先恢复迁移前原版 Enhance 功能边界。
- 原版 Enhance 的 `/browse`、`/player`、`/get_watch`、`/next`、搜索、Shorts、Guide、设置、request 等逻辑继续完整保留。
- Enhance 内置字幕翻译继续强制 `off`，双语字幕仓库不做任何修改。
- 新旧两个模块订阅地址继续同步，老用户无需更换链接。

- **2026.09.15.4**：首次生成单一 `youtube.response.merged.js`，尝试在原版 Enhance Browse 后追加 Home Feed v9；实测发现该后置路径存在未生效问题，已由 `.5` 修正。

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
