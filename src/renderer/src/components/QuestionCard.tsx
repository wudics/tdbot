import { useState } from 'react'

interface QItem {
  question: string
  header: string
  options: { label: string; description: string }[]
  custom?: boolean
  multiple?: boolean
}

interface QuestionCardProps {
  id: string
  questions: QItem[]
  onReply: (id: string, text: string) => void
  onReject: (id: string) => void
}

export default function QuestionCard({ id, questions, onReply, onReject }: QuestionCardProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''))
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string[]>(() => {
    const init = questions[currentIdx]
    if (init && !init.multiple && init.options.length > 0) {
      return [answers[currentIdx] || '']
    }
    return []
  })
  const [replied, setReplied] = useState(false)

  const q = questions[currentIdx]
  if (!q || replied) return null

  const isLast = currentIdx === questions.length - 1

  const saveCurrentAnswer = () => {
    let answer = ''
    if ((q.custom !== false || q.options.length === 0) && text.trim()) {
      answer = text.trim()
    } else if (selected.length > 0) {
      answer = selected.join(', ')
    }
    setAnswers(prev => {
      const next = [...prev]
      next[currentIdx] = answer
      return next
    })
    return answer
  }

  const toggleOption = (label: string) => {
    if (q.multiple) {
      setSelected(prev =>
        prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
      )
    } else {
      setSelected([label])
    }
  }

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      saveCurrentAnswer()
      setCurrentIdx(prev => prev + 1)
      setSelected([])
      setText('')
    }
  }

  const goPrev = () => {
    if (currentIdx > 0) {
      saveCurrentAnswer()
      setCurrentIdx(prev => prev - 1)
      setSelected([])
      setText('')
    }
  }

  const handleSubmit = () => {
    saveCurrentAnswer()
    const nonEmpty = answers.filter(a => a.length > 0)
    onReply(id, nonEmpty.join(', '))
    setReplied(true)
  }

  const handleReject = () => {
    onReject(id)
    setReplied(true)
  }

  const hasText = text.trim().length > 0
  const canAdvance = q.options.length > 0
    ? ((q.custom !== false) && hasText) || selected.length > 0
    : hasText

  return (
    <div className="border border-blue-300 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 my-3 animate-[fade-in_0.3s_ease-out]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">💬</span>
        <span className="text-sm font-medium">{q.header || '模型提问'}</span>
        {questions.length > 1 && (
          <span className="text-xs text-muted-foreground ml-auto">({currentIdx + 1}/{questions.length})</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">{q.question}</p>
      {q.options.length > 0 && (
        <div className="space-y-1 mb-3">
          {q.options.map(opt => (
            <button
              key={opt.label}
              onClick={() => toggleOption(opt.label)}
              className={`w-full text-left px-3 py-2 text-xs rounded-md border transition-colors ${
                selected.includes(opt.label)
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.description && <span className="ml-2 text-muted-foreground">{opt.description}</span>}
            </button>
          ))}
        </div>
      )}
      {(q.custom !== false || q.options.length === 0) && (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="输入你的回答..."
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring mb-3"
        />
      )}
      <div className="flex gap-2">
        {currentIdx > 0 && (
          <button
            onClick={goPrev}
            className="px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            ← 上一步
          </button>
        )}
        {!isLast ? (
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            下一步 →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canAdvance}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            ✅ 发送
          </button>
        )}
        <button
          onClick={handleReject}
          className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          ❌ 拒绝
        </button>
      </div>
    </div>
  )
}
