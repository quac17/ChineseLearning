import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A deliberately small Markdown renderer for owner-edited content files
 * (src/content/legal/*.md). It builds React elements, never raw HTML, so a
 * content file cannot inject markup. Supported:
 *
 *   front matter between `---` lines (`key: value`, `# comments`)
 *   ## heading, ### heading
 *   paragraphs (lines joined until a blank line)
 *   - bullet lists, 1. numbered lists
 *   **bold**, [text](/link), and [placeholder] (square brackets with no link),
 *   which is highlighted so unfilled placeholders stand out.
 */

export interface MarkdownDoc {
  meta: Record<string, string>;
  body: string;
}

export function parseFrontMatter(source: string): MarkdownDoc {
  const text = source.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon < 1) continue;
    meta[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }
  return { meta, body: text.slice(match[0].length) };
}

/** "Điều khoản sử dụng" → "dieu-khoan-su-dung", for heading anchors. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\[([^\]]+)\]/g;

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={key}>{renderInline(m[1], key)}</strong>);
    } else if (m[2] !== undefined) {
      const href = m[3];
      out.push(
        href.startsWith('/') ? (
          <Link key={key} href={href}>
            {m[2]}
          </Link>
        ) : (
          <a key={key} href={href} rel="noopener noreferrer" target="_blank">
            {m[2]}
          </a>
        ),
      );
    } else {
      out.push(
        <mark key={key} data-placeholder="">
          [{m[4]}]
        </mark>,
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface Heading {
  id: string;
  text: string;
}

/** Renders the body and lists its `##` headings (for a table of contents). */
export function renderMarkdown(body: string): { nodes: ReactNode[]; headings: Heading[] } {
  const nodes: ReactNode[] = [];
  const headings: Heading[] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    const key = `p${k++}`;
    nodes.push(<p key={key}>{renderInline(para.join(' '), key)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const key = `l${k++}`;
    const items = list.items.map((item, j) => <li key={j}>{renderInline(item, `${key}-${j}`)}</li>);
    nodes.push(list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+\.\s+(.+)$/.exec(line);

    if (!line) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      const text = heading[2];
      const id = slugify(text);
      const key = `h${k++}`;
      if (heading[1] === '##') {
        headings.push({ id, text });
        nodes.push(<h2 key={key} id={id}>{renderInline(text, key)}</h2>);
      } else {
        nodes.push(<h3 key={key} id={id}>{renderInline(text, key)}</h3>);
      }
    } else if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (list) {
      // A wrapped line continues the current list item.
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return { nodes, headings };
}

