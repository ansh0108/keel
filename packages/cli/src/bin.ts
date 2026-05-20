#!/usr/bin/env node
import { program } from 'commander'
import { resolve } from 'node:path'
import { runInit } from './commands/init.js'
import { runRecord } from './commands/record.js'
import { runUi } from './commands/ui.js'
import { runValidate } from './commands/validate.js'
import { runScan } from './commands/scan.js'

const cwd = process.cwd()

program
  .name('keel')
  .description('Causal debugger for AI-generated code quality')
  .version('0.1.0')

program
  .command('init [path]')
  .description('Initialize Keel in a project directory')
  .action((path?: string) => runInit(path ? resolve(path) : cwd))

program
  .command('record [path]')
  .description('Record a Claude Code hook event (reads from stdin)')
  .action((path?: string) => runRecord(path ? resolve(path) : cwd))

program
  .command('ui [path]')
  .description('Open the Keel execution graph UI')
  .option('-p, --port <number>', 'Port to run the UI on', '2701')
  .action((path?: string, opts?: { port?: string }) => {
    const port = parseInt(opts?.port ?? '2701', 10)
    runUi(path ? resolve(path) : cwd, port)
  })

program
  .command('validate [path]')
  .description('Validate replay constraints and promote winners to CLAUDE.md')
  .action((path?: string) => runValidate(path ? resolve(path) : cwd))

program
  .command('scan [path]')
  .description('Scan a project directory (defaults to current directory)')
  .action((path?: string) => runScan(path ? resolve(path) : cwd))

program.parse()
