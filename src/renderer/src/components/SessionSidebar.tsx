import { useState } from 'react'
import { Button } from './ui/button'
import { Plus, Trash2, FolderOpen } from 'lucide-react'
import type { SessionMeta } from '../hooks/useSessions'

interface SessionSidebarProps {
  sessions: SessionMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  workspacePath: string
  onSwitchWorkspace: () => void
  disabled?: boolean
}

export default function SessionSidebar({ sessions, activeId, onSelect, onCreate, onDelete, onRename, workspacePath, onSwitchWorkspace, disabled }: SessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startRename = (id: string, title: string) => {
    setEditingId(id)
    setEditValue(title)
  }

  const finishRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button variant="outline" size="sm" className="w-full" onClick={onCreate} disabled={disabled} title={disabled ? '等待当前响应完成后切换' : ''}>
          <Plus className="h-4 w-4 mr-2" />
          新建对话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 sidebar-scroll">
        {sessions.map(s => (
          <div
            key={s.id}
            className={`group flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors min-w-0 overflow-hidden ${
              s.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => { if (!disabled) onSelect(s.id) }}
            title={disabled ? '等待当前响应完成后切换' : s.title}
          >
            {editingId === s.id ? (
              <input
                className="flex-1 min-w-0 bg-transparent border-b border-primary outline-none text-sm"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={finishRename}
                onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setEditingId(null) }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 truncate"
                onDoubleClick={() => { if (!disabled) startRename(s.id, s.title) }}
                title={s.title}
              >
                {s.title}
              </span>
            )}
            {!disabled && (
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted-foreground/20 rounded"
                onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">暂无对话</p>
        )}
      </div>
      <div className="border-t p-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <FolderOpen className="h-3 w-3 flex-shrink-0 cursor-pointer hover:text-foreground" onClick={() => window.api.openWorkspaceFolder()} />
          <span className="truncate" title={workspacePath || '选择工作目录'}>{workspacePath || '选择工作目录'}</span>
          <button
            onClick={onSwitchWorkspace}
            className="hover:text-foreground text-xs flex-shrink-0 ml-auto"
            title="切换工作目录"
          >
            切换
          </button>
        </div>
      </div>
    </div>
  )
}
