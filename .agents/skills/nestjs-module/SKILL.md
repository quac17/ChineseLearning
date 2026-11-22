---
name: nestjs-module
description: >-
  Add or change a NestJS backend feature in server/ the Vân Kính way: module,
  controller, service, class-validator DTOs, role guards and raw SQL through
  DatabaseService. Use when adding an API endpoint, a new resource, a guard,
  or changing server logic. Triggers: "thêm API", "tạo endpoint", "thêm module",
  "sửa backend", "viết service", "add endpoint", "new module".
---

# NestJS module (server/)

The backend is NestJS 10 with **raw SQL via `pg`** (no ORM), cookie JWT auth and
a global `/api` prefix. Copy the shape of an existing module instead of
inventing a new one. `server/src/lessons/` is the most complete reference.

## Layout

```
server/src/<resource>/
├── <resource>.module.ts       imports what it needs (e.g. CoursesModule)
├── <resource>.controller.ts   HTTP only: guards, decorators, DTOs, delegate
├── <resource>.service.ts      business rules + SQL
└── dto/<resource>.dto.ts      class-validator DTOs
```

Register the module in `server/src/app.module.ts`. Shared pieces live in
`server/src/common/` (guards, decorators, `domain.types.ts`, storage, utils).

## Rules

1. **Controllers stay thin.** Validate with a DTO, pick guards, pass
   `@CurrentUser() user: AuthUser` to the service. No SQL in controllers.
2. **Every route declares who may call it.**
   - Logged-in only: `@UseGuards(JwtAuthGuard)`.
   - Role-restricted: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN, Role.TEACHER)`.
   - Public but user-aware (free content, previews): `@UseGuards(OptionalJwtAuthGuard)`,
     user may be `null`.
   - A route with no guard is a deliberate public route; say so in a comment.
3. **Roles are not enough for ownership.** A TEACHER may only touch their own
   courses: call `coursesService.assertCanManageCourse(courseId, user)` before
   any write. A STUDENT may only see paid content through
   `coursesService.checkUserCourseAccess(courseId, user)`. Never re-implement
   these checks inline.
4. **SQL goes through `DatabaseService`** (`query`, `queryOne`, `queryAll`)
   with `$1, $2…` placeholders. Never interpolate values into SQL. Dynamic
   `UPDATE … SET` lists are built as in `LessonsService.updateLesson`: column
   names are hard-coded, only values go into `params`.
5. **IDs** come from `generateId('<prefix>')` in `common/types/domain.types.ts`
   (`VARCHAR(64)`, not UUID/serial).
6. **Errors** use Nest exceptions with a **Vietnamese** user-facing message:
   `NotFoundException('Không tìm thấy bài giảng.')`,
   `ForbiddenException('Bạn chưa được cấp quyền …')`.
   The frontend shows `message` directly.
7. **DTOs**: `class-validator` + `class-transformer`. Multipart booleans and
   numbers need `@Transform` / `@Type` (see `dto/lesson.dto.ts`). Validation
   messages are Vietnamese. The global `ValidationPipe` uses `whitelist: true`,
   so undeclared fields are silently dropped: declare every field you read.
8. **Responses** return DB rows (snake_case) or mapped objects consistently
   with sibling endpoints. If you change a response shape, update
   `user-client/src/lib/types.ts` in the same change.
9. **Uploads** go through multer with an extension allow-list and a size limit
   from env (see `videoUploadInterceptorOptions`). If a later check fails,
   delete the uploaded file (`storage.deleteFile`) before throwing.
10. **Config** comes from `ConfigService` / `process.env` with a default for
    local dev; add every new variable to `server/.env.example`.

## Schema changes

If the feature needs a new table or column, follow the `raw-sql-migration`
skill first.

## Done when

- `yarn server:build` passes.
- Unit tests (Jest, see the `tdd` skill) cover the service rules, especially
  role and ownership checks.
- If a user-visible flow changed, an e2e spec exists or is updated
  (`e2e-playwright` skill).
- The checklist in `CODING_STANDARDS.md` holds for the diff.
