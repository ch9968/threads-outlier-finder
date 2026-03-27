# TODOS

## API

- [ ] **Prevent duplicate LLM calls on concurrent analysis requests**
  **Priority:** P1
  **File:** `src/app/api/analyze/route.ts:29-40`
  **Description:** The cache check and LLM call are not atomic. Two simultaneous requests for the same postId will both miss the cache and both call Vertex AI. The DB upsert handles write safety, but the duplicate LLM spend is wasteful. Fix with a placeholder row (status: 'pending') before calling the LLM, or an in-memory lock.
  **Added:** v0.2.0 (2026-03-27)

- [ ] **Pattern analysis cache: key by post IDs hash instead of item_count**
  **Priority:** P2
  **File:** `src/app/collection/page.tsx:73-90`
  **Description:** Page-level pattern cache is keyed by `item_count` only. Swapping posts without changing count shows stale patterns until "Re-analyze" is clicked. Fix: add `post_ids_hash` column to `pattern_analyses` table via migration, compute SHA-256 of sorted post IDs, and use as cache key.
  **Added:** v0.3.0 (2026-03-28)


## Completed
