// Manual types for node:sqlite (experimental in Node 22+, stable in Node 24)
declare module 'node:sqlite' {
  interface StatementResultingChanges {
    changes: number
    lastInsertRowid: number | bigint
  }

  interface StatementSync {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): StatementResultingChanges
  }

  class DatabaseSync {
    constructor(location: string, options?: { open?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
