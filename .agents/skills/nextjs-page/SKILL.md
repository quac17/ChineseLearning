---
name: nextjs-page
description: >-
  Add or change a page or component in user-client/, the Next.js 14 App Router
  frontend of Chinese Learner: data fetching through apiRequest with HTTP-only cookie
  auth, role-aware UI via useAuth, loading/error states and Vietnamese copy.
  Use when building a screen, form, list or player. Triggers: "tạo trang",
  "thêm trang", "sửa giao diện trang", "thêm form", "component mới",
  "new page", "frontend".
---

# Next.js page (user-client/)

Next.js 14 App Router, React 18, TypeScript, **plain CSS** in
`src/app/globals.css` (no Tailwind, no UI kit). For visual design decisions,
also load the `chinese-learner-ui` skill.

## Layout

```
user-client/src/
├── app/<route>/page.tsx   one folder per route
├── components/            shared components (Header, VideoPlayer, …)
├── context/               AuthContext (user, login/logout), ModuleContext (program theme, light/dark)
└── lib/                   api.ts (apiRequest, buildMediaUrl), types.ts, modules.ts
```

## Rules

1. **All API calls go through `apiRequest<T>(path, options)`** from
   `@/lib/api`. It sends `credentials: 'include'` so the HTTP-only cookie
   `chinese_learner_token` travels with the request. Never read or store the token in
   JS, never use `localStorage` for auth.
2. Media URLs (video stream, document download) are built with
   `buildMediaUrl(path)`. Do not hard-code `http://localhost:4000`.
3. Types for API data live in `@/lib/types.ts` and must match the server
   response. Change both sides in one PR.
4. Interactive pages are client components (`'use client'`). The existing
   pattern: `useEffect` fetch with a `cancelled` flag, plus `loading`,
   `error` and empty states. Every list has all three states.
5. `useSearchParams` must sit under a `<Suspense>` boundary (see
   `app/courses/page.tsx`), or `next build` fails.
6. **Role-aware UI is cosmetic.** Hide buttons with `useAuth().user?.role`,
   but the server is the only gate. Never assume a hidden button protects
   anything.
7. Paid content: rely on the server's `canWatch` / access flags; show the
   locked state with a clear call to action (buy / contact), never the URL.
8. All user-facing text is **Vietnamese**; Chinese is shown with pinyin when
   it is learning content (see `chinese-learner-ui`). Error messages from the API are
   already Vietnamese: show `err.message`.
9. Forms: `className="form-grid"`, fields in `.field`, inputs `.input` /
   `.select` / `.textarea`, submit `.btn`, disable while submitting, show
   errors in `.alert error`.
10. New env vars must be `NEXT_PUBLIC_*` only if they are safe to expose, and
    go into `user-client/.env.example`.

## Done when

- `yarn client:build` passes (it type-checks).
- The page works logged out, as STUDENT with and without access, as TEACHER
  and as ADMIN where relevant. Cover the important path in Playwright
  (`e2e-playwright` skill).
- Light and dark mode both readable; works at 375px width.
