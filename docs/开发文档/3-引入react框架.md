# 引入 React 框架

## 目标

将现有的纯 HTML/CSS/JS 前端重构为 React + TypeScript + Shadcn/ui 架构，同时引入用户输入框和多轮对话功能。

## 技术选型

| 项目 | 选择 |
|------|------|
| 构建工具 | **electron-vite**（专为 Electron + Vite 设计，自动处理 main/preload/renderer 构建和开发热重载） |
| 前端框架 | React + TypeScript |
| UI 组件 | **Shadcn/ui**（基于 Radix UI + Tailwind CSS，组件按需添加到项目，可完全自定义） |
| 样式 | Tailwind CSS + Shadcn/ui 全局样式 |
| 图标 | Lucide React |
| 主进程 | TypeScript（迁移现有 main.js） |

## 项目结构

```
tdbot-3.0.0/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json                       # Shadcn/ui 配置
├── src/
│   ├── main/index.ts                     # 主进程（现有逻辑 + 多轮对话会话管理）
│   ├── preload/
│   │   ├── index.ts                      # preload 脚本（扩展 IPC）
│   │   └── index.d.ts                    # 暴露给渲染进程的类型
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx                  # React 入口
│           ├── App.tsx                   # 根组件
│           ├── globals.css               # Tailwind + Shadcn/ui 样式
│           ├── lib/utils.ts              # shadcn 工具函数（cn）
│           ├── components/
│           │   ├── ui/                   # Shadcn/ui 组件（初始化后自动生成）
│           │   │   ├── button.tsx
│           │   │   ├── input.tsx
│           │   │   ├── scroll-area.tsx
│           │   │   ├── avatar.tsx
│           │   │   ├── separator.tsx
│           │   │   ├── skeleton.tsx
│           │   │   ├── tooltip.tsx
│           │   │   └── dialog.tsx
│           │   ├── ChatView.tsx          # 聊天主视图
│           │   ├── MessageItem.tsx       # 单条消息（推理灰色区 + 正文）
│           │   └── InputBar.tsx          # 输入框 + 发送按钮
│           └── hooks/
│               └── useChat.ts            # 流式状态 + IPC 封装
```

## 安装依赖

```bash
# React + 类型
npm install react react-dom
npm install -D typescript @types/react @types/react-dom

# electron-vite 构建工具
npm install -D electron-vite @vitejs/plugin-react

# Tailwind CSS + Shadcn/ui 依赖
npm install -D tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge lucide-react

# Radix UI 组件（Shadcn/ui 的基础）
npm install @radix-ui/react-scroll-area @radix-ui/react-avatar
npm install @radix-ui/react-separator @radix-ui/react-tooltip @radix-ui/react-dialog
```

## 配置步骤

### 1. electron.vite.config.ts

```ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['@opencode-ai/sdk/v2']
      }
    }
  },
  preload: {},
  renderer: {
    plugins: [react()]
  }
})
```

### 2. package.json 修改

```json
{
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "dist": "electron-vite build && electron-builder"
  }
}
```

### 3. tsconfig 文件

**tsconfig.json**（根配置，仅用于 IDE 提示）：

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

**tsconfig.node.json**（main + preload 进程）：

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "outDir": "./out"
  },
  "include": ["src/main/**/*", "src/preload/**/*"]
}
```

**tsconfig.web.json**（renderer 进程）：

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/renderer/src/*"]
    }
  },
  "include": ["src/renderer/src/**/*"]
}
```

### 4. Tailwind CSS + PostCSS

**postcss.config.js**：

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

**tailwind.config.ts**：

```ts
import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
```

### 5. Shadcn/ui

```bash
npx shadcn@latest init
# 选择 src/renderer/src 作为 components 目录
# 选择 Tailwind CSS 风格
# 选择 CSS variables 配色
```

初始化后自动生成：
- `components.json`
- `src/renderer/src/globals.css`（含 Tailwind 指令 + CSS 变量）
- `src/renderer/src/lib/utils.ts`

添加所需组件：

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add scroll-area
npx shadcn@latest add avatar
npx shadcn@latest add separator
npx shadcn@latest add skeleton
npx shadcn@latest add tooltip
npx shadcn@latest add dialog
```

## 主进程重构（src/main/index.ts）

迁移现有 `main.js` 到 TypeScript，核心变化：

### 多轮对话会话管理

```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null
let opencodeClient: any = null
let opencodeServer: any = null
let opencodeReady = false
let currentSessionId: string | null = null
const partTypes: Record<string, string> = {}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await createWindow()

  if (app.isPackaged) {
    process.env.PATH = `${process.resourcesPath}:${process.env.PATH}`
  }

  // 发送消息（自动管理创建/复用 session）
  ipcMain.handle('send-message', async (_event, text: string) => {
    if (!opencodeReady) {
      return { success: false, error: 'opencode 正在启动，请稍候重试' }
    }
    try {
      const events = await opencodeClient.event.subscribe()

      if (!currentSessionId) {
        const session = await opencodeClient.session.create({ title: '对话' })
        currentSessionId = session.data.id
      }

      await opencodeClient.session.promptAsync({
        sessionID: currentSessionId,
        agent: 'general',
        parts: [{ type: 'text', text }],
      })

      const timeout = setTimeout(() => {
        mainWindow?.webContents.send('stream-error', { message: '响应超时（60s）' })
      }, 60000)

      ;(async () => {
        try {
          for await (const event of events.stream) {
            if (event.type === 'message.part.updated') {
              const part = event.properties.part
              if (part && part.id) {
                partTypes[part.id] = part.type
              }
            }
            if (event.type === 'message.part.delta') {
              const delta = event.properties.delta
              const partID = event.properties.partID
              const partType = partTypes[partID] || 'text'
              if (delta) {
                mainWindow?.webContents.send('stream-chunk', { delta, partType })
              }
            }
            if (event.type === 'session.idle') {
              clearTimeout(timeout)
              mainWindow?.webContents.send('stream-end')
              break
            }
            if (event.type === 'session.error') {
              clearTimeout(timeout)
              mainWindow?.webContents.send('stream-error', event.properties.error)
              break
            }
          }
        } catch (streamErr: any) {
          clearTimeout(timeout)
          mainWindow?.webContents.send('stream-error', { message: streamErr.message })
        }
      })()

      return { success: true }
    } catch (err: any) {
      console.error('send-message error:', err)
      return { success: false, error: err.message }
    }
  })

  // 新建会话
  ipcMain.handle('new-session', () => {
    currentSessionId = null
  })

  // 启动 opencode
  const { createOpencode } = await import('@opencode-ai/sdk/v2')
  const { client, server } = await createOpencode({
    config: {
      model: 'deepseek/deepseek-v4-flash',
      agent: {
        general: {
          prompt: '你是一个名为 tdbot 的桌面智能体助手，由用户基于 opencode SDK 构建。请以 tdbot 的身份回答问题。',
        },
      },
      provider: {
        deepseek: {
          options: { apiKey: 'sk-cd7b134f460b4fb297e16b75e9ffed3d' },
          models: { 'deepseek-v4-flash': { id: 'deepseek-v4-flash' } },
        },
      },
    },
  })
  opencodeClient = client
  opencodeServer = server
  opencodeReady = true

  app.on('before-quit', () => {
    if (opencodeServer) opencodeServer.close()
  })
})

app.on('window-all-closed', () => {
  if (opencodeServer) opencodeServer.close()
  if (process.platform !== 'darwin') app.quit()
})
```

## Preload 脚本重构（src/preload/index.ts）

```typescript
import { contextBridge, ipcRenderer } from 'electron'

let cleanupStream: (() => void) | null = null
let cleanupEnd: (() => void) | null = null
let cleanupError: (() => void) | null = null

const api = {
  sendMessage: (text: string) => ipcRenderer.invoke('send-message', text),
  newSession: () => ipcRenderer.invoke('new-session'),
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
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
```

### preload/index.d.ts

```typescript
import type { Api } from './index'

declare global {
  interface Window {
    api: Api
  }
}
```

## React 组件设计

### App.tsx（根组件）

```tsx
import ChatView from './components/ChatView'

export default function App() {
  return (
    <div className="h-dvh flex flex-col bg-background">
      <header className="text-center py-4 border-b">
        <h1 className="text-xl font-semibold">tdbot</h1>
        <p className="text-sm text-muted-foreground">基于 opencode 的桌面智能体</p>
      </header>
      <ChatView />
    </div>
  )
}
```

### useChat hook

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  reasoning?: string
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const currentMsgId = useRef<string | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    setIsLoading(true)

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text }
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: '', reasoning: '' }
    currentMsgId.current = assistantMsg.id

    setMessages(prev => [...prev, userMsg, assistantMsg])

    window.api.onStream(({ delta, partType }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === currentMsgId.current
            ? partType === 'reasoning'
              ? { ...m, reasoning: (m.reasoning || '') + delta }
              : { ...m, text: m.text + delta }
            : m
        )
      )
    })

    window.api.onEnd(() => {
      setIsLoading(false)
    })

    window.api.onError((error) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === currentMsgId.current
            ? { ...m, text: `错误: ${JSON.stringify(error)}` }
            : m
        )
      )
      setIsLoading(false)
    })

    const result = await window.api.sendMessage(text)
    if (!result.success) {
      setMessages(prev =>
        prev.map(m =>
          m.id === currentMsgId.current
            ? { ...m, text: `启动失败: ${result.error}` }
            : m
        )
      )
      setIsLoading(false)
    }
  }, [])

  const newSession = useCallback(() => {
    window.api.newSession()
    setMessages([])
  }, [])

  return { messages, sendMessage, newSession, isLoading }
}
```

### ChatView.tsx

```tsx
import { useEffect, useRef } from 'react'
import { useChat } from '../hooks/useChat'
import MessageItem from './MessageItem'
import InputBar from './InputBar'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Plus } from 'lucide-react'

export default function ChatView() {
  const { messages, sendMessage, newSession, isLoading } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={newSession}>
          <Plus className="h-4 w-4 mr-1" />
          新建对话
        </Button>
      </div>
      <ScrollArea className="flex-1 border rounded-lg p-4 bg-white" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground mt-20">
            输入消息开始对话
          </p>
        )}
        {messages.map(msg => (
          <MessageItem key={msg.id} message={msg} />
        ))}
      </ScrollArea>
      <InputBar onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
```

### MessageItem.tsx

```tsx
import { cn } from '../lib/utils'

interface MessageItemProps {
  message: { id: string; role: string; text: string; reasoning?: string }
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('mb-4', isUser ? 'text-right' : 'text-left')}>
      {!isUser && message.reasoning && (
        <div className="text-sm text-muted-foreground italic mb-2 pl-2 border-l-2 border-muted whitespace-pre-wrap">
          {message.reasoning}
        </div>
      )}
      <div
        className={cn(
          'inline-block rounded-lg px-4 py-2 whitespace-pre-wrap text-left max-w-[80%]',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {message.text}
      </div>
    </div>
  )
}
```

### InputBar.tsx

```tsx
import { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Send } from 'lucide-react'

interface InputBarProps {
  onSend: (text: string) => void
  disabled: boolean
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        placeholder="输入消息..."
        disabled={disabled}
      />
      <Button onClick={handleSend} disabled={!text.trim() || disabled}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

## renderer/src/main.tsx

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

## renderer/index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>tdbot</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/main.tsx"></script>
</body>
</html>
```

## 开发工作流

```bash
# 开发模式（热更新）
npm run dev

# 构建
npm run build

# 打包 AppImage
npm run dist
```

`npm run dev` 时 electron-vite 会同时：
1. 启动 Vite dev server（renderer 热更新）
2. 编译 main/preload（文件变更时自动重编译）
3. 启动 Electron 窗口

## 执行步骤

1. `npm install` 新增依赖
2. 初始化 Tailwind CSS（`tailwind.config.ts` + `postcss.config.js`）
3. 初始化 Shadcn/ui → 添加所需组件
4. 创建 `electron.vite.config.ts` 和 `tsconfig` 文件
5. 迁移 `main.js` → `src/main/index.ts`（含多轮对话会话管理）
6. 迁移 `preload.js` → `src/preload/index.ts` + `index.d.ts`
7. 创建 `src/renderer/src/lib/utils.ts`
8. 创建 React 组件（`App.tsx`、`ChatView.tsx`、`MessageItem.tsx`、`InputBar.tsx`）
9. 创建 `useChat` hook
10. 创建 `renderer/index.html` 和 `renderer/src/main.tsx`
11. 删除旧的 `src/renderer/` 文件（index.html, style.css, renderer.js）
12. 更新 `package.json` 的 `main` 和 `scripts`
13. 验证 `npm run dev`
