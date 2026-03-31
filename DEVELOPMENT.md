# Development Notes

## 本地开发

安装依赖：

```powershell
cmd /c npm.cmd install
```

启动 Web 开发环境：

```powershell
cmd /c npm.cmd run dev
```

启动 Tauri 桌面开发环境：

```powershell
cmd /c npm.cmd run tauri:dev
```

生成 Windows 安装包：

```powershell
cmd /c npm.cmd run tauri:build
```

默认产物位置：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

## 常用校验命令

```powershell
cmd /c npm.cmd run lint
cmd /c npm.cmd run typecheck
cmd /c npm.cmd run test
cmd /c npm.cmd run build
cmd /c npm.cmd run verify
```

## 开发期验证入口

- 开发环境会额外显示“验证台”
- 验证台仅用于快速检查模板命中、推荐环境、风险等级和兜底状态
- 该页面不会在发布版中显示

## AI Provider 开发说明

- Provider 配置统一由桌面端后端命令读写，不保存在前端源码
- 当前后端会把配置写入用户本地应用目录下的 `ai-providers.json`
- 支持 `OpenAI-compatible` 和 `Ollama` 两类实际请求
- `Anthropic-compatible` 当前只保留了结构和 UI，不直接发请求
- `test_ai_provider_connection` 用于测试当前 provider 配置是否可用
- `generate_ai_supplement` 只会读取默认 provider，且仅在 AI 增强模式下调用

## 终端插入能力

- 当前仅在 Tauri 桌面环境可用
- 目标是“插入命令到终端输入框，但不自动执行”
- 当前优先支持 Windows Terminal 和经典控制台窗口
- 如果目标终端不可识别或桥接失败，会自动退回复制方案

## 本地存储说明

当前本地存储分成两层：

- 前端本地 store：最近记录、模板活跃度、用户偏好、最近搜索关键词
- 桌面端 provider store：AI providers、默认 provider、AI 增强模式

Provider 密钥只存放在用户本地应用目录，不写入仓库文件。

## 已知限制

- 当前模板仍然固定为首批 10 个场景
- Web 版不能把命令直接送入终端输入框
- Web 版不支持 provider 的本地保存和连接测试
- 发布构建目前未配置代码签名和自动更新
