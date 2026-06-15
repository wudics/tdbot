# Markdown 渲染

## 目标

将 AI 正文回复中的 Markdown 语法渲染为可视化内容，包括标题、粗体、列表、表格、链接、代码块等。

## 技术选型

| 项目 | 选择 | 理由 |
|------|------|------|
| 渲染引擎 | **react-markdown** | React 原生组件，安全（不直接用 dangerouslySetInnerHTML），扩展性好 |
| GFM 扩展 | **remark-gfm** | 支持表格、任务列表、删除线等 GitHub 风格语法 |
| 代码高亮 | **highlight.js**（CodeBlock 组件内） | 已安装，与 rehype-highlight 冲突，由 CodeBlock 自行处理 |

## 渲染分工

| 区域 | 渲染方式 | 说明 |
|------|---------|------|
| 思考过程（`.reasoning`） | `whitespace-pre-wrap` 纯文本 | 不处理 markdown |
| 工具调用（`.tools`） | 纯文本 | 不处理 markdown |
| **正文回复（`.text`）** | **react-markdown** | 完整 markdown 渲染 |
| 加载动画（`...`） | 纯文本 | 不处理 markdown |

## 组件覆写

### 代码块

react-markdown 解析 ` ```language ` 为 `pre > code.language-xxx`。通过组件覆写拦截：

```tsx
pre({ children }) { return <>{children}</> }  // 去掉外层 pre
code({ className, children, ...props }) {
  const lang = className?.replace('language-', '')
  const code = String(children).replace(/\n$/, '')
  if (lang) return <CodeBlock language={lang} code={code} />
  return <code className="text-sm bg-muted/50 px-1 rounded">{children}</code>
}
```

- `pre` 直接返回 children，避免 react-markdown 的 `<pre>` 包裹
- `code` 检测到 `language-` 前缀时使用自定义 `CodeBlock` 组件（含复制按钮 + 语法高亮）
- 无语言标记的 `code` 渲染为行内代码样式

### CodeBlock 组件

```tsx
function CodeBlock({ language, code }: { language?: string; code: string }) {
  const html = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
    return hljs.highlightAuto(code).value
  }, [code, language])

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex justify-between px-4 py-1.5 bg-muted text-xs">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy}>{copied ? '已复制' : '📋'}</button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm bg-background">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}
```

### 其他组件

| 元素 | 渲染 |
|------|------|
| 链接 | `<a href={href} target="_blank" rel="noreferrer" className="text-primary underline">` |
| 表格 | `<div overflow-x-auto><table border-collapse>` → `<th>`/`<td>` 带边框 |
| 行内代码 | `<code className="text-sm bg-muted/50 px-1 rounded">` |

## 安装

```bash
npm install react-markdown remark-gfm
```

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 新增依赖 | `react-markdown` + `remark-gfm` |
| `src/renderer/src/lib/markdown.ts` | **删除** | 手写 `parseCodeBlocks` 不再需要 |
| `src/renderer/src/components/MessageItem.tsx` | 修改 | 正文改为 `<ReactMarkdown>` 渲染；`CodeBlock` 用 `hljs.highlight()` 生成高亮 HTML；`pre`/`code` 组件覆写 |

## 输入框（Shift+Enter 换行）

### InputBar.tsx

`<Input>` 替换为 `<textarea>`，支持多行输入：

```tsx
<textarea
  value={text}
  onChange={e => setText(e.target.value)}
  onInput={adjustHeight}
  onKeyDown={e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }}
  rows={1}
  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-0 max-h-[120px] resize-none overflow-y-auto"
/>
```

- **Enter** → 发送（`e.preventDefault()` 阻止换行）
- **Shift+Enter** → 浏览器默认行为 → 插入换行符
- `onInput` → 根据 `scrollHeight` 动态调整 textarea 高度
- 发送后高度重置为单行
- 容器 `items-end` 对齐，按钮保持底部不动

### 高度调整

```typescript
const adjustHeight = () => {
  const el = textareaRef.current
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}
```
