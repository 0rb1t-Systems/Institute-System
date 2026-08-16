/**
 * Full TypeScript check (tsc --noEmit).
 * Also fails fast on critical tsconfig issues (e.g. removed baseUrl).
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const r = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
})

const out = `${r.stdout || ''}${r.stderr || ''}`
const critical = out
  .split(/\r?\n/)
  .filter((line) => /TS5102|baseUrl has been removed|Option 'baseUrl'/i.test(line))

if (critical.length) {
  console.error('Critical TypeScript config errors:')
  for (const line of critical) console.error(line)
  process.exit(1)
}

if (r.status === 0) {
  console.log('Typecheck passed.')
  process.exit(0)
}

process.stderr.write(out)
process.exit(r.status ?? 1)
