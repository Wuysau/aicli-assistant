# AI CLI Assistant

`aicli-assistant` 是一个基于 `Tauri 2 + React + TypeScript + Vite` 的 Windows Terminal Workflow Assistant。

当前版本的重点不是做通用聊天机器人，而是把 Windows 本机场景下最常见的一批终端问题，整理成可命中、可解释、可复用、可持续使用的本地工作流工具。模板库、关键词匹配、环境判断和风险规则仍然是主流程；AI 只在必要时做受约束的补充说明。

## 项目定位

- 面向 Windows 开发者和运维场景的终端工作流助手
- 优先使用本地模板库、关键词匹配、环境判断和风险规则
- 支持多 provider 的 AI 增强配置，但 AI 不负责决定高风险动作
- 不自动执行命令，只支持复制或插入到终端输入框

## 当前核心能力

- 首批 10 个高频终端场景模板
- 基于关键词/意图的本地模板匹配
- 推荐环境、推荐 Shell、推荐命令和下一步建议
- 规则驱动的风险提示
- 最近记录、模板活跃度、偏好项和最近搜索的本地持久化
- Windows 桌面端“发送到终端输入框但不自动执行”
- 多 provider AI 设置页、本地保存和测试连接
- 完全离线模式，以及“规则优先 + AI 增强”的混合模式

## 当前支持场景

1. 查端口占用
2. 杀进程
3. 统计日志 `ERROR / WARN / 500`
4. Maven 跳过测试打包
5. 查看 Git 用户名邮箱
6. Git push hook 拒绝排查
7. Java 端口冲突排查
8. PowerShell 执行策略报错
9. SSH 连接失败基础排查
10. 查看 Docker 容器状态

## AI Provider 设置

桌面版应用内已支持通用的 AI Providers 配置系统。

当前支持的 provider 类型：

- `OpenAI-compatible`
- `Ollama / Local`
- `Anthropic-compatible` 结构预留，当前版本暂不直接发起请求

当前兼容示例：

- OpenAI-compatible 服务：`https://api.openai.com/v1`
- Gemini 的 OpenAI-compatible 接口：`https://generativelanguage.googleapis.com/v1beta/openai`
- 自定义兼容端点：任意实现 OpenAI-compatible Chat Completions 的私有网关或第三方服务
- Ollama 本地接口：`http://127.0.0.1:11434`

说明：

- 未配置任何 provider 时，基础规则 / 模板模式仍可正常使用
- AI 增强模式只负责补充解释、环境建议和相近模板推荐
- 配置会保存在用户本地应用目录，不会写进前端源码或仓库文件

## 技术栈

- `Tauri 2`
- `React 19`
- `TypeScript`
- `Vite`
- `Vitest`
- `ESLint`

## 如何运行

安装依赖：

```powershell
cmd /c npm.cmd install
```

运行 Web 版：

```powershell
cmd /c npm.cmd run dev
```

运行 Tauri 桌面版：

```powershell
cmd /c npm.cmd run tauri:dev
```

生成 Windows 桌面安装包：

```powershell
cmd /c npm.cmd run tauri:build
```

当前会生成：

- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/bundle/msi/*.msi`

## 工程校验

```powershell
cmd /c npm.cmd run lint
cmd /c npm.cmd run typecheck
cmd /c npm.cmd run test
cmd /c npm.cmd run build
cmd /c npm.cmd run verify
```

## 环境变量

复制样例文件：

```powershell
Copy-Item .env.example .env
```

当前版本不再通过 `.env` 持久化 provider 密钥。Provider 相关配置统一在桌面应用的“AI 设置”页中管理，并保存在用户本地应用目录。`.env` 仅保留前端运行时所需的基础开发变量。

## 当前版本边界

- 当前不是通用聊天助手，也不是通用 coding agent
- 不自动执行任何命令，只支持复制或插入终端输入框
- “发送到终端输入框”当前优先支持 Windows Terminal 和经典控制台窗口
- 不支持云同步、账号系统和多端同步
- AI 只做受约束的结构化补充，不输出自由聊天内容

## 已知限制

- Web 版不能直接把命令发送到终端输入框
- Web 版也不支持本地 provider 配置保存和测试连接
- 终端插入能力当前不保证支持 VS Code 集成终端和所有第三方终端
- 当前模板范围固定为首批 10 个场景
- 当前安装包未做代码签名，Windows 可能出现 SmartScreen 提示
- Anthropic-compatible 当前只预留了数据结构，尚未直接请求

## 后续路线

- 用正式本地数据库替换当前轻量持久化实现
- 继续增强 provider 切换、多 provider 管理和连接诊断
- 增强模板详情、最近记录复用和结果复制体验
- 在不放弃规则主流程的前提下，逐步增强 AI 补充质量

## 开发说明

开发期说明、调试入口和验证方式见 [DEVELOPMENT.md](./DEVELOPMENT.md)。
