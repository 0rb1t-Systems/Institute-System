import fs from 'fs'
import path from 'path'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

let changed = 0
for (const f of walk('src')) {
  let s = fs.readFileSync(f, 'utf8')
  const before = s

  // new Date(a) - new Date(b)  →  Number(new Date(a)) - Number(new Date(b))
  s = s.replace(/new Date\(([^)]+)\)\s*-\s*new Date\(([^)]+)\)/g, 'Number(new Date($1)) - Number(new Date($2))')

  // .reduce((acc, ...) => without typing when starting from {} already fixed;
  // .reduce((sum, p) => sum + p.amount  — leave
  // Object.values(x).reduce((acc: unknown...

  // Force common reduce accumulators
  s = s.replace(/\.reduce\(\((\w+),\s*(\w+)\)\s*=>/g, '.reduce(($1: any, $2: any) =>')
  s = s.replace(/\.reduce\(\((\w+),\s*\[(\w+),\s*(\w+)\]\)\s*=>/g, '.reduce(($1: any, [$2, $3]) =>')

  if (s !== before) {
    // Avoid double-annotating already typed reduces
    s = s.replace(/\.reduce\(\((\w+): any: any,/g, '.reduce(($1: any,')
    fs.writeFileSync(f, s)
    changed += 1
    console.log('updated', f)
  }
}
console.log('files_changed', changed)
