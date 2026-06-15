# 自定义 Agent 角色

## 目标

支持创建多个 Agent 角色（如代码审查、写作助手、翻译等），每个 Agent 可配置独立的 System Prompt 和工具权限，在聊天工具栏随时切换，即时生效。

## Agent 数据结构

```typescript
interface AgentData {
  id: string              // "build" | "plan" | "reviewer" | ...
  name: string            // 显示名称
  prompt: string          // System Prompt
  tools?: Record<string, boolean>   // 工具可用性（从 toolPermissions 推导）
  builtin: boolean        // 是否内置（不可删除、不可改权限）
  skillPermissions?: Record<string, string>  // Skills 权限覆盖
  mcpPermissions?: Record<string, string>    // MCP 权限覆盖
  toolPermissions?: Record<string, string>   // 内置工具权限: "allow" | "ask" | "deny" | "inherit"
}
```

### 内置 Agent

| id | name | 说明 | 工具权限 |
|----|------|------|---------|
| `build` | 执行模式 | 默认代理，直接编码执行，不可删除 | 全部遵循全局权限（inherit） |
| `plan` | 规划模式 | 先分析规划再行动，不可删除 | `write/edit/patch/bash` → `ask`，其余 inherit |

内置 Agent 在首次启动时自动插入 SQLite，带 🔒 标识。plan 的 `ask` 权限运行时弹 PermissionCard。

### 自定义 Agent

用户自由添加/编辑/删除，可配置 prompt 和工具权限。

## 工具权限

10 个内置工具，每个 Agent 可独立配置以下权限：

| 选项 | 效果 | 对应 `tools` |
|------|------|-------------|
| **继承（跟随全局）** | 遵循全局 `basePermission`，不做特殊覆盖 | 不修改 |
| **allow** | 工具可用，直接执行 | `true` |
| **ask** | 工具可用，运行时弹卡询问 | `true` + `permission` 写入 `'ask'` |
| **deny** | 工具禁用，Agent 不可见且不可调用 | `false` |

内置 Agent（build/plan）的权限锁定不可更改；自定义 Agent 可自由配置。

## 存储

SQLite `agents` 表：

```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tools TEXT,                -- JSON: {"read":true,"write":false,...}
  builtin INTEGER DEFAULT 0,
  skill_permissions TEXT,    -- JSON: {"skill-name":"allow",...}
  mcp_permissions TEXT,      -- JSON: {"server-name":"ask",...}
  tool_permissions TEXT      -- JSON: {"write":"ask","bash":"deny",...}
);
```

### CRUD 函数

```typescript
loadAgents(): AgentData[]    // 读取所有 agent
saveAgents(agents): void     // 保存 agent 列表（全量替换）
```

## 数据流

```
首次启动 → initDatabase() 插入种子数据（build/plan）
         ↓
App.tsx 加载 agents 列表
  → ChatView 工具栏显示 agent 下拉选择器
  → 切换 agent → 保存 activeAgent 到 config.json
  → 发送消息时 promptAsync({ agent: activeAgent })
```

## 主进程

### restartOpencode

从 DB 读取 agents，`toolPermissions` 转换为 `tools` + `permission`：

```
toolPermissions:
  deny  → tools[tool] = false
  ask   → tools[tool] = true, permission[tool] = 'ask'
  allow → tools[tool] = true, permission[tool] = 'allow'
  inherit → 跳过
```

### send-message

使用当前选中的 agent：

```typescript
const activeAgent = savedConfig.activeAgent || 'build'

await opencodeClient.session.promptAsync({
  sessionID: sessionId,
  agent: activeAgent,
  ...
})
```

## IPC 协议

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `load-agents` | — | `AgentData[]` | 读取所有 agent |
| `save-agents` | `agents[]` | `void` | 保存 agent 列表（会触发 restart） |

## UI 设计

### 设置弹窗 Agent 管理

```
┌─ Agent 列表 ──────────────────────────┐
│                                         │
│ 执行模式 🔒         ✅ 当前  ✏️       │
│ 规划模式 🔒                    ✏️       │
│ 代码审查                      ✏️  🗑️  │
│                                         │
│ [+ 添加 Agent]                          │
│                                         │
│ ← 点击编辑展开 inline 表单：             │
│ ┌─ 编辑 Agent ────────────────────┐    │
│ │ 名称: [代码审查              ]   │    │
│ │ Prompt: [textarea...          ]   │    │
│ │ 工具权限:                        │    │
│ │ 读取 (read)      [继承（跟随全局）▼]   │
│ │ 搜索 (grep)      [继承（跟随全局）▼]   │
│ │ 命令 (bash)      [allow       ▼]      │
│ │ 写入 (write)     [ask         ▼]      │
│ │ ...                              │    │
│ │ [确认] [取消]                    │    │
│ └─────────────────────────────────┘    │
└───────────────────────────────────────┘
```

内置 Agent（build/plan）的所有字段锁定不可编辑。

### 聊天工具栏

```
🧑 [执行模式 ▼]  🌐 互联网搜索 [⬤——○]   🤖 [deepseek/... ▼]
```

切换 agent 即时生效，不重启。

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/db.ts` | 修改 | 删除 `general` 内置 agent；`plan` 添加 `toolPermissions: { write: 'ask', edit: 'ask', patch: 'ask', bash: 'ask' }`；`agents` 表新增 `tool_permissions` 列；`AgentData` 接口新增 `toolPermissions`；`loadAgents`/`saveAgents` 读写新列 |
| `src/main/index.ts` | 修改 | `restartOpencode` agent 构建循环新增 `toolPermissions` → `tools` + `permission` 转换；默认 agent fallback 改为 `'build'` |
| `src/main/configStore.ts` | 修改 | `activeAgent` 默认值 `'general'` → `'build'` |
| `src/renderer/src/components/SettingsDialog.tsx` | 修改 | 工具权限区域：checkbox → dropdown（inherit/allow/ask/deny）；`confirmEditA` 保存时从 `toolPermissions` 推导 `tools`；`AgentItem` 接口新增 `toolPermissions`；内置 agent dropdown 全部 `disabled` |
| `src/renderer/src/App.tsx` | 修改 | 两处 `'general'` 改为 `'build'` |
| `src/preload/index.d.ts` | 修改 | `AgentData` 接口新增 `toolPermissions` |
