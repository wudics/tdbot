import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface ProviderConfig {
  name: string
  model: string
  apiKey: string
  baseUrl: string
  modelCfg?: Record<string, any>
}

export interface AgentData {
  id: string
  name: string
  prompt: string
  tools?: Record<string, boolean>
  builtin: boolean
  skillPermissions?: Record<string, string>
  mcpPermissions?: Record<string, string>
  toolPermissions?: Record<string, string>
}

export interface McpServerData {
  name: string
  type: 'local' | 'remote'
  command?: string[]
  url?: string
  env?: string
  enabled: boolean
  permission: 'allow' | 'ask' | 'deny'
}

export interface AppConfig {
  providers: ProviderConfig[]
  activeProvider: string
  activeModel: string
  activeAgent: string
  webInfo: boolean
  theme: 'light' | 'dark'
  skillToggles: Record<string, boolean>
  thinkingDepth: string
  weknoraUrl: string
  weknoraApiKey: string
  agents: AgentData[]
  mcps: McpServerData[]
}

const builtinAgents: AgentData[] = [
  {
    id: 'build', name: '执行模式', prompt: '直接编码实现，无需事先规划。注重执行效率。', builtin: true,
  },
  {
    id: 'plan', name: '规划模式', prompt: '你是一个规划和分析助手。先分析需求、检查现有代码，制定详细方案并列出具体步骤，得到用户确认后再执行。写/编辑/补丁/bash 操作需要用户批准。', builtin: true,
    toolPermissions: { write: 'ask', edit: 'ask', patch: 'ask', bash: 'ask' },
  },
]

const allTools = ['read', 'grep', 'glob', 'bash', 'webfetch', 'websearch', 'write', 'edit', 'patch', 'todowrite']

export function defaultTools(): Record<string, boolean> {
  const t: Record<string, boolean> = {}
  for (const tool of allTools) t[tool] = true
  return t
}

const defaults: AppConfig = {
  providers: [{ name: 'deepseek', model: 'deepseek-v4-flash', apiKey: '', baseUrl: '' }],
  activeProvider: 'deepseek',
  activeModel: 'deepseek-v4-flash',
  activeAgent: 'build',
  webInfo: false,
  theme: 'light',
  skillToggles: {},
  thinkingDepth: '',
  weknoraUrl: '',
  weknoraApiKey: '',
  agents: [],
  mcps: [],
}

function getFilePath(): string {
  const dir = process.cwd()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'config.json')
}

export function loadConfig(): AppConfig {
  try {
    const raw = readFileSync(getFilePath(), 'utf-8')
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export function saveConfig(config: AppConfig): void {
  const existing = loadConfig()
  writeFileSync(getFilePath(), JSON.stringify({ ...existing, ...config }, null, 2), 'utf-8')
}

export function loadAgents(): AgentData[] {
  const config = loadConfig()
  const custom = config.agents || []
  const merged: AgentData[] = []
  for (const b of builtinAgents) {
    const override = custom.find(a => a.id === b.id)
    merged.push(override || b)
  }
  for (const a of custom) {
    if (!builtinAgents.some(b => b.id === a.id)) {
      merged.push(a)
    }
  }
  return merged
}

export function saveAgents(agents: AgentData[]): void {
  const config = loadConfig()
  config.agents = agents
  saveConfig(config)
}

export function loadMcpServers(): McpServerData[] {
  const config = loadConfig()
  return config.mcps || []
}

export function saveMcpServers(servers: McpServerData[]): void {
  const config = loadConfig()
  config.mcps = servers
  saveConfig(config)
}
