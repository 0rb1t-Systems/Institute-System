/** Ambient shims for libraries used without complete type packages. */

declare module 'jspdf-autotable' {
  import type { jsPDF } from 'jspdf'
  export interface UserOptions {
    startY?: number
    head?: any[][]
    body?: any[][]
    theme?: string
    styles?: Record<string, any>
    headStyles?: Record<string, any>
    columnStyles?: Record<string, any>
    margin?: Record<string, number> | number
    [key: string]: any
  }
  export default function autoTable(doc: jsPDF, options: UserOptions): jsPDF
}

import type { jsPDF } from 'jspdf'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
    lastAutoTable?: { finalY?: number }
    font?: (...args: any[]) => any
  }
}

import 'react'

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}
