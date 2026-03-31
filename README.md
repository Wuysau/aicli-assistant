# AI CLI Assistant

`aicli-assistant` 是一个基于 `Tauri 2 + React + TypeScript + Vite` 的 Windows Terminal Workflow Assistant。

当前版本的目标不是做通用聊天机器人，也不是接管终端执行流程，而是把 Windows 本机场景下最常见的一批终端问题，整理成可命中、可解释、可复用、可持续使用的本地工作流工具。

## 项目定位

- 面向 Windows 开发者和运维场景的终端工作流助手
- 优先使用本地模板库、关键词匹配、环境判断和风险规则
- 支持可选的 AI 补充说明，但 AI 只负责解释、环境建议和相近模板推荐
- 不自动执行命令，不把高风险动作的决策交给 AI

## 当前核心能力

- 首批 10 个高频终端场景模板
- 基于关键词/意图的本地模板匹配
- 推荐环境、推荐 Shell、推荐命令和下一步建议
- 规则驱动的风险提示
- 最近记录、模板活跃度、偏好项和最近搜索的本地持久化
- Windows 桌面端“发送到终端输入框但不自动执行”
- 完全离线模式，以及“规则优先 + AI 补充”的混合模式

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

## 技术栈

- `Tauri 2`
- `React 19`
- `TypeScript`
- `Vite`
- `Vitest`
- `ESLint`

## 目录说明

```text
src/
  components/   页面和结果展示组件
  data/         本地结构化模板、静态选项、验证数据
  mock/         初始种子数据
  services/     匹配、风险规则、本地存储、AI 补充与桥接服务
  test/         自动化验证
  types/        领域类型定义
src-tauri/
  src/          Tauri 后端、终端桥接和 AI 补充命令
```

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

默认是完全离线/仅规则模式：

```env
AICLI_AI_MODE=disabled
```

如需启用 AI 补充模式，请在 `.env` 中配置：

```env
AICLI_AI_MODE=supplemental
AICLI_AI_BASE_URL=https://api.openai.com/v1
AICLI_AI_MODEL=gpt-4.1-mini
AICLI_AI_API_KEY=your_api_key
```

注意：

- `AICLI_*` 变量只由 Tauri 后端读取，不会写进前端源码
- 不要给这些变量添加 `VITE_` 前缀
- 未配置或调用失败时，应用会自动退回纯规则模式

## 当前版本边界

- 当前不是通用聊天助手，也不是通用 coding agent
- 不自动执行任何命令，只支持复制或插入终端输入框
- “发送到终端输入框”当前优先支持 Windows Terminal 和经典控制台窗口
- 不支持云同步、账号系统和多端同步
- AI 只做受约束的结构化补充，不输出自由聊天内容

## 已知限制

- Web 版不能直接把命令发送到终端输入框
- 终端插入能力当前不保证支持 VS Code 集成终端和所有第三方终端
- 当前模板范围固定为首批 10 个场景
- 当前本地存储实现基于浏览器式键值存储，已为后续迁移到 SQLite 预留数据结构

## 后续路线

- 用正式本地数据库替换当前轻量持久化实现
- 增强模板详情、最近记录复用和结果复制体验
- 继续收敛 Windows 本机场景下的风险规则和环境判断
- 在不放弃规则主流程的前提下，逐步增强 AI 补充质量

## 开发说明

开发期说明、调试入口和验证方式见 [DEVELOPMENT.md](./DEVELOPMENT.md)。
