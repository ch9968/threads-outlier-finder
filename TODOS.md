# TODOS

## API

- [ ] **Prevent duplicate LLM calls on concurrent analysis requests**
  **Priority:** P1
  **File:** `src/app/api/analyze/route.ts:29-40`
  **Description:** The cache check and LLM call are not atomic. Two simultaneous requests for the same postId will both miss the cache and both call Vertex AI. The DB upsert handles write safety, but the duplicate LLM spend is wasteful. Fix with a placeholder row (status: 'pending') before calling the LLM, or an in-memory lock.
  **Added:** v0.2.0 (2026-03-27)

## Completed
