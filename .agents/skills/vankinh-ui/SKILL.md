---
name: vankinh-ui
description: >-
  The approved Vân Kính (云径) UI design for user-client and the mobile app: a
  course-marketplace layout (white ground, near-black ink, seal-red buy button,
  program colours on covers), Be Vietnam Pro + Noto Serif SC, the round
  path-to-the-clouds logo, component patterns and Vietnamese copy rules. Use
  whenever building, restyling or reviewing any screen of this app. Triggers:
  "thiết kế giao diện", "làm đẹp", "đổi màu", "UI", "giao diện", "trang chủ",
  "trang khoá học", "logo", "restyle", "theo thiết kế".
---

# Vân Kính UI (approved design, 2026-11-21)

The source of truth is the design canvas copied into `docs/design/canvas/`
(read `docs/design/README.md` first). Match it; when this file and a generic
design skill (`design-taste-frontend`, `impeccable`) disagree, **this file
wins**. Do not reintroduce the old "colour chapters" look, gradients, glass or
the old square 云 logo.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | page |
| `--surface` | `#F7F9FA` | secondary blocks, section bands, accordion headers |
| `--line` | `#D1D7DC` | 1px borders of cards, inputs, lists, dividers |
| `--muted` | `#6A6F73` | secondary text (5.1:1 on white) |
| `--ink` | `#1C1D1F` | text, dark buttons, footer, course hero band |
| `--accent` | `#C2321C` | buy / add-to-cart button, links, progress |
| `--accent-press` | `#9E2715` | hover / pressed accent |
| `--rating` | `#B4690E` | stars and score |
| `--badge-bg` / `--badge-ink` | `#FCE8C3` / `#5A3A00` | "Nổi bật" badge |
| `--success` | `#1E6E5C` | paid, completed |
| `--error` | `#8C1D40` | errors (never the accent red) |
| `--focus` | `#1F4FA0` | 3px focus outline |

Program colours, only for covers, goal tiles and program tags (white text on
all four): Easy Steps `#4E8A2E` 易 · YCT `#C46A12` 少 · HSK `#1F4FA0` 考 ·
Giao tiếp `#1E6E5C` 说. Keep `src/lib/modules.ts` and `program_modules` in sync.

Dark mode: bg `#16171A`, surface `#222428`, line `#3E4143`, ink `#F2F3F5`,
muted `#A6ABAF`, accent `#E0553E`.

## Type

- Latin/Vietnamese: **Be Vietnam Pro**. H1 40–56/800, H2 24–32/700, card
  title 16–17/700 (max 2 lines), body 16/400 line-height 1.55, small 13–14.
  Nothing readable below 13px.
- Chinese: **Noto Serif SC** via a `.han` class. Learning content is always
  汉字 · pinyin with tone marks · Vietnamese meaning, e.g. `你好 · nǐ hǎo · xin chào`.

## Components (see `Main.dc.html`)

- **Buttons:** radius 4px, weight 700, height 48 (40 small, 56 CTA). Accent =
  buy / add to cart only, one per view. Black = sign up / log in. Outlined
  (1px ink) = secondary. Text button = accent colour. Disabled = `--line` bg.
- **Search:** pill input, 1px ink border, `--surface` fill, search icon left.
- **Inputs:** 1px `--muted` border, radius 4, focus = 1px ink border + inset
  ring; error = `--error` border + message below tied with `aria-describedby`.
- **Dropdown, radio, checkbox, switch, filter chips (pill), tabs (2px ink
  underline), badges, rating, progress, alerts (tinted bg + 1px border), toast
  (ink, shadow):** exact specs on the canvas. Shadows only on floating things
  (header, dropdown menu, buy box, toast, dialog).
- **Course card:** 16:9 cover (radius 4), title, teacher, rating, price,
  optional "Nổi bật" badge. Covers are real frames from the course video;
  until then a program-colour block with the course Hanzi.
- **Lesson row:** play icon, title, "Xem thử" link for free lessons
  (`is_free`), duration; locked rows show a lock, never a URL.

## Layouts

- **Header:** logo, "Danh mục", wide search, "Dạy trên Vân Kính", cart,
  outlined "Đăng nhập", black "Đăng ký"; category row under it.
- **Home:** photo hero with a white card (H1 + one sentence + accent CTA),
  program tabs + 5-card grid, goal tiles with photos, benefits band,
  latest courses, teacher CTA, dark footer with photo credits.
- **Course detail:** dark hero band (breadcrumb, title, rating, teacher) and a
  sticky buy box on the right (preview, price, "Thêm vào giỏ", "Mua ngay bằng
  QR", what is included); then "Bạn sẽ học được", curriculum accordion,
  description, teacher.
- **Player:** dark top bar, 16:9 video, tabs Từ vựng / Tài liệu / Ghi chú /
  Hỏi đáp, curriculum sidebar with completion checkboxes.
- **App:** 5 bottom tabs (Nổi bật, Tìm kiếm, Khoá của tôi, Ôn tập, Tài khoản),
  sticky price + "Mua bằng QR" bar on course detail.
- Content max-width 1340px (home) / 1180px (course); 24px side padding, 16px
  on phones; everything works at 375px.

## Logo and images

- Logo files: `user-client/public/brand/` (rules in `docs/brand/BRAND.md`).
  Header uses `vankinh-logo-horizontal-full.svg`, dark surfaces
  `…-reversed.svg`; favicon `favicon.svg`. Never retype the wordmark.
- Stock photos: `user-client/public/images/stock/` with `CREDITS.md`. Every
  page that shows one carries the credit line in its footer. Never present a
  stock photo as Vân Kính's own students, teachers or classes.

## Copy

- Vietnamese, short, addresses the learner as "bạn". Prices `499.000 ₫`.
- No invented numbers: ratings, student counts and prices come from data;
  show nothing (not a fake value) when data is missing.
- Locked or paid content always says what to do next (học thử, mua, đăng nhập).

## Before finishing a UI change

- Compare with the matching board in `docs/design/canvas/`.
- Light + dark, 375px and desktop, keyboard focus visible, contrast AA.
- `prefers-reduced-motion` respected for any animation.
