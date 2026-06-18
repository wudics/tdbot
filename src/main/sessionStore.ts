import { getDb, saveDb } from './db'

export interface SessionMeta {
  id: string
  title: string
  createdAt: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  files?: { id: string; filename: string; mime: string; url: string }[]
  reasoning?: string
  tools?: any[]
  agent?: string
  stepFinish?: { reason: string; cost: number; tokens: any }
  createdAt: string
}

export function loadSessions(): SessionMeta[] {
  const db = getDb()
  const rows = db.exec('SELECT id, title, created_at FROM sessions ORDER BY created_at DESC')
  if (!rows.length) return []
  return rows[0].values.map(row => ({
    id: row[0] as string,
    title: row[1] as string,
    createdAt: row[2] as string,
  }))
}

export function saveSessionList(sessions: SessionMeta[]): void {
  const db = getDb()
  db.run('DELETE FROM sessions')
  const stmt = db.prepare('INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)')
  for (const s of sessions) {
    stmt.run([s.id, s.title, s.createdAt])
  }
  stmt.free()
  saveDb()
}

export function loadMessages(sessionId: string): StoredMessage[] {
  const db = getDb()
  const rows = db.exec('SELECT id, role, text, reasoning, tools, files, agent, step_finish, created_at FROM messages WHERE session_id = ? ORDER BY created_at', [sessionId])
  if (!rows.length) return []
  return rows[0].values.map(row => {
    const tools = row[4] ? JSON.parse(row[4] as string) : undefined
    const files = row[5] ? JSON.parse(row[5] as string) : undefined
    const stepFinish = row[7] ? JSON.parse(row[7] as string) : undefined
    return {
      id: row[0] as string,
      role: row[1] as 'user' | 'assistant',
      text: row[2] as string,
      ...(row[3] ? { reasoning: row[3] as string } : {}),
      ...(tools ? { tools } : {}),
      ...(files ? { files } : {}),
      ...(row[6] ? { agent: row[6] as string } : {}),
      ...(stepFinish ? { stepFinish } : {}),
      createdAt: row[8] as string,
    }
  })
}

export function saveMessages(sessionId: string, messages: StoredMessage[]): void {
  const db = getDb()
  db.run('DELETE FROM messages WHERE session_id = ?', [sessionId])
  const stmt = db.prepare('INSERT INTO messages (id, session_id, role, text, reasoning, tools, files, agent, step_finish, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const m of messages) {
    stmt.run([
      m.id,
      sessionId,
      m.role,
      m.text || '',
      m.reasoning || null,
      m.tools ? JSON.stringify(m.tools) : null,
      m.files ? JSON.stringify(m.files) : null,
      m.agent || null,
      m.stepFinish ? JSON.stringify(m.stepFinish) : null,
      m.createdAt || new Date().toISOString(),
    ])
  }
  stmt.free()
  saveDb()
}

export function deleteSession(sessionId: string): void {
  const db = getDb()
  db.run('DELETE FROM messages WHERE session_id = ?', [sessionId])
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
  saveDb()
}
