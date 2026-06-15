import { contextBridge, ipcRenderer } from 'electron'

let cleanupStream: (() => void) | null = null
let cleanupEnd: (() => void) | null = null
let cleanupError: (() => void) | null = null
let cleanupTool: (() => void) | null = null
let cleanupStatus: (() => void) | null = null
let cleanupPermission: (() => void) | null = null

const api = {
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  createSession: () => ipcRenderer.invoke('create-session'),
  switchSession: (id: string) => ipcRenderer.invoke('switch-session', id),
  deleteSession: (id: string) => ipcRenderer.invoke('delete-session', id),
  updateSessionTitle: (id: string, title: string) => ipcRenderer.invoke('update-session-title', id, title),
  saveMessages: (sessionId: string, messages: any[]) => ipcRenderer.invoke('save-messages', sessionId, messages),
  sendMessage: (text: string, sessionId: string, system?: string, parts?: any[]) => ipcRenderer.invoke('send-message', text, sessionId, system, parts),
  abortMessage: () => ipcRenderer.invoke('abort-message'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  saveConfigField: (key: string, value: any) => ipcRenderer.invoke('save-config-field', key, value),
  listProviders: () => ipcRenderer.invoke('list-providers'),
  newSession: () => ipcRenderer.invoke('new-session'),
  reconnectServer: () => ipcRenderer.invoke('reconnect-server'),
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
  setWorkspacePath: () => ipcRenderer.invoke('set-workspace-path'),
  openWorkspaceFolder: () => ipcRenderer.invoke('open-workspace-folder'),
  loadAgents: () => ipcRenderer.invoke('load-agents'),
  saveAgents: (agents: any[]) => ipcRenderer.invoke('save-agents', agents),
  loadMcp: () => ipcRenderer.invoke('load-mcp'),
  saveMcp: (servers: any[]) => ipcRenderer.invoke('save-mcp', servers),
  scanSkills: () => ipcRenderer.invoke('scan-skills'),
  listWeknoraKbs: () => ipcRenderer.invoke('list-weknora-kbs'),
  openFilePicker: (opts?: { multiple?: boolean }) => ipcRenderer.invoke('open-file-picker', opts),
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  onStream: (callback: (data: { delta: string; partType: string }) => void) => {
    if (cleanupStream) cleanupStream()
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('stream-chunk', handler)
    cleanupStream = () => ipcRenderer.removeListener('stream-chunk', handler)
  },
  onEnd: (callback: () => void) => {
    if (cleanupEnd) cleanupEnd()
    const handler = () => callback()
    ipcRenderer.on('stream-end', handler)
    cleanupEnd = () => ipcRenderer.removeListener('stream-end', handler)
  },
  onError: (callback: (error: any) => void) => {
    if (cleanupError) cleanupError()
    const handler = (_event: any, error: any) => callback(error)
    ipcRenderer.on('stream-error', handler)
    cleanupError = () => ipcRenderer.removeListener('stream-error', handler)
  },
  onTool: (callback: (data: any) => void) => {
    if (cleanupTool) cleanupTool()
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('stream-tool', handler)
    cleanupTool = () => ipcRenderer.removeListener('stream-tool', handler)
  },
  onConnectionStatus: (callback: (status: string) => void) => {
    if (cleanupStatus) cleanupStatus()
    const handler = (_event: any, status: any) => callback(status)
    ipcRenderer.on('connection-status', handler)
    cleanupStatus = () => ipcRenderer.removeListener('connection-status', handler)
  },
  replyPermission: (id: string, reply: 'once' | 'always' | 'reject') => {
    ipcRenderer.invoke('reply-permission', id, reply)
  },
  onPermission: (callback: (data: { id: string; action: string; resources: string[] }) => void) => {
    if (cleanupPermission) cleanupPermission()
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('stream-permission', handler)
    cleanupPermission = () => ipcRenderer.removeListener('stream-permission', handler)
  },
}

contextBridge.exposeInMainWorld('api', api)
