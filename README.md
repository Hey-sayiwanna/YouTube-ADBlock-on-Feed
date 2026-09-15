# YouTube Home Feed AdBlock for Surge

这是一个独立维护的 YouTube 首页推荐流去广告模块，面向 iPhone 与 iPad，专门处理 YouTube 首页中的 Sponsored / Feed 广告，仅支持surge。


## 模块订阅地址

```text
https://raw.githubusercontent.com/Hey-sayiwanna/YouTube-ADBlock-on-Feed/main/YouTube.HomeFeedAdBlock.sgmodule
```

这个地址会保持不变，后续在 Surge 中点击“立即更新”即可。

## 安装

1. 使用上面的订阅地址安装本模块。
2. 开启模块与 Surge MITM，安装并完全信任 Surge CA 证书，同时建议屏蔽 QUIC。
3. 如果同时使用 YouTube Enhance 与双语字幕模块，请保持当前已验证可用的模块生效顺序，见本文章最后。
4. 完全退出 YouTube 后重新打开，再刷新首页测试。


## 更新日志

### 2026-09-03

- **v9**：扩展广告身份识别，兼容 MyRepublic 等使用 `paralleladinteraction`、DoubleClick pagead 新链路的 Sponsored item；包含 `aboutthisad` 的 Feed item 可直接判定为广告。

### 2026-09-02

- **v8**：不再假设固定 protobuf 外层路径，在前 8 层动态定位 Home Feed 容器，兼容 `field #1` 与 `field #32` 广告结构。
- **v7**：切换 WebView 引擎并减少大响应递归重建，降低 Surge 内存压力，同时加入广告空壳清理。
- **v6**：从删除广告内部 payload 改为删除完整 Feed item，解决广告被清空后残留灰框的问题。
- **v5**：移除 Surge JSC 不支持的 `TextEncoder`，修复脚本执行中断。
- **v1-v4**：根据多份真实 HAR 逐步定位 iOS Feed Sponsored 的 protobuf 结构与广告特征。

## ⚠️ 重要：需配合 Maasea 的 YouTube Enhance 使用

本模块主要用于补充去除 YouTube 首页 `/browse` 中的 Sponsored / Feed 广告。若需要更完整地去除 YouTube 首页及视频播放等位置的广告，请同时安装并启用 **Maasea 作者的 Youtube (Music) Enhance** 模块。

Maasea 官方 YouTube Enhance 模块：

```text
https://raw.githubusercontent.com/Maasea/sgmodule/master/YouTube.Enhance.sgmodule
```

### Surge 模块顺序

请在 Surge 的模块列表中将 **本模块（YouTube Home Feed AdBlock）放置在 Maasea / Youtube (Music) Enhance 模块的下方**。这是目前实际测试可用的组合与顺序。

如果还需要使用 **YouTube 双语字幕**，请将双语字幕模块放在这两个去广告模块的**最上方**。双语字幕模块的安装、使用方法及更新请查看我的另一个专门仓库：

```text
https://github.com/Hey-sayiwanna/YouTube-Bilingual-Subtitles-Surge
```

三个模块同时使用时，推荐在 Surge 中保持以下顺序：

```text
YouTube 双语字幕（最上方）
↓
Youtube (Music) Enhance（Maasea）
↓
YouTube Home Feed AdBlock（本模块，最下方）
```

按上述顺序启用后，由本模块补充处理首页 Sponsored / Feed 广告，Maasea Enhance 负责其原有的 YouTube / YouTube Music 去广告与增强功能，双语字幕模块独立负责字幕处理。

> **注意：以上几个模块必须保持为独立模块使用，请勿合并成一个 `.sgmodule`。实际测试中，将这些功能合并到同一个模块后可能导致脚本匹配或执行顺序发生变化，从而造成首页去广告、视频去广告或双语字幕等功能失效。**
