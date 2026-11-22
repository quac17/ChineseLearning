---
name: video-access
description: >-
  Rules for serving lesson videos and course documents in Chinese Learner: free
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
| Upload (`source_type = 'UPLOAD'`) | Free or paid. | `GET /api/lessons/:id/stream` after the access check: streams from disk on `STORAGE_BACKEND=local`, redirects (302) to a GCS signed URL on `gcs`. |

When a teacher marks a YouTube lesson as paid (`is_free = false`), the UI must
warn that YouTube cannot protect it.

## Storage backends (`StorageService`, `STORAGE_BACKEND`)

`local` (default; dev and e2e) keeps files under `UPLOAD_DIR`. `gcs`
(production) uses a **private** bucket `GCS_BUCKET` (uniform bucket-level
access, no public objects). `storage_key` is the object path on both
(`videos/<time>-<hex>.mp4`), so moving files never touches the DB
(`yarn storage:to-gcs [--dry-run]` copies `server/uploads` to the bucket).

1. **Read.** `GET /lessons/:id/stream` and `GET /documents/:id/download` run
   the access check, then on `gcs` answer `302` to a V4 signed URL valid
   `GCS_SIGNED_URL_TTL_MIN` minutes (default 15), `Cache-Control: no-store`.
   Documents get `response-content-disposition: attachment` with the
   original name. Subtitles and covers are small and still stream through the
   API (`StorageService.pipeTo`).
2. Never store signed URLs in the DB, never put them in list endpoints
   (`GET /courses` returns lesson metadata + `canWatch`, not URLs), never log
   them.
3. The player asks the stream route again when the URL expires (video
   `error` → reload at the same time, at most 3 tries in a row). The
   `<video>` has no `crossOrigin`; the pinyin track is fetched with the
   cookie and given to `<track>` as a `blob:` URL, so following the redirect
   to the bucket needs no CORS for reads.
4. **Upload.** Cloud Run caps request bodies at 32 MB, so videos go straight
   to the bucket: `POST /lessons/upload-url` (owner check, extension, MIME,
   `MAX_VIDEO_SIZE_MB`) → signed PUT URL (`GCS_UPLOAD_URL_TTL_MIN`, default
   30) + an HMAC `uploadToken` tying the key to teacher and course →
   browser PUTs → `POST /lessons/upload/confirm` (or
   `PATCH /lessons/:id/upload/confirm`) re-checks the token, ownership and
   the real object size, deleting an oversized object. On `local` the ticket
   is `{ direct: false }` and the client uses multipart as before.
   Documents, subtitles and covers stay multipart and are moved into the
   bucket after the checks (`persistUpload` / `saveBuffer`). The bucket needs
   a CORS rule allowing `PUT` from the web origin.
5. Credentials: Application Default Credentials (the Cloud Run service
   account, which also needs `roles/iam.serviceAccountTokenCreator` on itself
   to sign). No JSON key files in the repo.

## Must-have tests

For every endpoint that returns a video or document (stream, play, download):

- logged out → 401/403 on a paid lesson, 200 on a free one;
- `studentB@chineselearner.vn` (no access) → 403;
- `studentA@chineselearner.vn` (enrolled in HSK 1) → 200;
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
