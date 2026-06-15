# 思考模式和 Free 模型

## 概述

为 app 增加了两方面的能力：

1. **OpenCode Zen 免费模型** — 运行时从 opencode SDK 发现，在模型选择器中展示能力图标
2. **思考深度（Variant）选择器** — 控制模型的推理强度/思考预算，支持自定义配置

---

## 数据流

### Zen 模型发现

```
启动 → connectionStatus === 'connected'
  → window.api.listProviders()
    → main/index.ts: ipcMain.handle('list-providers')
      → opencodeClient.provider.list()   // V1 API
      → flatMap 所有 provider 的 models，添加 providerID
  → App.tsx: setAvailableProviders, setAvailableModels
  → ChatView: zenModels = availableModels.filter(m => m.providerID === 'opencode')
  → 在 🤖 <select> 中渲染为 "OpenCode Zen" 分组

关闭设置时也会刷新：
```
SettingsDialog onOpenChange(false)
  → App.tsx: handleSettingsClose(false)
    → loadConfig()                          // 刷新自定义 provider
    → window.api.listProviders()            // 刷新 Zen 模型列表
    → setAvailableProviders, setAvailableModels
```
```

### 思考深度（Variant）

```
用户选择 variant
  → ChatView: onThinkingDepthChange(variant)
  → App.tsx: handleThinkingDepthChange
    → setThinkingDepth(variant)
    → window.api.saveConfigField('thinkingDepth', variant)
      → main/index.ts: save-config-field IPC → 写入 config.json
      → 无需重启 server

发送消息时
  → main/index.ts: send-message IPC
  → opencodeClient.session.promptAsync({
      ...,
      ...(savedConfig.thinkingDepth ? { variant: savedConfig.thinkingDepth } : {}),
    })
```

### 自定义 Variants 配置

```
用户自定义 variants（Settings → Provider 编辑）
  → 格式: "值:中文说明,值:中文说明,..." (逗号分隔)
  → 保存到 config.json providers[].variants

ChatView.currentModelVariants:
  1. 优先: parseVariantsField(cfg.variants) → [{id, label}]
  2. 回退: V1 模型的 variants 字段 → [{id}]
```

---

## 涉及代码

### main/index.ts

- `list-providers` IPC（line 318-340）：调用 V1 `provider.list()`，flatMap 所有 provider 的嵌入式 models，映射 providerID、variants 数组、capabilities、cost、status、limit
- `send-message` IPC（line 407-415）：当 `thinkingDepth` 非空时传递 `variant` 参数

### configStore.ts

- `ProviderConfig` 接口：新增 `variants?: string`
- `AppConfig` 接口：新增 `thinkingDepth: string`，默认值 `''`

### renderer/src/lib/variants.ts

- `providerVariantLabels`：已知 provider 的中文 variant 标签映射（opencode、anthropic、openai、google）
- `getVariantLabel(providerID, variantId)`：查表获取中文标签，fallback 到 opencode 的标签
- `isFreeModel(modelId)`：`modelId.endsWith("-free")`（当前未使用）
- `parseVariantsField(field)`：解析 `"值:说明,值:说明"` → `[{id, label}]`
- `capabilityIcons(caps)`：从模型 `capabilities.input` 返回能力图标字符串（🖼️🎤🎬📄）

### ChatView.tsx

- `zenModels`：过滤 `availableModels` 中 `providerID === 'opencode'` 的模型
- `currentModelVariants`：优先取自定义 variants，回退 V1
- 🤖 分组 `<select>`：自定义配置 + OpenCode Zen（能力图标：🖼️🎤🎬📄）
- 🧠 思考深度 `<select>`：当 `currentModelVariants.length > 0` 时显示

### SettingsDialog.tsx

- `ProviderEditForm` 新增 "思考深度" 输入框

---

## 文件附件上传

### 数据流

```
用户点击 📎 按钮
  → InputBar: window.api.openFilePicker({ multiple: true })   // IPC 调用
    → main/index.ts: dialog.showOpenDialog()                  // Electron 原生对话框
    → 返回 string[]（文件绝对路径）
  → InputBar.handleSend(text, paths)                          // 传递路径数组
  → ChatView.handleSend → useChat.sendMessage(text, files)
  → 构建 parts:
      [{ type: 'file', mime, filename, url: 'file://' + path }]
  → window.api.sendMessage(text, sid, system, parts)          // IPC 发送
  → main/index.ts: send-message handler
    → opencodeClient.session.promptAsync({ parts })
```

### 图片预览

```
sendMessage 构建 message.files.url:
  → filePathToURI(path): 'file://' + absPath                  // Unix, 以 / 开头
                          'file:///' + absPath.replace(\, /)   // Windows

MessageItem 渲染 <img>:
  → src = f.url.replace('file://', 'local-asset://')
    → main/index.ts: protocol.handle('local-asset')
      → decodeURIComponent → net.fetch('file://' + path)
```

- 使用 `local-asset://` 自定义协议绕过 Electron 的 `file://` 安全限制
- 协议在 `app.whenReady()` 中通过 `protocol.handle()` 注册
- 需提前调用 `protocol.registerSchemesAsPrivileged()` 注册 scheme 权限

### 涉及代码

- **InputBar.tsx**：📎 按钮 → `window.api.openFilePicker()`，文件状态为 `string[]`（路径数组）
- **useChat.ts**：`sendMessage(files?: string[])` — 从路径构建 parts 和显示元数据
- **MessageItem.tsx**：图片 `src` 使用 `local-asset://` 协议
- **main/index.ts**：`local-asset` 协议处理 + `open-file-picker` IPC
- **preload/index.ts**：`openFilePicker` IPC 桥

### 已知限制 / 设计决策

- Electron 33+ 的 `contextIsolation` 导致 DOM `File` 对象没有 `.path` 属性
  → 改用 `dialog.showOpenDialog()` IPC 获取真实路径
- 拖放上传和剪贴板粘贴因无法获取文件路径，已移除
- 使用 `file://` URI 方案（无需 base64 编码，不复制文件）
- `filePathToURI()` 避免使用 `process.platform`（renderer 不可用），改用路径前缀判断

---

## 连接状态与会话操作守卫

### 数据流

```
app.whenReady()
  → protocol.registerSchemesAsPrivileged()       // 注册 local-asset 协议
  → createWindow()                               // 渲染器加载，显示黄色圈
  → 此时 connectionStatus === 'reconnecting'      // 默认值
  → await createOpencode({...})                   // 启动 opencode 嵌入式服务器
  → opencodeReady = true
  → startHealthCheck() + 立即执行一次 health check // 不等 10s interval
    → 成功 → connectionStatus === 'connected'     // 绿圈
    → 失败 → 等 interval 重试（每 10s）
```

### 守卫机制

| 层次 | 实现 | 作用 |
|------|------|------|
| IPC 守卫 | `main/index.ts`：`create-session` / `delete-session` / `update-session-title` 检查 `opencodeReady` | 防止未就绪时调用 opencode API |
| UI 禁用 | `App.tsx`：`SessionSidebar.disabled = connectionStatus !== 'connected' \|\| isStreaming` | 新建按钮 `disabled`，删除按钮隐藏，重命名/切换不触发 |
| 错误兜底 | `useSessions.ts`：各操作 `try-catch` 静默处理 | 防止 IPC reject 导致未捕获异常 |

### 立即 health check

`restartOpencode()` 末尾在 `opencodeReady = true` 后立即执行一次 `opencodeClient.global.health()`：

```ts
;(async () => {
  try {
    await opencodeClient.global.health()
    mainWindow?.webContents.send('connection-status', 'connected')
  } catch {}
})()
```

避免等待 10 秒的 health check interval 首次触发。

### 涉及代码

- **main/index.ts**：
  - `restartOpencode()`：`opencodeReady = true` 后立即 health check
  - IPC handlers：`create-session`、`delete-session`、`update-session-title` 加 `opencodeReady` 守卫
  - `startHealthCheck()`：interval 10s，失败时自动重连（最多 3 次）
- **useSessions.ts**：各操作 `try-catch`
- **App.tsx**：`SessionSidebar` 传入 `disabled={connectionStatus !== 'connected' || isStreaming}`
- **SessionSidebar.tsx**：新建按钮 `disabled`，删除按钮 `disabled` 时隐藏，双击重命名不触发

---

## save-config 与 restartOpencode

### 行为

`save-config` IPC handler 做了两件事：

```
window.api.saveConfig(config)
  → main/index.ts: ipcMain.handle('save-config')
    → 1. saveConfig(config)          // 写 config.json → 瞬间
    → 2. await restartOpencode(config) // 重启 opencode 服务器 → 秒级
```

### restartOpencode 流程

```
restartOpencode(config)
  → stopHealthCheck()
  → connection-status: 'reconnecting'           // 黄圈
  → opencodeServer.close() + 1s wait
  → opencodeReady = false
  → 重建 provider 配置（遍历 config.providers → providerConfig）
  → 从 DB 读取 MCP 服务器（loadMcpServers → mcpConfig + permissions）
  → 自动注册 WeKnora MCP（若配置了 URL 和 API Key）
  → 构建全局 permission（websearch/bash/skills/MCP）
  → 从 DB 读取 agents（loadAgents → agentConfig + permission overrides）
  → await import('@opencode-ai/sdk/v2')          // 加载 SDK
  → await createOpencode({ port: 0, config })    // 创建新嵌入式 HTTP 服务器
  → opencodeClient = client, opencodeServer = server
  → opencodeReady = true
  → startHealthCheck() + 立即 health check
```

### 耗时原因

- 关闭旧 server + 1s 等待
- `import('@opencode-ai/sdk/v2')` — 加载 SDK（含原生模块）
- `createOpencode({...})` — **重建完整的 HTTP 服务**（扫描 skills、启动 MCP 子进程、注册 agents）
- 完全重启而非热更新

### 触发路径

| 位置 | 操作 | 是否触发 restartOpencode |
|------|------|--------------------------|
| `SettingsDialog.tsx:153` | 保存设置 | ✅ 是 |
| `ChatView.tsx:135` | 切换联网搜索 | ✅ 是（可优化为 `saveConfigField`） |
| `App.tsx:169` | 切换模型 | ✅ 是（可优化为 `saveConfigField`） |
| `App.tsx:177` | 切换 agent | ✅ 是（可优化为 `saveConfigField`） |
| `App.tsx:102` | 切换思考深度 | ❌ 否（已用 `saveConfigField`） |

**不需要重启的字段**：`webInfo`、`activeProvider`、`activeModel`、`activeAgent`、`theme`、`thinkingDepth` — 这些只需写 config.json，`send-message` 运行时从 JSON 读取最新值。

**需要重启的变更**：provider 的 apiKey/baseUrl、MCP 服务器、agent 的 prompt/permissions — 这些影响 opencode 服务器的运行时配置。

---

## 其他修复

### DialogTitle accessibility 警告

`ui/dialog.tsx` 自定义的 `DialogTitle` 组件原使用普通 `<h2>`，导致 Radix UI 报 `DialogContent requires a DialogTitle` 警告。

修复：将 `<h2>` 替换为 `<DialogPrimitive.Title>`，类型签名改为 `React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>`。

无功能影响，仅消除 accessibility 警告。

---

## 打开工作目录

### 数据流

```
用户点击左下角 📁 图标
  → SessionSidebar: window.api.openWorkspaceFolder()
    → preload/index.ts: ipcRenderer.invoke('open-workspace-folder')
      → main/index.ts: shell.openPath(workspacePath)
        → Linux: 文件管理器（nautilus/dolphin/etc）
        → Windows: 资源管理器
        → macOS: Finder
```

### 涉及代码

- **main/index.ts**：新增 `open-workspace-folder` IPC handler，使用 `shell.openPath()`
- **preload/index.ts**：新增 `openWorkspaceFolder` IPC 桥
- **preload/index.d.ts**：`Api` 接口新增 `openWorkspaceFolder`
- **SessionSidebar.tsx**：`FolderOpen` 图标加 `onClick` 和 `cursor-pointer`

---

## 已知限制

- V2 API（`opencodeClient.v2.provider.list()`）在当前 opencode v1.16.2 中不可用，统一使用 V1 `provider.list()`
- `variant` 参数是否有效取决于 opencode SDK 对具体 provider 的适配程度
- 自定义 provider 的 `variants` 在 Settings 编辑后才能保存到 config.json
