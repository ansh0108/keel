import { SourceFile } from 'ts-morph'
import type { ArchViolation } from '@keelcode/core'

// Heuristic: detect when a single file imports from 3+ distinct concern layers
const UI_IMPORTS = ['react', 'jsx', 'tsx', 'styled', '@emotion', 'tailwind']
const DATA_IMPORTS = ['axios', 'fetch', 'prisma', 'drizzle', 'sqlite', 'pg', 'mysql']
const ROUTING_IMPORTS = ['react-router', 'next/router', 'next/navigation', 'wouter']
const STATE_IMPORTS = ['zustand', 'jotai', 'recoil', 'redux', '@reduxjs']

export function checkMixedResponsibilities(
  sourceFile: SourceFile,
): ArchViolation | null {
  const imports = sourceFile
    .getImportDeclarations()
    .map((d) => d.getModuleSpecifierValue())

  const concerns: string[] = []

  if (imports.some((i) => UI_IMPORTS.some((u) => i.includes(u)))) concerns.push('UI rendering')
  if (imports.some((i) => DATA_IMPORTS.some((d) => i.includes(d)))) concerns.push('data access')
  if (imports.some((i) => ROUTING_IMPORTS.some((r) => i.includes(r)))) concerns.push('routing')
  if (imports.some((i) => STATE_IMPORTS.some((s) => i.includes(s)))) concerns.push('state management')

  if (concerns.length < 3) return null

  const path = sourceFile.getFilePath()
  return {
    type: 'mixed_responsibilities',
    severity: 'warning',
    file: path,
    message: `${path} mixes ${concerns.join(', ')}`,
    suggestion: `Extract each concern into its own module. UI components should not import database or routing logic directly.`,
  }
}
