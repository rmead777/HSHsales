/** Build a CSV string (RFC 4180 quoting) from rows and an ordered column list. */
export function toCsv<T>(rows: T[], columns: Array<{ header: string; value: (row: T) => unknown }>): string {
  const escape = (v: unknown): string => {
    if (v == null) return ''
    const s = String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map((c) => escape(c.header)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(','))
  return lines.join('\r\n')
}

/** Save a CSV file in the browser (Excel opens it directly). */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Cents -> plain dollars for spreadsheets ("1234.50"). */
export const centsToDollars = (cents: number | null | undefined): string =>
  cents == null ? '' : (cents / 100).toFixed(2)
