# Agent 工具权限

## 目标

每个 Agent 可以独立配置 Skills 和 MCP 权限，覆盖全局设置。未设置的权限继承全局规则。

## 数据模型

### AgentData

```typescript
export interface AgentData {
  id: string
  name: string
  prompt: string
  tools?: Record<string, boolean>          // 内置工具（已有）
  builtin: boolean
  skillPermissions?: Record<string, string> // { "git-release": "allow" | "deny" | "inherit" }
  mcpPermissions?: Record<string, string>   // { "filesystem": "allow" | "ask" | "deny" | "inherit" }
}
```

### SQLite

`agents` 表新增两列：

```sql
ALTER TABLE agents ADD COLUMN skill_permissions TEXT;  -- JSON: { "skill-name": "allow", ... }
ALTER TABLE agents ADD COLUMN mcp_permissions TEXT;    -- JSON: { "server-name": "deny", ... }
```

## 权限继承体系

```
用户请求 AI 使用某个 skill/MCP
  → 优先检查当前 agent 的 skillPermissions / mcpPermissions
    → 如果设为 allow/deny/ask，按此执行
    → 如果设为 inherit（或未设置），回退到全局权限
```

Agent 级别的 `permission` 会**覆盖**全局 `permission`。实现方式为深度合并：

```typescript
const basePermission = {
  websearch: 'allow',
  webfetch: 'allow',
  read: 'allow',
  edit: 'allow',
  glob: 'allow',
  grep: 'allow',
  list: 'allow',
  external_directory: 'deny',
  ...mcpPermissions,       // 全局 MCP 权限（如 mcp__weknora__*: 'allow'）
  skill: globalSkillPerm,   // 全局 Skills 权限
}

// agent 覆盖
const mergedPermission = { ...basePermission, ...agentOverrides }
```

## 配置生成

`restartOpencode` 中先构建全局权限基础，再为每个 agent 叠加覆盖：

```typescript
// 构建全局 permission 基础
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
if (globalSkillPerm) basePermission.skill = globalSkillPerm

// 为每个 agent 构建配置
for (const a of agentList) {
  const agentOverrides: Record<string, any> = {}
  const agentTools = { ...(a.tools || defaultTools()) }

  // toolPermissions: 覆盖全局工具权限（ask/deny/allow）
  if (a.toolPermissions) {
    for (const [tool, perm] of Object.entries(a.toolPermissions)) {
      if (perm === 'deny') {
        agentTools[tool] = false
      } else if (perm === 'ask' || perm === 'allow') {
        agentTools[tool] = true
        agentOverrides[tool] = perm
      }
    }
  }

  if (a.skillPermissions) {
    const skills: Record<string, string> = {}
    for (const [k, v] of Object.entries(a.skillPermissions)) {
      if (v !== 'inherit') skills[k] = v
    }
    if (Object.keys(skills).length > 0) agentOverrides.skill = skills
  }

  if (a.mcpPermissions) {
    for (const [k, v] of Object.entries(a.mcpPermissions)) {
      if (v !== 'inherit') agentOverrides['mcp__' + k + '__*'] = v
    }
  }

  agentConfig[a.id] = {
    prompt: a.prompt,
    tools: agentTools,
    ...(Object.keys(agentOverrides).length > 0
      ? { permission: { ...basePermission, ...agentOverrides } }
      : {}),
  }
}
```

未设置自定义权限的 agent 不传 `permission` 字段，完全继承全局。

## UI 设计

Agent 编辑表单底部新增两个区域：

### Skills 权限

```
┌─ Skills 权限 ────────────────────┐
│ git-release    [继承（跟随全局）▼] │
│                ├ 继承（跟随全局）  │
│                ├ allow            │
│                └ deny             │
│ code-review    [allow ▼]          │
│ deploy         [deny ▼]           │
└──────────────────────────────────┘
```

### MCP 权限

```
┌─ MCP 权限 ──────────────────────┐
│ filesystem     [继承（跟随全局）▼] │
│                ├ 继承（跟随全局）  │
│                ├ allow            │
│                ├ ask              │
│                └ deny             │
│ playwright     [allow ▼]          │
└──────────────────────────────────┘
```

Skills 和 MCP 列表从当前全局状态读取，通过 props 传入 `AgentEditForm`。

## 删除行为

| 删除目标 | agent 中的关联数据 | 影响 |
|---------|------------------|------|
| Skills 文件（磁盘） | `skillPermissions` 残存孤立数据 | ❌ 无影响，opencode 忽略 |
| MCP 服务器（UI） | `mcpPermissions` 残存孤立数据 | ❌ 无影响，opencode 忽略 |
| Agent（UI） | 整行删除（`saveAgents` 全量替换） | ✅ 无残留 |

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/db.ts` | 修改 | `AgentData` 新增 `skillPermissions` / `mcpPermissions`；`agents` 表 ALTER TABLE 新增两列；`loadAgents` / `saveAgents` 读写新字段 |
| `src/main/index.ts` | 修改 | 将 MCP 配置构建移到 agent 构建之前；新增 `basePermission` 全局权限基础；agent 构建时叠加 `agentOverrides` 生成 per-agent `permission`；全局 permission 改用 `basePermission`；移除重复的 MCP 配置代码 |
| `src/renderer/src/components/SettingsDialog.tsx` | 修改 | `AgentItem` 接口扩展；`AgentEditForm` 组件新增 Skills + MCP 权限区域（`select` 下拉选择器，含 `inherit` / `allow` / `deny` / `ask` 选项） |
