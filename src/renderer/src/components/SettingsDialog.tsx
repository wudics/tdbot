import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Plus, Trash2, Check, X, Lock } from 'lucide-react'

interface ProviderItem {
  name: string
  model: string
  apiKey: string
  baseUrl: string
  modelCfg?: Record<string, any>
}

interface AgentItem {
  id: string
  name: string
  prompt: string
  tools?: Record<string, boolean>
  builtin: boolean
  skillPermissions?: Record<string, string>
  mcpPermissions?: Record<string, string>
  toolPermissions?: Record<string, string>
}

interface SkillInfo {
  name: string
  description: string
}

interface SettingsData {
  providers: ProviderItem[]
  activeProvider: string
  activeModel: string
  activeAgent: string
  webInfo: boolean
  theme: 'light' | 'dark'
  skillToggles: Record<string, boolean>
}

const allTools = ['read', 'grep', 'glob', 'bash', 'webfetch', 'websearch', 'write', 'edit', 'patch', 'todowrite']

const toolLabels: Record<string, string> = {
  read: '读取 (read)', grep: '搜索 (grep)', glob: '查找 (glob)', bash: '命令 (bash)',
  webfetch: '抓取 (webfetch)', websearch: '搜索 (websearch)',
  write: '写入 (write)', edit: '编辑 (edit)', patch: '补丁 (patch)', todowrite: '待办 (todowrite)',
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [config, setConfig] = useState<SettingsData>({ providers: [], activeProvider: '', activeModel: '', activeAgent: 'build', webInfo: false, theme: 'light', skillToggles: {} })
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [mcps, setMcps] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // Provider editing
  const [editPIdx, setEditPIdx] = useState<number | null>(null)
  const [editPForm, setEditPForm] = useState<ProviderItem>({ name: '', model: '', apiKey: '', baseUrl: '', modelCfg: undefined })

  // Agent editing
  const [editAIdx, setEditAIdx] = useState<number | null>(null)
  const [editAForm, setEditAForm] = useState<AgentItem>({ id: '', name: '', prompt: '', tools: {}, builtin: false, skillPermissions: {}, mcpPermissions: {} })

  // MCP editing
  const [editMcpIdx, setEditMcpIdx] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      window.api.getConfig().then(setConfig)
      window.api.loadAgents().then(setAgents)
      window.api.loadMcp().then(setMcps)
      window.api.scanSkills().then(list => {
        setSkills(list)
        setConfig(prev => {
          const skillNames = new Set(list.map(s => s.name))
          const toggles: Record<string, boolean> = {}
          for (const s of list) {
            toggles[s.name] = prev.skillToggles?.[s.name] ?? false
          }
          return { ...prev, skillToggles: toggles }
        })
      })
    }
  }, [open])

  // Provider helpers
  const startAddP = () => { setEditPIdx(-1); setEditPForm({ name: '', model: '', apiKey: '', baseUrl: '', modelCfg: undefined }) }
  const startEditP = (i: number) => { setEditPIdx(i); setEditPForm({ ...config.providers[i] }) }
  const cancelEditP = () => setEditPIdx(null)
  const confirmEditP = () => {
    if (!editPForm.name.trim() || !editPForm.model.trim()) return
    const providers = [...config.providers]
    if (editPIdx === -1) providers.push({ ...editPForm })
    else providers[editPIdx!] = { ...editPForm }
    let { activeProvider, activeModel } = config
    if (!activeProvider || !providers.find(p => p.name === activeProvider)) {
      const first = providers[0]
      activeProvider = first?.name || ''; activeModel = first?.model || ''
    }
    setConfig({ ...config, providers, activeProvider, activeModel })
    setEditPIdx(null)
  }
  const removeProvider = (i: number) => {
    const providers = config.providers.filter((_, idx) => idx !== i)
    let { activeProvider, activeModel } = config
    if (!providers.find(p => p.name === activeProvider)) {
      const first = providers[0]
      activeProvider = first?.name || ''; activeModel = first?.model || ''
    }
    setConfig({ ...config, providers, activeProvider, activeModel })
  }

  // Agent helpers
  const startAddA = () => {
    const id = 'agent_' + Date.now()
    setEditAIdx(-1)
    setEditAForm({ id, name: '', prompt: '', tools: defaultTools(), builtin: false, skillPermissions: {}, mcpPermissions: {}, toolPermissions: {} })
  }
  const startEditA = (i: number) => { setEditAIdx(i); setEditAForm({ ...agents[i] }) }
  const cancelEditA = () => setEditAIdx(null)
  const confirmEditA = () => {
    if (!editAForm.name.trim() || !editAForm.prompt.trim()) return
    const form = { ...editAForm }
    if (form.toolPermissions) {
      const toolPerms = { ...form.toolPermissions }
      const hasNonInherit = Object.values(toolPerms).some(v => v !== 'inherit')
      if (hasNonInherit) {
        const newTools: Record<string, boolean> = {}
        for (const tool of allTools) {
          newTools[tool] = toolPerms[tool] !== 'deny'
        }
        const cleanPerms: Record<string, string> = {}
        for (const [k, v] of Object.entries(toolPerms)) {
          if (v !== 'inherit') cleanPerms[k] = v
        }
        form.tools = newTools
        form.toolPermissions = cleanPerms
      } else {
        form.tools = defaultTools()
        form.toolPermissions = undefined
      }
    }
    const list = [...agents]
    if (editAIdx === -1) list.push(form)
    else list[editAIdx!] = form
    setAgents(list)
    setEditAIdx(null)
  }
  const removeAgent = (i: number) => {
    if (agents[i].builtin) return
    setAgents(prev => prev.filter((_, idx) => idx !== i))
  }

  const defaultTools = () => {
    const t: Record<string, boolean> = {}
    for (const tool of allTools) t[tool] = true
    return t
  }

  const handleSave = async () => {
    setSaving(true)
    const currentCfg = await window.api.getConfig()
    await window.api.saveConfig({
      ...currentCfg,
      ...config,
      agents,
      mcps,
      webInfo: currentCfg.webInfo,
    })
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Agent 列表 */}
          <div>
            <Label className="mb-2 block">Agent 列表</Label>
            <div className="space-y-2">
              {agents.map((a, i) => (
                <div key={a.id}>
                  {editAIdx === i ? (
                    <AgentEditForm
                      form={editAForm}
                      onChange={setEditAForm}
                      onCancel={cancelEditA}
                      onConfirm={confirmEditA}
                      skills={skills}
                      mcps={mcps}
                    />
                  ) : (
                    <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate">{a.name}</span>
                        {a.builtin && <Lock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />}
                        {config.activeAgent === a.id && <span className="text-xs text-primary ml-2">✅ 当前</span>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button className="p-1 hover:bg-muted rounded" onClick={() => startEditA(i)} title="编辑">✏️</button>
                        {!a.builtin && (
                          <button className="p-1 hover:bg-muted rounded" onClick={() => removeAgent(i)} title="删除">
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editAIdx === -1 ? (
              <AgentEditForm
                form={editAForm}
                onChange={setEditAForm}
                onCancel={cancelEditA}
                onConfirm={confirmEditA}
                skills={skills}
                mcps={mcps}
              />
            ) : (
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={startAddA}>
                <Plus className="h-4 w-4 mr-1" />添加 Agent
              </Button>
            )}
          </div>

          <hr className="border-border" />

          {/* Provider 列表 */}
          <div>
            <Label className="mb-2 block">Provider 列表</Label>
            <div className="space-y-2">
              {config.providers.map((p, i) => (
                <div key={i}>
                  {editPIdx === i ? (
                    <ProviderEditForm form={editPForm} onChange={setEditPForm} onCancel={cancelEditP} onConfirm={confirmEditP} />
                  ) : (
                    <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-muted-foreground ml-2 truncate">— {p.model}</span>
                        {config.activeProvider === p.name && config.activeModel === p.model && <span className="text-xs text-primary ml-2">✅ 当前</span>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button className="p-1 hover:bg-muted rounded" onClick={() => startEditP(i)} title="编辑">✏️</button>
                        <button className="p-1 hover:bg-muted rounded" onClick={() => removeProvider(i)} title="删除">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editPIdx === -1 ? (
              <ProviderEditForm form={editPForm} onChange={setEditPForm} onCancel={cancelEditP} onConfirm={confirmEditP} />
            ) : (
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={startAddP}>
                <Plus className="h-4 w-4 mr-1" />添加 Provider
              </Button>
            )}
          </div>

          <hr className="border-border" />

          {/* Skills 列表 */}
          {skills.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Skills 列表</Label>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 border border-border rounded"
                    onClick={() => {
                      const toggles: Record<string, boolean> = {}
                      for (const s of skills) toggles[s.name] = true
                      setConfig({ ...config, skillToggles: toggles })
                    }}
                  >全开</button>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 border border-border rounded"
                    onClick={() => {
                      const toggles: Record<string, boolean> = {}
                      for (const s of skills) toggles[s.name] = false
                      setConfig({ ...config, skillToggles: toggles })
                    }}
                  >全关</button>
                </div>
              </div>
              <div className="space-y-1">
                {skills.map(s => (
                  <div key={s.name} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-xs">{s.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs line-clamp-2">{s.description}</span>
                    </div>
                    <button
                      type="button"
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${config.skillToggles[s.name] ? 'bg-primary' : 'bg-input'}`}
                      onClick={() => setConfig({ ...config, skillToggles: { ...config.skillToggles, [s.name]: !config.skillToggles[s.name] } })}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-background transition-transform ${config.skillToggles[s.name] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr className="border-border" />

          {/* MCP 服务器列表 */}
          <div>
            <Label className="mb-2 block">MCP 服务器</Label>
            <div className="space-y-2">
              {mcps.map((m, i) => (
                <div key={m.name}>
                  {editMcpIdx === i ? (
                    <MCPEditForm
                      initialValues={m}
                      onSave={(data) => {
                        const list = mcps.map((x, j) => j === i ? data : x)
                        setMcps(list)
                        setEditMcpIdx(null)
                      }}
                      onCancel={() => setEditMcpIdx(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs">{m.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{m.type === 'local' ? 'local' : 'remote'}</span>
                        <span className={`ml-2 text-xs ${m.enabled ? 'text-green-500' : 'text-muted-foreground'}`}>{m.enabled ? '✅ 已启用' : '❌ 已禁用'}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button className="p-1 hover:bg-muted rounded text-xs" onClick={() => {
                          const list = mcps.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x)
                          setMcps(list)
                        }} title={m.enabled ? '禁用' : '启用'}>
                          {m.enabled ? '⏸' : '▶️'}
                        </button>
                        <button className="p-1 hover:bg-muted rounded" onClick={() => setEditMcpIdx(i)} title="编辑">✏️</button>
                        <button className="p-1 hover:bg-muted rounded" onClick={() => setMcps(mcps.filter((_, j) => j !== i))} title="删除">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editMcpIdx === null && <MCPEditForm onSave={(m) => setMcps([...mcps, m])} />}
          </div>

          <hr className="border-border" />

          {/* 主题切换 */}
          <div className="flex items-center justify-between py-2">
            <Label>🌙 深色模式</Label>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.theme === 'dark' ? 'bg-primary' : 'bg-input'}`}
              onClick={() => setConfig({ ...config, theme: config.theme === 'dark' ? 'light' : 'dark' })}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white dark:bg-background transition-transform ${config.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <hr className="border-border" />

          {/* WeKnora 配置 */}
          <div className="space-y-3">
            <Label>WeKnora 配置</Label>
            <Input
              value={config.weknoraUrl || ''}
              onChange={e => setConfig({ ...config, weknoraUrl: e.target.value })}
              placeholder="http://localhost:8080"
            />
            <Input
              type="password"
              value={config.weknoraApiKey || ''}
              onChange={e => setConfig({ ...config, weknoraApiKey: e.target.value })}
              placeholder="API Key"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存并重启'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Provider inline edit form
function ProviderEditForm({ form, onChange, onCancel, onConfirm }: {
  form: ProviderItem; onChange: (f: ProviderItem) => void; onCancel: () => void; onConfirm: () => void
}) {
  const [cfgRaw, setCfgRaw] = useState(() =>
    form.modelCfg && typeof form.modelCfg === 'object'
      ? JSON.stringify(form.modelCfg, null, 2)
      : ''
  )
  const [cfgValid, setCfgValid] = useState(() => {
    if (!cfgRaw.trim()) return true
    try { JSON.parse(cfgRaw); return true } catch { return false }
  })
  const handleCfgChange = (val: string) => {
    setCfgRaw(val)
    if (!val.trim()) {
      setCfgValid(true)
      onChange({ ...form, modelCfg: undefined })
      return
    }
    try {
      const parsed = JSON.parse(val)
      setCfgValid(true)
      onChange({ ...form, modelCfg: parsed })
    } catch {
      setCfgValid(false)
    }
  }
  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <Input value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} placeholder="名称" />
      <Input value={form.model} onChange={e => onChange({ ...form, model: e.target.value })} placeholder="model-id" />
      <Input type="password" value={form.apiKey} onChange={e => onChange({ ...form, apiKey: e.target.value })} placeholder="API Key" />
      <Input value={form.baseUrl} onChange={e => onChange({ ...form, baseUrl: e.target.value })} placeholder="Base URL（可选）" />
      <div>
        <Label className="text-xs mb-1 block">模型高级配置 (JSON)  {cfgValid ? '✅ 格式正确' : '❌ JSON 格式错误'}</Label>
        <textarea
          value={cfgRaw}
          onChange={e => handleCfgChange(e.target.value)}
          placeholder='{ "attachment": true, "modalities": { "input": ["text", "image"], "output": ["text"] } }'
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">📖 配置参考（点击展开）</summary>
        <pre className="mt-2 p-2 bg-background rounded border overflow-x-auto text-[10px] leading-relaxed">
{`{
  // === 核心能力 (设置 true 启用, false 关闭) ===
  "attachment": false,    // 文件附件 (图片等)
  "reasoning": true,     // 思考过程展示
  "temperature": true,    // 温度调节
  "tool_call": true,      // 工具/函数调用

  // === 输入输出模态 (不设则默认为仅文本) ===
  "modalities": {
    "input": ["text", "image", "audio", "video", "pdf"],
    "output": ["text"]
  },

  // === 变体模式 (如思考深度切换) ===
  "variants": {
    "none": {},
    "high": { "options": { "thinking": { "type": "high" } } }
  },

  // === 模型参数限制 ===
  "limit": {
    "context": 128000,    // 上下文窗口 (tokens)
    "output": 4096        // 输出限制 (tokens)
  },

  // === 额外参数 (透传给 API) ===
  "options": { "temperature": 0.7, "max_tokens": 4096 },

  // === 自定义请求头 ===
  "headers": { "X-Custom": "value" }
}`}
        </pre>
      </details>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}><X className="h-3 w-3 mr-1" />取消</Button>
        <Button size="sm" onClick={onConfirm}><Check className="h-3 w-3 mr-1" />确认</Button>
      </div>
    </div>
  )
}

// MCP inline add/edit form
function MCPEditForm({ onSave, initialValues, onCancel }: { onSave: (m: any) => void; initialValues?: any; onCancel?: () => void }) {
  const [open, setOpen] = useState(!!initialValues)
  const [name, setName] = useState(initialValues?.name || '')
  const [type, setType] = useState<'local' | 'remote'>(initialValues?.type || 'local')
  const [command, setCommand] = useState(initialValues?.command ? initialValues.command.join(' ') : '')
  const [url, setUrl] = useState(initialValues?.url || '')
  const [env, setEnv] = useState(initialValues?.env || '')
  const [permission, setPermission] = useState(initialValues?.permission || 'allow')
  const isEdit = !!initialValues

  if (!open) {
    return <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setOpen(true)}>
      <Plus className="h-4 w-4 mr-1" />添加 MCP 服务器
    </Button>
  }

  const handleSave = () => {
    if (!name.trim()) return
    const data: any = { name: name.trim(), type, enabled: initialValues?.enabled ?? true, permission }
    if (type === 'local') {
      data.command = command.trim().split(/\s+/)
    } else {
      data.url = url.trim()
    }
    if (env.trim()) data.env = env.trim()
    onSave(data)
    if (!isEdit) {
      setOpen(false)
      setName(''); setCommand(''); setUrl(''); setEnv(''); setPermission('allow')
    }
  }

  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30 mt-2">
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="名称" disabled={isEdit} />
      <div className="flex gap-2">
        <button
          className={`text-xs px-2 py-1 rounded border ${type === 'local' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          onClick={() => setType('local')}>Local</button>
        <button
          className={`text-xs px-2 py-1 rounded border ${type === 'remote' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          onClick={() => setType('remote')}>Remote</button>
      </div>
      {type === 'local' ? (
        <Input value={command} onChange={e => setCommand(e.target.value)} placeholder="npx -y @mcp/server /path" />
      ) : (
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://mcp-server.example.com" />
      )}
      <textarea
        value={env}
        onChange={e => setEnv(e.target.value)}
        placeholder='环境变量 JSON (可选) {}'
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div>
        <Label className="text-xs mb-1 block">权限</Label>
        <select
          value={permission}
          onChange={e => setPermission(e.target.value)}
          className="text-xs bg-transparent border border-input rounded px-1.5 py-1 w-full"
        >
          <option value="allow">全部允许</option>
          <option value="ask">需要确认</option>
          <option value="deny">全部拒绝</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => { if (onCancel) onCancel(); else setOpen(false) }}><X className="h-3 w-3 mr-1" />取消</Button>
        <Button size="sm" onClick={handleSave}><Check className="h-3 w-3 mr-1" />{isEdit ? '保存' : '添加'}</Button>
      </div>
    </div>
  )
}

function AgentEditForm({ form, onChange, onCancel, onConfirm, skills, mcps }: {
  form: AgentItem; onChange: (f: AgentItem) => void; onCancel: () => void; onConfirm: () => void
  skills?: SkillInfo[]; mcps?: any[]
}) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <Input
        value={form.name}
        onChange={e => onChange({ ...form, name: e.target.value })}
        placeholder="名称"
        disabled={form.builtin}
      />
      <textarea
        value={form.prompt}
        onChange={e => onChange({ ...form, prompt: e.target.value })}
        placeholder="System Prompt"
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div>
        <Label className="text-xs mb-1 block">工具权限</Label>
        <div className="grid grid-cols-1 gap-0.5">
          {allTools.map(tool => (
            <div key={tool} className="flex items-center justify-between text-xs">
              <span>{toolLabels[tool] || tool}</span>
              <select
                value={form.toolPermissions?.[tool] || 'inherit'}
                onChange={e => onChange({ ...form, toolPermissions: { ...form.toolPermissions, [tool]: e.target.value } })}
                disabled={form.builtin}
                className="bg-transparent border border-input rounded px-1 py-0.5 text-xs max-w-[120px]"
              >
                <option value="inherit">继承（跟随全局）</option>
                <option value="allow">allow</option>
                <option value="ask">ask</option>
                <option value="deny">deny</option>
              </select>
            </div>
          ))}
        </div>
      </div>
      {skills && skills.length > 0 && (
        <div>
          <Label className="text-xs mb-1 block">Skills 权限</Label>
          <div className="space-y-1">
              {skills.map(s => {
              const perm = form.skillPermissions?.[s.name] || 'inherit'
              return (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="truncate mr-2">{s.name}</span>
                  <select
                    value={perm}
                    onChange={e => onChange({ ...form, skillPermissions: { ...form.skillPermissions, [s.name]: e.target.value } })}
                    className="bg-transparent border border-input rounded px-1 py-0.5 text-xs"
                  >
                    <option value="inherit">继承（跟随全局）</option>
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {mcps && mcps.length > 0 && (
        <div>
          <Label className="text-xs mb-1 block">MCP 权限</Label>
          <div className="space-y-1">
              {mcps.map(m => {
              const perm = form.mcpPermissions?.[m.name] || 'inherit'
              return (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <span className="truncate mr-2">{m.name}</span>
                  <select
                    value={perm}
                    onChange={e => onChange({ ...form, mcpPermissions: { ...form.mcpPermissions, [m.name]: e.target.value } })}
                    className="bg-transparent border border-input rounded px-1 py-0.5 text-xs"
                  >
                    <option value="inherit">继承（跟随全局）</option>
                    <option value="allow">allow</option>
                    <option value="ask">ask</option>
                    <option value="deny">deny</option>
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}><X className="h-3 w-3 mr-1" />取消</Button>
        <Button size="sm" onClick={onConfirm}><Check className="h-3 w-3 mr-1" />确认</Button>
      </div>
    </div>
  )
}
