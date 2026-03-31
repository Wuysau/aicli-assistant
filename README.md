# AI CLI Assistant

`aicli-assistant` 是一个基于 `Tauri 2 + React + TypeScript + Vite` 的桌面应用 MVP，目前先实现界面壳子与本地 mock 交互，不接真实 AI 接口。

## 当前状态

- 已完成项目初始化，包含 `src-tauri` 标准目录。
- 首页已提供 MVP 壳子：标题、多行输入框、shell 选择、三个动作按钮、结果区域、最近记录占位区域。
- 结果区目前由本地 mock 逻辑驱动，便于后续再接入真实 AI。

## 目录结构

```text
aicli-assistant/
├─ public/
├─ src/
│  ├─ components/
│  ├─ data/
│  ├─ lib/
│  ├─ types/
│  ├─ App.css
│  ├─ App.tsx
│  ├─ index.css
│  └─ main.tsx
├─ src-tauri/
│  ├─ capabilities/
│  ├─ icons/
│  ├─ src/
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 运行 Web 版 MVP

```bash
npm run dev
```

默认地址：

```text
http://localhost:1420
```

### 3. 运行 Tauri 桌面版

```bash
npm run tauri:dev
```

## Tauri 运行前置

当前机器在初始化时缺少以下桌面端依赖，因此 `tauri dev` 还不能直接启动：

- Rust / Cargo
- Visual Studio Build Tools（需包含 MSVC 与 Windows SDK）

补齐以上依赖后，即可直接执行 `npm run tauri:dev`。

## 环境变量

复制 `.env.example` 后按需调整：

```bash
cp .env.example .env
```

当前支持：

- `VITE_APP_NAME`：应用显示名称
- `VITE_APP_ENV`：运行环境标识
- `VITE_MOCK_DELAY_MS`：本地 mock 返回延迟

## 下一步建议

- 接入真实 AI 接口与统一请求层
- 增加命令历史持久化
- 把最近记录与结果详情接到 Tauri 本地存储
- 增加执行前风险提示与命令复制功能
