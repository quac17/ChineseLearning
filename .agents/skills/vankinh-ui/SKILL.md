---
name: vankinh-ui
description: >-
  The Vân Kính (云径) house style for the user-client UI: CSS tokens, per-program
  colour themes (Easy Steps / YCT / HSK / Giao tiếp), light/dark mode, ink-wash
  wave background, Chinese + pinyin typography and Vietnamese copy. Use with
  design-taste-frontend whenever designing, restyling or reviewing any screen
  of this app. Triggers: "thiết kế giao diện", "làm đẹp", "đổi màu", "UI",
  "giao diện", "trang bán khoá học", "landing page", "restyle".
---

# Vân Kính UI house style

Use `design-taste-frontend` for general craft and taste. This skill holds what
is specific to this product and **wins when they disagree**.

## Tokens (src/app/globals.css)

Use CSS variables, never raw hex in components:

| Token | Meaning |
|---|---|
| `--paper` | page background |
| `--card` | card surface |
| `--ink` | main text |
| `--mute` | secondary text |
| `--line` | borders, dividers |
| `--red`, `--gold`, `--jade` | accents; under a program theme `--red`/`--gold` become the program colours |
| `--m`, `--m2`, `--hero` | current program's colours and hero gradient |

- Dark mode is `:root[data-theme='dark']`; the program theme is
  `:root[data-mod]`. Both are set by `ModuleContext`. Every new colour must be
  checked in **both** modes and under at least two programs.
- Program definitions (name, 汉字, colours, gradient) live in
  `src/lib/modules.ts` and mirror the `program_modules` table. Add a program in
  both places.
- Reuse existing classes before adding new ones: `.card`, `.btn` (`.alt`, `.sm`),
  `.chip`, `.tag`, `.alert` (`.error`, …), `.form-grid`, `.field`, `.input`,
  `.tabs`, `.grid`, `.row`, `.table-wrap`, `.stat-card`, `.player`, `.han`.

## Typography

- Vietnamese text: `Be Vietnam Pro`. Chinese characters: `Noto Serif SC`
  through the `.han` class. Never render Hanzi in the Latin font.
- Learning content shows **汉字 + pinyin with tone marks + Vietnamese meaning**,
  in that order, e.g. `你好 · nǐ hǎo · xin chào`. Pinyin uses tone marks
  (nǐ), not numbers (ni3).
- Decorative Hanzi (seals, hero glyphs) must have `aria-hidden="true"` or an
  accessible label.

## Copy

- All UI copy is Vietnamese, friendly and short; address the learner as "bạn".
- Prices in VND: `499.000 ₫` (dot thousands separator, ₫ after the number).
- Locked or paid content always tells the learner what to do next (buy,
  log in, contact the teacher).

## Selling video courses: screens that matter most

1. **Course catalogue**: program colour, level (HSK 1…), lesson count, total
   duration, price or "Miễn phí", preview badge.
2. **Course detail / sales page**: what you will learn, lesson list with
   free-preview lessons (`is_free`) playable, teacher, price, single clear CTA.
3. **Player**: lesson list beside the video, progress, documents to download,
   locked lessons visibly locked.
4. **Checkout / payment result**: amount, QR, status, what happens next.

## Checks before finishing a UI change

- Light + dark, at least two program themes, 375px and desktop.
- Text contrast WCAG AA on `--paper` and `--card`.
- Keyboard focus visible on every interactive element.
- Respect `prefers-reduced-motion` for any animation (the wave background and
  any `transitions-*` motion).
