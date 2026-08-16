/**
 * Strict TypeScript debt tracker (`npm run typecheck:full`).
 * Daily gate remains `npm run typecheck` (tsconfig.json, strict:false).
 * This script fails if error count rises above the committed baseline.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'scripts', 'strict-error-baseline.json')

const r = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.strict.json', '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
})

const out = `${r.stdout || ''}${r.stderr || ''}`
const errorLines = out.split(/\r?\n/).filter((line) => /error TS\d+:/.test(line))
const count = errorLines.length

let baseline = { count: count, updated: new Date().toISOString().slice(0, 10) }
if (fs.existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  } catch {
    /* use fresh */
  }
}

const limit = Number(baseline.count)
console.log(`Strict typecheck: ${count} error(s) (baseline ≤ ${limit}).`)

if (count === 0) {
  console.log('Strict typecheck passed with zero errors.')
  process.exit(0)
}

if (count > limit) {
  console.error(`Strict debt increased: ${count} > baseline ${limit}.`)
  console.error('Fix new errors or intentionally raise scripts/strict-error-baseline.json after review.')
  process.stderr.write(errorLines.slice(0, 30).join('\n') + (errorLines.length > 30 ? `\n… +${errorLines.length - 30} more\n` : '\n'))
  process.exit(1)
}

if (count < limit) {
  const next = { count, updated: new Date().toISOString().slice(0, 10) }
  fs.writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n')
  console.log(`Baseline lowered ${limit} → ${count} (saved).`)
}

process.exit(0)
