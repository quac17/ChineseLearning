---
name: video-access
description: >-
  Rules for serving lesson videos and course documents in Vân Kính: free
  preview lessons (YouTube or is_free), paid lessons only after an access check,
  and short-lived signed URLs from Google Cloud Storage. Use when touching video
  upload, streaming, the player, documents download, lesson access, or moving
  storage to GCS. Triggers: "video", "phát video", "quyền xem", "bảo vệ video",
  "signed URL", "GCS", "tải tài liệu", "bài học thử", "preview".
---

# Video and document access

The product is paid video courses, so **leaking a paid video URL is the worst
bug this app can have.**

## Access rule (single source of truth)

A user may watch a lesson / download a document when **any** of these holds:

1. `lessons.is_free = true` (free preview lesson), or the course has
   `courses.is_free = true`;
2. the user is ADMIN;
3. the user is the TEACHER who owns the course (`courses.teacher_id`);
4. the user has a row in `course_enrollments` with `can_view = true`.

This is implemented in `CoursesService.checkUserCourseAccess(courseId, user)`.
Always call it; never copy the logic. If the rule changes (e.g. enrollment
expiry), change it there and in this file.

## Sources

| Lesson type | Who can see it | How it is served |
|---|---|---|
| YouTube (`source_type = 'YOUTUBE'`) | Use **only for free preview / marketing** lessons. An unlisted YouTube link is not protection: anyone with the ID can watch. | Embedded player with `youtube_id`. |
| Upload (`source_type = 'UPLOAD'`) | Free or paid. | Today: `GET /api/lessons/:id/stream` streams from local disk after the access check. Target: GCS signed URL (below). |

When a teacher marks a YouTube lesson as paid (`is_free = false`), the UI must
warn that YouTube cannot protect it.

## Target design: GCS signed URLs

1. Uploads are written to a **private** GCS bucket (no public ACL, uniform
   bucket-level access). `storage_key` stays the object path
   (`videos/<id>.mp4`), so `StorageService` keeps the same interface with a
   GCS implementation behind it (local disk stays for dev).
2. Client asks `GET /api/lessons/:id/play` → server runs the access check →
   returns `{ url, expiresAt }` where `url` is a V4 signed URL valid for
   **1–2 hours** (`GCS_SIGNED_URL_TTL_MIN`, default 120).
3. Never store signed URLs in the DB, never put them in list endpoints
   (`GET /courses` returns lesson metadata + `canWatch`, not URLs), never log
   them.
4. The player requests a fresh URL when it expires or on 403.
5. Documents follow the same pattern with `Content-Disposition: attachment`.
6. Credentials: the Cloud Run service account signs URLs; no JSON key files in
   the repo. Env vars go into `server/.env.example` with placeholder values.

## Must-have tests

For every endpoint that returns a video or document (stream, play, download):

- logged out → 401/403 on a paid lesson, 200 on a free one;
- `studentB@vankinh.vn` (no access) → 403;
- `studentA@vankinh.vn` (enrolled in HSK 1) → 200;
- another teacher → 403; owner teacher and admin → 200;
- after revoking enrollment (`can_view = false`) → 403 again.

Cover these in Jest at service level and the main path in Playwright
(`e2e-playwright` skill).

## Upload rules

- Extension allow-list and size limit from env (`MAX_VIDEO_SIZE_MB`), checked
  in the multer `fileFilter`, plus the MIME type.
- Storage keys are generated server-side (`StorageService.generateStorageKey`);
  never use the client's file name as a path. `resolveFullPath` must keep
  blocking path traversal.
- Delete the stored file when the lesson is deleted or replaced, and when a
  permission check fails after upload.
