# Coding standards

Read by every agent before writing code and by the `code-review` skill as the
**Standards** axis. Items under "Mandatory" are hard violations; everything
else is a judgement call.

## Mandatory review checklist

A PR is not mergeable while any of these fail.

1. **Every endpoint declares its access.** Each route has
   `JwtAuthGuard` (+ `RolesGuard` / `@Roles`) or `OptionalJwtAuthGuard`, or a
   comment explaining why it is public. Ownership is checked with
   `assertCanManageCourse`; a STUDENT only reaches a course they are enrolled
   in, via `checkUserCourseAccess`.
2. **No paid video or document URL reaches a user without access.** Stream,
   play, signed-URL and download endpoints run the access check first; list
   endpoints never include media URLs or YouTube IDs for locked lessons. See
   `.agents/skills/video-access/SKILL.md`.
3. **SQL is parameterised.** Values go through `$1, $2…` params. Only
   hard-coded column/table names may be concatenated into SQL text.
4. **Payment webhooks verify the signature and are idempotent.** Invalid
   signature → reject; replayed event → no second effect; amount is checked
   against the order; state change + enrollment happen in one transaction.
   See `.agents/skills/payment-integration/SKILL.md`.
5. **Uploads are validated.** Extension allow-list, MIME check, size limit
   from env, server-generated storage keys, file removed when a later check
   fails.

## Conventions

- Backend shape, DTOs, errors: `.agents/skills/nestjs-module/SKILL.md`.
- Schema changes ship with an idempotent migration:
  `.agents/skills/raw-sql-migration/SKILL.md`.
- Frontend data fetching and states: `.agents/skills/nextjs-page/SKILL.md`.
- UI tokens, typography, Vietnamese copy: `.agents/skills/chinese-learner-ui/SKILL.md`.
- Identifiers in English, user-facing text in Vietnamese, terms from
  `GLOSSARY.md`.
- No secrets in code, seed files or logs; new env vars are added to the
  matching `.env.example` with placeholder values.
- Server response shape changes update `user-client/src/lib/types.ts` in the
  same PR.
- New behaviour comes with tests: Jest for service rules (`tdd`), Playwright
  for user flows (`e2e-playwright`).
