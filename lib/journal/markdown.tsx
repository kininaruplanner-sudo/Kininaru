/**
 * Kininaru — lightweight journal formatting engine.
 *
 * The journal stays a PLAIN-TEXT field in the database (no schema change, no
 * migration). This module adds a small, familiar markdown-style syntax on top:
 *
 *   # Titre          -> heading 1
 *   ## Sous-titre    -> heading 2
 *   - [ ] tâche      -> checklist (interactive in preview)
 *   - [x] fait       -> checklist (checked)
 *   - point          -> bullet list
 *   1. étape         -> numbered list
 *   > citation       -> blockquote
 *   ---              -> separator
 *   **gras** / *italique* / __souligné__
 *   [texte](https://…) -> link
 *   ![alt](https://…img) -> image (lazy-loaded, width-capped)
 *   😊               -> emoji pass-through
 *
 * The preview is built from React elements only — text is never injected
 * with dangerouslySetInnerHTML, so there is no XSS surface. Everything that
 * looks like HTML is escaped by React automatically.
 */

import type { ReactNode } from 'react'
import { Fragment } from 'react'

/* ------------------------------------------------------------------ */
/* Inline formatting (bold / italic / underline / code / links)        */
/* ------------------------------------------------------------------ */

function isSafeUrl(url: string): boolean {
  const u = url.trim()
  if (/^(https?:|mailto:|tel:)/i.test(u)) return true
  if (u.startsWith('/') || u.startsWith('#')) return true
  return false
}

const INLINE_RE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]\n]+\]\(([^)\s]+)\))/g

let inlineKey = 0

/** Renders the inline formatting of a single line of text. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null

  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    const token = m[0]
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const key = `i${inlineKey++}`

    if (token.startsWith('**') && token.length > 4) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(token.slice(2, -2))}
        </strong>
      )
    } else if (token.startsWith('__') && token.length > 4) {
      nodes.push(
        <u key={key} className="underline decoration-primary/60 underline-offset-2">
          {renderInline(token.slice(2, -2))}
        </u>
      )
    } else if (token.startsWith('`') && token.length > 2) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-primary"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('[') && m[2] && isSafeUrl(m[2])) {
      const label = token.slice(token.indexOf(']') + 2, -1)
      const external = /^https?:/i.test(m[2])
      nodes.push(
        <a
          key={key}
          href={m[2]}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary transition-smooth"
        >
          {renderInline(label)}
        </a>
      )
    } else if (token.startsWith('*') && token.length > 2) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1))}
        </em>
      )
    } else {
      nodes.push(token)
    }
    last = m.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/* ------------------------------------------------------------------ */
/* Block rendering                                                     */
/* ------------------------------------------------------------------ */

export interface RenderOptions {
  /** Called when a checklist box is toggled in the preview (line index). */
  onToggleCheck?: (lineIndex: number) => void
}

const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/

interface ListGroup {
  type: 'bullet' | 'numbered' | 'checklist'
  items: { text: string; checked: boolean; lineIndex: number }[]
}

/** Renders journal markdown as React blocks. Safe by construction. */
export function renderMarkdown(text: string, opts: RenderOptions = {}): ReactNode[] {
  const source = (text ?? '').replace(/\r\n/g, '\n')
  const lines = source.split('\n')
  const out: ReactNode[] = []
  let list: ListGroup | null = null
  let quoteLines: string[] = []
  let blockKey = 0

  const flushQuote = () => {
    if (quoteLines.length === 0) return
    out.push(
      <blockquote
        key={`bq${blockKey++}`}
        className="border-l-[3px] border-primary/50 bg-primary/[0.04] rounded-r-xl px-4 py-2.5 my-2 text-foreground/90 italic"
      >
        {quoteLines.map((l, i) => (
          <p key={i} className="leading-relaxed">
            {renderInline(l)}
          </p>
        ))}
      </blockquote>
    )
    quoteLines = []
  }

  const flushList = () => {
    if (!list) return
    const group = list
    list = null
    if (group.type === 'checklist') {
      out.push(
        <ul key={`cl${blockKey++}`} className="space-y-1.5 my-2">
          {group.items.map((item) => (
            <li key={item.lineIndex} className="flex items-start gap-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.checked}
                onClick={() => opts.onToggleCheck?.(item.lineIndex)}
                className={cnCheck(item.checked)}
              >
                {item.checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={cnText(item.checked)}>{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>
      )
    } else {
      const Tag = group.type === 'numbered' ? 'ol' : 'ul'
      out.push(
        <Tag
          key={`l${blockKey++}`}
          className={
            group.type === 'numbered'
              ? 'list-decimal list-inside space-y-1 my-2 pl-1 marker:text-primary/70'
              : 'list-disc list-inside space-y-1 my-2 pl-1 marker:text-primary/70'
          }
        >
          {group.items.map((item) => (
            <li key={item.lineIndex} className="leading-relaxed text-foreground/90">
              {renderInline(item.text)}
            </li>
          ))}
        </Tag>
      )
    }
  }

  const pushLine = (line: string, lineIndex: number) => {
    const trimmed = line.trim()

    // Images — a standalone image line
    const img = trimmed.match(IMAGE_RE)
    if (img && isSafeUrl(img[2])) {
      flushQuote()
      flushList()
      out.push(
        <p key={`img${blockKey++}`} className="my-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img[2]}
            alt={img[1] || 'Image du journal'}
            loading="lazy"
            className="max-w-full max-h-72 rounded-xl border border-border object-contain"
          />
        </p>
      )
      return
    }

    // Horizontal separator
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      flushQuote()
      flushList()
      out.push(<hr key={`hr${blockKey++}`} className="my-3 border-border" />)
      return
    }

    // Headings
    const h = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      flushQuote()
      flushList()
      const level = h[1].length
      const cls =
        level === 1
          ? 'text-xl font-serif font-bold text-foreground mt-5 mb-2'
          : level === 2
            ? 'text-lg font-serif font-bold text-foreground mt-4 mb-1.5'
            : 'text-base font-semibold text-foreground mt-3 mb-1'
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      out.push(
        <Tag key={`h${blockKey++}`} className={cls}>
          {renderInline(h[2])}
        </Tag>
      )
      return
    }

    // Blockquote
    const q = line.match(/^>\s?(.*)$/)
    if (q) {
      flushList()
      quoteLines.push(q[1])
      return
    }

    // Checklist
    const cl = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (cl) {
      flushQuote()
      if (!list || list.type !== 'checklist') {
        flushList()
        list = { type: 'checklist', items: [] }
      }
      list.items.push({
        text: cl[2],
        checked: cl[1].toLowerCase() === 'x',
        lineIndex,
      })
      return
    }

    // Bullet list
    const bl = line.match(/^\s*[-*]\s+(.+)$/)
    if (bl) {
      flushQuote()
      if (!list || list.type !== 'bullet') {
        flushList()
        list = { type: 'bullet', items: [] }
      }
      list.items.push({ text: bl[1], checked: false, lineIndex })
      return
    }

    // Numbered list
    const nl = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (nl) {
      flushQuote()
      if (!list || list.type !== 'numbered') {
        flushList()
        list = { type: 'numbered', items: [] }
      }
      list.items.push({ text: nl[1], checked: false, lineIndex })
      return
    }

    // Plain paragraph
    flushQuote()
    flushList()
    if (line.trim() === '') {
      out.push(<div key={`sp${blockKey++}`} className="h-2.5" />)
      return
    }
    out.push(
      <p key={`p${blockKey++}`} className="leading-relaxed text-foreground/90">
        {renderInline(line)}
      </p>
    )
  }

  lines.forEach((line, i) => pushLine(line, i))
  flushQuote()
  flushList()

  return out.length === 0 ? [<p key="empty" className="text-muted-foreground italic">…</p>] : out
}

function cnCheck(checked: boolean): string {
  return [
    'mt-0.5 w-[18px] h-[18px] shrink-0 rounded-[6px] border-2 flex items-center justify-center transition-smooth',
    checked ? 'bg-kin-sage border-kin-sage' : 'border-border hover:border-primary cursor-pointer',
    checked ? 'cursor-default' : '',
  ].join(' ')
}

function cnText(checked: boolean): string {
  return checked
    ? 'flex-1 text-sm text-muted-foreground line-through decoration-muted-foreground/60'
    : 'flex-1 text-sm text-foreground/90'
}

/* ------------------------------------------------------------------ */
/* Toolbar helpers (insert / wrap at the textarea selection)           */
/* ------------------------------------------------------------------ */

/** Sets a React-controlled textarea value the way React expects it. */
function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set
  if (setter) setter.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.focus()
}

/** Inserts raw text at the cursor (or replaces the selection). */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const { selectionStart: s, selectionEnd: e } = textarea
  const value = textarea.value
  setTextareaValue(textarea, value.slice(0, s) + text + value.slice(e))
  const pos = s + text.length
  requestAnimationFrame(() => textarea.setSelectionRange(pos, pos))
}

/** Wraps the selection with a prefix/suffix (e.g. ** for bold). */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder?: string
) {
  const { selectionStart: s, selectionEnd: e } = textarea
  const selected = textarea.value.slice(s, e)
  const inner = selected || placeholder || ''
  setTextareaValue(textarea, textarea.value.slice(0, s) + before + inner + after + textarea.value.slice(e))
  if (selected) {
    requestAnimationFrame(() => textarea.setSelectionRange(s + before.length, s + before.length + inner.length))
  } else {
    requestAnimationFrame(() => textarea.setSelectionRange(s + before.length, s + before.length + inner.length))
  }
}

/** Prepends a block prefix to the current line (e.g. "- " or "> "). */
export function blockAtCursor(textarea: HTMLTextAreaElement, prefix: string) {
  const { selectionStart: s } = textarea
  const value = textarea.value
  const lineStart = value.lastIndexOf('\n', s - 1) + 1
  setTextareaValue(
    textarea,
    value.slice(0, lineStart) + prefix + value.slice(lineStart)
  )
  requestAnimationFrame(() => textarea.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length))
}

/** Returns a Fragment import guard for tree-shaking (unused by consumers). */
export { Fragment }
