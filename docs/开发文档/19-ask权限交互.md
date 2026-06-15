# Ask 权限交互

## 概述

为 app 增加了**运行时权限询问**能力。当 Agent 尝试使用设置了 `ask` 权限的工具时，服务端发出 `permission.asked` 事件，UI 弹出权限卡片，用户选择"允许一次"/"始终允许"/"拒绝"后 Agent 继续执行。

## 数据流

```
Agent 尝试使用工具（如写入 /tmp/opencode/）
  → opencode 服务端检查 permission → 'ask'
  → 服务端 emit `permission.asked` SSE 事件
  → main/index.ts: SSE 循环捕获事件
    → mainWindow.webContents.send('stream-permission', { id, action, resources })
  → preload: stream-permission → onPermission callback
  → useChat: onPermission 回调
    → 检查 sessionScopedAlways 缓存（见下文）
    → 未命中 → setPermissions → 渲染 PermissionCard
  → 用户点击按钮
    → replyPermission(id, 'once' | 'always' | 'reject')
    → useChat: 若是 'always'，存入 sessionScopedAlways；实际调用 'once'
    → main/index.ts: reply-permission IPC
      → opencodeClient.permission.reply({ requestID, reply })
    → 服务端放行或拒绝工具调用
    → Agent 继续执行
```

## 涉及代码

### main/index.ts

- `permission.asked` 事件处理（SSE 循环）：捕获事件，提取 `properties.permission` / `properties.patterns`，发送 `stream-permission` IPC 到渲染层
- `reply-permission` IPC handler：调用 `opencodeClient.permission.reply({ requestID, reply })`，`reply` 只传 `'once'` / `'reject'`（`'always'` 由客户端缓存模拟，不传给服务端）

### preload/index.ts + index.d.ts

- `replyPermission(id, reply)` IPC 桥
- `onPermission(callback)` 事件桥，监听 `stream-permission`

### useChat.ts

- `PermissionPrompt` 接口：`{ id, action, resources }`
- `permissions` state：当前显示的权限卡片列表
- `permissionsRef` ref：用于 `replyPermission` 中根据 id 查找 action/resources
- `sessionScopedAlways`（模块级 `Map<sessionId, Set<string>>`）：会话级别"始终允许"缓存
  - key 格式：`"action:resource"`（如 `"external_directory:/tmp/opencode/*"`）
  - 模块级变量（非 `useRef`），因 `ChatView` 使用 `key={activeId}` 导致切换会话时 React remount 组件，`useRef` 会被重置
  - 切换会话时缓存保留，关闭 app 后自动清空
- `replyPermission(id, reply)`：
  - `'always'`：存入 `sessionScopedAlways`，实际向服务端发 `'once'`
  - `'once'` / `'reject'`：直接转发
  - 从 `permissionsRef` 移除对应项
- `onPermission` 回调：先查 `sessionScopedAlways` 缓存，命中则自动 `'once'` 回复；未命中则显示卡片
- `setSessionId`：不清理缓存（切换会话保留）
- `clearMessages`：仅清理当前会话的缓存

### PermissionCard.tsx

三个按钮：
- ✅ 允许一次 → `onReply(id, 'once')`
- 🔄 始终允许 → `onReply(id, 'always')`
- ❌ 拒绝 → `onReply(id, 'reject')`

### ChatView.tsx

- 从 `useChat` 解构 `permissions` 和 `replyPermission`
- 在 `ScrollArea` 中 messages 列表后渲染 `PermissionCard`

## 权限配置

```typescript
const basePermission: Record<string, any> = {
  websearch: 'allow',
  webfetch: 'allow',
  read: 'allow',
  edit: 'allow',
  glob: 'allow',
  grep: 'allow',
  list: 'allow',
  external_directory: 'deny',
  ...mcpPermissions,
}
```

- 只对 `external_directory` 设 `ask`（因测试时发现 tools 调用先检查 external_directory，而非 bash）
- 白名单工具（read/edit/glob/grep/list/websearch/webfetch）设 `allow`，避免频繁弹卡

## 关键设计决策

| 决策 | 说明 |
|------|------|
| 不传 `always` 给服务端 | 服务端的 `'always'` 跨会话持久化，不符合用户体验 |
| 模块级 `Map` 而非 `useRef` | `ChatView` 用 `key={activeId}` 导致 React 每次切换会话 remount，`useRef` 重置 |
| 缓存 key = `action:resource` | 资源精确匹配；resources 为空时用 `*` 占位，如 `bash:*` |
| 关闭 app 后清空 | 缓存存内存中，重启消失，符合安全预期 |

## 工具权限配置（toolPermissions）

每个 Agent 的 `toolPermissions` 字段控制内置工具的权限行为，在 `restartOpencode` 中转换为 opencode 的 `tools` + `permission` 配置：

```
toolPermissions:
  deny  → tools[tool] = false            （禁用，Agent 不可见）
  ask   → tools[tool] = true, permission[tool] = 'ask'  （弹卡）
  allow → tools[tool] = true, permission[tool] = 'allow'（直接执行）
  inherit → 跳过                         （跟随全局 basePermission）
```

### 内置 Plan Agent

plan 模式预置了 `toolPermissions`：
```typescript
{ write: 'ask', edit: 'ask', patch: 'ask', bash: 'ask' }
```
即读取/搜索类工具正常执行，修改类操作弹 PermissionCard。

### UI 配置

设置弹窗 Agent 编辑表单中，工具权限区域为下拉选择器：

```
读取 (read)     [继承（跟随全局）▼]
搜索 (grep)     [继承（跟随全局）▼]
命令 (bash)     [allow       ▼]
写入 (write)    [ask         ▼]
编辑 (edit)     [ask         ▼]
补丁 (patch)    [ask         ▼]
待办 (todowrite)[继承（跟随全局）▼]
```

内置 Agent（build/plan）的下拉框锁定不可改。

### PermissionCard 位置

PermissionCard 渲染在 `ScrollArea` 外部（消息列表与工具栏之间），不被 streaming 内容推出可视区。出现时带 `fade-in` 动画，始终可见。

### 全局 permission 覆盖范围

`basePermission` 对内置工具的覆盖：
- `websearch` / `webfetch` / `read` / `edit` / `glob` / `grep` / `list` → `'allow'`
- `external_directory` → `'deny'`
- `bash` / `write` / `todowrite` / `patch` → 未设置（取决于 opencode 默认值，通常等同 `allow`）

## 已知限制

- 只支持 `external_directory` 的 `ask` 交互；其他工具（bash/read/edit 等）设为 `allow` 或 `deny`，不弹卡
- `sessionScopedAlways` 只精确匹配首个 resource；多 resource 请求需逐个匹配（当前场景单一，未处理）
- 删除会话时未清理对应缓存（不影响功能，重启后消失）

## saveConfigField 优化

将不需要重启 server 的配置字段从 `saveConfig` 切换到 `saveConfigField`，避免不必要的 `restartOpencode`。

### 切换清单

| 字段 | 位置 | 原因 |
|------|------|------|
| `activeProvider` / `activeModel` | `App.tsx: onModelChange` | `send-message` 中通过 `loadConfig()` 实时读取传给 `promptAsync` |
| `activeAgent` | `App.tsx: onAgentChange` | 同上 |
| `webInfo` | `ChatView.tsx: toggleSearch` | 同上 |
| `theme` | `SettingsDialog.tsx: handleSave` | 纯渲染层，`applyTheme()` 直接操作 DOM |
| `skillToggles` | `SettingsDialog.tsx: handleSave` | 只需持久化，重启时从磁盘读取 |

### 仍需要重启的配置

| 字段/操作 | 原因 |
|-----------|------|
| `providers[]` (API Key/Base URL) | `createOpencode` 的 `provider` 参数 |
| Agent 列表 / MCP 服务器列表 | `createOpencode` 的 `agent` / `mcp` / `permission` 参数 |
| `weknoraUrl` / `weknoraApiKey` | WeKnora MCP 在 `restartOpencode` 中动态注册 |

## 依赖关系

- 需要 opencode CLI 1.17.4+（服务端通过 `opencode serve` 子进程启动，经 `OPENCODE_CONFIG_CONTENT` 环境变量接收配置）
- SDK 事件类型为 `permission.asked`（非 `permission.v2.asked`），reply 方法为 `opencodeClient.permission.reply({ requestID, reply })`

## 权限与 token 消耗分析

Skill 和 MCP 工具在 `restartOpencode` 中始终注册到 opencode 服务端（`skills: { paths: ['./skills'] }` / `mcp: mcpConfig`），权限只控制模型能否**执行**，不控制工具定义是否加载。

### 场景分析

| 全局 (skillToggles/mcp.permission) | Agent 覆盖 (skillPermissions/mcpPermissions) | 工具定义是否入上下文 | token 消耗 |
|---|---|---|---|---|
| 开 (allow) | 继承 (inherit) | ✅ 已注册 → 入上下文 | 消耗（工具定义几十～几百 token） |
| 关 (deny) | 开 (allow) | ✅ 已注册 → 入上下文 | 消耗（agent override 将权限提升为 allow） |
| 开 (allow) | 关 (deny) | ✅ 已注册 → 入上下文 | 消耗（权限 deny 只阻止执行，不阻止加载） |
| 关 (deny) | 关 (deny) | ✅ 已注册 → 入上下文 | 消耗（与上同理，注册早于权限判断） |

### 原因

所有场景下工具定义均已注册到 opencode 服务端（skill 从 `./skills` 目录加载，MCP 通过 `mcpConfig` 连接），opencode 将可用工具定义附加到模型上下文中，模型能看到所有已注册的工具定义（name、description、parameters）。权限（allow/ask/deny）仅控制调用阶段是否放行，无法减少上下文中的工具定义数量。

### 建议

- Skill/MCP 数量较多时，工具定义占用的 context 不可忽略
- 如需精确控制单次会话的工具列表，可通过 `promptAsync` 的 `tools` 参数（当前仅覆盖 websearch/webfetch）
- 可在 `restartOpencode` 中根据权限提前过滤：`permission: 'deny'` 的工具不注册到 opencode，但目前未实现
