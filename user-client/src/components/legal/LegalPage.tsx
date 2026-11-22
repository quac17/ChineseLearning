import Link from 'next/link';
import { Alert } from '@/components/ui';
import { parseFrontMatter, renderInline, renderMarkdown } from '@/lib/markdown';
import s from './legal.module.css';

/** The two legal pages, linked from each other and from the footer. */
const LEGAL_LINKS = [
  { href: '/dieu-khoan', label: 'Điều khoản sử dụng' },
  { href: '/bao-mat', label: 'Chính sách bảo mật' },
];

/**
 * Renders an owner-edited Markdown file from src/content/legal/. Its front
 * matter sets the title, the "updated" date and `draft: true`, which shows the
 * "Bản nháp" notice until the owner approves the text.
 */
export function LegalPage({ source, path }: { source: string; path: string }) {
  const { meta, body } = parseFrontMatter(source);
  const { nodes, headings } = renderMarkdown(body);
  const draft = meta.draft === 'true';

  return (
    <div className={s.page}>
      <nav className={s.switcher} aria-label="Văn bản pháp lý">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={l.href === path ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <article className={s.article} aria-labelledby="legal-title">
        <h1 id="legal-title" className={s.title}>
          {meta.title}
        </h1>
        {meta.updated && <p className={s.updated}>Áp dụng từ: {renderInline(meta.updated, 'updated')}</p>}
        {draft && (
          <Alert tone="warning" title="Bản nháp — đang chờ chủ dự án duyệt.">
            Nội dung trong ngoặc vuông là phần chủ dự án sẽ bổ sung. Văn bản này chưa có hiệu lực chính thức.
          </Alert>
        )}
        {headings.length > 2 && (
          <nav className={s.toc} aria-label="Mục lục">
            <p className={s.tocTitle}>Mục lục</p>
            <ol>
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text.replace(/^\d+\.\s*/, '')}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className={s.prose}>{nodes}</div>
      </article>
    </div>
  );
}
