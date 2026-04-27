import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type DbClient = DatabaseType

export function createDbClient(dbPath: string): DatabaseType {
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(CREATE_TABLES_SQL)

  return db
}

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    root_node_id TEXT NOT NULL,
    files_modified TEXT NOT NULL DEFAULT '[]',
    quality_summary TEXT
  );

  CREATE TABLE IF NOT EXISTS execution_nodes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    parent_id TEXT,
    branch_id TEXT NOT NULL DEFAULT 'main',
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    input TEXT,
    output TEXT,
    files_changed TEXT NOT NULL DEFAULT '[]',
    quality_metrics_id TEXT
  );

  CREATE TABLE IF NOT EXISTS quality_metrics (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    overall_score REAL NOT NULL,
    files_analyzed TEXT NOT NULL DEFAULT '[]',
    violations TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    fork_node_id TEXT NOT NULL,
    parent_branch_id TEXT NOT NULL DEFAULT 'main',
    injected_constraints TEXT NOT NULL DEFAULT '[]',
    label TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS constraints (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    rule TEXT NOT NULL,
    prompt TEXT NOT NULL,
    validated_at INTEGER NOT NULL,
    delta_score REAL NOT NULL
  );
`
