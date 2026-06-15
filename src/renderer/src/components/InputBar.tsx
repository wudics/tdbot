import { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Send, Square, Paperclip, X } from 'lucide-react'

interface InputBarProps {
  onSend: (text: string, files?: string[]) => void
  disabled: boolean
  onStop?: () => void
}

export default function InputBar({ onSend, disabled, onStop }: InputBarProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const handleSend = () => {
    if ((!text.trim() && files.length === 0) || disabled) return
    onSend(text.trim(), files.length > 0 ? files : undefined)
    setText('')
    setFiles([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleAttach = async () => {
    const paths = await window.api.openFilePicker({ multiple: true })
    if (paths.length > 0) {
      setFiles(prev => [...prev, ...paths])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const fileName = (p: string) => p.split('/').pop() || p

  const isSendable = text.trim().length > 0 || files.length > 0

  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {files.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1 max-w-[200px]">
              <span className="truncate">{fileName(p)}</span>
              <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 flex gap-1 items-end border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              setText(e.target.value)
              adjustHeight()
            }}
            onInput={adjustHeight}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入消息...（Shift+Enter 换行）"
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-0 max-h-[120px] resize-none overflow-y-auto border-0"
          />
          <button
            onClick={handleAttach}
            disabled={disabled}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-50 flex-shrink-0"
            title="上传文件"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </div>
        {disabled ? (
          <Button variant="destructive" onClick={onStop}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={!isSendable}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
