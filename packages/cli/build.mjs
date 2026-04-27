import { build } from 'esbuild'

await build({
  entryPoints: ['src/bin.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/bin.js',
  external: ['better-sqlite3'],
  logLevel: 'info',
})
