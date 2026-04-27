import { randomUUID } from 'node:crypto'
import { countLines } from '../parsers/file-utils.js'
import type { ExecutionNode, FileChange, NodeType } from '@keel/core'
import type { HookEvent, WriteEvent, EditEvent, BashEvent } from '../parsers/hook-event.js'

export function buildNodeFromEvent(
  event: HookEvent,
  sessionId: string,
  parentId: string | null,
  branchId: string,
): ExecutionNode {
  const base = {
    id: randomUUID(),
    sessionId,
    parentId,
    branchId,
    timestamp: Date.now(),
    qualityMetricsId: null,
  }

  switch (event.tool_name) {
    case 'Write':
      return buildWriteNode(base, event)
    case 'Edit':
      return buildEditNode(base, event)
    case 'Bash':
      return buildBashNode(base, event)
  }
}

function buildWriteNode(
  base: Omit<ExecutionNode, 'type' | 'input' | 'output' | 'filesChanged'>,
  event: WriteEvent,
): ExecutionNode {
  const lineCount = countLines(event.tool_input.content)
  const fileChange: FileChange = {
    path: event.tool_input.file_path,
    type: 'created',
    lineCountBefore: null,
    lineCountAfter: lineCount,
  }

  return {
    ...base,
    type: 'file_write' satisfies NodeType,
    input: { path: event.tool_input.file_path },
    output: { lineCount },
    filesChanged: [fileChange],
  }
}

function buildEditNode(
  base: Omit<ExecutionNode, 'type' | 'input' | 'output' | 'filesChanged'>,
  event: EditEvent,
): ExecutionNode {
  const fileChange: FileChange = {
    path: event.tool_input.file_path,
    type: 'modified',
    lineCountBefore: null,
    lineCountAfter: null,
  }

  return {
    ...base,
    type: 'file_edit' satisfies NodeType,
    input: { path: event.tool_input.file_path, oldString: event.tool_input.old_string },
    output: { newString: event.tool_input.new_string },
    filesChanged: [fileChange],
  }
}

function buildBashNode(
  base: Omit<ExecutionNode, 'type' | 'input' | 'output' | 'filesChanged'>,
  event: BashEvent,
): ExecutionNode {
  return {
    ...base,
    type: 'bash_exec' satisfies NodeType,
    input: { command: event.tool_input.command },
    output: event.tool_response ?? null,
    filesChanged: [],
  }
}
