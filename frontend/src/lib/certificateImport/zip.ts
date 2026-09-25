/** Minimal ZIP reader for DOCX (store + deflate). No extra dependency. */

function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i
  }
  return -1
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const Ctor = globalThis.DecompressionStream
  if (!Ctor) throw new Error('UNREADABLE')
  const stream = new Blob([data]).stream().pipeThrough(new Ctor('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export async function readZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const eocd = findEocd(view)
  if (eocd < 0) throw new Error('UNREADABLE')
  const count = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const out = new Map<string, Uint8Array>()

  for (let n = 0; n < count; n++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('UNREADABLE')
    }
    const method = view.getUint16(cursor + 10, true)
    const compSize = view.getUint32(cursor + 20, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localOff = view.getUint32(cursor + 42, true)
    const name = new TextDecoder('utf-8').decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen))
    cursor += 46 + nameLen + extraLen + commentLen
    if (!name || name.endsWith('/')) continue
    if (localOff + 30 > bytes.length || view.getUint32(localOff, true) !== 0x04034b50) continue
    const localNameLen = view.getUint16(localOff + 26, true)
    const localExtraLen = view.getUint16(localOff + 28, true)
    const dataStart = localOff + 30 + localNameLen + localExtraLen
    const comp = bytes.subarray(dataStart, dataStart + compSize)
    if (method === 0) out.set(name, comp)
    else if (method === 8) out.set(name, await inflateRaw(comp))
  }
  return out
}

export function zipText(entries: Map<string, Uint8Array>, name: string): string | null {
  const bytes = entries.get(name)
  if (!bytes) return null
  return new TextDecoder('utf-8').decode(bytes)
}
