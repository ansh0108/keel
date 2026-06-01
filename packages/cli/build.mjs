import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['src/bin.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/bin.js',
  external: ['better-sqlite3'],
  define: { __KEEL_VERSION__: JSON.stringify(version) },
  logLevel: 'info',
})
