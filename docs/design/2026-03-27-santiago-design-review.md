# Design Review: Santiago - Threads Outlier Analyzer

Date: 2026-03-27
Skill: /plan-design-review
Status: CLEAN (8/10)
Branch: ch9968/plan-design-review

## Summary

7개 디자인 차원에 대한 플랜 리뷰 완료. 초기 5/10에서 8/10으로 개선.

## Decisions Made

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Home history cards | Removed | Pure input terminal. Subtraction default. |
| 2 | Dimension Card scores | Text only (no scores/progress bar) | "LLM scores = fake rigor" principle |
| 3 | Mobile analysis layout | Analysis first + collapsible original text | Analysis is the page's purpose |
| 4 | Mid-stream back navigation | Background completion + DB cache | Show cached results on return |
| 5 | Re-analyze button position | Account summary header, right side | Self-evident |
| 6 | Mobile Outlier Item | 2-row stack (multiplier+text / metrics+heart) | 4-column not viable on mobile |

## Accessibility Fix

- stone-500 (#78716C) on stone-950: WCAG AA FAIL (4.12:1)
- Fixed: dark mode tertiary text → stone-400 (#A8A29E, 7.83:1 PASS)

## Scores by Dimension

| Dimension | Before | After |
|-----------|--------|-------|
| Information Architecture | 4 | 8 |
| Interaction States | 2 | 7 |
| User Journey | 5 | 7 |
| AI Slop Risk | 6 | 8 |
| Design System Alignment | 7 | 9 |
| Responsive & Accessibility | 2 | 8 |
| Unresolved Decisions | — | 4 resolved, 0 deferred |
| **Overall** | **5** | **8** |

## Files Modified

- `docs/plan/2026-03-27-threads-outlier-analyzer-design.md` — Added: info architecture, interaction states, user journey, AI slop prevention, responsive specs, design decisions
- `docs/plan/2026-03-27-threads-outlier-analyzer-eng-plan.md` — Updated home page description (removed history)
- `DESIGN.md` — Fixed Dimension Card (removed scores), fixed tertiary text contrast
