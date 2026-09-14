# YouTube（music）去广告自制更新版

这是一个面向 **Surge / iOS / iPadOS** 的 YouTube & YouTube Music 去广告模块。

当前版本的原则很简单：**原版 Enhance 能做的去广告能力一项不删，在它原有处理完成后，再补上我们自己抓包修出来的首页 Sponsored 过滤。**

也就是说，本项目不是用“自制规则”替代 Maasea，而是以固定历史版 Maasea `YouTube (Music) Enhance` 为基础，在不影响双语字幕模块的前提下追加自己的修复。

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

### 1. `/browse`：原版 Enhance 先处理，再执行自制 Home Feed v9

这是本版本最重要的调整。

之前为了避免 Surge 的多个 `http-response` 脚本争抢同一个 `/browse` 响应，我们曾经把 Enhance 的 `browse` 从匹配列表里去掉，只让自制首页脚本处理。这会丢失原版 Enhance 对其他 Browse 场景的广告过滤能力。

现在已经改为 **单一合并 response 脚本**：

```text
/youtubei/v1/browse
        ↓
固定版 Maasea Enhance 原版 Browse 解析/过滤
        ↓
把原版处理后的 protobuf 再交给 Home Feed v9
        ↓
补充删除原版仍会漏掉的首页 Sponsored / Feed 广告与空壳
        ↓
一次性返回给 YouTube
```

这样既恢复了迁移前原版 Enhance 的 Browse 去广告能力，又保留我们根据真实 iOS HAR 抓包修出来的首页广告补丁，同时只有一个 response 脚本命中 `/browse`，不会发生脚本抢处理权的问题。

生成后的合并脚本位于：

```text
Upstream/Maasea/Script/Youtube/youtube.response.merged.js
```

它由仓库中的构建工作流自动从固定版 `youtube.response.js` 生成，执行顺序是：

```text
原版 Enhance Browse
→ 自制 Home Feed v9
```

而不是用自制算法去近似替代原版 Browse 逻辑。

### 2. 其他 Enhance 接口：保持原版能力

以下接口继续走固定版 Maasea Enhance：

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

播放器广告、Shorts 广告、搜索/推荐内容处理、后台播放、画中画及其他 Enhance 原有能力继续保留。

### 3. `/player/ad_break`：单独处理视频下方“赞助”伴随广告

2026-09-15 的实际抓包发现，新版 YouTube 会额外请求：

```text
/youtubei/v1/player/ad_break
```

该响应中可以直接下发播放页面视频下方的 Sponsored / Companion 广告卡片，例如：

```text
aboutthisad
pagead/adview
pcs/activeview
yt3.ggpht.com/proxy
ad_card_badge.eml-fe
ad_button.eml-fe
ad_image.eml-fe
feed_ad_extension_carousel.eml-fe
```

这条接口不属于旧版 Enhance 的原有匹配范围，所以现在单独处理，不与 `/browse`、`/player`、`/get_watch` 共用脚本。

## 与双语字幕模块共存

**双语字幕仓库完全不修改。**

你的 `YouTube-Bilingual-Subtitles-Surge` 继续作为独立模块使用。

为了降低冲突：

- 本去广告模块不提供字幕翻译开关；
- Enhance 内部 `captionLang` 强制为 `off`；
- `/browse` 只有本仓库的合并 response 脚本处理；
- `/player/ad_break` 只有独立广告脚本处理；
- 双语字幕继续负责它自己的字幕 request / `timedtext` 等链路；
- 不把双语字幕翻译逻辑合并进本仓库。

仍需注意，双语字幕模块本身在某些版本可能会匹配 `/player` 或 `/get_watch`。Surge 对同一个 response 的多个脚本存在优先级关系，因此请保持你之前已经验证可用的模块生效顺序。如果字幕异常，优先查看最近请求里的 `Modified by script`。

## 安装

1. 删除或关闭原来的官方/上游 `Youtube (Music) Enhance` 模块，避免和本仓库重复匹配。
2. 不需要删除你的双语字幕模块。
3. 使用上面的任一订阅地址安装本模块。
4. 完全退出 YouTube / YouTube Music 后重新打开。
5. 建议开启 Surge QUIC 屏蔽；本模块本身也会屏蔽 `youtubei.googleapis.com` 和 `*.googlevideo.com` 的 UDP/QUIC，以保证 MITM 与脚本处理稳定生效。

## 更新记录

### 2026-09-15

- **2026.09.15.4**：恢复固定版 Maasea Enhance 的原版 `/browse` 处理，不再使用自制通用算法替代原版 Browse 去广告。
- 新增 `youtube.response.merged.js`：对 `/browse` 先执行原版 Enhance，再在原版输出结果上继续执行 Home Feed v9，避免两个 response 脚本争抢同一响应。
- 保留固定版 Enhance 的其他 response/request 功能，不删减原版能力。
- `/player/ad_break` 继续单独处理，用于去除视频播放页下方的 Sponsored / Companion 广告卡片。
- Enhance 内置字幕翻译保持强制 `off`，双语字幕仓库不做任何修改。
- 新旧两个模块订阅地址继续同步，老用户不用换链接也能收到更新。

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
