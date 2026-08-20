import {
  createPaperLayerId,
  type PaperContentLayer,
} from '@/lib/certificateBuilder'

/**
 * OCR the uploaded certificate image into editable paper layers.
 * Each detected line becomes a cover + text block the admin can drag/edit/delete.
 */
export async function extractPaperTextLayers(
  imageUrl: string,
  onProgress?: (pct: number) => void,
): Promise<PaperContentLayer[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })

  try {
    const result = await worker.recognize(imageUrl)
    const data = result?.data as {
      lines?: Array<{
        text?: string
        confidence?: number
        bbox?: { x0?: number; y0?: number; x1?: number; y1?: number }
      }>
      imageWidth?: number
      imageHeight?: number
    }
    const lines = data?.lines || []
    const imgW = Number(data?.imageWidth) || 0
    const imgH = Number(data?.imageHeight) || 0
    // Fallback size from first bbox if image dims missing
    let maxR = imgW
    let maxB = imgH
    if (!maxR || !maxB) {
      for (const line of lines) {
        const b = line.bbox
        if (!b) continue
        maxR = Math.max(maxR, b.x1 || 0)
        maxB = Math.max(maxB, b.y1 || 0)
      }
    }
    if (maxR < 1 || maxB < 1) return []

    const layers: PaperContentLayer[] = []
    for (const line of lines) {
      const text = String(line.text || '').replace(/\s+/g, ' ').trim()
      if (text.length < 2) continue
      const conf = Number(line.confidence)
      if (Number.isFinite(conf) && conf < 35) continue
      const b = line.bbox
      if (!b) continue
      const padX = 4
      const padY = 2
      const x0 = Math.max(0, (b.x0 || 0) - padX)
      const y0 = Math.max(0, (b.y0 || 0) - padY)
      const x1 = Math.min(maxR, (b.x1 || 0) + padX)
      const y1 = Math.min(maxB, (b.y1 || 0) + padY)
      const wPx = x1 - x0
      const hPx = y1 - y0
      if (wPx < 8 || hPx < 6) continue

      const x = (x0 / maxR) * 100
      const y = (y0 / maxB) * 100
      const w = (wPx / maxR) * 100
      const h = (hPx / maxB) * 100
      const fontSize = Math.min(48, Math.max(10, Math.round((hPx / maxB) * 900)))

      layers.push({
        id: createPaperLayerId(),
        x,
        y,
        w: Math.max(4, w),
        h: Math.max(2.5, h),
        text,
        fontSize,
        color: '#0f172a',
        coverColor: '#ffffff',
        align: 'left',
        fontWeight: 'normal',
        fontStyle: 'normal',
        bind: 'none',
        enabled: true,
      })
    }

    // Merge tiny overlapping fragments — keep larger lines only
    return layers
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .slice(0, 80)
  } finally {
    await worker.terminate()
  }
}
