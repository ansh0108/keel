import { readFileSync, existsSync } from 'node:fs'

export function countLines(content: string): number {
  return content.split('\n').length
}

export function readFileSafe(path: string): string | null {
  if (!existsSync(path)) return null
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

export function countFileLines(path: string): number | null {
  const content = readFileSafe(path)
  return content !== null ? countLines(content) : null
}
