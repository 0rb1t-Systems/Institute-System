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

const root = path.resolve('src')
let changed = 0

for (const f of walk(root)) {
  let s = fs.readFileSync(f, 'utf8')
  const before = s

  s = s.replace(/\b(const|let)\s+([A-Za-z_][\w]*)\s*=\s*\{\s*\}/g, '$1 $2: any = {}')

  s = s.replace(/([,(]\s*)([A-Za-z_][\w]*)\s*=\s*\{\s*\}(\s*[,)])/g, (m, a, name, c) => {
    if (m.includes(': any')) return m
    return `${a}${name}: any = {}${c}`
  })

  if (s !== before) {
    fs.writeFileSync(f, s)
    changed += 1
    console.log('updated', path.relative(process.cwd(), f))
  }
}

console.log('files_changed', changed)
