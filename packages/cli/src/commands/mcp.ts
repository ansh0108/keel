import { startServer } from '../mcp/server.js'

/**
 * Runs Keel as a Model Context Protocol server over stdio, exposing the
 * analyzer as live tools so an MCP client (e.g. Claude Code) can review code
 * mid-session and self-correct.
 */
export async function runMcp(projectRoot: string): Promise<void> {
  try {
    await startServer(projectRoot)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Keel MCP server failed to start: ${message}\n`)
    process.exitCode = 1
  }
}
