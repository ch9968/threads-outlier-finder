# Changelog

## [0.1.5.0] - 2026-03-28 — Phase 3B: Cross-Collection Pattern Analysis

### Added

- `/api/pattern-analyze` route with Vertex AI streaming, Zod-validated pattern output, and DB caching
- `PatternStream` client component handling streaming responses, error states, and cached pattern display
- `PatternCard` and `PatternCardSkeleton` components for pattern results with evidence and action guides
- `buildPatternPrompt` with prompt injection guard (code-block sandboxing) and Korean instructions
- `parsePatternResponse` and `extractJsonFromResponse` for structured LLM output extraction
- Pattern schema validation (PatternCardSchema, PatternEvidenceSchema) enforcing minimum 2 evidence items
- Page-level pattern cache lookup by item_count on collection page
- Custom not-found page matching dark theme (ISSUE-001)
- 25 unit tests for pattern schemas, prompt builder, JSON extraction, and response parsing

### Fixed

- Removed stale route-level cache from pattern-analyze route, documented cache key limitation
- Prompt injection defense added to pattern prompt (code-block boundary + ignore instruction)
- Empty cache prevention: skip insert when no valid patterns parsed from LLM
- Vertex AI model initialization error now returns 503 instead of crashing

### Changed

- Collection page integrates PatternStream section above post list (3+ items required)
- PostCard prop renamed from `id` to `postId` for clarity
- TODOS.md updated with P2 item for post-IDs-hash cache key improvement

## [0.1.4.0] - 2026-03-27 — Phase 2: AI Analysis Pipeline

### Added

- AI analysis pipeline with Vertex AI Gemini streaming for 6-dimension post analysis (hook, emotion, structure, CTA, conversation, sharing)
- `/api/analyze` route with Zod validation, cache check, streaming response, and DB persistence
- `/analysis/[postId]` page with progressive dimension card rendering during stream
- `AnalysisStream` client component with streaming text decoder, error marker detection, and abort cleanup
- `DimensionCard` and `MetadataCard` components for displaying analysis results
- `buildAnalysisPrompt` and `parseAnalysisResponse` for structured LLM interaction
- Vertex AI client singleton with GCP service account key support (Vercel) and ADC fallback (local)
- 11 new unit tests for scraping cooldown logic, Apify error cleanup, and data processing paths
- TODOS.md with P1 items for concurrent analysis deduplication

### Fixed

- Pending job cleanup when Apify call fails (ISSUE-001) — job no longer blocks future requests
- Apify `maxItems` parameter now correctly passes to actor input
- Vertex AI model ID synced between DEFAULT_MODEL and .env.example
- `JSON.parse` on GCP_SERVICE_ACCOUNT_KEY now wrapped in try/catch with descriptive error
- `parseAnalysisResponse` extracted outside `.map()` loop to avoid redundant parsing during streaming
- Analysis page URL param validated as UUID via Zod
- Analysis response parser handles edge cases (empty sections, partial streaming output)

## [0.1.3.0] - 2026-03-27 — Collection UI

### Added

- Collection page (`/collection`) with saved outlier posts, account filter chips, and optimistic removal
- `toggleCollectionItem` and `removeFromCollection` server actions with UUID validation and race condition handling (23505 duplicate key)
- `getCollectionPostIds` server action to hydrate collection state on results page
- Heart toggle button on post cards (optimistic UI with error revert)
- `CollectionFilter` component with pill-shaped filter chips per DESIGN.md spec
- Collection link in results page navigation header
- Unit tests for cn utility, scraping server actions, and middleware auth token

### Changed

- Post card grid updated from 3-column to 4-column layout (added collection toggle column)
- Results page fetches collection state in parallel with posts (scoped to current account)
- Dead test variables removed from collection test file

## [0.1.2.0] - 2026-03-27 — Apify Actor Swap + ABORTED Run Handling

### Changed

- Replaced `automation-lab/threads-scraper` with `futurizerush/meta-threads-scraper` (6 posts → 150-200 posts per scrape)
- Flattened Apify schema from discriminated union (profile/post) to single flat post schema with denormalized profile data
- Actor input simplified (removed `mode` and `includeProfile` params)
- Profile extraction via `extractProfileFromPost()` helper instead of separate profile rows

### Fixed

- ABORTED Apify runs now treated as partial success (data still processed if dataset has items)
- Added `ABORTING` transitional status handling to prevent "Unknown error" on cost-limited runs

### Added

- CLAUDE.md rules for API preflight verification and e2e testing with representative data
- `.gstack/` added to `.gitignore`

## [0.1.1.0] - 2026-03-27 — Phase 1: Data Pipeline + Outlier UI

### Added

- Next.js app with Tailwind CSS dark mode, Pretendard/Satoshi/JetBrains Mono fonts
- Password middleware with httpOnly cookie auth for site protection
- `startScraping` Server Action with 1-hour cooldown and duplicate prevention
- Apify webhook handler with secret verification, idempotency, batch upsert, and failure handling
- Outlier score calculation excluding replies/reposts from baseline (ViewStats-style)
- Server-side polling for scraping job status (security: no anon key exposure)
- Home page with integrated input+button pattern
- Results page with outlier slider (2x-10x threshold), post cards with engagement metrics
- DB migration 002: UNIQUE on apify_run_id, CHECK on status, dataset_id column
- 61 unit tests covering outlier calculation, Apify schemas, and edge cases

### Changed

- Supabase Realtime replaced with server-side polling (eng review: anon key security)
- Webhook secret verification moved from Phase 4 to Phase 1
- mediaType schema uses `z.string().catch("text")` to prevent data loss from unknown types

## [0.1.0.0] - 2026-03-27 — Santiago Project Foundation

The complete planning foundation for Santiago, a Threads outlier analyzer inspired by ViewStats.

### Added

- **Eng Plan** with 5-phase architecture: Apify validation, data pipeline, AI analysis (Gemini 3.1 Pro via Vertex AI), collection/pattern analysis, and deploy.
- **Design System** (DESIGN.md) with typography, color palette, spacing, and component guidelines for the Korean-language UI.
- **3 ADRs**: Vertex AI Gemini selection, Apify webhook async pattern, password middleware auth.
- **Code Convention** covering naming, imports, patterns, error handling, and testing standards.
- **Design Doc** (v2, approved) with ViewStats reference model, 6-dimension analysis framework, and collection-based cross-account pattern analysis.
