// src/renderer/src/lib/highlighter.ts
//
// Lazy, singleton Shiki highlighter (the same TextMate-grammar + VS Code theme
// engine torchlight.dev uses). We load the JavaScript regex engine instead of
// the WASM oniguruma build so electron-vite bundles cleanly with no .wasm asset,
// and we register only the languages the app actually renders. Dual themes
// (github-light / github-dark) are emitted as CSS variables so a code block
// follows the app light/dark theme with a single render (see index.css).

import type { HighlighterCore } from 'shiki/core'

export const CODE_THEMES = { light: 'github-light', dark: 'github-dark' } as const

// Languages we can highlight. `getLang` maps loose hints to one of these.
export type CodeLang =
  | 'sql'
  | 'php'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'json'
  | 'text'

let promise: Promise<HighlighterCore> | undefined

// Everything Shiki — core, the JS regex engine, the grammars and themes — is
// dynamically imported so the whole highlighter lands in its own lazy chunk and
// stays out of the main bundle until the first code block is rendered.
export function getHighlighter(): Promise<HighlighterCore> {
  promise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript')
    ])
    return createHighlighterCore({
      themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
      langs: [
        import('shiki/langs/sql.mjs'),
        import('shiki/langs/php.mjs'),
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/python.mjs'),
        import('shiki/langs/go.mjs'),
        import('shiki/langs/json.mjs')
      ],
      engine: createJavaScriptRegexEngine()
    })
  })()
  return promise
}

/** Normalize a framework/file hint into a supported grammar. */
export function getLang(hint: string | undefined): CodeLang {
  const h = (hint ?? '').toLowerCase()
  if (/sql/.test(h)) return 'sql'
  if (/php|laravel|symfony/.test(h)) return 'php'
  if (/tsx?|typescript/.test(h)) return 'typescript'
  if (/jsx?|javascript|node|react|vue/.test(h)) return 'javascript'
  if (/py|python|django|flask|fastapi/.test(h)) return 'python'
  if (/go|golang|gin|echo/.test(h)) return 'go'
  if (/json/.test(h)) return 'json'
  return 'text'
}
