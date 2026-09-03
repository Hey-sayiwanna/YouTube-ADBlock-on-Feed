# YouTube Home Feed AdBlock for Surge

这是一个独立维护的 YouTube 首页推荐流去广告模块，面向 iPhone 与 iPad，专门处理 YouTube 首页 `/youtubei/v1/browse` 中的 Sponsored / Feed 广告。

本项目来源于真实 iOS YouTube 抓包与 HAR 分析。YouTube 首页广告使用 protobuf 下发，广告结构会随服务端灰度、设备与版本发生变化，因此本项目采用“识别广告 Feed item 并删除整个卡片”的方式，而不是简单阻断图片或统计域名。

感谢 **GPT-5.6 Sol** 在多轮 HAR / protobuf 分析、脚本定位与兼容性调试中提供帮助，也感谢 [Maasea/sgmodule](https://github.com/Maasea/sgmodule) 的 YouTube Enhance 项目提供参考与完整播放页去广告能力。

## 模块订阅地址

```text
https://raw.githubusercontent.com/Hey-sayiwanna/YouTube-ADBlock-on-Feed/main/YouTube.HomeFeedAdBlock.sgmodule
```

这个地址会保持不变，后续在 Surge 中点击“立即更新”即可。

## 安装

1. 删除 Surge 中旧的“ YouTube首页去广告 ”测试模块，避免多个 `/browse` response 脚本重复匹配。
2. 使用上面的订阅地址安装本模块。
3. 开启模块与 Surge MITM，安装并完全信任 Surge CA 证书，同时建议屏蔽 QUIC。
4. 如果同时使用 YouTube Enhance 与双语字幕模块，请保持当前已验证可用的模块生效顺序：本项目负责 `/browse`，Enhance 继续负责 `/player`、`/get_watch`、`/next` 等接口。
5. 完全退出 YouTube 后重新打开，再刷新首页测试。

## 工作原理

YouTube iOS 首页推荐流主要通过：

```text
https://youtubei.googleapis.com/youtubei/v1/browse
```

返回二进制 protobuf。模块会在响应中寻找 Home Feed 容器，并删除包含明确广告身份特征的完整 Feed item，例如：

```text
www.youtube.com/aboutthisad
www.youtube.com/pagead/
googleadservices.com/pagead/
googleads.g.doubleclick.net/pagead/
yt3.ggpht.com/proxy
```

其中 `aboutthisad` 属于强广告身份特征；其他较宽泛特征不会单独作为删除依据，以降低误删正常推荐视频的风险。

删除广告 item 后，模块还会同步清理相邻的 `cell_divider` 以及已知广告空壳，避免出现灰框、黑框或空白占位。

## 与其他 YouTube 模块共存

本项目只接管：

```text
/youtubei/v1/browse
```

推荐搭配：

| 功能 | 建议模块 |
| --- | --- |
| 首页 Sponsored / Feed 广告 | 本项目 |
| 播放前、播放中及切换视频广告 | YouTube Enhance |
| 自动简中双语字幕 | YouTube-Bilingual-Subtitles-Surge |

Surge 对同一个 HTTP response 只会执行第一个匹配的 response 脚本，因此如果 `/browse` 没有显示由 `YouTube.HomeFeedAdBlock` 修改，请检查模块生效顺序。

## 调试日志

当前版本保留调试日志。命中广告时，最近请求中会看到类似：

```text
[YT HomeFeed AdBlock v9] DROP AD field=1 ...
[YT HomeFeed AdBlock v9] DROP DIVIDER ...
[YT HomeFeed AdBlock v9] DONE ads=1 ...
```

如果没有检测到广告，则会显示：

```text
[YT HomeFeed AdBlock v9] PASS bytes=...
```

如果未来首页再次出现广告，而日志显示 `PASS`，可以导出对应 `/browse` HAR，用于继续适配新的 protobuf 广告结构。

## 更新日志

### 2026-09-03

- **v9**：扩展广告身份识别，兼容 MyRepublic 等使用 `paralleladinteraction`、DoubleClick pagead 新链路的 Sponsored item；包含 `aboutthisad` 的 Feed item 可直接判定为广告。

### 2026-09-02

- **v8**：不再假设固定 protobuf 外层路径，在前 8 层动态定位 Home Feed 容器，兼容 `field #1` 与 `field #32` 广告结构。
- **v7**：切换 WebView 引擎并减少大响应递归重建，降低 Surge 内存压力，同时加入广告空壳清理。
- **v6**：从删除广告内部 payload 改为删除完整 Feed item，解决广告被清空后残留灰框的问题。
- **v5**：移除 Surge JSC 不支持的 `TextEncoder`，修复脚本执行中断。
- **v1-v4**：根据多份真实 HAR 逐步定位 iOS Feed Sponsored 的 protobuf 结构与广告特征。

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `YouTube.HomeFeedAdBlock.sgmodule` | Surge 模块订阅入口 |
| `YouTube.HomeFeedAdBlock.js` | `/browse` protobuf 首页广告过滤脚本 |
| `README.md` | 安装、原理、共存与更新说明 |

## 说明

- 本项目只处理 YouTube 首页推荐流广告，不替代完整的 YouTube Enhance。
- YouTube 服务端会进行 A/B 测试，同一账号在不同 iPhone / iPad 上也可能收到不同 protobuf 结构。
- 不建议简单 REJECT `yt3.ggpht.com`、`googlevideo.com` 等共享资源域名，否则可能误伤正常封面、头像或视频播放。
- 调试完成后可关闭 Surge 的“捕获 HTTP 内容”，减少性能与内存开销。
