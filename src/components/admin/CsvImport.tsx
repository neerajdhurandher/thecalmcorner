'use client'

import { useState } from 'react'

type Result = {
  ok: boolean
  applied: boolean
  summary: Record<string, number>
  errors: { row: number; message: string }[]
  error?: string
}

type Props = { endpoint: string; title: string; templateHref: string }

export function CsvImport({ endpoint, title, templateHref }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [mode, setMode] = useState<'validate' | 'import'>('validate')

  async function run(apply: boolean) {
    if (!file) return
    setBusy(true)
    setMode(apply ? 'import' : 'validate')
    try {
      const response = await fetch(`${endpoint}?apply=${apply}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'text/csv' },
        body: await file.text(),
      })
      setResult((await response.json()) as Result)
    } catch {
      setResult({
        ok: false,
        applied: false,
        summary: {},
        errors: [],
        error: 'Request failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <details style={{ margin: '0 var(--gutter-h, 40px) 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{title}</summary>
      <div style={{ display: 'grid', gap: 8, padding: '12px 0' }}>
        <p style={{ margin: 0 }}>
          Upload a CSV, validate it first (nothing is saved), then import.{' '}
          <a href={templateHref}>Download template</a>
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setResult(null)
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => run(false)}
          >
            Validate only
          </button>
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => run(true)}
          >
            Import
          </button>
        </div>
        <div role="status" aria-live="polite">
          {result?.error && <p>{result.error}</p>}
          {result && !result.error && (
            <>
              <p>
                {result.ok
                  ? result.applied
                    ? 'Import complete.'
                    : `Valid. Nothing was saved (${mode === 'validate' ? 'validation only' : 'dry run'}).`
                  : 'Nothing was imported. Fix these problems and try again:'}
              </p>
              {Object.keys(result.summary).length > 0 && (
                <p>
                  {Object.entries(result.summary)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(' · ')}
                </p>
              )}
              {result.errors.length > 0 && (
                <ul>
                  {result.errors.slice(0, 50).map((error, index) => (
                    <li key={index}>
                      {error.row > 0 ? `Row ${error.row}: ` : ''}
                      {error.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </details>
  )
}
