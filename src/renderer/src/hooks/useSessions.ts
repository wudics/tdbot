import { useState, useCallback, useEffect } from 'react'

export interface SessionMeta {
  id: string
  title: string
  createdAt: string
}

export function useSessions() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.listSessions().then(list => {
      setSessions(list)
      setLoaded(true)
    })
  }, [])

  const switchSession = useCallback(async (id: string) => {
    const msgs = await window.api.switchSession(id)
    setActiveId(id)
    return msgs
  }, [])

  const createSession = useCallback(async () => {
    try {
      const meta = await window.api.createSession()
      setSessions(prev => [meta, ...prev])
      setActiveId(meta.id)
      return meta
    } catch {}
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    try {
      await window.api.deleteSession(id)
    } catch { return }
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeId === id) setActiveId(null)
  }, [activeId])

  const updateTitle = useCallback((id: string, title: string) => {
    window.api.updateSessionTitle(id, title).catch(() => {})
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, title } : s)))
  }, [])

  const reloadSessions = useCallback(async () => {
    const list = await window.api.listSessions()
    setSessions(list)
    setActiveId(null)
  }, [])

  return { sessions, activeId, loaded, switchSession, createSession, deleteSession, updateTitle, reloadSessions }
}
