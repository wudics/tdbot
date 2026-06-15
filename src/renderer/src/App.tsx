import { useState, useEffect, useCallback } from 'react'
import { useSessions } from './hooks/useSessions'
import SessionSidebar from './components/SessionSidebar'
import ChatView from './components/ChatView'
import SettingsDialog from './components/SettingsDialog'
import { Sheet, SheetContent } from './components/ui/sheet'
import { Button } from './components/ui/button'
import { Settings } from 'lucide-react'

export default function App() {
  const { sessions, activeId, switchSession, createSession, deleteSession, updateTitle, reloadSessions } = useSessions()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessionMessages, setSessionMessages] = useState<Record<string, any[]>>({})
  const [connectionStatus, setConnectionStatus] = useState('reconnecting')
  const [providers, setProviders] = useState<{ name: string; model: string; modelCfg?: Record<string, any> }[]>([])
  const [activeProvider, setActiveProvider] = useState('')
  const [activeModel, setActiveModel] = useState('')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [activeAgent, setActiveAgent] = useState('build')
  const [workspacePath, setWorkspacePath] = useState('')
  const [toast, setToast] = useState('')
  const [weknoraConfigured, setWeknoraConfigured] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<any[]>([])
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [thinkingDepth, setThinkingDepth] = useState('')

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const applyTheme = (theme: string) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }

  const loadConfig = () => {
    window.api.getConfig().then(c => {
      setProviders(c.providers)
      setActiveProvider(c.activeProvider)
      setActiveModel(c.activeModel)
      setActiveAgent(c.activeAgent || 'build')
      setThinkingDepth(c.thinkingDepth || '')
      setWeknoraConfigured(!!(c.weknoraUrl && c.weknoraApiKey))
      applyTheme(c.theme || 'light')
    })
    window.api.loadAgents().then(a => setAgents(a))
  }

  useEffect(() => {
    window.api.onConnectionStatus(setConnectionStatus)
    window.api.getWorkspacePath().then(setWorkspacePath)
    loadConfig()
  }, [])

  useEffect(() => {
    if (connectionStatus === 'connected') {
      window.api.listProviders().then(res => {
        setAvailableProviders(Array.isArray(res?.providers) ? res.providers : [])
        setAvailableModels(Array.isArray(res?.models) ? res.models : [])
      })
    }
  }, [connectionStatus])

  const handleReconnect = () => {
    if (connectionStatus === 'disconnected') {
      window.api.reconnectServer()
    }
  }

  const handleSettingsClose = (open: boolean) => {
    setSettingsOpen(open)
    if (!open) {
      loadConfig()
      window.api.listProviders().then(res => {
        setAvailableProviders(Array.isArray(res?.providers) ? res.providers : [])
        setAvailableModels(Array.isArray(res?.models) ? res.models : [])
      })
    }
  }

  const handleSelect = useCallback(async (id: string) => {
    const msgs = await switchSession(id)
    setSessionMessages(prev => ({ ...prev, [id]: msgs }))
    setSidebarOpen(false)
  }, [switchSession])

  const handleCreate = useCallback(async () => {
    await createSession()
    setSidebarOpen(false)
  }, [createSession])

  const handleSwitchWorkspace = async () => {
    const result = await window.api.setWorkspacePath()
    if (result.success) {
      setWorkspacePath(result.path!)
      setToast('工作目录已切换')
      reloadSessions()
      loadConfig()
    }
  }

  const handleThinkingDepthChange = (variant: string) => {
    setThinkingDepth(variant)
    window.api.saveConfigField('thinkingDepth', variant)
  }

  const sidebar = (
    <SessionSidebar
      sessions={sessions}
      activeId={activeId}
      onSelect={handleSelect}
      onCreate={handleCreate}
      onDelete={deleteSession}
      onRename={updateTitle}
      workspacePath={workspacePath}
      onSwitchWorkspace={handleSwitchWorkspace}
      disabled={connectionStatus !== 'connected' || isStreaming}
    />
  )

  return (
    <div className="h-dvh flex bg-background overflow-hidden">
      <aside className="hidden md:block w-[200px] border-r flex-shrink-0 overflow-hidden h-dvh">
        {sidebar}
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0">
          {sidebar}
        </SheetContent>
      </Sheet>

      {toast && (
        <div className="fixed bottom-4 md:left-[calc(50%+100px)] left-1/2 bg-green-500 text-white px-4 py-2 rounded-md text-sm shadow-lg z-50 animate-[toast-in_0.3s_ease-out_forwards]">
          {toast}
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-dvh">
        <header className="flex items-center justify-end px-4 py-2 border-b gap-2">
          <div className="flex items-center mr-auto truncate">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500 cursor-pointer hover:bg-red-400'
              }`}
              onClick={handleReconnect}
              title={connectionStatus === 'connected' ? '已连接' : connectionStatus === 'reconnecting' ? '重连中...' : '已断开，点击重连'}
            />
            <span className="text-sm font-semibold truncate">{sessions.find(s => s.id === activeId)?.title || '请选择或新建会话'}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </header>
        <ChatView
          key={activeId || 'none'}
          onOpenSidebar={() => setSidebarOpen(true)}
          sessionId={activeId}
          onNewSession={handleCreate}
          initialMessages={activeId ? (sessionMessages[activeId] || []) : []}
          onAutoTitle={(title) => { if (activeId) updateTitle(activeId, title) }}
          providers={providers}
          activeProvider={activeProvider}
          activeModel={activeModel}
          onModelChange={(p, m) => {
            setActiveProvider(p)
            setActiveModel(m)
            window.api.saveConfigField('activeProvider', p)
            window.api.saveConfigField('activeModel', m)
          }}
          agents={agents}
          activeAgent={activeAgent}
          onAgentChange={(id) => {
            setActiveAgent(id)
            window.api.saveConfigField('activeAgent', id)
          }}
          onStreamingChange={setIsStreaming}
          weknoraConfigured={weknoraConfigured}
          availableProviders={availableProviders}
          availableModels={availableModels}
          thinkingDepth={thinkingDepth}
          onThinkingDepthChange={handleThinkingDepthChange}
        />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={handleSettingsClose} />
    </div>
  )
}
