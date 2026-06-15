# Skills 和 MCP 加载管理

## Skills

### Skills 目录结构

```
项目根目录/skills/
├── git-release/
│   └── SKILL.md        → name: git-release, 描述: 创建发布和变更日志
├── code-review/
│   └── SKILL.md        → name: code-review, 描述: 代码审查
└── deploy/
    └── SKILL.md        → name: deploy, 描述: 部署自动化
```

每个 SKILL.md 必须包含 YAML frontmatter：

```markdown
---
name: git-release
description: Create consistent releases and changelogs
---

## What I do
...
```

| frontmatter 字段 | 必填 | 说明 |
|-----------------|------|------|
| `name` | ✅ | 技能名称，仅小写字母和数字，可用连字符 |
| `description` | ✅ | 技能描述，1-1024 字符 |
| `license` | ❌ | 许可证 |
| `metadata` | ❌ | 自定义元数据 |

### 加载流程

```
opencode 启动
  → restartOpencode 中配置 skills.paths: ['./skills']
  → opencode 扫描 ./skills/ 目录下的 SKILL.md
  → AI 调用 skill 工具发现可用技能
  → AI 通过 skill({ name: "git-release" }) 按需加载
```

Skills 文件存在磁盘上，**不在数据库里**。只有开关状态（`skillToggles`）存在 `config.json` 中。

### 权限控制

`restartOpencode` 根据 `config.skillToggles` 生成 `permission.skill` 配置：

```typescript
permission: {
  skill: Object.keys(config.skillToggles).length > 0
    ? { '*': 'deny', ...Object.fromEntries(
        Object.entries(config.skillToggles).map(([k, v]) => [k, v ? 'allow' : 'deny'])
      ) }
    : undefined,
}
```

- **默认 `*: deny`** — 所有技能默认对 AI 禁用
- **开启的技能 `allow`** — 只有用户打开开关的技能对 AI 可见
- 如果没有任何技能配置（`skillToggles` 为空），不设置 `permission.skill`

### 扫描技能

`scan-skills` IPC handler 读取 `skills/` 目录下的所有 `SKILL.md`，解析 YAML frontmatter：

```typescript
ipcMain.handle('scan-skills', () => {
  const skillsDir = join(process.cwd(), 'skills')
  if (!existsSync(skillsDir)) return []
  const skills = []
  for (const dir of readdirSync(skillsDir)) {
    const skillFile = join(skillsDir, dir, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    const content = readFileSync(skillFile, 'utf-8')
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) continue
    const frontmatter = yaml.load(match[1])
    if (frontmatter?.name && frontmatter?.description) {
      skills.push({ name: frontmatter.name, description: frontmatter.description })
    }
  }
  return skills
})
```

---

## MCP 服务器

### 存储

SQLite `mcp_servers` 表：

```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'local' | 'remote'
  command TEXT,                -- JSON 数组，local 命令
  url TEXT,                    -- remote URL
  env TEXT,                    -- JSON 环境变量
  enabled INTEGER DEFAULT 1,
  permission TEXT DEFAULT 'allow'  -- 'allow' | 'ask' | 'deny'
);
```

### 数据模型

```typescript
interface McpServerData {
  name: string
  type: 'local' | 'remote'
  command?: string[]       // local 命令数组
  url?: string             // remote URL
  env?: string             // JSON 字符串
  enabled: boolean
  permission: 'allow' | 'ask' | 'deny'
}
```

### 配置生成

`restartOpencode` 从 DB 读取 MCP 列表，构建 `config.mcp` 和 `permission`：

```typescript
const mcpList = loadMcpServers()
const mcpConfig: Record<string, any> = {}
const mcpPermissions: Record<string, string> = {}

for (const s of mcpList) {
  if (s.type === 'local') {
    mcpConfig[s.name] = { type: 'local', command: s.command, enabled: s.enabled }
  } else {
    mcpConfig[s.name] = { type: 'remote', url: s.url, enabled: s.enabled }
  }
  if (s.permission && s.permission !== 'allow') {
    mcpPermissions[s.name + '_*'] = s.permission
  }
}

config: {
  mcp: Object.keys(mcpConfig).length > 0 ? mcpConfig : undefined,
  permission: {
    ...mcpPermissions,
    // websearch, bash, external_directory, skill 不变
  },
}
```

### 权限管理

MCP 服务器暴露形如 `{服务器名}_{工具名}` 的工具，通过 permission 通配符控制：

| permission 值 | 行为 |
|--------------|------|
| `allow` | 所有工具允许（默认，不生成权限规则） |
| `ask` | 工具调用前需用户确认 → 生成 `{服务器名}_*: "ask"` |
| `deny` | 所有工具拒绝 → 生成 `{服务器名}_*: "deny"` |

### UI 设计

#### Skills 区域

```
┌─ Skills 列表 ──────────── [全开] [全关] ─┐
│                                            │
│ ❌ git-release  创建发布和变更日志          │
│ ❌ code-review  代码审查                   │
│ ❌ deploy       部署自动化                 │
│                                            │
└────────────────────────────────────────────┘
```

- 新扫描的技能默认关闭
- 已删除的技能文件对应的 toggle 记录自动清理
- 描述最多 2 行，超出 `...`

扫描回调中自动过滤已删除的技能：

```typescript
window.api.scanSkills().then(list => {
  setSkills(list)
  setConfig(prev => {
    const toggles: Record<string, boolean> = {}
    for (const s of list) {
      toggles[s.name] = prev.skillToggles?.[s.name] ?? false
    }
    return { ...prev, skillToggles: toggles }
  })
})
```

#### MCP 区域

```
┌─ MCP 服务器 ─────────────────────────────┐
│                                           │
│ filesystem  local  ✅ 已启用  [⏸] [✏️] [🗑️]│
│ playwright  local  ❌ 已禁用  [▶️] [✏️] [🗑️]│
│                                           │
│ [+ 添加 MCP 服务器]                       │
│                                           │
│ ← 点击 ✏️ 展开编辑 inline 表单：           │
│ ┌─ 编辑 MCP ─────────────────────────┐   │
│ │ [名称（不可修改）]                    │   │
│ │ [Local] [Remote]                   │   │
│ │ [命令 / URL                ]       │   │
│ │ [环境变量 JSON (可选)      ]       │   │
│ │ 权限: [全部允许 ▼]                 │   │
│ │ [取消] [保存]                      │   │
│ └────────────────────────────────────┘   │
│                                           │
│ ← 点击添加展开的 inline 表单相同：         │
│ ┌─ 添加 MCP ─────────────────────────┐   │
│ │ ...按钮文字显示"添加"                │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

- 编辑时名称不可修改（作为 MCP 服务器的唯一标识）
- 编辑模式下不显示底部的「添加 MCP 服务器」按钮

### 保存流程

设置弹窗的「保存并重启」按钮会依次：

1. `saveAgents()` → 保存 Agent 列表到 SQLite
2. `saveMcp()` → 保存 MCP 列表到 SQLite
3. `saveConfig()` → 保存 `config.json`（含 providers/skillToggles/theme 等）
4. `restartOpencode()` → 应用全部配置

---

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 新增 `js-yaml` 依赖 |
| `src/main/db.ts` | 修改 | 新增 `mcp_servers` 表 + `loadMcpServers()` / `saveMcpServers()` |
| `src/main/configStore.ts` | 修改 | `AppConfig` 新增 `skillToggles: Record<string, boolean>` |
| `src/main/index.ts` | 修改 | 新增 `scan-skills` IPC handler；新增 `load-mcp` / `save-mcp` IPC handler；`restartOpencode` 加 `skills.paths: ['./skills']` + `config.mcp` + `permission.skill` + `permission.{MCP}_*` |
| `src/renderer/src/components/SettingsDialog.tsx` | 修改 | 新增 Skills 区域（开关列表 + 全开/全关按钮）；新增 MCP 区域（inline 添加/编辑表单 + 启用/禁用/删除 + ✏️ 编辑按钮） |
| `src/preload/index.ts` | 修改 | 新增 `scanSkills`、`loadMcp`、`saveMcp` IPC |
| `src/preload/index.d.ts` | 修改 | 更新类型 |
