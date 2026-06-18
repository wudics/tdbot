interface SessionMeta {
  id: string
  title: string
  createdAt: string
}

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  files?: { id: string; filename: string; mime: string; url: string }[]
  reasoning?: string
  tools?: any[]
  createdAt: string
}

interface ProviderConfigData {
  name: string
  model: string
  apiKey: string
  baseUrl: string
  modelCfg?: Record<string, any>
}

interface AgentData {
  id: string
  name: string
  prompt: string
  tools?: Record<string, boolean>
  builtin: boolean
  skillPermissions?: Record<string, string>
  mcpPermissions?: Record<string, string>
  toolPermissions?: Record<string, string>
}

export interface Api {
  listSessions: () => Promise<SessionMeta[]>
  createSession: () => Promise<SessionMeta>
  switchSession: (id: string) => Promise<StoredMessage[]>
  deleteSession: (id: string) => Promise<void>
  updateSessionTitle: (id: string, title: string) => Promise<void>
  saveMessages: (sessionId: string, messages: StoredMessage[]) => Promise<void>
  sendMessage: (text: string, sessionId: string, system?: string, parts?: any[]) => Promise<{ success: boolean; error?: string }>
  abortMessage: () => Promise<void>
  getConfig: () => Promise<{ providers: ProviderConfigData[]; activeProvider: string; activeModel: string; activeAgent: string; webInfo: boolean; theme: 'light' | 'dark'; skillToggles: Record<string, boolean>; thinkingDepth: string; weknoraUrl: string; weknoraApiKey: string }>
  saveConfig: (config: { providers: ProviderConfigData[]; activeProvider: string; activeModel: string; activeAgent: string; webInfo: boolean; theme: 'light' | 'dark'; skillToggles: Record<string, boolean>; thinkingDepth: string; weknoraUrl: string; weknoraApiKey: string }) => Promise<{ success: boolean }>
  saveConfigField: (key: string, value: any) => Promise<void>
  listProviders: () => Promise<{ providers: any[]; models: any[] }>
  newSession: () => Promise<void>
  reconnectServer: () => Promise<void>
  getWorkspacePath: () => Promise<string>
  setWorkspacePath: () => Promise<{ success: boolean; path?: string }>
  openWorkspaceFolder: () => Promise<void>
  openExternal: (url: string) => Promise<void>
  loadAgents: () => Promise<AgentData[]>
  saveAgents: (agents: AgentData[]) => Promise<void>
  loadMcp: () => Promise<any[]>
  saveMcp: (servers: any[]) => Promise<void>
  scanSkills: () => Promise<{ name: string; description: string }[]>
  listWeknoraKbs: () => Promise<{ id: string; name: string }[]>
  openFilePicker: (opts?: { multiple?: boolean }) => Promise<string[]>
  readClipboardImage: () => Promise<{ buffer: number[]; width: number; height: number } | null>
  onStream: (callback: (data: { delta: string; partType: string }) => void) => void
  onEnd: (callback: () => void) => void
  onError: (callback: (error: any) => void) => void
  onTool: (callback: (data: { callID: string; tool: string; status: string; input: any; output?: string; title?: string; error?: string; progress?: { structured?: Record<string, any>; content?: { type: string; text?: string; uri?: string }[] } }) => void) => void
  onFile: (callback: (data: { id: string; mediaType: string; filename: string; url: string }) => void) => void
  onSubtask: (callback: (data: { id: string; description: string; agent: string; prompt: string }) => void) => void
  onStepFinish: (callback: (data: { id: string; reason: string; cost: number; tokens: any }) => void) => void
  onConnectionStatus: (callback: (status: string) => void) => void
  replyPermission: (id: string, reply: 'once' | 'always' | 'reject') => void
  onPermission: (callback: (data: { id: string; action: string; resources: string[] }) => void) => void
  replyQuestion: (id: string, text: string) => void
  rejectQuestion: (id: string) => void
  onQuestion: (callback: (data: { id: string; questions: { question: string; header: string; options: { label: string; description: string }[]; custom?: boolean; multiple?: boolean }[] }) => void) => void
  onSessionStatus: (callback: (data: { sessionID: string; status: { type: string; attempt?: number; message?: string; next?: number } }) => void) => void
}

declare global {
  interface Window {
    api: Api
  }
}
