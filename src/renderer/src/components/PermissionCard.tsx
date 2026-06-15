interface PermissionCardProps {
  id: string
  action: string
  resources: string[]
  onReply: (id: string, reply: 'once' | 'always' | 'reject') => void
}

export default function PermissionCard({ id, action, resources, onReply }: PermissionCardProps) {
  return (
    <div className="border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 my-3 animate-[fade-in_0.3s_ease-out]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🔒</span>
        <span className="text-sm font-medium">权限请求</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Agent 需要执行 <strong className="text-foreground">{action}</strong>
        {resources.length > 0 && (
          <>，资源: <span className="text-xs font-mono bg-muted px-1 rounded">{resources.join(', ')}</span></>
        )}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onReply(id, 'once')}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          ✅ 允许一次
        </button>
        <button
          onClick={() => onReply(id, 'always')}
          className="px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          🔄 始终允许
        </button>
        <button
          onClick={() => onReply(id, 'reject')}
          className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          ❌ 拒绝
        </button>
      </div>
    </div>
  )
}
