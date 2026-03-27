# Changelog

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
