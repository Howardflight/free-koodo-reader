# 自用阅读器 V1 开发记录

源码基线：NIyueeE/free-koodo-reader，提交 `e046eb384a85ff93284acd3bef8a166191d9e97b`。本目录为独立本地副本，未向上游推送。

## 已实现

- EPUB 阅读页增加“中英对照”入口，独立面板按原文、中文上下排列；复用现有导入、翻页和进度保存。
- HTTPS OpenAI 兼容 API，填写 Base URL（如 `https://your-server/v1`）、模型及密钥。密钥仅内存保存，退出应用后重新输入；地址和模型在开始翻译时保存在本机。
- 按章节提取英文段落，每次最多请求 20 个尚未缓存的段落，顺序执行；支持停止和失败后重试。单次请求 60 秒超时。切章、关闭面板、退出阅读页均取消当前请求。
- 译文通过 localforage 持久化，按 API 地址、模型、提示词版本和原文的 SHA-256 区分。已缓存内容可离线展示。React 文本节点展示模型输出，不解释为 HTML。
- 新增手动 GitHub Actions 工作流 `Personal Android APK`，执行类型、lint、服务测试、Web 构建、安卓 debug APK 构建，输出 APK、SHA256 与源码提交号。

当前对照是独立可滚动面板；没有改动阅读引擎 DOM 或将译文插进分页正文，主阅读器仍负责原书分页和进度。这项交互需要真机确认是否符合使用习惯。

## 运行与构建

建议 Node 22.13+ 或 24，Yarn 1.22.22。

```sh
yarn install --frozen-lockfile
yarn start
```

云构建：将本目录作为自己的 GitHub 仓库源码上传，在 Actions 中手动运行 `Personal Android APK`，完成后下载 `personal-reader-debug` artifact。当前会话没有创建远程仓库或触发 Actions。debug APK 用于验收；正式版需要自己的私有签名密钥，不能将 debug 包当作稳定发行版。

不用安装项目依赖即可运行翻译服务检查：

```sh
node --experimental-vm-modules scripts/test-bilingual.cjs
```

## 审查与验证结果

2026-11-23：翻译服务实际源码测试通过：HTTPS 地址校验、请求内容、缓存命中不请求网络、模型缓存隔离、HTTP 429、无效返回和取消请求。`git diff --check` 通过。

本机两次锁文件依赖安装均在 GitHub 的 electron/node-gyp 下载环节因连接断开而失败；没有完成基线生产构建、完整 TypeScript/ESLint、UI 截图回归或 APK 构建。本机未发现 Java/Android SDK。新增工作流尚未实际运行，不能视为构建已通过。

仓库保留 AGPL-3.0 许可证和署名；AGENTS.md 将部分阅读引擎描述为闭源/混淆产物，其可获取源码和再分发许可还需专项核对，不将整个仓库的 LICENSE 当作这些二进制产物已审清的证据。未读取或修改这些压缩引擎文件。

上游 release 签名配置支持仓库内默认 keystore，不能将公开仓库中的签名材料用作自己的可信发行身份。本次新增工作流仅输出 debug APK。

WebDAV 已有独立服务与浏览器路径，继续复用，未改动其同步或冲突策略；尚未连接实际群晖或验证两设备同步，不能宣称 V1 同步验收完成。浏览器与 Android WebView 访问自建 API/WebDAV 时还需服务器允许对应来源的 CORS。

## 剩余验收

1. 首先构建并在 Android 设备验证基线：导入英文 EPUB、翻页、退出恢复。
2. 用自己的 API 连续翻译至少 20 段，重开应用并断网确认缓存；检查切章、取消、429 与超时后的重试。
3. 配置实际 HTTPS WebDAV，使用两设备验证书籍、阅读位置、离线后恢复以及双方同时修改的冲突处理；目前没有新增或验证冲突算法。
4. 真机检查前后台恢复、窄屏与长章节显示；桌面回归截图也未完成。
5. 验收通过后使用私有签名制作 release APK，归档构建日志、源码版本、校验值和回滚包。

Calibre-Web OPDS 按原方案留到第二阶段。PDF、TTS 和 AI 聊天没有加入本次开发范围。
