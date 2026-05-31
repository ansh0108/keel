// IMPORTANT: Pricing constants below must be manually updated when model pricing changes.
// Check provider pricing pages periodically — model prices change without notice.
// Last updated: May 2026.

import { getEncoding } from 'js-tiktoken'

// Pricing per 1,000 tokens (USD) — update these constants at the top of this file when rates change
const PRICING: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  'gpt-4o':            { inputPer1K: 0.005,   outputPer1K: 0.015  },
  'gpt-4o-mini':       { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  'claude-sonnet-4-6': { inputPer1K: 0.003,   outputPer1K: 0.015  },
  'claude-haiku-4-5':  { inputPer1K: 0.0008,  outputPer1K: 0.004  },
}

const DEFAULT_MODEL = 'gpt-4o'

let enc: ReturnType<typeof getEncoding> | null = null

function getEncoder() {
  if (!enc) enc = getEncoding('cl100k_base')
  return enc
}

export function estimateTokens(text: string): number {
  try {
    return getEncoder().encode(text).length
  } catch {
    return Math.ceil(text.length / 4)
  }
}

function estimateCost(inputTokens: number, outputTokens: number, model = DEFAULT_MODEL): number {
  const pricing = PRICING[model] ?? PRICING[DEFAULT_MODEL] ?? { inputPer1K: 0.005, outputPer1K: 0.015 }
  return (inputTokens / 1000) * pricing.inputPer1K + (outputTokens / 1000) * pricing.outputPer1K
}

export function formatTokenCostLine(inputTokens: number, outputTokens: number, model = DEFAULT_MODEL): string {
  const total = inputTokens + outputTokens
  const cost = estimateCost(inputTokens, outputTokens, model)
  const costStr = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
  return `~${total.toLocaleString()} tokens · ${costStr}`
}
