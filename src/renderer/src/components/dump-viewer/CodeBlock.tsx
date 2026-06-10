// src/renderer/src/components/dump-viewer/CodeBlock.tsx
//
// Syntax-highlighted code block backed by the lazy Shiki highlighter. Renders a
// plain <pre> immediately (and on any error) so the UI never blocks or breaks,
// then swaps in highlighted HTML once the grammar/theme have loaded. Supports an
// optional line-number gutter (with a real start offset for source excerpts) and
// highlighted lines (e.g. the throwing line in a stack frame).

import { useEffect, useRef, useState, type JSX } from 'react'
import { getHighlighter, getLang, CODE_THEMES, type CodeLang } from '../../lib/highlighter'

interface CodeBlockProps {
  code: string
  /** Language hint (framework name, file ext, or grammar id). */
  lang?: string | CodeLang
  /** Show a line-number gutter. */
  showLineNumbers?: boolean
  /** First line's number (for source excerpts). 1-based. */
  startLine?: number
  /** Line numbers (in gutter terms) to emphasize. */
  highlightLines?: number[]
  className?: string
}

export function CodeBlock({
  code,
  lang,
  showLineNumbers = false,
  startLine = 1,
  highlightLines,
  className = ''
}: CodeBlockProps): JSX.Element {
  const [html, setHtml] = useState<string | null>(null)
  const codeRef = useRef(code)
  codeRef.current = code

  useEffect(() => {
    let cancelled = false
    const resolved = getLang(typeof lang === 'string' ? lang : undefined)
    if (resolved === 'text') {
      setHtml(null)
      return
    }
    getHighlighter()
      .then((hl) =>
        hl.codeToHtml(code, {
          lang: resolved,
          themes: CODE_THEMES,
          defaultColor: false,
          transformers: [
            {
              line(node, line) {
                if (highlightLines?.includes(line)) {
                  const prev = node.properties.class
                  node.properties.class =
                    `${typeof prev === 'string' ? prev : ''} line-highlight`.trim()
                }
              }
            }
          ]
        })
      )
      .then((out) => {
        if (!cancelled) setHtml(out)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, lang, highlightLines])

  const gutter = showLineNumbers ? 'code-block--numbered' : ''
  const offsetStyle = showLineNumbers ? { counterReset: `step ${startLine - 1}` } : undefined

  if (html) {
    return (
      <div
        className={`code-block ${gutter} ${className}`}
        style={offsetStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Fallback / loading state — unstyled-but-readable on the code surface.
  return (
    <pre className={`code-block code-block--plain ${gutter} ${className}`} style={offsetStyle}>
      <code>
        {code.split('\n').map((l, i) => (
          <span key={i} className="line">
            {l}
          </span>
        ))}
      </code>
    </pre>
  )
}
