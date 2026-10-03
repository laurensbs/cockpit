export type CsvCell = string | number | null | undefined

/** One cell: numbers as they are, text quoted when it holds the separator, a quote or a line break. */
function cell(value: CsvCell, separator: string): string {
  if (value == null) return ''
  const text = typeof value === 'number' ? String(value) : value
  return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV the way Dutch spreadsheets expect it: a BOM so accents survive, semicolons between cells
 * (what Excel in NL uses by default; Numbers and Google Sheets detect it), rows ending in CRLF.
 */
export function toCsv(rows: readonly (readonly CsvCell[])[], separator = ';'): string {
  return `﻿${rows.map((row) => row.map((v) => cell(v, separator)).join(separator)).join('\r\n')}\r\n`
}
