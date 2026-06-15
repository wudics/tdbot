import { useState, useEffect, useMemo } from 'react'
import hljs from 'highlight.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../hooks/useChat'
import { formatTime } from '../lib/formatTime'

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const [wordWrap, setWordWrap] = useState(true)

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(t)
    }
  }, [copied])

  const html = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
    return hljs.highlightAuto(code).value
  }, [code, language])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
  }

  return (
    <div className="relative group my-3 rounded-md border">
      <div className="flex items-center justify-between px-4 py-1.5 bg-muted text-xs text-muted-foreground rounded-t-md">
        <span>{language || 'code'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`hover:text-foreground transition-colors px-1 ${wordWrap ? 'text-foreground' : 'text-muted-foreground'}`}
            title={wordWrap ? '取消自动换行' : '自动换行'}
          >
            {wordWrap ? '↩' : '↔'}
          </button>
          <button
            onClick={handleCopy}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            {copied ? '已复制' : '📋'}
          </button>
        </div>
      </div>
      {wordWrap ? (
        <pre className="p-4 text-sm whitespace-pre-wrap break-all bg-background">
          <code className={`language-${language || ''}`} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : (
        <div className="overflow-x-auto" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <pre className="p-4 text-sm whitespace-pre bg-background">
            <code className={`language-${language || ''}`} dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
      )}
    </div>
  )
}

export default function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === 'user'
  const [collapsed, setCollapsed] = useState(true)

  const toggleToolOutput = (i: number) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (isStreaming) setCollapsed(false)
  }, [isStreaming])

  useEffect(() => {
    if (!isStreaming && (message.reasoning || (message.tools && message.tools.length > 0))) {
      setCollapsed(true)
    }
  }, [isStreaming])

  const fileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return '🖼️'
    if (mime === 'application/pdf') return '📄'
    if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊'
    if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️'
    if (mime.startsWith('text/') || mime === 'application/json') return '📝'
    if (mime.startsWith('audio/')) return '🎵'
    if (mime.startsWith('video/')) return '🎬'
    return '📎'
  }

  const isImageMime = (mime: string) => mime.startsWith('image/')

  return (
    <div className={`mb-4 ${isUser ? 'mr-auto text-left' : ''}`}>
      {!isUser && (message.reasoning || (message.tools && message.tools.length > 0)) && (
        <div>
          <button
            className="text-xs text-muted-foreground mb-1 hover:text-foreground flex items-center gap-1"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▶' : '▼'} 思考过程
          </button>
          {!collapsed && (
            <div className="text-sm text-muted-foreground italic mb-2 pl-2 border-l-2 border-muted whitespace-pre-wrap break-words overflow-y-auto overflow-x-hidden max-h-[15em] w-full">
              {message.reasoning}
              {message.tools && message.tools.map((t, i) => (
                <div key={i}>
                  <div className="not-italic mt-1 text-xs flex items-center gap-1">
                    <span>{t.status === 'running' || t.status === 'pending' ? '⏳' : t.status === 'completed' ? '✅' : t.status === 'error' ? '❌' : '🔧'}</span>
                    <span className="font-medium">{t.tool}</span>
                    {t.title && <span className="text-muted-foreground"> — {t.title}</span>}
                    {t.output && t.status === 'completed' && (
                      <button
                        className="ml-auto text-muted-foreground/60 hover:text-muted-foreground text-[10px]"
                        onClick={() => toggleToolOutput(i)}
                      >
                        {expandedTools.has(i) ? '收起结果' : '展开结果'}
                      </button>
                    )}
                  </div>
                  {expandedTools.has(i) && t.output && (
                    <pre className="not-italic text-xs text-foreground/80 mt-1 mb-2 p-2 rounded bg-muted/50 whitespace-pre-wrap overflow-x-auto max-h-[20em] overflow-y-auto max-w-full">
                      {t.output}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className={`rounded-lg px-4 py-2 whitespace-pre-wrap break-words text-left ${
          isUser
            ? 'inline-block max-w-[80%] bg-primary text-primary-foreground ml-auto'
            : 'bg-muted w-full min-w-0 max-w-full'
        }`}
      >
        {message.files && message.files.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.files.map(f => (
              <div key={f.id} className="flex items-center gap-1.5 text-xs">
                <span>{fileIcon(f.mime)}</span>
                <span className="truncate max-w-[200px]">{f.filename}</span>
                {isImageMime(f.mime) && f.url && (
                  <img
                    src={f.url.replace('file://', 'local-asset://')}
                    alt={f.filename}
                    className="max-w-full max-h-[200px] rounded mt-1 object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {message.text ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre({ children }) { return <>{children}</> },
              code({ className, children, ...props }) {
                const lang = className?.replace('language-', '')
                const code = String(children).replace(/\n$/, '')
                if (lang) return <CodeBlock language={lang} code={code} />
                return <code className="text-sm bg-muted/50 px-1 rounded" {...props}>{children}</code>
              },
              a({ href, children }) {
                return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>
              },
              table({ children }) {
                return <div className="overflow-x-auto my-2"><table className="border-collapse border border-border text-sm">{children}</table></div>
              },
              th({ children }) {
                return <th className="border border-border px-3 py-1.5 bg-muted font-medium">{children}</th>
              },
              td({ children }) {
                return <td className="border border-border px-3 py-1.5">{children}</td>
              },
            }}
          >
            {message.text}
          </ReactMarkdown>
        ) : (
          !isUser ? (
            <span className="inline-flex gap-[1px]">
              <span className="animate-[blink_1.4s_infinite]">.</span>
              <span className="animate-[blink_1.4s_infinite_0.2s]">.</span>
              <span className="animate-[blink_1.4s_infinite_0.4s]">.</span>
            </span>
          ) : ''
        )}
        {message.createdAt && (
          <span className="block text-[10px] text-muted-foreground text-right mt-1">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  )
}

