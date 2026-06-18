# WeKnora 知识库检索

## 目标

将 WeKnora 作为知识检索源，AI 回答问题时可以选择开启知识库检索，检索结果作为上下文辅助 AI 回答。

## 架构

```
用户发送消息
  → 如果 WeKnora 开启 + 已选知识库
    → 调 WeKnora API 检索 → 前 5 条结果 → 拼接为上下文
    → 跟在用户消息前，传给 opencode 回复
  → 否则直接传给 opencode
```

## API 参考

### 获取知识库列表

`GET {weknoraUrl}/api/v1/knowledge-bases`

```bash
curl --location 'http://localhost:8080/api/v1/knowledge-bases' \
--header 'X-API-Key: sk-xxxxx'
```

响应：

```json
{
  "data": [
    { "id": "kb-xxx", "name": "技术文档", ... },
    { "id": "kb-yyy", "name": "产品手册", ... }
  ],
  "success": true
}
```

### 知识检索

`POST {weknoraUrl}/api/v1/knowledge-search`

```bash
curl --location 'http://localhost:8080/api/v1/knowledge-search' \
--header 'X-API-Key: sk-xxxxx' \
--header 'Content-Type: application/json' \
--data '{
    "query": "如何使用知识库",
    "knowledge_base_ids": ["kb-xxx", "kb-yyy"]
}'
```

响应：

```json
{
  "data": [
    {
      "id": "chunk-xxx",
      "content": "知识库是用于存储和检索知识的系统...",
      "knowledge_id": "knowledge-xxx",
      "score": 0.95,
      "knowledge_title": "使用指南",
      "knowledge_filename": "guide.pdf"
    }
  ],
  "success": true
}
```

取前 5 条（按 `score` 降序排列），仅保留 `content`。

## 上下文拼接格式

```
以下是知识库中检索到的相关内容：

1. 知识库是用于存储和检索知识的系统...
2. 知识库支持多种文件格式...

---

[用户原始问题]
```

## 配置

### config.json 新增字段

```json
{
  "weknoraUrl": "http://localhost:8080",
  "weknoraApiKey": "sk-xxx"
}
```

仅存储服务器地址和 API Key，不存储知识库的选择状态（每次会话中自主开关）。

### 设置弹窗 UI

```
┌─ WeKnora 配置 ────────────────────┐
│                                    │
│ 服务器地址: [http://localhost:8080] │
│ API Key:    [*******************]  │
│                                    │
└────────────────────────────────────┘
```

## UI 设计

### 工具栏

```
🧑 [通用助手 ▼]  📚 [关闭 ▼]  🌐 互联网搜索 [⬤——○]  🤖 [deepseek/... ▼]
                 ├ 关闭    ← 默认
                 ├ 加载中...  ← 展开时异步请求 API
                 ├ 全部    ← 检索所有知识库
                 ├ 技术文档 ← 具体知识库
                 └ 产品手册
```

- 配置了 WeKnora URL + API Key 时始终显示下拉框
- 展开时通过 `onFocus` 触发异步加载 KB 列表（`GET /knowledge-bases`）
- 加载中显示"加载中..."（disabled）
- 加载失败显示"⚠ 连接失败，点击重试"，点击后重新请求
- 列表缓存到 state，切换会话不清空，切换工作目录才重置
- 选择即时生效，不写入 config.json

#### 状态流转

```
配置了但未加载       → 下拉框显示，只有"关闭"选项
点击下拉（onFocus）  → 触发 handleWeknoraOpen
  ├ 请求中           → 下拉显示"加载中..."
  ├ 请求成功         → 显示"全部" + 各知识库
  └ 请求失败         → 显示"⚠ 连接失败"，可点击重试
```

## 数据流

```
用户选择知识库 → ChatView state.weknoraKbIds = ["kb-xxx"]
  ↓
用户发送消息 → sendMessage(text)
  ↓
send-message IPC → main/index.ts
  → 如果 weknoraKbIds 不为空
    → POST /knowledge-search { query: text, knowledge_base_ids: weknoraKbIds }
    → 取 response.data 前 5 条
    → 拼接为上下文
    → promptAsync 使用拼接后的文本
  → 否则直接 promptAsync
  ↓
AI 基于知识库内容 + 用户问题回复
```

## IPC 协议

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `search-weknora` | `text, kbIds[]` | `{ content }[]` | 检索知识库，返回前 5 条 |
| `list-weknora-kbs` | — | `{ id, name }[]` | 获取知识库列表 |
| `send-message` | `text, sessionId, weknoraKbIds?` | `{ success }` | 原有，扩展参数；非空时拼接检索上下文 |

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/configStore.ts` | 修改 | `AppConfig` 新增 `weknoraUrl: string` / `weknoraApiKey: string` |
| `src/main/index.ts` | 修改 | 新增 `search-weknora` IPC（调用 WeKnora API 检索，取前 5 条）；新增 `list-weknora-kbs` IPC（调用 `GET /knowledge-bases` 获取列表）；`send-message` 内部根据 `weknoraKbIds` 参数判断是否拼接检索上下文 |
| `src/renderer/src/components/SettingsDialog.tsx` | 修改 | 新增 WeKnora 配置区域（URL + API Key 两输入框） |
| `src/renderer/src/components/ChatView.tsx` | 修改 | 工具栏新增 📚 知识库选择器下拉框（`weknoraConfigured` 控制显隐，`onFocus` 异步加载，加载中/失败状态）；弹出框使用 `bg-white` 白色背景 |
| `src/renderer/src/App.tsx` | 修改 | 新增 `weknoraConfigured` / `weknoraKbs` / `weknoraKbIds` 状态管理 |
| `src/renderer/src/hooks/useChat.ts` | 修改 | `sendMessage` 接受 `weknoraKbIds` 参数传递给 IPC |
| `src/preload/index.ts` | 修改 | 新增 `searchWeknora` / `listWeknoraKbs` IPC |
| `src/preload/index.d.ts` | 修改 | 更新 `AppConfig` 类型 + 新增方法类型 |

## 延后实现

- 标注检索来源（正文中标记来自知识库）
- 上传文档到 WeKnora（通过 WeKnora 自带页面管理）
