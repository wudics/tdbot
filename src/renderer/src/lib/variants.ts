export const providerVariantLabels: Record<string, Record<string, string>> = {
  opencode: {
    'none': '无推理',
    'minimal': '极简',
    'low': '轻度思考',
    'medium': '中度思考',
    'high': '深度思考',
    'max': '最大深度',
    'xhigh': '极限思考',
  },
  anthropic: {
    'high': '深度思考（默认）',
    'max': '最大思考预算',
  },
  openai: {
    'none': '关闭推理',
    'minimal': '极简推理',
    'low': '轻度推理',
    'medium': '中度推理',
    'high': '深度推理',
    'xhigh': '极致推理',
  },
  google: {
    'low': '轻度思考',
    'high': '深度思考',
  },
}

export function getVariantLabel(providerID: string, variantId: string): string {
  return providerVariantLabels[providerID]?.[variantId]
    || providerVariantLabels['opencode']?.[variantId]
    || variantId
}

export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith('-free')
}

export function capabilityIcons(caps: any): string {
  if (!caps?.input) return ''
  const icons: string[] = []
  if (caps.input.image) icons.push('🖼️')
  if (caps.input.audio) icons.push('🎤')
  if (caps.input.video) icons.push('🎬')
  if (caps.input.pdf) icons.push('📄')
  return icons.length ? ' ' + icons.join('') : ''
}

export function parseVariantsField(field: string): { id: string; label: string }[] {
  if (!field) return []
  return field.split(',').map(pair => {
    const colonIdx = pair.indexOf(':')
    if (colonIdx === -1) return { id: pair.trim(), label: pair.trim() }
    return { id: pair.slice(0, colonIdx).trim(), label: pair.slice(colonIdx + 1).trim() }
  }).filter(v => v.id)
}
