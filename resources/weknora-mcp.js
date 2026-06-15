#!/usr/bin/env node
const readline = require('readline')
const rl = readline.createInterface({ input: process.stdin })

const WEKNORA_URL = process.env.WEKNORA_URL
const WEKNORA_API_KEY = process.env.WEKNORA_API_KEY

function sendMsg(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

const toolDef = [{
  name: 'search',
  description: `在知识库中搜索相关内容，返回检索到的文本片段。
参数：
- query: 搜索查询文本
- kb_ids: 知识库 ID 列表，可选，不传则搜索所有知识库`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询文本' },
      kb_ids: { type: 'array', items: { type: 'string' }, description: '知识库 ID 列表（可选）' },
    },
    required: ['query'],
  },
}]

// 启动即发送 tools/setup（兼容 opencode 主动注册模式）
sendMsg({ jsonrpc: '2.0', method: 'tools/setup', params: { tools: toolDef } })

rl.on('line', (line) => {
  let req
  try { req = JSON.parse(line) } catch { return }

  // 1. initialize 握手
  if (req.method === 'initialize') {
    sendMsg({
      jsonrpc: '2.0', id: req.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'weknora', version: '1.0.0' },
      },
    })
    return
  }

  // 2. tools/list — 标准工具发现（核心修复）
  if (req.method === 'tools/list') {
    sendMsg({ jsonrpc: '2.0', id: req.id, result: { tools: toolDef } })
    return
  }

  // 3. tools/call — 执行搜索
  if (req.method === 'tools/call' && req.params?.name === 'search') {
    const { query, kb_ids } = req.params.arguments || {}
    if (!query) {
      sendMsg({ jsonrpc: '2.0', id: req.id, error: { code: -32000, message: 'query is required' } })
      return
    }
    ;(async () => {
      try {
        const body = { query }
        if (kb_ids && kb_ids.length > 0) body.knowledge_base_ids = kb_ids
        const res = await fetch(`${WEKNORA_URL}/api/v1/knowledge-search`, {
          method: 'POST',
          headers: { 'X-API-Key': WEKNORA_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          sendMsg({ jsonrpc: '2.0', id: req.id, error: { code: -32001, message: `WeKnora API error: ${res.status}` } })
          return
        }
        const data = await res.json()
        const items = (data.data || []).slice(0, 5)
        const result = items.map((item, i) => `${i + 1}. ${item.content}`).join('\n\n')
        sendMsg({
          jsonrpc: '2.0', id: req.id,
          result: { content: [{ type: 'text', text: result || '未检索到相关内容' }] },
        })
      } catch (err) {
        sendMsg({ jsonrpc: '2.0', id: req.id, error: { code: -32002, message: err.message } })
      }
    })()
    return
  }
})
