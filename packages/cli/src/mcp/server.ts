import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { reviewFiles, scanProject, resolveInputPath, findProjectRoot } from './analysis.js'
import { formatReview, formatReviewBatch, formatScan, formatRules } from './format.js'
import { judgeFile } from '../semantic/judge.js'
import { formatSemanticReview } from '../semantic/format.js'

interface TextResult {
  // Index signature matches the SDK's CallToolResult shape.
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

function text(body: string): TextResult {
  return { content: [{ type: 'text', text: body }] }
}

// Injected at build time by esbuild `define` (see build.mjs) from package.json.
declare const __KEEL_VERSION__: string
const VERSION = typeof __KEEL_VERSION__ === 'string' ? __KEEL_VERSION__ : '0.0.0-dev'

/**
 * Builds the Keel MCP server. `cwd` is the directory paths are resolved against
 * (the workspace root when launched by an MCP client).
 */
function buildServer(cwd: string): McpServer {
  const server = new McpServer({ name: 'keel', version: VERSION })

  server.registerTool(
    'keel_review_file',
    {
      title: 'Review a file with Keel',
      description:
        'Analyze a single TypeScript/JavaScript file for AI-code-quality issues (hallucinated imports, dead exports, oversized files, missing error handling, and more) and return its 0–100 score with line-level fixes. Call this right after writing or editing a file to self-correct before moving on.',
      inputSchema: {
        path: z.string().describe('Path to the file to review (absolute, or relative to the workspace root).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ path }) => text(formatReview(reviewFiles([path], cwd)[0]!)),
  )

  server.registerTool(
    'keel_review_files',
    {
      title: 'Review multiple files with Keel',
      description:
        'Analyze several TypeScript/JavaScript files at once and return each one\'s Keel score and issues. Use after a multi-file change to verify the whole edit before finishing.',
      inputSchema: {
        paths: z.array(z.string()).min(1).describe('Paths to review (absolute or relative to the workspace root).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ paths }) => text(formatReviewBatch(reviewFiles(paths, cwd))),
  )

  server.registerTool(
    'keel_scan_project',
    {
      title: 'Scan a project with Keel',
      description:
        'Walk an entire project directory and return an aggregate quality report: overall score, counts of files with errors/warnings, and the lowest-scoring files. Use for a health check or before declaring a task done.',
      inputSchema: {
        path: z.string().optional().describe('Project directory to scan. Defaults to the workspace root.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ path }) => text(formatScan(scanProject(path, cwd))),
  )

  server.registerTool(
    'keel_semantic_review',
    {
      title: 'Semantic LLM review with Keel',
      description:
        'Run a deeper semantic review of one file using an LLM-as-judge — catches logic bugs, misleading names, comment rot, leaky abstractions, and security smells that structural rules miss. Complements keel_review_file. Requires ANTHROPIC_API_KEY in the server environment; returns a clear notice if unset.',
      inputSchema: {
        path: z.string().describe('Path to the file to review (absolute, or relative to the workspace root).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ path }) => {
      const absPath = resolveInputPath(path, cwd)
      const projectRoot = findProjectRoot(absPath, cwd)
      const review = await judgeFile(absPath, projectRoot)
      return text(formatSemanticReview(review))
    },
  )

  server.registerTool(
    'keel_list_rules',
    {
      title: 'List Keel rules',
      description:
        'List every quality rule Keel enforces, what each one catches, and its score penalty. Use to understand what Keel checks for.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => text(formatRules()),
  )

  return server
}

export async function startServer(cwd: string): Promise<void> {
  const server = buildServer(cwd)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Note: never write to stdout here — it carries the JSON-RPC stream.
  process.stderr.write('Keel MCP server running on stdio.\n')
}
